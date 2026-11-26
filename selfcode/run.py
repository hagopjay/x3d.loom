"""Run the pre-registered experiment (PREREG.md) and write results/results.json.

    python3 selfcode/run.py --x3d-mcp ../x3d_mcp --kernel-python <python with the fork's requirements>

Needs the x3d-blender-io checkout (env X3D_BLENDER_IO, default ../x3d-blender-io) for the behaviour graph, its
simulator and the X3DUOM catalogue. No model is called and nothing is sent anywhere.
"""
from __future__ import annotations

import argparse
import datetime
import json
import math
import multiprocessing
import random
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import core            # noqa: E402
import kernel          # noqa: E402
import synth           # noqa: E402
import tasks as T      # noqa: E402

BUDGET = 1000                      # simulator runs per task
LEARN, TEST = [1, 2, 3], [4, 5, 6, 7, 8, 9]
ORDER_SEED = 2026
WILD = ["door", "counter", "snake"]
STAGE_TEXT = (HERE / "stage.x3d").read_text()


def attempt(stage, script, seconds, demo, memory):
    s = synth.Synth(stage, script, seconds, demo, memory=list(memory) if memory else None, budget=BUDGET)
    t0 = time.time()
    program, left = s.solve()
    return program, s, {"solved": program is not None, "sims": s.sims, "seconds": round(time.time() - t0, 2),
                        "nodes": len(program["nodes"]) if program else None, "routes": len(program["routes"]) if program else None,
                        "offered": s.offered, "typed": s.typed, "fresh": s.fresh, "late": s.late, "memorised": s.memorised,
                        "from_memory": s.from_memory, "new_motifs": [list(map(list_or, m)) for m in s.new_motifs] if program else [],
                        "left": [list(k) for k in left]}


def list_or(x):
    return list(x) if isinstance(x, tuple) else x


def tuple_motif(m):
    return tuple(tuple(tuple(y) if isinstance(y, list) else y for y in x) if isinstance(x, list) else x for x in m)


def heldout(stage, reference, program):
    script, seconds = core.heldout_script(stage)
    want, _ = core.run(reference, script, stage, seconds)
    got, _ = core.run(core.build(program), script, stage, seconds)
    return not core.same(want, got, stage, 0.02)


def one(job):
    """One task under one arm, in a worker. Returns (task id, arm, record, program)."""
    task, arm, memory = job
    stage = core.Stage(STAGE_TEXT)
    reference = core.build(task["reference"])
    script, seconds = core.train_script(stage) if arm == "short" else core.long_script(stage)
    demo, _ = core.run(reference, script, stage, seconds)
    program, _, record = attempt(stage, script, seconds, demo, memory)
    if program:
        record["heldout"] = heldout(stage, reference, program)
    return task["id"], arm, record, program


def wilson(k, n, z=1.96):
    if not n:
        return [None, None]
    p, d = k / n, 1 + z * z / n
    mid, half = (p + z * z / (2 * n)) / d, z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(mid - half, 3), round(mid + half, 3)]


def rate(records):
    k, n = sum(1 for r in records if r), len(records)
    return {"k": k, "n": n, "rate": round(k / n, 3) if n else None, "ci95": wilson(k, n)}


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    return None if not n else (xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2)


def paired(cold, warm):
    """Paired comparison of simulator runs. Wilcoxon signed-rank, one-sided (warm < cold), when scipy is present;
    an exact sign test always."""
    pairs = [(c, w) for c, w in zip(cold, warm)]
    less, more = sum(1 for c, w in pairs if w < c), sum(1 for c, w in pairs if w > c)
    n = less + more
    sign_p = sum(math.comb(n, k) for k in range(less, n + 1)) / 2 ** n if n else None
    out = {"pairs": len(pairs), "warm_cheaper": less, "warm_dearer": more, "ties": len(pairs) - n, "sign_test_p": sign_p,
           "median_cold": median([c for c, _ in pairs]), "median_warm": median([w for _, w in pairs]),
           "total_cold": sum(c for c, _ in pairs), "total_warm": sum(w for _, w in pairs),
           "median_ratio": median([c / w for c, w in pairs]),
           "median_bits_saved": median([math.log2(c / w) for c, w in pairs])}
    try:
        from scipy.stats import wilcoxon
        out["wilcoxon_p"] = float(wilcoxon([c for c, _ in pairs], [w for _, w in pairs], alternative="greater").pvalue) if n else None
    except ImportError:
        out["wilcoxon_p"] = None
    return out


