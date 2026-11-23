"""Two-sided controls for loomkit.r2r (the receipt-to-rule engine), run under normal Python and `python -O`.

Every control has a side that must pass and a side that must be caught in the INTENDED way; a negative that passes
raises SURVIVING_CONTROL, and any other exception is a broken test, not a catch (law 19). Fixtures are synthetic and
labelled so (loomkit.r2r.synth): they exercise the real engine and are not evidence about any real tool.

What is controlled:
  vocabulary   each sampled literal is absent from its clean fixture and present, at the right place, in its failing one
  rules        matching, negation, thresholds, OR-groups, stable ids, JSON round trip; proposals outside the language refused
  events       bad events refused, signatures normalised, the before/after difference finds the one edit
  grades       the table: what earns C, and each single flaw that must take C away (law 32: a model's say-so is never C)
  engine       FINDS a hidden rule from receipts alone (three kinds of rule) and REFUSES to grade noise above Suspected
  ledger       a sealed run is never overwritten, never promotes, and every probe can be rebuilt from its recipe
  seam         the DSPy proposer is a socket that refuses to run
  cli          run, show, check and replay end to end through `loom r2r`, with a stand-in instrument

  python3 -I kit/tests/test_r2r.py            # runs both modes and writes kit/tests/r2r-last-run.json
"""
from __future__ import annotations

import contextlib
import copy
import hashlib
import io
import json
import subprocess
import sys
import tempfile
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))

from loomkit import cli as loom_cli  # noqa: E402
from loomkit.r2r import adapters, engine, grade as grading, plant, proposers, selftest, synth  # noqa: E402
from loomkit.r2r.events import Case, Event, EventSet, diff_sites, normalise_signature, write_events  # noqa: E402
from loomkit.r2r.rule import Rule  # noqa: E402


def need(cond, code: str, detail: str = "") -> None:
    if not cond:
        raise RuntimeError(f"{code}: {detail}")


def expect_raises(kind, fragment: str, fn) -> dict:
    try:
        fn()
    except kind as e:
        if fragment not in str(e):
            raise RuntimeError(f"WRONG_DIAGNOSTIC: wanted {fragment!r} in {e!r}") from None
        return {"expected": f"{kind.__name__}: {fragment}", "caught": type(e).__name__}
    raise RuntimeError(f"SURVIVING_CONTROL: {kind.__name__} {fragment}")


def world(body: str) -> bytes:
    return f'<X3D profile="Immersive" version="4.0"><Scene>{body}</Scene></X3D>'.encode()


def has(data: bytes, literal: str, tag: str, attr: str | None) -> bool:
    return any(s.el is not None and s.el.tag == tag and s.attr == attr and literal in s.lits for s in Case("t", data).sites)


IFS = '<Shape><IndexedFaceSet coordIndex="{}"><Coordinate point="0 0 0 1 0 0 0 1 0"/></IndexedFaceSet></Shape>'
VOCAB = [  # literal, node, attribute, clean body, failing body
    ("v:bool_noncanonical", "Box", "solid", '<Shape><Box solid="true"/></Shape>', '<Shape><Box solid="TRUE"/></Shape>'),
    ("v:index_out_of_range", "IndexedFaceSet", "coordIndex", IFS.format("0 1 2 -1"), IFS.format("0 1 5 -1")),
    ("v:above_max", "Material", "transparency", '<Shape><Appearance><Material transparency="0.5"/></Appearance></Shape>',
     '<Shape><Appearance><Material transparency="1.5"/></Appearance></Shape>'),
    ("v:below_min", "Sphere", "radius", '<Shape><Sphere radius="1"/></Shape>', '<Shape><Sphere radius="-1"/></Shape>'),
    ("v:arity_short", "Transform", "translation", '<Transform translation="1 2 3"/>', '<Transform translation="1 2"/>'),
    ("v:number_unparseable", "Transform", "translation", '<Transform translation="1 2 3"/>', '<Transform translation="1 2 x"/>'),
    ("v:nonfinite", "Transform", "translation", '<Transform translation="0 0 0"/>', '<Transform translation="NaN 0 0"/>'),
    ("v:use_undefined", "Shape", "USE", '<Shape DEF="A"/><Shape USE="A"/>', '<Shape USE="Nope"/>'),
    ("v:def_duplicate", "Group", "DEF", '<Group DEF="A"/><Group DEF="B"/>', '<Group DEF="A"/><Group DEF="A"/>'),
    ("v:route_node_undefined", "ROUTE", "fromNode",
     '<TimeSensor DEF="A"/><PositionInterpolator DEF="B"/><ROUTE fromNode="A" fromField="fraction_changed" toNode="B" toField="set_fraction"/>',
     '<ROUTE fromNode="A" fromField="fraction_changed" toNode="B" toField="set_fraction"/>'),
    ("v:unknown_attr", "Box", "wobble", '<Shape><Box size="1 1 1"/></Shape>', '<Shape><Box wobble="1"/></Shape>'),
    ("v:enum_violation", "Appearance", "alphaMode", '<Shape><Appearance alphaMode="BLEND"/></Shape>',
     '<Shape><Appearance alphaMode="SHINY"/></Shape>'),
    ("x:sfnode_multiple", "Material", None, '<Shape><Appearance><Material/></Appearance></Shape>',
     '<Shape><Appearance><Material/><Material/></Appearance></Shape>'),
    ("x:unknown_node", "Blorb", None, '<Group/>', '<Blorb/>'),
    ("x:misfiled", "Material", None, '<Shape><Appearance><Material/></Appearance></Shape>', '<Shape><Material/></Shape>'),
]


