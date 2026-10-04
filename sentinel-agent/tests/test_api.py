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

if __name__ == '__main__':
    unittest.main()
