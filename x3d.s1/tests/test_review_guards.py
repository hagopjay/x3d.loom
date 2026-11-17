"""Each test reaches one guard on its own and expects its stable error, so a removed guard turns exactly this test red (review of #84)."""
import pytest

from x3d_s1.backends import HostedAdapter, StubBackend
from x3d_s1.calibration import brier, log_loss, wilson
from x3d_s1.decidable import D, QSpec, exact_answer
from x3d_s1.pipeline import triage
from x3d_s1.questions import AnswerSpaceError, Choice, ChoiceAnswer, Noul, NoulAnswer, parse_answer
from x3d_s1.routing import ActionPolicy, Policy, route_choice, route_noul

SCENE = b"<X3D profile='Interchange' version='4.0'><Scene><Viewpoint/></Scene></X3D>"
MODEL = "jev-1.14.0"


def adapter(response):
    return HostedAdapter(lambda request: response, MODEL)


# ---- hosted response shape
def test_hosted_response_must_be_an_object():
    with pytest.raises(AnswerSpaceError, match="S1_RESPONSE_SHAPE"):
        adapter([]).ask({}, {"q": Noul("q")})


def test_hosted_answers_must_be_an_object():
    with pytest.raises(AnswerSpaceError, match="S1_RESPONSE_SHAPE"):
        adapter({"model": MODEL, "answers": [1]}).ask({}, {"q": Noul("q")})


# ---- the model pin
@pytest.mark.parametrize("model", [" jev-1.14.0", "jev-1.14.0 ", "jev-1.14.0\n"])
def test_pin_refuses_padded_identifiers(model):
    with pytest.raises(ValueError, match="S1_MODEL_NOT_PINNED"):
        HostedAdapter(lambda r: {}, model)


@pytest.mark.parametrize("model", ["jev", "jev-one", "jev-14"])
def test_pin_refuses_identifiers_with_no_version_or_date(model):
    with pytest.raises(ValueError, match="S1_MODEL_NOT_PINNED"):
        HostedAdapter(lambda r: {}, model)


@pytest.mark.parametrize("model", ["jev-1.14.0-preview2", "x-1.2-current", "jev-1.14.0-beta", "jev-latest", "jev-1.14.0-stable"])
def test_pin_refuses_alias_words_even_beside_a_version(model):
    with pytest.raises(ValueError, match="S1_MODEL_NOT_PINNED"):
        HostedAdapter(lambda r: {}, model)


@pytest.mark.parametrize("model", ["jev-1.14.0", "vendor-model-20250929", "vendor-model-2024-08-06"])
def test_pin_accepts_a_dotted_version_or_a_date_stamp(model):
    assert HostedAdapter(lambda r: {}, model).model == model


# ---- typed answers
def test_choice_value_must_be_a_string_option():
    q = Choice("pick", {"a": "A", "b": "B"})
    with pytest.raises(AnswerSpaceError):
        parse_answer(q, {"type": "choice", "choice": ["a"], "probabilities": {"a": 0.9, "b": 0.1}})


def test_choice_and_score_need_probabilities():
    q = Choice("pick", {"a": "A", "b": "B"})
    with pytest.raises(AnswerSpaceError, match="S1_ANSWER_SHAPE"):
        parse_answer(q, {"type": "choice", "choice": "a"})


def test_a_number_too_large_for_a_float_fails_closed_not_with_overflow():
    with pytest.raises(AnswerSpaceError, match="S1_PROB_RANGE"):
        parse_answer(Noul("q"), {"noul": 10 ** 400})
    for call in (lambda: brier([10 ** 400], [1]), lambda: brier([0.5], [10 ** 400]), lambda: log_loss([10 ** 400], [1]),
                 lambda: route_noul(NoulAnswer(0.5), 10 ** 400, 0.2)):
        with pytest.raises(ValueError):
            call()


# ---- routing
def test_route_choice_refuses_a_non_probability():
    with pytest.raises(ValueError, match="chosen probability"):
        route_choice(ChoiceAnswer("a", {"a": float("nan"), "b": 0.0}, 1.0), Policy())


def test_policy_actions_must_be_a_mapping_of_action_policies():
    with pytest.raises(ValueError):
        Policy(actions=[("a", ActionPolicy("x", "low", 0.7))])
    with pytest.raises(ValueError):
        Policy(actions={"a": "not a policy"})
    with pytest.raises(ValueError):
        Policy(actions={1: ActionPolicy("x", "low", 0.7)})


@pytest.mark.parametrize("action", ["", "   ", None, 3])
def test_action_policy_needs_a_real_action_name(action):
    with pytest.raises(ValueError, match="action must be a non-empty string"):
        ActionPolicy(action, "low", 0.7)


# ---- exact answers stay binary
def test_a_noul_exact_function_that_is_not_binary_is_refused():
    spec = QSpec("t.odd", D, Noul("q"), "test", exact=lambda state: 2)
    with pytest.raises(ValueError, match="exact binary answer"):
        exact_answer(spec, {})


# ---- statistics
def test_wilson_refuses_k_above_n_with_its_own_message():
    with pytest.raises(ValueError, match="0 <= k <= n"):
        wilson(5, 4)


def test_wilson_refuses_a_zero_z_instead_of_returning_a_point():
    with pytest.raises(ValueError, match="positive z"):
        wilson(1, 2, z=0)


@pytest.mark.parametrize("eps", [0, 0.5])
def test_log_loss_eps_must_lie_strictly_inside_zero_and_one_half(eps):
    with pytest.raises(ValueError, match="strictly between"):
        log_loss([0.5], [1], eps=eps)


# ---- receipt honesty
def test_a_run_that_made_no_backend_call_attests_to_no_served_model():
    served = HostedAdapter(lambda r: {"model": MODEL, "answers": {"scene.subject": {"type": "choice", "choice": "other",
                                                                                        "probabilities": {}}}}, MODEL)
    served.served_model = MODEL                                          # left over from an earlier call on this adapter
    receipt = triage(SCENE, ["scene.has_lights"], backend=served)        # a D-only run: the adapter is never asked
    assert receipt["totals"]["backend_calls"] == 0 and receipt["served_model"] is None
    receipt = triage(SCENE, ["scene.subject"], backend=served, budget_bytes=1)   # slice removed the facet: abstains before any call
    assert receipt["totals"]["backend_calls"] == 0 and receipt["served_model"] is None
