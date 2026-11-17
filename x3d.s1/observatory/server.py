#!/usr/bin/env python3
"""Serve the local Decision Observatory. Only authored fixtures can be rendered."""
from __future__ import annotations
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import urlsplit
from rehearsal import ROOT, canonical, catalog, rehearse, scene_records, strict_json


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def send_data(self, data, content_type='application/json; charset=utf-8', status=200):
        data = canonical(data) if not isinstance(data, bytes) else data
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def host_allowed(self):
        """Loopback-only is not enough against DNS rebinding: a hostile page can point its own name at 127.0.0.1. Serve only our own loopback names."""
        host = (self.headers.get('Host') or '').lower()
        return host in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}

    def do_GET(self):
        if not self.host_allowed():
            self.send_data({'error': 'Unexpected Host header'}, status=421)
            return
        path = urlsplit(self.path).path
        if path == '/api/catalog':
            self.send_data(catalog())
        elif path.startswith('/scenes/'):
            allowed = {item['uri']: item['id'] for item in scene_records()}
            if path not in allowed:
                self.send_data({'error': 'Unknown authored fixture'}, status=404)
                return
            self.send_data((ROOT / 'scenes' / (allowed[path] + '.x3d')).read_bytes(), 'model/x3d+xml; charset=utf-8')
        elif path.startswith('/api/'):
            self.send_data({'error': 'Unknown local endpoint'}, status=404)
        else:
            super().do_GET()

    def do_HEAD(self):
        # HEAD shares the static handler, so it needs the same Host gate as GET.
        if not self.host_allowed():
            self.send_response(421)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        super().do_HEAD()

    def do_POST(self):
        if not self.host_allowed():
            self.send_data({'error': 'Unexpected Host header'}, status=421)
            return
        if urlsplit(self.path).path != '/api/rehearse':
            self.send_data({'error': 'Unknown local endpoint'}, status=404)
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 1 <= size <= 16_384:
                raise ValueError('Request must contain 1 to 16384 bytes of JSON')
            data = strict_json(self.rfile.read(size).decode('utf-8'))
            if not isinstance(data, dict) or set(data) - {'scene_id', 'profile_id', 'p', 'threshold'}:
                raise ValueError('Only scene_id, profile_id, p and threshold are supported')
            if not isinstance(data.get('scene_id'), str) or not isinstance(data.get('profile_id', 'preview'), str):
                raise ValueError('A local scene ID and profile ID are required')
            self.send_data(rehearse(**data))
        except (ValueError, KeyError, TypeError, OverflowError, RecursionError) as error:
            self.send_data({'error': str(error), 'model_calls': 0}, status=400)

    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8810)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('Port must be in 1..65535')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Decision Observatory: http://127.0.0.1:{args.port}/', flush=True)
    print('Local rehearsal, zero model calls. This does not mint release evidence.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
