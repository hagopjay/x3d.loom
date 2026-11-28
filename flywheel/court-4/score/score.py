#!/usr/bin/env python3
"""Score blind court 4 from the saved diagnostics and the two readers' verdicts. Prints the tables of RESULTS.md.

    python3 flywheel/court-4/score/score.py            # from the repository root

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
FROM_MISSES = {"timesensor-start-in-past", "drag-limits-swapped", "follower-no-smoothing", "script-handler-missing",
               "loadsensor-watches-unloaded", "loadsensor-watches-nothing", "inline-never-loads", "anchor-viewpoint-missing",
               "anchor-target-not-viewpoint", "lod-level-never-shown", "lod-range-count", "mesh-inside-out", "proto-field-unknown",
               "extrusion-cross-section-crosses", "nurbs-knot-count", "nurbs-knot-order", "nurbs-order",
               "nurbs-too-few-control-points", "nurbs-control-count", "scene-unlit", "toggle-out-of-step"}
OWN_LIST = {"switch-shows-nothing", "face-concave", "mesh-faces-away", "light-scope-empty", "timesensor-stopped-in-past",
            "timesensor-paused-forever", "shape-fully-transparent", "viewpoint-sees-nothing"}


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
tot = {k: sum(v[k] for v in out["sets"].values()) for k in ("old", "new", "old_strict", "new_strict", "faults")}
out["total"] = tot

# secondary measures written down in PREREG.md
gained = [r for r in rows if r[5] and not r[4]]
out["gained_by"] = {"checks_from_court_3_misses": sorted(r[0] for r in gained if r[5] in FROM_MISSES),
                    "checks_from_the_editors_list": sorted(r[0] for r in gained if r[5] in OWN_LIST),
                    "other": sorted(r[0] for r in gained if r[5] not in FROM_MISSES | OWN_LIST)}
rep = {f: v.get("repeats_court3") for f, v in reader["faults"].items()}
fresh = [r for r in rows if not rep.get(r[0])]
out["without_repeats_of_court_3"] = {"faults": len(fresh), "repeats": sorted(f for f, v in rep.items() if v),
                                     "old": sum(bool(r[4]) for r in fresh), "new": sum(bool(r[5]) for r in fresh)}
notreal = sorted(f for f, v in reader["faults"].items() if v.get("real") != "real")
out["faults_the_reader_did_not_call_real"] = notreal
real = [r for r in rows if r[0] not in notreal]
out["real_faults_only"] = {"faults": len(real), "old": sum(bool(r[4]) for r in real), "new": sum(bool(r[5]) for r in real)}
disagreed = sorted(p["file"] for p in packet.values() if p["role"] == "fault" and p["manifest"].get("engine_disagrees"))
out["engine_disagreed_faults"] = disagreed

legal = [p for p in packet.values() if p["role"] != "fault"]
flags = [(p, d) for p in legal for d in p["diagnostics"] if d["level"] in ("warning", "error")]
new_only = [(p, d) for p, d in flags if emit[d["id"]] == ["new"]]
verdict, wrong_by_role = {}, {"twin": set(), "decoy": set()}
for p, d in flags:
    v = reader["legal"][d["id"]]["verdict"]
    verdict.setdefault(v, []).append(d["id"])
    if v == "wrong" and "new" in emit[d["id"]]:
        wrong_by_role[p["role"]].add(p["file"])
notes = [(p, d) for p in legal for d in p["diagnostics"] if d["check"] in FROM_MISSES | OWN_LIST]
note_verdicts = {}
for p, d in notes:
    note_verdicts.setdefault(reader["legal"].get(d["id"], {}).get("verdict", "not judged"), []).append(d["id"])
out["legal_files"] = {"files": len(legal), "decoys": sum(p["role"] == "decoy" for p in legal),
                      "files_with_a_warning_or_error": len({p["file"] for p, _ in flags}),
                      "decoys_with_a_warning_or_error": len({p["file"] for p, _ in flags if p["role"] == "decoy"}),
                      "complaints": len(flags), "complaints_from_new_checks_only": len(new_only),
                      "second_reader": {k: len(v) for k, v in verdict.items()},
                      "decoys_with_a_wrong_complaint_new_kernel": sorted(wrong_by_role["decoy"]),
                      "twins_with_a_wrong_complaint_new_kernel": sorted(wrong_by_role["twin"]),
                      "findings_of_the_20_new_checks_at_any_level": len(notes),
                      "of_those_by_verdict": {k: len(v) for k, v in note_verdicts.items()}}
(H / "results.json").write_text(json.dumps(out, indent=1) + "\n")

print(json.dumps(out, indent=1))
print("\n| File | Family | Planted mistake | Witness | Repeats court 3 | Old kernel | New kernel |\n|---|---|---|---|---|---|---|")
for f, cat, fault, wit, o, n in rows:
    mark = lambda x: f"caught (`{x}`)" if x else "missed"
    print(f"| {f.replace('.x3d','')} | {cat} | {fault} | {'X_ITE' if wit.startswith('x_ite') else 'reasoned'} | {rep.get(f) or ''} | {mark(o)} | {mark(n)} |")
