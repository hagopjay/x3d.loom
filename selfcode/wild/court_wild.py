"""The wild set in a real browser, second method: both files replayed at the same moment.

    python3 selfcode/wild/court_wild.py --roots <repository folders> --x-ite <x_ite dist> [--limit 12] [--seconds 6]

Why a second method (COURT.md, "Run 1"): in X_ITE a looping TimeSensor with startTime 0 takes its phase from the wall
clock, so two replays a few seconds apart are at different points of the loop and cannot be lined up unless a cycle
start falls inside the watch. And X_ITE reports one rotation in several axis-angle spellings (0 1 0 6.17 and
0 -1 0 0.11), which a number-by-number comparison calls different.

So here the original and the written scene are started together in two browsers and compared at the same instants of
X_ITE's own clock, with no alignment step: equal loops are in equal phase because the clock is the same. Rotations are
compared as rotations (the angle between them). The floor is measured the same way: the original against itself and
the written scene against itself, each started together.

Recording is x3d-blender-io's (tools/behaviour_pair_judge.py `record`, the page code of behaviour_sim_judge.cjs); the
comparison is this file's.

Per stream: a sample is outside when the two values differ by more than 2% of the stream's span (for a rotation: of
the widest angle it sweeps in the watch, and never less than 0.02 rad). Verdict per pair, fixed before the run:
  same      every stream's A-against-B share outside is at most its floor + 0.05
  differs   some stream's share is at least 0.20 and at least three times its floor
  unclear   anything else, and any pair in which no watched stream moved
"""
from __future__ import annotations

import argparse
import bisect
import concurrent.futures
import datetime
import glob
import json
import math
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import core            # noqa: E402

sys.path.insert(0, str(Path(core.BLENDER_IO) / "tools"))
import behaviour_pair_judge as judge          # noqa: E402

STEP, SHARE, SLACK, MIN_DIFF, TIMES = 0.05, 0.02, 0.05, 0.20, 3.0


def numbers(text):
    if isinstance(text, bool):
        return (float(text),)
    if isinstance(text, (int, float)):
        return (float(text),)
    s = str(text).strip().lower()
    if s in ("true", "false"):
        return (1.0 if s == "true" else 0.0,)
    return tuple(float(x) for x in s.replace(",", " ").replace("[", " ").replace("]", " ").split())


def together(files, seconds, x_ite):
    """Record the files at the same moment. Returns one trace per file."""
    def one(f):
        graph = judge._graph(f)
        sources = [[k[0], v] for k, v in judge.watched(graph).items()] + judge._extras(graph)
        with tempfile.TemporaryDirectory() as scratch:
            return judge.record(f, sources, {"seconds": seconds}, str(x_ite), scratch)
    with concurrent.futures.ThreadPoolExecutor(len(files)) as pool:
        return list(pool.map(one, files))


def streams(trace):
    out, skip = {}, set()
    for when, node, field, value in trace["events"]:
        if field in ("isActive", "cycleTime"):
            continue
        try:
            out.setdefault(f"{node}.{field}", []).append((when, numbers(value)))
        except ValueError:                                   # a stream of nodes (contacts, ...) is not compared
            out.pop(f"{node}.{field}", None)
            skip.add(f"{node}.{field}")
    for name in skip:
        out.pop(name, None)
    return out


def gap(a, b, rotation):
    if rotation:
        return core.bs._rotation_distance(a, b)
    return max(abs(x - y) for x, y in zip(a, b)) if len(a) == len(b) else float("inf")


def compare(ta, tb):
    """{stream: (share of samples outside, widest gap, samples)} at the same instants of X_ITE's clock."""
    sa, sb = streams(ta), streams(tb)
    out = {}
    for name in sorted(set(sa) & set(sb)):
        a, b = sa[name], sb[name]
        start, end = max(a[0][0], b[0][0]) + 0.2, min(a[-1][0], b[-1][0])
        if end - start < 1.0:
            continue
        rotation = name.endswith(".rotation") or name.endswith(".orientation")
        at = lambda rows, times, t: rows[max(0, bisect.bisect_right(times, t) - 1)][1]
        times_a, times_b = [r[0] for r in a], [r[0] for r in b]
        grid = [start + k * STEP for k in range(int((end - start) / STEP))]
        va, vb = [at(a, times_a, t) for t in grid], [at(b, times_b, t) for t in grid]
        if rotation:
            span = max(max(gap(v, va[0], True) for v in va), max(gap(v, vb[0], True) for v in vb))
            limit = max(SHARE * span, 0.02)
        else:
            flat = [x for v in va + vb for x in v]
            limit = max(SHARE * (max(flat) - min(flat)), 1e-9)
        gaps = [gap(x, y, rotation) for x, y in zip(va, vb)]
        out[name] = (round(sum(g > limit for g in gaps) / len(gaps), 4), round(max(gaps), 4), len(gaps))
    return out, sorted(set(sa) ^ set(sb))


