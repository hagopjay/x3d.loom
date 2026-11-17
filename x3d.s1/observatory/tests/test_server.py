"""Exercise the loopback boundary without contacting any hosted service."""
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Handler


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, value=None, raw=None):
        body = raw if raw is not None else json.dumps(value) if value is not None else None
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        connection.request(method, path, body=body, headers={'Content-Type': 'application/json'})
        response = connection.getresponse()
        status, headers, data = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return status, headers, data

    def test_catalogue_and_real_rehearsal(self):
        status, _, data = self.request('GET', '/api/catalog')
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)['scenes']), 6)
        status, _, data = self.request('POST', '/api/rehearse', {'scene_id': 'clean-rig', 'p': .9})
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(data)['acceptance_eligible'])

    def test_only_catalogued_sources_are_served_as_x3d(self):
        status, headers, data = self.request('GET', '/scenes/clean-rig.x3d')
        self.assertEqual(status, 200)
        self.assertIn('model/x3d+xml', headers['Content-Type'])
        self.assertIn(b'<X3D', data)
        self.assertEqual(self.request('GET', '/scenes/../rehearsal.py')[0], 404)

    def test_nonfinite_probability_and_extra_fields_are_refused(self):
        for raw in ['{"scene_id":"clean-rig","p":NaN}', '{"scene_id":"clean-rig","p":true}', '{"scene_id":"clean-rig","url":"https://example.com"}']:
            status, _, _ = self.request('POST', '/api/rehearse', raw=raw)
            self.assertEqual(status, 400)

    def test_arbitrary_scene_path_and_nonobject_body_are_refused(self):
        for value in [{'scene_id': '../../README'}, [], {'scene_id': 'clean-rig', 'profile_id': []}]:
            self.assertEqual(self.request('POST', '/api/rehearse', value)[0], 400)

    def test_study_page_is_local_and_cache_is_explicit(self):
        status, headers, data = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn('no-cache', headers['Cache-Control'])
        self.assertIn(b'html', data.lower())

    def test_a_foreign_host_name_is_refused_against_dns_rebinding(self):
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        connection.request('GET', '/api/catalog', headers={'Host': 'rebound.example'})
        response = connection.getresponse()
        self.assertEqual(response.status, 421)
        response.read()
        connection.close()
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        connection.request('HEAD', '/', headers={'Host': 'rebound.example'})
        response = connection.getresponse()
        self.assertEqual(response.status, 421)
        response.read()
        connection.close()
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        connection.request('POST', '/api/rehearse', body='{"scene_id":"clean-rig"}', headers={'Host': 'localhost:1', 'Content-Type': 'application/json'})
        self.assertEqual(connection.getresponse().status, 421)
        connection.close()

    def test_hostile_numbers_and_nesting_get_a_400_not_a_dropped_connection(self):
        for body in ['{"scene_id":"clean-rig","p":' + '9' * 400 + '}', '[' * 8000 + ']' * 8000]:
            connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
            connection.request('POST', '/api/rehearse', body=body, headers={'Host': f'127.0.0.1:{self.server.server_port}', 'Content-Type': 'application/json'})
            response = connection.getresponse()
            self.assertEqual(response.status, 400)
            response.read()
            connection.close()

    def test_a_loopback_head_request_is_served(self):
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        connection.request('HEAD', '/', headers={'Host': f'127.0.0.1:{self.server.server_port}'})
        self.assertEqual(connection.getresponse().status, 200)
        connection.close()

    def test_static_paths_cannot_climb_out_of_the_web_folder(self):
        for path in ['/../rehearsal.py', '/%2e%2e/rehearsal.py', '/..%2f..%2fserver.py', '/vendor/../../server.py']:
            status, _, data = self.request('GET', path)
            self.assertNotIn(b'def host_allowed', data, path)
            self.assertNotIn(b'def rehearse', data, path)


if __name__ == '__main__':
    unittest.main()
