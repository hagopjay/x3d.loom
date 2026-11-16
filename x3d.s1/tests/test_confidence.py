"""Anchors: worked examples printed in the public System One docs (read 16 Nov 2026): the documented formula
reproduces the documented `confidence` to within 0.02 on all of them. The article's own figure does not."""
import pytest

from x3d_s1.confidence import choice_confidence, noul_confidence, score_confidence, top_probability, top_to_second

CHOICE_EXAMPLES = [  # (probabilities, confidence printed in the docs)
    ([0.96, 0.01, 0.03], 0.94), ([1.0, 0.0, 0.0, 0.0], 1.0), ([0.04, 0.35, 0.61], 0.42), ([0.0, 0.26, 0.0, 0.0, 0.74], 0.67),
    ([0.34, 0.4, 0.02, 0.24], 0.20), ([0.84, 0.16, 0.0], 0.76), ([0.0, 1.0], 1.0),
]
SCORE_EXAMPLES = [
    ([0.01, 0.14, 0.07, 0.19, 0.59], 0.34), ([0.0, 0.01, 0.99], 0.98), ([0.0, 0.57, 0.43], 0.35), ([0.0, 0.76, 0.24], 0.64),
    ([0.0, 0.72, 0.28], 0.58), ([0.0, 0.0, 0.0, 1.0], 1.0),
]


@pytest.mark.parametrize("p,doc", CHOICE_EXAMPLES)
def test_choice_matches_docs(p, doc):
    assert choice_confidence(p) == pytest.approx(doc, abs=0.02)


@pytest.mark.parametrize("p,doc", SCORE_EXAMPLES)
def test_score_matches_docs(p, doc):
    assert score_confidence(p) == pytest.approx(doc, abs=0.02)


def test_confidence_is_concentration_not_hit_rate():
    # same p_max, different n: one confidence bar means different risk per question
    assert choice_confidence([0.75, 0.25]) == pytest.approx(0.5)
    assert choice_confidence([0.55] + [0.05] * 9) == pytest.approx(0.5, abs=0.001) or choice_confidence([0.55] + [0.05] * 9) < 0.5
    assert top_probability([0.75, 0.25]) == pytest.approx(0.75)


def test_article_figure_does_not_match_documented_formula():
    # the article's diagram prints 0.596 for (0.159, 0.840, 0.001); the documented formula gives 0.760
    assert choice_confidence([0.159, 0.840, 0.001]) == pytest.approx(0.760, abs=0.001)
    assert abs(choice_confidence([0.159, 0.840, 0.001]) - 0.596) > 0.15


def test_score_far_split_costs_more_than_adjacent_split():
    adjacent = score_confidence([0.0, 0.5, 0.5, 0.0, 0.0])
    far = score_confidence([0.5, 0.0, 0.0, 0.0, 0.5])
    assert adjacent > far == 0.0


def test_noul_scale_and_bounds():
    assert noul_confidence(0.5) == 0.0 and noul_confidence(1.0) == 1.0 and noul_confidence(0.0) == 1.0
    with pytest.raises(ValueError):
        noul_confidence(1.2)


def test_top_to_second_and_degenerate_inputs():
    assert top_to_second([0.6, 0.3, 0.1]) == pytest.approx(2.0)
    assert top_to_second([1.0, 0.0]) == float("inf")
    with pytest.raises(ValueError):
        choice_confidence([1.0])
    with pytest.raises(ValueError):
        choice_confidence([0.0, 0.0])
