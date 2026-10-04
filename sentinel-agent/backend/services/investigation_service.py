from __future__ import annotations

import datetime
import json
import logging
from typing import Any

from backend.api.websocket_manager import ws_manager
from backend.services.event_service import get_all_recent_events, persist_event
from backend.services.prolog_bridge import run_prolog
from backend.storage.db import get_db_connection

logger = logging.getLogger("sentinel.investigation")


def run_pipeline(new_event: dict[str, Any] | None = None) -> dict[str, Any]:
    """Ingest optional new event, persist it, execute Prolog reasoning, update alerts, and broadcast to clients."""
    persisted_new = None
    if new_event:
        persisted_new = persist_event(new_event)

    all_events = get_all_recent_events(limit=200)

    # Format events payload for Prolog
    payload_events = []
    for ev in all_events:
        item = {
            "id": ev["id"],
            "type": ev["type"],
            "timestamp": ev["timestamp"],
            "user": ev["user"],
            "source": ev.get("source") or "127.0.0.1",
            "detail": ev.get("detail") or "",
        }
        if ev.get("count") is not None:
            item["count"] = ev["count"]
        if ev.get("context"):
            item["context"] = ev["context"]
        if ev.get("resource"):
            item["resource"] = ev["resource"]
        if ev.get("process"):
            item["process"] = ev["process"]
        payload_events.append(item)

    engine_status = "ok"
    engine_error = None
    prolog_result = {}

    try:
        prolog_result = run_prolog({"events": payload_events})
    except Exception as exc:
        logger.warning("Prolog reasoning engine unavailable or failed: %s", exc)
        engine_status = "degraded"
        engine_error = str(getattr(exc, "detail", exc))
        prolog_result = {
            "status": "degraded",
            "alerts": [],
            "hypotheses": [],
            "next_actions": [
                {
                    "id": "engine_offline_check",
                    "priority": 1,
                    "target": "system",
                    "title": "Reasoning Engine Inactive",
                    "reason": "SWI-Prolog reasoning engine is temporarily offline or failed. Events stored safely.",
                    "mode": "read_only_simulation",
                }
            ],
        }

    # Upsert alerts in SQLite
    alerts_from_engine = prolog_result.get("alerts", [])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()

    for alert in alerts_from_engine:
        alert_id = alert["id"]
        cursor.execute("SELECT status, created_at FROM alerts WHERE id = ?", (alert_id,))
        existing = cursor.fetchone()
        status = existing["status"] if existing else "new"
        created_at = existing["created_at"] if existing else now

        cursor.execute(
            """
            INSERT OR REPLACE INTO alerts
            (id, severity, risk_score, title, subject, confidence, summary, evidence_ids, evidence_count,
             rationale, rule, status, observed_facts, inferred_facts, missing_evidence, alternative_explanations,
             recommended_action, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert_id,
                alert.get("severity", "medium"),
                alert.get("risk_score", 50),
                alert.get("title", alert.get("type", "Security Alert")),
                alert.get("subject", "unknown"),
                alert.get("confidence", "medium"),
                alert.get("summary", ""),
                json.dumps(alert.get("evidence", [])),
                alert.get("evidence_count", len(alert.get("evidence", []))),
                json.dumps(alert.get("rationale", [])),
                alert.get("rule", "detection_rule"),
                status,
                json.dumps(alert.get("observed_facts", [])),
                json.dumps(alert.get("inferred_facts", [])),
                json.dumps(alert.get("missing_evidence", [])),
                json.dumps(alert.get("alternative_explanations", [])),
                json.dumps(alert.get("recommended_action", {})),
                created_at,
                now,
            ),
        )

        # Update detection_status on supporting events
        for eid in alert.get("evidence", []):
            cursor.execute(
                "UPDATE events SET detection_status = 'flagged', severity = ?, investigation_id = ? WHERE id = ?",
                (alert.get("severity", "high"), alert_id, eid),
            )

    conn.commit()
    conn.close()

    metrics = calculate_metrics()

    # Generate graph & timeline for active investigation
    investigation_data = generate_investigation_view(all_events, alerts_from_engine)

    result = {
        "status": engine_status,
        "error": engine_error,
        "new_event": persisted_new,
        "alerts": get_all_alerts(),
        "next_actions": prolog_result.get("next_actions", []),
        "metrics": metrics,
        "investigation": investigation_data,
    }

    return result


def get_all_alerts() -> list[dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()

    alerts = []
    for r in rows:
        d = dict(r)
        d["evidence_ids"] = json.loads(d["evidence_ids"])
        d["rationale"] = json.loads(d["rationale"])
        d["observed_facts"] = json.loads(d["observed_facts"])
        d["inferred_facts"] = json.loads(d["inferred_facts"])
        d["missing_evidence"] = json.loads(d["missing_evidence"])
        d["alternative_explanations"] = json.loads(d["alternative_explanations"])
        d["recommended_action"] = json.loads(d["recommended_action"])
        alerts.append(d)
    return alerts


def get_alert_by_id(alert_id: str) -> dict[str, Any] | None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["evidence_ids"] = json.loads(d["evidence_ids"])
    d["rationale"] = json.loads(d["rationale"])
    d["observed_facts"] = json.loads(d["observed_facts"])
    d["inferred_facts"] = json.loads(d["inferred_facts"])
    d["missing_evidence"] = json.loads(d["missing_evidence"])
    d["alternative_explanations"] = json.loads(d["alternative_explanations"])
    d["recommended_action"] = json.loads(d["recommended_action"])
    return d


def update_alert_status(alert_id: str, new_status: str) -> dict[str, Any] | None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute(
        "UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?",
        (new_status, now, alert_id),
    )
    conn.commit()
    conn.close()
    return get_alert_by_id(alert_id)


def calculate_metrics() -> dict[str, int]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM events")
    total_events = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM events WHERE type = 'failed_login'")
    failed_logins = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE status != 'resolved'")
    active_alerts = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE severity = 'critical' AND status != 'resolved'")
    critical = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE severity = 'high' AND status != 'resolved'")
    high = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE severity = 'medium' AND status != 'resolved'")
    medium = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE severity = 'low' AND status != 'resolved'")
    low = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(DISTINCT user) as count FROM events WHERE detection_status = 'flagged'")
    suspicious_accounts = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE status IN ('new', 'investigating')")
    investigations_in_progress = cursor.fetchone()["count"]

    conn.close()
    return {
        "total_events": total_events,
        "failed_logins": failed_logins,
        "active_alerts": active_alerts,
        "critical_alerts": critical,
        "high_alerts": high,
        "medium_alerts": medium,
        "low_alerts": low,
        "suspicious_accounts": suspicious_accounts,
        "investigations_in_progress": investigations_in_progress,
    }


def generate_investigation_view(events: list[dict[str, Any]], alerts: list[dict[str, Any]]) -> dict[str, Any]:
    """Generates structured timeline and relationship graph from actual facts."""
    timeline = []
    nodes = []
    edges = []
    node_set: set[str] = set()

    def add_node(nid: str, label: str, ntype: str, severity: str = "low") -> None:
        if nid not in node_set:
            node_set.add(nid)
            nodes.append({"id": nid, "label": label, "type": ntype, "severity": severity})

    def add_edge(src: str, tgt: str, rel: str) -> None:
        edges.append({"source": src, "target": tgt, "label": rel})

    # Add alert nodes
    for a in alerts:
        anode_id = f"alert_{a['id']}"
        add_node(anode_id, a.get("title", a.get("type")), "alert", a.get("severity", "high"))
        subj = a.get("subject", "unknown")
        subj_node = f"subj_{subj}"
        add_node(subj_node, subj, "subject", a.get("severity", "medium"))
        add_edge(anode_id, subj_node, "targets/involves")

        for eid in a.get("evidence", []):
            enode = f"event_{eid}"
            add_node(enode, eid, "evidence", a.get("severity", "medium"))
            add_edge(anode_id, enode, "supported_by")

    # Add event nodes and chronological timeline
    for ev in events:
        eid = ev["id"]
        enode = f"event_{eid}"
        add_node(enode, f"{ev['type']} ({eid})", "event", ev.get("severity", "low"))

        u = ev.get("user")
        if u:
            unode = f"subj_{u}"
            add_node(unode, u, "user")
            add_edge(enode, unode, "acted_by")

        src = ev.get("source")
        if src and src != "unknown" and src != "127.0.0.1":
            snode = f"source_{src}"
            add_node(snode, src, "source")
            add_edge(enode, snode, "originated_from")

        timeline.append(
            {
                "id": eid,
                "timestamp": ev["timestamp"],
                "type": ev["type"],
                "user": ev.get("user"),
                "source": ev.get("source"),
                "detail": ev.get("detail"),
                "severity": ev.get("severity", "low"),
                "detection_status": ev.get("detection_status", "pending"),
            }
        )

    # Sort timeline chronologically
    timeline.sort(key=lambda x: str(x.get("timestamp", "")))

    return {
        "timeline": timeline,
        "graph": {"nodes": nodes, "edges": edges},
    }
