from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

# Ensure project root is on sys.path for both uvicorn backend.app:app and uvicorn app:app
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.api.websocket_manager import ws_manager
from backend.models.schemas import (
    AlertStatusUpdate,
    AnalyzeRequest,
    LoginRequest,
    MetricsResponse,
    ScenarioRunRequest,
    SecurityEvent,
)
from backend.services.auth_simulator import simulate_login
from backend.services.event_service import get_events, persist_event
from backend.services.investigation_service import (
    calculate_metrics,
    get_alert_by_id,
    get_all_alerts,
    run_pipeline,
    update_alert_status,
)
from backend.services.prolog_bridge import check_prolog_available, run_prolog
from backend.services.scenario_runner import run_scenario
from backend.services.blockchain_ledger import blockchain_ledger
from backend.services.ipfs_storage import ipfs_service
from backend.services.report_service import report_service
from backend.storage.db import get_db_connection

ROOT = PROJECT_ROOT
FRONTEND_DIST = ROOT / "frontend" / "dist"
FRONTEND_LEGACY = ROOT / "frontend"

app = FastAPI(
    title="Sentinel",
    version="2.0.0",
    description="Explainable Prolog Security Reasoning Agent & Operations Console",
)

# CORS restricted for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_frontend_file(filename: str = "index.html") -> Path | None:
    if FRONTEND_DIST.exists() and (FRONTEND_DIST / filename).exists():
        return FRONTEND_DIST / filename
    if FRONTEND_LEGACY.exists() and (FRONTEND_LEGACY / filename).exists():
        return FRONTEND_LEGACY / filename
    return None


# Serve static assets
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")
if FRONTEND_LEGACY.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_LEGACY), name="static")


@app.get("/", include_in_schema=False)
def index() -> Any:
    dist_index = get_frontend_file("index.html")
    if dist_index and FRONTEND_DIST.exists():
        return FileResponse(dist_index)
    return RedirectResponse(url="/login")


@app.get("/login", include_in_schema=False)
def login_page() -> FileResponse:
    file = get_frontend_file("index.html")
    if file:
        return FileResponse(file)
    raise HTTPException(status_code=404, detail="Frontend not built yet. Run npm run build.")


@app.get("/dashboard", include_in_schema=False)
def dashboard_page() -> FileResponse:
    file = get_frontend_file("index.html")
    if file:
        return FileResponse(file)
    raise HTTPException(status_code=404, detail="Frontend not built yet. Run npm run build.")


# Health & Engine Status
@app.get("/api/health")
def health() -> dict[str, Any]:
    prolog_ok = check_prolog_available()
    return {
        "status": "ok" if prolog_ok else "degraded",
        "engine": "SWI-Prolog",
        "mode": "simulation_only",
        "prolog_available": prolog_ok,
        "database": "sqlite_ready",
    }


# System Reset Endpoint (Clean State)
@app.post("/api/system/reset")
async def reset_system() -> dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events")
    cursor.execute("DELETE FROM alerts")
    cursor.execute("DELETE FROM investigations")
    conn.commit()
    conn.close()

    blockchain_ledger.reset_ledger()

    empty_metrics = {
        "total_events": 0,
        "failed_logins": 0,
        "active_alerts": 0,
        "critical_alerts": 0,
        "high_alerts": 0,
        "medium_alerts": 0,
        "low_alerts": 0,
        "suspicious_accounts": 0,
        "investigations_in_progress": 0,
    }

    await ws_manager.broadcast({
        "type": "STATE_RESET",
        "metrics": empty_metrics,
        "alerts": [],
        "alerts_count": 0,
        "ledger": blockchain_ledger.get_status(),
    })

    return {"status": "ok", "message": "Telemetry, security alerts, and ledger reset to genesis state.", "metrics": empty_metrics}


# Monitored Login Screen Auth Simulator
@app.post("/api/auth/login")
async def auth_login(req: LoginRequest) -> dict[str, Any]:
    res = simulate_login(
        username=req.username,
        password=req.password,
        simulated_source=req.simulated_source,
        simulated_context=req.simulated_context,
    )
    alerts = res.get("pipeline", {}).get("alerts", [])
    latest_alert = alerts[0] if alerts else None

    # Cryptographically anchor into Blockchain & IPFS
    new_block = None
    if res.get("event"):
        new_block = blockchain_ledger.anchor_events([res["event"]], alerts)

    # Broadcast live update
    await ws_manager.broadcast({
        "type": "STATE_UPDATED",
        "event": res.get("event"),
        "metrics": res.get("pipeline", {}).get("metrics"),
        "alerts_count": len(alerts),
        "alerts": alerts,
        "latest_alert": latest_alert,
        "latest_block": new_block.to_dict() if new_block else None,
        "ledger_status": blockchain_ledger.get_status(),
    })
    return res


