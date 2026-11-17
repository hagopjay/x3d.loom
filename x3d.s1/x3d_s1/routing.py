"""Turn probabilities into routes (suspected_ok, escalate_oracle, defer_human), per action, in code you can review.

Thresholds live in a Policy, not in a prompt: risk tolerance is configuration. The patterns come from the
public System One docs (routing by probability, routing by confidence, screen with a Noul first) and are
re-expressed here; every Decision carries the numbers it was made with, so it can go into a receipt.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
import math
from numbers import Real
from typing import Mapping

from .questions import ChoiceAnswer, ScoreAnswer, NoulAnswer

# Route names follow the Loom: a model answer is grade S and may only choose the ORDER of work and what a person sees
# first. It never turns a required witness green, so no route is named pass, fail or act.
SUSPECTED_OK, ESCALATE_ORACLE, DEFER_HUMAN = "suspected_ok", "escalate_oracle", "defer_human"
ACT, CHECK, ESCALATE = SUSPECTED_OK, ESCALATE_ORACLE, DEFER_HUMAN   # short aliases used inside this module and its tests
STAKES = ("low", "medium", "high", "irreversible")


def _probability(value, name):
    if isinstance(value, bool) or not isinstance(value, Real) or not math.isfinite(value) or not 0 <= value <= 1:
        raise ValueError(f"{name} must be a finite probability within [0, 1]")


def _bands(yes, no):
    _probability(yes, "yes"); _probability(no, "no")
    if not no < yes:
        raise ValueError("need 0 <= no < yes <= 1")


@dataclass(frozen=True)
class ActionPolicy:
    action: str
    stakes: str = "medium"
    min_p: float = 0.7           # advisory flag threshold; required witnesses still run independently
    never_auto: bool = False     # irreversible actions can reach escalate_oracle at best

    def __post_init__(self):
        if not isinstance(self.action, str) or not self.action.strip():
            raise ValueError("action must be a non-empty string")
        if self.stakes not in STAKES:
            raise ValueError(f"stakes must be one of {STAKES}")
        _probability(self.min_p, "min_p")


@dataclass(frozen=True)
class Policy:
    floor: float = 0.5                                   # below this probability nobody acts
    actions: Mapping[str, ActionPolicy] = field(default_factory=dict)
    default: ActionPolicy = ActionPolicy("default", "medium", 0.7)

    def __post_init__(self):
        _probability(self.floor, "floor")
        if not isinstance(self.default, ActionPolicy) or not isinstance(self.actions, Mapping):
            raise ValueError("default and action entries must be ActionPolicy objects")
        if any(not isinstance(k, str) or not isinstance(v, ActionPolicy) for k, v in self.actions.items()):
            raise ValueError("actions must map option strings to ActionPolicy objects")

    def for_option(self, option: str) -> ActionPolicy:
        return self.actions.get(option, self.default)


@dataclass(frozen=True)
class Decision:
    outcome: str                 # suspected_ok | escalate_oracle | defer_human
    reason: str
    p: float
    bar: float
    floor: float
    option: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def route_choice(answer: ChoiceAnswer, policy: Policy) -> Decision:
    """Routing by probability: threshold the probability of the option your code will act on."""
    pol = policy.for_option(answer.choice)
    p = answer.p
    _probability(p, "chosen probability")
    if p < policy.floor:
        return Decision(ESCALATE, f"p={p:.3f} is below the floor {policy.floor:.2f}", p, pol.min_p, policy.floor, answer.choice)
    if pol.never_auto:
        return Decision(CHECK, f"{pol.action!r} is irreversible: run the oracle even at p={p:.3f}", p, 1.0, policy.floor, answer.choice)
    if p >= pol.min_p:
        return Decision(ACT, f"p={p:.3f} meets the {pol.stakes}-stakes bar {pol.min_p:.2f}", p, pol.min_p, policy.floor, answer.choice)
    return Decision(CHECK, f"p={p:.3f} is above the floor but below the {pol.stakes}-stakes bar {pol.min_p:.2f}", p, pol.min_p, policy.floor, answer.choice)


def route_noul(answer: NoulAnswer, yes: float = 0.7, no: float = 0.3) -> str:
    """Three-way read of a Noul: 'yes' above `yes`, 'no' below `no`, else 'unsure' (its own outcome, never rounded)."""
    _bands(yes, no); _probability(answer.noul, "noul")
    if answer.noul > yes:
        return "yes"
    if answer.noul < no:
        return "no"
    return "unsure"


def route_score(answer: ScoreAnswer, bands: list[float], conf_floor: float = 0.5) -> str:
    """Routing by confidence: an answer spread across distant levels goes to a person; the rest route on the
    score using ascending `bands` (len(bands)+1 outcomes: 'band0' .. 'bandN'). Returns 'defer_human' or 'bandK'."""
    _probability(answer.confidence, "confidence"); _probability(conf_floor, "conf_floor")
    if not isinstance(answer.score, Real) or not math.isfinite(answer.score):
        raise ValueError("score must be finite")
    if any(isinstance(b, bool) or not isinstance(b, Real) or not math.isfinite(b) for b in bands) or any(a >= b for a, b in zip(bands, bands[1:])):
        raise ValueError("score bands must be finite and strictly ascending")
    if answer.confidence < conf_floor:
        return ESCALATE
    k = sum(1 for b in bands if answer.score >= b)
    return f"band{k}"


def screen(noul: NoulAnswer, yes: float = 0.7, no: float = 0.3) -> str:
    """Route optional advisory work: 'run', 'skip', or 'cheap'. Never skip a required Loom witness.

    This helper knows nothing about a required witness plan and conveys no release authority.
    """
    r = route_noul(noul, yes, no)
    return {"yes": "run", "no": "skip", "unsure": "cheap"}[r]
