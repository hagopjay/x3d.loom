"""Typed questions and answers: the answer space is closed before the question is asked.

Wire shapes follow the public System One request/response format (docs.typesafe.ai, API reference,
read 16 Nov 2026): questions are {"type": "choice"|"score"|"noul", "instructions": ..., "criteria": ...};
answers are {"type": ..., "choice"|"score"|"noul": ..., "probabilities": {...}, "confidence": ...}.
Limits come from the same docs and the launch coverage: a Choice takes at most 255 options, a Score
2 to 10 ordered levels, and a Noul is a probability in [0, 1] with no confidence field.
"""
from __future__ import annotations

import math
from numbers import Real
from dataclasses import dataclass, field
from typing import Mapping, Sequence

from .confidence import choice_confidence, score_confidence

CHOICE_MIN_OPTIONS = 2
CHOICE_MAX_OPTIONS = 255
SCORE_MIN_LEVELS = 2
SCORE_MAX_LEVELS = 10
PROB_SUM_TOL = 0.02  # vendor examples round to 2 or 3 decimals


class AnswerSpaceError(ValueError):
    """An answer fell outside the space its question declared (or a question declared a bad space).

    Every raise carries a stable `code` (S1_*), so a negative control can name the exact reason it expects.
    """
    def __init__(self, code: str, message: str = ""):
        self.code = code
        super().__init__(f"{code}: {message}" if message else code)


@dataclass(frozen=True)
class Choice:
    instructions: str
    criteria: Mapping[str, str]          # option id -> description, order is significant
    needs: tuple[str, ...] = ()          # state facets this question reads (see x3d_s1.state)
    kind: str = field(default="choice", init=False)

    def __post_init__(self):
        n = len(self.criteria)
        if not (CHOICE_MIN_OPTIONS <= n <= CHOICE_MAX_OPTIONS):
            raise AnswerSpaceError("S1_OPTIONS_LIMIT", f"a Choice takes {CHOICE_MIN_OPTIONS}..{CHOICE_MAX_OPTIONS} options, got {n}")
        for k, v in self.criteria.items():
            if not isinstance(k, str) or not k.strip():
                raise AnswerSpaceError("S1_OPTION_ID", "option ids must be non-empty strings")
            if not isinstance(v, str) or not v.strip():
                raise AnswerSpaceError("S1_TEXT_EMPTY", f"option {k!r} needs a description")
        if not self.instructions.strip():
            raise AnswerSpaceError("S1_TEXT_EMPTY", "a question needs instructions")

    @property
    def options(self) -> tuple[str, ...]:
        return tuple(self.criteria)

    def to_wire(self) -> dict:
        return {"type": "choice", "instructions": self.instructions, "criteria": dict(self.criteria)}


@dataclass(frozen=True)
class Score:
    instructions: str
    criteria: Sequence[str]              # ordered level descriptions, lowest first
    needs: tuple[str, ...] = ()
    kind: str = field(default="score", init=False)

    def __post_init__(self):
        n = len(self.criteria)
        if not (SCORE_MIN_LEVELS <= n <= SCORE_MAX_LEVELS):
            raise AnswerSpaceError("S1_LEVELS_LIMIT", f"a Score takes {SCORE_MIN_LEVELS}..{SCORE_MAX_LEVELS} levels, got {n}")
        if not self.instructions.strip() or any(not str(c).strip() for c in self.criteria):
            raise AnswerSpaceError("S1_TEXT_EMPTY", "a Score needs instructions and a description for every level")

    @property
    def levels(self) -> int:
        return len(self.criteria)

    def to_wire(self) -> dict:
        return {"type": "score", "instructions": self.instructions, "criteria": list(self.criteria)}


@dataclass(frozen=True)
class Noul:
    instructions: str                    # a positive statement over named state: "The scene contains ..."
    needs: tuple[str, ...] = ()
    kind: str = field(default="noul", init=False)

    def __post_init__(self):
        if not self.instructions.strip():
            raise AnswerSpaceError("S1_TEXT_EMPTY", "a question needs instructions")

    def to_wire(self) -> dict:
        return {"type": "noul", "instructions": self.instructions}


@dataclass(frozen=True)
class ChoiceAnswer:
    choice: str
    probabilities: Mapping[str, float]
    confidence: float

    @property
    def p(self) -> float:
        """Probability of the chosen option: the number to price risk with."""
        return self.probabilities[self.choice]


@dataclass(frozen=True)
class ScoreAnswer:
    score: float
    probabilities: Mapping[int, float]
    confidence: float


@dataclass(frozen=True)
class NoulAnswer:
    noul: float


def _number(value, code: str, label: str, lo: float = 0.0, hi: float = 1.0) -> float:
    if isinstance(value, bool) or not isinstance(value, Real):
        raise AnswerSpaceError(code, f"{label} must be a JSON number")
    value = float(value)
    if not math.isfinite(value) or not lo <= value <= hi:
        raise AnswerSpaceError(code, f"{label} must be finite and within [{lo}, {hi}]")
    return value


