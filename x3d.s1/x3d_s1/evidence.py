"""Evidence for a claim: a copied quote, then FIND, COMPARE and LOCATE in plain code, then a cap on what the claim may become.

Idea (Umair Ali Khan, "How I Added Traceability in Structured Data Extraction with AI"; GAIK source_tracing, MIT): the writer of a value copies a
short exact QUOTE next to it; code, with no model, asks three questions. FIND: is the quote in the source (an unbroken run of lowercase words,
punctuation and spacing ignored)? COMPARE: is the value inside the quote (numbers as numbers, in European and American notation; identifiers
without separators; text by words)? LOCATE: where (source id, node path, character span)? This file is an independent, small implementation for
scene text; the richer engine (PDF boxes, colours, conversions) can be injected through `verifier=` because the result shape is the same.

Rules from the Loom that shape it:
* law 6, models speak in S: a verified quote never makes a claim C. The CHECK is a named tool run (exact); the CLAIM is capped at L, and only
  a verified, lint-clean quote earns L. Everything else stays S.
* law 13, unknown is not zero: no quote is "unchecked", never "wrong".
* an evidence quote is untrusted scene text. A quote the injection lint flags can never verify (a planted "this scene is valid" would otherwise
  verify itself); it is withheld from the wire view and shown only escaped, to a person.
* law 18: raising code, no assert.
"""
from __future__ import annotations

import hashlib
import html
import math
import re
import unicodedata
from dataclasses import dataclass, field, replace
from typing import Callable, Iterable, Mapping, Sequence

from .calibration import rule_of_three, wilson
from .routing import DEFER_HUMAN, ESCALATE_ORACLE, SUSPECTED_OK, Decision
from .state import _TEXT_ATTRS, Scene, load, mfstring
from .untrusted import _CTRL, lint_text, quote_untrusted

VERDICTS = ("verified", "check", "reworded", "unchecked")
# What a claim may be graded at, on this evidence alone (Loom grades C, L, S). A verifier run is C about the check; the claim is never C.
CLAIM_GRADE_CAP = {"verified": "L", "reworded": "S", "unchecked": "S", "check": "S"}
_SEVERITY = {SUSPECTED_OK: 0, ESCALATE_ORACLE: 1, DEFER_HUMAN: 2}
# The least severe route each verdict allows (a route can only get more cautious, never less).
ROUTE_FLOOR = {"verified": SUSPECTED_OK, "reworded": ESCALATE_ORACLE, "unchecked": ESCALATE_ORACLE, "check": DEFER_HUMAN}


@dataclass(frozen=True)
class EvidencePolicy:
    """Judgment calls, stated and reported with the verdicts (a TracePolicy)."""
    min_quote_words: int = 1             # a shorter quote is "check"
    reworded_is_problem: bool = False    # report "reworded" as "check"
    ambiguous_is_check: bool = False     # 4.200 can be 4.2 or 4200: report a match that needed the second reading as "check"
    ambiguous_quote_is_check: bool = False  # a quote that occurs more than once and was not pinned to a source
    moved_is_check: bool = True          # a quote found only in a source other than the cited one
    lint_quotes: bool = True             # a quote the injection lint flags can never verify
    number_tolerance: float = 1e-6

    @classmethod
    def strict(cls) -> "EvidencePolicy":
        return cls(reworded_is_problem=True, ambiguous_is_check=True, ambiguous_quote_is_check=True)


@dataclass(frozen=True)
class Source:
    id: str
    text: str
    locus: Mapping = field(default_factory=dict)


@dataclass(frozen=True)
class Claim:
    field: str
    value: object
    quote: str | None = None
    source: str | None = None            # a Source id the writer says the quote came from (optional)


@dataclass(frozen=True)
class Evidence:
    field: str
    value: object
    quote: str
    status: str                          # found | moved | not_found | no_quote
    value_status: str                    # match | near | mismatch | unchecked
    verdict: str
    span: tuple[int, int] | None = None  # character offsets of the quote in its source (as written, before folding)
    source: str | None = None
    occurrences: int = 0
    ambiguous: bool = False
    flags: tuple[str, ...] = ()          # injection-lint flags on the quote
    note: str = ""
    locus: Mapping = field(default_factory=dict)

    @property
    def grade_cap(self) -> str:
        return CLAIM_GRADE_CAP[self.verdict] if not self.flags else "S"


# ---------------------------------------------------------------- folding and tokens

_TOKEN = re.compile(r"[^\W_]+(?:[.,][^\W_]+)*")      # words and numbers; 1,234.5 and 4.200 stay whole


