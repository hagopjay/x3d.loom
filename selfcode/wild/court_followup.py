"""Two follow-ups to run 2 of the wild court (exploratory, after the fact; COURT.md "After run 2").

    python3 selfcode/wild/court_followup.py --roots <repository folders> --x-ite <x_ite dist>

1. The pair that ended in a tool error (a value X_ITE prints in brackets), run again with the reader fixed.
2. The controls. A half-turn key printed to six decimals changes only the first half of the loop (0 to pi runs the
   other way; pi back to 0 is the same short way in both). A 6 s watch at a random point of a 30 to 60 s loop sees
   that half about one time in two. Here each control is started when the wall clock puts the loop early in its first
   half, and again early in its second half. Expected: first half differs, second half same.
"""
from __future__ import annotations

import argparse
import glob
import json
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import court_wild as cw          # noqa: E402


def wait_for(cycle, lo, hi):
    """Sleep until the wall clock is between lo and hi of the loop (shares of the cycle). Returns the phase."""
    while True:
        phase = (time.time() % cycle) / cycle
        if lo <= phase <= hi:
            return round(phase, 3)
        time.sleep(0.2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roots", nargs="+", type=Path, required=True)
    ap.add_argument("--x-ite", type=Path, required=True)
    ap.add_argument("--seconds", type=float, default=6.0)
    a = ap.parse_args()
    run2 = json.loads((HERE / "results" / "court-wild.json").read_text())
    roots = {Path(r).name: Path(r) for r in a.roots}
    original = lambda row: glob.glob(str(roots[row["source"]] / "**" / glob.escape(row["file"])), recursive=True)[0]
    out = {"meta": {"note": "exploratory, run after run 2 was read", "watch_seconds": a.seconds, "method": run2["meta"]["method"],
                    "recorder": run2["meta"]["recorder"], "x_ite": run2["meta"]["x_ite"]}, "rerun_after_reader_fix": [], "controls_by_half": []}
    for row in run2["pairs"]:
        if row["verdict"] == "error":
            written = HERE / "results" / "woven-test" / f"{row['hash']}.cold.x3d"
            out["rerun_after_reader_fix"].append(cw.one(("solution", row, original(row), str(written), a.seconds, a.x_ite)))
    for row in run2["pairs"]:
        if row["kind"] == "solution":
            continue
        control = HERE / "results" / "woven-test" / "controls" / f"{row['hash']}.six-decimals.x3d"
        cycle = float(re.search(r'<TimeSensor[^>]*cycleInterval="([^"]+)"', control.read_text()).group(1))
        for half, (lo, hi) in (("first half", (0.02, 0.10)), ("second half", (0.55, 0.65))):
            phase = wait_for(cycle, lo, hi)                  # the browsers take a few seconds to load: still inside the half
            ab, _ = cw.compare(*cw.together([original(row), str(control)], a.seconds, a.x_ite))
            out["controls_by_half"].append({"hash": row["hash"], "file": row["file"], "cycle_seconds": cycle, "half": half,
                                            "phase_at_launch": phase,
                                            "streams": {k: {"outside": v[0], "widest_gap": v[1], "samples": v[2]} for k, v in ab.items()}})
            print(json.dumps(out["controls_by_half"][-1]), flush=True)
    (HERE / "results" / "court-wild-followup.json").write_text(json.dumps(out, indent=1) + "\n")
    for r in out["rerun_after_reader_fix"]:
        print(r["file"], r["verdict"], r.get("error"), [(s["stream"], s["verdict"], s["outside"], s["floor"]) for s in r.get("streams", [])])


if __name__ == "__main__":
    main()