def _check_probs(probs: Mapping, keys: Sequence) -> list[float]:
    if not isinstance(probs, Mapping):
        raise AnswerSpaceError("S1_ANSWER_SHAPE", "probabilities must be an object")
    if set(probs) != set(keys):
        raise AnswerSpaceError("S1_PROB_KEYS", f"probabilities keys {sorted(map(str, probs))} do not match the declared space {list(map(str, keys))}")
    vals = [_number(probs[k], "S1_PROB_RANGE", "probability") for k in keys]
    if abs(sum(vals) - 1.0) > PROB_SUM_TOL:
        raise AnswerSpaceError("S1_PROB_SUM", f"probabilities sum to {sum(vals):.4f}, not 1")
    return vals


def parse_answer(question, raw: Mapping):
    """Parse one raw answer against its question. Out-of-space values raise AnswerSpaceError.

    The confidence a backend reports is checked against the documented formula and replaced by the
    recomputed value when it is missing; a reported value that disagrees by more than 0.02 is kept but
    the answer is still returned, because the vendor's formula can change between releases. Call
    `confidence_mismatch` to audit that.
    """
    if not isinstance(raw, Mapping):
        raise AnswerSpaceError("S1_ANSWER_SHAPE", "answer must be an object")
    t = raw.get("type", question.kind)
    if t != question.kind:
        raise AnswerSpaceError("S1_TYPE_MISMATCH", f"answer type {t!r} does not match question type {question.kind!r}")
    if question.kind in ("choice", "score") and "probabilities" not in raw:
        raise AnswerSpaceError("S1_ANSWER_SHAPE", "answer is missing probabilities")
    if isinstance(question, Choice):
        choice = raw.get("choice")
        if not isinstance(choice, str) or choice not in question.criteria:
            raise AnswerSpaceError("S1_CHOICE_OUT_OF_SPACE", f"choice {choice!r} is not one of {list(question.options)}")
        vals = _check_probs(raw["probabilities"], question.options)
        conf = raw.get("confidence")
        conf = choice_confidence(vals) if conf is None else _number(conf, "S1_CONFIDENCE_RANGE", "confidence")
        return ChoiceAnswer(choice, {k: float(raw["probabilities"][k]) for k in question.options}, conf)
    if isinstance(question, Score):
        source = raw["probabilities"]
        if not isinstance(source, Mapping):
            raise AnswerSpaceError("S1_ANSWER_SHAPE", "probabilities must be an object")
        probs = {}
        for k, value in source.items():
            if isinstance(k, bool) or not (type(k) is int or (isinstance(k, str) and k in {str(i) for i in range(question.levels)})):
                raise AnswerSpaceError("S1_PROB_KEYS", "Score probability keys must be canonical level indices")
            index = int(k)
            if index in probs:
                raise AnswerSpaceError("S1_PROB_KEYS", "duplicate Score level after key normalization")
            probs[index] = value
        vals = _check_probs(probs, list(range(question.levels)))
        score = _number(raw.get("score"), "S1_SCORE_RANGE", "score", 0, question.levels - 1)
        conf = raw.get("confidence")
        conf = score_confidence(vals) if conf is None else _number(conf, "S1_CONFIDENCE_RANGE", "confidence")
        return ScoreAnswer(score, {i: float(probs[i]) for i in range(question.levels)}, conf)
    if isinstance(question, Noul):
        p = _number(raw.get("noul"), "S1_PROB_RANGE", "noul")
        return NoulAnswer(p)
    raise TypeError(type(question))


def confidence_mismatch(question, answer) -> float:
    """|reported confidence - documented formula|, 0 for a Noul. Used to audit a backend's reported confidence."""
    if isinstance(answer, ChoiceAnswer):
        return abs(answer.confidence - choice_confidence([answer.probabilities[o] for o in question.options]))
    if isinstance(answer, ScoreAnswer):
        return abs(answer.confidence - score_confidence([answer.probabilities[i] for i in range(question.levels)]))
    return 0.0


NONE_FITS = "none_fits"


def with_companion(choice: Choice, noul_statement: str | None = None) -> tuple[Choice, Noul]:
    """Companion Noul pattern: a Choice always picks something, so pair it with a Noul that asks whether
    any option fits at all. Returns (choice, companion). Use `companion_gate` to read the pair."""
    stmt = noul_statement or f"At least one of these options fits the state: {', '.join(choice.options)}."
    return choice, Noul(stmt, needs=choice.needs)


def companion_gate(choice_answer: ChoiceAnswer, none_fits_noul: NoulAnswer, yes: float = 0.7, no: float = 0.3,
                   choice_floor: float = 0.7) -> str:
    """'use' when the Noul says an option fits and the Choice is settled; 'unsure' for the middle band or an
    unsettled Choice; 'ignore' when the Noul says nothing fits."""
    if none_fits_noul.noul < no:
        return "ignore"
    if none_fits_noul.noul > yes and choice_answer.p >= choice_floor:
        return "use"
    return "unsure"
