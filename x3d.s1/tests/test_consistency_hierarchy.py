import pytest

from x3d_s1.consistency import flip_probability, least_stable, option_instability, order_sensitivity
from x3d_s1.hierarchy import beam_classify, classify_with_fallback, path_score


def test_flip_probability_is_the_gap():
    assert flip_probability(0.7, 0.4) == pytest.approx(0.3)


def test_instability_per_option_and_least_stable():
    samples = [{"a": 0.9, "b": 0.1}, {"a": 0.7, "b": 0.3}, {"a": 0.8, "b": 0.2}]
    inst = option_instability(samples)
    assert inst["a"] == pytest.approx((0.2 + 0.1 + 0.1) / 3)
    assert least_stable(samples)[1] == pytest.approx(inst["a"])
    with pytest.raises(ValueError):
        option_instability(samples[:1])


def test_order_bias_is_detected():
    def biased(order):  # always favours whatever is listed first
        return {o: (0.7 if i == 0 else 0.3 / (len(order) - 1)) for i, o in enumerate(order)}
    r = order_sensitivity(biased, ["a", "b", "c"], trials=12)
    assert not r["winner_stable"] and r["worst"] > 0.2

    def steady(order):
        return {"a": 0.8, "b": 0.1, "c": 0.1}
    assert order_sensitivity(steady, ["a", "b", "c"], trials=6)["winner_stable"]


TREE = {"root": ["geometry", "appearance"], "geometry": ["Box", "Sphere", "IndexedFaceSet"], "appearance": ["Material", "ImageTexture"]}


def test_path_score_geometric_mean():
    assert path_score([0.9, 0.9]) == pytest.approx(0.9)
    assert path_score([0.9, 0.0]) == 0.0
    assert path_score([0.5]) == pytest.approx(0.5)


def test_beam_finds_best_leaf():
    table = {"root": {"geometry": 0.8, "appearance": 0.2}, "geometry": {"Box": 0.7, "Sphere": 0.2, "IndexedFaceSet": 0.1},
             "appearance": {"Material": 0.6, "ImageTexture": 0.4}}
    out = beam_classify("root", TREE, lambda n, k: {x: table[n][x] for x in k}, beam=4, top=2)
    assert out[0]["path"] == ["root", "geometry", "Box"] and out[0]["score"] == pytest.approx((0.8 * 0.7) ** 0.5)


def test_parent_fallback_when_leaf_unsure():
    table = {"root": {"geometry": 0.9, "appearance": 0.1}, "geometry": {"Box": 0.4, "Sphere": 0.35, "IndexedFaceSet": 0.25}}
    r = classify_with_fallback("root", TREE, lambda n, k: {x: table[n][x] for x in k}, min_p=0.7)
    assert r["label"] == "geometry" and r["stopped_early"] is True