def vocab_controls() -> list:
    rows = []
    for literal, tag, attr, clean, failing in VOCAB:
        c, f = has(world(clean), literal, tag, attr), has(world(failing), literal, tag, attr)
        need(not c and f, "VOCAB_NOT_TWO_SIDED", f"{literal}: clean={c} failing={f}")
        rows.append({"literal": literal, "at": f"{tag}@{attr}" if attr else tag, "clean_fixture": c, "failing_fixture": f})
    # a value with a non-number in it is not "all zero" (found while writing these controls)
    need(not has(world('<Transform translation="NaN 0 0"/>'), "v:all_zero", "Transform", "translation"), "ALL_ZERO_WITH_NAN")
    doc = [s for s in Case("t", world("<Group><Group><Group/></Group></Group>")).sites if s.kind == "doc"][0]
    need(doc.nums["depth_max"] == 5, "DEPTH_MAX", str(doc.nums))        # X3D, Scene and three Groups
    return rows


def rule_controls() -> list:
    rows = []
    bad = Case("t", world('<Shape><Box solid="TRUE"/></Shape><Shape><Sphere solid="TRUE"/></Shape>'))
    ok = Case("t", world('<Shape><Box solid="true"/></Shape>'))
    r = Rule("attr", all=("v:bool_noncanonical", "at:Box@solid"))
    need(r.fires(bad.sites) and not r.fires(ok.sites), "RULE_MATCH")
    need(len(r.hits(bad.sites)) == 1, "RULE_FENCE", "the Sphere is outside the fence")
    wide = Rule("attr", all=("v:bool_noncanonical",), any=("at:Box@solid", "at:Sphere@solid"))
    need(len(wide.hits(bad.sites)) == 2, "RULE_ANY_GROUP")
    need(not Rule("attr", all=("v:bool_noncanonical", "!v:case_variant")).fires(bad.sites), "RULE_NEGATION")
    deep = Case("t", world("<Group>" * 9 + "</Group>" * 9))
    need(Rule("doc", all=("ge:depth_max:11",)).fires(deep.sites) and not Rule("doc", all=("ge:depth_max:12",)).fires(deep.sites),
         "RULE_THRESHOLD")
    again = Rule.from_json(json.loads(json.dumps(wide.to_json())))
    need(again == wide and again.rid() == wide.rid() and wide.rid().startswith("r2r-"), "RULE_ROUND_TRIP")
    need(Rule("attr", all=("at:Box@solid", "v:bool_noncanonical")).rid() == r.rid(), "RULE_ID_ORDER_FREE")
    need("boolean" in r.sentence() and "Box solid" in r.sentence(), "RULE_SENTENCE", r.sentence())
    rows.append({"case": "match, fence, OR-group, negation, threshold, JSON round trip, order-free id, sentence", "result": "ok"})
    good = proposers.validate_proposal({"kind": "attr", "all": ["v:bool_noncanonical", "at:Box@solid"]})
    need(good == r, "PROPOSAL_ACCEPTED")
    rows.append({"case": "proposal: context only", **expect_raises(ValueError, "at least one test literal",
                 lambda: proposers.validate_proposal({"kind": "attr", "all": ["at:Box@solid", "n:Box"]}))})
    rows.append({"case": "proposal: not the rule language", **expect_raises(ValueError, "not a literal",
                 lambda: proposers.validate_proposal({"kind": "attr", "all": ["__import__('os').system('true')"]}))})
    rows.append({"case": "proposal: no kind", **expect_raises(ValueError, "a proposal is",
                 lambda: proposers.validate_proposal({"all": ["v:present"]}))})
    return rows