def git(path, *args):
    return subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True).stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--x3d-mcp", type=Path, required=True)
    ap.add_argument("--kernel-python", default=sys.executable)
    ap.add_argument("--out", type=Path, default=HERE / "results")
    ap.add_argument("--workers", type=int, default=max(1, multiprocessing.cpu_count() - 1))
    ap.add_argument("--smoke", action="store_true", help="development seed only, six families: a plumbing check, not a result")
    a = ap.parse_args()
    global LEARN, TEST
    keep = None
    if a.smoke:
        LEARN, TEST, keep = [0], [0], {"slide", "toggle", "hover", "two-targets", "drag-damped", "start-on-press"}
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "solutions").mkdir(exist_ok=True)
    began = time.time()
    pool = multiprocessing.Pool(a.workers)

    # -- learning: every task alone, then the same tasks in one fixed order with a memory that grows ----------------
    learn = [t for t in T.tasks(LEARN) if not keep or t['family'] in keep]
    random.Random(ORDER_SEED).shuffle(learn)
    alone = {tid: rec for tid, _, rec, _ in pool.imap_unordered(one, [(t, "long", None) for t in learn])}
    stage = core.Stage(STAGE_TEXT)
    script, seconds = core.long_script(stage)
    memory, uses, curve = [], {}, []
    for t in learn:
        reference = core.build(t["reference"])
        demo, _ = core.run(reference, script, stage, seconds)
        program, s, rec = attempt(stage, script, seconds, demo, memory)
        if program:
            for m in s.new_motifs + s.used:
                uses[m] = uses.get(m, 0) + 1
            memory = sorted(uses, key=lambda m: -uses[m])       # the shapes that solved most are tried first
        curve.append({"id": t["id"], "family": t["family"], "in_vocabulary": t["in_vocabulary"], "alone": alone[t["id"]],
                      "with_memory": rec, "memory_size": len(memory)})
        print(f"learn {t['id']:24s} alone {alone[t['id']]['sims']:5d}  with memory {rec['sims']:5d}  memory {len(memory)}", flush=True)
    frozen = list(memory)

    # -- test: seeds the method has never met ---------------------------------------------------------------------------
    test = [t for t in T.tasks(TEST) if not keep or t['family'] in keep]
    jobs = [(t, arm, frozen if arm == "warm" else None) for t in test for arm in ("short", "long", "warm")]
    rows = {t["id"]: {"id": t["id"], "family": t["family"], "seed": t["seed"], "in_vocabulary": t["in_vocabulary"],
                      "gltf_core": t["gltf_core"], "reference_nodes": len(t["reference"]["nodes"]), "arms": {}} for t in test}
    files = {}
    done = 0
    for tid, arm, rec, program in pool.imap_unordered(one, jobs):
        rows[tid]["arms"][arm] = rec
        if program:
            path = a.out / "solutions" / f"{tid}.{arm}.x3d"
            path.write_text(core.build(program).weave(STAGE_TEXT))
            files[(tid, arm)] = path
        done += 1
        if done % 30 == 0:
            print(f"test {done}/{len(jobs)}", flush=True)
    verdicts = kernel.check(files.values(), a.x3d_mcp.resolve(), a.kernel_python)
    for (tid, arm), path in files.items():
        v = verdicts[str(path)]
        rows[tid]["arms"][arm]["kernel"] = {"xsd_errors": v["xsd_errors"], "errors": v["errors"], "warnings": v["warnings"]}

    # -- the node editor's own test worlds --------------------------------------------------------------------------------
    wild = []
    for name in ([] if a.smoke else WILD):
        path = Path(core.BLENDER_IO) / "tests" / "behaviour" / f"{name}.x3d"
        if not path.exists():
            continue
        text = path.read_text()
        reference = core.bg.Behaviour.from_x3d(text)
        bare = core.bg.strip(text)
        wstage = core.Stage(bare)
        wscript, wseconds = core.long_script(wstage)
        demo, _ = core.run(reference, wscript, wstage, wseconds)
        row = {"world": name, "fields_that_change": len(core.changed(demo, wstage)),
               "reference_nodes": sum(1 for n in reference.nodes.values() if n.role == core.bg.BEHAVIOUR), "arms": {}}
        for arm, mem in (("long", None), ("warm", frozen)):
            program, _, rec = attempt(wstage, wscript, wseconds, demo, mem)
            if program:
                rec["heldout"] = heldout(wstage, reference, program)
                out = a.out / "solutions" / f"wild-{name}.{arm}.x3d"
                out.write_text(core.build(program).weave(bare))
                v = kernel.check([out], a.x3d_mcp.resolve(), a.kernel_python)[str(out)]
                rec["kernel"] = v
                rec["graph"] = core.build(program).explain().splitlines()
            row["arms"][arm] = rec
        wild.append(row)
        print(f"wild {name}: " + ", ".join(f"{k} {'solved' if v['solved'] else 'missed'} in {v['sims']}" for k, v in row["arms"].items()), flush=True)
    pool.close()

    # -- scoring ---------------------------------------------------------------------------------------------------------
    test_rows = [rows[t["id"]] for t in test]
    inside = [r for r in test_rows if r["in_vocabulary"]]
    outside = [r for r in test_rows if not r["in_vocabulary"]]

    def arm_summary(group, arm):
        solved = [r for r in group if r["arms"][arm]["solved"]]
        return {"solved": rate([r["arms"][arm]["solved"] for r in group]),
                "heldout_given_solved": rate([r["arms"][arm]["heldout"] for r in solved]),
                "solved_and_heldout": rate([r["arms"][arm]["solved"] and r["arms"][arm]["heldout"] for r in group]),
                "kernel_clean_given_solved": rate([not r["arms"][arm]["kernel"]["xsd_errors"] and not r["arms"][arm]["kernel"]["errors"]
                                                   for r in solved]),
                "kernel_warnings": sorted({w for r in solved for w in r["arms"][arm]["kernel"]["warnings"]}),
                "median_sims_solved": median([r["arms"][arm]["sims"] for r in solved]),
                "median_nodes_minus_reference": median([r["arms"][arm]["nodes"] - r["reference_nodes"] for r in solved])}

    both = [r for r in inside if r["arms"]["long"]["solved"] and r["arms"]["warm"]["solved"]]
    families = {}
    for r in test_rows:
        f = families.setdefault(r["family"], {"in_vocabulary": r["in_vocabulary"], "n": 0, "short": 0, "short_heldout": 0, "long": 0,
                                              "long_heldout": 0, "warm": 0, "warm_heldout": 0, "sims_long": [], "sims_warm": []})
        f["n"] += 1
        for arm in ("short", "long", "warm"):
            rec = r["arms"][arm]
            f[arm] += rec["solved"]
            f[arm + "_heldout"] += bool(rec["solved"] and rec["heldout"])
        f["sims_long"].append(r["arms"]["long"]["sims"])
        f["sims_warm"].append(r["arms"]["warm"]["sims"])
    searched = [r["arms"]["long"] for r in inside if r["arms"]["long"]["solved"] and r["arms"]["long"]["typed"]]
    summary = {
        "in_vocabulary": {arm: arm_summary(inside, arm) for arm in ("short", "long", "warm")},
        "out_of_vocabulary": {arm: arm_summary(outside, arm) for arm in ("short", "long", "warm")},
        "memory": {"motifs": len(frozen), "in_vocabulary_solved_in_both": paired([r["arms"]["long"]["sims"] for r in both],
                                                                                [r["arms"]["warm"]["sims"] for r in both]),
                   "all_test_tasks": paired([r["arms"]["long"]["sims"] for r in test_rows], [r["arms"]["warm"]["sims"] for r in test_rows])},
        "pruning": {"tasks": len(searched), "offered": sum(s["offered"] for s in searched), "typed": sum(s["typed"] for s in searched),
                    "fresh": sum(s["fresh"] for s in searched), "late": sum(s["late"] for s in searched),
                    "memorised_tables_refused": sum(s["memorised"] for s in searched)},
        "gltf_core": {"test_tasks": len(test_rows), "statable": sum(1 for r in test_rows if r["gltf_core"]),
                      "note": "glTF 2.0 core has keyframed translation, rotation, scale and morph weights, with no event, sensor "
                              "or trigger. A task counts as statable only when it is a free-running loop of those."},
        "families": families,
        "learning_curve": {"alone_total": sum(c["alone"]["sims"] for c in curve), "with_memory_total": sum(c["with_memory"]["sims"] for c in curve)},
    }
    result = {"meta": {"date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"), "budget_sims": BUDGET,
                       "learn_seeds": LEARN, "test_seeds": TEST, "sample_step_seconds": core.DT, "workers": a.workers,
                       "kernel": f"x3d_mcp@{git(a.x3d_mcp, 'rev-parse', '--short', 'HEAD')} (X3D 4.0 XSD + semantic checks)",
                       "simulator": f"x3d-blender-io@{git(core.BLENDER_IO, 'rev-parse', '--short', 'HEAD')} source/behaviour_sim.py",
                       "selfcode": git(HERE.parent, "rev-parse", "--short", "HEAD"), "dirty": bool(git(HERE.parent, "status", "--porcelain", "selfcode")),
                       "model_calls": 0, "people_in_the_loop": 0, "wall_seconds": round(time.time() - began, 1)},
              "summary": summary, "memory": [{"uses": uses[m], "shape": list(map(list_or, m))} for m in frozen], "learn": curve, "test": test_rows, "wild": wild}
    (a.out / "results.json").write_text(json.dumps(result, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
