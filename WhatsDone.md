# Sentinel — AI-Powered Cybersecurity Monitoring Platform
## Implementation Specification for Coding Agent

### 1. Project Objective

MODIFY **Sentinel**, a full-stack, interactive cybersecurity micro-project powered by SWI-Prolog. The application must have two distinct screens:

1. **Login Screen:** A realistic authentication interface that acts as the monitored target. A user or authorized demo attacker can perform simulated attacks against it.
2. **Security Dashboard:** A SOC-style interface where Sentinel analyzes authentication events, detects suspicious behavior using Prolog rules, raises warnings, explains its conclusions, and recommends investigation steps.

The core demonstration must be visually compelling and technically functional. When suspicious activity occurs on the login screen, the dashboard must receive the corresponding events and update its alerts and investigation timeline in near real time.

This is a controlled educational simulation. Do not target real websites, external accounts, or third-party systems.

### 2. Required Architecture

Use the following architecture unless the existing repository requires compatible adjustments:

- **Frontend:** React, TypeScript, Vite, Tailwind CSS.
- **Backend:** Python, FastAPI.
- **AI reasoning engine:** SWI-Prolog.
- **Frontend/backend communication:** REST API and WebSocket for live dashboard updates.
- **Event storage:** SQLite for persistent event and investigation history.
- **Validation:** Pydantic request models and strict input validation.

Architecture:

Browser Login Screen → FastAPI Authentication Simulator → Security Event Pipeline → SWI-Prolog Reasoning Engine → Alert and Evidence Store → WebSocket → Dashboard.

The login screen and dashboard must be separate routes:

- `/login` — monitored login interface.
- `/dashboard` — Sentinel security operations dashboard.

Also implement `/` as a redirect to `/login` or a simple landing page.

### 3. Screen One: Monitored Login Interface

Design a polished, realistic login screen suitable for a fictional product named **Sentinel Labs**.

Visual requirements:

- Dark navy or charcoal background.
- Clean authentication card with email/username and password fields.
- Show/hide password control.
- Remember-me checkbox and password recovery link.
- Primary Sign In button.
- Loading, success, failure, and validation states.
- Responsive layout for desktop and mobile.
- Subtle security-themed graphics and restrained animations.
- Small footer indicating that this is an authorized security simulation.

Implement a backend authentication simulator with fictional demo users. Use securely hashed passwords for stored demo credentials and never log submitted passwords.

The backend must emit structured security events for relevant outcomes, including:

- Successful authentication.
- Failed authentication.
- Repeated failures for the same account or source.
- Invalid or malformed request attempts.
- Simulated unusual login time.
- Simulated suspicious source reputation.
- Simulated account lockout.
- Simulated successful login following repeated failures.

Do not expose raw passwords, session secrets, access tokens, or sensitive authentication data in event payloads.

#### Attack Simulation Panel

Provide an optional, clearly labelled **Demo Attack Lab** on the login screen.

It must support safe, controlled demonstrations:

1. Repeated failed login attempts.
2. Multiple usernames attempted from one simulated source.
3. Successful login following several failures.
4. A suspicious login context.
5. A burst of requests that triggers a rate-limit warning.

The controls must generate events through the local backend and use synthetic identities and source addresses. They must not perform network attacks, enumerate real accounts, bypass authentication, or contact external systems.

Display an event counter and a short activity log so the user can observe which actions generated security telemetry.

### 4. Screen Two: Sentinel Security Dashboard

Build a modern security operations center dashboard. It must be data-driven, not a static mockup.

#### A. Overview metrics

Display:

- Total events received.
- Failed authentication attempts.
- Active alerts.
- Critical/high/medium/low severity counts.
- Suspicious accounts.
- Investigations in progress.

Update these metrics whenever new events are processed.

#### B. Live event stream

Create a chronological event table containing:

- Timestamp.
- Event type.
- Synthetic username or account identifier.
- Synthetic source identifier.
- Severity.
- Detection status.
- Investigation ID.

Include severity filters, event-type filters, search, and a pause/resume control for the visual stream. Pausing the display must not silently discard backend events.

#### C. Alert center

Generate alert cards for scenarios such as:

- Repeated authentication failures.
- Possible brute-force activity.
- Password guessing across multiple usernames.
- Suspicious successful login after repeated failures.
- Potential account compromise.
- Rate-limit threshold exceeded.

Each alert must show:

