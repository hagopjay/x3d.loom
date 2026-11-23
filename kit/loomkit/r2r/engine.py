"""The whole pipeline for one run: cluster, induce, probe where an oracle exists, prove, grade, seal.

A run writes a folder and never writes into one that already has content:

    run.json                    loom.r2r-run/1: inputs, instruments, settings, counts, the kit that spoke
    candidates/<rule id>.json   loom.rule-candidate/1: the rule, its sentence, its proof, its grade, its sources
    clusters.json               every (instrument, signature) cluster: rules, residue, best unclean efforts, merges
    events.jsonl.gz             every failure event the run read or made (probes included)
    probes.jsonl                every probe: host, edit, what the rule said, what the instrument did
    REPORT.md                   the same, for a person

Every candidate is written with "status": "candidate" and "promoted": false. Promotion to a trap, a law join or a
validator rule is a person's act, recorded elsewhere; this module has no code path that does it.
"""
from __future__ import annotations

import datetime
import gzip
import hashlib
import json
import time
from pathlib import Path

from . import RULE_SCHEMA, RUN_SCHEMA, VERSION
from .events import EventSet
from .grade import grade
from .probe import build_problem, refine
from .prove import prove
from .uom import facts


def kit_stamp() -> dict:
    pkg = Path(__file__).resolve().parent
    h = hashlib.sha256()
    for f in sorted(pkg.glob("*.py")) + sorted((pkg / "drivers").glob("*.py")):
        h.update(f.name.encode() + b"\0" + f.read_bytes() + b"\0")
    stamp = {"r2r_version": VERSION, "r2r_sha256": h.hexdigest(), "uom_facts": facts().source}
    try:
        from ..core import kit_stamp as loom_stamp
        stamp["loomkit"] = loom_stamp()
    except Exception as exc:   # a copied r2r folder without the rest of loomkit still stamps itself
        stamp["loomkit"] = {"error": f"{type(exc).__name__}: {exc}"[:120]}
    return stamp


def _sha(path: str) -> str | None:
    try:
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()
    except OSError:
        return None


