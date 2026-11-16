"""The documented confidence statistics, in plain Python.

Source: TypeSafe docs, "Confidence" page (docs.typesafe.ai/confidence, read 16 Nov 2026). Confidence is a
*concentration* statistic of the returned probabilities, NOT the probability that the chosen answer is right;
the docs recommend thresholding the probability of the option you act on instead. Formulas:

  Choice : (p_max - 1/n) / (1 - 1/n)
  Score  : max(0, 1 - sum_i p_i |i - m| / MAD_unif),  MAD_unif = (1/n) sum_i |i - (n-1)/2|,  m = argmax
  Noul   : no field; |2p - 1| puts it on the same 0..1 scale
"""
from __future__ import annotations

from typing import Sequence


def _norm(p: Sequence[float]) -> list[float]:
    s = float(sum(p))
    if s <= 0:
        raise ValueError("probabilities must have positive mass")
    return [x / s for x in p]


def top_probability(p: Sequence[float]) -> float:
    return max(_norm(p))


def top_to_second(p: Sequence[float]) -> float:
    q = sorted(_norm(p), reverse=True)
    if len(q) < 2:
        raise ValueError("need at least two options")
    return float("inf") if q[1] == 0 else q[0] / q[1]


def choice_confidence(p: Sequence[float]) -> float:
    q = _norm(p)
    n = len(q)
    if n < 2:
        raise ValueError("a Choice has at least two options")
    return (max(q) - 1.0 / n) / (1.0 - 1.0 / n)


def score_confidence(p: Sequence[float]) -> float:
    q = _norm(p)
    n = len(q)
    if n < 2:
        raise ValueError("a Score has at least two levels")
    m = q.index(max(q))                      # first maximum, as the vendor's reference code does
    spread = sum(x * abs(i - m) for i, x in enumerate(q))
    even = sum(abs(i - (n - 1) / 2) for i in range(n)) / n
    return max(0.0, 1.0 - spread / even)


def noul_confidence(p: float) -> float:
    if not 0.0 <= p <= 1.0:
        raise ValueError("a Noul probability is in [0, 1]")
    return abs(2.0 * p - 1.0)
