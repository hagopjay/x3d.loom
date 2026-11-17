"""Boundary regressions: missing evidence and invalid numbers cannot become exact-looking receipts."""
import math

import pytest

from x3d_s1.backends import HostedAdapter, StubBackend, parse_all
from x3d_s1.calibration import (brier, cascade_at, cascade_bill, check_report, ece, log_loss,
                                reliability, rule_of_three, threshold_for_precision, wilson)
from x3d_s1.decidable import BY_ID, exact_answer
from x3d_s1.pipeline import triage
from x3d_s1.questions import AnswerSpaceError, Choice, Noul, Score, ScoreAnswer, parse_answer
from x3d_s1.routing import ActionPolicy, Policy, route_noul, route_score
from x3d_s1.state import load, slice_state


SCENE = b"<X3D profile='Interchange' version='4.0'><Scene><TimeSensor cycleInterval='2'/></Scene></X3D>"


def test_time_sensor_alone_is_animated_and_counts_as_a_sensor():
    state = slice_state(load(SCENE))["state"]
    assert state["behavior"]["timers"] == state["behavior"]["sensors"] == 1
    assert state["behavior"]["interpolators"] == 0
    backend = StubBackend(lambda *args: pytest.fail("D questions must not reach a judge"))
    answer = triage(SCENE, ["scene.is_animated"], backend=backend)["answers"][0]
    assert answer["source"] == "exact" and answer["noul"] == 1.0 and backend.calls == []


@pytest.mark.parametrize("state", [{}, {"header": {"profile": "Full"}}, {"lighting": {}},
                                  {"lighting": {"light_count": -1}}, {"lighting": {"light_count": "0"}},
                                  {"lighting": {"light_count": False}}, {"lighting": []}])
def test_missing_or_invalid_computed_state_never_means_exact_absence(state):
    with pytest.raises(ValueError, match="S1_EXACT_STATE"):
        exact_answer(BY_ID["scene.has_lights"], state)


def test_omitted_animation_counts_are_not_assumed_zero():
    with pytest.raises(ValueError, match="S1_EXACT_STATE"):
        exact_answer(BY_ID["scene.is_animated"], {"behavior": {"scripts": 0}})


@pytest.mark.parametrize("fn", [reliability, ece, brier, log_loss])
def test_calibration_rejects_unpaired_predictions(fn):
    with pytest.raises(ValueError):
        fn([0.9, 0.8], [1])


@pytest.mark.parametrize("p", [float("nan"), float("inf"), -0.1, 1.1, "0.9", True])
def test_invalid_probability_cannot_disappear_from_reliability_bins(p):
    with pytest.raises(ValueError):
        reliability([p], [1])


@pytest.mark.parametrize("outcome", [2, -1, float("nan"), "1"])
def test_calibration_rejects_nonbinary_labels(outcome):
    with pytest.raises(ValueError):
        brier([0.5], [outcome])


@pytest.mark.parametrize("bins", [0, -1, 2.5, True])
def test_reliability_bin_count_must_be_positive_integer(bins):
    with pytest.raises(ValueError):
        reliability([0.5], [1], bins=bins)


def test_empty_and_invalid_statistical_inputs_are_explicit():
    for fn in (brier, log_loss):
        with pytest.raises(ValueError): fn([], [])
    with pytest.raises(ValueError): ece([], [1])
    for k, n in ((2, 1), (-1, 1), (1, -1), (1.5, 2)):
        with pytest.raises(ValueError): wilson(k, n)
    for kwargs in ({"target": 1.1}, {"target": 0.9, "min_n": 0}, {"target": 0.9, "z": 0}):
        with pytest.raises(ValueError): threshold_for_precision([0.9], [1], **kwargs)
    assert rule_of_three(1) == 1.0
    assert math.isnan(check_report([], [], 0.5).base_rate)


def test_cascade_rejects_negative_cost_and_invalid_shares():
    row = {"flag": 0.5, "cheap_ok": 1, "strong_ok": 1, "cheap_cost": -1, "check_cost": 0, "strong_cost": 1}
    with pytest.raises(ValueError): cascade_at([row], 0.5)
    with pytest.raises(ValueError): cascade_at([], 0.5)
    with pytest.raises(ValueError): cascade_bill(100, -0.1, 0.2, 1, 10)
    with pytest.raises(ValueError): cascade_bill(100, 0.1, 0.2, 1, 0)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -0.1, 1.1, True, "0.7"])
