# Sentinel — AI-Powered Cybersecurity Reasoning Platform

Sentinel is an educational, full-stack, autonomous cybersecurity reasoning platform powered by **SWI-Prolog** and **FastAPI**. It correlates synthetic security telemetry, derives explainable hypotheses using symbolic rules, raises alerts, explains its deductions with evidence, and recommends read-only investigation steps on a modern SOC dashboard.

> **Scope & Safety:** Educational simulation only. Operates entirely with synthetic identities, simulated network sources, and local database storage. Sentinel does not interact with external systems, SIEMs, or identity providers, and does not execute consequential system actions.

---

## Architecture Overview

```text
┌─────────────────────────────────┐           ┌──────────────────────────────────────┐
│  Monitored Target App (/login)   │           │      SOC Dashboard (/dashboard)      │
│  Sentinel Labs Auth & Attack Lab│           │ Live Telemetry, Alerts, Inspector    │
└────────────────┬────────────────┘           └──────────────────▲───────────────────┘
                 │ REST (/api/auth, /api/lab)                    │ WebSocket & REST
                 ▼                                               │ (/ws/dashboard)
┌────────────────────────────────────────────────────────────────┴───────────────────┐
│                           FastAPI Backend Pipeline                                 │
│          Input Validation · Auth Simulator (PBKDF2) · Event Ingestion              │
│                       SQLite Persistence (sentinel.db)                             │
└────────────────────────────────────────┬───────────────────────────────────────────┘
                                         │ JSON stdin / stdout
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                       SWI-Prolog Reasoning Engine (sentinel.pl)                    │
│   Event Facts → Correlation Rules → Detection Rules → Risk Scoring → Investigation │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **Backend:** Python 3.11+, FastAPI, Uvicorn, SQLite (`sentinel.db`).
- **Reasoning Core:** SWI-Prolog (`sentinel.pl` and modular rules in `engine/rules/`).
- **Communication:** REST APIs + Live bidirectional WebSockets (`/ws/dashboard`).

---

## Key Capabilities

1. **Monitored Login Interface (`/login`):**
   - Realistic "Sentinel Labs" authentication portal.
   - Demo credentials securely hashed with salted PBKDF2 (SHA-256). Passwords are never logged or echoed in telemetry.
   - Interactive **Demo Attack Lab** panel supporting 5 safe simulations:
     1. *Repeated Failures* (Brute Force threshold)
     2. *Credential Spray* (Multiple accounts probed from single source)
     3. *Compromise Sequence* (Repeated failures followed by off-hour sign-in)
     4. *Suspicious Context* (Unusual hour / anomalous simulated network source)
     5. *Rate-Limit Burst* (High request density burst)
   - Live telemetry event counter and activity log.

2. **Security Operations Center Dashboard (`/dashboard`):**
   - **Overview Metrics:** Total telemetry, failed logins, active alerts, severity split, flagged users, and active investigation plans.
   - **Live Telemetry Stream:** Chronological event feed with search, severity filter, type filter, and pause/resume stream buffer.
   - **Alert Center:** Symbolic incident cards with severity, risk scores, targets, supporting evidence IDs, detection rules, and analyst status management (`new`, `investigating`, `resolved`, `false_positive`).
   - **AI Reasoning Inspector:** Clear breakdown of:
     - *Observed Ground Facts* (Raw telemetry)
     - *Logical Inferences* (Prolog deductions)
     - *Missing Corroborating Evidence* (Requirements to confirm incident)
     - *Plausible Benign Alternatives* (False positive hypotheses)
   - **Attack Progression Timeline:** Chronological visual progression of attack steps.
   - **Entity Relationship Graph:** Interactive SVG entity graph linking identities, source IPs, raw events, and alerts.

---

## Demo Accounts

Pre-seeded in SQLite database with secure PBKDF2 hashing:

| Username | Password | Role | Description |
|---|---|---|---|
| `alice` | `Sentinel@2026!` | Security Analyst | Primary demo account |
| `bob` | `Password123!` | Engineering | Standard corporate user |
| `j.singh` | `Finance#2026` | Financial Operations | Sensitive resource user |
| `svc-build` | `BuildMachine99$` | CI/CD Service Account | Automation service |
| `admin` | `AdminMaster2026!` | Platform Ops | Administrative account |

---

