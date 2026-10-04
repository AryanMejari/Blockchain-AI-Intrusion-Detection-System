from __future__ import annotations

import datetime
import uuid
import logging
from typing import Any

from backend.storage.db import get_db_connection, verify_password
from backend.services.investigation_service import run_pipeline

logger = logging.getLogger("sentinel.auth")


def simulate_login(
    username: str,
    password: str,
    simulated_source: str = "192.168.1.100",
    simulated_context: str = "usual",
) -> dict[str, Any]:
    """
    Simulates user authentication against stored demo accounts.
    Never logs or exposes submitted passwords.
    Emits structured security telemetry to SQLite and triggers the Prolog reasoning engine.
    """
    clean_username = username.strip().lower()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    event_id = f"EVT-AUTH-{uuid.uuid4().hex[:8].upper()}"

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT password_hash, salt, display_name FROM demo_users WHERE username = ?", (clean_username,))
    user_row = cursor.fetchone()

    # Check recent failed logins for this user to track consecutive failures / lockout
    cursor.execute(
        """
        SELECT COUNT(*) as fail_count FROM events 
        WHERE user = ? AND type = 'failed_login' AND created_at >= datetime('now', '-15 minutes')
        """,
        (clean_username,),
    )
    fail_count_row = cursor.fetchone()
    recent_failures = fail_count_row["fail_count"] if fail_count_row else 0

    conn.close()

    # If already locked out (>= 6 recent failures)
    if recent_failures >= 6:
        lockout_event = {
            "id": event_id,
            "type": "account_lockout",
            "timestamp": now,
            "user": clean_username,
            "source": simulated_source,
            "severity": "high",
            "detail": f"Account {clean_username} locked out due to exceeding maximum failed attempts ({recent_failures})",
            "count": recent_failures,
        }
        pipeline_result = run_pipeline(lockout_event)
        return {
            "status": "lockout",
            "message": "Account temporarily locked due to repeated authentication failures.",
            "event": lockout_event,
            "pipeline": pipeline_result,
        }

    authenticated = False
    if user_row:
        pw_hash = user_row["password_hash"]
        salt = user_row["salt"]
        authenticated = verify_password(password, pw_hash, salt)

    if authenticated:
        # Determine if this was preceded by multiple failures
        event_type = "successful_login"
        detail = f"Successful sign-in for {clean_username} ({simulated_context} context)"
        if recent_failures >= 3:
            detail = f"Successful sign-in for {clean_username} following {recent_failures} prior failures"

        event = {
            "id": event_id,
            "type": event_type,
            "timestamp": now,
            "user": clean_username,
            "source": simulated_source,
            "severity": "high" if recent_failures >= 3 or simulated_context == "unusual_time" else "low",
            "context": simulated_context,
            "detail": detail,
        }
        pipeline_result = run_pipeline(event)
        return {
            "status": "success",
            "message": f"Welcome back, {user_row['display_name']}!",
            "event": event,
            "pipeline": pipeline_result,
        }
    else:
        # Failed authentication
        new_fail_count = recent_failures + 1
        severity = "high" if new_fail_count >= 5 else "low"
        event = {
            "id": event_id,
            "type": "failed_login",
            "timestamp": now,
            "user": clean_username or "unknown",
            "source": simulated_source,
            "severity": severity,
            "count": new_fail_count,
            "detail": f"Failed password validation for account '{clean_username or 'unknown'}' from {simulated_source}",
        }
        pipeline_result = run_pipeline(event)
        return {
            "status": "failure",
            "message": "Invalid username or password.",
            "event": event,
            "pipeline": pipeline_result,
        }
