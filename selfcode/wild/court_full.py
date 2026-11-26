"""The wild set in a browser, all 39 rebuilt scenes, with x3d-blender-io's pair judge in simultaneous mode.

    python3 selfcode/wild/court_full.py --roots <repository folders> --x-ite <x_ite dist>

Each original against the scene the search wrote (results/woven-test/, from wild.py), judge_pair(mode="simultaneous",
repeats=2). A world with nothing to poke is watched for one whole loop plus 2 s (the lesson was 3.5 loops), at most
40 s; a world with a sensor is watched 6 s (nothing presses it: expected "unclear"). Controls: the first three written
scenes that hold a half-turn key of 3.14159265, with that key printed as 3.141593 (failure mode 357).

Expected, written before the run (COURT.md "Run 3"): at least 30 of 39 "same", none "differs"; 3 of 3 controls "differs".
"""
from __future__ import annotations

import argparse
import datetime
import glob
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import core            # noqa: E402

sys.path.insert(0, str(Path(core.BLENDER_IO) / "tools"))
import behaviour_pair_judge as judge          # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roots", nargs="+", type=Path, required=True)
    ap.add_argument("--x-ite", type=Path, required=True)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "court-wild-full.json")
    a = ap.parse_args()
    result = json.loads((HERE / "results" / "wild-test.json").read_text())
    roots = {Path(r).name: Path(r) for r in a.roots}
    rebuilt = sorted((r for r in result["scenes"] if r["status"] == "task" and r["arms"]["cold"]["solved"] and r["arms"]["cold"].get("heldout")),
                     key=lambda r: r["hash"])
    if a.limit:
        rebuilt = rebuilt[:a.limit]
    controls = HERE / "results" / "woven-test" / "controls"
    controls.mkdir(parents=True, exist_ok=True)
    jobs, planted = [], 0
    for row in rebuilt:
        original = glob.glob(str(roots[row["source"]] / "**" / glob.escape(row["file"])), recursive=True)[0]
        written = HERE / "results" / "woven-test" / f"{row['hash']}.cold.x3d"
        watch = 6.0 if row["touchable"] else round(min(40.0, row["lesson_seconds"] / 3.5 + 2.0), 1)
        jobs.append(("solution", row, original, str(written), watch))
        text = written.read_text()
        if planted < 3 and (" 3.14159265 " in text or ' 3.14159265"' in text):
            c = controls / f"{row['hash']}.six-decimals.x3d"
            c.write_text(text.replace(" 3.14159265", " 3.141593"))
            jobs.append(("control: half-turn key printed to six decimals", row, original, str(c), watch))
            planted += 1
    began, rows = time.time(), []
    for kind, row, a_file, b_file, watch in jobs:
        t0 = time.time()
        try:
            v = judge.judge_pair(a_file, b_file, {"seconds": watch}, repeats=2, x_ite=str(a.x_ite), mode="simultaneous")
            out = {"verdict": v["verdict"], "reason": v.get("reason"), "load": v.get("load"), "skipped": v.get("skipped"),
                   "only_in_one_file": sum(len(x) for x in (v.get("unmatched") or {}).values() if isinstance(x, list)),
                   "streams": [{"stream": s["stream"], "verdict": s["verdict"], "reason": s.get("reason"),
                                "outside": max(s["a_vs_b"]["fraction"], default=None), "widest_gap": max(s["a_vs_b"]["max_abs"], default=None),
                                "floor": s["floor"], "unit": s.get("tolerance_unit")} for s in v["streams"]]}
        except Exception as e:                               # a tool error is a row, not a crash
            out = {"verdict": "error", "error": f"{type(e).__name__}: {str(e)[:300]}"}
        rows.append(dict(out, kind=kind, hash=row["hash"], source=row["source"], file=row["file"], watch_seconds=watch,
                         original_nodes=row.get("reference_nodes"), seconds=round(time.time() - t0, 1)))
        print(len(rows), len(jobs), kind[:8], row["file"][-30:], out["verdict"], flush=True)
        git = lambda path: subprocess.run(["git", "-C", str(path), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
        sols, ctrl = [r for r in rows if r["kind"] == "solution"], [r for r in rows if r["kind"] != "solution"]
        count = lambda rs: {k: sum(1 for r in rs if r["verdict"] == k) for k in ("same", "differs", "unclear", "error")}
        a.out.write_text(json.dumps({"meta": {"date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
                                              "judge": f"x3d-blender-io@{git(core.BLENDER_IO)} tools/behaviour_pair_judge.py judge_pair(mode='simultaneous', repeats=2)",
                                              "x_ite": "X_ITE 16.8.1", "wild_run": result["meta"]["selfcode"], "pairs_planned": len(jobs),
                                              "pairs_done": len(rows), "wall_seconds": round(time.time() - began, 1)},
                                     "summary": {"solutions": count(sols), "controls": count(ctrl)}, "pairs": rows}, indent=1) + "\n")
    print(json.dumps(json.loads(a.out.read_text())["summary"]))


if __name__ == "__main__":
    main()
