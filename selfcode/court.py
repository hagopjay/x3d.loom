"""A second judge for a sample of solutions: X_ITE in headless Chromium, real mouse gestures (exploratory).

    NODE_PATH=<node_modules with playwright> python3 selfcode/court.py --x-ite <x_ite dist dir> [--per-family 2]

For each sampled test task the reference graph and the found graph are each woven into the stage, loaded in X_ITE,
and given the same gestures on the sensor's object: a click, two quick clicks, leave and return, a long hold. The
watched fields are read on every frame. Two runs agree when every sample of one has a sample of the other within
0.15 s whose values are within 0.05 (rotations compared as quaternions).

Controls that should disagree: each reference against the solution of the same family from another seed.
Look-alikes: short-lesson solutions that failed the simulator's unseen stimulus, to see whether the browser also
tells them from the reference.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import core            # noqa: E402
import tasks as T      # noqa: E402

CLICKED = ["slide", "glow", "turn", "fade", "toggle", "light-while", "two-targets", "start-on-press", "hide-while-pressed"]
SLACK, TOL, ALLOWED = 0.15, 0.05, 0.01


def numbers(value, field):
    if isinstance(value, bool):
        return [1.0 if value else 0.0]
    if isinstance(value, (int, float)):
        return [float(value)]
    v = [float(x) for x in str(value).replace(",", " ").split()]
    if field == "rotation":
        n = math.sqrt(sum(x * x for x in v[:3])) or 1.0
        s = math.sin(v[3] / 2)
        q = [v[0] / n * s, v[1] / n * s, v[2] / n * s, math.cos(v[3] / 2)]
        return q if q[3] >= 0 else [-x for x in q]
    return v


def outside(a, b, fields):
    """Share of the samples of ``a`` with no sample of ``b`` close in time and value."""
    if not a or not b:
        return 1.0
    b = [(t, [numbers(v, f) for v, f in zip(values, fields)]) for t, values in b]
    bad, j = 0, 0
    for t, values in a:
        mine = [numbers(v, f) for v, f in zip(values, fields)]
        while j < len(b) and b[j][0] < t - SLACK:
            j += 1
        k, ok = j, False
        while k < len(b) and b[k][0] <= t + SLACK:
            if all(abs(x - y) <= TOL for m, o in zip(mine, b[k][1]) for x, y in zip(m, o)):
                ok = True
                break
            k += 1
        bad += not ok
    return bad / len(a)


def judge(xite, watch, a, sensor_a, b, sensor_b, at=None):
    r = subprocess.run(["node", str(HERE / "court.cjs"), str(xite), ",".join(f"{d}.{f}" for d, f in watch), str(a), sensor_a, str(b), sensor_b]
                       + ([f"--at={at[0]},{at[1]}"] if at else []), capture_output=True, text=True, timeout=600)
    if r.returncode:
        return {"error": r.stderr[-400:]}
    out = json.loads(r.stdout.strip().splitlines()[-1])
    one, two = out["runs"]
    if one["sensorAt"] is None or two["sensorAt"] is None:
        return {"browser": out["browser"], "error": "the pointer never found the sensor"}
    fields = [f for _, f in watch]
    miss = max(outside(one["samples"], two["samples"], fields), outside(two["samples"], one["samples"], fields))
    moved = len({json.dumps(v) for _, v in one["samples"]}) > 1
    return {"browser": out["browser"], "sensor_at": [one["sensorAt"]["x"], one["sensorAt"]["y"]],
            "samples": [len(one["samples"]), len(two["samples"])], "outside": round(miss, 4),
            "agree": miss <= ALLOWED, "reference_moved": moved}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--x-ite", type=Path, required=True)
    ap.add_argument("--results", type=Path, default=HERE / "results")
    ap.add_argument("--per-family", type=int, default=2)
    ap.add_argument("--workers", type=int, default=3)
    a = ap.parse_args()
    results = json.loads((a.results / "results.json").read_text())
    rows = {r["id"]: r for r in results["test"]}
    stage_text = (HERE / "stage.x3d").read_text()
    tmp = Path(tempfile.mkdtemp())
    jobs = []

    def prepared(task):
        ref = task["reference"]
        sensor = next(n for n in ref["nodes"] if n[1] == "TouchSensor")
        path = tmp / f"{task['id']}.reference.x3d"
        path.write_text(core.build(ref).weave(stage_text))
        watch = sorted({(r[2], r[3]) for r in ref["routes"] if r[2] in ref["targets"]})
        return path, sensor[0], f"Touch_{sensor[2]}", watch

    by_family = {}
    for task in T.tasks(results["meta"]["test_seeds"]):
        by_family.setdefault(task["family"], []).append(task)
    for family in CLICKED:
        group = [t for t in by_family[family] if rows[t["id"]]["arms"]["long"]["solved"]]
        for n, task in enumerate(group[:a.per_family]):
            ref, ref_sensor, found_sensor, watch = prepared(task)
            found = a.results / "solutions" / f"{task['id']}.long.x3d"
            if f'DEF="{found_sensor}"' in found.read_text():
                jobs.append(("solution", task["id"], watch, ref, ref_sensor, found, found_sensor))
            if n == 0 and len(group) > 1:                      # a pair that should disagree
                other = group[-1]
                o_ref, o_sensor, o_found_sensor, o_watch = prepared(other)
                o_found = a.results / "solutions" / f"{other['id']}.long.x3d"
                if o_watch == watch and f'DEF="{o_found_sensor}"' in o_found.read_text():
                    jobs.append(("control", f"{task['id']} against {other['id']}", watch, ref, ref_sensor, o_found, o_found_sensor))
    for task in T.tasks(results["meta"]["test_seeds"]):
        short = rows[task["id"]]["arms"]["short"]
        if task["family"] in CLICKED and short["solved"] and not short["heldout"]:
            ref, ref_sensor, found_sensor, watch = prepared(task)
            found = a.results / "solutions" / f"{task['id']}.short.x3d"
            if f'DEF="{found_sensor}"' in found.read_text():
                jobs.append(("look-alike", task["id"], watch, ref, ref_sensor, found, found_sensor))

    where = {}                                     # the stage is the same in every pair, so each object is found once

    def work(job):
        kind, name, watch, ref, ref_sensor, found, found_sensor = job
        verdict = judge(a.x_ite, watch, ref, ref_sensor, found, found_sensor, where.get(found_sensor))
        if "sensor_at" in verdict:
            where.setdefault(found_sensor, verdict["sensor_at"])
        print(kind, name, verdict, flush=True)
        return {"kind": kind, "pair": name, "watch": [".".join(w) for w in watch], **verdict}

    first = {}
    for job in jobs:
        first.setdefault(job[6], job)
    out = [work(job) for job in first.values()]
    with ThreadPoolExecutor(a.workers) as pool:
        out += list(pool.map(work, [j for j in jobs if j not in first.values()]))
    ok = [o for o in out if "agree" in o]
    summary = {kind: {"judged": sum(1 for o in ok if o["kind"] == kind), "agree": sum(1 for o in ok if o["kind"] == kind and o["agree"]),
                      "could_not_judge": sum(1 for o in out if o["kind"] == kind and "agree" not in o)}
               for kind in ("solution", "control", "look-alike")}
    browser = next((o["browser"] for o in out if "browser" in o), None)
    (a.results / "court.json").write_text(json.dumps({"browser": browser, "slack_seconds": SLACK, "tolerance": TOL,
                                                      "allowed_outside": ALLOWED, "summary": summary, "pairs": out}, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
