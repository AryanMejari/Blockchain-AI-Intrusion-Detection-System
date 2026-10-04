from __future__ import annotations

import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.app import app
from backend.storage.db import init_db, get_db_connection

client = TestClient(app)


class SentinelFullIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        # Clean events to ensure isolated test environment
        conn = get_db_connection()
        conn.execute("DELETE FROM events")
        conn.execute("DELETE FROM alerts")
        conn.commit()
        conn.close()

    def test_health_detailed(self):
        res = client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["mode"], "simulation_only")
        self.assertEqual(data["engine"], "SWI-Prolog")
        self.assertTrue(data["prolog_available"])

    def test_frontend_routes_served(self):
        # Verify /login and /dashboard return index.html
        res_login = client.get("/login")
        self.assertEqual(res_login.status_code, 200)
        self.assertIn("text/html", res_login.headers["content-type"])

        res_dash = client.get("/dashboard")
        self.assertEqual(res_dash.status_code, 200)
        self.assertIn("text/html", res_dash.headers["content-type"])

        res_root = client.get("/", follow_redirects=True)
        self.assertEqual(res_root.status_code, 200)

    def test_auth_login_success(self):
        # Test A: Normal login
        res = client.post(
            "/api/auth/login",
            json={
                "username": "alice",
                "password": "Sentinel@2026!",
                "simulated_source": "192.168.1.100",
                "simulated_context": "usual",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["event"]["type"], "successful_login")

    def test_auth_login_failure(self):
        res = client.post(
            "/api/auth/login",
            json={
                "username": "alice",
                "password": "WrongPassword!",
                "simulated_source": "192.168.1.100",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "failure")
        self.assertEqual(data["event"]["type"], "failed_login")

    def test_scenario_repeated_failures(self):
        # Test B: Repeated failures
        res = client.post(
            "/api/lab/scenarios/repeated_failures/run",
            json={"target_user": "target_user_b", "source_ip": "192.168.1.200"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["events_count"], 6)

        # Check events in list
        events_res = client.get("/api/events?limit=10")
        self.assertEqual(events_res.status_code, 200)
        self.assertGreater(events_res.json()["total"], 0)

    def test_scenario_multiple_accounts(self):
        # Test C: Multiple accounts spray
        res = client.post(
            "/api/lab/scenarios/multiple_accounts/run",
            json={"source_ip": "10.99.88.77"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        alerts = client.get("/api/alerts").json()
        # Ensure spray alert exists
        spray_alerts = [a for a in alerts if "credential_spray" in a["id"] or "Credential Spray" in a["title"]]
        self.assertGreaterEqual(len(spray_alerts), 1)

    def test_scenario_suspicious_success(self):
        # Test D: Suspicious success following failures
        res = client.post(
            "/api/lab/scenarios/successful_after_failures/run",
            json={"target_user": "compromise_target", "source_ip": "172.20.1.10"},
        )
        self.assertEqual(res.status_code, 200)
        alerts = client.get("/api/alerts").json()
        comp_alerts = [a for a in alerts if "compromise" in a["id"] or "account_compromise" in a["title"]]
        self.assertGreaterEqual(len(comp_alerts), 1)

    def test_scenario_rate_limit_burst(self):
        res = client.post(
            "/api/lab/scenarios/rate_limit_burst/run",
            json={"source_ip": "203.0.113.99"},
        )
        self.assertEqual(res.status_code, 200)
        alerts = client.get("/api/alerts").json()
        rl_alerts = [a for a in alerts if "rate_limit" in a["id"] or "Rate-Limit" in a["title"]]
        self.assertGreaterEqual(len(rl_alerts), 1)

    def test_alert_status_lifecycle(self):
        # Trigger an incident to have guaranteed alert
        client.post(
            "/api/lab/scenarios/repeated_failures/run",
            json={"target_user": "status_lifecycle_user", "source_ip": "192.168.1.188"},
        )
        alerts = client.get("/api/alerts").json()
        self.assertGreater(len(alerts), 0)
        alert_id = alerts[0]["id"]

        # Update to investigating
        res = client.post(f"/api/alerts/{alert_id}/status", json={"status": "investigating"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "investigating")

        # Update to resolved
        res2 = client.post(f"/api/alerts/{alert_id}/status", json={"status": "resolved"})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["status"], "resolved")

    def test_metrics_endpoint(self):
        res = client.get("/api/metrics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_events", data)
        self.assertIn("failed_logins", data)
        self.assertIn("active_alerts", data)

    def test_investigation_and_explanation(self):
        client.post(
            "/api/lab/scenarios/repeated_failures/run",
            json={"target_user": "explanation_user", "source_ip": "192.168.1.199"},
        )
        alerts = client.get("/api/alerts").json()
        alert_id = alerts[0]["id"]
        res = client.get(f"/api/investigations/{alert_id}/explanation")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("observed_facts", data)
        self.assertIn("inferred_facts", data)
        self.assertIn("missing_evidence", data)
        self.assertIn("alternative_explanations", data)

    def test_input_validation_rejections(self):
        # Test H: Malformed inputs and unknown scenario ID
        res = client.post("/api/lab/scenarios/non_existent_scenario_12345/run")
        self.assertEqual(res.status_code, 400)

        # Invalid login payload
        res2 = client.post("/api/auth/login", json={"username": ""})
        self.assertEqual(res2.status_code, 422)

    def test_websocket_stream_connection(self):
        # Test F & G: WebSocket live stream
        with client.websocket_connect("/ws/dashboard") as ws:
            data = ws.receive_json()
            self.assertEqual(data["type"], "INITIAL_SNAPSHOT")
            self.assertIn("metrics", data)

    @patch("backend.services.investigation_service.run_prolog")
    def test_reasoning_engine_failure_tolerance(self, mock_prolog):
        # Test I: When Prolog engine fails, report degraded status without fake inference
        mock_prolog.side_effect = Exception("Subprocess failure simulation")
        res = client.post(
            "/api/auth/login",
            json={
                "username": "alice",
                "password": "Sentinel@2026!",
                "simulated_source": "192.168.1.100",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["pipeline"]["status"], "degraded")

    def test_database_persistence_across_connections(self):
        # Test J: Persistence in SQLite
        conn1 = get_db_connection()
        cursor1 = conn1.cursor()
        cursor1.execute("SELECT COUNT(*) as count FROM events")
        c1 = cursor1.fetchone()["count"]
        conn1.close()

        # Connect again freshly
        conn2 = get_db_connection()
        cursor2 = conn2.cursor()
        cursor2.execute("SELECT COUNT(*) as count FROM events")
        c2 = cursor2.fetchone()["count"]
        conn2.close()

        self.assertEqual(c1, c2)
        self.assertGreater(c2, 0)


if __name__ == "__main__":
    unittest.main()
