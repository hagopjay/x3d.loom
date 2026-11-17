"""Calibration and cascade math. Pure Python; every function states what it measures.

The central move: X3D supplies EXACT outcomes (a validator verdict, a gate, a FLIP error against a reference
render), so a judge's probabilities can be scored against ground truth for free. Calibration is a property of
groups of predictions; these functions measure it on groups you give them and say how much data backs the number.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from numbers import Real
from typing import Iterable, Sequence


def _real(value, name, lo=0.0, hi=1.0):
    if isinstance(value, bool) or not isinstance(value, Real) or not math.isfinite(value) or not lo <= value <= hi:
        raise ValueError(f"{name} must be a finite number within [{lo}, {hi}]")
    return float(value)


def _count(value, name, minimum=0):
    if type(value) is not int or value < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}")


def _pairs(probs, outcomes, allow_empty=True):
    if len(probs) != len(outcomes):
        raise ValueError("probs and outcomes differ in length")
    if not allow_empty and not probs:
        raise ValueError("at least one observation is required")
    for p in probs:
        _real(p, "probability")
    for outcome in outcomes:
        if not isinstance(outcome, Real) or not math.isfinite(outcome) or outcome not in (0, 1):
            raise ValueError("outcomes must be binary 0/1 labels")


@dataclass(frozen=True)
class Bin:
    lo: float
    hi: float
    n: int
    mean_p: float      # mean predicted probability in the bin
    freq: float        # observed frequency of the event in the bin


def reliability(probs: Sequence[float], outcomes: Sequence[int], bins: int = 10) -> list[Bin]:
    """Equal-width reliability bins over [0, 1]. outcomes are 0/1. Empty bins are omitted."""
    _pairs(probs, outcomes)
    _count(bins, "bins", 1)
    out = []
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        idx = [i for i, p in enumerate(probs) if (lo <= p < hi) or (b == bins - 1 and p == 1.0)]
        if not idx:
            continue
        out.append(Bin(lo, hi, len(idx), sum(probs[i] for i in idx) / len(idx), sum(outcomes[i] for i in idx) / len(idx)))
    return out


def ece(probs: Sequence[float], outcomes: Sequence[int], bins: int = 10) -> float:
    """Expected calibration error: sum over bins of (n_b / N) |freq_b - mean_p_b|."""
    rb = reliability(probs, outcomes, bins)
    n = len(probs)
    return sum(b.n / n * abs(b.freq - b.mean_p) for b in rb) if n else float("nan")


def mce(probs, outcomes, bins: int = 10) -> float:
    """Maximum calibration error over non-empty bins (noisy for small bins; report with bin sizes)."""
    rb = reliability(probs, outcomes, bins)
    return max(abs(b.freq - b.mean_p) for b in rb) if rb else float("nan")


def brier(probs: Sequence[float], outcomes: Sequence[int]) -> float:
    _pairs(probs, outcomes, allow_empty=False)
    return sum((p - o) ** 2 for p, o in zip(probs, outcomes)) / len(probs)


def log_loss(probs: Sequence[float], outcomes: Sequence[int], eps: float = 1e-12) -> float:
    _pairs(probs, outcomes, allow_empty=False)
    _real(eps, "eps", 0, 0.5)
    if eps <= 0 or eps >= 0.5:
        raise ValueError("eps must lie strictly between zero and one half")
    s = 0.0
    for p, o in zip(probs, outcomes):
        p = min(max(p, eps), 1 - eps)
        s += -(o * math.log(p) + (1 - o) * math.log(1 - p))
    return s / len(probs)


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion (default 95%). (0, 1) when n == 0."""
    _count(n, "n"); _count(k, "k"); _real(z, "z", 0, float("inf"))
    if k > n or z <= 0:
        raise ValueError("need 0 <= k <= n and positive z")
    if n == 0:
        return (0.0, 1.0)
    ph = k / n
    d = 1 + z * z / n
    c = ph + z * z / (2 * n)
    h = z * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))
    return ((c - h) / d, (c + h) / d)


def rule_of_three(n: int) -> float:
    """Upper 95% bound on a rate when 0 events were seen in n trials."""
    _count(n, "n")
    return min(1.0, 3.0 / n) if n else 1.0


def threshold_for_precision(scores: Sequence[float], correct: Sequence[int], target: float,
                            min_n: int = 30, z: float = 1.96):
    """Lowest threshold t such that answers with score >= t have Wilson LOWER bound >= target and at least min_n members.
    Returns (t, n, k, lower_bound) or None. Using the lower bound keeps a lucky small bin from setting a bar.

    This selects a threshold on the supplied data. Its interval is not a simultaneous bound over the threshold
    search, nor an out-of-sample guarantee. Freeze the selected threshold and evaluate on an independent holdout.
    """
    _pairs(scores, correct); _real(target, "target"); _count(min_n, "min_n", 1); _real(z, "z", 0, float("inf"))
    if z <= 0:
        raise ValueError("z must be positive")
    order = sorted(set(scores))
    for t in order:
        sel = [c for s, c in zip(scores, correct) if s >= t]
        if len(sel) < min_n:
            break
        lo, _ = wilson(sum(sel), len(sel), z)
        if lo >= target:
            return (t, len(sel), sum(sel), lo)
    return None


