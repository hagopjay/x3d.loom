"""Is this failure already covered by a rule the Loom has? A cluster that an existing trap explains needs no new rule.

The check is differential, like induction: a trap counts for a failure only if it fires on the failing file and not on
its twin. A trap that fires on both is talking about something else in the file.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path


def _trap_ids(data: bytes) -> set[str]:
    from .. import traps
    try:
        return {h.rule for h in traps.check(data)}
    except (ET.ParseError, ValueError, RecursionError, LookupError):
        return set()
    except Exception:           # a trap that crashes on a hostile file is a finding about the trap, not this cluster
        return {"(traps raised)"}


def explained_by_traps(examples: list, cap: int = 60) -> dict:
    """{"checked": n, "by_trap": {trap id: failures it newly fires on}, "any": failures with at least one such trap}."""
    by: dict[str, int] = {}
    any_hit = 0
    todo = examples[:cap]
    for ex in todo:
        try:
            mine = _trap_ids(Path(ex.case.path).read_bytes())
            twin = _trap_ids(Path(ex.twin.path).read_bytes()) if ex.twin is not None else set()
        except OSError:
            continue
        new = mine - twin
        if new:
            any_hit += 1
        for t in new:
            by[t] = by.get(t, 0) + 1
    return {"checked": len(todo), "any": any_hit, "by_trap": dict(sorted(by.items(), key=lambda kv: -kv[1]))}
