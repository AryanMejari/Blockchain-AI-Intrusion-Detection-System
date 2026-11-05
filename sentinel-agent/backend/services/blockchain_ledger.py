from __future__ import annotations

import datetime
import hashlib
import json
import logging
import os
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from web3 import Web3

from backend.services.ipfs_storage import ipfs_service
from backend.storage.db import get_db_connection

logger = logging.getLogger("sentinel.ledger")

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
CONTRACTS_DIR = ROOT_DIR / "contracts"
BUILD_DIR = CONTRACTS_DIR / "build"
ARTIFACT_PATH = BUILD_DIR / "SentinelLedger.json"
DEPLOYMENT_PATH = BUILD_DIR / "deployment.json"

GANACHE_RPC_URL = os.environ.get("GANACHE_RPC_URL", "http://127.0.0.1:8545")


def hash_event(event: dict[str, Any]) -> str:
    """Computes a deterministic canonical SHA-256 leaf hash for an event's immutable telemetry."""
    normalized = {
        "id": str(event.get("id", "")),
        "type": str(event.get("type", "")),
        "user": str(event.get("user", "")),
        "source": str(event.get("source", "")),
        "detail": str(event.get("detail", "")),
        "timestamp": str(event.get("timestamp", "")),
    }
    canon = json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canon).hexdigest()


def compute_merkle_root(leaf_hashes: list[str]) -> str:
    """Computes standard pairwise Merkle root from leaf hashes."""
    if not leaf_hashes:
        return "0" * 64
    if len(leaf_hashes) == 1:
        return leaf_hashes[0]

    current_level = list(leaf_hashes)
    while len(current_level) > 1:
        next_level = []
        for i in range(0, len(current_level), 2):
            left = current_level[i]
            right = current_level[i + 1] if i + 1 < len(current_level) else left
            combined = hashlib.sha256((left + right).encode("utf-8")).hexdigest()
            next_level.append(combined)
        current_level = next_level

    return current_level[0]


