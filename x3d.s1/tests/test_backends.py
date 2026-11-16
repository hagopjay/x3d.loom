import json

import pytest

from x3d_s1.backends import (HostedAdapter, ReplayBackend, StubBackend, build_request, check_limits, estimate_cost_usd,
                             estimate_input_tokens, parse_all)
from x3d_s1.questions import AnswerSpaceError, Choice, Noul


def qs():
    return {"has_light": Noul("The scene has a light."), "pick": Choice("Pick", {"a": "A", "b": "B"})}


GOOD = {"model": "jev-1.14.0", "usage": {"input_tokens": 120, "output_tokens": 4},
        "answers": {"has_light": {"type": "noul", "noul": 0.97},
                    "pick": {"type": "choice", "choice": "a", "confidence": 0.8, "probabilities": {"a": 0.9, "b": 0.1}}}}


def test_request_shape_matches_documented_wire_format():
    req = build_request("jev-1.14.0", {"lights": 1}, qs())
    assert set(req) == {"model", "state", "questions"}
    assert req["questions"]["has_light"] == {"type": "noul", "instructions": "The scene has a light."}
    assert req["questions"]["pick"]["criteria"] == {"a": "A", "b": "B"}
    with pytest.raises(ValueError):
        build_request("jev-1.14.0", {}, {})


def test_aliases_are_refused_pin_a_version():
    for alias in ("jev-latest", "jev-preview"):
        with pytest.raises(ValueError, match="S1_MODEL_NOT_PINNED"):
            HostedAdapter(lambda r: GOOD, model=alias)
    HostedAdapter(lambda r: GOOD, model="jev-1.14.0")
    with pytest.raises(ValueError):
        HostedAdapter(lambda r: GOOD, model="")


def test_adapter_uses_injected_transport_and_parses():
    seen = {}
    def transport(req):
        seen["req"] = req
        return GOOD
    ad = HostedAdapter(transport, model="jev-1.14.0")
    raw = ad.ask({"lights": 1}, qs())
    parsed = parse_all(qs(), raw)
    assert parsed["has_light"].noul == 0.97 and parsed["pick"].p == 0.9
    assert seen["req"]["model"] == "jev-1.14.0" and ad.served_model == "jev-1.14.0" and ad.last_usage["input_tokens"] == 120


def test_adapter_refuses_unanswered_or_extra_ids():
    bad = dict(GOOD, answers={"has_light": GOOD["answers"]["has_light"]})
    with pytest.raises(AnswerSpaceError) as e:
        HostedAdapter(lambda r: bad, model="jev-1.14.0").ask({}, qs())
    assert e.value.code == "S1_ANSWER_IDS"


def test_out_of_space_answer_is_refused_at_parse():
    raw = {"has_light": {"type": "noul", "noul": 0.9}, "pick": {"type": "choice", "choice": "zzz", "probabilities": {"a": 0.5, "b": 0.5}}}
    with pytest.raises(AnswerSpaceError):
        parse_all(qs(), raw)


def test_cost_arithmetic_matches_the_article_figure():
    # the article's diagram: 312 input tokens at 0.042 USD per million tokens is about 13 USD per million requests
    assert 312 * 0.042 / 1_000_000 == pytest.approx(1.31e-5, rel=0.01)
    req = build_request("jev-1.14.0", {"x": "y" * 1000}, {"q": Noul("The scene has a light.")})
    t = estimate_input_tokens(req)
    assert estimate_cost_usd(req) == pytest.approx(t * 0.042 / 1e6)


def test_limits_check_blocks_oversize_state():
    big = build_request("jev-1.14.0", {"blob": "x" * 400_000}, {"q": Noul("Is it big?")})
    assert check_limits(big)
    with pytest.raises(AnswerSpaceError) as e:
        HostedAdapter(lambda r: GOOD, model="jev-1.14.0").ask({"blob": "x" * 400_000}, {"q": Noul("Is it big?")})
    assert e.value.code == "S1_OVER_BUDGET"
    assert check_limits(build_request("jev-1.14.0", {"a": 1}, {"q": Noul("Is it big?")})) == []


def test_replay_and_stub_do_not_invent_answers():
    rb = ReplayBackend({"has_light": GOOD["answers"]["has_light"]})
    with pytest.raises(KeyError):
        rb.ask({}, qs())
    sb = StubBackend(lambda qid, q, st: {"type": "noul", "noul": 0.5})
    assert sb.ask({}, {"x": Noul("x")}) == {"x": {"type": "noul", "noul": 0.5}} and sb.calls == [["x"]]