@dataclass(frozen=True)
class CheckReport:
    """What a flag-for-review check did to a stream of answers (the shape of the vendor's verify cookbook table)."""
    total: int
    base_correct: int
    passed: int
    passed_correct: int
    flagged: int
    flagged_wrong: int

    @property
    def base_rate(self): return self.base_correct / self.total if self.total else float("nan")
    @property
    def pass_share(self): return self.passed / self.total if self.total else float("nan")
    @property
    def passed_precision(self): return self.passed_correct / self.passed if self.passed else float("nan")
    @property
    def errors_caught(self): return self.flagged_wrong / (self.total - self.base_correct) if self.total > self.base_correct else float("nan")
    @property
    def review_precision(self): return self.flagged_wrong / self.flagged if self.flagged else float("nan")
    @property
    def reviews_per_error_caught(self): return self.flagged / self.flagged_wrong if self.flagged_wrong else float("inf")


def check_report(flag: Sequence[float], correct: Sequence[int], threshold: float) -> CheckReport:
    """Flag answers with risk >= threshold for review; report coverage, precision and the review burden."""
    _pairs(flag, correct); _real(threshold, "threshold")
    n = len(flag)
    passed = [c for f, c in zip(flag, correct) if f < threshold]
    flagged = [c for f, c in zip(flag, correct) if f >= threshold]
    return CheckReport(n, sum(correct), len(passed), sum(passed), len(flagged), len(flagged) - sum(flagged))


def cascade_at(rows: Sequence[dict], threshold: float) -> dict:
    """Cost and quality of a two-rung cascade. Each row: flag (risk from the check), cheap_ok, strong_ok (0/1),
    cheap_cost, check_cost, strong_cost (dollars per task). A task escalates when flag > threshold.
    Returns cost per 1,000 tasks, share that works, and share escalated (the vendor cookbook's definition)."""
    if not rows:
        raise ValueError("at least one cascade row is required")
    _real(threshold, "threshold", -1, 1)
    for r in rows:
        _pairs([r["flag"]], [r["cheap_ok"]]); _pairs([r["flag"]], [r["strong_ok"]])
        for key in ("cheap_cost", "check_cost", "strong_cost"):
            _real(r[key], key, 0, float("inf"))
    n = len(rows)
    esc = [r["flag"] > threshold for r in rows]
    cost = sum(r["cheap_cost"] + r["check_cost"] + (r["strong_cost"] if e else 0.0) for r, e in zip(rows, esc)) / n
    works = sum((r["strong_ok"] if e else r["cheap_ok"]) for r, e in zip(rows, esc)) / n
    return {"threshold": threshold, "cost_per_1000": 1000 * cost, "works": works, "escalated": sum(esc) / n}


def cascade_sweep(rows: Sequence[dict]) -> list[dict]:
    """Every distinct flag value as a threshold, plus 'never escalate' and 'always escalate'."""
    if not rows:
        raise ValueError("at least one cascade row is required")
    ts = sorted({r["flag"] for r in rows})
    pts = [cascade_at(rows, t) for t in [-1.0] + ts]
    return pts


def pareto(points: Iterable[dict], cost="cost_per_1000", quality="works") -> list[dict]:
    """Points no other point beats on both cost (lower) and quality (higher)."""
    pts = sorted(points, key=lambda p: (p[cost], -p[quality]))
    out, best = [], -1.0
    for p in pts:
        if p[quality] > best + 1e-12:
            out.append(p)
            best = p[quality]
    return out


def cascade_bill(volume: int, share_code: float, share_special: float, c_judge: float, c_frontier: float,
                 c_special: float = 0.0) -> dict:
    """Closed-form bill for the article's three-way split. Shares are fractions; the remainder escalates.
    `article_pricing` leaves the specialist unpriced (as the article's $6,480 does); `full` prices it."""
    _count(volume, "volume"); _real(share_code, "share_code"); _real(share_special, "share_special")
    for name, value in (("c_judge", c_judge), ("c_frontier", c_frontier), ("c_special", c_special)):
        _real(value, name, 0, float("inf"))
    if c_frontier <= 0:
        raise ValueError("c_frontier must be positive to compare savings")
    esc = 1.0 - share_code - share_special
    if esc < -1e-9:
        raise ValueError("shares exceed 1")
    frontier_only = volume * c_frontier
    art = volume * c_judge + volume * esc * c_frontier
    full = art + volume * share_special * c_special
    return {"frontier_only": frontier_only, "article_pricing": art, "full": full,
            "saving_article": 1 - art / frontier_only, "saving_full": 1 - full / frontier_only,
            "break_even_escalation": 1 - c_judge / c_frontier}
