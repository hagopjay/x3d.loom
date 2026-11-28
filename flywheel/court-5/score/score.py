#!/usr/bin/env python3
"""Score court 5 from the saved diagnostics, the readers' verdicts and the play test. Runs no kernel.

    python3 flywheel/court-5/score/score.py <score dir>

Inputs in <score dir>:
  packet.json, emit.json     build_packet.py
  reader-verdicts.json       the second reader, who has not seen the kernel:
                             {"faults": {file: {"naming": [ids], "real": "real" | "not-a-fault" | "unsure",
                                                "repeats_prior": "P017" or null, "intent_gives_it_away": bool}},
                              "legal":  {id: {"verdict": "right" | "wrong"}}}
  editor-verdicts.json       optional, same shape, written by the kernel editor before the reader reports
  play.json                  optional, play/play.mjs on the files with their intent lines
  provenance.json            optional, {check id: "grid" | "misses" | "other"} for the checks the new kernel adds

Two catch rules are printed for every count:
  named    the rule of courts 2 to 4: the file fails the XSD, or the reader says a diagnostic names the mistake
  proven   named, and the evidence is absent on the corrected twin: the twin passes the XSD, and the check that
           names the mistake fires more often on the fault than on its twin. This is court 5's headline rule.
"""
import json, sys
from math import comb
from pathlib import Path

H = Path(sys.argv[1])
load = lambda n, d=None: json.loads((H / n).read_text()) if (H / n).exists() else d
packet = {p["file"]: p for p in load("packet.json")}
emit, reader = load("emit.json"), load("reader-verdicts.json")
editor, play, prov = load("editor-verdicts.json"), load("play.json"), load("provenance.json", {})
K = ("old", "new")


def xsd_ok(f, k):
    return packet[f]["xsd_valid" if k == "new" else "xsd_valid_oldkernel"] is not False


def count(f, k, check):
    return sum(d["check"] == check and k in emit[d["id"]] for d in packet[f]["diagnostics"])


def twin_of(f):
    t = packet[f]["manifest"].get("twin")
    return f"{f.split('/')[0]}/{t}" if t else None


def caught(f, k, verdicts, rule):
    """Return the check id (or 'xsd') that catches fault f for kernel k under the rule, else ''."""
    t = twin_of(f)
    if not xsd_ok(f, k) and (rule == "named" or (t in packet and xsd_ok(t, k))):
        return "xsd"
    by_id = {d["id"]: d for d in packet[f]["diagnostics"]}
    for i in verdicts["faults"][f]["naming"]:
        if k not in emit[i]:
            continue
        c = by_id[i]["check"]
        if rule == "named" or (t in packet and count(f, k, c) > count(t, k, c)):
            return c
    return ""


def mcnemar(gained, lost):
    n, m = gained + lost, min(gained, lost)
    return 1.0 if n == 0 else min(1.0, 2 * sum(comb(n, i) for i in range(m + 1)) / 2 ** n)


def tally(faults, verdicts=reader):
    out = {"faults": len(faults)}
    for rule in ("proven", "named"):
        got = {k: {f for f in faults if caught(f, k, verdicts, rule)} for k in K}
        g, l = got["new"] - got["old"], got["old"] - got["new"]
        out[rule] = {"old": len(got["old"]), "new": len(got["new"]), "gained": sorted(g), "lost": sorted(l),
                     "exact_two_sided_p": round(mcnemar(len(g), len(l)), 4), "missed_by_new": sorted(set(faults) - got["new"])}
    return out


faults = sorted(f for f, p in packet.items() if p["role"] == "fault")
missing = [f for f in faults if f not in reader["faults"]]
if missing:
    sys.exit(f"the reader gave no verdict on {missing}")
rep = {f: reader["faults"][f].get("repeats_prior") for f in faults}
fresh = [f for f in faults if not rep[f]]
out = {"headline_rule": "proven, on the faults that repeat no earlier planted mistake",
       "headline": tally(fresh), "repeats_of_earlier_courts": {**tally([f for f in faults if rep[f]]), "which": {f: r for f, r in rep.items() if r}},
       "all_faults": tally(faults),
       "by_set": {s: tally([f for f in fresh if f.startswith(s + "/")]) for s in sorted({f.split("/")[0] for f in faults})}}
