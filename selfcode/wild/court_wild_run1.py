"""The wild set in a real browser: does what the search wrote behave like the original in X_ITE?

    python3 selfcode/wild/court_wild.py --roots <repository folders> --x-ite <x_ite dist> [--limit 12] [--seconds 6]

Takes the scenes the wild run rebuilt (results/wild-test.json, no-memory arm), in hash order, and replays each original
against the scene the search wrote (results/woven-test/, written by wild.py) with x3d-blender-io's pair judge
(tools/behaviour_pair_judge.py): three replays of each file, interleaved, and a verdict that is measured against what a
file does against itself in the same session.

Controls that must come out "differs": for every sampled scene whose written table holds a half-turn key of 3.14159265,
the same file with that key printed to six decimals (3.141593). That is failure mode 357, known to run the other way.

Stated before the run (COURT.md): at least 10 of the first 12 rebuilt scenes "same", none "differs"; every control
"differs".
"""
from __future__ import annotations

import argparse
import concurrent.futures
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


def one(job):
    kind, row, a, b, seconds, repeats, x_ite = job
    began = time.time()
    try:
        v = judge.judge_pair(str(a), str(b), {"seconds": seconds}, repeats=repeats, x_ite=str(x_ite))
        streams = [{"stream": s["stream"], "verdict": s["verdict"], "worst_a_vs_b": max(s["a_vs_b"]["fraction"], default=None),
                    "median_a_vs_b": sorted(s["a_vs_b"]["fraction"])[len(s["a_vs_b"]["fraction"]) // 2] if s["a_vs_b"]["fraction"] else None,
                    "floor": s["floor"], "floor_typical": s["floor_typical"]} for s in v["streams"]]
        out = {"verdict": v["verdict"], "streams": streams, "unmatched": v.get("unmatched"), "load": v.get("load"),
               "page_errors": v.get("page_errors"), "x_ite": v.get("x_ite"), "browser": v.get("browser")}
    except Exception as e:                                   # a tool error is a row, not a crash
        out = {"verdict": "error", "error": f"{type(e).__name__}: {str(e)[:300]}"}
    return dict(out, kind=kind, hash=row["hash"], source=row["source"], file=row["file"], seconds=round(time.time() - began, 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roots", nargs="+", type=Path, required=True)
    ap.add_argument("--x-ite", type=Path, required=True)
    ap.add_argument("--limit", type=int, default=12)
    ap.add_argument("--seconds", type=float, default=6.0)
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--out", type=Path, default=HERE / "results" / "court-wild.json")
    a = ap.parse_args()
    result = json.loads((HERE / "results" / "wild-test.json").read_text())
    roots = {Path(r).name: Path(r) for r in a.roots}
    rebuilt = sorted((r for r in result["scenes"] if r["status"] == "task" and r["arms"]["cold"]["solved"] and r["arms"]["cold"].get("heldout")),
                     key=lambda r: r["hash"])
    jobs, controls = [], HERE / "results" / "woven-test" / "controls"
    controls.mkdir(parents=True, exist_ok=True)
    for row in rebuilt[:a.limit]:
        found = glob.glob(str(roots[row["source"]] / "**" / glob.escape(row["file"])), recursive=True)
        written = HERE / "results" / "woven-test" / f"{row['hash']}.cold.x3d"
        if not found or not written.exists():
            raise SystemExit(f"missing files for {row['hash']}: run wild.py --split test first")
        jobs.append(("solution", row, found[0], written, a.seconds, a.repeats, a.x_ite))
        text = written.read_text()
        if " 3.14159265 " in text or ' 3.14159265"' in text:
            c = controls / f"{row['hash']}.six-decimals.x3d"
            c.write_text(text.replace(" 3.14159265", " 3.141593"))
            jobs.append(("control: half-turn key printed to six decimals", row, found[0], c, a.seconds, a.repeats, a.x_ite))
    began = time.time()
    with concurrent.futures.ProcessPoolExecutor(a.workers) as pool:
        rows = list(pool.map(one, jobs))
    git = lambda path: subprocess.run(["git", "-C", str(path), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    sols = [r for r in rows if r["kind"] == "solution"]
    ctrl = [r for r in rows if r["kind"] != "solution"]
    count = lambda rs: {v: sum(1 for r in rs if r["verdict"] == v) for v in ("same", "differs", "unclear", "error")}
    out = {"meta": {"date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"), "rebuilt_in_wild_run": len(rebuilt),
                    "sampled": len(sols), "sampling": "first by hash", "watch_seconds": a.seconds, "repeats": a.repeats, "workers": a.workers,
                    "judge": f"x3d-blender-io@{git(core.BLENDER_IO)} tools/behaviour_pair_judge.py",
                    "x_ite": next((r.get("x_ite") for r in rows if r.get("x_ite")), None),
                    "browser": next((r.get("browser") for r in rows if r.get("browser")), None),
                    "wild_run": result["meta"]["selfcode"], "wall_seconds": round(time.time() - began, 1)},
           "summary": {"solutions": count(sols), "controls": count(ctrl)}, "pairs": rows}
    a.out.write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps(out["summary"], indent=1), out["meta"]["wall_seconds"])


if __name__ == "__main__":
    main()