# Demo Attack Lab Scenarios
@app.post("/api/lab/scenarios/{scenario_id}/run")
async def run_lab_scenario(scenario_id: str, req: ScenarioRunRequest | None = None) -> dict[str, Any]:
    target = req.target_user if req else None
    source = req.source_ip if req else None
    res = run_scenario(scenario_id=scenario_id, target_user=target, source_ip=source)
    alerts = res.get("pipeline", {}).get("alerts", [])
    latest_alert = alerts[0] if alerts else None

    # Cryptographically anchor batch of attack events
    new_block = None
    if res.get("events"):
        new_block = blockchain_ledger.anchor_events(res["events"], alerts)

    await ws_manager.broadcast({
        "type": "SCENARIO_EXECUTED",
        "scenario_id": scenario_id,
        "events_count": res["events_count"],
        "metrics": res.get("pipeline", {}).get("metrics"),
        "alerts_count": len(alerts),
        "alerts": alerts,
        "latest_alert": latest_alert,
        "latest_block": new_block.to_dict() if new_block else None,
        "ledger_status": blockchain_ledger.get_status(),
    })
    return res


# Telemetry Event Ingestion & Query
@app.get("/api/events")
def list_events(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    severity: str | None = None,
    type: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    return get_events(limit=limit, offset=offset, severity=severity, event_type=type, search=search)


@app.post("/api/events")
async def ingest_event(event: SecurityEvent) -> dict[str, Any]:
    ev_dict = event.model_dump()
    result = run_pipeline(ev_dict)
    alerts = result.get("alerts", [])
    latest_alert = alerts[0] if alerts else None

    new_block = None
    if result.get("new_event"):
        new_block = blockchain_ledger.anchor_events([result["new_event"]], alerts)

    await ws_manager.broadcast({
        "type": "EVENT_INGESTED",
        "event": result["new_event"],
        "metrics": result["metrics"],
        "alerts_count": len(alerts),
        "alerts": alerts,
        "latest_alert": latest_alert,
        "latest_block": new_block.to_dict() if new_block else None,
        "ledger_status": blockchain_ledger.get_status(),
    })
    return result


# =========================================================
# BLOCKCHAIN & IPFS AUDIT LEDGER ENDPOINTS
# =========================================================

@app.get("/api/ledger/status")
def get_ledger_status() -> dict[str, Any]:
    return blockchain_ledger.get_status()


@app.get("/api/ledger/network")
def get_ledger_network() -> dict[str, Any]:
    return blockchain_ledger.get_network_status()


@app.get("/api/ledger/blocks")
def get_ledger_blocks(limit: int = Query(default=50, ge=1, le=200)) -> list[dict[str, Any]]:
    return blockchain_ledger.get_blocks(limit=limit)


@app.get("/api/ipfs/node-status")
def get_ipfs_node_status() -> dict[str, Any]:
    return ipfs_service.get_node_status()


@app.get("/api/ipfs/{cid}")
def get_ipfs_bundle(cid: str) -> dict[str, Any]:
    bundle = ipfs_service.get_bundle(cid)
    if not bundle:
        raise HTTPException(status_code=404, detail=f"IPFS bundle '{cid}' not found in vault")
    return bundle


@app.post("/api/ledger/verify")
def verify_ledger() -> dict[str, Any]:
    return blockchain_ledger.verify_chain_integrity()


@app.post("/api/ledger/simulate-tamper")
async def simulate_tamper(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    eid = payload.get("event_id") if payload else None
    detail = payload.get("detail") if payload else None
    res = blockchain_ledger.simulate_db_tamper(event_id=eid, altered_detail=detail)
    await ws_manager.broadcast({
        "type": "TAMPER_SIMULATED",
        "result": res,
        "verification": blockchain_ledger.verify_chain_integrity(),
    })
    return res


@app.post("/api/ledger/restore-tamper")
async def restore_tamper(payload: dict[str, Any]) -> dict[str, Any]:
    eid = payload.get("event_id")
    if not eid:
        raise HTTPException(status_code=400, detail="Missing required field 'event_id'")
    res = blockchain_ledger.restore_db_tamper(event_id=eid)
    await ws_manager.broadcast({
        "type": "TAMPER_RESTORED",
        "result": res,
        "verification": blockchain_ledger.verify_chain_integrity(),
    })
    return res


# =========================================================
# FORENSIC AUDIT REPORT ENDPOINTS
# =========================================================

@app.post("/api/reports/generate")
async def generate_report(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    title = payload.get("title") if payload else None
    report = report_service.generate_audit_report(title=title)
    await ws_manager.broadcast({
        "type": "REPORT_GENERATED",
        "report_id": report["report_id"],
        "ipfs_cid": report["ipfs_cid"],
        "status": report.get("cryptographic_attestation", {}).get("chain_status"),
    })
    return report


@app.get("/api/reports")
def list_reports() -> list[dict[str, Any]]:
    return report_service.list_reports()


@app.get("/api/reports/{report_id}")
def get_report(report_id: str) -> dict[str, Any]:
    rep = report_service.get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    return rep


@app.get("/api/reports/{report_id}/markdown")
def get_report_markdown(report_id: str) -> dict[str, Any]:
    md = report_service.generate_markdown(report_id)
    if not md:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")
    return {"report_id": report_id, "markdown": md}


# Alerts Center
@app.get("/api/alerts")
def list_alerts() -> list[dict[str, Any]]:
    return get_all_alerts()


@app.get("/api/alerts/{alert_id}")
def get_alert(alert_id: str) -> dict[str, Any]:
    alert = get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return alert


@app.post("/api/alerts/{alert_id}/status")
async def set_alert_status(alert_id: str, req: AlertStatusUpdate) -> dict[str, Any]:
    updated = update_alert_status(alert_id, req.status)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    metrics = calculate_metrics()
    await ws_manager.broadcast({
        "type": "ALERT_STATUS_UPDATED",
        "alert": updated,
        "metrics": metrics,
    })
    return updated


# Metrics Overview
@app.get("/api/metrics", response_model=MetricsResponse)
def get_metrics_endpoint() -> dict[str, int]:
    return calculate_metrics()


# Investigations, Graph & Explanations
@app.get("/api/investigations/{investigation_id}")
def get_investigation_endpoint(investigation_id: str) -> dict[str, Any]:
    pipeline = run_pipeline(None)
    return {
        "investigation_id": investigation_id,
        "status": "active",
        "data": pipeline.get("investigation", {}),
    }


@app.get("/api/investigations/{investigation_id}/explanation")
def get_investigation_explanation(investigation_id: str) -> dict[str, Any]:
    alert = get_alert_by_id(investigation_id)
    if not alert:
        # Fallback to scanning active alerts
        alerts = get_all_alerts()
        if alerts:
            alert = alerts[0]
    if not alert:
        raise HTTPException(status_code=404, detail="No active investigation found for explanation")
    return {
        "investigation_id": investigation_id,
        "observed_facts": alert.get("observed_facts", []),
        "inferred_facts": alert.get("inferred_facts", []),
        "rules_fired": [alert.get("rule", "rule")],
        "supporting_evidence": alert.get("evidence_ids", []),
        "missing_evidence": alert.get("missing_evidence", []),
        "alternative_explanations": alert.get("alternative_explanations", []),
        "confidence": alert.get("confidence", "medium"),
        "risk_classification": alert.get("severity", "medium"),
        "recommended_checks": [alert.get("recommended_action", {})],
    }


# Live WebSocket Endpoint
@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        # On connection, send initial state snapshot
        metrics = calculate_metrics()
        alerts = get_all_alerts()
        await websocket.send_json({
            "type": "INITIAL_SNAPSHOT",
            "metrics": metrics,
            "alerts": alerts,
        })
        while True:
            # Keep alive and handle client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# Backward Compatibility Endpoints for Existing Tests & Demo
def demo_dataset() -> list[dict[str, Any]]:
    return [
        {
            "id": "EVT-1001",
            "type": "failed_login",
            "timestamp": "2026-10-04T09:12:04Z",
            "user": "j.singh",
            "detail": "12 failed logins from one source in 3 minutes",
            "count": 12,
            "source": "192.168.1.100",
        },
        {
            "id": "EVT-1002",
            "type": "successful_login",
            "timestamp": "2026-10-04T09:14:19Z",
            "user": "j.singh",
            "detail": "Successful sign-in at an unusual local hour",
            "context": "unusual_time",
            "source": "192.168.1.100",
        },
        {
            "id": "EVT-1003",
            "type": "sensitive_access",
            "timestamp": "2026-10-04T09:17:31Z",
            "user": "j.singh",
            "detail": "Read access to finance-export.csv",
            "resource": "finance-export.csv",
            "source": "192.168.1.100",
        },
        {
            "id": "EVT-1004",
            "type": "privilege_change",
            "timestamp": "2026-10-04T09:20:02Z",
            "user": "svc-build",
            "detail": "Account added to elevated group",
            "source": "10.0.0.12",
        },
        {
            "id": "EVT-1005",
            "type": "unusual_process",
            "timestamp": "2026-10-04T09:21:43Z",
            "user": "svc-build",
            "detail": "Unusual process observed after privilege change",
            "process": "unknown-helper.exe",
            "source": "10.0.0.12",
        },
    ]


@app.get("/api/demo-events")
def demo_events() -> dict[str, list[dict[str, Any]]]:
    return {"events": demo_dataset()}


def normalize_event(event: SecurityEvent) -> dict[str, Any]:
    return event.model_dump(exclude_none=True)


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    payload = {"events": [normalize_event(event) for event in request.events]}
    result = run_prolog(payload)
    result["events"] = [event.model_dump() for event in request.events]
    return result
