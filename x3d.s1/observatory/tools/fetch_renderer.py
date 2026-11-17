#!/usr/bin/env python3
"""Fetch the pinned X_ITE renderer for the optional preview pane. Standard library only.

The renderer (MIT, 11 MB) is not committed. Every file is downloaded from the pinned npm release over HTTPS and is written only if its size and sha256 match
renderer-manifest.json; a mismatch deletes nothing and writes nothing. The rehearsal, the witness plan and the routing views work without it.

    python3 tools/fetch_renderer.py            # fetch what is missing or different
    python3 tools/fetch_renderer.py --check    # verify what is on disk; exit 1 if anything is missing or differs
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'web' / 'vendor' / 'x_ite'
MANIFEST = ROOT / 'renderer-manifest.json'
ALLOWED_PREFIX = 'https://cdn.jsdelivr.net/npm/x_ite@'


def load_manifest() -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if not manifest['source'].startswith(ALLOWED_PREFIX) or not manifest['source'].endswith('/dist/'):
        raise SystemExit('refusing a manifest whose source is not the pinned x_ite release')
    for entry in manifest['files']:
        parts = Path(entry['path']).parts
        if Path(entry['path']).is_absolute() or '..' in parts or not parts:
            raise SystemExit('refusing a manifest path outside the renderer folder: ' + entry['path'])
    return manifest


def status(entry: dict) -> str:
    target = DEST / entry['path']
    if not target.is_file():
        return 'missing'
    data = target.read_bytes()
    return 'ok' if len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'] else 'differs'


def fetch(manifest: dict, entry: dict) -> None:
    url = manifest['source'] + urllib.parse.quote(entry['path'])
    request = urllib.request.Request(url, headers={'User-Agent': 'x3d-observatory-fetch/1'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(entry['bytes'] + 1)
    if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError(f"{entry['path']}: downloaded bytes do not match the pinned size and sha256; nothing was written")
    target = DEST / entry['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.part')
    temporary.write_bytes(data)
    os.replace(temporary, target)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true', help='verify the files on disk; download nothing')
    args = parser.parse_args(argv)
    manifest = load_manifest()
    states = {entry['path']: status(entry) for entry in manifest['files']}
    bad = [path for path, state in states.items() if state != 'ok']
    if args.check or not bad:
        print(f"{len(states) - len(bad)} of {len(states)} renderer files verified" + ('' if not bad else '; ' + str(len(bad)) + ' missing or different'))
        return 1 if bad else 0
    failures = 0
    for entry in manifest['files']:
        if states[entry['path']] == 'ok':
            continue
        try:
            fetch(manifest, entry)
        except (urllib.error.URLError, OSError, ValueError) as error:
            failures += 1
            print('FAILED ' + entry['path'] + ': ' + str(error), file=sys.stderr)
    after = sum(1 for entry in manifest['files'] if status(entry) == 'ok')
    print(f"{after} of {len(manifest['files'])} renderer files verified (X_ITE {manifest['version']}, MIT; licence copy in licenses/)")
    return 1 if failures or after != len(manifest['files']) else 0


if __name__ == '__main__':
    raise SystemExit(main())
