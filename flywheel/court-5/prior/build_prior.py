#!/usr/bin/env python3
"""Build the list of every mistake planted in an earlier court, one line each.

    python3 flywheel/court-5/prior/build_prior.py        # from the repository root; rewrites the two files beside it

The list goes to court 5's authors with the instruction to plant none of them again, and to the second reader for
the repeat marking. It is built only from the answer keys of sets that are already opened and public in this
repository, so it tells the kernel side nothing new.
"""
import json
from pathlib import Path

H = Path(__file__).resolve().parent
F = H.parent.parent
SOURCES = [("court-2", "behaviour", F / "sprint-20261126/fault-court-2/MANIFEST.json"),
           ("court-2b", "structure", F / "sprint-20261126/fault-court-2b/MANIFEST.json"),
           ("court-3", "behaviour", F / "court-3/set-a/MANIFEST.json"),
           ("court-3", "structure", F / "court-3/set-b/MANIFEST.json"),
           ("court-4", "behaviour", F / "court-4/set-a/MANIFEST.json"),
           ("court-4", "structure", F / "court-4/set-b/MANIFEST.json")]
rows = []
for court, brief, path in SOURCES:
    man = json.loads(path.read_text())
    for name in sorted(man):
        if not name.startswith("fault"):
            continue
        e = man[name]
        rows.append({"id": f"P{len(rows) + 1:03d}", "court": court, "brief": brief, "file": name,
                     "family": e.get("category", ""), "planted_mistake": " ".join(e["fault"].split())})
(H / "prior-mistakes.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n")
(H / "prior-mistakes.txt").write_text("".join(f"{r['id']}  {r['planted_mistake']}\n" for r in rows))
by = {}
for r in rows:
    by[r["court"]] = by.get(r["court"], 0) + 1
print(len(rows), "planted mistakes:", by)
