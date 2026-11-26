"""The wild set: rebuild the behaviour of real scenes that nobody wrote for this test (PREREG.md in this folder).

    python3 selfcode/wild/wild.py --roots <folder> [<folder> ...] --x3d-mcp ../x3d_mcp --kernel-python <python> --split test

A scene qualifies when it has a ROUTE, no Script, and every behaviour node it uses is one the simulator runs. Its
behaviour is stripped out (`behaviour_graph.strip`), the original graph is the hidden reference, and the search sees
only what the watched fields did under the long lesson. Scenes are identified by a hash of their text with white space
removed, so a file copied between folders counts once.

Splits are fixed by that hash: scenes whose hash starts with 0-3 are the development split, the rest are the test split.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import multiprocessing
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import core            # noqa: E402
import kernel          # noqa: E402
import synth           # noqa: E402
from run import heldout, paired, rate, median, tuple_motif      # noqa: E402

BUDGET, SHARE = 400, 100
MAX_SECONDS = 200.0                 # a lesson longer than this (many touchable objects) is left out
MAX_WATCH = 200.0                   # the longest a world with nothing to poke is watched
TIME_LIMIT = 30                     # wall seconds per scene and arm; over it counts as a miss
NODES = core.bs.SIMULATED
core.EXACT = True                   # table numbers written in full


def digest(text):
    return hashlib.sha1(re.sub(r"\s+", "", text).encode()).hexdigest()


def candidates(roots):
    """Distinct qualifying scenes under the roots: {hash: path}, first path in sorted order wins."""
    import behaviour_catalogue as bc
    out = {}
    for root in roots:
        for path in sorted(Path(root).rglob("*.x3d")):
            parts = set(path.parts)
            if "node_modules" in parts or "selfcode" in parts or ".git" in parts:
                continue
            try:
                text = path.read_text(errors="ignore")
            except OSError:
                continue
            if "<ROUTE" not in text or "<Script" in text:
                continue
            used = {t for t in re.findall(r"<([A-Z][A-Za-z0-9]+)[ />]", text) if t in bc.NODES}
            if used - set(NODES):
                continue
            out.setdefault(digest(text), (path, Path(root).name))
    return out


def lesson(stage, reference):
    """The demonstration. A world whose original has no pointing sensor on an object the lesson can poke is only watched, for three and a half turns
    of its slowest clock (the search calls a value periodic only when it sees the period three times over). Any other world gets the
    long lesson of the registered experiment, unchanged."""
    own = [n for n in reference.nodes.values() if n.role == core.bg.BEHAVIOUR]
    if any(n.node_type in core.bs.POINTING and n.parent in stage.touchable for n in own):
        return core.long_script(stage)
    stage.touchable = []
    cycles = []
    for n in own:
        if n.node_type == "TimeSensor":
            try:
                cycles.append(float(n.fields.get("cycleInterval", 1.0)))
            except (TypeError, ValueError):
                cycles.append(1.0)
    return [], round(min(MAX_WATCH, max(3.0, 3.5 * max(cycles, default=1.0))), 2)


def unseen(stage, reference, program, seconds):
    """Does the written graph still agree with the original on a stimulus the search never saw? With objects to poke
    that is the held-out script of the registered experiment; with none it is the same world watched 1.7 times longer."""
    if stage.touchable:
        return heldout(stage, reference, program)
    longer = round(seconds * 1.7 + 0.35, 2)
    want, _ = core.run(reference, [], stage, longer)
    got, _ = core.run(core.build(program), [], stage, longer)
    return not core.same(want, got, stage, 0.02)


def idle(stage, reference):
    """Why a reference moved nothing the stage watches."""
    own = {k for k, n in reference.nodes.items() if n.role == core.bg.BEHAVIOUR}
    ends = {reference.nodes[r.to_id].node_type for r in reference.routes if r.to_id in reference.nodes and r.to_id not in own}
    if ends and not ends & set(core.WATCH):
        return "its behaviour ends only at node types the search does not watch"
    sensors = [n for k, n in reference.nodes.items() if k in own and n.node_type in core.bs.POINTING]
    if sensors and not any(n.parent in stage.touchable for n in sensors):
        return "its sensors sit on no named object the lesson can poke"
    return "the original does nothing under the lesson"


class TooSlow(Exception):
    pass


def _alarm(signum, frame):
    raise TooSlow()


def task(job):
    """One scene under both arms. Returns a record."""
    key, (path, source), memory = job
    row = {"hash": key[:12], "file": str(path), "source": source, "status": None}
    try:
        text = Path(path).read_text(errors="ignore")
        reference = core.bg.Behaviour.from_x3d(text)
        bare = core.bg.strip(text)
        stage = core.Stage(bare)
        script, seconds = lesson(stage, reference)
        if seconds > MAX_SECONDS:
            return dict(row, status="left out: the lesson would be too long (many objects to poke)")
        signal.signal(signal.SIGALRM, _alarm)
        signal.alarm(TIME_LIMIT)
        try:
            demo, _ = core.run(reference, script, stage, seconds)
        except TooSlow:
            return dict(row, status="left out: the reference alone takes too long to simulate")
        finally:
            signal.alarm(0)
        fields = core.changed(demo, stage)
        if not fields:
            return dict(row, status="left out: " + idle(stage, reference))
        row.update(status="task", touchable=len(stage.touchable), fields=len(fields), lesson_seconds=seconds,
                   reference_nodes=sum(1 for n in reference.nodes.values() if n.role == core.bg.BEHAVIOUR), arms={})
        for arm, mem in (("cold", None), ("warm", memory)):
            s = synth.Synth(stage, script, seconds, demo, memory=list(mem) if mem else None, budget=BUDGET, share=SHARE)
            t0 = time.time()
            signal.alarm(TIME_LIMIT)
            try:
                program, left = s.solve()
                slow = False
            except TooSlow:
                program, left, slow = None, fields, True
            finally:
                signal.alarm(0)
            rec = {"solved": program is not None, "sims": s.sims, "seconds": round(time.time() - t0, 2), "from_memory": s.from_memory,
                   "left": len(left), "nodes": len(program["nodes"]) if program else None, "timed_out": slow}
            if program:
                rec["heldout"] = unseen(stage, reference, program, seconds)
                rec["x3d"] = core.build(program).weave(bare)
            row["arms"][arm] = rec
        return row
    except Exception as e:                                  # a scene the tools cannot read is a finding, not a crash
        return dict(row, status=f"left out: the tools cannot read it ({type(e).__name__})", error=str(e)[:120])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roots", nargs="+", type=Path, required=True)
    ap.add_argument("--x3d-mcp", type=Path, required=True)
    ap.add_argument("--kernel-python", default=sys.executable)
    ap.add_argument("--split", choices=["dev", "test"], required=True)
    ap.add_argument("--limit", type=int, default=0, help="first N scenes of the split in hash order (0 = all)")
    ap.add_argument("--out", type=Path, default=HERE / "results")
    ap.add_argument("--workers", type=int, default=max(1, multiprocessing.cpu_count()))
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    began = time.time()
    found = candidates(a.roots)
    chosen = sorted(k for k in found if (k[0] in "0123") == (a.split == "dev"))
    if a.limit:
        chosen = chosen[:a.limit]
    memory = [tuple_motif(m["shape"]) for m in json.loads((HERE.parent / "results" / "results.json").read_text())["memory"]]
    rows = []
    with multiprocessing.Pool(a.workers, maxtasksperchild=8) as pool:
        pending = [(k, pool.apply_async(task, ((k, found[k], memory),))) for k in chosen]
        for k, r in pending:
            try:
                rows.append(r.get(timeout=TIME_LIMIT * 4 + 60))
            except multiprocessing.TimeoutError:
                rows.append({"hash": k[:12], "file": str(found[k][0]), "source": found[k][1], "status": "task", "timed_out": True, "fields": None,
                             "arms": {arm: {"solved": False, "sims": BUDGET, "seconds": None, "from_memory": 0, "left": None, "nodes": None}
                                      for arm in ("cold", "warm")}})
            if len(rows) % 25 == 0:
                print(f"{len(rows)}/{len(chosen)}", flush=True)

    # kernel: the original scene and each written scene, same checks
    tmp = a.out / f"woven-{a.split}"
    tmp.mkdir(exist_ok=True)
    paths = {}
    for row in rows:
        if row["status"] != "task":
            continue
        paths[(row["hash"], "original")] = Path(row["file"])
        for arm, rec in row["arms"].items():
            if rec.get("x3d"):
                p = tmp / f"{row['hash']}.{arm}.x3d"
                p.write_text(rec.pop("x3d"))
                paths[(row["hash"], arm)] = p
    verdicts = kernel.check(paths.values(), a.x3d_mcp.resolve(), a.kernel_python)
    for row in rows:
        if row["status"] != "task":
            continue
        base = verdicts[str(paths[(row["hash"], "original")])]
        row["original_kernel"] = {"xsd_errors": base["xsd_errors"], "errors": base["errors"]}
        for arm, rec in row["arms"].items():
            if (row["hash"], arm) in paths:
                v = verdicts[str(paths[(row["hash"], arm)])]
                rec["kernel_new_errors"] = sorted(set(v["errors"]) - set(base["errors"]))
                rec["kernel_new_xsd_errors"] = max(0, v["xsd_errors"] - base["xsd_errors"])
    for row in rows:
        row["file"] = "/".join(Path(row["file"]).parts[-4:])          # no local paths in the record

    tasks = [r for r in rows if r["status"] == "task"]
    left_out = {}
    for r in rows:
        if r["status"] != "task":
            reason = r["status"][len("left out: "):]
            left_out[reason] = left_out.get(reason, 0) + 1

    def arm(name):
        solved = [r for r in tasks if r["arms"][name]["solved"]]
        return {"solved": rate([r["arms"][name]["solved"] for r in tasks]),
                "solved_and_heldout": rate([bool(r["arms"][name]["solved"] and r["arms"][name]["heldout"]) for r in tasks]),
                "kernel_no_new_errors": rate([not r["arms"][name].get("kernel_new_errors") and not r["arms"][name].get("kernel_new_xsd_errors")
                                              for r in solved]),
                "median_sims_solved": median([r["arms"][name]["sims"] for r in solved]),
                "median_nodes_minus_reference": median([r["arms"][name]["nodes"] - r["reference_nodes"] for r in solved])}

    def size(lo, hi):
        g = [r for r in tasks if r.get("reference_nodes") is not None and lo <= r["reference_nodes"] <= hi]
        return rate([bool(r["arms"]["cold"]["solved"] and r["arms"]["cold"]["heldout"]) for r in g])

    known = [r for r in tasks if r.get("fields")]
    fields = {"rebuilt": sum(r["fields"] - (r["arms"]["cold"]["left"] if r["arms"]["cold"]["left"] is not None else r["fields"]) for r in known),
              "of": sum(r["fields"] for r in known)}
    both = [r for r in tasks if r["arms"]["cold"]["solved"] and r["arms"]["warm"]["solved"]]
    by_repo = {}
    for r in tasks:
        repo = r["source"]
        b = by_repo.setdefault(repo, {"tasks": 0, "correct": 0})
        b["tasks"] += 1
        b["correct"] += bool(r["arms"]["cold"]["solved"] and r["arms"]["cold"]["heldout"])
    git = lambda path, *args: subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True).stdout.strip()
    result = {"meta": {"date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"), "split": a.split, "budget_sims": BUDGET,
                       "first_share": SHARE, "candidates_all_splits": len(found), "scenes_in_split": len(chosen), "time_limit_seconds": TIME_LIMIT,
                       "corpus": {Path(root).name: git(root, "rev-parse", "--short", "HEAD") for root in a.roots},
                       "simulator": f"x3d-blender-io@{git(core.BLENDER_IO, 'rev-parse', '--short', 'HEAD')} source/behaviour_sim.py",
                       "kernel": f"x3d_mcp@{git(a.x3d_mcp, 'rev-parse', '--short', 'HEAD')} (X3D 4.0 XSD + semantic checks)",
                       "selfcode": git(HERE.parent.parent, "rev-parse", "--short", "HEAD"), "memory_shapes": len(memory),
                       "model_calls": 0, "people_in_the_loop": 0, "wall_seconds": round(time.time() - began, 1)},
              "summary": {"tasks": len(tasks), "left_out": left_out, "timed_out": sum(1 for r in tasks if r.get("timed_out") or r["arms"]["cold"].get("timed_out")),
                          "cold": arm("cold"), "warm": arm("warm"),
                          "memory": paired([r["arms"]["cold"]["sims"] for r in both], [r["arms"]["warm"]["sims"] for r in both]),
                          "recalled_from_memory": sum(1 for r in both if r["arms"]["warm"]["from_memory"]), "by_repository": by_repo,
                          "by_size_of_original": {"1-3 nodes": size(1, 3), "4-10 nodes": size(4, 10), "11+ nodes": size(11, 10 ** 9)},
                          "fields_matched_on_the_lesson": fields},
              "scenes": rows}
    (a.out / f"wild-{a.split}.json").write_text(json.dumps(result, indent=1))
    print(json.dumps(result["summary"], indent=1))


if __name__ == "__main__":
    main()
