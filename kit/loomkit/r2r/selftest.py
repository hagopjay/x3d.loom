"""The engine tested on itself: hide a rule, hand over only receipts, see whether the rule comes back.

Law 7 asks for a rule's tests on both sides. For a rule ENGINE the two sides are:

  FINDS     a hidden rule plays the tool. The engine sees which files failed and may ask the tool about new files.
            It never sees the rule. Afterwards both are run on a challenge set the engine never saw, and they must
            agree: the recovered rules must flag what the hidden rule flags and nothing else.
  REFUSES   a tool that fails at random, with no rule behind it. Whatever the engine proposes, nothing may be graded
            Confirmed or Likely.

The scenarios mirror the kinds of rule the real receipts hold: a value spelling that only matters where the tool reads
it, a size limit, a structural defect at one place. They run on synth.py's world, so the test needs no outside file and
no outside tool, and the same seed gives the same result on any machine.
"""
from __future__ import annotations

import hashlib
import json
import tempfile
import time
from pathlib import Path

from . import engine, synth
from .events import Case, Event, EventSet
from .oracles import FunctionOracle, RuleOracle
from .probe import Host
from .rule import Rule

MIN_RECALL, MIN_PRECISION = 0.9, 0.95

SCENARIOS = [
    {"name": "bool-reader",
     "story": "a tool that crashes on a boolean not spelt true/false, but only at the five attributes it reads",
     "hidden": Rule("attr", all=("v:bool_noncanonical",),
                    any=("at:Box@solid", "at:Sphere@solid", "at:IndexedFaceSet@solid", "at:DirectionalLight@on",
                         "at:TimeSensor@loop")),
     "ops": ("bool", "bool", "number", "drop", "index")},
    {"name": "nesting-limit",
     "story": "a tool that overflows its stack once nesting reaches 64 levels",
     "hidden": Rule("doc", all=("ge:depth_max:64",)),
     "ops": ("deep", "deep", "wide", "drop", "number"),
     "challenge_ops": ("deep-fine", "deep-fine", "deep-fine", "wide", "deep")},
    {"name": "index-reader",
     "story": "a tool that crashes when an IndexedFaceSet coordIndex points past its Coordinate list",
     "hidden": Rule("attr", all=("v:index_out_of_range", "at:IndexedFaceSet@coordIndex")),
     "ops": ("index", "index", "bool", "number", "drop")},
    {"name": "noise",
     "story": "a tool that fails one edited file in eight at random: there is no rule to find",
     "hidden": None,
     "ops": ("bool", "deep", "index", "number", "drop", "wide")},
]


def _noise_oracle(name: str, clean_shas: set) -> FunctionOracle:
    def fn(path: str):
        sha = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        if sha in clean_shas or int(sha[:8], 16) % 8:
            return "pass", ""
        return "fail", "random failure"
    return FunctionOracle(name, fn)


