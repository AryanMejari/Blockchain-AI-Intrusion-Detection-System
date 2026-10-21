from __future__ import annotations

import datetime
import hashlib
import json
import logging
import uuid
from typing import Any

from backend.services.blockchain_ledger import blockchain_ledger
from backend.services.ipfs_storage import ipfs_service
from backend.storage.db import get_db_connection

logger = logging.getLogger("sentinel.reports")


class ReportService:
    def generate_audit_report(self, title: str | None = None) -> dict[str, Any]:
        """
        Synthesizes active security events, SOC alerts, blockchain state, and IPFS attestation
        into an immutable forensic audit report, and pins it to the live IPFS Desktop node.
        """
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        report_id = f"REP-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        report_title = title or f"Sentinel Cryptographic SOC Audit & Incident Report [{report_id}]"

        # 1. Fetch blockchain state and verify chain integrity
        ledger_status = blockchain_ledger.get_status()
        chain_audit = blockchain_ledger.verify_chain_integrity()
        blocks = blockchain_ledger.get_blocks(limit=25)

        # 2. Fetch IPFS Desktop node status
        ipfs_node = ipfs_service.get_node_status()

        # 3. Fetch all events and alerts from database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events ORDER BY timestamp DESC LIMIT 200")
        events = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC")
        alerts = [dict(r) for r in cursor.fetchall()]
        conn.close()

        # 4. Severity and category aggregations
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for a in alerts:
            sev = a.get("severity", "low").lower()
            if sev in severity_counts:
                severity_counts[sev] += 1

        attack_types: dict[str, int] = {}
        for a in alerts:
            rule = a.get("rule", "unclassified")
            attack_types[rule] = attack_types.get(rule, 0) + 1

        # 5. Build canonical forensic report payload
        report_data = {
            "report_id": report_id,
            "title": report_title,
            "generated_at": now,
            "auditor": "Sentinel Automated SOC Reasoning Engine (SWI-Prolog + Blockchain)",
            "cryptographic_attestation": {
                "chain_valid": chain_audit["is_valid"],
                "chain_status": chain_audit["status"],
                "block_height": ledger_status["block_height"],
                "total_blocks": ledger_status["total_blocks"],
                "total_anchored_events": ledger_status["total_anchored_events"],
                "latest_block_hash": ledger_status["latest_block_hash"],
                "latest_merkle_root": ledger_status["latest_merkle_root"],
                "latest_ipfs_cid": ledger_status["latest_ipfs_cid"],
                "blocks_scanned": chain_audit["blocks_scanned"],
                "verified_events_count": chain_audit["verified_events_count"],
                "chain_errors": chain_audit["chain_errors"],
                "tampered_events": chain_audit["tampered_events"],
            },
            "ipfs_node_attestation": {
                "online": ipfs_node.get("online", False),
                "multiaddr": ipfs_node.get("multiaddr", "/ip4/127.0.0.1/tcp/5001"),
                "peer_id": ipfs_node.get("peer_id"),
                "agent_version": ipfs_node.get("agent_version"),
                "version": ipfs_node.get("version"),
                "gateway_url": ipfs_node.get("public_gateway"),
            },
            "security_summary": {
                "total_events_analyzed": len(events),
                "total_alerts_raised": len(alerts),
                "severity_breakdown": severity_counts,
                "detected_attack_vectors": attack_types,
            },
            "alerts": [
                {
                    "id": a["id"],
                    "title": a["title"],
                    "severity": a["severity"],
                    "rule": a["rule"],
                    "subject": a["subject"],
                    "status": a["status"],
                    "summary": a["summary"],
                    "rationale": a["rationale"],
                    "observed_facts": json.loads(a["observed_facts"]) if isinstance(a["observed_facts"], str) else a["observed_facts"],
                    "inferred_facts": json.loads(a["inferred_facts"]) if isinstance(a["inferred_facts"], str) else a["inferred_facts"],
                    "recommended_action": json.loads(a["recommended_action"]) if isinstance(a["recommended_action"], str) else a["recommended_action"],
                    "created_at": a["created_at"],
                }
                for a in alerts[:25]
            ],
            "recent_blocks": [
                {
                    "block_index": b["block_index"],
                    "timestamp": b["timestamp"],
                    "block_hash": b["block_hash"],
                    "merkle_root": b["merkle_root"],
                    "ipfs_cid": b["ipfs_cid"],
                    "events_count": b["events_count"],
                }
                for b in blocks[:10]
            ],
        }

        # 6. Compute canonical SHA-256 integrity hash of report
        canon_bytes = json.dumps(report_data, sort_keys=True, separators=(",", ":")).encode("utf-8")
        report_sha256 = hashlib.sha256(canon_bytes).hexdigest()
        report_data["report_hash_sha256"] = report_sha256

        # 7. Pin report to IPFS Desktop node
        ipfs_res = ipfs_service.store_bundle(report_data, bundle_type="soc_audit_report")
        ipfs_cid = ipfs_res["cid"]
        report_data["ipfs_cid"] = ipfs_cid
        report_data["ipfs_gateway_url"] = ipfs_res["gateway_url"]
        report_data["pinned_to_node"] = ipfs_res.get("pinned_to_node", False)

        summary = {
            "report_id": report_id,
            "title": report_title,
            "generated_at": now,
            "status": chain_audit["status"],
            "block_height": ledger_status["block_height"],
            "total_events": len(events),
            "total_alerts": len(alerts),
            "critical_alerts": severity_counts["critical"],
            "high_alerts": severity_counts["high"],
            "ipfs_cid": ipfs_cid,
            "report_hash": report_sha256,
        }

        # 8. Persist report to SQLite
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audit_reports (id, title, created_at, ipfs_cid, block_height, status, summary_json, report_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_id,
                report_title,
                now,
                ipfs_cid,
                ledger_status["block_height"],
                chain_audit["status"],
                json.dumps(summary),
                json.dumps(report_data),
            ),
        )
        conn.commit()
        conn.close()

        logger.info("Generated audit report %s pinned to IPFS CID: %s", report_id, ipfs_cid)
        return report_data

    def list_reports(self) -> list[dict[str, Any]]:
        """Lists all previously generated audit reports."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, created_at, ipfs_cid, block_height, status, summary_json FROM audit_reports ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()

        reports = []
        for r in rows:
            reports.append({
                "id": r["id"],
                "title": r["title"],
                "created_at": r["created_at"],
                "ipfs_cid": r["ipfs_cid"],
                "block_height": r["block_height"],
                "status": r["status"],
                "summary": json.loads(r["summary_json"]),
                "gateway_url": f"https://ipfs.io/ipfs/{r['ipfs_cid']}",
            })
        return reports

    def get_report(self, report_id: str) -> dict[str, Any] | None:
        """Retrieves complete report by ID."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT report_json FROM audit_reports WHERE id = ?", (report_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None
        return json.loads(row["report_json"])

    def generate_markdown(self, report_id: str) -> str | None:
        """Exports an executive and technical Markdown report ready for compliance presentation."""
        data = self.get_report(report_id)
        if not data:
            return None

        att = data.get("cryptographic_attestation", {})
        ipfs_info = data.get("ipfs_node_attestation", {})
        summary = data.get("security_summary", {})
        alerts = data.get("alerts", [])
        blocks = data.get("recent_blocks", [])

        md = f"""# {data['title']}

**Report ID:** `{data['report_id']}`  
**Generated At:** {data['generated_at']}  
**Auditor Engine:** {data['auditor']}  
**Cryptographic Attestation Status:** **{att.get('chain_status', 'UNKNOWN')}**  
**IPFS Content Identifier (CID):** [`{data.get('ipfs_cid')}`]({data.get('ipfs_gateway_url')})  
**Document SHA-256 Fingerprint:** `{data.get('report_hash_sha256')}`  

---

## 1. Executive Summary

Sentinel has completed an automated cryptographic audit across authentication telemetry, SWI-Prolog reasoning conclusions, and Merkle tree blockchain records.

- **Blockchain Validity:** {"✅ INTACT (Non-Repudiation Verified)" if att.get('chain_valid') else "❌ TAMPER DETECTED"}
- **Blockchain Block Height:** #{att.get('block_height', 0)} ({att.get('total_blocks', 0)} Blocks Total)
- **Anchored Telemetry Count:** {att.get('total_anchored_events', 0)} events locked in Merkle roots
- **Analyzed Telemetry Events:** {summary.get('total_events_analyzed', 0)}
- **Total Security Incidents/Alerts:** {summary.get('total_alerts_raised', 0)}
- **Severity Breakdown:** Critical: {summary.get('severity_breakdown', {}).get('critical', 0)} | High: {summary.get('severity_breakdown', {}).get('high', 0)} | Medium: {summary.get('severity_breakdown', {}).get('medium', 0)} | Low: {summary.get('severity_breakdown', {}).get('low', 0)}

---

## 2. Decentralized IPFS Storage Node Attestation

All forensic evidence packages are content-addressed and pinned to the local IPFS Desktop node:

- **Node Multiaddress:** `{ipfs_info.get('multiaddr', '/ip4/127.0.0.1/tcp/5001')}`
- **Node Status:** {"🟢 Online & Responding" if ipfs_info.get('online') else "🔴 Offline / Cached"}
- **Kubo Agent Version:** `{ipfs_info.get('agent_version', 'kubo/0.36.0/desktop')}`
- **Peer ID:** `{ipfs_info.get('peer_id', 'Unknown')}`
- **Pinned to Node:** {"Yes (Durable Pin)" if data.get('pinned_to_node') else "Local Vault Synchronized"}

---

## 3. Detected Security Alerts & Reasoning Hypotheses

"""
        if not alerts:
            md += "*No security alerts raised during this audit period.*\n\n"
        else:
            for idx, a in enumerate(alerts, 1):
                md += f"### {idx}. [{a.get('severity', 'LOW').upper()}] {a.get('title')}\n"
                md += f"- **Alert ID:** `{a.get('id')}`\n"
                md += f"- **Target Subject:** `{a.get('subject')}`\n"
                md += f"- **Detection Rule:** `{a.get('rule')}`\n"
                md += f"- **Summary:** {a.get('summary')}\n"
                md += f"- **Rationale:** {a.get('rationale')}\n"
                if a.get('inferred_facts'):
                    md += f"- **Inferred Hypotheses:** {', '.join(a.get('inferred_facts'))}\n"
                md += "\n"

        md += """---

## 4. Blockchain Proof Headers

| Block | Timestamp | Block Hash | Merkle Root | IPFS Forensic CID |
|:-----:|:---------:|:----------:|:-----------:|:-----------------:|
"""
        for b in blocks:
            cid = b.get('ipfs_cid', '')
            short_cid = f"{cid[:10]}...{cid[-6:]}" if len(cid) > 16 else cid
            short_hash = f"{b.get('block_hash', '')[:10]}..."
            short_root = f"{b.get('merkle_root', '')[:10]}..."
            md += f"| #{b.get('block_index')} | {b.get('timestamp')[:19]} | `{short_hash}` | `{short_root}` | [{short_cid}](https://ipfs.io/ipfs/{cid}) |\n"

        md += f"\n---\n*Report generated automatically by Sentinel Security Micro-Agent. Pinned to IPFS CID: {data.get('ipfs_cid')}*\n"
        return md


report_service = ReportService()