def event_controls() -> list:
    rows = []
    rows.append({"case": "event: outcome not pass or fail", **expect_raises(ValueError, "outcome must be",
                 lambda: Event("tool", "skip", "f.x3d"))})
    rows.append({"case": "event: unknown observer", **expect_raises(ValueError, "observed must be",
                 lambda: Event("tool", "fail", "f.x3d", observed="vibes"))})
    a = normalise_signature("ValueError: could not convert '3.x' at /home/someone/work/thing/a.py line 412")
    b = normalise_signature("ValueError: could not convert 'true' at /srv/other/place/thing/a.py line 9")
    need(a == b, "SIGNATURE_NORMALISED", f"{a!r} != {b!r}")
    clean = world('<Transform DEF="A" translation="1 2 3"><Shape><Box solid="true"/></Shape></Transform><Group/>')
    edit = world('<Transform DEF="A" translation="1 2 3"><Shape><Box solid="TRUE"/></Shape></Transform><Group/>')
    d = [t for t in diff_sites(Case("e", edit), Case("c", clean)) if t[0].kind == "attr"]
    need(len(d) == 1 and d[0][0].attr == "solid" and "v:bool_noncanonical" in d[0][1], "DIFF_FINDS_THE_EDIT", str(len(d)))
    moved = world('<Group/><Transform DEF="A" translation="1 2 3"><Shape><Box solid="true"/></Shape></Transform><Group/>')
    d2 = [t for t in diff_sites(Case("m", moved), Case("c", clean)) if t[0].kind == "attr"]
    need(not d2, "DIFF_IGNORES_A_SHIFT", f"an inserted sibling made {len(d2)} attribute(s) look changed")
    with tempfile.TemporaryDirectory() as td:
        v = Path(td) / "v.jsonl"
        v.write_text('{"file": "a.x3d", "outcome": "pass"}\n{"file": "b.x3d", "outcome": "skip"}\n'
                     '{"file": "c.x3d", "outcome": "fail", "signature": "Boom at x.py:3 f"}\n')
        evs = adapters.verdicts(v, "tool 1.0")
        need([e.outcome for e in evs] == ["pass", "fail"], "VERDICTS_SKIP_IS_NOT_A_VERDICT")
        f = Path(td) / "gone.x3d"
        es = EventSet([Event("tool 1.0", "fail", str(f), "Boom")])
        need(not es.events and es.skipped, "MISSING_FILE_IS_SKIPPED_AND_SAID")
    rows.append({"case": "signature normalised; one-edit difference found; shifted siblings ignored; skip rows and "
                         "missing files are not verdicts", "result": "ok"})
    return rows


CLEAN_PROOF = {
    "instrument": "tool 1.0", "tier": 1, "vocabulary_gap": False, "degenerate_fired_on": [], "probe_rounds": [{"round": 1}],
    "sources": {"failures": 20, "explained_by_this_rule": 20, "observed_by": {"tool": 20}},
    "known_good": {"passing_files": 200, "false_alarms": 0},
    "held_out": {"failures": 0, "caught": 0, "passing_files": 0, "false_alarms": 0, "missed_examples": []},
    "audit": {"probes": 20, "confirmed": 8, "refuted": 0, "missed": 0, "silent_ok": 12},
}


