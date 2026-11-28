#!/usr/bin/env python3
"""Merge the two kernel runs into what the second reader is given.

    python3 flywheel/court-5/score/build_packet.py <sets dir> <score dir>

Reads results-old.json and results-new.json (run_kernel.py) and each set's MANIFEST.json. Writes
  packet.json  one entry per fault, twin and decoy: role, the author's manifest entry, the XSD result, and every
               diagnostic of either kernel once, with an id. The reader gets this file. It does not say which
               kernel said what.
  emit.json    id -> ["old"], ["new"] or ["old", "new"]. The reader does not get this file.
Any other scene (a helper file that an Inline or a texture points at) is run by the kernels but left out of the
packet, and is listed in helpers.json. Diagnostics are shuffled per file with a fixed seed.
"""
import json, os, random, sys

sets, score = sys.argv[1:3]
old = json.load(open(f"{score}/results-old.json"))["files"]
new = json.load(open(f"{score}/results-new.json"))["files"]
if sorted(old) != sorted(new):
    sys.exit("the two kernels were not run on the same files")
packet, emit, helpers, n = [], {}, [], 0
for f in sorted(new):
    s, name = f.split("/")
    man = json.load(open(f"{sets}/set-{s}/MANIFEST.json")).get(name, {})
    man = {k: v for k, v in man.items() if not k.startswith("dummy_")}
    role = name.split("-")[0]
    if role not in ("fault", "twin", "decoy"):
        helpers.append(f)
        continue
    seen = {}
    for k, res in (("old", old), ("new", new)):
        for d in res[f]["semantic"]:
            seen.setdefault((d["level"], d["check"], d["message"], d.get("DEF") or ""), []).append(k)
    items = sorted(seen.items())
    random.Random(f).shuffle(items)
    diags = []
    for (level, check, message, _), who in items:
        n += 1
        i = f"d{n:04d}"
        emit[i] = sorted(set(who), key=("old", "new").index)
        diags.append(dict(id=i, level=level, check=check, message=message))
    packet.append(dict(file=f, role=role, manifest=man, xsd_valid=new[f]["xsd"].get("valid"),
                       xsd_valid_oldkernel=old[f]["xsd"].get("valid"),
                       xsd_errors=(new[f]["xsd"].get("errors") or [])[:5], diagnostics=diags))
json.dump(packet, open(f"{score}/packet.json", "w"), indent=1, default=str)
json.dump(emit, open(f"{score}/emit.json", "w"), indent=1)
json.dump(helpers, open(f"{score}/helpers.json", "w"), indent=1)
print(len(packet), "files in the packet,", len(helpers), "helper files left out,", n, "diagnostics,",
      sum(len(v) == 2 for v in emit.values()), "from both kernels,", sum(v == ["new"] for v in emit.values()),
      "new only,", sum(v == ["old"] for v in emit.values()), "old only")
