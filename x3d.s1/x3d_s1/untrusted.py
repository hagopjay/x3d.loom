"""Trust tiers for free text that rides inside a scene.

A scene is data, and a typed judge does not treat state as hostile by default (vendor jaggedness page, failure mode 6):
text engineered to argue for its own classification can move an answer. X3D scenes carry plenty of such text
(MetadataString, WorldInfo, Text, meta tags, descriptions, DEF names, Script bodies). Ordinary code goes first:
tag every string UNTRUSTED, cap it, strip control characters, lint it for instruction-like patterns, and withhold what
the lint flags. A judge, if used at all, is a second layer.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

# (flag, pattern). Deliberately blunt: a false alarm withholds one string, a miss lets one through.
PATTERNS = [
    ("override-instructions", re.compile(r"\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all|any|the)\b.{0,30}\b(instruction|rule|prompt|criteria|guideline)s?", re.I | re.S)),
    ("role-reassign", re.compile(r"\b(you are|you're|act as|pretend to be|from now on you)\b.{0,40}\b(a|an|the|now|my)\b", re.I | re.S)),
    ("system-prompt", re.compile(r"\b(system|developer)\s+(prompt|message|instruction)s?\b", re.I)),
    ("role-marker", re.compile(r"(^|\n|\s)(system|assistant|user|human)\s*:\s", re.I)),
    ("answer-steering", re.compile(r"\b(classify|label|rate|score|mark|answer|respond|report|output|return)\b.{0,30}\b(this|the|it|scene|model)?.{0,20}\b(as|with|is|=|:)\b.{0,12}\b(valid|safe|approved|passed?|clean|yes|no|true|false|high|low|best|perfect|compliant)\b", re.I | re.S)),
    ("suppress-report", re.compile(r"\b(do not|don't|never|must not)\b.{0,25}\b(flag|report|mention|reveal|warn|escalate|review)\b", re.I | re.S)),
    ("markup-fence", re.compile(r"(```|<\s*/?\s*(system|instructions?|prompt|assistant|tool|function)\b|\[\s*/?\s*INST\s*\])", re.I)),
    ("directive-to-reader", re.compile(r"\byou\s+(must|have to|need to|should|shall|will)\b.{0,30}\b(respond|answer|reply|say|output|report|return|classify|label|rate|mark|ignore|disregard|approve|pass)\b", re.I | re.S)),
    ("no-problems-claim", re.compile(r"\b(no|zero|nothing)\b.{0,15}\b(problems?|errors?|issues?|faults?|violations?|defects?)\b.{0,10}\b(exist|exists|found|remain|remains|present|detected)\b", re.I | re.S)),
    ("self-grading", re.compile(r"\b(this scene|this file|this model)\b.{0,40}\b(is|has been|was)\b.{0,20}\b(verified|validated|certified|audited|approved|safe|trusted)\b", re.I | re.S)),
]
_CTRL = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]")


def lint_text(s: str) -> list[str]:
    """Names of the instruction-like patterns found in `s` (empty list = none)."""
    norm = unicodedata.normalize("NFKC", s)
    return [name for name, rx in PATTERNS if rx.search(norm)]


def quote_untrusted(s: str, cap: int = 120, withhold_flagged: bool = True) -> dict:
    """Return a quoted, capped, linted record. The text is withheld (but hashed and flagged) when the lint fires."""
    clean = _CTRL.sub("", unicodedata.normalize("NFKC", s))
    clean = re.sub(r"\s+", " ", clean).strip()
    flags = lint_text(s)
    rec = {"trust": "untrusted", "sha256_12": hashlib.sha256(s.encode("utf-8", "replace")).hexdigest()[:12], "chars": len(s), "flags": flags}
    if flags and withhold_flagged:
        rec["withheld"] = True
        return rec
    rec["text"] = clean[:cap]
    rec["truncated"] = len(clean) > cap
    return rec
