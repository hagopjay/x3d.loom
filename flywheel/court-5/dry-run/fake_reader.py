#!/usr/bin/env python3
"""DRY RUN ONLY. Stands in for the second reader so the scripts can be exercised without one.

    python3 flywheel/court-5/dry-run/fake_reader.py <dry-run sets dir> <score dir>

It marks a diagnostic as naming the dummy mistake when its check id matches a pattern the dummy manifest lists
(dummy_expect_checks), calls every complaint on a legal file wrong, and marks the first fault of set b as a repeat
so that the repeat column has something in it. A real court never uses this file.
"""
import fnmatch, json, sys

sets, score = sys.argv[1:3]
out = {"faults": {}, "legal": {}, "note": "written by fake_reader.py: not a reading"}
for p in json.load(open(f"{score}/packet.json")):
    s, name = p["file"].split("/")
    if p["role"] == "fault":
        pats = json.load(open(f"{sets}/set-{s}/MANIFEST.json"))[name].get("dummy_expect_checks", [])
        out["faults"][p["file"]] = {"naming": [d["id"] for d in p["diagnostics"] if any(fnmatch.fnmatch(d["check"], x) for x in pats)],
                                    "real": "real", "repeats_prior": "P017" if p["file"] == "b/fault-01.x3d" else None,
                                    "intent_gives_it_away": False}
    else:
        for d in p["diagnostics"]:
            if d["level"] in ("warning", "error"):
                out["legal"][d["id"]] = {"verdict": "wrong"}
json.dump(out, open(f"{score}/reader-verdicts.json", "w"), indent=1)
print(len(out["faults"]), "faults,", len(out["legal"]), "complaints on legal files")