- Severity.
- Detection time.
- Affected synthetic account or source.
- Supporting event IDs.
- Detection rule.
- Reasoning explanation.
- Recommended next investigation step.
- Status: New, Investigating, Resolved, or False Positive.

Do not classify every failed login as an attack. Detection should depend on relevant thresholds, event sequences, and corroborating evidence.

#### D. AI reasoning inspector

When an analyst selects an alert, show an explanation panel with:

- Observed facts.
- Inferred facts.
- Rules that fired.
- Evidence supporting the inference.
- Missing evidence.
- Alternative explanations.
- Confidence or risk classification.
- Recommended next checks.

Clearly distinguish raw observations from logical inferences. Never present an inference as a confirmed real-world compromise.

#### E. Attack timeline and relationship graph

Display an interactive timeline connecting relevant events.

Example:

Repeated failures → Multiple account attempts → Successful login → Sensitive-action simulation → Elevated risk assessment.

Build a relationship graph showing connections between synthetic users, source identifiers, events, and hypotheses. Every connection must be derived from actual stored event relationships or explicit Prolog inferences.

### 5. Prolog Reasoning Engine

Use SWI-Prolog as the authoritative rule-based inference engine.

Implement modular Prolog files for:

- Event facts.
- Detection rules.
- Temporal correlation.
- Risk assessment.
- Evidence provenance.
- Investigation planning.
- Explanation generation.

The reasoning engine must accept validated structured events and return structured JSON-compatible results.

Implement rules for:

1. Repeated failures within a defined time window.
2. Multiple accounts targeted by one source identifier.
3. Successful authentication shortly after repeated failures.
4. Correlated indicators that elevate an investigation's priority.
5. Benign activity patterns that should not trigger high-severity alerts.
6. Follow-up evidence checks selected according to the current hypothesis.

Use timestamps and explicit correlation windows rather than merely counting all historical events.

Prevent duplicate alerts for the same incident using stable correlation keys and incident state.

The planner should select the next useful read-only investigation step, such as examining the event sequence or checking whether another suspicious indicator exists. It must not automatically block accounts or execute consequential actions.

Expose explanations as structured data, not just console text.

### 6. Agent Investigation Loop

Implement this investigation lifecycle:

1. Receive an event.
2. Validate and persist it.
3. Update the relevant evidence set.
4. Invoke Prolog inference.
5. Generate or update correlated incidents.
6. Calculate a transparent rule-based priority.
7. Select a relevant follow-up investigation step.
8. Persist the decision and explanation.
9. Publish updates to connected dashboard clients.
10. Re-evaluate when new evidence arrives.

The engine must remain usable if the Prolog subprocess fails: record the failure, report degraded status, and avoid fabricating a successful analysis result.

Use bounded execution time, controlled subprocess invocation, safe serialization, and explicit error handling.

### 7. Real-Time Synchronization

Use a FastAPI WebSocket endpoint for dashboard updates.

When a login action generates a security event:

1. The backend persists the event.
2. Sentinel analyzes the updated evidence.
3. The backend publishes the event, resulting alert changes, and updated metrics.
4. The dashboard updates without a full-page reload.
5. Selecting the alert opens the relevant reasoning trace.

On dashboard reconnect, fetch persisted events and active incidents through REST endpoints so the UI recovers from missed WebSocket messages.

Do not generate fake live alerts independently of the actual event pipeline.

### 8. API Design