def run_scenario(sc: dict, work: Path, seed: int = 0, rounds: int = 3, log=None) -> dict:
    log = log or (lambda m: None)
    t0 = time.time()
    work.mkdir(parents=True, exist_ok=True)
    clean = synth.scenes(150, seed=seed * 101 + 7)
    receipts, host_scenes, held_scenes, challenge_scenes = clean[:60], clean[60:100], clean[100:125], clean[125:150]
    inst = f"selftest tool: {sc['name']}"
    signature = "hidden rule fired" if sc["hidden"] is not None else "random failure"
    if sc["hidden"] is not None:
        oracle = RuleOracle(inst, sc["hidden"], signature)
    else:
        oracle = _noise_oracle(inst, {hashlib.sha256(d).hexdigest() for d in clean})

    def write(kind: str, i: int, data: bytes) -> str:
        p = work / kind / f"{kind}-{i:04d}.x3d"
        p.parent.mkdir(exist_ok=True)
        p.write_bytes(data)
        return str(p)

    events: list[Event] = []
    for split, scenes_, per, mseed in (("train", receipts, 4, seed + 1), ("held", held_scenes, 4, seed + 2)):
        twins = [write(f"{split}-clean", i, d) for i, d in enumerate(scenes_)]
        muts = synth.mutants(scenes_, per, seed=mseed, ops=sc["ops"])
        files = [write(f"{split}-mutant", i, m["data"]) for i, m in enumerate(muts)]
        verdicts = oracle.run(twins + files, work / "label")
        for f in twins:
            events.append(Event(inst, "pass", f, group=f, family="selftest", split=split, note="clean scene"))
        for f, m in zip(files, muts):
            v = verdicts[f]
            events.append(Event(inst, v["outcome"], f, v["signature"], twin=twins[m["twin"]], group=twins[m["twin"]],
                                family="selftest", split=split, note=f"{m['op']}: {m['note']}", label=m["op"]))
    es = EventSet(events)
    hosts = [Host(f"host-{i:03d}", d) for i, d in enumerate(host_scenes)]
    out = work / "run"
    run_doc = engine.run(es, out, oracles={inst: oracle}, hosts={inst: hosts}, rounds=rounds, seed=seed,
                         title=f"self-test: {sc['story']}", workdir=work / "probe-work", log=log,
                         notes=["Synthetic world (loomkit.r2r.synth). Not evidence about any real tool."])
    cands = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((out / "candidates").glob("*.json"))]
    mine = [c for c in cands if c["signature"] == signature]
    rules = [Rule.from_json(c["rule"]) for c in mine]
    row = {"scenario": sc["name"], "story": sc["story"], "hidden": repr(sc["hidden"]) if sc["hidden"] else None,
           "training_failures": sum(1 for e in events if e.outcome == "fail" and e.split == "train"),
           "recovered": [{"rule": repr(r), "sentence": c["sentence"], "grade": c["grade"]["grade"],
                          "closure": c["grade"]["closure"]} for r, c in zip(rules, mine)],
           "grades": run_doc["grades"],
           "oracle_questions": sum(1 for p in (out / "probes.jsonl").read_text(encoding="utf-8").splitlines() if p)}
    if sc["hidden"] is not None:
        # the challenge: scenes and edits the engine never saw, judged by the hidden rule and by what was recovered
        chal = [m["data"] for m in synth.mutants(challenge_scenes, 12, seed=seed + 3,
                                                 ops=sc.get("challenge_ops", sc["ops"]))] + challenge_scenes
        tp = fp = fn = tn = 0
        graded = [r for r, c in zip(rules, mine) if c["grade"]["grade"] in ("C", "L")]
        for i, data in enumerate(chal):
            case = Case(f"challenge-{i}", data)
            truth = sc["hidden"].fires(case.sites)
            said = any(r.fires(case.sites) for r in graded)
            tp += truth and said
            fp += said and not truth
            fn += truth and not said
            tn += (not truth) and (not said)
        recall = tp / (tp + fn) if tp + fn else 0.0
        precision = tp / (tp + fp) if tp + fp else 0.0
        row.update(challenge={"files": len(chal), "flagged_by_both": tp, "false_alarms": fp, "missed": fn, "clean_by_both": tn,
                              "recall": round(recall, 3), "precision": round(precision, 3)},
                   passed=bool(graded) and recall >= MIN_RECALL and precision >= MIN_PRECISION,
                   bar=f"recall >= {MIN_RECALL} and precision >= {MIN_PRECISION} on the challenge, from rules graded C or L")
    else:
        row.update(passed=run_doc["grades"]["C"] == 0 and run_doc["grades"]["L"] == 0,
                   bar="nothing graded Confirmed or Likely")
    row["seconds"] = round(time.time() - t0, 1)
    return row


def run(seed: int = 0, keep: Path | None = None, only: str | None = None, rounds: int = 3, log=None) -> dict:
    rows = []
    with tempfile.TemporaryDirectory(prefix="r2r-selftest-") as tmp:
        base = Path(keep) if keep else Path(tmp)
        for sc in SCENARIOS:
            if only and only != sc["name"]:
                continue
            rows.append(run_scenario(sc, base / sc["name"], seed=seed, rounds=rounds, log=log))
    return {"schema": "loom.r2r-selftest/1", "seed": seed, "kit": engine.kit_stamp(), "scenarios": rows,
            "passed": all(r["passed"] for r in rows)}


def table(result: dict) -> str:
    lines = ["scenario        failures  rules (grade)        challenge: recall  precision  verdict"]
    for r in result["scenarios"]:
        g = ", ".join(x["grade"] for x in r["recovered"]) or "none"
        ch = r.get("challenge")
        mid = f"{ch['recall']:>17.3f}  {ch['precision']:>9.3f}" if ch else f"{'(no rule to find)':>28}"
        lines.append(f"{r['scenario']:<15} {r['training_failures']:>8}  {g:<20} {mid}  {'pass' if r['passed'] else 'FAIL'}")
    lines.append("self-test " + ("passed" if result["passed"] else "FAILED"))
    return "\n".join(lines)