def fold(text: str) -> tuple[str, list[int]]:
    """NFKC, case-folded, control and zero-width characters dropped, one character at a time so every folded character keeps the
    offset of the character it came from (the offsets of the original text stay usable)."""
    out: list[str] = []
    origin: list[int] = []
    for i, ch in enumerate(text):
        if _CTRL.match(ch):
            continue
        for c in unicodedata.normalize("NFKC", ch).casefold():
            out.append(c)
            origin.append(i)
    return "".join(out), origin


def tokens(text: str) -> list[tuple[str, int, int]]:
    """(word, start, end) over the ORIGINAL text; words are folded."""
    folded, origin = fold(text)
    return [(m.group(), origin[m.start()], origin[m.end() - 1] + 1) for m in _TOKEN.finditer(folded)]


class SourceIndex:
    """All sources of one document, tokenised once; `find` returns every place a quote's word run occurs."""
    def __init__(self, sources: Iterable[Source]):
        self.sources = {s.id: s for s in sources}
        self._tok = {sid: tokens(s.text) for sid, s in self.sources.items()}
        self._first: dict[str, list[tuple[str, int]]] = {}
        for sid, toks in self._tok.items():
            for i, (w, _, _) in enumerate(toks):
                self._first.setdefault(w, []).append((sid, i))

    def find(self, quote: str) -> tuple[list[tuple[str, int, int]], int]:
        """([(source id, start, end), ...] in document order, number of words in the quote). A quote never spans two sources."""
        words = [w for w, _, _ in tokens(quote)]
        if not words:
            return [], 0
        hits = []
        for sid, i in self._first.get(words[0], ()):
            toks = self._tok[sid]
            if [t[0] for t in toks[i:i + len(words)]] == words:
                hits.append((sid, toks[i][1], toks[i + len(words) - 1][2]))
        order = {sid: k for k, sid in enumerate(self.sources)}
        hits.sort(key=lambda h: (order[h[0]], h[1]))
        return hits, len(words)


# ---------------------------------------------------------------- COMPARE

_NUMTOK = re.compile(r"(?<![A-Za-z0-9.,])[-+\u2212]?(?:\d+(?:[.,]\d+)*|[.,]\d+)(?:[eE][-+]?\d+)?(?![A-Za-z0-9])")   # CYS_112_CB holds 112; x3d and CD2 hold no number
_IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_.\-:]*")


def readings(tok: str) -> list[float]:
    """Every value a printed number may mean. 4.200 -> [4.2, 4200]; 1.234,5 and 1,234.5 -> [1234.5]; 1.2.3 -> [] (not a number)."""
    s = tok.replace("−", "-")
    sign = -1.0 if s.startswith("-") else 1.0
    s = s.lstrip("+-")
    exp = ""
    m = re.search(r"[eE][-+]?\d+$", s)
    if m:
        exp, s = m.group(), s[:m.start()]
    seps = [c for c in s if c in ".,"]
    if not seps:
        vals = [s]
    elif len(set(seps)) == 2:                                        # 1.234,5 or 1,234.5: the last separator is the point
        last = seps[-1]
        other = "." if last == "," else ","
        if s.count(last) != 1 or not all(len(g) == 3 for g in s.split(last)[0].split(other)[1:]):
            return []
        vals = [s.replace(other, "").replace(last, ".")]
    elif len(seps) >= 2:                                             # 1.234.567: groups only
        groups = re.split(r"[.,]", s)
        vals = ["".join(groups)] if re.fullmatch(r"[1-9]\d{0,2}", groups[0]) and all(len(g) == 3 for g in groups[1:]) else []
    else:
        sep = seps[0]
        a, b = s.split(sep)
        vals = [a + "." + b] if (a or b) else []
        if len(b) == 3 and re.fullmatch(r"[1-9]\d{0,2}", a):         # 4.200 or 1,500: a point or a thousands mark
            vals.append(a + b)
    out = []
    for v in vals:
        try:
            out.append(sign * float((v if v[0] != "." else "0" + v) + exp))
        except ValueError:
            return []
    return out


def _numbers(text: str) -> list[list[float]]:
    return [readings(m.group()) for m in _NUMTOK.finditer(text)]


