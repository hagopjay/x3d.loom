#!/usr/bin/env python3
"""Serve the prebuilt app on loopback. Python standard library; no install needed."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import errno
import threading
import webbrowser

def main():
    parser = argparse.ArgumentParser(description='Start X3D–MuJoCo Proto-Bridge locally')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    build = Path(__file__).resolve().parent / 'dist'
    if not (build / 'index.html').is_file():
        parser.error('Missing dist/index.html. Extract the full ZIP, or run npm ci && npm run build.')
    handler = partial(SimpleHTTPRequestHandler, directory=str(build))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        if error.errno != errno.EADDRINUSE:
            raise
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'\nX3D–MuJoCo Proto-Bridge: {url}\nPhysics runs in your browser. Ctrl+C stops this local server.\n', flush=True)
    if not args.no_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
