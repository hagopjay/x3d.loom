"""The proof: everything R2R measured about one candidate rule, on both sides, with the instrument named.

Law 7 says a rule ships with tests on both sides. For a candidate that means, in order of how much they are worth:

  audit probes     files built AFTER the rule was fixed, run through the real instrument: predictions that came true,
                   predictions that did not, failures the rule missed
  held-out         receipts the inducer never saw (other random seeds, other real files), split by content hash so
                   the same bytes are never on both sides
  known-good       every file the instrument was seen to pass: the rule must fire on none
  sources          the failures the rule was induced from: it must explain them at the site that changed
  ablation         each literal removed in turn: a literal whose removal changes nothing is not part of the rule
  degenerate       empty, truncated and minimal files: a rule that fires on nothing-much is noise

and beside the counts, what the evidence could NOT decide: alternates, the unfenced reading, untested intervals.
A proof never says a rule is true. It says what was run, on what, and what came back.
"""
from __future__ import annotations

import math

from . import PROOF_SCHEMA
from . import features as F
from .events import Case, EventSet
from .induce import Candidate, Induction, fires
from .known import explained_by_traps
from .rule import Rule

DEGENERATE = {
    "empty file": b"",
    "whitespace": b"  \n",
    "not XML": b"this is not xml",
    "truncated": b'<?xml version="1.0"?><X3D profile="Immersive" version="4.0"><Scene><Shape>',
    "bare X3D": b'<X3D profile="Immersive" version="4.0"/>',
    "empty scene": b'<X3D profile="Immersive" version="4.0"><Scene/></X3D>',
    "one box": (b'<X3D profile="Immersive" version="4.0"><Scene><Shape><Appearance><Material/></Appearance><Box/></Shape>'
                b'</Scene></X3D>'),
    "wrong root": b"<html><body/></html>",
}
_DEGENERATE_CASES: dict[str, Case] = {}


def _degenerate() -> dict[str, Case]:
    if not _DEGENERATE_CASES:
        for name, data in DEGENERATE.items():
            _DEGENERATE_CASES[name] = Case(f"(degenerate: {name})", data)
    return _DEGENERATE_CASES


def _clean(v):
    """JSON has no infinity; a proof file must be plain JSON."""
    if isinstance(v, float) and not math.isfinite(v):
        return "inf" if v > 0 else "-inf" if v < 0 else "nan"
    if isinstance(v, dict):
        return {k: _clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_clean(x) for x in v]
    return v


