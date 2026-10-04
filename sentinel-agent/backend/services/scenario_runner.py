from __future__ import annotations

import datetime
import uuid
from typing import Any
from fastapi import HTTPException

from backend.services.investigation_service import run_pipeline

VALID_SCENARIOS = {
    "repeated_failures",
    "multiple_accounts",
    "successful_after_failures",
    "suspicious_context",
    "rate_limit_burst",
}


def run_scenario(scenario_id: str, target_user: str | None = None, source_ip: str | None = None) -> dict[str, Any]:
    if scenario_id not in VALID_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario ID '{scenario_id}'. Valid scenarios: {', '.join(sorted(VALID_SCENARIOS))}",
        )

    base_time = datetime.datetime.now(datetime.timezone.utc)
    events_generated = []

    if scenario_id == "repeated_failures":
        user = target_user or "alice"
        source = source_ip or "192.168.1.105"
        for i in range(1, 7):
            t = (base_time + datetime.timedelta(seconds=i * 2)).isoformat()
            ev = {
                "id": f"SIM-FAIL-{uuid.uuid4().hex[:6].upper()}",
                "type": "failed_login",
                "timestamp": t,
                "user": user,
                "source": source,
                "severity": "high" if i >= 5 else "low",
                "count": i,
                "detail": f"Simulated brute force attempt #{i} on account '{user}'",
            }
            events_generated.append(ev)

    elif scenario_id == "multiple_accounts":
        source = source_ip or "10.14.22.88"
        targets = ["alice", "bob", "j.singh", "svc-build", "admin"]
        for idx, u in enumerate(targets):
            t = (base_time + datetime.timedelta(seconds=idx * 3)).isoformat()
            ev = {
                "id": f"SIM-SPRAY-{uuid.uuid4().hex[:6].upper()}",
                "type": "failed_login",
                "timestamp": t,
                "user": u,
                "source": source,
                "severity": "high" if idx >= 2 else "low",
                "count": 1,
                "detail": f"Simulated credential spray from {source} probing username '{u}'",
            }
            events_generated.append(ev)

    elif scenario_id == "successful_after_failures":
        user = target_user or "alice"
        source = source_ip or "172.16.4.20"
        for i in range(1, 5):
            t = (base_time + datetime.timedelta(seconds=i * 2)).isoformat()
            ev = {
                "id": f"SIM-COMP-FAIL-{uuid.uuid4().hex[:6].upper()}",
                "type": "failed_login",
                "timestamp": t,
                "user": user,
                "source": source,
                "severity": "low",
                "count": i,
                "detail": f"Failed password attempt #{i} for account '{user}'",
            }
            events_generated.append(ev)
        # Followed by success
        t_succ = (base_time + datetime.timedelta(seconds=12)).isoformat()
        ev_succ = {
            "id": f"SIM-COMP-SUCC-{uuid.uuid4().hex[:6].upper()}",
            "type": "successful_login",
            "timestamp": t_succ,
            "user": user,
            "source": source,
            "severity": "critical",
            "context": "unusual_time",
            "detail": f"Simulated successful authentication for '{user}' at unusual hour following repeated failures",
        }
        events_generated.append(ev_succ)

    elif scenario_id == "suspicious_context":
        user = target_user or "j.singh"
        source = source_ip or "tor-exit-sim-99"
        t = base_time.isoformat()
        ev = {
            "id": f"SIM-CTX-{uuid.uuid4().hex[:6].upper()}",
            "type": "successful_login",
            "timestamp": t,
            "user": user,
            "source": source,
            "severity": "medium",
            "context": "unusual_time",
            "detail": f"Simulated sign-in for '{user}' originating from anomalous source ({source}) at off-hours",
        }
        events_generated.append(ev)

    elif scenario_id == "rate_limit_burst":
        source = source_ip or "203.0.113.42"
        # Burst of 12 requests
        for i in range(1, 13):
            t = (base_time + datetime.timedelta(milliseconds=i * 150)).isoformat()
            ev = {
                "id": f"SIM-BURST-{uuid.uuid4().hex[:6].upper()}",
                "type": "invalid_request",
                "timestamp": t,
                "user": f"target_{i % 3}",
                "source": source,
                "severity": "medium" if i >= 10 else "low",
                "detail": f"Simulated rapid-fire invalid request probe #{i} from {source}",
            }
            events_generated.append(ev)
        # Rate limit trigger event
        t_rl = (base_time + datetime.timedelta(seconds=2)).isoformat()
        ev_rl = {
            "id": f"SIM-RL-{uuid.uuid4().hex[:6].upper()}",
            "type": "rate_limit_event",
            "timestamp": t_rl,
            "user": "system",
            "source": source,
            "severity": "medium",
            "count": 12,
            "detail": f"Simulated rate-limit threshold reached: 12 requests in 2 seconds from {source}",
        }
        events_generated.append(ev_rl)

    # Ingest events sequentially through the pipeline
    latest_pipeline = None
    for ev in events_generated:
        latest_pipeline = run_pipeline(ev)

    return {
        "status": "ok",
        "scenario_id": scenario_id,
        "events_count": len(events_generated),
        "events": events_generated,
        "pipeline": latest_pipeline,
    }
