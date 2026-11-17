"""Backends: where an answer comes from. None of them touches the network by itself.

HostedAdapter builds the documented request shape and hands it to an injected `transport(request) -> response` callable, so
the package never holds a key, never opens a socket, and can be tested with the vendor's own example JSON. Wiring a real
HTTP client is a deliberate step the caller takes (and needs the owner's yes: it is a paid, third-party call).
"""
from __future__ import annotations

import json
import re
from typing import Callable, Mapping, Protocol

from .questions import AnswerSpaceError, parse_answer

LIST_PRICE_USD_PER_MTOK_INPUT = 0.042   # vendor list price read 16 Nov 2026; output "currently free"; self-reported
BYTES_PER_TOKEN_JSON = 4                    # rough: budgeting only, not a tokenizer
CONTEXT_TOKENS_PER_REQUEST = 64_000         # vendor-documented limits for jev-1.13/1.14 (read 16 Nov 2026)
CONTEXT_TOKENS_PER_QUESTION = 32_000


class Backend(Protocol):
    model: str
    def ask(self, state: object, questions: Mapping[str, object]) -> dict: ...


def build_request(model: str, state: object, questions: Mapping[str, object]) -> dict:
    if not questions:
        raise ValueError("at least one question is required")
    return {"model": model, "state": state, "questions": {k: q.to_wire() for k, q in questions.items()}}


def estimate_input_tokens(request: Mapping) -> int:
    n = len(json.dumps(request, separators=(",", ":")).encode("utf-8"))
    return (n + BYTES_PER_TOKEN_JSON - 1) // BYTES_PER_TOKEN_JSON


def estimate_cost_usd(request: Mapping, price_per_mtok: float = LIST_PRICE_USD_PER_MTOK_INPUT) -> float:
    return estimate_input_tokens(request) * price_per_mtok / 1_000_000


def check_limits(request: Mapping) -> list[str]:
    """Documented size limits, checked before any call. Returns problems (empty = fits)."""
    t = estimate_input_tokens(request)
    problems = []
    if t > CONTEXT_TOKENS_PER_REQUEST:
        problems.append(f"about {t} tokens exceeds the {CONTEXT_TOKENS_PER_REQUEST}-token request limit")
    state_t = estimate_input_tokens({"state": request.get("state")})
    for qid, q in request["questions"].items():
        if state_t + estimate_input_tokens({qid: q}) > CONTEXT_TOKENS_PER_QUESTION:
            problems.append(f"question {qid!r}: state plus question exceeds the {CONTEXT_TOKENS_PER_QUESTION}-token per-question limit")
    return problems


class ReplayBackend:
    """Answers from recorded raw answers (for tests, receipts and offline demos). Unknown ids raise: no invented answers."""
    def __init__(self, recorded: Mapping[str, Mapping], model: str = "replay"):
        self.recorded = dict(recorded)
        self.model = model
        self.calls: list[list[str]] = []

    def ask(self, state: object, questions: Mapping[str, object]) -> dict:
        self.calls.append(list(questions))
        missing = [q for q in questions if q not in self.recorded]
        if missing:
            raise KeyError(f"no recorded answer for {missing}")
        return {q: dict(self.recorded[q]) for q in questions}


class StubBackend:
    """A deterministic fake judge: `fn(question_id, question, state) -> raw answer`."""
    def __init__(self, fn: Callable, model: str = "stub"):
        self.fn, self.model = fn, model
        self.calls: list[list[str]] = []

    def ask(self, state: object, questions: Mapping[str, object]) -> dict:
        self.calls.append(list(questions))
        return {qid: self.fn(qid, q, state) for qid, q in questions.items()}


def _require_pinned_model(model: str) -> None:
    if not isinstance(model, str) or model != model.strip():
        raise ValueError("S1_MODEL_NOT_PINNED: model must be an exact non-empty versioned identifier")
    if not model or model.endswith("latest") or model.endswith("preview"):
        raise ValueError("S1_MODEL_NOT_PINNED: pin a versioned model id (for example jev-1.14.0): aliases move and answers change")
    if re.search(r"(?:^|[-_.@])(?:latest|preview)(?:$|[-_.@])", model, re.I) or not re.search(r"\d+\.\d+", model):
        raise ValueError("S1_MODEL_NOT_PINNED: moving aliases and unversioned identifiers are not reproducible")


class HostedAdapter:
    """Builds the documented typed-judgment request (the public System One interface) and parses the typed response; the HTTP step is injected.

    `transport(request_dict) -> response_dict` must return {"model": ..., "answers": {id: raw}, "usage": {...}}. The model
    id is pinned: aliases move and answers change (vendor advice, models page, read 16 Nov 2026), so use a versioned id.
    """
    def __init__(self, transport: Callable[[dict], dict], model: str):
        _require_pinned_model(model)
        self.transport, self.model = transport, model
        self.last_request: dict | None = None
        self.last_usage: dict | None = None
        self.served_model: str | None = None

    def ask(self, state: object, questions: Mapping[str, object]) -> dict:
        self.last_usage, self.served_model = None, None
        req = build_request(self.model, state, questions)
        problems = check_limits(req)
        if problems:
            raise AnswerSpaceError("S1_OVER_BUDGET", "request would not fit: " + "; ".join(problems))
        self.last_request = req
        resp = self.transport(req)
        if not isinstance(resp, Mapping):
            raise AnswerSpaceError("S1_RESPONSE_SHAPE", "response must be an object")
        if resp.get("model") != self.model:
            raise AnswerSpaceError("S1_MODEL_MISMATCH", "served model must exactly match the pinned requested model")
        answers = resp.get("answers", {})
        if not isinstance(answers, Mapping):
            raise AnswerSpaceError("S1_RESPONSE_SHAPE", "answers must be an object")
        if set(answers) != set(questions):
            raise AnswerSpaceError("S1_ANSWER_IDS", f"response answered {sorted(answers)} but {sorted(questions)} were asked")
        parse_all(questions, answers)  # validate before publishing successful response metadata
        self.last_usage = resp.get("usage")
        self.served_model = resp.get("model")
        return {qid: dict(a) for qid, a in answers.items()}


def parse_all(questions: Mapping[str, object], raw: Mapping[str, Mapping]) -> dict:
    if not isinstance(raw, Mapping) or set(raw) != set(questions):
        raise AnswerSpaceError("S1_ANSWER_IDS", "answer identifiers must exactly match the requested questions")
    return {qid: parse_answer(q, raw[qid]) for qid, q in questions.items()}