def grade_controls() -> list:
    rows = []

    def g(**changes):
        p = copy.deepcopy(CLEAN_PROOF)
        for path, v in changes.items():
            a, b = path.split("__")
            p[a][b] = v
        return grading.grade(p)

    need(g()["grade"] == "C" and g()["closure"] == "closed-so-far", "GRADE_C", str(g()))
    held = g(audit__confirmed=0, audit__probes=0, held_out__failures=10, held_out__caught=10, held_out__passing_files=100)
    need(held["grade"] == "C", "GRADE_C_BY_HELD_OUT", str(held))
    flaws = [
        ("one refuted audit prediction", {"audit__refuted": 1}, "S"),
        ("one false alarm on a known-good file", {"known_good__false_alarms": 1}, "S"),
        ("one held-out false alarm", {"held_out__false_alarms": 1}, "S"),
        ("failures reported by a model (law 32)", {"sources__observed_by": {"model": 20}}, "S"),
        ("a sliver of a cluster and no probe", {"sources__explained_by_this_rule": 2, "sources__failures": 48,
                                                "audit__confirmed": 0, "audit__probes": 0}, "S"),
        ("one failure and no probe", {"sources__explained_by_this_rule": 1, "sources__failures": 1, "audit__confirmed": 0}, "S"),
        ("failures authored by a person", {"sources__observed_by": {"authored": 20}}, "L"),
        ("too few known-good files", {"known_good__passing_files": 12}, "L"),
        ("nothing unseen confirmed it", {"audit__confirmed": 2}, "L"),
    ]
    for name, changes, want in flaws:
        got = g(**changes)
        if got["grade"] == "C":
            raise RuntimeError(f"SURVIVING_CONTROL: {name} still graded C")
        need(got["grade"] == want, "WRONG_GRADE", f"{name}: wanted {want}, got {got['grade']}")
        rows.append({"case": name, "expected": want, "caught": got["grade"], "reason": got["reasons"][0]})
    p = copy.deepcopy(CLEAN_PROOF); p["tier"] = 4
    need(grading.grade(p)["grade"] == "S", "FINGERPRINT_IS_S")
    p = copy.deepcopy(CLEAN_PROOF); p["degenerate_fired_on"] = ["empty file"]
    need(grading.grade(p)["grade"] == "S", "DEGENERATE_IS_S")
    need(g(audit__missed=3)["closure"] == "open" and g(audit__missed=3)["grade"] == "C", "CLOSURE_IS_SEPARATE")
    rows.append({"case": "fingerprint and degenerate firing are S; closure is reported beside the grade", "result": "ok"})
    return rows


def engine_controls(td: Path) -> tuple[list, dict]:
    """FINDS and REFUSES, through the whole pipeline. Returns the rows and the kept bool-reader run for later controls."""
    rows = []
    kept = {}
    for sc in selftest.SCENARIOS:
        r = selftest.run_scenario(sc, td / sc["name"], seed=0, rounds=3 if sc["hidden"] is not None else 2)
        if sc["hidden"] is not None:
            need(r["passed"], "HIDDEN_RULE_NOT_RECOVERED", json.dumps(r)[:600])
            rows.append({"case": f"finds: {sc['name']}", "hidden": r["hidden"], "recovered": [x["rule"] for x in r["recovered"]],
                         "grades": [x["grade"] for x in r["recovered"]], "challenge": r["challenge"],
                         "word_for_word": [x["rule"] for x in r["recovered"]] == [r["hidden"]]})
        else:
            if r["grades"]["C"] or r["grades"]["L"]:
                raise RuntimeError(f"SURVIVING_CONTROL: noise was graded {r['grades']}")
            rows.append({"case": "refuses: a tool that fails at random", "expected": "nothing above Suspected",
                         "caught": r["grades"], "training_failures": r["training_failures"]})
        kept[sc["name"]] = td / sc["name"] / "run"
    return rows, kept


