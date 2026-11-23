"""Proposers: where candidate rules come from. Today one, by design; the seam for a language model is drawn here.

R2R splits the work the way law 7 (a rule arrives with its tests) and the lesson of law 32's stretched marks (a
model's reading is Suspected until the owner confirms it) ask for:

    PROPOSER   suggests a rule (or a new word for the vocabulary). It may be wrong. It is never believed.
    PROVER     runs the suggestion against receipts and against the instrument itself (prove.py, probe.py).
    GRADER     reads the proof off a fixed table (grade.py).

Only the proposer is replaceable. `InductiveProposer` is the one that ships: plain search over the X3DUOM-grounded
vocabulary, no model, no network, no spend. Everything measured in LEARNINGS-r2r-engine.md was produced by it.

THE DSPy SEAM (designed, switched off)
--------------------------------------
The DSPy sweep of 18 Nov 2026 (DSPY-SWEEP-2026-11-18.md) found the hard part of rule synthesis with a model is not
writing the rule but the metric: degenerate batteries, lawful near-misses, content-hash splits, an oracle that does not
mark its own homework. R2R already has that metric, and it does not depend on who proposed the rule. So a DSPy program
plugs in as a second proposer and nothing else changes:

  what the model is GIVEN   `brief(problem, induction)`: the signature, the instrument, a few failing sites with their
                            known-good twins as literal diffs, the inductive rule and its proof, and, most useful, the
                            COUNTEREXAMPLES: probes where the current rule was wrong, as plain XML fragments.
  what the model RETURNS    a rule in the rule language (`{"kind": ..., "all": [...], "any": [...]}`), or a new literal:
                            a name plus a small pure predicate over one site. `validate_proposal` refuses anything else.
  the METRIC                `score(proof, grade)`: C > L > S, then audit confirmations, then fewer false alarms. This is
                            the function a DSPy optimiser (GEPA, MIPROv2) would maximise, and the refuted probes are the
                            textual feedback GEPA asks for.
  where a model HELPS       exactly where induction says it cannot go on: a candidate marked `vocabulary_gap`, a cluster
                            with residue, a rule the audit left "open". `needs_a_proposer(...)` lists them. The run of
                            23 Nov 2026 has real ones (see the learnings file): the importer cuts a bool value at its
                            first comma, and no word in the vocabulary says "the text before the first comma".
  what a model may NOT do   grade, promote, change a proof, or see held-out receipts. A rule it proposes enters as
                            observed_by "model" until the prover has run it, and a model-proposed law join stays S until
                            the owner confirms it.

`DSPyProposer` below is the socket. It imports nothing and refuses to run until a person turns it on, because the
standing instruction for this lane is no language-model spend.
"""
from __future__ import annotations

import json

from . import features as F
from .induce import Induction, Problem, induce
from .rule import Rule

LITERAL_PREFIXES = ("n:", "a:", "t:", "tc:", "isa:", "p:", "dv:", "dp:", "ntok:", "nws:", "has:", "child:", "cf:", "at:",
                    "e.has:", "e.child:", "anc:", "v:", "x:", "ge:", "le:", "tw:", "tscheme:", "text:", "enc:")


class Proposer:
    """Anything that can suggest rules for a cluster. The engine proves and grades whatever comes back."""
    name = "proposer"
    uses_model = False

    def propose(self, problem: Problem) -> Induction:
        raise NotImplementedError


class InductiveProposer(Proposer):
    name = "inductive (no language model)"

    def propose(self, problem: Problem) -> Induction:
        return induce(problem)


def validate_proposal(obj) -> Rule:
    """Turn what a model (or a person) wrote into a Rule, or refuse it with a reason. Nothing is evaluated."""
    if not isinstance(obj, dict) or obj.get("kind") not in ("attr", "elem", "doc"):
        raise ValueError('a proposal is {"kind": "attr"|"elem"|"doc", "all": [literals], "any": [literals]}')
    lits = list(obj.get("all", [])) + list(obj.get("any", []))
    if not lits or len(lits) > 80:
        raise ValueError("a proposal needs between 1 and 80 literals")
    for l in lits:
        core = l[1:] if isinstance(l, str) and l.startswith("!") else l
        if not isinstance(core, str) or not core.startswith(LITERAL_PREFIXES) or len(core) > 200:
            raise ValueError(f"not a literal of the rule language: {l!r}")
        if core.startswith(("ge:", "le:")):
            float(core.rsplit(":", 1)[1])
    rule = Rule(obj["kind"], obj.get("all", ()), obj.get("any", ()))
    if not rule.tests():
        raise ValueError("a rule needs at least one test literal; context alone is a keyword match")
    return rule