Implement a documented API, including endpoints equivalent to:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/lab/scenarios/{scenario_id}/run`
- `GET /api/events`
- `GET /api/alerts`
- `GET /api/alerts/{alert_id}`
- `POST /api/alerts/{alert_id}/status`
- `GET /api/metrics`
- `GET /api/investigations/{investigation_id}`
- `GET /api/investigations/{investigation_id}/explanation`
- `WS /ws/dashboard`

Validate all inputs and restrict the attack lab to known scenario identifiers and bounded request counts.

Use consistent error responses, pagination for event queries, structured logs, and appropriate rate limiting.

### 9. Security Requirements

- Bind development services to localhost by default.
- Use secure password hashing for demo accounts.
- Never log passwords or other authentication secrets.
- Do not expose arbitrary Prolog query execution through HTTP.
- Never interpolate user-controlled strings into executable Prolog source.
- Use structured serialization and safe subprocess argument handling.
- Limit event sizes, input lengths, request rates, and analysis execution time.
- Restrict cross-origin requests to explicitly configured origins.
- Keep the simulation isolated from production credentials and external targets.
- Clearly label synthetic telemetry and simulated attack scenarios.
- Require human approval for consequential response actions.

### 10. Design System

Use a premium dark SOC aesthetic:

- Background: deep navy/charcoal.
- Cards: slightly lighter dark surfaces.
- Typography: highly legible sans-serif.
- Accents: restrained cyan or blue.
- Critical alerts: red.
- High alerts: orange.
- Medium alerts: amber.
- Informational states: neutral blue/gray.
- Use consistent spacing, borders, and iconography.
- Add subtle transitions for newly received events and alert escalation.
- Avoid excessive glow, excessive gradients, and distracting animations.

The login page should feel like a believable monitored application. The dashboard should feel like a professional security investigation console.

### 11. Suggested Project Structure

Organize the repository into clear modules, for example:

- `frontend/`
  - `src/pages/LoginPage.tsx`
  - `src/pages/DashboardPage.tsx`
  - `src/components/AlertCenter.tsx`
  - `src/components/EventStream.tsx`
  - `src/components/ReasoningInspector.tsx`
  - `src/components/AttackTimeline.tsx`
  - `src/lib/api.ts`
- `backend/`
  - `app.py`
  - `api/`
  - `services/event_service.py`
  - `services/investigation_service.py`
  - `services/prolog_bridge.py`
  - `services/scenario_runner.py`
  - `models/`
  - `storage/`
- `engine/`
  - `sentinel.pl`
  - `rules/detection.pl`
  - `rules/correlation.pl`
  - `rules/risk.pl`
  - `rules/planning.pl`
  - `rules/explanations.pl`
- `tests/`
  - Prolog unit tests.
  - API integration tests.
  - End-to-end workflow tests.
- `.env.example`
- `README.md`
- `docker-compose.yml` if containerized development is supported.

Adapt this structure to the existing project instead of duplicating or replacing working modules unnecessarily.

### 12. Acceptance Tests

The implementation is complete only when all of these scenarios work end to end:

**Test A — Normal login**
- A valid synthetic demo user signs in.
- A success event is recorded.
- No critical security alert is generated without corroborating evidence.

**Test B — Repeated failures**
- Run the repeated-failure scenario.
- Events appear in the dashboard.
- A relevant rule fires when the configured threshold is met.
- The alert includes the supporting event IDs and explanation.

**Test C — Multiple accounts**
- Generate bounded failures against several synthetic usernames.
- The engine correlates the events using their simulated source identifier.
- The dashboard shows the resulting incident.

**Test D — Suspicious success**
- Generate repeated failures followed by a successful simulated login.
- The engine raises an appropriately elevated hypothesis.
- The reasoning inspector explains the event sequence.

**Test E — Benign activity**
- Generate isolated failures.
- The engine avoids incorrectly escalating them to a confirmed compromise.

**Test F — Live dashboard**
- Keep the dashboard open.
- Trigger a scenario on the login screen.
- Verify that new events, metrics, and alerts appear without reloading.

**Test G — Reconnection**
- Disconnect and reconnect the dashboard WebSocket.
- Verify that persisted events and incidents are restored.

**Test H — Input validation**
- Submit malformed events and unknown scenario identifiers.
- Verify safe rejection without execution of arbitrary code or Prolog queries.

**Test I — Reasoning engine failure**
- Temporarily make the Prolog executable unavailable.
- Verify that the backend reports degraded status and does not fabricate inference results.

**Test J — Persistence**
- Restart the backend.
- Verify that stored events and investigation history remain available.

### 13. Implementation Instructions

First inspect the existing repository and its dependency versions. Preserve working code, existing conventions, and valid configuration.

Implement the system in small, testable modules. Start with the event schema, Prolog rules, and backend bridge; then implement the login simulator, live event pipeline, and dashboard. Integrate the components only after their contracts are defined.

Run the actual SWI-Prolog tests, Python API tests, frontend build, and end-to-end tests wherever the necessary runtime is available. Do not report tests as passing unless they were executed and passed.

Provide a final README with exact Windows PowerShell installation and startup commands, demo credentials, scenario instructions, environment variables, API documentation, troubleshooting steps, and known limitations.

**Definition of done:** I can open `/login`, run a safe simulated attack, switch to `/dashboard`, see a real event-driven warning, inspect the Prolog reasoning and supporting evidence, and observe the investigation update as new events arrive.