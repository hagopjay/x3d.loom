"""Grading: Confirmed, Likely or Suspected, by a fixed table, with every reason written down.

The engine never promotes a rule and never grades by how convincing a rule reads. A grade is a statement about
evidence, and it is always relative to the named instrument:

  C  Confirmed  the failures were observed by a tool; the rule explains its sources; it fires on none of at least 30
                files the instrument passed; AND it called outcomes it had not seen: at least 5 audit probes confirmed
                with none refuted, or at least 5 held-out failures with 90% caught and no held-out false alarm.
  L  Likely     clean on both sides of what induction saw, but nothing unseen has tested it yet (no oracle, no
                held-out failures), or the failures were authored by a person rather than observed by a tool.
  S  Suspected  anything else: one failure and no probe, a sliver of a large cluster (under 5 failures and under a
                tenth of its signature) with no probe, a false alarm anywhere, a refuted prediction, a rule that
                leans on literal values, failures reported by a model.

Beside the grade stands CLOSURE, which the grade does not cover: whether failures of this signature exist that the
rule does not fire on. "open" means the audit found some; a rule can be Confirmed and open, which reads "every time it
fires it is right, and it does not yet fire everywhere it should".

The lesson of law 32's stretched marks (x3d.loom #150, #151: four failure rows a model had read as cases of law 32
were struck) is in the table: a join or a rule proposed by a model is S until the owner confirms it. Nothing here can
turn a model's say-so into a C.
"""
from __future__ import annotations

MIN_KNOWN_GOOD = 30
MIN_UNSEEN = 5
MIN_RECALL = 0.9
MIN_SHARE = 0.1


def grade(proof: dict) -> dict:
    why_not_c: list[str] = []
    why_s: list[str] = []
    src, kg, held, audit = proof["sources"], proof["known_good"], proof["held_out"], proof["audit"]
    observed = src["observed_by"]
    if observed.get("model"):
        why_s.append(f"{observed['model']} source failure(s) were reported by a model, not observed by a tool")
    if kg["false_alarms"]:
        why_s.append(f"fires on {kg['false_alarms']} file(s) the instrument passed")
    if held["false_alarms"]:
        why_s.append(f"fires on {held['false_alarms']} held-out file(s) the instrument passed")
    if audit["refuted"]:
        why_s.append(f"{audit['refuted']} audit prediction(s) were wrong: the rule fired and the instrument passed")
    if proof["tier"] >= 4 or proof["vocabulary_gap"]:
        why_s.append("leans on literal values (a fingerprint): the vocabulary lacks a word for what they share")
    if proof["degenerate_fired_on"]:
        why_s.append("fires on degenerate files: " + ", ".join(proof["degenerate_fired_on"]))
    if src["explained_by_this_rule"] == 0:
        why_s.append("explains none of its source failures")
    unseen_probe = audit["confirmed"] >= MIN_UNSEEN and audit["refuted"] == 0
    unseen_held = (held["failures"] >= MIN_UNSEEN and held["caught"] / max(1, held["failures"]) >= MIN_RECALL
                   and held["false_alarms"] == 0 and held["passing_files"] >= MIN_KNOWN_GOOD)
    if src["explained_by_this_rule"] < 2 and not unseen_probe:
        why_s.append("rests on one failure and no confirmed probe")
    elif (src["explained_by_this_rule"] < MIN_UNSEEN and src["explained_by_this_rule"] < MIN_SHARE * src["failures"]
          and not unseen_probe):
        why_s.append(f"explains only {src['explained_by_this_rule']} of {src['failures']} failures of its signature and "
                     f"no probe confirmed it: the signature may have no rule over the file")
    if observed.get("authored") and not observed.get("tool"):
        why_not_c.append("the failures were authored, not observed by a tool")
    if kg["passing_files"] < MIN_KNOWN_GOOD:
        why_not_c.append(f"only {kg['passing_files']} known-good file(s) to test against (need {MIN_KNOWN_GOOD})")
    if not (unseen_probe or unseen_held):
        bits = []
        if audit["probes"] == 0:
            bits.append("the prober has no experiment for a rule of this shape" if proof["probe_rounds"]
                        else "no oracle was available to probe")
        else:
            bits.append(f"{audit['confirmed']} audit probe(s) confirmed (need {MIN_UNSEEN})")
        if held["failures"] < MIN_UNSEEN:
            bits.append(f"{held['failures']} held-out failure(s) (need {MIN_UNSEEN})")
        else:
            bits.append(f"held-out recall {held['caught']}/{held['failures']}")
        why_not_c.append("nothing unseen has confirmed it: " + "; ".join(bits))
    if why_s:
        g, reasons = "S", why_s
    elif why_not_c:
        g, reasons = "L", why_not_c
    else:
        g = "C"
        reasons = []
        if unseen_probe:
            reasons.append(f"{audit['confirmed']} audit probe(s) confirmed, 0 refuted")
        if unseen_held:
            reasons.append(f"held-out: {held['caught']} of {held['failures']} failures caught, 0 false alarms in "
                           f"{held['passing_files']} passing files")
        reasons.append(f"0 false alarms in {kg['passing_files']} known-good files")
    missed = audit["missed"] + (held["failures"] - held["caught"] if held["failures"] else 0)
    silent_checked = audit["silent_ok"]
    if audit["missed"] or (held["failures"] and held["caught"] < held["failures"] and held["missed_examples"]):
        closure = "open"
        closure_why = (f"{audit['missed']} audit probe(s) and {len(held['missed_examples'])}+ held-out failure(s) "
                       f"failed with this signature where no rule of the cluster fired")
    elif silent_checked >= MIN_UNSEEN:
        closure = "closed-so-far"
        closure_why = f"{silent_checked} audit probe(s) outside the rule all passed"
    else:
        closure = "untested"
        closure_why = "too few probes outside the rule to say"
    label = {"C": "Confirmed", "L": "Likely", "S": "Suspected"}[g]
    return {"grade": g, "grade_word": label, "against": proof["instrument"], "reasons": reasons,
            "closure": closure, "closure_reason": closure_why, "missed_seen": missed,
            "thresholds": {"min_known_good": MIN_KNOWN_GOOD, "min_unseen": MIN_UNSEEN, "min_recall": MIN_RECALL}}
