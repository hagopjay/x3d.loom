"""DSPy program for rule synthesis: incident + two failing scenes -> trap(root) source. Metric = the two-sided score in bench.py."""
from __future__ import annotations

import random

import dspy

import bench

CAP = 40                                   # scenes per set while optimising; held-out scoring uses everything


class WriteTrap(dspy.Signature):
    """Write a lint rule for X3D scenes that has already cost the project once.

    Return Python source defining `def trap(root): ...` over an xml.etree.ElementTree root; it returns True when the
    scene has the trap. ET, re, math and colorsys are already imported; do not import anything. Tag names may carry an
    XML namespace: compare with tag.rsplit('}', 1)[-1]. The rule is scored two-sided on scenes it has not seen: it must
    fire on every scene with the trap and stay silent on clean scenes, including scenes that make the same edit lawfully.
    A rule that matches a keyword is wrong. Return only the code."""
    incident: str = dspy.InputField(desc="what went wrong, in the project's own words")
    runtime: str = dspy.InputField(desc="the runtime the failure was observed on")
    evidence: str = dspy.InputField(desc="XML around the fault in two scenes that have it")
    rule_code: str = dspy.OutputField()


def strip_fences(code: str) -> str:
    code = (code or "").strip()
    if code.startswith("```"):
        code = code.split("\n", 1)[1] if "\n" in code else ""
        code = code.rsplit("```", 1)[0]
    return code


def examples(cases, ids):
    out = []
    for rid in ids:
        c = cases[rid]
        ev = "\n---\n".join(ctx for _, _, ctx in c["pos_show"][:2] if ctx) or "(no excerpt: the positives are whole real scenes)"
        out.append(dspy.Example(case_id=rid, incident=c["incident"], runtime=c["runtime"], evidence=ev[:1400]).with_inputs(
            "incident", "runtime", "evidence"))
    return out


def make_metric(cases, split):
    def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
        c = cases[gold.case_id]
        rnd = random.Random(gold.case_id)
        cut = (lambda xs: rnd.sample(xs, min(CAP, len(xs)))) if split == "train" else (lambda xs: xs)
        r = bench.run_rule(strip_fences(pred.rule_code), cut(c[f"pos_{split}"]), cut(c[f"neg_{split}"]), cut(c[f"twin_{split}"]))
        fb = (f"score {r['score']} = recall {r['tpr']} x clean-scene specificity {r['tnr']} x lawful-twin specificity {r['tnr_twin']}. "
              + (f"Rule error: {r['error']}. " if r["error"] else "")
              + (f"Missed scenes with the trap: {r['missed']}. Offending XML in the first misses: {r['missed_xml']}. " if r["missed"] else "")
              + (f"Fired on scenes without the trap: {r['false_alarms']}. " if r["false_alarms"] else "")
              + "Twins are the same scene with the same edit done lawfully (or left alone): the rule must be silent on them.")
        return dspy.Prediction(score=r["score"], feedback=fb)
    return metric
