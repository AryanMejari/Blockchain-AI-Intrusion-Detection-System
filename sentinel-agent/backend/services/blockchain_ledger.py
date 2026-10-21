from __future__ import annotations

import datetime
import hashlib
import json
import logging
from dataclasses import asdict, dataclass
from typing import Any

from backend.services.ipfs_storage import ipfs_service
from backend.storage.db import get_db_connection

logger = logging.getLogger("sentinel.ledger")


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


def compute_block_hash(
    index: int,
    timestamp: str,
    merkle_root: str,
    ipfs_cid: str,
    prev_hash: str,
    nonce: int = 0,
) -> str:
    payload = f"{index}:{timestamp}:{merkle_root}:{ipfs_cid}:{prev_hash}:{nonce}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


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
    nonce: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class BlockchainLedger:
    def __init__(self):
        self._ensure_genesis()

    def _ensure_genesis(self) -> None:
        """Ensures Genesis Block (Block #0) exists in database and its IPFS bundle is authentic."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ledger_blocks WHERE block_index = 0")
        row = cursor.fetchone()

        needs_genesis = False
        if not row:
            needs_genesis = True
        else:
            bundle = ipfs_service.get_bundle(row["ipfs_cid"])
            if not bundle or not bundle.get("is_authentic"):
                needs_genesis = True
                cursor.execute("DELETE FROM ledger_blocks WHERE block_index = 0")
                conn.commit()

        if needs_genesis:
            genesis_time = "2026-10-01T00:00:00Z"
            # Genesis forensic snapshot pinned to IPFS
            genesis_bundle = {
                "message": "Sentinel Security Operations Micro-Ledger Genesis Anchor",
                "engine": "SWI-Prolog 10.0 + Cryptographic Merkle Tree",
                "storage": "InterPlanetary File System (IPFS) Content-Addressed Vault",
                "initialized_at": genesis_time,
            }
            ipfs_res = ipfs_service.store_bundle(genesis_bundle, bundle_type="genesis_snapshot")
            merkle_root = hashlib.sha256(b"SENTINEL_GENESIS_ROOT").hexdigest()
            prev_hash = "0" * 64
            block_hash = compute_block_hash(0, genesis_time, merkle_root, ipfs_res["cid"], prev_hash, 0)

            cursor.execute(
                """
                INSERT INTO ledger_blocks 
                (block_index, timestamp, merkle_root, ipfs_cid, prev_hash, block_hash, event_ids_json, events_count, nonce)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (0, genesis_time, merkle_root, ipfs_res["cid"], prev_hash, block_hash, json.dumps([]), 0, 0),
            )
            conn.commit()
            logger.info("Genesis block #0 created with IPFS CID: %s", ipfs_res["cid"])
        conn.close()

    def get_latest_block(self) -> Block:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ledger_blocks ORDER BY block_index DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        if not row:
            self._ensure_genesis()
            return self.get_latest_block()

        return Block(
            index=row["block_index"],
            timestamp=row["timestamp"],
            merkle_root=row["merkle_root"],
            ipfs_cid=row["ipfs_cid"],
            prev_hash=row["prev_hash"],
            block_hash=row["block_hash"],
            event_ids=json.loads(row["event_ids_json"]),
            events_count=row["events_count"],
            nonce=row["nonce"],
        )

    def anchor_events(self, events: list[dict[str, Any]], alerts: list[dict[str, Any]] | None = None) -> Block:
        """
        Batches events into a new cryptographic block, stores the complete forensic
        evidence bundle in IPFS, calculates Merkle root, and appends to the blockchain.
        """
        if not events:
            return self.get_latest_block()

        latest = self.get_latest_block()
        new_index = latest.index + 1
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Compute leaf hashes and Merkle root
        leaf_hashes = [hash_event(ev) for ev in events]
        merkle_root = compute_merkle_root(leaf_hashes)

        # Build complete forensic evidence bundle for IPFS
        forensic_bundle = {
            "block_index": new_index,
            "timestamp": now,
            "merkle_root": merkle_root,
            "events": events,
            "alerts": alerts or [],
            "event_hashes": {ev["id"]: hash_event(ev) for ev in events},
        }
        ipfs_res = ipfs_service.store_bundle(forensic_bundle, bundle_type="audit_forensics")
        ipfs_cid = ipfs_res["cid"]

        # Calculate block hash
        prev_hash = latest.block_hash
        block_hash = compute_block_hash(new_index, now, merkle_root, ipfs_cid, prev_hash, 0)
        event_ids = [ev["id"] for ev in events]

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO ledger_blocks 
            (block_index, timestamp, merkle_root, ipfs_cid, prev_hash, block_hash, event_ids_json, events_count, nonce)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (new_index, now, merkle_root, ipfs_cid, prev_hash, block_hash, json.dumps(event_ids), len(events), 0),
        )
        conn.commit()
        conn.close()

        logger.info("Mined Block #%d with %d events. IPFS CID: %s", new_index, len(events), ipfs_cid)
        return Block(
            index=new_index,
            timestamp=now,
            merkle_root=merkle_root,
            ipfs_cid=ipfs_cid,
            prev_hash=prev_hash,
            block_hash=block_hash,
            event_ids=event_ids,
            events_count=len(events),
            nonce=0,
        )

    def get_blocks(self, limit: int = 50) -> list[dict[str, Any]]:
        """Returns recent blocks ordered newest first."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ledger_blocks ORDER BY block_index DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()

        blocks = []
        for r in rows:
            d = dict(r)
            d["event_ids"] = json.loads(d["event_ids_json"])
            del d["event_ids_json"]
            blocks.append(d)
        return blocks

    def get_status(self) -> dict[str, Any]:
        """Returns high-level blockchain and IPFS statistics."""
        latest = self.get_latest_block()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT SUM(events_count) as total_anchored, COUNT(*) as block_count FROM ledger_blocks")
        stats = cursor.fetchone()
        conn.close()

        ipfs_bundles = ipfs_service.list_bundles()

        return {
            "chain_valid": True,
            "block_height": latest.index,
            "total_blocks": stats["block_count"] if stats else 1,
            "total_anchored_events": stats["total_anchored"] if stats and stats["total_anchored"] else 0,
            "latest_block_hash": latest.block_hash,
            "latest_merkle_root": latest.merkle_root,
            "latest_ipfs_cid": latest.ipfs_cid,
            "ipfs_objects_count": len(ipfs_bundles),
        }

    def verify_chain_integrity(self) -> dict[str, Any]:
        """
        Comprehensive cryptographic audit:
        1. Checks block prev_hash chaining from Genesis to tip.
        2. Verifies IPFS content CIDs.
        3. Cross-checks database rows against Merkle leaf hashes to catch tampering.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ledger_blocks ORDER BY block_index ASC")
        rows = cursor.fetchall()

        # Map current DB events
        cursor.execute("SELECT * FROM events")
        db_events = {r["id"]: dict(r) for r in cursor.fetchall()}
        conn.close()

        chain_errors = []
        tampered_events = []
        verified_events_count = 0

        # 1. Verify blocks chaining
        for i in range(len(rows)):
            cur = rows[i]
            # Verify block self-hash
            expected_hash = compute_block_hash(
                cur["block_index"],
                cur["timestamp"],
                cur["merkle_root"],
                cur["ipfs_cid"],
                cur["prev_hash"],
                cur["nonce"],
            )
            if expected_hash != cur["block_hash"]:
                chain_errors.append({
                    "block_index": cur["block_index"],
                    "error": f"Block #{cur['block_index']} hash mismatch. Recorded: {cur['block_hash']}, Recomputed: {expected_hash}",
                })

            if i > 0:
                prev = rows[i - 1]
                if cur["prev_hash"] != prev["block_hash"]:
                    chain_errors.append({
                        "block_index": cur["block_index"],
                        "error": f"Broken chain link between Block #{prev['block_index']} and #{cur['block_index']}",
                    })

            # 2. Verify IPFS CID
            bundle = ipfs_service.get_bundle(cur["ipfs_cid"])
            if not bundle or not bundle.get("is_authentic"):
                chain_errors.append({
                    "block_index": cur["block_index"],
                    "ipfs_cid": cur["ipfs_cid"],
                    "error": f"IPFS bundle for Block #{cur['block_index']} is missing or corrupted",
                })
            elif bundle and "event_hashes" in bundle.get("payload", {}).get("data", {}):
                # Cross-check recorded event hashes against active database rows
                recorded_hashes = bundle["payload"]["data"]["event_hashes"]
                for eid, orig_hash in recorded_hashes.items():
                    if eid in db_events:
                        current_db_hash = hash_event(db_events[eid])
                        if current_db_hash != orig_hash:
                            tampered_events.append({
                                "event_id": eid,
                                "block_index": cur["block_index"],
                                "expected_hash": orig_hash,
                                "current_db_hash": current_db_hash,
                                "current_detail": db_events[eid].get("detail"),
                                "user": db_events[eid].get("user"),
                                "source": db_events[eid].get("source"),
                            })
                        else:
                            verified_events_count += 1

        is_valid = len(chain_errors) == 0 and len(tampered_events) == 0

        return {
            "status": "VALID" if is_valid else "COMPROMISED",
            "is_valid": is_valid,
            "blocks_scanned": len(rows),
            "verified_events_count": verified_events_count,
            "chain_errors": chain_errors,
            "tampered_events": tampered_events,
            "audit_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    def simulate_db_tamper(self, event_id: str | None = None, altered_detail: str | None = None) -> dict[str, Any]:
        """
        Simulates an adversary modifying an audit row directly in SQLite
        to test Sentinel's cryptographic anti-tamper detection.
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
        """Restores a tampered database row from the immutable IPFS bundle."""
        # Find block containing event
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ipfs_cid, event_ids_json FROM ledger_blocks WHERE event_ids_json LIKE ?", (f"%{event_id}%",))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return {"status": "error", "message": f"Event '{event_id}' not found in any ledger block."}

        bundle = ipfs_service.get_bundle(row["ipfs_cid"])
        if not bundle:
            return {"status": "error", "message": "IPFS bundle not found."}

        events = bundle.get("payload", {}).get("data", {}).get("events", [])
        orig_event = next((e for e in events if e.get("id") == event_id), None)
        if not orig_event:
            return {"status": "error", "message": "Original event not found in IPFS snapshot."}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE events SET detail = ?, severity = ? WHERE id = ?", (orig_event.get("detail", ""), orig_event.get("severity", "low"), event_id))
        conn.commit()
        conn.close()

        return {
            "status": "restored",
            "event_id": event_id,
            "restored_detail": orig_event.get("detail"),
            "message": f"Event '{event_id}' restored from immutable IPFS snapshot.",
        }

    def reset_ledger(self) -> None:
        """Resets the blockchain back to Genesis Block #0."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ledger_blocks")
        conn.commit()
        conn.close()
        self._ensure_genesis()


blockchain_ledger = BlockchainLedger()