def ledger_controls(run_dir: Path) -> list:
    rows = []
    cands = [json.loads(p.read_text()) for p in sorted((run_dir / "candidates").glob("*.json"))]
    need(cands and all(c["status"] == "candidate" and c["promoted"] is False for c in cands), "NEVER_PROMOTES")
    need(all(c["made_by"]["proposer_uses_a_model"] is False for c in cands), "PROPOSER_RECORDED")
    for name in ("run.json", "clusters.json", "probes.jsonl", "events.jsonl.gz", "REPORT.md"):
        need((run_dir / name).is_file(), "LEDGER_FILE_MISSING", name)
    need("THE KIT CHANGED" not in (run_dir / "run.json").read_text(), "KIT_STABLE_DURING_RUN")
    es = EventSet([])
    rows.append({"case": "sealed run folder is never overwritten", **expect_raises(FileExistsError, "sealed",
                 lambda: engine.run(es, run_dir, log=lambda m: None))})
    # every probe can be rebuilt from its host and its recipe, to the byte
    hosts = {f"host-{i:03d}": d for i, d in enumerate(synth.scenes(150, seed=7)[60:100])}
    probes = [json.loads(l) for l in (run_dir / "probes.jsonl").read_text().splitlines() if l.strip()]
    rebuilt = 0
    for p in probes:
        data = plant.apply(hosts[p["host"]], p["recipe"])
        need(data is not None and hashlib.sha256(data).hexdigest() == p["sha256"], "PROBE_NOT_REBUILDABLE", p["probe"])
        rebuilt += 1
    need(rebuilt >= 20, "TOO_FEW_PROBES", str(rebuilt))
    rows.append({"case": "every probe rebuilt from host + recipe to the same sha256", "result": f"{rebuilt} of {len(probes)}"})
    rows.append({"case": "plant.apply refuses an unknown recipe", **expect_raises(ValueError, "not a plant recipe",
                 lambda: plant.apply(b"<X3D/>", ["os.system", "true"]))})
    rows.append({"case": "the DSPy proposer is a socket, not a runner", **expect_raises(RuntimeError, "designed seam",
                 lambda: proposers.DSPyProposer().propose(None))})
    todo = proposers.needs_a_proposer(cands, json.loads((run_dir / "clusters.json").read_text()))
    need(isinstance(todo, list) and "Current rule" in proposers.brief(cands[0]), "SEAM_HELPERS")
    return rows


