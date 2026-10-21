import unittest
from backend.services.ipfs_storage import ipfs_service, compute_ipfs_cid
from backend.services.blockchain_ledger import blockchain_ledger, hash_event, compute_merkle_root
from backend.storage.db import get_db_connection

class BlockchainIPFSTests(unittest.TestCase):
    def setUp(self):
        blockchain_ledger.reset_ledger()
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM events")
        cur.execute("DELETE FROM alerts")
        conn.commit()
        conn.close()

    def tearDown(self):
        blockchain_ledger.reset_ledger()
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM events")
        cur.execute("DELETE FROM alerts")
        conn.commit()
        conn.close()

    def test_ipfs_cid_generation_and_retrieval(self):
        test_payload = {"evidence": "failed_login", "user": "alice", "ip": "192.168.1.100"}
        result = ipfs_service.store_bundle(test_payload, bundle_type="test_bundle")
        cid = result["cid"]
        
        self.assertTrue(cid.startswith("Qm"))
        self.assertTrue(result["verified"])

        retrieved = ipfs_service.get_bundle(cid)
        self.assertIsNotNone(retrieved)
        self.assertTrue(retrieved["is_authentic"])
        self.assertEqual(retrieved["payload"]["data"]["user"], "alice")

    def test_blockchain_genesis_and_anchoring(self):
        status = blockchain_ledger.get_status()
        self.assertEqual(status["block_height"], 0)
        self.assertTrue(status["chain_valid"])
        self.assertTrue(status["latest_ipfs_cid"].startswith("Qm"))

        # Anchor a simulated security event
        event = {
            "id": "EVT-TEST-100",
            "type": "failed_login",
            "timestamp": "2026-10-15T01:00:00Z",
            "user": "alice",
            "source": "192.168.1.105",
            "severity": "high",
            "detail": "Failed password attempt",
        }
        
        # Persist to events DB first
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO events (id, type, timestamp, user, source, severity, detection_status, detail, count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 1, ?)""",
            (event["id"], event["type"], event["timestamp"], event["user"], event["source"], event["severity"], event["detail"], event["timestamp"])
        )
        conn.commit()
        conn.close()

        block1 = blockchain_ledger.anchor_events([event])
        self.assertEqual(block1.index, 1)
        self.assertTrue(block1.ipfs_cid.startswith("Qm"))
        self.assertEqual(block1.events_count, 1)

        # Verify integrity
        audit = blockchain_ledger.verify_chain_integrity()
        self.assertEqual(audit["status"], "VALID")
        self.assertTrue(audit["is_valid"])

    def test_tamper_detection_and_restoration(self):
        event = {
            "id": "EVT-TEST-200",
            "type": "failed_login",
            "timestamp": "2026-10-15T01:10:00Z",
            "user": "bob",
            "source": "10.0.0.99",
            "severity": "critical",
            "detail": "Brute force attack signature detected",
        }

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO events (id, type, timestamp, user, source, severity, detection_status, detail, count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 1, ?)""",
            (event["id"], event["type"], event["timestamp"], event["user"], event["source"], event["severity"], event["detail"], event["timestamp"])
        )
        conn.commit()
        conn.close()

        blockchain_ledger.anchor_events([event])

        # Initially valid
        audit1 = blockchain_ledger.verify_chain_integrity()
        self.assertEqual(audit1["status"], "VALID")

        # Simulate adversarial tamper in SQLite
        tamper_res = blockchain_ledger.simulate_db_tamper(event["id"], "[HACKER] Cleaned up log line")
        self.assertEqual(tamper_res["status"], "tampered")

        # Re-verify: must catch the tampering
        audit2 = blockchain_ledger.verify_chain_integrity()
        self.assertEqual(audit2["status"], "COMPROMISED")
        self.assertFalse(audit2["is_valid"])
        self.assertEqual(len(audit2["tampered_events"]), 1)
        self.assertEqual(audit2["tampered_events"][0]["event_id"], event["id"])

        # Restore from IPFS snapshot
        restore_res = blockchain_ledger.restore_db_tamper(event["id"])
        self.assertEqual(restore_res["status"], "restored")

        # Verify again: must be restored to VALID
        audit3 = blockchain_ledger.verify_chain_integrity()
        self.assertEqual(audit3["status"], "VALID")
        self.assertTrue(audit3["is_valid"])

if __name__ == '__main__':
    unittest.main()
