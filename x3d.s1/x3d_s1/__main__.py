"""python -m x3d_s1 <command>: local, offline, no model call.

  state FILE [--facets a,b] [--untrusted] [--budget N]   sliced, trust-tiered state as JSON
  census FILE                                            the compact state for a first look
  questions                                              the D / C / J catalogue
  lint-text TEXT_OR_FILE                                 the untrusted-text pattern screen
  triage FILE [--replay RECORDED.json] [--untrusted]     one triage pass; J questions need --replay
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from . import __version__
from .backends import ReplayBackend
from .decidable import CATALOGUE, partition
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