notreal = sorted(f for f in faults if reader["faults"][f].get("real", "real") != "real")
out["faults_the_reader_did_not_call_real"] = notreal
out["headline_without_those"] = tally([f for f in fresh if f not in notreal])
if editor:
    e = tally(fresh, editor)
    out["editor_reading_of_headline"] = {"old": e["proven"]["old"], "new": e["proven"]["new"],
        "readers_disagree_on": sorted(f for f in fresh for k in K if bool(caught(f, k, reader, "proven")) != bool(caught(f, k, editor, "proven")))}
gained = {f: caught(f, "new", reader, "proven") for f in out["headline"]["proven"]["gained"]}
out["headline_gains_by_where_the_check_came_from"] = {
    src: sorted(f for f, c in gained.items() if prov.get(c, "other" if c != "xsd" else "xsd") == src) for src in ("grid", "misses", "other", "xsd")}

legal = [p for p in packet.values() if p["role"] != "fault"]
flags = [(p, d) for p in legal for d in p["diagnostics"] if d["level"] in ("warning", "error")]
wrong = {"twin": set(), "decoy": set()}
verdicts = {}
for p, d in flags:
    v = reader["legal"].get(d["id"], {}).get("verdict", "not judged")
    verdicts[v] = verdicts.get(v, 0) + 1
    if v != "right" and "new" in emit[d["id"]]:
        wrong[p["role"]].add(p["file"])
new_any = [(p, d) for p in legal for d in p["diagnostics"] if d["check"] in prov]
out["legal_files"] = {"files": len(legal), "decoys": sum(p["role"] == "decoy" for p in legal),
                      "warnings_and_errors": len(flags), "second_reader": verdicts,
                      "decoys_with_a_complaint_not_judged_right_new_kernel": sorted(wrong["decoy"]),
                      "twins_with_a_complaint_not_judged_right_new_kernel": sorted(wrong["twin"]),
                      "findings_of_the_new_checks_at_any_level": len(new_any),
                      "of_those_not_judged_right": sum(reader["legal"].get(d["id"], {}).get("verdict") != "right" for _, d in new_any)}

if play:
    P = play["files"]
    has = [f for f in fresh if P.get(f, {}).get("assertions")]
    hit = [f for f in has if P[f]["result"] == "fails" and P.get(twin_of(f), {}).get("result") == "all hold"]
    miss_new = set(out["headline"]["proven"]["missed_by_new"])
    alarms = sorted(f for f, r in P.items() if packet.get(f, {}).get("role") in ("twin", "decoy") and r["result"] in ("fails", "did not load"))
    away = sorted(f for f in hit if reader["faults"][f].get("intent_gives_it_away"))
    out["intent_arm"] = {"read_this_first": "A separate arm. The author's stated intent is checked by playing the scene. Never added to the headline.",
                         "engine": play.get("engine"), "new_faults_with_an_assertion": len(has),
                         "caught_by_play": sorted(hit), "of_those_the_kernel_missed": sorted(set(hit) & miss_new),
                         "caught_where_the_reader_says_the_intent_gives_the_fault_away": away,
                         "legal_files_that_fail_their_own_intent": alarms,
                         "lines_not_understood": sum(len(r["not_understood"]) for r in P.values())}
(H / "results.json").write_text(json.dumps(out, indent=1) + "\n")
print(json.dumps(out, indent=1))
print("\n| File | Family | Planted mistake | Repeats | Old kernel | New kernel | Play test |\n|---|---|---|---|---|---|---|")
for f in faults:
    m = packet[f]["manifest"]
    mark = lambda k: (lambda p, n: f"proven (`{p}`)" if p else f"named only (`{n}`)" if n else "missed")(caught(f, k, reader, "proven"), caught(f, k, reader, "named"))
    pt = (play or {"files": {}})["files"].get(f, {}).get("result", "")
    print(f"| {f.replace('.x3d', '')} | {m.get('category', '')} | {m.get('fault', '')} | {rep[f] or ''} | {mark('old')} | {mark('new')} | {pt} |")
