#!/usr/bin/env python3
"""Rescore blind court 4 under court 5's stricter catch rule, from court 4's saved files. Runs no kernel.

    python3 flywheel/court-5/baseline/court4_proven.py        # from the repository root

Court 4 is a seen set, so this is a re-reading of a published result and not a new score. It exists so that court
5's headline has a like-for-like number to stand beside: the same rule, on the faults of court 4 that repeated
nothing from court 3.

  named    court 4's rule: the file fails the XSD, or the second reader says a diagnostic names the mistake
  proven   named, and the twin passes the XSD and the naming check fires more often on the fault than on its twin
"""
import json
from pathlib import Path

C4 = Path(__file__).resolve().parents[2] / "court-4" / "score"
packet = {p["file"]: p for p in json.loads((C4 / "packet.json").read_text())}
emit = json.loads((C4 / "emit.json").read_text())
reader = json.loads((C4 / "reader-verdicts.json").read_text())
ok = lambda f, k: packet[f]["xsd_valid" if k == "new" else "xsd_valid_oldkernel"] is not False
count = lambda f, k, c: sum(d["check"] == c and k in emit[d["id"]] for d in packet[f]["diagnostics"])


def caught(f, k, rule):
    t = f"{f.split('/')[0]}/{packet[f]['manifest']['twin']}"
    if not ok(f, k) and (rule == "named" or ok(t, k)):
        return True
    by = {d["id"]: d["check"] for d in packet[f]["diagnostics"]}
    return any(k in emit[i] and (rule == "named" or count(f, k, by[i]) > count(t, k, by[i])) for i in reader["faults"][f]["naming"])


faults = sorted(reader["faults"])
groups = {"all 40": faults, "new mistakes": [f for f in faults if not reader["faults"][f].get("repeats_court3")],
          "repeats of court 3": [f for f in faults if reader["faults"][f].get("repeats_court3")]}
out = {g: {"faults": len(fs), **{f"{rule}_{k}": sum(caught(f, k, rule) for f in fs) for rule in ("named", "proven") for k in ("old", "new")},
           "named_but_not_proven_new": [f for f in fs if caught(f, "new", "named") and not caught(f, "new", "proven")]}
       for g, fs in groups.items()}
(Path(__file__).resolve().parent / "court4-proven.json").write_text(json.dumps(out, indent=1) + "\n")
print(json.dumps(out, indent=1))
