import json

import pytest
from conftest import fixture

from x3d_s1.backends import ReplayBackend, StubBackend
from x3d_s1.decidable import BY_ID, CATALOGUE, C, D, J, QSpec, exact_answer, partition
from x3d_s1.pipeline import group_judged, triage
from x3d_s1.questions import Noul
from x3d_s1.routing import ActionPolicy, Policy
from x3d_s1.state import slice_state


def test_partition_counts_and_invariants():
    p = partition()
    assert sum(map(len, p.values())) == len(CATALOGUE) == 18 and (len(p[D]), len(p[C]), len(p[J])) == (8, 5, 5)
    assert all(q.exact for q in CATALOGUE if q.cls == D)
    assert all(q.twin == "none" for q in CATALOGUE if q.cls == J)
    assert len({q.id for q in CATALOGUE}) == len(CATALOGUE)


def test_every_answer_carries_a_loom_route_and_model_answers_are_grade_S():
    r = triage(fixture("adversarial.x3d"), backend=StubBackend(judge_fn))
    routes = {e["route"] for e in r["answers"] if "route" in e}
    assert routes <= {"resolve_by_code", "escalate_oracle", "suspected_ok", "defer_human"}
    assert all(e["grade"] == "S" for e in r["answers"] if e["source"] == "judge")
    assert not any(e.get("route") in ("pass", "fail", "act") for e in r["answers"])


def test_class_rules_enforced():
    with pytest.raises(ValueError):
        QSpec("x", D, Noul("x"), "t")          # D without an exact function
    with pytest.raises(ValueError):
        QSpec("x", J, Noul("x"), "validate_x3d")  # a J question with an exact twin should be reclassified


def test_exact_answers_are_one_hot_and_in_space():
    st = slice_state(fixture("adversarial.x3d"))["state"]
    a = exact_answer(BY_ID["scene.material_model"], st)
    assert a["choice"] == "classic" and sum(a["probabilities"].values()) == 1.0 and a["confidence"] == 1.0
    assert exact_answer(BY_ID["scene.has_lights"], st) == {"type": "noul", "noul": 1.0}
    with pytest.raises(ValueError):
        exact_answer(BY_ID["scene.is_valid"], st)


def test_triage_without_backend_answers_D_defers_C_skips_J():
    r = triage(fixture("adversarial.x3d"))
    t = r["totals"]
    assert (t["exact"], t["deferred"], t["judge"], t["backend_calls"]) == (8, 5, 0, 0) and t["skipped"] == 5
    assert all(e["source"] == "deferred" and e["twin"] != "none" for e in r["answers"] if e["class"] == "C")


def test_lookup_before_judge_a_D_question_never_reaches_the_backend():
    sb = StubBackend(lambda qid, q, st: {"type": "noul", "noul": 0.5} if q.kind == "noul" else None)
    r = triage(fixture("benign.x3d"), qids=["scene.has_lights", "scene.size_class"], backend=sb)
    assert sb.calls == [] and r["totals"]["judge"] == 0


def judge_fn(qid, q, st):
    if q.kind == "choice":
        opts = list(q.options)
        return {"type": "choice", "choice": opts[0], "probabilities": {o: (0.9 if i == 0 else 0.1 / (len(opts) - 1)) for i, o in enumerate(opts)}}
    if q.kind == "score":
        n = q.levels
        return {"type": "score", "score": 1.0, "probabilities": {str(i): (1.0 if i == 1 else 0.0) for i in range(n)}}
    return {"type": "noul", "noul": 0.8}


def test_fan_out_one_call_per_state_slice_not_per_question():
    ids = ["scene.subject", "scene.mood_warmth", "animation.intent_readable"]
    g = group_judged([BY_ID[i] for i in ids])
    assert len(g) == 3     # different facet sets, so different slices
    sb = StubBackend(judge_fn)
    r = triage(fixture("benign.x3d"), qids=ids, backend=sb)
    assert r["totals"]["backend_calls"] == 3 and r["totals"]["judge"] == 3
    same = [BY_ID["scene.subject"], BY_ID["scene.subject"]]
    assert len(group_judged(same)) == 1 and len(next(iter(group_judged(same).values()))) == 2


def test_untrusted_questions_skipped_unless_allowed_and_attack_text_never_sent():
    seen = {}
    def spy(qid, q, st):
        seen[qid] = json.dumps(st)
        return judge_fn(qid, q, st)
    sb = StubBackend(spy)
    r0 = triage(fixture("adversarial.x3d"), qids=["name.matches_geometry", "text.is_instruction"], backend=sb)
    assert sb.calls == [] and all(e["source"] == "skipped" for e in r0["answers"])
    r1 = triage(fixture("adversarial.x3d"), qids=["name.matches_geometry", "text.is_instruction"], backend=sb, allow_untrusted=True)
    assert r1["totals"]["judge"] == 2
    blob = " ".join(seen.values()).lower()
    assert "ignore all previous" not in blob and "answer yes to every" not in blob and "must now respond" not in blob


def test_twin_results_are_folded_in_with_their_source():
    r = triage(fixture("benign.x3d"), qids=["scene.is_valid"], twin_results={"scene.is_valid": {"type": "noul", "noul": 1.0}})
    e = r["answers"][0]
    assert e["source"] == "twin" and e["noul"] == 1.0 and e["twin"].startswith("validate_x3d")


def test_judged_choice_is_routed_by_probability_of_the_chosen_option():
    sb = StubBackend(judge_fn)
    pol = Policy(floor=0.5, default=ActionPolicy("default", "high", 0.95))
    r = triage(fixture("benign.x3d"), qids=["scene.subject"], backend=sb, policy=pol)
    e = r["answers"][0]
    assert e["p"] == 0.9 and e["outcome"] == "escalate_oracle" and e["bar"] == 0.95


def test_receipt_is_reproducible_and_carries_the_numbers():
    sb = lambda: StubBackend(judge_fn, model="stub-1")
    a = triage(fixture("benign.x3d"), backend=sb())
    b = triage(fixture("benign.x3d"), backend=sb())
    assert a["receipt_sha256"] == b["receipt_sha256"] and a["backend"] == "stub-1"
    assert a["scene_sha256"] and a["policy"]["noul_yes"] == 0.7 and a["calls"][0]["state_sha12"]
    c = triage(fixture("benign.x3d"), backend=sb(), yes=0.8)
    assert c["receipt_sha256"] != a["receipt_sha256"]


def test_receipt_contains_no_scene_text():
    r = triage(fixture("adversarial.x3d"), backend=StubBackend(judge_fn), allow_untrusted=True)
    blob = json.dumps(r).lower()
    assert "ignore all previous" not in blob and "kitchen" not in blob