def cli_controls(td: Path) -> list:
    """`loom r2r run | show | check | replay` end to end, with drivers/rule_tool.py standing in for a real tool."""
    rows = []
    hidden = Rule("attr", all=("v:bool_noncanonical",), any=("at:Box@solid", "at:Sphere@solid", "at:DirectionalLight@on"))
    inst, fixed = "stand-in tool 1.0", "stand-in tool 1.1 (fixed)"
    w = td / "cli"
    (w / "clean").mkdir(parents=True); (w / "mut").mkdir(); (w / "host").mkdir()
    clean = synth.scenes(110, seed=41)
    events, events_fixed = [], []
    for i, d in enumerate(clean[:60]):
        (w / "clean" / f"c{i:03d}.x3d").write_bytes(d)
        events.append(Event(inst, "pass", f"clean/c{i:03d}.x3d", family="receipts", group=f"c{i}"))
    for i, d in enumerate(clean[60:110]):
        (w / "host" / f"h{i:03d}.x3d").write_bytes(d)
        events.append(Event(inst, "pass", f"host/h{i:03d}.x3d", family="hosts", group=f"h{i}"))
    flagged_file = clean_file = None
    for i, m in enumerate(synth.mutants(clean[:60], 4, seed=5, ops=("bool", "bool", "number", "drop"))):
        f = f"mut/m{i:03d}.x3d"
        (w / f).write_bytes(m["data"])
        fail = hidden.fires(Case(f, m["data"]).sites)
        flagged_file = flagged_file or (str(w / f) if fail else None)
        clean_file = clean_file or (None if fail else str(w / f))
        events.append(Event(inst, "fail" if fail else "pass", f, "hidden rule fired" if fail else "",
                            twin=f"clean/c{m['twin']:03d}.x3d", family="receipts", group=f"c{m['twin']}", note=m["note"]))
        events_fixed.append(Event(fixed, "pass", f, twin=f"clean/c{m['twin']:03d}.x3d", family="receipts", group=f"c{m['twin']}"))
    write_events(w / "events.jsonl", events)
    write_events(w / "events-fixed.jsonl", events_fixed)

    def manifest(name, events_file, instrument, rule_arg):
        (w / name).write_text(json.dumps({
            "schema": "loom.r2r-manifest/1", "title": "cli control (synthetic)", "roots": {"world": "."},
            "receipts": [{"adapter": "events", "path": events_file}],
            "oracles": [{"instrument": instrument, "argv": [sys.executable, "-I", "{driver:rule_tool}", "--rule", rule_arg,
                                                            "--files-from", "{files}", "--out", "{out}"],
                         "hosts": {"family": "hosts", "cap": 50}}],
            "settings": {"rounds": 2, "seed": 3}}))
        return str(w / name)

    m1 = manifest("manifest.json", "events.jsonl", inst, json.dumps(hidden.to_json()))
    m2 = manifest("manifest-fixed.json", "events-fixed.jsonl", fixed, "none")
    run_dir = w / "run"

    def call(*args):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
            code = loom_cli.main(["r2r", *args])
        return code, buf.getvalue()

    code, _ = call("run", m1, "--out", str(run_dir), "--work", str(w / "work"))
    need(code == 0 and (run_dir / "manifest.json").is_file(), "CLI_RUN", str(code))
    cands = [json.loads(p.read_text()) for p in sorted((run_dir / "candidates").glob("*.json"))]
    need(any(c["grade"]["grade"] == "C" for c in cands), "CLI_RUN_FOUND_NOTHING_CONFIRMED", str([c["grade"]["grade"] for c in cands]))
    code_again, _ = call("run", m1, "--out", str(run_dir))
    code_show, text = call("show", str(run_dir))
    need(code_again == 2 and code_show == 0 and "r2r-" in text, "CLI_SHOW_OR_RERUN", f"{code_again} {code_show}")
    code_bad, _ = call("show", str(w / "no-such-run"))
    code_flag, out_flag = call("check", str(run_dir), flagged_file)
    code_ok, _ = call("check", str(run_dir), clean_file)
    need((code_bad, code_flag, code_ok) == (2, 1, 0) and "FLAG" in out_flag, "CLI_CHECK", f"{(code_bad, code_flag, code_ok)}")
    rows.append({"case": "cli: run seals a folder (0), refuses to overwrite it (2), show (0), unknown run (2), "
                         "check flags a failing file (1) and passes a clean one (0)", "result": "0, 2, 0, 2, 1, 0"})
    code_live, _ = call("replay", str(run_dir), m1, "--out", str(w / "replay-same.json"))
    code_closed, _ = call("replay", str(run_dir), m2, "--out", str(w / "replay-fixed.json"), "--map", f"{inst}={fixed}")
    same = json.loads((w / "replay-same.json").read_text())
    fixd = json.loads((w / "replay-fixed.json").read_text())
    c_ids = {c["id"] for c in cands if c["grade"]["grade"] == "C"}
    live = [r for r in same["rules"] if r["rule"] in c_ids]
    closed = [r for r in fixd["rules"] if r["rule"] in c_ids]
    need(code_live == 1 and all(r["verdict"] == "still live" for r in live), "REPLAY_SAME_TOOL", f"{code_live} {live}")
    need(code_closed == 0 and all(r["verdict"] == "closed" and r["asked"]["files"] >= 5 for r in closed), "REPLAY_FIXED_TOOL",
         f"{code_closed} {[(r['verdict'], r['asked']) for r in closed]}")
    rows.append({"case": "cli: replay against the same tool says still live (1); against a fixed tool says closed (0), "
                         "asking it about the old failures and the rebuilt probes",
                 "result": f"{live[0]['asked']['failed']} still fail; {closed[0]['asked']['passed']} now pass"})
    # replay never counts a file twice: the old failures are in the same tool's receipts, so only rebuilt probes are asked
    probes = [json.loads(l) for l in (run_dir / "probes.jsonl").read_text().splitlines() if l.strip()]
    for r in live:
        rebuilt = {p["sha256"] for p in probes if p.get("rule") == r["rule"] and p.get("verdict") == "confirmed" and p.get("recipe")}
        need(r["receipts"]["failed"] >= 1 and r["asked"]["files"] <= len(rebuilt), "REPLAY_COUNTS_A_FILE_TWICE",
             f"{r['receipts']} {r['asked']} {len(rebuilt)}")
    rows.append({"case": "cli: replay asks the tool only about files its receipts have not already answered",
                 "result": f"{live[0]['receipts']['failed']} from receipts, {live[0]['asked']['files']} asked"})

    # one cause, two signatures (two lines of one function): one candidate file with two claims, counted once
    two = w / "two"
    two.mkdir()
    one_place = Rule("attr", all=("v:bool_noncanonical", "at:DirectionalLight@on"))
    ev2 = [e for e in events if e.outcome == "pass" and e.family == "receipts" and e.file.startswith("clean/")]
    k = 0
    for i, m in enumerate(synth.mutants(clean[:60], 6, seed=9, ops=("bool",))):
        f = f"two/t{i:03d}.x3d"
        (w / f).write_bytes(m["data"])
        fail = one_place.fires(Case(f, m["data"]).sites)
        ev2.append(Event(inst, "fail" if fail else "pass", f, f"boom at reader.py:{10 + k % 2}" if fail else "",
                         twin=f"clean/c{m['twin']:03d}.x3d", family="receipts", group=f"c{m['twin']}", note=m["note"]))
        k += fail
    write_events(w / "events-two.jsonl", ev2)
    (w / "manifest-two.json").write_text(json.dumps({
        "schema": "loom.r2r-manifest/1", "title": "one cause, two signatures (synthetic)", "roots": {"world": "."},
        "receipts": [{"adapter": "events", "path": "events-two.jsonl"}], "settings": {"seed": 3}}))
    code_two, _ = call("run", str(w / "manifest-two.json"), "--out", str(two / "run"))
    rd = json.loads((two / "run" / "run.json").read_text())
    files = sorted((two / "run" / "candidates").glob("*.json"))
    docs = [json.loads(p.read_text()) for p in files]
    cl = json.loads((two / "run" / "clusters.json").read_text())
    shared = [d for d in docs if d.get("also_explains")]
    need(code_two == 0 and len(cl) == 2 and shared, "SHARED_RULE_NOT_SHARED", f"{code_two} {len(cl)} {[d['id'] for d in docs]}")
    need(rd["candidates"] == len(files) == sum(rd["grades"].values()) and rd["claims"] == sum(len(c["rules"]) for c in cl)
         and rd["claims"] > rd["candidates"], "SHARED_RULE_COUNTED_TWICE", f"{rd['candidates']} {len(files)} {rd['grades']} {rd['claims']}")
    d = shared[0]
    sigs = {d["signature"]} | {x["signature"] for x in d["also_explains"]}
    need(sigs == {"boom at reader.py:10", "boom at reader.py:11"}
         and all(x["proof"]["signature"] == x["signature"] and x["sources"] for x in d["also_explains"])
         and d["proof"]["signature"] == d["signature"], "SHARED_RULE_PROOF_OVERWRITTEN", str(sigs))
    report_text = (two / "run" / "REPORT.md").read_text()
    need("found again under a second signature" in report_text, "SHARED_RULE_NOT_REPORTED")
    rows.append({"case": "a rule found under two signatures is one candidate file with two claims, each with its own proof; "
                         "the run counts it once", "result": f"{rd['candidates']} candidate(s), {rd['claims']} claims"})
    return rows