@dataclass
class Block:
    index: int
    timestamp: str
    merkle_root: str
    ipfs_cid: str
    prev_hash: str
    block_hash: str
    event_ids: list[str]
    events_count: int
    miner: str = ""
    tx_hash: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class BlockchainLedger:
    """
    Ethereum / Ganache-backed non-repudiation audit ledger.
    All blocks, Merkle roots, IPFS content CIDs, and event hashes are recorded
    directly into the SentinelLedger Solidity smart contract on the Ganache EVM blockchain.
    """

    def __init__(self, rpc_url: str = GANACHE_RPC_URL):
        self.rpc_url = rpc_url
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.contract_address: str | None = None
        self.contract = None
        self.account = None
        self._ensure_ganache_and_contract()

    def _ensure_artifact(self) -> dict[str, Any]:
        """Ensures the Solidity contract is compiled and loads its ABI and bytecode."""
        if not ARTIFACT_PATH.exists():
            logger.info("SentinelLedger artifact missing. Compiling Solidity contract via compile.js...")
            compile_script = CONTRACTS_DIR / "compile.js"
            subprocess.run(["node", str(compile_script)], check=True, cwd=str(ROOT_DIR))

        with open(ARTIFACT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    def _ensure_ganache_and_contract(self) -> None:
        """Connects to Ganache and attaches to or deploys the SentinelLedger smart contract."""
        if not self.w3.is_connected():
            logger.warning("Ganache RPC not reachable at %s. Attempting to start/verify connection...", self.rpc_url)
            self.contract = None
            self.account = None
            return

        accounts = self.w3.eth.accounts
        if not accounts:
            logger.warning("No Ethereum accounts found on Ganache RPC at %s", self.rpc_url)
            return

        self.account = accounts[0]
        artifact = self._ensure_artifact()
        abi = artifact["abi"]
        bytecode = artifact["bytecode"]

        # Check existing deployment file
        need_deploy = True
        if DEPLOYMENT_PATH.exists():
            try:
                with open(DEPLOYMENT_PATH, "r", encoding="utf-8") as f:
                    dep_info = json.load(f)
                    candidate_addr = dep_info.get("contract_address")
                    if candidate_addr and self.w3.is_address(candidate_addr):
                        code = self.w3.eth.get_code(candidate_addr)
                        if len(code) > 2:  # Contract exists on-chain
                            self.contract_address = candidate_addr
                            self.contract = self.w3.eth.contract(address=self.contract_address, abi=abi)
                            need_deploy = False
                            logger.info("Connected to existing SentinelLedger contract at: %s", self.contract_address)
            except Exception as e:
                logger.warning("Failed to load existing deployment info: %s", e)

        if need_deploy:
            self._deploy_contract(abi, bytecode)

    def _deploy_contract(self, abi: list[dict[str, Any]], bytecode: str) -> None:
        """Deploys SentinelLedger Solidity smart contract to Ganache with Genesis Block #0."""
        genesis_time = "2026-10-01T00:00:00Z"
        genesis_bundle = {
            "message": "Sentinel Security Operations Micro-Ledger Genesis Anchor",
            "engine": "Ganache EVM Ethereum Blockchain + Solidity Smart Contract + SWI-Prolog",
            "storage": "InterPlanetary File System (IPFS) Content-Addressed Vault",
            "initialized_at": genesis_time,
        }
        ipfs_res = ipfs_service.store_bundle(genesis_bundle, bundle_type="genesis_snapshot")
        genesis_cid = ipfs_res["cid"]

        genesis_merkle_bytes = self.w3.keccak(text="SENTINEL_GENESIS_ROOT")

        contract_factory = self.w3.eth.contract(abi=abi, bytecode=bytecode)
        tx_hash = contract_factory.constructor(genesis_cid, genesis_merkle_bytes).transact({"from": self.account})
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        self.contract_address = receipt.contractAddress
        self.contract = self.w3.eth.contract(address=self.contract_address, abi=abi)

        DEPLOYMENT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DEPLOYMENT_PATH, "w", encoding="utf-8") as f:
            json.dump({
                "contract_name": "SentinelLedger",
                "contract_address": self.contract_address,
                "deployer": self.account,
                "network_id": self.w3.eth.chain_id,
                "genesis_ipfs_cid": genesis_cid,
                "deployed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }, f, indent=2)

        logger.info("Successfully deployed SentinelLedger Solidity contract to Ganache: %s", self.contract_address)

    def get_network_status(self) -> dict[str, Any]:
        """Returns the status of the Ganache Ethereum EVM blockchain and deployed contract."""
        connected = self.w3.is_connected()
        chain_id = None
        block_number = None
        gas_price = None

        if connected:
            try:
                chain_id = self.w3.eth.chain_id
                block_number = self.w3.eth.block_number
                gas_price = self.w3.eth.gas_price
            except Exception:
                pass

        return {
            "connected": connected,
            "provider": self.rpc_url,
            "chain_id": chain_id,
            "network_name": "Ganache (Local Ethereum EVM)",
            "contract_address": self.contract_address,
            "deployer_account": self.account,
            "current_eth_block": block_number,
            "gas_price_gwei": round(gas_price / 1e9, 2) if gas_price else 2.0,
        }

    def get_latest_block(self) -> Block:
        """Retrieves latest block directly from the Ganache Solidity smart contract."""
        self._ensure_ganache_and_contract()
        if not self.contract:
            raise RuntimeError("SentinelLedger contract is not initialized or Ganache is offline.")

        status = self.contract.functions.getStatus().call()
        latest_index = status[1]  # blockHeight
        raw_block = self.contract.functions.getBlock(latest_index).call()

        dt_str = datetime.datetime.fromtimestamp(raw_block[1], tz=datetime.timezone.utc).isoformat()
        return Block(
            index=raw_block[0],
            timestamp=dt_str,
            merkle_root=raw_block[2],
            ipfs_cid=raw_block[3],
            prev_hash=raw_block[4],
            block_hash=raw_block[5],
            events_count=raw_block[6],
            event_ids=raw_block[7],
            miner=raw_block[8],
        )

    def anchor_events(self, events: list[dict[str, Any]], alerts: list[dict[str, Any]] | None = None) -> Block:
        """
        Batches events, pins forensic bundle to IPFS Desktop, computes Merkle root,
        and mines a new block directly on the Ganache Ethereum blockchain via Solidity smart contract.
        """
        if not events:
            return self.get_latest_block()

        self._ensure_ganache_and_contract()
        if not self.contract:
            raise RuntimeError("Cannot anchor events: Ganache is offline or contract is not deployed.")

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 1. Compute leaf hashes and Merkle root
        leaf_hashes = [hash_event(ev) for ev in events]
        merkle_root_hex = compute_merkle_root(leaf_hashes)
        merkle_bytes32 = bytes.fromhex(merkle_root_hex)

        # 2. Pin complete forensic evidence bundle to IPFS Desktop node
        forensic_bundle = {
            "timestamp": now_iso,
            "merkle_root": "0x" + merkle_root_hex,
            "events": events,
            "alerts": alerts or [],
            "event_hashes": {ev["id"]: hash_event(ev) for ev in events},
        }
        ipfs_res = ipfs_service.store_bundle(forensic_bundle, bundle_type="audit_forensics")
        ipfs_cid = ipfs_res["cid"]

        # 3. Transact with Ganache Solidity smart contract
        event_ids = [str(ev["id"]) for ev in events]
        tx_hash = self.contract.functions.anchorBlock(
            merkle_bytes32,
            ipfs_cid,
            len(events),
            event_ids
        ).transact({"from": self.account})

        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        tx_hash_hex = receipt.transactionHash.hex()

        # 4. Fetch the mined block from Ganache state
        latest_block = self.get_latest_block()
        latest_block.tx_hash = tx_hash_hex
        logger.info(
            "Mined on-chain Block #%d on Ganache (Tx: %s, Gas: %d). IPFS CID: %s",
            latest_block.index,
            tx_hash_hex,
            receipt.gasUsed,
            ipfs_cid,
        )
        return latest_block

    def get_blocks(self, limit: int = 50) -> list[dict[str, Any]]:
        """Returns recent blocks directly from Ganache Solidity smart contract."""
        self._ensure_ganache_and_contract()
        if not self.contract:
            return []

        try:
            raw_list = self.contract.functions.getRecentBlocks(limit).call()
            blocks = []
            for b in raw_list:
                dt_str = datetime.datetime.fromtimestamp(b[1], tz=datetime.timezone.utc).isoformat()
                blocks.append({
                    "block_index": b[0],
                    "timestamp": dt_str,
                    "merkle_root": b[2],
                    "ipfs_cid": b[3],
                    "prev_hash": b[4],
                    "block_hash": b[5],
                    "events_count": b[6],
                    "event_ids": b[7],
                    "miner": b[8],
                })
            return blocks
        except Exception as e:
            logger.warning("Failed to retrieve blocks from Ganache smart contract: %s", e)
            return []

    def get_status(self) -> dict[str, Any]:
        """Returns real-time status of the Ganache smart contract ledger."""
        self._ensure_ganache_and_contract()
        if not self.contract:
            return {
                "chain_valid": False,
                "block_height": 0,
                "total_blocks": 0,
                "total_anchored_events": 0,
                "latest_block_hash": "0x" + "0" * 64,
                "latest_merkle_root": "0x" + "0" * 64,
                "latest_ipfs_cid": "",
                "contract_address": None,
                "network": "Ganache (Offline)",
                "ipfs_objects_count": len(ipfs_service.list_bundles()),
            }

        try:
            status = self.contract.functions.getStatus().call()
            ipfs_bundles = ipfs_service.list_bundles()

            return {
                "chain_valid": status[0],
                "block_height": status[1],
                "total_blocks": status[2],
                "total_anchored_events": status[3],
                "latest_block_hash": status[4],
                "latest_merkle_root": status[5],
                "latest_ipfs_cid": status[6],
                "contract_address": status[7],
                "network": "Ganache (Local EVM)",
                "chain_id": self.w3.eth.chain_id,
                "rpc_url": self.rpc_url,
                "ipfs_objects_count": len(ipfs_bundles),
            }
        except Exception as e:
            logger.warning("Failed to retrieve status from Ganache smart contract: %s", e)
            return {
                "chain_valid": False,
                "block_height": 0,
                "total_blocks": 0,
                "total_anchored_events": 0,
                "latest_block_hash": "0x" + "0" * 64,
                "latest_merkle_root": "0x" + "0" * 64,
                "latest_ipfs_cid": "",
                "contract_address": self.contract_address,
                "network": "Ganache (Offline)",
                "ipfs_objects_count": len(ipfs_service.list_bundles()),
            }

    def verify_chain_integrity(self) -> dict[str, Any]:
        """
        Performs dual verification:
        1. On-chain EVM verification via Solidity contract execution on Ganache (checks parent links and block hashes).
        2. Content-addressed IPFS verification cross-checking SQLite rows against immutable Merkle leaves.
        """
        self._ensure_ganache_and_contract()
        if not self.contract:
            return {
                "status": "COMPROMISED",
                "is_valid": False,
                "blocks_scanned": 0,
                "verified_events_count": 0,
                "chain_errors": [{"block_index": 0, "error": "Ganache smart contract unreachable"}],
                "tampered_events": [],
                "audit_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

        # 1. On-chain EVM verification call
        try:
            onchain_res = self.contract.functions.verifyChainIntegrity().call()
            evm_valid = onchain_res[0]
            blocks_scanned = onchain_res[1]
        except Exception as e:
            logger.warning("Ganache verifyChainIntegrity failed: %s", e)
            return {
                "status": "COMPROMISED",
                "is_valid": False,
                "blocks_scanned": 0,
                "verified_events_count": 0,
                "chain_errors": [{"block_index": 0, "error": f"Ganache contract error: {e}"}],
                "tampered_events": [],
                "audit_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

        chain_errors = []
        if not evm_valid:
            chain_errors.append({
                "block_index": blocks_scanned,
                "error": f"On-chain EVM header linkage broken at block #{blocks_scanned}",
            })

        # 2. Database cross-check against Ganache on-chain blocks and IPFS bundles
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events")
        db_events = {r["id"]: dict(r) for r in cursor.fetchall()}
        conn.close()

        blocks = self.get_blocks(limit=100)
        tampered_events = []
        verified_events_count = 0

        for b in blocks:
            cid = b["ipfs_cid"]
            bundle = ipfs_service.get_bundle(cid)
            if not bundle or not bundle.get("is_authentic"):
                chain_errors.append({
                    "block_index": b["block_index"],
                    "ipfs_cid": cid,
                    "error": f"IPFS forensic bundle for Block #{b['block_index']} missing or corrupted",
                })
                continue

            event_hashes = bundle.get("payload", {}).get("data", {}).get("event_hashes", {})
            for eid, orig_hash in event_hashes.items():
                if eid in db_events:
                    curr_hash = hash_event(db_events[eid])
                    if curr_hash != orig_hash:
                        tampered_events.append({
                            "event_id": eid,
                            "block_index": b["block_index"],
                            "expected_hash": orig_hash,
                            "current_db_hash": curr_hash,
                            "current_detail": db_events[eid].get("detail"),
                            "user": db_events[eid].get("user"),
                            "source": db_events[eid].get("source"),
                        })
                    else:
                        verified_events_count += 1

        is_valid = evm_valid and len(chain_errors) == 0 and len(tampered_events) == 0

        return {
            "status": "VALID" if is_valid else "COMPROMISED",
            "is_valid": is_valid,
            "blocks_scanned": blocks_scanned,
            "verified_events_count": verified_events_count,
            "chain_errors": chain_errors,
            "tampered_events": tampered_events,
            "contract_address": self.contract_address,
            "network": "Ganache (EVM)",
            "audit_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    def simulate_db_tamper(self, event_id: str | None = None, altered_detail: str | None = None) -> dict[str, Any]:
        """
        Simulates an adversary modifying an audit row directly in SQLite
        to test Sentinel's cryptographic anti-tamper detection against Ganache.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        target_id = event_id
        if not target_id:
            cursor.execute("SELECT id, detail FROM events ORDER BY created_at DESC LIMIT 1")
            row = cursor.fetchone()
            if not row:
                conn.close()
                return {"status": "error", "message": "No events in database to tamper with."}
            target_id = row["id"]
            original_detail = row["detail"]
        else:
            cursor.execute("SELECT detail FROM events WHERE id = ?", (target_id,))
            row = cursor.fetchone()
            original_detail = row["detail"] if row else ""

        tampered_text = altered_detail or "[ATTACKER_TAMPERED] Log modified: No malicious activity observed."
        cursor.execute("UPDATE events SET detail = ? WHERE id = ?", (tampered_text, target_id))
        conn.commit()
        conn.close()

        logger.warning("Simulated tamper on event '%s'. Old: '%s', New: '%s'", target_id, original_detail, tampered_text)
        return {
            "status": "tampered",
            "event_id": target_id,
            "original_detail": original_detail,
            "tampered_detail": tampered_text,
            "message": f"Event '{target_id}' modified in SQLite. Run cryptographic verification to observe tamper detection.",
        }

    def restore_db_tamper(self, event_id: str) -> dict[str, Any]:
        """
        Restores a tampered database row from the immutable IPFS bundle
        anchored on the Ganache Solidity smart contract.
        """
        self._ensure_ganache_and_contract()
        if not self.contract:
            return {"status": "error", "message": "Ganache contract unavailable."}

        # Query on-chain block index for this event
        try:
            target_block_idx = self.contract.functions.eventToBlockIndex(event_id).call()
        except Exception:
            target_block_idx = 0

        # Query IPFS CID for target block
        raw_block = self.contract.functions.getBlock(target_block_idx).call()
        cid = raw_block[3]

        bundle = ipfs_service.get_bundle(cid)
        if not bundle:
            # Fallback scan all recent blocks if eventToBlockIndex was 0
            for b in self.get_blocks(limit=50):
                b_bundle = ipfs_service.get_bundle(b["ipfs_cid"])
                if b_bundle:
                    events = b_bundle.get("payload", {}).get("data", {}).get("events", [])
                    if any(e.get("id") == event_id for e in events):
                        bundle = b_bundle
                        break

        if not bundle:
            return {"status": "error", "message": f"IPFS bundle for event '{event_id}' not found."}

        events = bundle.get("payload", {}).get("data", {}).get("events", [])
        orig_event = next((e for e in events if e.get("id") == event_id), None)
        if not orig_event:
            return {"status": "error", "message": "Original event not found in IPFS snapshot."}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE events SET detail = ?, severity = ? WHERE id = ?",
            (orig_event.get("detail", ""), orig_event.get("severity", "low"), event_id),
        )
        conn.commit()
        conn.close()

        return {
            "status": "restored",
            "event_id": event_id,
            "restored_detail": orig_event.get("detail"),
            "message": f"Event '{event_id}' restored from immutable IPFS snapshot anchored on Ganache.",
        }

    def reset_ledger(self) -> None:
        """Resets the Solidity smart contract on Ganache back to Genesis Block #0."""
        self._ensure_ganache_and_contract()
        if not self.contract:
            return

        genesis_time = "2026-10-01T00:00:00Z"
        genesis_bundle = {
            "message": "Sentinel Security Operations Micro-Ledger Genesis Anchor",
            "engine": "Ganache EVM Ethereum Blockchain + Solidity Smart Contract + SWI-Prolog",
            "storage": "InterPlanetary File System (IPFS) Content-Addressed Vault",
            "initialized_at": genesis_time,
        }
        ipfs_res = ipfs_service.store_bundle(genesis_bundle, bundle_type="genesis_snapshot")
        genesis_cid = ipfs_res["cid"]
        genesis_merkle_bytes = self.w3.keccak(text="SENTINEL_GENESIS_ROOT")

        tx = self.contract.functions.resetLedger(genesis_cid, genesis_merkle_bytes).transact({"from": self.account})
        self.w3.eth.wait_for_transaction_receipt(tx)
        logger.info("Reset on-chain SentinelLedger contract to Genesis #0 on Ganache.")


blockchain_ledger = BlockchainLedger()
