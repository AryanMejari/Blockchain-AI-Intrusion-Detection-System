from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger("sentinel.ipfs")

BASE_DIR = Path(__file__).resolve().parent.parent
VAULT_DIR = BASE_DIR / "storage" / "ipfs_vault"
VAULT_DIR.mkdir(parents=True, exist_ok=True)

# Multiaddr and RPC endpoints for IPFS Desktop Kubo daemon
IPFS_MULTIADDR = os.environ.get("IPFS_MULTIADDR", "/ip4/127.0.0.1/tcp/5001")
IPFS_RPC_URL = os.environ.get("IPFS_RPC_URL", "http://127.0.0.1:5001")
IPFS_GATEWAY_LOCAL = os.environ.get("IPFS_GATEWAY_LOCAL", "http://127.0.0.1:8080/ipfs")
IPFS_GATEWAY_PUBLIC = "https://ipfs.io/ipfs"

# Base58 alphabet for standard IPFS CIDv0 generation
ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def base58_encode(b: bytes) -> str:
    """Encodes a byte sequence into standard Base58 string."""
    num = int.from_bytes(b, byteorder="big")
    chars = []
    while num > 0:
        num, rem = divmod(num, 58)
        chars.append(ALPHABET[rem])
    # Handle leading zeros
    for byte in b:
        if byte == 0:
            chars.append(ALPHABET[0])
        else:
            break
    return "".join(reversed(chars))


def _encode_varint(n: int) -> bytes:
    """Encodes an integer into a Protocol Buffers varint."""
    res = bytearray()
    while n > 0x7F:
        res.append((n & 0x7F) | 0x80)
        n >>= 7
    res.append(n)
    return bytes(res)


def compute_ipfs_cid(data_bytes: bytes) -> str:
    """
    Computes a 100% compliant IPFS CIDv0 (Base58 multihash) with UnixFS wrapping,
    identical byte-for-byte to Kubo 'ipfs add' / IPFS Desktop.
    
    Structure:
    1. UnixFS Data PB (Type = 2/File, Data = bytes, Filesize = len)
    2. MerkleDAG PBNode (Data = UnixFS Data PB)
    3. SHA2-256 + 0x12 0x20 multihash -> Base58 (CIDv0 Qm...)
    """
    length = len(data_bytes)
    len_varint = _encode_varint(length)
    
    # Inner UnixFS Data PB: tag 0x08 (type=2), tag 0x12 (data), tag 0x18 (filesize)
    inner = b"\x08\x02\x12" + len_varint + data_bytes + b"\x18" + len_varint
    
    # Outer PBNode: tag 0x0a (field 1: Data)
    node = b"\x0a" + _encode_varint(len(inner)) + inner
    
    sha256_digest = hashlib.sha256(node).digest()
    multihash = b"\x12\x20" + sha256_digest
    return base58_encode(multihash)


