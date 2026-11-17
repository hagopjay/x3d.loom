#!/usr/bin/env python3
"""Serve the bundled Flop Lab locally. No npm install or hosted account required."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import webbrowser

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8840)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('Port must be 1..65535')
    root = Path(__file__).resolve().parent
    if not (root/'vendor/three/ORIGIN.json').is_file():
        parser.error('Bundled renderer missing. For a source checkout, run npm ci and npm run vendor.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(SimpleHTTPRequestHandler, directory=str(root)))
    url = f'http://127.0.0.1:{args.port}/'
    print('Flop Lab Expedition:', url, flush=True)
    print('Local procedural gameplay. The optional host curator is not required.', flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