def one(job):
    kind, row, a, b, seconds, x_ite = job
    began, load = time.time(), os.getloadavg()[0]
    try:
        ab, unmatched = compare(*together([a, b], seconds, x_ite))
        aa, _ = compare(*together([a, a], seconds, x_ite))
        bb, _ = compare(*together([b, b], seconds, x_ite))
        rows, verdict = [], "same"
        for name, (share, widest, n) in ab.items():
            floor = max(aa.get(name, (0, 0, 0))[0], bb.get(name, (0, 0, 0))[0])
            if share >= MIN_DIFF and share >= TIMES * floor:
                v = "differs"
            elif share <= floor + SLACK:
                v = "same"
            else:
                v = "unclear"
            rows.append({"stream": name, "verdict": v, "outside": share, "widest_gap": widest, "samples": n, "floor": floor,
                         "floor_widest_gap": max(aa.get(name, (0, 0, 0))[1], bb.get(name, (0, 0, 0))[1])})
        if not rows:
            verdict = "unclear"
        elif any(r["verdict"] == "differs" for r in rows):
            verdict = "differs"
        elif any(r["verdict"] == "unclear" for r in rows):
            verdict = "unclear"
        out = {"verdict": verdict, "streams": rows, "only_in_one_file": unmatched}
        if not rows:
            out["reason"] = "no watched stream moved in both files"
    except Exception as e:                                   # a tool error is a row, not a crash
        out = {"verdict": "error", "error": f"{type(e).__name__}: {str(e)[:300]}"}
    return dict(out, kind=kind, hash=row["hash"], source=row["source"], file=row["file"], load_before=round(load, 2),
                seconds=round(time.time() - began, 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roots", nargs="+", type=Path, required=True)
    ap.add_argument("--x-ite", type=Path, required=True)
    ap.add_argument("--limit", type=int, default=12)
    ap.add_argument("--seconds", type=float, default=6.0)
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
        jobs.append(("solution", row, found[0], str(written), a.seconds, a.x_ite))
        text = written.read_text()
        if " 3.14159265 " in text or ' 3.14159265"' in text:
            c = controls / f"{row['hash']}.six-decimals.x3d"
            c.write_text(text.replace(" 3.14159265", " 3.141593"))
            jobs.append(("control: half-turn key printed to six decimals", row, found[0], str(c), a.seconds, a.x_ite))
    began = time.time()
    rows = [one(j) for j in jobs]                            # one pair at a time: two browsers is the whole load
    git = lambda path: subprocess.run(["git", "-C", str(path), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    sols = [r for r in rows if r["kind"] == "solution"]
    ctrl = [r for r in rows if r["kind"] != "solution"]
    count = lambda rs: {v: sum(1 for r in rs if r["verdict"] == v) for v in ("same", "differs", "unclear", "error")}
    out = {"meta": {"date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"), "method": "simultaneous replay, rotations as rotations",
                    "rebuilt_in_wild_run": len(rebuilt), "sampled": len(sols), "sampling": "first by hash", "watch_seconds": a.seconds,
                    "recorder": f"x3d-blender-io@{git(core.BLENDER_IO)} tools/behaviour_pair_judge.py record()",
                    "x_ite": "X_ITE 16.8.1", "browser": judge.browser_version(), "wild_run": result["meta"]["selfcode"],
                    "rule": {"sample_step": STEP, "outside": "2% of span", "same": "share <= floor + 0.05",
                             "differs": "share >= 0.20 and >= 3 x floor"},
                    "wall_seconds": round(time.time() - began, 1)},
           "summary": {"solutions": count(sols), "controls": count(ctrl)}, "pairs": rows}
    a.out.write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps(out["summary"], indent=1), out["meta"]["wall_seconds"])


if __name__ == "__main__":
    main()