def _as_floats(value) -> list[float] | None:
    """A value that is a number, or a sequence of numbers, or a string made only of numbers (an SFVec3f)."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return [float(value)]
    if isinstance(value, (list, tuple)) and value and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in value):
        return [float(x) for x in value]
    if isinstance(value, str):
        parts = value.replace(",", " ").split()
        try:
            return [float(p) for p in parts] if parts else None
        except ValueError:
            return None
    return None


def _run(vals: list[list[float]], quote: str, tol: float) -> tuple[str, bool]:
    """A contiguous run of numbers in the quote, in order, each equal to some reading of the matching component. (1 2 3) is not (3 2 1)."""
    qn = _numbers(quote)
    near = lambda a, b: math.isclose(a, b, rel_tol=1e-9, abs_tol=tol)
    for i in range(len(qn) - len(vals) + 1):
        win = qn[i:i + len(vals)]
        if all(any(near(a, b) for a in vs for b in rs) for vs, rs in zip(vals, win)):
            second = any(rs and not any(near(rs[0], a) for a in vs) for vs, rs in zip(vals, win))      # matched only on the 4200 reading of 4.200
            return "match", second
    return "mismatch", False


def compare(value, quote: str, policy: EvidencePolicy = EvidencePolicy()) -> tuple[str, bool, bool]:
    """(value_status, ambiguous, numeric) for `value` against the text of `quote`. numeric tells the verdict table whether a mismatch is a hard one."""
    tol = policy.number_tolerance
    if isinstance(value, str) and _NUMTOK.fullmatch(value.strip()) and readings(value.strip()):      # "6,100" is one printed number, not a pair
        st, amb = _run([readings(value.strip())], quote, tol)
        return st, amb, True
    nums = _as_floats(value) if not isinstance(value, str) or re.fullmatch(r"[\s\d.,eE+\-\u2212]+", value) else None
    if nums is not None:
        st, amb = _run([[v] for v in nums], quote, tol)
        return st, amb, True
    if isinstance(value, bool):
        w = {"true", "yes"} if value else {"false", "no"}
        return ("match" if w & {t for t, _, _ in tokens(quote)} else "mismatch"), False, True
    text = str(value)
    if _IDENT.fullmatch(text) and (re.search(r"[0-9_.\-:]", text)):       # an identifier: raw and case-sensitive, separators optional
        if re.search(r"(?<![\w])" + re.escape(text) + r"(?![\w])", quote):
            return "match", False, True
        squeeze = lambda s: re.sub(r"[^0-9A-Za-z]", "", s)
        qt = tokens(quote)
        target = squeeze(text)
        for i in range(len(qt)):
            joined = ""
            for j in range(i, min(len(qt), i + 8)):
                joined += qt[j][0]
                if joined == target.casefold():
                    return ("match" if squeeze(quote[qt[i][1]:qt[j][2]]) == target else "near"), False, True
                if len(joined) >= len(target):
                    break
        return "mismatch", False, True
    vw = [t for t, _, _ in tokens(text)]
    qw = [t for t, _, _ in tokens(quote)]
    if not vw:
        return "unchecked", False, False
    for i in range(len(qw) - len(vw) + 1):
        if qw[i:i + len(vw)] == vw:
            return "match", False, False
    return ("near" if set(vw) <= set(qw) else "mismatch"), False, False


def verdict_of(status: str, vstate: str, numeric: bool, nwords: int, policy: EvidencePolicy, occurrences: int = 1,
               ambiguous: bool = False, pinned: bool = False) -> str:
    """The verdict table. Same branches as GAIK's, plus `near` (all the words, not in a run) and the moved policy."""
    if status == "no_quote":
        return "unchecked"
    if status not in ("found", "moved") or nwords < policy.min_quote_words:
        return "check"
    if status == "moved" and policy.moved_is_check:
        return "check"
    if vstate == "match":
        if ambiguous and policy.ambiguous_is_check:
            return "check"
        if policy.ambiguous_quote_is_check and occurrences > 1 and not pinned:
            return "check"
        return "verified"
    if vstate == "near":
        return "check" if policy.reworded_is_problem else "reworded"
    if vstate == "mismatch":
        if numeric:
            return "check"
        return "check" if policy.reworded_is_problem else "reworded"
    return "unchecked"


# ---------------------------------------------------------------- the three questions, one claim