def run(es: EventSet, out_dir: Path, oracles: dict | None = None, hosts: dict | None = None, rounds: int = 3,
        seed: int = 0, only: str | None = None, inputs: list | None = None, title: str = "", roots: dict | None = None,
        workdir: Path | None = None, min_failures: int = 1, max_generations: int = 1, notes: list | None = None,
        log=print, proposer=None) -> dict:
    """`proposer` is where candidate rules come from (proposers.py). The default is plain induction; whatever a
    proposer returns goes through the same probes, proof and grade."""
    if proposer is None:
        from .proposers import InductiveProposer
        proposer = InductiveProposer()
    out_dir = Path(out_dir)
    if out_dir.exists() and any(out_dir.iterdir()):
        raise FileExistsError(f"{out_dir} already has content; a run is sealed and never overwritten")
    (out_dir / "candidates").mkdir(parents=True)
    workdir = Path(workdir) if workdir else out_dir / "_work"
    oracles, hosts, roots = oracles or {}, hosts or {}, roots or {}
    t_start = time.time()
    stamp = kit_stamp()                # the kit that speaks is the kit as it stood when the run began

    def rel(p: str | None) -> str | None:
        if not p:
            return p
        for name, root in sorted(roots.items(), key=lambda kv: -len(kv[1])):
            if p.startswith(root.rstrip("/") + "/"):
                return f"{name}:{p[len(root.rstrip('/')) + 1:]}"
        return p

    clusters_out, probes_out, summary = [], [], {"C": 0, "L": 0, "S": 0}
    written: dict[str, dict] = {}      # rule id -> its candidate, so a rule that recurs is one candidate with two claims
    clusters = es.clusters()
    done: set = set()
    queue = [(k, 0) for k in clusters]
    n = 0
    while queue:
        (inst, sig), generation = queue.pop(0)
        if (inst, sig) in done:
            continue
        done.add((inst, sig))
        evs = [e for e in es.events if e.outcome == "fail" and e.instrument == inst and e.signature == sig]
        train = [e for e in evs if e.split == "train"]
        if only and generation == 0 and only not in sig and only not in inst:
            continue
        if len(train) < min_failures or sig.startswith("instrument died"):
            continue
        n += 1
        t0 = time.time()
        log(f"[r2r] cluster {n}: {inst} | {sig} | {len(train)} training failure(s)"
            + (" | first seen in a probe" if generation else ""))
        oracle = oracles.get(inst)
        history: list = []
        if oracle is not None and hosts.get(inst):
            wd = workdir / f"c{n:03d}"
            ind, history = refine(es, inst, sig, oracle, hosts[inst], wd, rounds=rounds, seed=seed,
                                  log=lambda m: log(f"[r2r]   {m}"), induce=proposer.propose)
        else:
            ind = proposer.propose(build_problem(es, inst, sig))
        for line in ind.log:
            log(f"[r2r]   {line}")
        rule_ids = []
        for cand in ind.candidates:
            proof = prove(es, ind, cand, history)
            g = grade(proof)
            rid = cand.rule.rid()
            rule_ids.append(rid)
            sources = []
            for ex in cand.covered[:200]:
                e = ex.event
                sources.append({"event": e.id, "file": rel(e.file), "sha256": ex.case.sha256, "twin": rel(e.twin),
                                "family": e.family, "note": e.note, "receipt": {**e.source, "path": rel(e.source.get("path"))}
                                if e.source else None})
            claim = {"instrument": inst, "signature": sig, "grade": g, "proof": proof, "sources": sources,
                     "sources_total": len(cand.covered)}
            if rid in written:
                # The same rule explains a second signature (two lines of one function, say). A rule has one id and
                # one file, so the second claim goes beside the first: never a second count, never an overwrite.
                doc = written[rid]
                doc.setdefault("also_explains", []).append(claim)
            else:
                summary[g["grade"]] += 1
                doc = written[rid] = {
                    "schema": RULE_SCHEMA, "id": rid, "status": "candidate", "promoted": False,
                    "rule": cand.rule.to_json(), "sentence": cand.rule.sentence(), **claim,
                    "made_by": {"engine": "loomkit.r2r", "version": VERSION, "proposer": proposer.name,
                                "proposer_uses_a_model": bool(proposer.uses_model)}}
            (out_dir / "candidates" / f"{rid}.json").write_text(
                json.dumps(doc, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
            log(f"[r2r]   {g['grade']} {rid} {cand.rule!r}"[:400])
            for why in g["reasons"]:
                log(f"[r2r]       {why}")
        for h in history:
            for p in h["probes"]:
                probes_out.append({"instrument": inst, "signature": sig, "round": h["round"], "fed_back": h["fed_back"], **p})
        merges = []
        for cand in ind.candidates:
            for other, hit in cand.strays.items():
                total = len({es.example(e).case.sha256 for e in clusters.get((inst, other), []) if e.split == "train"})
                if total and hit / total >= 0.8:
                    merges.append({"rule": cand.rule.rid(), "also_explains": other, "of_its_failures": f"{hit}/{total}"})
        if history and generation < max_generations:
            # a probe may fail in a way no receipt showed: that is a new cluster, and it gets its own turn
            for key in es.clusters(inst):
                if key not in done and key not in [q[0] for q in queue]:
                    queue.append((key, generation + 1))
        clusters = es.clusters()
        clusters_out.append({
            "found_by": "a probe of another cluster" if generation else "receipts",
            "instrument": inst, "signature": sig, "training_failures": len(ind.problem.pos),
            "training_events": len(train), "held_out_events": sum(1 for e in evs if e.split == "held"),
            "rules": rule_ids, "residue": len(ind.residue),
            "residue_examples": [ex.event.note or rel(ex.case.path) for ex in ind.residue[:5]],
            "unclean_best_efforts": [{"rule": c.rule.to_json(), "sentence": c.rule.sentence(), "explains": len(c.covered),
                                      "false_alarms": c.false_alarms, "why": c.trace[-1] if c.trace else ""}
                                     for c in ind.unclean[:3]],
            "same_root_cause_hints": merges, "probed": bool(history), "seconds": round(time.time() - t0, 1),
            "log": ind.log})
    run_doc = {
        "schema": RUN_SCHEMA, "title": title, "created_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "kit": stamp, "settings": {"rounds": rounds, "seed": seed, "only": only, "max_generations": max_generations},
        "notes": (notes or []) + ([] if kit_stamp()["r2r_sha256"] == stamp["r2r_sha256"] else [
            "THE KIT CHANGED WHILE THIS RUN WAS GOING: the stamp is of the code at the start. Do not cite this run."]),
        "inputs": [{**i, "sha256": _sha(i["path"]) if i.get("path") else None, "path": rel(i.get("path"))} for i in (inputs or [])],
        "instruments": es.counts(),
        "proposer": {"name": proposer.name, "uses_a_model": bool(proposer.uses_model)},
        "oracles": {k: {"calls": getattr(v, "calls", None),
                        "deaths": [{"file": rel(d.get("file")), "exit": d.get("exit")} for d in getattr(v, "deaths", [])]}
                    for k, v in oracles.items()},
        "events": len(es.events), "files_read": len(es.corpus), "events_skipped": es.skipped[:20],
        # candidates are distinct rules, graded by their first claim; claims count a rule once per signature it explains
        "clusters": len(clusters_out), "candidates": len(written), "grades": summary,
        "claims": sum(len(c["rules"]) for c in clusters_out),
        "seconds": round(time.time() - t_start, 1),
    }
    (out_dir / "run.json").write_text(json.dumps(run_doc, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    (out_dir / "clusters.json").write_text(json.dumps(clusters_out, indent=1, sort_keys=True, ensure_ascii=False) + "\n",
                                           encoding="utf-8")
    with open(out_dir / "probes.jsonl", "w", encoding="utf-8") as f:
        for p in probes_out:
            f.write(json.dumps(p, sort_keys=True, ensure_ascii=False) + "\n")
    with gzip.open(out_dir / "events.jsonl.gz", "wt", encoding="utf-8") as f:
        for e in es.events:
            d = e.to_json()
            d["file"], d["twin"] = rel(d["file"]), rel(d["twin"])
            if d.get("source", {}).get("path"):
                d["source"] = {**d["source"], "path": rel(d["source"]["path"])}
            f.write(json.dumps(d, sort_keys=True, ensure_ascii=False) + "\n")
    from .report import write_report
    write_report(out_dir)
    log(f"[r2r] sealed {out_dir}: {run_doc['candidates']} candidate(s) in {run_doc['clusters']} cluster(s): "
        f"{summary['C']} Confirmed, {summary['L']} Likely, {summary['S']} Suspected; {run_doc['seconds']} s")
    return run_doc
