from __future__ import annotations

import datetime
from typing import Any
from backend.storage.db import get_db_connection


def persist_event(event: dict[str, Any]) -> dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    created_at = event.get("created_at") or now
    timestamp = event.get("timestamp") or now
    source = event.get("source") or "127.0.0.1"
    severity = event.get("severity") or "low"
    detection_status = event.get("detection_status") or "pending"
    count = event.get("count") if event.get("count") is not None else 1

    cursor.execute(
        """
        INSERT OR REPLACE INTO events 
        (id, type, timestamp, user, source, severity, detection_status, investigation_id, detail, count, context, resource, process, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event["id"],
            event["type"],
            timestamp,
            event["user"],
            source,
            severity,
            detection_status,
            event.get("investigation_id"),
            event.get("detail", ""),
            count,
            event.get("context"),
            event.get("resource"),
            event.get("process"),
            created_at,
        ),
    )
    conn.commit()
    conn.close()

    event["timestamp"] = timestamp
    event["source"] = source
    event["severity"] = severity
    event["detection_status"] = detection_status
    event["count"] = count
    return event


def get_events(
    limit: int = 50,
    offset: int = 0,
    severity: str | None = None,
    event_type: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM events WHERE 1=1"
    params: list[Any] = []

    if severity and severity.lower() != "all":
        query += " AND LOWER(severity) = LOWER(?)"
        params.append(severity)

    if event_type and event_type.lower() != "all":
        query += " AND type = ?"
        params.append(event_type)

    if search:
        search_like = f"%{search}%"
        query += " AND (id LIKE ? OR user LIKE ? OR source LIKE ? OR detail LIKE ?)"
        params.extend([search_like, search_like, search_like, search_like])

    # Count total
    count_query = f"SELECT COUNT(*) as total FROM ({query})"
    cursor.execute(count_query, params)
    total = cursor.fetchone()["total"]

    # Order newest first
    query += " ORDER BY timestamp DESC, created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    events = [dict(row) for row in rows]
    return {"total": total, "events": events, "limit": limit, "offset": offset}


def get_all_recent_events(limit: int = 150) -> list[dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM events ORDER BY timestamp ASC, created_at ASC LIMIT ?",
        (limit,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
