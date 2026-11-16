import math

import pytest

from x3d_s1.calibration import (brier, cascade_at, cascade_bill, cascade_sweep, check_report, ece, log_loss, mce, pareto,
                                reliability, rule_of_three, threshold_for_precision, wilson)


def test_perfectly_calibrated_has_zero_ece():
    probs = [0.1] * 10 + [0.9] * 10
    outcomes = [1] + [0] * 9 + [1] * 9 + [0]
    assert ece(probs, outcomes) == pytest.approx(0.0, abs=1e-12)
    assert mce(probs, outcomes) == pytest.approx(0.0, abs=1e-12)


def test_overconfident_has_ece_equal_to_gap():
    probs = [0.9] * 10
    outcomes = [1] * 6 + [0] * 4
    assert ece(probs, outcomes) == pytest.approx(0.3)
    b = reliability(probs, outcomes)
    assert len(b) == 1 and b[0].n == 10 and b[0].freq == 0.6


def test_proper_scores():
    assert brier([1.0, 0.0], [1, 0]) == 0.0
    assert brier([0.5, 0.5], [1, 0]) == 0.25
    assert log_loss([0.5, 0.5], [1, 0]) == pytest.approx(math.log(2))


def test_wilson_known_values():
    lo, hi = wilson(8, 10)
    assert (lo, hi) == pytest.approx((0.490, 0.943), abs=0.001)
    assert wilson(0, 0) == (0.0, 1.0)
    lo0, hi0 = wilson(0, 100)
    assert lo0 == 0.0 and hi0 < 0.04
    assert rule_of_three(100) == pytest.approx(0.03)


def test_threshold_uses_lower_bound_not_lucky_bin():
    # 5 perfectly right answers at the top would set a bar on point precision; the lower bound refuses it (min_n 30)
    scores = [0.99] * 5 + [0.8] * 95
    correct = [1] * 5 + [1] * 93 + [0] * 2   # 98 of 100 right overall
    t = threshold_for_precision(scores, correct, target=0.85, min_n=30)
    assert t is not None and t[0] == 0.8 and t[3] >= 0.85
    assert threshold_for_precision(scores, correct, target=0.99, min_n=30) is None
    # at 90 of 100 the point precision is 0.90, but the 95% lower bound is below 0.85, so no bar is set
    assert threshold_for_precision([0.8] * 100, [1] * 90 + [0] * 10, target=0.85, min_n=30) is None


def test_check_report_arithmetic():
    # 10 answers: 8 right, 2 wrong. The check flags 3 (both wrong ones and one right one)
    flag = [0.1] * 7 + [0.9] * 3
    correct = [1] * 7 + [0, 0, 1]
    r = check_report(flag, correct, 0.5)
    assert (r.total, r.base_correct, r.passed, r.passed_correct, r.flagged, r.flagged_wrong) == (10, 8, 7, 7, 3, 2)
    assert r.passed_precision == 1.0 and r.errors_caught == 1.0 and r.review_precision == pytest.approx(2 / 3)
    assert r.reviews_per_error_caught == pytest.approx(1.5)


def test_article_cascade_arithmetic():
    b = cascade_bill(1_000_000, 0.62, 0.18, 0.0004, 0.0304, 0.003)
    assert b["frontier_only"] == pytest.approx(30_400)
    assert b["article_pricing"] == pytest.approx(6_480)
    assert b["full"] == pytest.approx(7_020)
    assert b["saving_article"] == pytest.approx(0.7868, abs=0.0005)
    assert b["break_even_escalation"] == pytest.approx(0.987, abs=0.001)
    with pytest.raises(ValueError):
        cascade_bill(1, 0.7, 0.6, 1, 1)


def toy_rows():
    # flag is risk; the cheap model is wrong exactly where the flag is high
    rows = []
    for i in range(100):
        risky = i >= 80
        rows.append({"flag": 0.9 if risky else 0.1, "cheap_ok": 0 if risky else 1, "strong_ok": 1, "cheap_cost": 1.0, "check_cost": 0.1, "strong_cost": 10.0})
    return rows


def test_cascade_sweep_and_pareto():
    rows = toy_rows()
    low = cascade_at(rows, 0.5)
    assert low["escalated"] == pytest.approx(0.2) and low["works"] == 1.0
    never = cascade_at(rows, 1.0)
    assert never["works"] == pytest.approx(0.8) and never["cost_per_1000"] < low["cost_per_1000"]
    front = pareto(cascade_sweep(rows))
    assert front[0]["cost_per_1000"] <= front[-1]["cost_per_1000"] and front[-1]["works"] == 1.0


def test_probability_exactly_one_lands_in_the_last_bin():
    rb = reliability([1.0, 1.0, 0.0], [1, 1, 0], bins=10)
    assert [b.n for b in rb] == [1, 2] and rb[-1].hi == 1.0 and rb[-1].mean_p == 1.0
    assert ece([1.0, 1.0, 0.0], [1, 1, 0]) == pytest.approx(0.0, abs=1e-12)
    assert sum(b.n for b in rb) == 3          # nothing is dropped from the report
