"""Pilot 2: replay the saved 17 Oct 2026 live run (x3d.ML runs/live-2026-10-17) with no model call.

Answers four things a DSPy plan needs before it spends anything:
  1. what the metric would have said (valid vs valid-and-draws) per model and per attempt;
  2. which failure classes a first answer dies of, and how much of the failing mass the top few classes cover (the prompt's job);
  3. validator drift: how many saved verdicts change under the current fork checkout (the metric's pin);
  4. what a fixer that only follows the validator's own printed fix-it hints would already repair (the part DSPy should not be paid to learn).
Inputs: ML_ROOT (x3d.ML checkout), MCP_ROOT (x3d_mcp checkout). Run with a python that has lxml, xmlschema, jsonschema, rdflib.
"""
from __future__ import annotations

import collections
import json
import os
import re
import sys
from pathlib import Path

ML = Path(os.environ.get("ML_ROOT", "/home/user/hagopjay/x3d.ml"))
MCP = Path(os.environ.get("MCP_ROOT", "/home/user/x3d_mcp"))
sys.path[0:0] = [str(MCP / "src"), str(MCP)]
from validation.validate import validate_xml        # noqa: E402
from validation.semantic import validate_semantic   # noqa: E402

RUN = ML / "runs/live-2026-10-17"
rows = [json.loads(l) for l in (RUN / "events.jsonl").read_text().splitlines()]
rows = [r for r in rows if "error" not in r]
renders = {}
for p in sorted((ML / "demo/data").glob("renders_live_part*.json")):
    renders.update(json.loads(p.read_text()))


def cls(msg: str) -> str:
    m = re.sub(r"Line \d+: ", "", msg)
    sm = re.search(r"\*\*\[([\w-]+)\]\*\*", m)
    if sm: return "semantic:" + sm.group(1)
    a = re.match(r"Element '(\w+)', attribute '(\w+)'", m)
    if a: return f"xsd:{a.group(1)}.{a.group(2)}"
    if m.startswith("XML parse error"): return "xml-parse"
    return "xsd:" + re.sub(r"[^A-Za-z ]", "", m)[:40].strip()


def body(r):
    return RUN / "x3d" / r["model"].replace("/", "_") / f"{r['prompt_id']}_a{r['attempt']}.x3d"


def draws(r):
    v = renders.get(f"{r['model'].replace('/', '_')}/{r['prompt_id']}_a{r['attempt']}.x3d")
    return None if v is None else v.get("nonblank", 0) > 0.001


first = [r for r in rows if r["attempt"] == 1]
chains = collections.defaultdict(list)
for r in rows: chains[(r["model"], r["prompt_id"])].append(r)
final = [c[-1] for c in chains.values()]

out = {"call_rows": len(rows), "chains": len(chains), "first_attempts": len(first)}
per = {}
for m in sorted({r["model"] for r in rows}):
    f = [r for r in first if r["model"] == m]; fn = [c[-1] for k, c in chains.items() if k[0] == m]
    d = [draws(r) for r in f if r["valid"]]
    per[m] = {"chains": len(f), "first_valid": sum(r["valid"] for r in f), "first_valid_pct": round(100 * sum(r["valid"] for r in f) / len(f), 1),
              "final_valid_pct": round(100 * sum(r["valid"] for r in fn) / len(fn), 1),
              "first_valid_and_draws_pct": round(100 * sum(1 for r in f if r["valid"] and draws(r)) / len(f), 1),
              "valid_but_blank_first": sum(1 for x in d if x is False), "no_render_row": sum(1 for x in d if x is None)}
out["per_model"] = per
out["final_valid"] = sum(r["valid"] for r in final)
out["final_valid_blank"] = sum(1 for r in final if r["valid"] and draws(r) is False)

# 2. failure classes on first attempts (a first attempt counts once per class)
fail = [r for r in first if not r["valid"]]
cnt = collections.Counter()
for r in fail:
    for c in sorted({cls(x) for x in r["xsd_errors"] + r["sem_errors"]}): cnt[c] += 1
solo = sum(1 for r in fail if len({cls(x) for x in r["xsd_errors"] + r["sem_errors"]}) == 1)
out["first_failures"] = len(fail); out["first_failures_single_class"] = solo
ranked = sorted(cnt.items(), key=lambda kv: (-kv[1], kv[0]))  # ties broken by name: deterministic across hash seeds
out["top_classes"] = [list(kv) for kv in ranked[:12]]
top = [c for c, _ in ranked[:5]]
out["first_failures_cleared_if_top5_classes_never_happened"] = sum(
    1 for r in fail if {cls(x) for x in r["xsd_errors"] + r["sem_errors"]} <= set(top))

# 3. drift under the current validator
chg, tot, note = 0, 0, collections.Counter()
for r in rows:
    p = body(r)
    if not p.exists(): continue
    t = p.read_text(); tot += 1
    v = validate_xml(t); ok = bool(v.get("valid"))
    if ok:
        sem = validate_semantic(t)
        n = re.search(r"Found (\d+) error", sem if isinstance(sem, str) else "")
        ok = (int(n.group(1)) == 0) if n else True
    if ok != bool(r["valid"]):
        chg += 1; note["now-invalid" if r["valid"] else "now-valid"] += 1
out["drift"] = {"bodies_rechecked": tot, "verdict_changed": chg, **dict(note), "validator": os.popen(f"git -C {MCP} rev-parse --short HEAD").read().strip()}

# 4. fix-it hints the validator itself printed on first failures
hint = sum(1 for r in fail if r.get("fixes"))
only_fixable = sum(1 for r in fail if r.get("fixes") and {cls(x) for x in r["xsd_errors"] + r["sem_errors"]} <= {"semantic:profile-component"})
out["first_failures_only_profile_component_with_hint"] = only_fixable
out["first_failures_with_printed_fix_hint"] = hint
(Path(__file__).with_name("replay_17oct.json")).write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