def run_all() -> dict:
    with tempfile.TemporaryDirectory(prefix="r2r-test-") as td:
        td = Path(td)
        out = {"vocabulary": vocab_controls(), "rules": rule_controls(), "events": event_controls(),
               "grades": grade_controls(), "cli": cli_controls(td)}          # the quick controls first
        eng, kept = engine_controls(td)
        out.update(engine=eng, ledger=ledger_controls(kept["bool-reader"]), optimized=bool(sys.flags.optimize))
        return out


if __name__ == "__main__":
    if "--child" in sys.argv:
        print(json.dumps(run_all()))
        sys.exit(0)
    report = {"schema": "loomkit.self-test/1", "scope": "Synthetic fixtures exercising the real engine; not a project run.",
              "modes": []}
    for flags in ([], ["-O"]):
        p = subprocess.run([sys.executable, "-I", *flags, __file__, "--child"], capture_output=True, text=True)
        if p.returncode != 0:
            print(p.stdout[-3000:], p.stderr[-6000:], file=sys.stderr)
            sys.exit(1)
        res = json.loads(p.stdout)
        negatives = sum(1 for k in ("rules", "events", "grades", "engine", "ledger") for row in res[k] if "caught" in row)
        report["modes"].append({"optimized": res["optimized"], "negative_controls_caught": negatives,
                                "vocabulary_literals_two_sided": len(res["vocabulary"]),
                                "hidden_rules_recovered": sum(1 for r in res["engine"] if r["case"].startswith("finds")),
                                "recovered_word_for_word": sum(1 for r in res["engine"] if r.get("word_for_word")),
                                "detail": res})
    out = KIT / "tests/r2r-last-run.json"
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    for m in report["modes"]:
        print(f"optimized={m['optimized']}: {m['negative_controls_caught']} negative controls caught the intended way; "
              f"{m['vocabulary_literals_two_sided']} vocabulary literals two-sided; {m['hidden_rules_recovered']} hidden rules "
              f"recovered from receipts alone ({m['recovered_word_for_word']} word for word); noise graded no higher than Suspected")
