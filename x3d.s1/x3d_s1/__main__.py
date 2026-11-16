"""python -m x3d_s1 <command>: local, offline, no model call.

  state FILE [--facets a,b] [--untrusted] [--budget N]   sliced, trust-tiered state as JSON
  census FILE                                            the compact state for a first look
  questions                                              the D / C / J catalogue
  lint-text TEXT_OR_FILE                                 the untrusted-text pattern screen
  triage FILE [--replay RECORDED.json] [--untrusted]     one triage pass; J questions need --replay
  evidence SOURCE CLAIMS.json [--strict] [--require verified|reworded] [--quotes]
                                                         quote-and-verify: SOURCE is a scene or a text file; CLAIMS is a list of {field, value, quote[, source]};
                                                         exit 1 when any claim falls below --require (default verified), so `kit/loom command` can record it;
                                                         the output holds no scene text unless --quotes (then quoted, capped, linted, flagged ones withheld)
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from . import __version__
from .backends import ReplayBackend
from .decidable import CATALOGUE, partition
from .evidence import EvidencePolicy, Source, check_claims, scene_sources, summary, to_receipt, to_wire
from .pipeline import triage
from .state import FACETS, load, slice_state
from .untrusted import lint_text


def _dump(obj) -> None:
    json.dump(obj, sys.stdout, indent=2, sort_keys=True, ensure_ascii=False)
    sys.stdout.write("\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="x3d_s1", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--version", action="version", version=f"x3d_s1 {__version__}")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("state"); p.add_argument("file"); p.add_argument("--facets"); p.add_argument("--untrusted", action="store_true"); p.add_argument("--budget", type=int)
    p = sub.add_parser("census"); p.add_argument("file")
    sub.add_parser("questions")
    p = sub.add_parser("lint-text"); p.add_argument("text")
    p = sub.add_parser("triage"); p.add_argument("file"); p.add_argument("--replay"); p.add_argument("--untrusted", action="store_true")
    p = sub.add_parser("evidence"); p.add_argument("source"); p.add_argument("claims"); p.add_argument("--strict", action="store_true"); p.add_argument("--quotes", action="store_true")
    p.add_argument("--require", choices=["verified", "reworded"], default="verified")
    a = ap.parse_args(argv)

    if a.cmd == "state":
        facets = a.facets.split(",") if a.facets else None
        _dump(slice_state(load(a.file), facets, include_untrusted=a.untrusted, budget_bytes=a.budget))
    elif a.cmd == "census":
        _dump(slice_state(load(a.file), ["header", "census", "geometry", "appearance", "lighting", "behavior"]))
    elif a.cmd == "questions":
        part = partition()
        for q in CATALOGUE:
            print(f"{q.cls}  {q.id:28s} {q.question.kind:6s} twin: {q.twin}")
        print(f"\n{len(CATALOGUE)} questions: " + ", ".join(f"{k}={len(v)}" for k, v in part.items()))
    elif a.cmd == "lint-text":
        text = open(a.text, encoding="utf-8").read() if os.path.isfile(a.text) else a.text
        flags = lint_text(text)
        _dump({"flags": flags, "flagged": bool(flags)})
        return 1 if flags else 0
    elif a.cmd == "triage":
        backend = None
        if a.replay:
            with open(a.replay, encoding="utf-8") as fh:
                backend = ReplayBackend(json.load(fh))
        _dump(triage(a.file, backend=backend, allow_untrusted=a.untrusted))
    elif a.cmd == "evidence":
        with open(a.source, encoding="utf-8") as fh:
            head = fh.read(2048).lstrip()
        sources = scene_sources(a.source) if head.startswith("<") else [Source("text", open(a.source, encoding="utf-8").read())]
        with open(a.claims, encoding="utf-8") as fh:
            claims = json.load(fh)
        evs = check_claims(claims, sources, EvidencePolicy.strict() if a.strict else EvidencePolicy())
        ok = {"verified"} | ({"reworded"} if a.require == "reworded" else set())
        _dump({"summary": summary(evs, expected=[c["field"] for c in claims]), "items": [(to_wire if a.quotes else to_receipt)(e) for e in evs], "require": a.require})
        return 0 if all(e.verdict in ok and not e.flags for e in evs) else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
