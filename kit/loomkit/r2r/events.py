"""Failure events: the one shape every receipt family is turned into before R2R reasons about it.

An event says: this INSTRUMENT (a named tool at a named version) was run on this FILE and the OUTCOME was fail or pass;
a failure carries a SIGNATURE (what kind of failure, with the specifics stripped), and may name a TWIN: a file known to
pass the same instrument that differs from the failing one by one edit.

Passing events matter as much as failing ones. F3 of the ontology review found the Loom's receipts held only survivors;
R2R needs both halves, because a rule is only as good as the passing files it was tested against. "Known good" is always
relative to an instrument: a file is a negative for a rule only if that instrument was seen to pass it.
"""
from __future__ import annotations

import collections
import hashlib
import json
import re
from pathlib import Path

from . import EVENT_SCHEMA
from . import features as F
from .doc import Doc

OBSERVED = ("tool", "authored", "model")   # who says it failed: a program that ran, a person who wrote the fault, a model


class Event:
    __slots__ = ("instrument", "outcome", "signature", "file", "sha256", "twin", "group", "observed", "note", "family",
                 "source", "split", "label")

    def __init__(self, instrument: str, outcome: str, file: str, signature: str = "", twin: str | None = None,
                 group: str = "", observed: str = "tool", note: str = "", family: str = "", source: dict | None = None,
                 split: str = "train", sha256: str = "", label: str = ""):
        if outcome not in ("fail", "pass"):
            raise ValueError(f"outcome must be fail or pass, not {outcome!r}")
        if observed not in OBSERVED:
            raise ValueError(f"observed must be one of {OBSERVED}, not {observed!r}")
        self.instrument, self.outcome, self.signature, self.file = instrument, outcome, signature, str(file)
        self.twin = str(twin) if twin else None
        self.group, self.observed, self.note, self.family = group, observed, note, family
        self.source, self.split, self.sha256, self.label = source or {}, split, sha256, label

    @property
    def id(self) -> str:
        raw = f"{self.instrument}\n{self.signature}\n{self.sha256 or self.file}".encode()
        return "ev-" + hashlib.sha256(raw).hexdigest()[:12]

    def to_json(self) -> dict:
        d = {"schema": EVENT_SCHEMA, "id": self.id, "family": self.family, "instrument": self.instrument,
             "outcome": self.outcome, "signature": self.signature, "file": self.file, "sha256": self.sha256,
             "twin": self.twin, "group": self.group, "observed": self.observed, "split": self.split,
             "note": self.note, "source": self.source}
        if self.label:
            d["label"] = self.label
        return d

    @classmethod
    def from_json(cls, d: dict) -> "Event":
        return cls(d["instrument"], d["outcome"], d["file"], d.get("signature", ""), d.get("twin"), d.get("group", ""),
                   d.get("observed", "tool"), d.get("note", ""), d.get("family", ""), d.get("source"),
                   d.get("split", "train"), d.get("sha256", ""), d.get("label", ""))


_QUOTED = re.compile(r"'[^']*'|\"[^\"]*\"")
_NUMBER = re.compile(r"(?<![A-Za-z_])[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?(?![A-Za-z_])")
_PATHISH = re.compile(r"(?:[A-Za-z]:)?(?:[/\\][\w.\-+ ]+){2,}")


def normalise_signature(text: str, keep_numbers: bool = False) -> str:
    """Strip what differs between two reports of the same failure: quoted values, numbers, paths. `IndexError at
    import_x3d.py:860 getFieldAsBool` stays as it is when keep_numbers is set (a line number is the signature)."""
    s = text.strip().splitlines()[0] if text.strip() else ""
    s = _PATHISH.sub("<path>", s)
    s = _QUOTED.sub("'…'", s)
    if not keep_numbers:
        s = _NUMBER.sub("N", s)
    return re.sub(r"\s+", " ", s)[:160]


class Case:
    """One file, read once: its sites, and the bag of every literal it holds anywhere."""
    __slots__ = ("path", "sha256", "sites", "bag", "nums", "parse_error", "bytes")

    def __init__(self, path: str, data: bytes):
        doc = Doc(data, path)
        self.path, self.sha256, self.parse_error, self.bytes = path, doc.sha256, doc.parse_error, doc.bytes
        self.sites = F.sites(doc)
        self.bag, self.nums = F.bag(self.sites)


class Corpus:
    """Files by path, parsed on first use and kept. Two paths with the same bytes share one Case."""

    def __init__(self):
        self._by_path: dict[str, Case] = {}
        self._by_sha: dict[str, Case] = {}

    def case(self, path: str) -> Case:
        c = self._by_path.get(path)
        if c is None:
            data = Path(path).read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            c = self._by_sha.get(sha)
            if c is None:
                c = Case(path, data)
                self._by_sha[sha] = c
            self._by_path[path] = c
        return c

    def add_bytes(self, name: str, data: bytes) -> Case:
        sha = hashlib.sha256(data).hexdigest()
        c = self._by_sha.get(sha)
        if c is None:
            c = Case(name, data)
            self._by_sha[sha] = c
        self._by_path[name] = c
        return c

    def __len__(self):
        return len(self._by_sha)


def pair_key(site) -> tuple:
    return (site.kind, site.el.path() if site.el is not None else "", site.attr or "")


