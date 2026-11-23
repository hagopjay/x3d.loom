#!/usr/bin/env python3
"""Oracle driver for R2R: run one x3d-blender-io instrument over a list of files and print one verdict per line.

    python blender_io.py --repo /path/to/x3d-blender-io [--addon-source /path/to/source] \
        --instrument import|reexport|x3dpy --files-from list.txt --out verdicts.jsonl [--mem-gb 8]

Run it with a Python that has bpy (and x3d.py for the x3dpy instrument). It reuses the judges of the add-on's own chaos
harness (tools/chaos/differential.py), so a verdict here means what a row of that harness means.

The protocol R2R expects from any oracle driver is this file's output and nothing more:

    {"file": "<path as given>", "outcome": "pass" | "fail" | "skip", "signature": "<for a fail>", "seconds": 0.1}

one JSON object per line, in the order the files were given, flushed after each. If the process dies, the engine reads
what was written, charges the death to the next file in the list, and starts a new driver for the rest.

This file imports nothing from loomkit, so it can run under any interpreter.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from pathlib import Path


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", required=True, help="a checkout of x3d-blender-io (for tools/chaos)")
    ap.add_argument("--addon-source", help="the add-on source/ directory to test (default: <repo>/source)")
    ap.add_argument("--instrument", required=True, choices=("import", "reexport", "x3dpy"))
    ap.add_argument("--files-from", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--mem-gb", type=float, default=0, help="address-space cap; 0 for none")
    a = ap.parse_args(argv)
    if a.mem_gb:
        import resource
        cap = int(a.mem_gb * (1 << 30))
        resource.setrlimit(resource.RLIMIT_AS, (cap, cap))
    if a.addon_source:
        os.environ["X3D_ADDON_SOURCE"] = str(Path(a.addon_source).resolve())
    sys.path.insert(0, str(Path(a.repo).resolve() / "tools" / "chaos"))
    import differential  # the add-on's own harness

    files = [l.strip() for l in Path(a.files_from).read_text(encoding="utf-8").splitlines() if l.strip()]
    judge = differential.ImportJudge() if a.instrument in ("import", "reexport") else None
    scratch = Path(tempfile.mkdtemp(prefix="r2r-oracle-"))
    with open(a.out, "a", encoding="utf-8") as out:
        for f in files:
            t0 = time.time()
            row = {"file": f}
            try:
                if a.instrument == "x3dpy":
                    _own, x = differential.judge_own_and_x3dpy(Path(f))
                    if "crash" in x:
                        row.update(outcome="fail", signature=str(x["crash"]).splitlines()[0][:160])
                    else:
                        row.update(outcome="pass")
                else:
                    imp, exp = judge.run(Path(f), scratch)
                    part = imp if a.instrument == "import" else exp
                    res = part.get("result")
                    if res == "FINISHED":
                        row.update(outcome="pass")
                    elif res == "SKIPPED":
                        row.update(outcome="skip", signature="import did not finish")
                    elif res == "EXCEPTION":
                        row.update(outcome="fail", signature=part.get("exception", "exception"),
                                   message=part.get("message", "")[-300:])
                    else:
                        row.update(outcome="fail", signature=f"{a.instrument} returned {res}")
            except MemoryError:
                row.update(outcome="fail", signature="MemoryError in the driver")
            except Exception as exc:  # the harness itself failed on this file: say so, keep going
                row.update(outcome="fail", signature=f"driver: {type(exc).__name__}", message=str(exc)[-300:])
            row["seconds"] = round(time.time() - t0, 3)
            out.write(json.dumps(row) + "\n")
            out.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
