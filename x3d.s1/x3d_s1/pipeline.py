"""Triage: answer what code can answer, run the twin for what a validator can answer, ask a judge only the rest.

One pass per scene: slice the state per question group, answer D questions from code, retain any caller-supplied C
answers as unverified imports that still require an oracle, send the J questions as ONE speculative fan-out per state slice, route each typed
answer through a Policy, and write a receipt that records the model id, thresholds, state hashes and where every answer
came from. A caller's raw mapping is not an artifact-bound instrument witness. This module does not verify Loom acceptance.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from typing import Mapping, Sequence

from . import __version__
from .backends import Backend, build_request, estimate_cost_usd, estimate_input_tokens, parse_all
from .decidable import BY_ID, C, D, J, QSpec, exact_answer
from .evidence import Evidence, cap_route, to_receipt
from .questions import AnswerSpaceError, Choice, ChoiceAnswer, Noul, NoulAnswer, Score, ScoreAnswer, parse_answer
from .routing import Policy, route_choice, route_noul
from .state import Scene, jsize, load, slice_state


def _h(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _summ(ans) -> dict:
    if isinstance(ans, ChoiceAnswer):
        return {"choice": ans.choice, "p": round(ans.p, 4), "confidence": round(ans.confidence, 4)}
    if isinstance(ans, ScoreAnswer):
        return {"score": round(ans.score, 4), "confidence": round(ans.confidence, 4)}
    if isinstance(ans, NoulAnswer):
        return {"noul": round(ans.noul, 4)}
    raise TypeError(type(ans))


def group_judged(specs: Sequence[QSpec]) -> dict[tuple, list[QSpec]]:
    """Speculative fan-out: J questions that read the same facets share one state slice and one backend call."""
    groups: dict[tuple, list[QSpec]] = {}
    for s in specs:
        groups.setdefault((tuple(sorted(s.question.needs)), s.untrusted), []).append(s)
    return groups


def triage(scene: Scene | str | bytes, qids: Sequence[str] | None = None, backend: Backend | None = None,
           policy: Policy | None = None, twin_results: Mapping[str, Mapping] | None = None,
           allow_untrusted: bool = False, budget_bytes: int = 6_000, yes: float = 0.7, no: float = 0.3,
           evidence: Mapping[str, Evidence] | None = None) -> dict:
    sc = scene if isinstance(scene, Scene) else load(scene)
    policy = policy or Policy()
    twin_results = twin_results or {}
    specs = [BY_ID[q] for q in (qids or list(BY_ID))]
    entries: list[dict] = []
    calls: list[dict] = []
    full = slice_state(sc, facets=None)["state"]          # all computed facets, for D questions (cheap, local)

    judged: list[QSpec] = []
    for s in specs:
        if s.cls == D:
            ans = parse_answer(s.question, exact_answer(s, full))
            entries.append({"id": s.id, "class": s.cls, "source": "exact", "route": "resolve_by_code", "twin": s.twin, **_summ(ans)})
        elif s.cls == C:
            if s.id in twin_results:
                ans = parse_answer(s.question, twin_results[s.id])
                entries.append({"id": s.id, "class": s.cls, "source": "unverified_import", "route": "escalate_oracle", "twin": s.twin,
                                "provenance_status": "caller_supplied_unverified",
                                "note": "Caller-supplied answer is not an artifact-bound oracle witness; run and verify the required instrument.", **_summ(ans)})
            else:
                entries.append({"id": s.id, "class": s.cls, "source": "deferred", "route": "escalate_oracle", "twin": s.twin,
                                "note": "run the twin; a judge is not asked"})
        else:
            if s.untrusted and not allow_untrusted:
                entries.append({"id": s.id, "class": s.cls, "source": "skipped", "twin": s.twin,
                                "note": "needs untrusted scene text; excluded by default"})
            elif backend is None:
                entries.append({"id": s.id, "class": s.cls, "source": "skipped", "twin": s.twin, "note": "no backend supplied"})
            else:
                judged.append(s)

    est_tokens = 0
    for (needs, untr), grp in group_judged(judged).items():
        facets = list(needs) or ["header"]
        sl = slice_state(sc, facets=facets, include_untrusted=untr and allow_untrusted, budget_bytes=budget_bytes)
        missing = [facet for facet in needs if facet not in sl["state"]]
        if missing:
            for s in grp:
                entries.append({"id": s.id, "class": s.cls, "source": "skipped", "route": "escalate_oracle", "twin": s.twin,
                                "code": "S1_MISSING_FACET", "missing_facets": missing,
                                "note": "The state budget omitted required context; no judgment was requested."})
            continue
        questions = {s.id: s.question for s in grp}
        req = build_request(backend.model, sl["state"], questions)
        est_tokens += estimate_input_tokens(req)
        raw = backend.ask(sl["state"], questions)
        parsed = parse_all(questions, raw)
        calls.append({"questions": list(questions), "facets": list(sl["state"]), "state_bytes": sl["meta"]["bytes"],
                      "state_sha12": _h(sl["state"])[:12], "raw_bytes": sl["meta"]["raw_bytes"], "ratio": sl["meta"]["ratio"],
                      "dropped_for_budget": sl["meta"]["dropped_for_budget"], "untrusted_included": sl["meta"]["untrusted_included"]})
        for s in grp:
            ans = parsed[s.id]
            e = {"id": s.id, "class": s.cls, "source": "judge", "grade": "S", "twin": s.twin, **_summ(ans)}
            if isinstance(ans, ChoiceAnswer):
                d = route_choice(ans, policy)
                e["outcome"] = e["route"] = d.outcome
                e["bar"], e["reason"] = d.bar, d.reason
            elif isinstance(ans, NoulAnswer):
                e["outcome"] = route_noul(ans, yes, no)
                e["route"] = "suspected_ok" if e["outcome"] in ("yes", "no") else "escalate_oracle"
                e["bands"] = [no, yes]
            else:
                e["outcome"] = "report"
                e["route"] = "suspected_ok"
            if evidence and s.id in evidence:             # a judged answer that rests on a quoted claim: no verified quote, no light route
                before = e["route"]
                e["route"] = cap_route(before, evidence[s.id])
                e["evidence"] = {**to_receipt(evidence[s.id]), "route_before_cap": before}
            entries.append(e)

    order = {q: i for i, q in enumerate(qids or list(BY_ID))}
    entries.sort(key=lambda e: order[e["id"]])
    src = [e["source"] for e in entries]
    body = {
        "x3d_s1": __version__, "scene_sha256": sc.sha256, "scene_bytes": sc.raw_bytes,
        "backend": getattr(backend, "model", None), "served_model": getattr(backend, "served_model", None) if calls else None,   # a run that made no call attests to no served model
        "policy": {"floor": policy.floor, "default_min_p": policy.default.min_p, "default": asdict(policy.default),
                   "actions": {k: asdict(v) for k, v in policy.actions.items()}, "noul_yes": yes, "noul_no": no},
        "allow_untrusted": allow_untrusted, "state_budget_bytes": budget_bytes,
        "calls": calls, "answers": entries,
        "totals": {"questions": len(entries), **{k: src.count(k) for k in ("exact", "twin", "unverified_import", "deferred", "judge", "skipped")},
                   "backend_calls": len(calls), "est_input_tokens": est_tokens,
                   "est_cost_usd_at_list_price": round(est_tokens * 0.042 / 1_000_000, 8)},
    }
    if evidence:
        body["totals"]["evidence_capped"] = sum(1 for e in entries if e.get("evidence", {}).get("route_before_cap", e.get("route")) != e.get("route"))
    body["receipt_sha256"] = _h(body)
    return body
