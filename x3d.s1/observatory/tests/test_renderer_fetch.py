"""The optional renderer is fetched, pinned and verified; the rehearsal never depends on it. No network is used here."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import fetch_renderer as f


class RendererFetchTests(unittest.TestCase):
    def test_manifest_is_pinned_and_every_path_stays_inside_the_folder(self):
        manifest = f.load_manifest()
        self.assertTrue(manifest['source'].startswith('https://cdn.jsdelivr.net/npm/x_ite@16.6.0/'))
        self.assertEqual(len(manifest['files']), len({e['path'] for e in manifest['files']}))
        self.assertIn('x_ite.min.js', {e['path'] for e in manifest['files']})
        for entry in manifest['files']:
            self.assertEqual(len(entry['sha256']), 64)
            self.assertGreater(entry['bytes'], 0)

    def test_a_manifest_that_escapes_or_repoints_is_refused(self):
        good = json.loads(f.MANIFEST.read_text(encoding='utf-8'))
        for change in ({'files': [{'path': '../x.js', 'bytes': 1, 'sha256': 'a' * 64}]}, {'source': 'https://evil.example/dist/'}):
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / 'm.json'
                path.write_text(json.dumps({**good, **change}), encoding='utf-8')
                with patch.object(f, 'MANIFEST', path), self.assertRaises(SystemExit):
                    f.load_manifest()

    def test_bytes_that_differ_from_the_pin_are_never_written(self):
        entry = {'path': 'x_ite.min.js', 'bytes': 3, 'sha256': hashlib.sha256(b'abc').hexdigest()}
        manifest = {'source': 'https://cdn.jsdelivr.net/npm/x_ite@16.6.0/dist/'}

        class Response:
            def __init__(self, data): self.data = data
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self, n): return self.data[:n]

        with tempfile.TemporaryDirectory() as folder, patch.object(f, 'DEST', Path(folder)):
            with patch('urllib.request.urlopen', return_value=Response(b'abd')), self.assertRaises(ValueError):
                f.fetch(manifest, entry)
            self.assertFalse((Path(folder) / 'x_ite.min.js').exists())
            self.assertEqual(list(Path(folder).iterdir()), [])
            with patch('urllib.request.urlopen', return_value=Response(b'abc')):
                f.fetch(manifest, entry)
            self.assertEqual(f.status(entry), 'ok')

    def test_the_application_never_imports_the_renderer_tool(self):
        for name in ('rehearsal.py', 'server.py'):
            self.assertNotIn('fetch_renderer', (ROOT / name).read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