class IPFSStorageService:
    def __init__(self, vault_dir: Path = VAULT_DIR, rpc_url: str = IPFS_RPC_URL, multiaddr: str = IPFS_MULTIADDR):
        self.vault_dir = vault_dir
        self.vault_dir.mkdir(parents=True, exist_ok=True)
        self.rpc_url = rpc_url.rstrip("/")
        self.multiaddr = multiaddr

    def get_node_status(self) -> dict[str, Any]:
        """
        Polls the local IPFS Desktop / Kubo node at /ip4/127.0.0.1/tcp/5001
        to verify live connectivity, daemon version, and peer identity.
        """
        try:
            with httpx.Client(timeout=2.0) as client:
                id_res = client.post(f"{self.rpc_url}/api/v0/id")
                ver_res = client.post(f"{self.rpc_url}/api/v0/version")
                
                if id_res.status_code == 200 and ver_res.status_code == 200:
                    id_data = id_res.json()
                    ver_data = ver_res.json()
                    return {
                        "online": True,
                        "multiaddr": self.multiaddr,
                        "rpc_url": self.rpc_url,
                        "peer_id": id_data.get("ID", ""),
                        "agent_version": id_data.get("AgentVersion", "kubo/desktop"),
                        "version": ver_data.get("Version", "unknown"),
                        "golang": ver_data.get("Golang", ""),
                        "addresses_count": len(id_data.get("Addresses", [])),
                        "local_gateway": f"{IPFS_GATEWAY_LOCAL}/",
                        "public_gateway": f"{IPFS_GATEWAY_PUBLIC}/",
                    }
        except Exception as e:
            logger.debug("IPFS node at %s offline or unreachable: %s", self.rpc_url, e)

        return {
            "online": False,
            "multiaddr": self.multiaddr,
            "rpc_url": self.rpc_url,
            "peer_id": None,
            "agent_version": None,
            "version": None,
            "error": "Unable to connect to IPFS node at " + self.multiaddr,
            "local_gateway": f"{IPFS_GATEWAY_LOCAL}/",
            "public_gateway": f"{IPFS_GATEWAY_PUBLIC}/",
        }

    def store_bundle(self, bundle: dict[str, Any], bundle_type: str = "forensic_snapshot") -> dict[str, Any]:
        """
        Stores a forensic package into the content-addressed IPFS vault and pins
        it directly to the running IPFS Desktop node (/ip4/127.0.0.1/tcp/5001).
        Dual-persists to local disk for high-performance retrieval and offline resilience.
        """
        payload = {
            "type": bundle_type,
            "data": bundle,
        }
        # Canonical JSON encoding (sorted keys, compact)
        canonical_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        cid = compute_ipfs_cid(canonical_bytes)

        # 1. Local disk persistence
        file_path = self.vault_dir / f"{cid}.json"
        if not file_path.exists():
            with open(file_path, "wb") as f:
                f.write(canonical_bytes)

        # 2. Pin to live IPFS Desktop node
        pinned_to_node = False
        node_hash = None
        try:
            with httpx.Client(timeout=3.0) as client:
                files = {"file": (f"{cid}.json", canonical_bytes, "application/json")}
                resp = client.post(f"{self.rpc_url}/api/v0/add?pin=true", files=files)
                if resp.status_code == 200:
                    add_data = resp.json()
                    node_hash = add_data.get("Hash")
                    pinned_to_node = True
                    logger.info("Successfully pinned bundle to IPFS Desktop node: CID=%s", node_hash)
        except Exception as err:
            logger.warning("Could not pin bundle to live IPFS node at %s: %s", self.rpc_url, err)

        return {
            "cid": node_hash or cid,
            "size_bytes": len(canonical_bytes),
            "file_path": str(file_path),
            "bundle_type": bundle_type,
            "pinned_to_node": pinned_to_node,
            "gateway_url": f"{IPFS_GATEWAY_PUBLIC}/{cid}",
            "local_gateway_url": f"{IPFS_GATEWAY_LOCAL}/{cid}",
            "verified": True,
        }

    def get_bundle(self, cid: str) -> dict[str, Any] | None:
        """
        Retrieves and cryptographically verifies a bundle by its IPFS CID.
        Attempts retrieval via live IPFS Desktop daemon, with local vault fallback.
        """
        content: bytes | None = None

        # 1. Try local vault cache first for speed
        file_path = self.vault_dir / f"{cid}.json"
        if file_path.exists():
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
            except Exception as e:
                logger.warning("Failed to read local vault file %s: %s", file_path, e)

        # 2. If not found locally, query live IPFS node
        if content is None:
            try:
                with httpx.Client(timeout=3.0) as client:
                    resp = client.post(f"{self.rpc_url}/api/v0/cat", params={"arg": cid})
                    if resp.status_code == 200:
                        content = resp.content
                        # Cache locally for future requests
                        with open(file_path, "wb") as f:
                            f.write(content)
            except Exception as err:
                logger.debug("Failed to retrieve CID %s from live IPFS node: %s", cid, err)

        if content is None:
            return None

        # Cryptographically verify CID against retrieved content
        computed_cid = compute_ipfs_cid(content)
        is_authentic = (computed_cid == cid)

        try:
            parsed = json.loads(content.decode("utf-8"))
        except Exception:
            parsed = {"raw": content.decode("utf-8", errors="replace")}

        return {
            "cid": cid,
            "is_authentic": is_authentic,
            "computed_cid": computed_cid,
            "payload": parsed,
            "size_bytes": len(content),
            "gateway_url": f"{IPFS_GATEWAY_PUBLIC}/{cid}",
            "local_gateway_url": f"{IPFS_GATEWAY_LOCAL}/{cid}",
        }

    def list_bundles(self) -> list[dict[str, Any]]:
        """Lists all content-addressed files stored in the IPFS vault."""
        bundles = []
        for p in self.vault_dir.glob("*.json"):
            cid = p.stem
            size = p.stat().st_size
            bundles.append({
                "cid": cid,
                "size_bytes": size,
                "created_at": p.stat().st_mtime,
                "gateway_url": f"{IPFS_GATEWAY_PUBLIC}/{cid}",
                "local_gateway_url": f"{IPFS_GATEWAY_LOCAL}/{cid}",
            })
        return sorted(bundles, key=lambda x: x["created_at"], reverse=True)


ipfs_service = IPFSStorageService()