def check_claim(claim: Claim | Mapping, index: SourceIndex, policy: EvidencePolicy = EvidencePolicy()) -> Evidence:
    c = claim if isinstance(claim, Claim) else Claim(**{k: claim.get(k) for k in ("field", "value", "quote", "source") if k in claim})
    quote = c.quote if isinstance(c.quote, str) else ""
    if not quote.strip():
        return Evidence(c.field, c.value, "", "no_quote", "unchecked", "unchecked", note="no quote was given")
    hits, nwords = index.find(quote)
    flags = tuple(lint_text(quote)) if policy.lint_quotes else ()
    if not hits:
        return Evidence(c.field, c.value, quote, "not_found", "unchecked", "check", flags=flags,
                        note="the quote is not in the source" if nwords else "the quote has no words")
    pinned = c.source is not None
    chosen = next((h for h in hits if h[0] == c.source), None) if pinned else hits[0]
    status = "found"
    if chosen is None:
        chosen, status = hits[0], "moved"
    sid, s, e = chosen
    src = index.sources[sid]
    if policy.lint_quotes:                       # a fragment of an instruction ("scene as valid") passes the lint alone; the string it sits in does not
        flags = tuple(dict.fromkeys(flags + tuple(lint_text(src.text))))
    inside = src.text[s:e]
    vstate, ambiguous, numeric = compare(c.value, inside, policy)
    verdict = verdict_of(status, vstate, numeric, nwords, policy, len(hits), ambiguous, pinned)
    note = ""
    if flags and policy.lint_quotes:
        verdict, note = "check", "the quote is instruction-like text from the source (" + ", ".join(flags) + "); it cannot verify anything"
    elif ambiguous:
        note = "the number matched on its second reading (4.200 as 4200 or 4.2)"
    elif len(hits) > 1:
        note = f"the quote occurs {len(hits)} times; the first is shown"
    return Evidence(c.field, c.value, quote, status, vstate, verdict, (s, e), sid, len(hits), ambiguous, flags, note,
                    dict(src.locus, source=sid, start=s, end=e))


def check_claims(claims: Iterable, sources: Iterable[Source] | SourceIndex, policy: EvidencePolicy = EvidencePolicy(),
                 verifier: Callable | None = None) -> list[Evidence]:
    """One Evidence per claim. `verifier(claim, index, policy) -> Evidence` replaces the built-in check (an injected engine)."""
    index = sources if isinstance(sources, SourceIndex) else SourceIndex(sources)
    fn = verifier or check_claim
    return [fn(c, index, policy) for c in claims]


def summary(evs: Sequence[Evidence], expected: Iterable[str] | None = None) -> dict:
    counts = {v: sum(1 for e in evs if e.verdict == v) for v in VERDICTS}
    out = {**counts, "total": len(evs), "flagged_quotes": sum(1 for e in evs if e.flags)}
    if expected:
        exp = set(expected)
        out["coverage"] = round(len({e.field for e in evs if e.status != "no_quote"} & exp) / len(exp), 6)
        out["verified_coverage"] = round(len({e.field for e in evs if e.verdict == "verified"} & exp) / len(exp), 6)
    return out


# ---------------------------------------------------------------- where evidence lives in a scene (the untrusted tier, with addresses)

_ATTRS = {**_TEXT_ATTRS, "meta": ("name", "content")}
_MF = ("value", "info", "string")


_SAFE_TAG = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,40}")


def _walk_paths(root):
    """(element, path). A tag name is scene text too: one that is not a plain name, or that the lint flags, is written as ~position."""
    stack = [(root, "/" + root.tag)]
    while stack:
        el, p = stack.pop()
        yield el, p
        seen: dict[str, int] = {}
        kids = []
        for pos, ch in enumerate(el):
            i = seen.get(ch.tag, 0)
            seen[ch.tag] = i + 1
            safe = _SAFE_TAG.fullmatch(ch.tag) and not lint_text(ch.tag)
            kids.append((ch, f"{p}/{ch.tag}[{i}]" if safe else f"{p}/~{pos}"))
        stack.extend(reversed(kids))


def scene_sources(scene: Scene | str | bytes) -> list[Source]:
    """Every free-text string a claim may quote, one Source each, with a node path. Exactly the strings the `text` and `names` facets
    would quote; Script and shader bodies are never sources (a claim that quotes one is not found)."""
    sc = scene if isinstance(scene, Scene) else load(scene)
    out: list[Source] = []
    for el, path in _walk_paths(sc.root):
        for a in _ATTRS.get(el.tag, ()):
            raw = el.get(a)
            if not raw:
                continue
            vals = mfstring(raw) if a in _MF else [raw]
            for k, v in enumerate(vals):
                sid = f"{path}@{a}" + (f"#{k}" if a in _MF else "")
                out.append(Source(sid, v, {"path": path, "tag": el.tag, "attr": a, "item": k if a in _MF else None, "def": el.get("DEF")}))
        if el.get("DEF"):
            out.append(Source(f"{path}@DEF", el.get("DEF"), {"path": path, "tag": el.tag, "attr": "DEF", "item": None, "def": el.get("DEF")}))
    return out


