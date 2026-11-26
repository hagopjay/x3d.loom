#!/usr/bin/env python3
"""One turn of the X3D flywheel, measured.

A turn is: measure the kernel on fixed benchmarks, read the misses, write rules for them, measure again,
write both numbers down. This command does the measuring and the writing down. Writing the rules is still
done by a person or an agent between two measurements; the ledger says who.

    python3 flywheel/turn.py measure --x3d-mcp ../x3d_mcp --what "what changed since the last entry"
    python3 flywheel/turn.py show

Benchmarks (each is a fixed, public set of scenes; no model is called and nothing is rendered):
    fault-court    the X3D arm of fault-court/: 60 planted faults, 10 legal decoys, 1 clean control
    gltf-parity    the scene pairs in the validator's tests/gltf_parity.py: one failing and one passing
                   scene for each Khronos glTF-Validator code that X3D can state

The validator measured is the checkout given with --x3d-mcp, at whatever commit it is on. An entry made
from a checkout with uncommitted changes is marked dirty and should not be cited.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEDGER = HERE / "LEDGER.jsonl"
COURT = HERE.parent / "fault-court"


def git(path: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True).stdout.strip()


def measure_court(mcp: Path) -> dict:
    """Run the X3D arm of the Fault Court in a child process so the checkout's modules load fresh."""
    code = r'''
import json, sys, tempfile
from pathlib import Path
court_dir, mcp = sys.argv[1], sys.argv[2]
sys.path.insert(0, court_dir); sys.path.insert(0, mcp + "/src")
import run
from validation.validate import validate_xml
from validation import semantic
with_files = getattr(semantic, "semantic_diagnostics_with_files", None)
out = Path(tempfile.mkdtemp())
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    man = run.build(out)
res = {}
for cid, c in man.items():
    p = c["files"]["x3d"]
    if p in ("NE", "NA"):
        continue
    text = Path(p).read_text()
    found = ["xsd"] if (validate_xml(text).get("errors") or []) else []
    ds = with_files(text, Path(p).parent) if with_files else semantic.semantic_diagnostics(text)
    found += sorted({d.check for d in ds if d.level in ("error", "warning")})
    res[cid] = found
print(json.dumps(res))
'''
    r = subprocess.run([sys.executable, "-c", code, str(COURT), str(mcp)], capture_output=True, text=True, timeout=900)
    if r.returncode:
        raise SystemExit("fault-court failed:\n" + r.stderr[-2000:])
    res = json.loads(r.stdout.strip().splitlines()[-1])
    faults = sorted(k for k in res if k != "clean" and not k.startswith("Z"))
    return {"stateable": len(faults), "caught": sum(1 for k in faults if res[k]),
            "missed": [k for k in faults if not res[k]],
            "decoys_flagged": {k: res[k] for k in sorted(res) if k.startswith("Z") and res[k]},
            "clean_findings": res["clean"]}


def measure_parity(mcp: Path, fixtures: Path) -> dict:
    env = dict(os.environ, X3D_PARITY_SRC=str(mcp / "src"))
    r = subprocess.run([sys.executable, str(fixtures), "--json"], capture_output=True, text=True, env=env, timeout=900)
    if r.returncode:
        raise SystemExit("gltf-parity failed:\n" + r.stderr[-2000:])
    j = json.loads(r.stdout.strip().splitlines()[-1])
    return {"gltf_codes": j["codes"], "stateable": j["stateable"], "covered": j["covered"], "uncovered": j["uncovered"]}


def entries() -> list[dict]:
    return [json.loads(x) for x in LEDGER.read_text().splitlines() if x.strip()] if LEDGER.exists() else []


def render(es: list[dict]) -> str:
    L = ["# Flywheel ledger", "",
         "One row per measured turn. Written by `flywheel/turn.py measure`; do not edit by hand. The numbers are counts",
         "of scenes, from the benchmarks named in `flywheel/README.md`.", "",
         "| Turn | Date | Validator | Fault Court caught | Decoys flagged | glTF-Validator codes matched | Rules by | Model calls | What changed |",
         "|---|---|---|---|---|---|---|---|---|"]
    for e in es:
        c, p = e["fault_court"], e["gltf_parity"]
        L.append(f"| {e['turn']} | {e['date']} | `{e['validator']}`{' (dirty)' if e.get('dirty') else ''} | "
                 f"{c['caught']} of {c['stateable']} | {len(c['decoys_flagged'])} of 10 | {p['covered']} of {p['stateable']} | "
                 f"{e['rules_by']} | {e['model_calls']} | {e['what']} |")
    if es:
        last = es[-1]
        L += ["", "## Open after the last turn", "",
              f"- Fault Court still missed: {', '.join(last['fault_court']['missed']) or 'none'}",
              f"- Decoys flagged: {', '.join(f'{k} ({v[0]})' for k, v in last['fault_court']['decoys_flagged'].items()) or 'none'}",
              f"- glTF-Validator codes not matched: {', '.join(last['gltf_parity']['uncovered']) or 'none'}"]
    return "\n".join(L) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("measure")
    m.add_argument("--x3d-mcp", required=True, type=Path)
    m.add_argument("--fixtures", type=Path, help="gltf_parity.py to use (default: the checkout's own tests/gltf_parity.py)")
    m.add_argument("--what", required=True, help="what changed since the last entry, one sentence")
    m.add_argument("--rules-by", default="agent, not yet reviewed by a person", help="who wrote the rules of this turn")
    m.add_argument("--model-calls", type=int, default=0, help="model calls made by the loop itself during this turn")
    m.add_argument("--date", default=datetime.date.today().isoformat())
    sub.add_parser("show")
    a = ap.parse_args()
    es = entries()
    if a.cmd == "measure":
        mcp = a.x3d_mcp.resolve()
        e = {"turn": len(es) + 1, "date": a.date,
             "validator": f"x3d_mcp@{git(mcp, 'rev-parse', '--short', 'HEAD')}", "dirty": bool(git(mcp, "status", "--porcelain")),
             "fault_court": measure_court(mcp), "gltf_parity": measure_parity(mcp, (a.fixtures or mcp / "tests" / "gltf_parity.py").resolve()),
             "rules_by": a.rules_by, "model_calls": a.model_calls, "what": a.what}
        with LEDGER.open("a") as fh:
            fh.write(json.dumps(e, sort_keys=True) + "\n")
        es.append(e)
        (HERE / "LEDGER.md").write_text(render(es))
    print(render(es))


if __name__ == "__main__":
    main()