def needs_a_proposer(candidate_docs: list[dict], clusters: list[dict]) -> list[dict]:
    """Where induction stopped and said why: the work list for a person or a model."""
    out = []
    for d in candidate_docs:
        g, p = d["grade"], d["proof"]
        if p["vocabulary_gap"]:
            out.append({"rule": d["id"], "need": "a word for what these literal values share",
                        "evidence": [l for l in d["rule"]["all"] if F.tier(l.lstrip("!")) == 4]})
        if g["closure"] == "open":
            out.append({"rule": d["id"], "need": "the rule misses failures of its own signature",
                        "evidence": p["audit"]["missed_examples"] + p["held_out"]["missed_examples"]})
        if p["audit"]["refuted"]:
            out.append({"rule": d["id"], "need": "the rule fired where the instrument passed",
                        "evidence": p["audit"]["refuted_examples"]})
    for c in clusters:
        if c["residue"]:
            out.append({"cluster": c["signature"], "need": "failures no rule explains", "evidence": c["residue_examples"]})
        if not c["rules"]:
            out.append({"cluster": c["signature"], "need": "no clean rule in this vocabulary",
                        "evidence": [u["sentence"] for u in c["unclean_best_efforts"]]})
    return out


def brief(candidate_doc: dict, max_sources: int = 6) -> str:
    """The text a model would be shown for one candidate: everything the prover knows, nothing held out."""
    p = candidate_doc["proof"]
    lines = [f"Instrument: {candidate_doc['instrument']}", f"Failure signature: {candidate_doc['signature']}",
             f"Current rule: {json.dumps(candidate_doc['rule'], sort_keys=True)}", f"In words: {candidate_doc['sentence']}",
             f"Grade: {candidate_doc['grade']['grade']} because " + "; ".join(candidate_doc["grade"]["reasons"]),
             "Failures it was induced from:"]
    lines += [f"  - {s['note']}" for s in candidate_doc["sources"][:max_sources]]
    if p["audit"]["refuted_examples"]:
        lines.append("Probes where the rule fired and the instrument PASSED (counterexamples):")
        lines += [f"  - {x}" for x in p["audit"]["refuted_examples"]]
    if p["audit"]["missed_examples"]:
        lines.append("Probes that FAILED with this signature where the rule did not fire:")
        lines += [f"  - {x}" for x in p["audit"]["missed_examples"]]
    lines.append("Reply with one rule in the same JSON form, using only literals of the rule language.")
    return "\n".join(lines)


def score(proof: dict, grade: dict) -> tuple:
    """The metric an optimiser would climb. Higher is better; compare as tuples."""
    return ({"C": 2, "L": 1, "S": 0}[grade["grade"]], proof["audit"]["confirmed"] - 5 * proof["audit"]["refuted"],
            -proof["known_good"]["false_alarms"] - proof["held_out"]["false_alarms"], proof["held_out"]["caught"],
            -len(proof["rule"]["all"]))


class DSPyProposer(Proposer):
    """The socket for a DSPy program. Off: constructing it is allowed, proposing is refused."""
    name = "dspy (not enabled)"
    uses_model = True

    def __init__(self, enabled: bool = False, budget_usd: float = 0.0):
        self.enabled, self.budget_usd = enabled, budget_usd

    def propose(self, problem: Problem) -> Induction:
        raise RuntimeError(
            "DSPyProposer is a designed seam, not a running proposer. The lane's standing instruction is no "
            "language-model spend; when that changes, implement propose() to call a DSPy module with brief() as "
            "input and validate_proposal() on its output, and let the engine prove and grade the result.")
