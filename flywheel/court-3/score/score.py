#!/usr/bin/env python3
"""Score blind court 3 from the saved diagnostics and the two readers' verdicts. Prints the tables of RESULTS.md.

    python3 flywheel/court-3/score/score.py            # from the repository root

Inputs (all in this folder): packet.json (every diagnostic of both kernels, by id), emit.json (which kernel
produced each id), reader-verdicts.json (the second reader, who had not seen the kernel), editor-verdicts.json (the
kernel editor, written before the second reader reported). Nothing here runs a kernel; run_kernel.py did that once.
"""
import json
from pathlib import Path

H = Path(__file__).resolve().parent
packet = {p["file"]: p for p in json.loads((H / "packet.json").read_text())}
emit = json.loads((H / "emit.json").read_text())
reader = json.loads((H / "reader-verdicts.json").read_text())
editor = json.loads((H / "editor-verdicts.json").read_text())
LEAKED = {"b/fault-10.x3d", "b/fault-11.x3d"}


def caught(kernel, f, strict=False):
    p = packet[f]
    if (p["xsd_valid"] if kernel == "new" else p["xsd_valid_oldkernel"]) is False:
        return "xsd"
    level = {d["id"]: d for d in p["diagnostics"]}
    for i in reader["faults"][f]["naming"]:
        if kernel in emit[i] and (not strict or level[i]["level"] in ("warning", "error")):
            return level[i]["check"]
    return ""


out = {"rule": "XSD-invalid, or a diagnostic at any level that the second reader says names the planted mistake", "sets": {}}
rows = []
for s, name in (("a", "behaviour"), ("b", "structure")):
    faults = sorted(f for f in reader["faults"] if f.startswith(s + "/"))
    res = {k: [f for f in faults if caught(k, f)] for k in ("old", "new")}
    strict = {k: [f for f in faults if caught(k, f, True)] for k in ("old", "new")}
    ed = {k: [f"{s}/fault-{n:02d}.x3d" for n in editor[f"caught_{k}"][s]] for k in ("old", "new")}
    out["sets"][name] = {"faults": len(faults), "old": len(res["old"]), "new": len(res["new"]),
                         "old_strict": len(strict["old"]), "new_strict": len(strict["new"]),
                         "xsd_invalid": sum(packet[f]["xsd_valid"] is False for f in faults),
                         "editor_old": len(ed["old"]), "editor_new": len(ed["new"]),
                         "readers_disagree_on": sorted(set(res["old"]) ^ set(ed["old"]) | set(res["new"]) ^ set(ed["new"])),
                         "gained": sorted(set(res["new"]) - set(res["old"])), "lost": sorted(set(res["old"]) - set(res["new"])),
                         "missed_by_new": sorted(set(faults) - set(res["new"]))}
    for f in faults:
        m = packet[f]["manifest"]
        rows.append((f, m.get("category", ""), m.get("fault", ""), m.get("witness", ""), caught("old", f), caught("new", f)))
tot = {k: sum(v[k] for v in out["sets"].values()) for k in ("old", "new", "faults")}
noleak = {k: sum(1 for r in rows if r[0] not in LEAKED and r[4 if k == "old" else 5]) for k in ("old", "new")}
out["total"] = {**tot, "without_leaked_pair": {**noleak, "faults": tot["faults"] - len(LEAKED)}}

legal = [p for p in packet.values() if p["role"] != "fault"]
flags = [(p, d) for p in legal for d in p["diagnostics"] if d["level"] in ("warning", "error")]
new_only = [(p, d) for p, d in flags if emit[d["id"]] == ["new"]]
verdict = {}
for p, d in flags:
    verdict.setdefault(reader["legal"][d["id"]]["verdict"], []).append(d["id"])
out["legal_files"] = {"files": len(legal), "decoys": sum(p["role"] == "decoy" for p in legal),
                      "files_with_a_warning_or_error": len({p["file"] for p, _ in flags}),
                      "decoys_with_a_warning_or_error": len({p["file"] for p, _ in flags if p["role"] == "decoy"}),
                      "complaints": len(flags), "complaints_from_the_11_new_checks": len(new_only),
                      "second_reader": {k: len(v) for k, v in verdict.items()}}
(H / "results.json").write_text(json.dumps(out, indent=1) + "\n")

print(json.dumps(out, indent=1))
print("\n| File | Family | Planted mistake | Witness | Old kernel | New kernel |\n|---|---|---|---|---|---|")
for f, cat, fault, wit, o, n in rows:
    mark = lambda x: f"caught (`{x}`)" if x else "missed"
    print(f"| {f.replace('.x3d','')} | {cat} | {fault} | {'X_ITE' if wit.startswith('x_ite') else 'reasoned'} | {mark(o)} | {mark(n)} |")