## Installation & Startup (Windows PowerShell)

### Prerequisites
1. **Python 3.11+** installed.
2. **SWI-Prolog 9.x+** installed and available on `PATH` (verify via `swipl --version`).
3. **Node.js 18+ and npm** installed.

### 1. Setup Backend Environment

Open PowerShell in the project directory:

```powershell
cd path\to\sentinel-agent\sentinel-agent

# Create and activate virtual environment
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1

# Upgrade pip and install requirements
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

### 2. Build Frontend (React + Vite + Tailwind CSS)

```powershell
cd frontend
npm install
npm run build
cd ..
```

*Note: The built single-page application is automatically served by FastAPI.*

### 3. Launch the Application

```powershell
# Run from sentinel-agent root:
uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

Open your browser:
- **Login Screen:** [http://127.0.0.1:8000/login](http://127.0.0.1:8000/login)
- **SOC Dashboard:** [http://127.0.0.1:8000/dashboard](http://127.0.0.1:8000/dashboard)
- **Interactive Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

*Optional: If running Vite in dev mode with hot module replacement, run `npm run dev` inside `frontend/` (runs on `http://localhost:5173`).*

---

## Running Tests

Run the complete test suite (21 unit and end-to-end integration tests):

```powershell
.\backend\.venv\Scripts\python -m unittest discover -s tests -v
```

### Prolog Smoke Test

Test the SWI-Prolog engine directly via stdin:

```powershell
'{"events":[{"id":"E1","type":"failed_login","user":"alice","count":8,"timestamp":"2026-10-04T01:00:00Z","detail":"Repeated failures"},{"id":"E2","type":"successful_login","user":"alice","context":"unusual_time","timestamp":"2026-10-04T01:03:00Z","detail":"Odd-hour login"}]}' | swipl -q -s .\engine\sentinel.pl
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health status and engine availability |
| `POST` | `/api/auth/login` | Authenticate credentials & emit telemetry |
| `POST` | `/api/lab/scenarios/{id}/run` | Execute controlled demo attack scenario |
| `GET` | `/api/events` | List events with pagination and filters |
| `GET` | `/api/alerts` | List all rule-derived security alerts |
| `GET` | `/api/alerts/{id}` | Retrieve specific alert details |
| `POST` | `/api/alerts/{id}/status` | Update alert triage status |
| `GET` | `/api/metrics` | Retrieve SOC overview metrics |
| `GET` | `/api/investigations/{id}` | Retrieve investigation graph and timeline |
| `GET` | `/api/investigations/{id}/explanation` | Retrieve AI reasoning deduction trace |
| `WS` | `/ws/dashboard` | WebSocket stream for live incident updates |

---

## Project Structure

```text
sentinel-agent/
├── backend/
│   ├── api/
│   │   └── websocket_manager.py
│   ├── models/
│   │   └── schemas.py
│   ├── services/
│   │   ├── auth_simulator.py
│   │   ├── event_service.py
│   │   ├── investigation_service.py
│   │   ├── prolog_bridge.py
│   │   └── scenario_runner.py
│   ├── storage/
│   │   ├── db.py
│   │   └── sentinel.db
│   ├── app.py
│   └── requirements.txt
├── engine/
│   ├── rules/
│   │   ├── correlation.pl
│   │   ├── detection.pl
│   │   ├── explanations.pl
│   │   ├── planning.pl
│   │   └── risk.pl
│   └── sentinel.pl
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AlertCenter.tsx
│   │   │   ├── AttackTimeline.tsx
│   │   │   ├── EventStream.tsx
│   │   │   ├── ReasoningInspector.tsx
│   │   │   └── RelationshipGraph.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── tests/
│   ├── test_api.py
│   └── test_sentinel_full.py
└── README.md
```

---

## Troubleshooting

- **`swipl: The term 'swipl' is not recognized`**: Ensure SWI-Prolog is installed and its `bin` directory (typically `C:\Program Files\swipl\bin`) is added to the Windows environment `PATH`. Alternatively, set `$env:SWIPL_BIN = "C:\Program Files\swipl\bin\swipl.exe"`.
- **Frontend changes not reflecting**: Re-run `npm run build` in the `frontend` folder to update the production bundle in `dist/`.
- **Port 8000 already in use**: Start Uvicorn on another port with `--port 8080`.
