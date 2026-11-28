#!/usr/bin/env python3
"""Ask the importer alone (no export afterwards) about a list of files: one verdict row per file, each in its own process.
Usage (inside the bpy venv):
    X3D_ADDON_SOURCE=.../source python import_only.py X3D_BLENDER_IO_REPO FILES.txt OUT.jsonl [DEADLINE_SECONDS]
Why this exists: the harness judge runs import followed by export in one call, so a file whose export never answers was
first written down as a file whose import never answers (weekly run of 28 Nov 2026)."""
import json, subprocess, sys, time
from pathlib import Path

if sys.argv[1] == "--child":
    sys.path.insert(0, str(Path(sys.argv[2]).resolve() / "tools" / "chaos"))
    import contextlib, io
    import differential
    import bpy
    differential.ImportJudge()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    row = {"file": sys.argv[3]}
    t0 = time.time()
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            res = sorted(bpy.ops.import_scene.x3d(filepath=sys.argv[3]))[0]
        row.update(outcome="pass") if res == "FINISHED" else row.update(outcome="fail", signature=f"import returned {res}")
    except Exception as exc:
        row.update(outcome="fail", signature=differential._signature(exc), message=str(exc)[-300:])
    row["seconds"] = round(time.time() - t0, 3)
    row["asked"] = "import alone"
    print("ROW " + json.dumps(row))
    raise SystemExit(0)

repo, files, out = sys.argv[1], [l.strip() for l in Path(sys.argv[2]).read_text().splitlines() if l.strip()], sys.argv[3]
deadline = float(sys.argv[4]) if len(sys.argv) > 4 else 60.0
with open(out, "w", encoding="utf-8") as fh:
    for f in files:
        t0 = time.time()
        try:
            p = subprocess.run([sys.executable, __file__, "--child", repo, f], capture_output=True, text=True, timeout=deadline + 30)
            got = [l[4:] for l in p.stdout.splitlines() if l.startswith("ROW ")]
            row = json.loads(got[-1]) if got else {"file": f, "outcome": "fail", "signature": f"process died, exit {p.returncode}",
                                                    "seconds": round(time.time() - t0, 1), "asked": "import alone"}
        except subprocess.TimeoutExpired:
            row = {"file": f, "outcome": "fail", "signature": f"no answer in {deadline:.0f} s (import alone)",
                   "seconds": round(time.time() - t0, 1), "asked": "import alone"}
        if row["outcome"] == "pass" and row["seconds"] > deadline:
            row.update(outcome="fail", signature=f"no answer in {deadline:.0f} s (import alone)")
        fh.write(json.dumps(row) + "\n"); fh.flush()
        print(row["outcome"], row["seconds"], f[-70:], flush=True)