def test_invalid_policy_floor_cannot_route(value):
    with pytest.raises(ValueError): Policy(floor=value)


def test_score_thresholds_must_be_ordered_and_finite():
    answer = ScoreAnswer(2.0, {0: 0.0, 1: 0.0, 2: 1.0}, 1.0)
    for bands in ([2, 1], [1, 1], [float("nan")], [True]):
        with pytest.raises(ValueError): route_score(answer, bands)
    with pytest.raises(ValueError): route_score(answer, [1], conf_floor=float("nan"))


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -0.1, 1.1, True, "0.5"])
def test_backend_confidence_is_finite_and_bounded(value):
    question = Choice("pick", {"a": "A", "b": "B"})
    with pytest.raises(AnswerSpaceError) as error:
        parse_answer(question, {"choice": "a", "probabilities": {"a": 0.8, "b": 0.2}, "confidence": value})
    assert error.value.code == "S1_CONFIDENCE_RANGE"


def test_score_probability_keys_cannot_collapse_into_one_level():
    for probabilities in ({0: 0.5, "0": 0.25, "1": 0.5}, {False: 0.5, "1": 0.5}, {0.5: 0.5, "1": 0.5}):
        with pytest.raises(AnswerSpaceError, match="S1_PROB_KEYS"):
            parse_answer(Score("how much", ["low", "high"]), {"score": 0.5, "probabilities": probabilities})


def test_typed_answer_and_identifier_shapes_fail_closed():
    with pytest.raises(AnswerSpaceError, match="S1_ANSWER_SHAPE"): parse_answer(Noul("q"), [])
    with pytest.raises(AnswerSpaceError, match="S1_PROB_RANGE"): parse_answer(Noul("q"), {"noul": True})
    with pytest.raises(AnswerSpaceError, match="S1_ANSWER_IDS"): parse_all({"q": Noul("q")}, {"q": {"noul": 1}, "extra": {"noul": 1}})


def test_hosted_adapter_refuses_model_drift_before_releasing_answer():
    questions = {"q": Noul("q")}
    adapter = HostedAdapter(lambda request: {"model": "jev-9.9.9", "answers": {"q": {"noul": 1}}}, "jev-1.14.0")
    with pytest.raises(AnswerSpaceError, match="S1_MODEL_MISMATCH"): adapter.ask({}, questions)
    assert adapter.served_model is None and adapter.last_usage is None


def test_hosted_adapter_validates_typed_payload_and_clears_stale_metadata():
    response = {"model": "jev-1.14.0", "answers": {"q": {"noul": 1}}, "usage": {"input_tokens": 10}}
    adapter = HostedAdapter(lambda request: response, "jev-1.14.0")
    adapter.ask({}, {"q": Noul("q")})
    response["answers"]["q"] = {"noul": float("nan")}
    with pytest.raises(AnswerSpaceError): adapter.ask({}, {"q": Noul("q")})
    assert adapter.served_model is None and adapter.last_usage is None


def test_policy_default_is_part_of_the_receipt_identity():
    first = triage(SCENE, ["scene.has_lights"], policy=Policy(default=ActionPolicy("first", "low", 0.7)))
    second = triage(SCENE, ["scene.has_lights"], policy=Policy(default=ActionPolicy("second", "high", 0.7)))
    assert first["receipt_sha256"] != second["receipt_sha256"]


def test_budget_loss_of_required_judgment_context_abstains_before_backend():
    backend = StubBackend(lambda *args: pytest.fail("missing mandatory context must not be judged"))
    receipt = triage(SCENE, ["scene.subject"], backend=backend, budget_bytes=1)
    answer = receipt["answers"][0]
    assert answer["source"] == "skipped" and answer["route"] == "escalate_oracle"
    assert answer["code"] == "S1_MISSING_FACET" and answer["missing_facets"]
    assert backend.calls == [] and receipt["totals"]["backend_calls"] == 0