def diff_sites(case: Case, twin: Case) -> list[tuple]:
    """What the failing file has that its twin does not: [(site, new literals, lost literals, changed numbers, twin site)].

    Sites are first matched by content wherever they sit, so an inserted or removed element does not make everything
    after it look changed. What is left over is paired by address to say which literals are new. A deletion shows up on
    the parent element, whose `has:` and `child:` literals change."""
    twin_left = collections.Counter(s.key() for s in twin.sites)
    mine = []
    for s in case.sites:
        k = s.key()
        if twin_left.get(k, 0) > 0:
            twin_left[k] -= 1
        else:
            mine.append(s)
    if not mine:
        return []
    theirs_at: dict[tuple, object] = {}
    theirs_loose: dict[tuple, list] = {}
    for s in twin.sites:
        k = s.key()
        if twin_left.get(k, 0) > 0:
            twin_left[k] -= 1
            theirs_at.setdefault(pair_key(s), s)
            theirs_loose.setdefault((s.kind, s.el.tag if s.el is not None else "", s.attr or ""), []).append(s)
    out = []
    for s in mine:
        p = theirs_at.get(pair_key(s))
        if p is None:
            loose = theirs_loose.get((s.kind, s.el.tag if s.el is not None else "", s.attr or ""), [])
            p = loose[0] if len(loose) == 1 else None
        if p is None:
            out.append((s, set(s.lits), set(), dict(s.nums), None))
        else:
            out.append((s, set(s.lits - p.lits), set(p.lits - s.lits),
                        {k: v for k, v in s.nums.items() if p.nums.get(k) != v}, p))
    return out


class Example:
    """An event with its file read: what induction and proof work on."""
    __slots__ = ("event", "case", "twin", "_diff")

    def __init__(self, event: Event, case: Case, twin: Case | None):
        self.event, self.case, self.twin, self._diff = event, case, twin, None

    @property
    def diff(self) -> list[tuple] | None:
        if self.twin is None:
            return None
        if self._diff is None:
            self._diff = diff_sites(self.case, self.twin)
        return self._diff

    def anchor_sites(self) -> list:
        """Where a rule must fire to count as explaining this failure: the changed sites when there is a twin, else any."""
        d = self.diff
        return self.case.sites if d is None else [t[0] for t in d]


class EventSet:
    """Every event of one run, with the files behind them."""

    def __init__(self, events: list[Event], corpus: Corpus | None = None, log=None):
        self.corpus = corpus or Corpus()
        self.events: list[Event] = []
        self.skipped: list[dict] = []
        seen = set()
        for e in events:
            key = (e.instrument, e.file, e.outcome, e.signature)
            if key in seen:
                continue
            seen.add(key)
            if not Path(e.file).is_file():
                self.skipped.append({"event": e.id, "file": e.file, "why": "file not found"})
                continue
            self.events.append(e)
        self._examples: dict[int, Example] = {}

    def add(self, events: list[Event]) -> list[Event]:
        """More receipts (a probe round, say). Returns the ones that were new and whose files exist."""
        have = {(e.instrument, e.file, e.outcome, e.signature) for e in self.events}
        added = []
        for e in events:
            key = (e.instrument, e.file, e.outcome, e.signature)
            if key in have:
                continue
            have.add(key)
            if not Path(e.file).is_file():
                self.skipped.append({"event": e.id, "file": e.file, "why": "file not found"})
                continue
            self.events.append(e)
            added.append(e)
        return added

    def example(self, e: Event) -> Example:
        ex = self._examples.get(id(e))
        if ex is None:
            case = self.corpus.case(e.file)
            if not e.sha256:
                e.sha256 = case.sha256
            twin = self.corpus.case(e.twin) if e.twin and Path(e.twin).is_file() else None
            ex = self._examples[id(e)] = Example(e, case, twin)
        return ex

    def instruments(self) -> list[str]:
        return sorted({e.instrument for e in self.events})

    def clusters(self, instrument: str | None = None) -> dict[tuple, list[Event]]:
        """Failing events grouped by (instrument, signature), largest first."""
        out: dict[tuple, list[Event]] = {}
        for e in self.events:
            if e.outcome == "fail" and (instrument is None or e.instrument == instrument):
                out.setdefault((e.instrument, e.signature), []).append(e)
        return dict(sorted(out.items(), key=lambda kv: (-len(kv[1]), kv[0])))

    def passes(self, instrument: str) -> list[Event]:
        return [e for e in self.events if e.outcome == "pass" and e.instrument == instrument]

    def fails(self, instrument: str) -> list[Event]:
        return [e for e in self.events if e.outcome == "fail" and e.instrument == instrument]

    def counts(self) -> dict:
        c = collections.Counter((e.instrument, e.outcome) for e in self.events)
        return {inst: {"fail": c[(inst, "fail")], "pass": c[(inst, "pass")]} for inst in self.instruments()}


def write_events(path: Path, events: list[Event]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e.to_json(), sort_keys=True, ensure_ascii=False) + "\n")


def read_events(path: Path) -> list[Event]:
    out = []
    for n, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            out.append(Event.from_json(json.loads(line)))
        except (ValueError, KeyError) as exc:
            raise ValueError(f"{path}:{n}: not a failure event ({exc})") from None
    return out
