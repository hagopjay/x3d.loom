"""The kernel's verdict on a document: the X3D 4.0 schema and the semantic checks of the x3d_mcp fork.

    python3 selfcode/kernel.py --x3d-mcp ../x3d_mcp file.x3d [file.x3d ...]      (prints one JSON object)

Run it with a Python that has the fork's requirements. `check(texts, mcp)` does the same from Python, in a child
process, so the caller needs none of them.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

CHILD = r'''
import json, sys
mcp = sys.argv[1]
sys.path.insert(0, mcp + "/src")
from validation.validate import validate_xml
from validation import semantic
out = {}
for path in sys.argv[2:]:
    text = open(path, encoding="utf-8").read()
    xsd = validate_xml(text).get("errors") or []
    found = semantic.semantic_diagnostics(text)
    out[path] = {"xsd_errors": len(xsd), "errors": sorted({d.check for d in found if d.level == "error"}),
                 "warnings": sorted({d.check for d in found if d.level == "warning"})}
print(json.dumps(out))
'''


def check(paths, mcp, python=sys.executable):
    paths = [str(p) for p in paths]
    out = {}
    for i in range(0, len(paths), 200):
        r = subprocess.run([python, "-c", CHILD, str(mcp), *paths[i:i + 200]], capture_output=True, text=True, timeout=900)
        if r.returncode:
            raise SystemExit("kernel failed:\n" + r.stderr[-2000:])
        out.update(json.loads(r.stdout.strip().splitlines()[-1]))
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    mcp = Path(args[args.index("--x3d-mcp") + 1]).resolve()
    files = [a for i, a in enumerate(args) if a != "--x3d-mcp" and (i == 0 or args[i - 1] != "--x3d-mcp")]
    print(json.dumps(check(files, mcp), indent=1))