def prove(es: EventSet, ind: Induction, cand: Candidate, history: list | None = None,
          held_splits: tuple = ("held",), audit_split: str = "audit") -> dict:
    problem, rule = ind.problem, cand.rule
    pool, inst, sig = problem.pool, problem.instrument, problem.signature
    train_shas = {ex.case.sha256 for ex in pool.examples}
    siblings = [c.rule for c in ind.candidates if c is not cand]

    # --- sources and known-good (what induction saw) -------------------------------------------------------------
    explained = [ex for ex in problem.pos if problem.explained(rule, ex)]
    observed: dict[str, int] = {}
    families: dict[str, int] = {}
    for ex in problem.pos:
        observed[ex.event.observed] = observed.get(ex.event.observed, 0) + 1
        families[ex.event.family] = families.get(ex.event.family, 0) + 1
    fa_train = pool.hits(rule, "pass")
    sources = {"failures": len(problem.pos), "explained_by_this_rule": len(explained),
               "explained_by_any_rule_of_the_cluster": len(problem.pos) - len(ind.residue),
               "with_known_good_twin": sum(1 for ex in problem.pos if ex.twin is not None),
               "observed_by": observed, "families": families}
    known_good = {"passing_files": pool.n_pass, "false_alarms": len(fa_train),
                  "false_alarm_files": [ex.case.path for ex in list(fa_train)[:5]]}

    # --- held-out receipts, content-disjoint from training --------------------------------------------------------
    h_fail = h_pass = h_caught = h_fa = h_dup = 0
    h_fa_files, h_missed = [], []
    seen = set()
    for e in es.events:
        if e.instrument != inst or e.split not in held_splits:
            continue
        ex = es.example(e)
        if ex.case.sha256 in train_shas:
            h_dup += 1
            continue
        if (ex.case.sha256, e.outcome, e.signature) in seen:
            continue
        seen.add((ex.case.sha256, e.outcome, e.signature))
        if e.outcome == "fail" and e.signature == sig:
            h_fail += 1
            if fires(rule, ex):
                h_caught += 1
            elif not any(fires(r, ex) for r in siblings) and len(h_missed) < 5:
                h_missed.append(e.note or ex.case.path)
        elif e.outcome == "pass":
            h_pass += 1
            if fires(rule, ex):
                h_fa += 1
                if len(h_fa_files) < 5:
                    h_fa_files.append(e.note or ex.case.path)
    held = {"failures": h_fail, "caught": h_caught, "passing_files": h_pass, "false_alarms": h_fa,
            "false_alarm_examples": h_fa_files, "missed_examples": h_missed,
            "dropped_as_same_bytes_as_training": h_dup}

    # --- audit probes: judged for this rule alone -----------------------------------------------------------------
    audit = {"confirmed": 0, "refuted": 0, "missed": 0, "caught_by_sibling_rule": 0, "silent_ok": 0, "other_failure": 0,
             "refuted_examples": [], "missed_examples": []}
    n_audit = 0
    for e in es.events:
        if e.instrument != inst or e.split != audit_split or e.label == "probe-twin":
            continue
        n_audit += 1
        ex = es.example(e)
        fired = fires(rule, ex)
        if e.outcome == "fail" and e.signature != sig:
            audit["other_failure"] += 1
        elif fired and e.outcome == "fail":
            audit["confirmed"] += 1
        elif fired:
            audit["refuted"] += 1
            if len(audit["refuted_examples"]) < 5:
                audit["refuted_examples"].append(e.note)
        elif e.outcome == "fail":
            if any(fires(r, ex) for r in siblings):
                audit["caught_by_sibling_rule"] += 1
            else:
                audit["missed"] += 1
                if len(audit["missed_examples"]) < 5:
                    audit["missed_examples"].append(e.note)
        else:
            audit["silent_ok"] += 1
    audit["probes"] = n_audit
    rounds = []
    for h in history or []:
        tally: dict[str, int] = {}
        for p in h["probes"]:
            key = f"{p['why'].split(':')[0]}/{p['verdict']}"
            tally[key] = tally.get(key, 0) + 1
        rounds.append({"round": h["round"], "fed_back": h["fed_back"], "probes": len(h["probes"]), "tally": tally,
                       "rules_tested": h["rules"]})

    # --- ablation -------------------------------------------------------------------------------------------------
    ablation = []
    for lit in rule.all:
        smaller = rule.without(lit)
        if not smaller.all and not smaller.any:
            continue
        ablation.append({"dropped": lit, "role": F.role(lit), "false_alarms_without_it": len(pool.hits(smaller, "pass")),
                         "failures_explained_without_it": sum(1 for ex in problem.pos if problem.explained(smaller, ex))})
    if rule.any:
        g = Rule(rule.kind, rule.all)
        ablation.append({"dropped": f"(the list of {len(rule.any)} places)", "role": "fence",
                         "false_alarms_without_it": len(pool.hits(g, "pass")),
                         "failures_explained_without_it": sum(1 for ex in problem.pos if problem.explained(g, ex))})
    idle = [a["dropped"] for a in ablation if a["role"] != "fence" and a["false_alarms_without_it"] == 0
            and a["failures_explained_without_it"] == len(explained) and not a["dropped"].startswith("at:")
            and a["dropped"] not in cand.scope]

    # --- degenerate battery ---------------------------------------------------------------------------------------
    fired_on = [name for name, case in _degenerate().items() if rule.could_fire(case.bag) and rule.fires(case.sites)]

    # --- the normative reading: tier-1 literals every explaining site shares --------------------------------------
    shared = None
    for ex in explained:
        for s in problem.explained(rule, ex):
            t1 = {l for l in s.lits if F.tier(l) == 1}
            shared = t1 if shared is None else shared & t1
    normative = []
    for lit in sorted(shared or ()):
        r = Rule(rule.kind, (lit,) + tuple(cand.scope), rule.any)
        normative.append({"literal": lit, "means": F.describe(lit),
                          "passing_files_with_it_inside_the_fence": len(pool.hits(r, "pass"))})

    proof = {
        "schema": PROOF_SCHEMA, "rule_id": rule.rid(), "rule": rule.to_json(), "sentence": rule.sentence(),
        "instrument": inst, "signature": sig, "tier": rule.tier(), "vocabulary_gap": cand.gap,
        "seen_at": cand.seen_at,
        "unfenced": None if cand.general is None else {
            "rule": cand.general.to_json(), "false_alarms_on_known_good": cand.general_false_alarms,
            "status": "contradicted by passing files" if cand.general_false_alarms else "untested beyond the fence"},
        "sources": sources, "known_good": known_good, "held_out": held, "audit": audit, "probe_rounds": rounds,
        "ablation": ablation, "idle_literals": idle, "degenerate_fired_on": fired_on,
        "alternates": [{"rule": a.to_json(), "sentence": a.sentence()} for a in cand.alternates],
        "intervals": cand.intervals, "strays": cand.strays, "normative_reading": normative,
        "existing_traps": explained_by_traps(explained),
        "trace": cand.trace,
    }
    return _clean(proof)
