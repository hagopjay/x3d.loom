import pytest

from x3d_s1.questions import (AnswerSpaceError, Choice, ChoiceAnswer, Noul, NoulAnswer, Score, ScoreAnswer, companion_gate,
                              confidence_mismatch, parse_answer, with_companion)


def opts(n):
    return {f"o{i}": f"option {i}" for i in range(n)}


def test_choice_bounds_2_to_255():
    Choice("q", opts(2)); Choice("q", opts(255))
    for n in (0, 1, 256):
        with pytest.raises(AnswerSpaceError) as e:
            Choice("q", opts(n))
        assert e.value.code == "S1_OPTIONS_LIMIT"


def test_score_bounds_2_to_10():
    Score("q", [str(i) for i in range(2)]); Score("q", [str(i) for i in range(10)])
    for n in (0, 1, 11):
        with pytest.raises(AnswerSpaceError) as e:
            Score("q", [str(i) for i in range(n)])
        assert e.value.code == "S1_LEVELS_LIMIT"


def test_wire_shape():
    assert Noul("The scene has a light.").to_wire() == {"type": "noul", "instructions": "The scene has a light."}
    w = Choice("Pick", {"a": "A", "b": "B"}).to_wire()
    assert w == {"type": "choice", "instructions": "Pick", "criteria": {"a": "A", "b": "B"}}
    assert Score("How much", ["none", "some", "lots"]).to_wire()["criteria"] == ["none", "some", "lots"]


def test_empty_text_refused():
    with pytest.raises(AnswerSpaceError):
        Noul("   ")
    with pytest.raises(AnswerSpaceError):
        Choice("q", {"a": "", "b": "B"})


def test_parse_choice_ok_and_recomputes_missing_confidence():
    q = Choice("q", {"a": "A", "b": "B", "c": "C"})
    a = parse_answer(q, {"type": "choice", "choice": "a", "probabilities": {"a": 0.84, "b": 0.16, "c": 0.0}})
    assert isinstance(a, ChoiceAnswer) and a.p == 0.84 and a.confidence == pytest.approx(0.76, abs=0.005)


@pytest.mark.parametrize("raw,code", [
    ({"type": "choice", "choice": "z", "probabilities": {"a": 0.5, "b": 0.5, "c": 0.0}}, "S1_CHOICE_OUT_OF_SPACE"),
    ({"type": "choice", "choice": "a", "probabilities": {"a": 0.5, "b": 0.5}}, "S1_PROB_KEYS"),
    ({"type": "choice", "choice": "a", "probabilities": {"a": 0.9, "b": 0.9, "c": 0.0}}, "S1_PROB_SUM"),
    ({"type": "noul", "noul": 0.3}, "S1_TYPE_MISMATCH"),
    ({"type": "choice", "choice": "a", "probabilities": {"a": float("nan"), "b": 0.5, "c": 0.5}}, "S1_PROB_RANGE"),
])
def test_out_of_space_answers_cannot_enter_and_name_their_reason(raw, code):
    with pytest.raises(AnswerSpaceError) as e:
        parse_answer(Choice("q", {"a": "A", "b": "B", "c": "C"}), raw)
    assert e.value.code == code     # a negative control must fail for the intended reason


def test_parse_score_and_noul():
    s = parse_answer(Score("q", ["l0", "l1", "l2"]), {"type": "score", "score": 1.43, "probabilities": {"0": 0.0, "1": 0.57, "2": 0.43}})
    assert isinstance(s, ScoreAnswer) and s.score == pytest.approx(1.43) and s.confidence == pytest.approx(0.355, abs=0.01)
    with pytest.raises(AnswerSpaceError) as e:
        parse_answer(Score("q", ["l0", "l1", "l2"]), {"type": "score", "score": 2.5, "probabilities": {"0": 0.0, "1": 0.57, "2": 0.43}})
    assert e.value.code == "S1_SCORE_RANGE"
    assert parse_answer(Noul("q"), {"type": "noul", "noul": 0.25}) == NoulAnswer(0.25)
    with pytest.raises(AnswerSpaceError):
        parse_answer(Noul("q"), {"type": "noul", "noul": 1.5})


def test_confidence_mismatch_audit():
    q = Choice("q", {"a": "A", "b": "B", "c": "C"})
    a = parse_answer(q, {"type": "choice", "choice": "b", "probabilities": {"a": 0.159, "b": 0.840, "c": 0.001}, "confidence": 0.596})
    assert confidence_mismatch(q, a) > 0.15  # the article's number against the documented formula


def test_companion_gate():
    c, n = with_companion(Choice("q", {"a": "A", "b": "B"}))
    assert isinstance(n, Noul)
    ca = ChoiceAnswer("a", {"a": 0.9, "b": 0.1}, 0.8)
    assert companion_gate(ca, NoulAnswer(0.95)) == "use"
    assert companion_gate(ca, NoulAnswer(0.5)) == "unsure"
    assert companion_gate(ca, NoulAnswer(0.1)) == "ignore"
    assert companion_gate(ChoiceAnswer("a", {"a": 0.6, "b": 0.4}, 0.2), NoulAnswer(0.95)) == "unsure"


@pytest.mark.parametrize("total,ok", [(0.985, True), (1.015, True), (1.03, False), (0.97, False), (0.9, False)])
def test_probability_sum_tolerance_is_tight_both_sides(total, ok):
    q = Choice("q", {"a": "A", "b": "B"})
    raw = {"type": "choice", "choice": "a", "probabilities": {"a": total - 0.4, "b": 0.4}}
    if ok:
        parse_answer(q, raw)
    else:
        with pytest.raises(AnswerSpaceError) as e:
            parse_answer(q, raw)
        assert e.value.code == "S1_PROB_SUM"
