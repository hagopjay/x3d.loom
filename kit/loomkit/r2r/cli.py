"""R2R command line. Reached as `kit/loom r2r ...` or `python -m loomkit.r2r ...`.

  r2r run      MANIFEST --out DIR [--only TEXT] [--no-probe] [--rounds N] [--root NAME=PATH ...]
                 receipts in, a sealed run folder out: candidate rules, each with its proof and its grade
  r2r events   MANIFEST [--out FILE] [--root NAME=PATH ...]
                 only read the receipts: one failure event per line, and a count per instrument
  r2r show     RUN_DIR [RULE_ID]
                 the candidates of a run as a table, or one candidate in full
  r2r check    RUN_DIR FILE ... [--min-grade C|L|S] [--json]
                 use a run's candidate rules as a pre-flight check on files: which would fail which instrument
  r2r replay   RUN_DIR MANIFEST --out FILE [--map OLD=NEW ...] [--root NAME=PATH ...]
                 ask another version of an instrument about an old run's rules: closed by the fix, or still live
  r2r needs    RUN_DIR
                 where induction stopped and said why: the work list for a person, or later for a proposer
  r2r brief    RUN_DIR RULE_ID
                 the text a language model would be shown for one candidate (nothing is sent anywhere)
  r2r selftest [--seed N] [--only NAME] [--keep DIR] [--json]
                 hide a rule, hand the engine only receipts, see whether it comes back; and a tool with no rule

Exit 0: done, nothing flagged. Exit 1: `check` found a file a rule fires on, `replay` found a rule still live, or
`selftest` failed. Exit 2: a manifest, a run folder or an instrument could not be used. Survives `python -O`.

THE MANIFEST (loom.r2r-manifest/1) names every input of a run, so a run can be repeated from one file:

  {"schema": "loom.r2r-manifest/1", "title": "...", "notes": ["..."],
   "roots":    {"chaos": "/where/the/chaos/rounds/are", "repos": "/where/the/repositories/are"},
   "receipts": [{"adapter": "chaos", "path": "chaos:2.7.1-rng7", "seeds": "repos:x3d-blender-io/tests/golden",
                 "addon": "2.7.1", "runtime": "bpy 5.3.0", "split": "train", "what": "one line for the report"},
                {"adapter": "verdicts", "path": "sweep:2.7.1-import.jsonl", "instrument": "NAME AND VERSION",
                 "family": "natural-sweep", "split": "by-hash", "fail_split": "train"},
                {"adapter": "faultlab", "path": "repos:x3d.demo/fault-lab/v1"},
                {"adapter": "events", "path": "more-events.jsonl"}],
   "oracles":  [{"instrument": "NAME AND VERSION", "argv": ["python", "{driver:blender_io}", "--files-from", "{files}",
                 "--out", "{out}"], "hosts": {"family": "natural-sweep", "split": "train", "max_bytes": 60000, "cap": 120}}],
   "settings": {"rounds": 3, "seed": 1, "max_generations": 1, "min_failures": 1}}

A path is `ROOT:rest` for a root named in "roots" (or given with --root), else relative to the manifest's folder.
`"split": "by-hash"` sends a file to the held-out side when its sha256 is odd. In an oracle's argv, `{root:NAME}` is
that root's folder and `{driver:NAME}` is a driver shipped in loomkit/r2r/drivers.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
import tempfile
from pathlib import Path

from . import adapters, engine, plant, proposers
from .events import Case, Event, EventSet, write_events
from .oracles import CommandOracle
from .probe import Host
from .rule import Rule

MANIFEST_SCHEMA = "loom.r2r-manifest/1"
GRADE_ORDER = {"C": 0, "L": 1, "S": 2}


class UsageError(Exception):
    pass


# --- manifest -------------------------------------------------------------------------------------------------------

class Manifest:
    def __init__(self, path: Path, root_overrides: list[str] | None = None):
        self.path = Path(path)
        try:
            self.doc = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise UsageError(f"cannot read manifest {path}: {exc}") from None
        if self.doc.get("schema") != MANIFEST_SCHEMA:
            raise UsageError(f"{path}: schema must be {MANIFEST_SCHEMA}")
        self.roots = {k: str(self._abs(v)) for k, v in self.doc.get("roots", {}).items()}
        for item in root_overrides or []:
            name, _, where = item.partition("=")
            if not where:
                raise UsageError(f"--root wants NAME=PATH, not {item!r}")
            self.roots[name] = str(Path(where).resolve())

    def _abs(self, p: str) -> Path:
        q = Path(p)
        return q if q.is_absolute() else (self.path.parent / q).resolve()

    def resolve(self, p: str) -> str:
        head, sep, rest = p.partition(":")
        if sep and head in self.roots:
            return str(Path(self.roots[head]) / rest) if rest else self.roots[head]
        return str(self._abs(p))

    def rooted(self, p: str) -> str:
        for name, root in sorted(self.roots.items(), key=lambda kv: -len(kv[1])):
            if p == root or p.startswith(root.rstrip("/") + "/"):
                return f"{name}:{p[len(root.rstrip('/')) + 1:]}"
        return p

    # receipts ------------------------------------------------------------------------------------------------------
    def events(self, log=print) -> tuple[list[Event], list[dict]]:
        out: list[Event] = []
        inputs = []
        for n, spec in enumerate(self.doc.get("receipts", [])):
            kind, path = spec.get("adapter"), self.resolve(spec.get("path", ""))
            split = spec.get("split", "train")
            first = "train" if split == "by-hash" else split
            if kind == "chaos":
                evs = adapters.chaos(Path(path), Path(self.resolve(spec["seeds"])), addon=spec["addon"],
                                     runtime=spec.get("runtime", "bpy"), x3dpy=spec.get("x3dpy", "x3d.py"), split=first,
                                     verdicts=bool(spec.get("verdicts", False)))
                record = str(Path(path) / "rows.json")
            elif kind == "verdicts":
                evs = adapters.verdicts(Path(path), spec["instrument"], family=spec.get("family", "oracle"), split=first)
                for e in evs:
                    e.file = self.resolve(e.file)                  # rows may name files as ROOT:rest
                    e.twin = self.resolve(e.twin) if e.twin else None
                    e.group = e.group or f"{spec.get('family', 'oracle')}:{Path(e.file).name}"
                record = path
            elif kind == "faultlab":
                evs = adapters.faultlab(Path(path), **({"instrument": spec["instrument"]} if spec.get("instrument") else {}))
                record = str(Path(path) / "data" / "cases.json")
            elif kind == "events":
                evs = adapters.incidents(Path(path))
                for e in evs:
                    e.file = self.resolve(e.file)
                    e.twin = self.resolve(e.twin) if e.twin else None
                record = path
            elif kind == "failures":
                evs = adapters.failures(Path(path), spec.get("instrument_prefix", ""))
                record = path
            else:
                raise UsageError(f"{self.path}: receipts[{n}] has no known adapter ({kind!r}); "
                                 f"known: chaos, verdicts, faultlab, events, failures")
            if split == "by-hash" or spec.get("fail_split"):
                for e in evs:
                    if split == "by-hash" and Path(e.file).is_file():
                        odd = int(hashlib.sha256(Path(e.file).read_bytes()).hexdigest(), 16) % 2 == 1
                        e.split = "held" if odd else "train"
                    if e.outcome == "fail" and spec.get("fail_split"):
                        e.split = spec["fail_split"]
            out += evs
            inputs.append({"path": record, "adapter": kind, "what": spec.get("what", ""), "events": len(evs),
                           "split": split})
            log(f"[r2r] receipts[{n}] {kind}: {len(evs)} event(s) from {self.rooted(path)}")
        return out, inputs

    # oracles -------------------------------------------------------------------------------------------------------
    def oracles(self, es: EventSet, log=print) -> tuple[dict, dict]:
        oracles, hosts = {}, {}
        drivers = Path(__file__).resolve().parent / "drivers"
        for spec in self.doc.get("oracles", []):
            inst = spec["instrument"]
            argv = []
            for a in spec["argv"]:
                for name, root in self.roots.items():
                    a = a.replace("{root:" + name + "}", root)
                if "{driver:" in a:
                    name = a.split("{driver:", 1)[1].split("}", 1)[0]
                    a = a.replace("{driver:" + name + "}", str(drivers / f"{name}.py"))
                argv.append(a)
            oracles[inst] = CommandOracle(inst, argv, timeout=float(spec.get("timeout", 3600)))
            h = spec.get("hosts", {})
            picked, seen = [], set()
            for e in es.events:
                if e.instrument != inst or e.outcome != "pass":
                    continue
                if h.get("family") and e.family != h["family"]:
                    continue
                if h.get("split") and e.split != h["split"]:
                    continue
                data = Path(e.file).read_bytes()
                if len(data) > int(h.get("max_bytes", 60000)):
                    continue
                host = Host(self.rooted(e.file), data)
                if host.case is not None and host.key not in seen:
                    seen.add(host.key)
                    picked.append(host)
                if len(picked) >= int(h.get("cap", 120)):
                    break
            hosts[inst] = picked
            log(f"[r2r] oracle for {inst}: {len(picked)} host file(s) to plant probes in")
        return oracles, hosts


# --- run folders ------------------------------------------------------------------------------------------------------

def load_run(run_dir: Path) -> tuple[dict, list[dict], list[dict]]:
    run_dir = Path(run_dir)
    try:
        run_doc = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
        clusters = json.loads((run_dir / "clusters.json").read_text(encoding="utf-8"))
        cands = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((run_dir / "candidates").glob("*.json"))]
    except (OSError, ValueError) as exc:
        raise UsageError(f"{run_dir} is not a sealed R2R run: {exc}") from None
    cands.sort(key=lambda c: (GRADE_ORDER[c["grade"]["grade"]], c["instrument"], -c["sources_total"], c["id"]))
    return run_doc, clusters, cands


def _line(c: dict) -> str:
    p = c["proof"]
    a, h = p["audit"], p["held_out"]
    return (f"{c['grade']['grade']}  {c['id']}  src {p['sources']['explained_by_this_rule']:>3}/{p['sources']['failures']:<3} "
            f"probes {a['confirmed']:>2} ok {a['refuted']:>2} wrong  held {h['caught']:>2}/{h['failures']:<2} "
            f"false alarms {p['known_good']['false_alarms'] + h['false_alarms']}/{p['known_good']['passing_files'] + h['passing_files']}"
            f"  {c['grade']['closure']:<13} {c['signature'][:70]}"
            + "".join(f"\n     also explains, graded {x['grade']['grade']}: {x['signature'][:70]}" for x in c.get("also_explains", [])))


# --- commands ---------------------------------------------------------------------------------------------------------

def cmd_events(a) -> int:
    man = Manifest(a.manifest, a.root)
    evs, _inputs = man.events()
    es = EventSet(evs)
    for inst, n in es.counts().items():
        print(f"  {n['fail']:>6} fail  {n['pass']:>6} pass  {inst}")
    print(f"  {len(es.clusters())} cluster(s) of failures; {len(es.skipped)} event(s) skipped because the file is gone")
    if a.out:
        write_events(Path(a.out), es.events)
        print(f"  wrote {a.out}")
    return 0


def cmd_run(a) -> int:
    man = Manifest(a.manifest, a.root)
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        raise UsageError(f"{out} already has content; a run is sealed and never overwritten")
    evs, inputs = man.events()
    es = EventSet(evs)
    oracles, hosts = ({}, {}) if a.no_probe else man.oracles(es)
    st = man.doc.get("settings", {})
    work = Path(a.work) if a.work else Path(tempfile.mkdtemp(prefix="r2r-work-"))
    roots = dict(man.roots)
    roots["work"] = str(work)
    notes = list(man.doc.get("notes", []))
    if a.no_probe and man.doc.get("oracles"):
        notes.append("Run with --no-probe: the manifest's oracles were not asked anything.")
    engine.run(es, out, oracles=oracles, hosts=hosts, rounds=a.rounds or int(st.get("rounds", 3)),
                     seed=int(st.get("seed", 0)), only=a.only, inputs=inputs, title=man.doc.get("title", ""),
                     roots=roots, workdir=work, min_failures=int(st.get("min_failures", 1)),
                     max_generations=int(st.get("max_generations", 1)), notes=notes)
    (out / "manifest.json").write_text(json.dumps(man.doc, indent=1, sort_keys=True, ensure_ascii=False) + "\n",
                                       encoding="utf-8")
    print(f"[r2r] report: {out / 'REPORT.md'}")
    return 0


def cmd_show(a) -> int:
    run_doc, clusters, cands = load_run(a.run)
    if a.rule:
        hit = [c for c in cands if c["id"] == a.rule or c["id"].endswith(a.rule)]
        if len(hit) != 1:
            raise UsageError(f"{a.rule!r} names {len(hit)} candidates in {a.run}")
        print(json.dumps(hit[0], indent=1, sort_keys=True, ensure_ascii=False))
        return 0
    print(f"{run_doc.get('title') or a.run}: {run_doc['events']} events, {run_doc['clusters']} clusters, "
          f"{run_doc['candidates']} candidates ({run_doc['grades']['C']} C, {run_doc['grades']['L']} L, "
          f"{run_doc['grades']['S']} S), made {run_doc['created_utc']}")
    for c in cands:
        print(_line(c))
        print(f"       {c['sentence'][:200]}")
    return 0


def cmd_check(a) -> int:
    _run_doc, _clusters, cands = load_run(a.run)
    worst = GRADE_ORDER[a.min_grade]
    rules = [(Rule.from_json(c["rule"]), c) for c in cands if GRADE_ORDER[c["grade"]["grade"]] <= worst]
    rows, flagged = [], 0
    for f in a.files:
        try:
            case = Case(f, Path(f).read_bytes())
        except OSError as exc:
            raise UsageError(f"cannot read {f}: {exc}") from None
        hits = []
        for rule, c in rules:
            if rule.could_fire(case.bag):
                sites = rule.hits(case.sites)
                if sites:
                    hits.append({"rule": c["id"], "grade": c["grade"]["grade"], "instrument": c["instrument"],
                                 "signature": c["signature"], "where": [s.where for s in sites[:5]], "sites": len(sites),
                                 "sentence": c["sentence"]})
        flagged += bool(hits)
        rows.append({"file": f, "sha256": case.sha256, "hits": hits})
    if a.json:
        print(json.dumps({"schema": "loom.r2r-check/1", "run": str(a.run), "rules": len(rules), "min_grade": a.min_grade,
                          "files": rows}, indent=1, sort_keys=True, ensure_ascii=False))
    else:
        for r in rows:
            if not r["hits"]:
                print(f"ok    {r['file']}")
            for h in r["hits"]:
                print(f"FLAG  {r['file']}\n      [{h['grade']}] {h['rule']}: expect `{h['signature']}` from {h['instrument']}\n"
                      f"      at {', '.join(h['where'])}" + (f" (+{h['sites'] - 5} more)" if h["sites"] > 5 else "")
                      + f"\n      {h['sentence'][:220]}")
        print(f"{len(rows)} file(s), {flagged} flagged, by {len(rules)} candidate rule(s) of grade {a.min_grade} or better. "
              f"A flag is a candidate rule's prediction, not a validator's verdict.")
    return 1 if flagged else 0


def _read_events_gz(run_dir: Path) -> list[dict]:
    with gzip.open(Path(run_dir) / "events.jsonl.gz", "rt", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def cmd_replay(a) -> int:
    """Old rules, new instrument. Two questions per rule: (1) on the new instrument's own receipts, what happened to
    the files the rule fires on; (2) if the new instrument can be asked, what does it now say about the old failures
    and the old confirmed probes, rebuilt from their recipes."""
    run_doc, _clusters, cands = load_run(a.run)
    man = Manifest(a.manifest, a.root)
    mapping = dict(m.split("=", 1) for m in a.map or [])
    evs, _inputs = man.events()
    es = EventSet(evs)
    oracles, _hosts = man.oracles(es)
    old_events = {e["id"]: e for e in _read_events_gz(a.run)}
    probes = [json.loads(l) for l in (Path(a.run) / "probes.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    work = Path(tempfile.mkdtemp(prefix="r2r-replay-"))
    rows, live = [], 0
    for c in cands:
        rule = Rule.from_json(c["rule"])
        target = mapping.get(c["instrument"], c["instrument"])
        row = {"rule": c["id"], "grade": c["grade"]["grade"], "signature": c["signature"], "sentence": c["sentence"],
               "old_instrument": c["instrument"], "new_instrument": target,
               "also_explains": [x["signature"] for x in c.get("also_explains", [])]}
        # (1) receipts of the new instrument
        fired = {"pass": 0, "fail": 0}
        sigs: dict[str, int] = {}
        seen = set()
        for e in es.events:
            if e.instrument != target:
                continue
            ex = es.example(e)
            if ex.case.sha256 in seen or not (rule.could_fire(ex.case.bag) and rule.fires(ex.case.sites)):
                continue
            seen.add(ex.case.sha256)
            fired[e.outcome] += 1
            if e.outcome == "fail":
                sigs[e.signature] = sigs.get(e.signature, 0) + 1
        row["receipts"] = {"files_the_rule_fires_on": fired["pass"] + fired["fail"], "passed": fired["pass"],
                           "failed": fired["fail"], "failure_signatures": sigs}
        # (2) the new instrument asked directly
        oracle = oracles.get(target)
        asked = None
        if oracle is not None:
            # One question per distinct file. Asked: the old failures the rule explained, and the probes that confirmed
            # it. A file the new instrument's own receipts already answered is not asked, and not counted, again.
            claims = [c] + [x for x in c.get("also_explains", []) if x["instrument"] == c["instrument"]]
            by_sha: dict[str, tuple[str, str]] = {}
            source_shas = set()
            for s in (s for claim in claims for s in claim["sources"]):
                source_shas.add(s["sha256"])
                p = man.resolve(s["file"])
                if s["sha256"] not in seen and s["sha256"] not in by_sha and Path(p).is_file():
                    by_sha[s["sha256"]] = (p, "source failure")
            for p in probes:
                if not p.get("recipe") or p["sha256"] in seen or p["sha256"] in by_sha:
                    continue
                mine = p.get("rule") == c["id"] and p.get("verdict") == "confirmed"
                if not (mine or p["sha256"] in source_shas):     # a source may itself be a file an earlier probe built
                    continue
                host = man.resolve(p["host"])
                if not Path(host).is_file():
                    continue
                data = plant.apply(Path(host).read_bytes(), p["recipe"])
                if data is None or hashlib.sha256(data).hexdigest() != p["sha256"]:
                    continue                             # the host changed since: the probe cannot be rebuilt honestly
                f = work / f"{c['id']}-{p['sha256'][:16]}.x3d"
                f.write_bytes(data)
                by_sha[p["sha256"]] = (str(f), "confirmed probe, rebuilt" if mine else "source failure, rebuilt from its probe recipe")
            files = dict(by_sha.values())
            res = oracle.run(list(files), work / "oracle") if files else {}
            asked = {"files": len(files), "passed": 0, "failed": 0, "skipped": 0, "failure_signatures": {},
                     "of_which": {k: sum(1 for v in files.values() if v == k) for k in sorted(set(files.values()))}}
            for f in files:
                v = res.get(f, {})
                if v.get("outcome") == "pass":
                    asked["passed"] += 1
                elif v.get("outcome") == "fail":
                    asked["failed"] += 1
                    asked["failure_signatures"][v.get("signature", "")] = asked["failure_signatures"].get(v.get("signature", ""), 0) + 1
                else:
                    asked["skipped"] += 1
        row["asked"] = asked
        # the two counts are over different files (see `seen` above), so they add
        n_fail = row["receipts"]["failed"] + (asked["failed"] if asked else 0)
        n_pass = row["receipts"]["passed"] + (asked["passed"] if asked else 0)
        if n_fail:
            row["verdict"] = "still live" if not n_pass else "partly closed"
            live += 1
        elif n_pass >= 5:
            row["verdict"] = "closed"
        else:
            row["verdict"] = "not exercised"
        rows.append(row)
        print(f"{row['verdict']:<14} [{row['grade']}] {row['rule']}  now passes {n_pass}, still fails {n_fail}   {c['signature'][:60]}")
    out = {"schema": "loom.r2r-replay/1", "old_run": {"title": run_doc.get("title"), "created_utc": run_doc["created_utc"],
                                                       "kit": run_doc["kit"]["r2r_sha256"]},
           "kit": engine.kit_stamp(), "title": man.doc.get("title", ""), "instrument_map": mapping, "rules": rows,
           "summary": {v: sum(1 for r in rows if r["verdict"] == v) for v in ("closed", "partly closed", "still live", "not exercised")},
           "how_to_read": "closed: the new instrument passed at least 5 files this rule fires on and failed none. "
                          "still live: it failed every such file it was run on. A rule is about an instrument at a "
                          "version; 'closed' retires the rule for the new version and keeps it as a regression test."}
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(out, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"[r2r] wrote {a.out}")
    print("[r2r] " + ", ".join(f"{n} {k}" for k, n in out["summary"].items()))
    return 1 if live else 0


def cmd_needs(a) -> int:
    _run_doc, clusters, cands = load_run(a.run)
    todo = proposers.needs_a_proposer(cands, clusters)
    print(json.dumps({"schema": "loom.r2r-needs/1", "run": str(a.run), "open_questions": todo}, indent=1,
                     ensure_ascii=False))
    return 0


def cmd_brief(a) -> int:
    _run_doc, _clusters, cands = load_run(a.run)
    hit = [c for c in cands if c["id"] == a.rule or c["id"].endswith(a.rule)]
    if len(hit) != 1:
        raise UsageError(f"{a.rule!r} names {len(hit)} candidates in {a.run}")
    print(proposers.brief(hit[0]))
    return 0


def cmd_selftest(a) -> int:
    from . import selftest
    res = selftest.run(seed=a.seed, keep=Path(a.keep) if a.keep else None, only=a.only,
                       log=None if a.json else (lambda m: print(m) if a.verbose else None))
    print(json.dumps(res, indent=1, sort_keys=True) if a.json else selftest.table(res))
    return 0 if res["passed"] else 1


def parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="loom r2r", description="Receipt-to-rule engine: failure receipts in, candidate "
                                 "rules with proofs and grades out. Nothing here promotes a rule.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run"); p.add_argument("manifest"); p.add_argument("--out", required=True)
    p.add_argument("--only"); p.add_argument("--no-probe", action="store_true"); p.add_argument("--rounds", type=int)
    p.add_argument("--work"); p.add_argument("--root", action="append"); p.set_defaults(fn=cmd_run)
    p = sub.add_parser("events"); p.add_argument("manifest"); p.add_argument("--out")
    p.add_argument("--root", action="append"); p.set_defaults(fn=cmd_events)
    p = sub.add_parser("show"); p.add_argument("run"); p.add_argument("rule", nargs="?"); p.set_defaults(fn=cmd_show)
    p = sub.add_parser("check"); p.add_argument("run"); p.add_argument("files", nargs="+")
    p.add_argument("--min-grade", choices=("C", "L", "S"), default="L"); p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_check)
    p = sub.add_parser("replay"); p.add_argument("run"); p.add_argument("manifest"); p.add_argument("--out")
    p.add_argument("--map", action="append"); p.add_argument("--root", action="append"); p.set_defaults(fn=cmd_replay)
    p = sub.add_parser("needs"); p.add_argument("run"); p.set_defaults(fn=cmd_needs)
    p = sub.add_parser("brief"); p.add_argument("run"); p.add_argument("rule"); p.set_defaults(fn=cmd_brief)
    p = sub.add_parser("selftest"); p.add_argument("--seed", type=int, default=0); p.add_argument("--only")
    p.add_argument("--keep"); p.add_argument("--json", action="store_true"); p.add_argument("--verbose", action="store_true")
    p.set_defaults(fn=cmd_selftest)
    return ap


def main(argv: list[str] | None = None) -> int:
    try:
        a = parser().parse_args(argv)
    except SystemExit as exc:
        return 2 if exc.code else 0
    try:
        return a.fn(a)
    except (UsageError, FileExistsError, FileNotFoundError, KeyError) as exc:
        print(f"r2r: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