# ---------------------------------------------------------------- cap, wire view, review view

def cap_route(route: str, ev: Evidence) -> str:
    """The route name, tightened: a claim without verified evidence cannot ride a route less cautious than ROUTE_FLOOR."""
    floor = DEFER_HUMAN if ev.flags else ROUTE_FLOOR[ev.verdict]
    return route if _SEVERITY[route] >= _SEVERITY[floor] else floor


def cap_decision(decision: Decision, ev: Evidence) -> Decision:
    """`cap_route` on a Decision, keeping its numbers and saying why the route moved. Never loosens, never makes a witness green."""
    outcome = cap_route(decision.outcome, ev)
    if outcome == decision.outcome:
        return decision
    return replace(decision, outcome=outcome, reason=f"{decision.reason}; evidence {ev.verdict} caps the route at {outcome}")


def to_wire(ev: Evidence, cap: int = 120) -> dict:
    """What may travel to a judge or into a receipt: verdict, status, span, locus, and the quote only in the untrusted tier (quoted, capped,
    linted, withheld if flagged). The value is the writer's; scene text (the quote, a DEF name) never rides unmarked."""
    locus = {k: v for k, v in ev.locus.items() if k != "def"}
    if ev.locus.get("def"):
        locus["def"] = quote_untrusted(ev.locus["def"], 40)
    d = {"field": ev.field, "value": ev.value, "status": ev.status, "value_status": ev.value_status, "verdict": ev.verdict,
         "grade_cap": ev.grade_cap, "span": list(ev.span) if ev.span else None, "source": ev.source, "occurrences": ev.occurrences,
         "ambiguous": ev.ambiguous, "flags": list(ev.flags), "note": ev.note, "locus": locus}
    d["quote"] = quote_untrusted(ev.quote, cap) if ev.quote else None
    return d


def to_receipt(ev: Evidence) -> dict:
    """The receipt line: no scene text at all (the triage receipt's rule). The quote is a hash and a length; the span and locus say where to look."""
    d = to_wire(ev, cap=0)
    d["quote"] = {"sha256_12": hashlib.sha256(ev.quote.encode("utf-8", "replace")).hexdigest()[:12], "chars": len(ev.quote)} if ev.quote else None
    d["value"] = ev.value if isinstance(ev.value, (bool, int, float)) else {"sha256_12": hashlib.sha256(str(ev.value).encode("utf-8", "replace")).hexdigest()[:12], "chars": len(str(ev.value))}
    d["locus"] = {k: v for k, v in ev.locus.items() if k in ("path", "tag", "attr", "item", "source", "start", "end")}
    return d


def _visible(text: str) -> str:
    """Show hidden characters instead of dropping them: a person should see that the text carries a right-to-left override."""
    return "".join(f"\\u{ord(c):04x}" if (_CTRL.match(c) or c in "  ") else c for c in text)


def review_html(ev: Evidence, source_text: str, context: int = 40) -> str:
    """A snippet for a person: the source around the quote, HTML-escaped, the quote in <mark>. Safe to place in a page: every character
    from the scene is escaped and hidden characters are shown as \\uXXXX. Never feed this back into a prompt."""
    if ev.span is None:
        return ""
    s, e = ev.span
    pre, mid, post = source_text[max(0, s - context):s], source_text[s:e], source_text[e:e + context]
    esc = lambda t: html.escape(_visible(t), quote=True)
    return f'{esc(pre)}<mark data-verdict="{html.escape(ev.verdict)}">{esc(mid)}</mark>{esc(post)}'


# ---------------------------------------------------------------- calibration of verdict rates

def verdict_table(evs: Sequence[Evidence], correct: Sequence[int]) -> dict:
    """Per verdict: n, how many claims were in fact right, the rate and a Wilson 95% interval (and the rule-of-three bound on a zero count).
    `correct` is the exact label (1 right, 0 wrong). Report mutants and real scenes separately (law 30); this function does not mix them."""
    if len(evs) != len(correct):
        raise ValueError("evs and correct differ in length")
    rows = {}
    for v in VERDICTS:
        ks = [c for e, c in zip(evs, correct) if e.verdict == v]
        n, k = len(ks), sum(ks)
        lo, hi = wilson(k, n)
        rows[v] = {"n": n, "right": k, "rate": (k / n if n else None), "wilson_95": [round(lo, 4), round(hi, 4)],
                   "wrong_upper_bound_if_zero": (rule_of_three(n) if n and k == n else None)}
    return rows

