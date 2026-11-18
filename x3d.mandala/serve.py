#!/usr/bin/env python3
"""Serve the native X3D Resonance Loom locally. Python3.10+; no installs."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import webbrowser
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--port',type=int,default=8844);p.add_argument('--open',action='store_true');args=p.parse_args()
 if not 1<=args.port<=65535:p.error('Port must be1..65535.')
 root=Path(__file__).resolve().parent
 s=ThreadingHTTPServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(root)))
 url=f'http://127.0.0.1:{args.port}/';print('Sri Yantra Resonance Loom: '+url,flush=True)
 if args.open:webbrowser.open(url)
 try:s.serve_forever()
 except KeyboardInterrupt:pass
 finally:s.server_close()
if __name__=='__main__':main()
