import unittest
from fastapi.testclient import TestClient
from unittest.mock import patch

from backend.app import app, demo_dataset

client = TestClient(app)

class SentinelApiTests(unittest.TestCase):
    def test_health_endpoint(self):
        response = client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'simulation_only')

    def test_demo_dataset_has_varied_events(self):
        response = client.get('/api/demo-events')
        self.assertEqual(response.status_code, 200)
        events = response.json()['events']
        self.assertGreaterEqual(len(events), 5)
        self.assertIn('failed_login', {e['type'] for e in events})
        self.assertIn('sensitive_access', {e['type'] for e in events})

    @patch('backend.app.run_prolog')
    def test_analyze_validates_and_calls_engine(self, mock_engine):
        mock_engine.return_value = {
            'status':'ok','event_count':1,'events':[],
            'hypotheses':[],'alerts':[], 'next_actions':[],
            'engine':'SWI-Prolog','safety':'simulation_only'
        }
        response = client.post('/api/analyze', json={'events':[demo_dataset()[0]]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['safety'], 'simulation_only')
        mock_engine.assert_called_once()

    def test_rejects_unknown_event_type(self):
        event = dict(demo_dataset()[0], type='run_shell_command')
        response = client.post('/api/analyze', json={'events':[event]})
        self.assertEqual(response.status_code, 422)

    def test_rejects_duplicate_event_ids(self):
        event = demo_dataset()[0]
        response = client.post('/api/analyze', json={'events':[event, event]})
        self.assertEqual(response.status_code, 422)

    def test_rejects_empty_events(self):
        response = client.post('/api/analyze', json={'events':[]})
        self.assertEqual(response.status_code, 422)

    def test_system_reset_clears_telemetry(self):
        response = client.post('/api/system/reset')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')
        self.assertEqual(response.json()['metrics']['total_events'], 0)

    def test_ipfs_node_status_endpoint(self):
        response = client.get('/api/ipfs/node-status')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('multiaddr', data)
        self.assertEqual(data['multiaddr'], '/ip4/127.0.0.1/tcp/5001')
        self.assertIn('online', data)

    def test_blockchain_ledger_endpoints(self):
        status_res = client.get('/api/ledger/status')
        self.assertEqual(status_res.status_code, 200)
        self.assertIn('block_height', status_res.json())

        blocks_res = client.get('/api/ledger/blocks')
        self.assertEqual(blocks_res.status_code, 200)
        self.assertIsInstance(blocks_res.json(), list)

        verify_res = client.post('/api/ledger/verify')
        self.assertEqual(verify_res.status_code, 200)
        self.assertIn('status', verify_res.json())

    def test_reports_generation_and_export(self):
        gen_res = client.post('/api/reports/generate', json={'title': 'Unit Test Audit Report'})
        self.assertEqual(gen_res.status_code, 200)
        report = gen_res.json()
        self.assertTrue(report['report_id'].startswith('REP-'))
        self.assertTrue(report['ipfs_cid'].startswith('Qm'))
        self.assertIn('report_hash_sha256', report)

        list_res = client.get('/api/reports')
        self.assertEqual(list_res.status_code, 200)
        self.assertGreaterEqual(len(list_res.json()), 1)

        get_res = client.get(f"/api/reports/{report['report_id']}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()['report_id'], report['report_id'])

        md_res = client.get(f"/api/reports/{report['report_id']}/markdown")
        self.assertEqual(md_res.status_code, 200)
        self.assertIn('# Unit Test Audit Report', md_res.json()['markdown'])


if __name__ == '__main__':
    unittest.main()
