"""Reliability before accuracy: how often does asking again change the decision? Needs no answer key.

Method (public System One 'self-consistency' cookbook, re-derived): a pipeline turns a probability into a decision
with some cutoff; we do not know where the cutoff sits, so count every cutoff in [0, 1] equally. Two answers a and b
disagree at the cutoffs between them, a fraction |a - b| of all cutoffs. Average |a - b| over every pair of repeats
to get one number per option (the chance that asking again changes the decision); score a case by its LEAST stable
option, because a pipeline is only as dependable as its shakiest decision.
"""
from __future__ import annotations

import itertools
import random
from typing import Callable, Mapping, Sequence


def flip_probability(a: float, b: float) -> float:
    return abs(a - b)


def option_instability(samples: Sequence[Mapping[str, float]]) -> dict[str, float]:
    """samples: repeated probability dicts for one case. Returns mean pairwise |a-b| per option."""
    if len(samples) < 2:
        raise ValueError("need at least two repeats")
    keys = list(samples[0])
    out = {}
    for k in keys:
        pairs = list(itertools.combinations([s[k] for s in samples], 2))
        out[k] = sum(abs(a - b) for a, b in pairs) / len(pairs)
    return out


def least_stable(samples: Sequence[Mapping[str, float]]) -> tuple[str, float]:
    inst = option_instability(samples)
    k = max(inst, key=inst.get)
    return k, inst[k]


def order_sensitivity(ask: Callable[[Sequence[str]], Mapping[str, float]], options: Sequence[str], trials: int = 8,
                      seed: int = 0) -> dict:
    """Failure mode 8 (Choice option order): call `ask(ordered_options)` under shuffled option orders and report how far each
    option's probability moves, plus whether the winner is stable. `ask` must return {option: probability}."""
    rng = random.Random(seed)
    runs = []
    for _ in range(trials):
        order = list(options)
        rng.shuffle(order)
        runs.append(dict(ask(order)))
    inst = option_instability(runs)
    winners = {max(r, key=r.get) for r in runs}
    return {"instability": inst, "worst_option": max(inst, key=inst.get), "worst": max(inst.values()),
            "winner_stable": len(winners) == 1, "winners": sorted(winners)}
