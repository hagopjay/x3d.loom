"""Score intent 1 by the rule fixed in PLAN.md.

    python3 score.py play-1.json play-2.json play-3.json > results.json

Reads the three plays and the frozen court 5 results beside this folder. Prints one JSON object.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
C5 = HERE.parent / "court-5"
plays = [json.loads(Path(p).read_text())["files"] for p in sys.argv[1:]]
assert len(plays) == 3, "the plan fixes three plays"

new, missed, court5_author, questioned = set(), set(), set(), set()
for arm in ("f", "s"):
    r = json.loads((C5 / f"results/arm-{arm}/results.json").read_text())
    packet = json.loads((C5 / f"results/arm-{arm}/packet.json").read_text())
    repeats = set(r["repeats_of_earlier_courts"].get("which", {}))
    new |= {e["file"] for e in packet if e["role"] == "fault"} - repeats
    missed |= set(r["headline"]["proven"]["missed_by_new"])
    court5_author |= set(r["intent_arm"]["of_those_the_kernel_missed"])
    v = json.loads((C5 / f"results/arm-{arm}/reader-verdicts.json").read_text())["faults"]
    questioned |= {k for k, x in v.items() if x.get("intent_gives_it_away") or x.get("real") != "real"}
assert missed <= new and len(missed) == 45, (len(new), len(missed))


def kind(line):
    if re.search(r"\bpixels?\b", line): return "pixels"
    if "count(" in line or ".length" in line: return "structure"
    if re.search(r"\b(changed|unchanged)$", line): return "changed or unchanged"
    return "field value"


keys = sorted(plays[0])
res = {k: [p[k]["result"] for p in plays] for k in keys}
flaky = sorted(k for k in keys if len(set(res[k])) > 1)
legal = [k for k in keys if "/fault-" not in k]
false_alarm = sorted(k for k in legal if "fails" in res[k] or "did not load" in res[k])
caught, caught_by, empty = [], {}, []
for k in sorted(new):
    twin = k.replace("fault-", "twin-")
    if all(x == "no assertion" for x in res[twin]): empty.append(k); continue
    if all(x == "all hold" for x in res[twin]) and all(x in ("fails", "did not load") for x in res[k]):
        caught.append(k)
        failing = [a["line"] for a in plays[0][k].get("assertions", []) if not a["holds"]]
        caught_by[k] = sorted({kind(l) for l in failing}) or ["did not load"]
by_kind = {}
for k, ks in caught_by.items():
    for x in ks: by_kind[x] = by_kind.get(x, 0) + 1
C, M = set(caught), missed
lines = [plays[0][k]["intent_lines"] for k in legal]
asserts = [len(plays[0][k].get("assertions", [])) for k in legal]
by_set = {s: {"new": sum(k[0] == s for k in new), "caught": sum(k[0] == s for k in C),
              "kernel_missed": sum(k[0] == s for k in M), "caught_of_kernel_missed": sum(k[0] == s for k in C & M)}
          for s in "abcs"}
out = {
    "read_this_first": "Intent written by a blind writer who saw only the corrected scene. Scored by PLAN.md. Never added to the file-only score.",
    "engine": json.loads(Path(sys.argv[1]).read_text())["engine"], "plays": 3,
    "headline": {"kernel_missed_new_mistakes": len(M), "caught": len(C & M), "which": sorted(C & M),
                 "not_caught": sorted(M - C),
                 "court_5_author_written_intent_on_the_same": len(court5_author & M)},
    "headline_without_scenes_the_court_5_reader_questioned": {"of": len(M - questioned), "caught": len((C & M) - questioned)},
    "all_new_mistakes": {"of": len(new), "caught": len(C), "kernel_proved": len(new - M), "kernel_or_play": len((new - M) | C)},
    "by_set": by_set,
    "catches_by_line_kind": by_kind,
    "caught_by": caught_by,
    "scenes_left_without_an_assertion": empty,
    "legal_files": {"count": len(legal), "false_alarms": false_alarm},
    "flaky_files": {k: res[k] for k in flaky},
    "lines_not_understood": sum(len(plays[0][k]["not_understood"]) for k in keys),
    "assertions_per_legal_scene": {"max": max(asserts), "mean": round(sum(asserts) / len(asserts), 2)},
}
print(json.dumps(out, indent=1))
