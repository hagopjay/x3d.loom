"""Writer ablation, arms A and B, offline and free: replay the saved 17 Oct run.

Arm A = the model's first answer as it was. Arm B = the same first answer through the deterministic repair ladder
(`ladder/`, validator-gated, prune rung off) before any model sees the error. Both are scored on DELIVERED = valid on the
current fork AND the prompt's structural constraints hold, and B is checked for intent damage (constraints lost, scene
shrunk). Model repair rounds are NOT simulated: where B does not repair a scene, the recorded chain's own outcome is used as
an approximation (the saved repair saw the original text, not the laddered text), and the report says so.
Run: X3D_MCP_TREE=<x3d_mcp checkout> ML_ROOT=<x3d.ML checkout> python3 ablation_offline.py   (needs lxml, xmlschema, jsonschema, rdflib)
"""
from __future__ import annotations

import collections
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "ladder")); sys.path.insert(0, str(HERE))
os.environ.setdefault("X3D_MCP_TREE", "/home/user/x3d_mcp")
import autofix_chain as L          # noqa: E402
import x3d_metric as M             # noqa: E402
import fulfil                      # noqa: E402

ML = Path(os.environ.get("ML_ROOT", "/home/user/hagopjay/x3d.ml"))
RUN = ML / "runs/live-2026-10-17"
prompts = {json.loads(l)["prompt_id"]: json.loads(l) for l in (ML / "demo/live/prompts_live.jsonl").read_text().splitlines()}
rows = [json.loads(l) for l in (RUN / "events.jsonl").read_text().splitlines()]
rows = [r for r in rows if "error" not in r]


def body(r):
    return (RUN / "x3d" / r["model"].replace("/", "_") / f"{r['prompt_id']}_a{r['attempt']}.x3d").read_text()


chains = collections.defaultdict(list)
for r in rows: chains[(r["model"], r["prompt_id"])].append(r)

out, per, calib = [], collections.defaultdict(lambda: collections.Counter()), collections.Counter()
for (model, pid), ch in sorted(chains.items()):
    first = ch[0]; cons = prompts[pid]["constraints"]; t = body(first)
    kA = M.check(t); okA = kA["valid"]; fA, missA = fulfil.fulfilled(M.extract_x3d(t), cons) if okA else (False, ["invalid"])
    calib[(first.get("constraints_ok"), fA if okA else None)] += 1
    delivered_A = okA and fA
    rec = {"model": model, "prompt": pid, "A_valid": okA, "A_delivered": delivered_A}
    if okA:
        rec.update(B_valid=True, B_delivered=delivered_A, B_changed=False)
    else:
        try:
            fixed, kB, log = L.ladder(M.extract_x3d(t))
        except Exception as e:  # noqa: BLE001
            fixed, kB, log = t, kA, [("error", str(e)[:80])]
        okB = kB["valid"]; fB, missB = fulfil.fulfilled(fixed, cons) if okB else (False, ["invalid"])
        n0 = fulfil.counts(M.extract_x3d(t))["nodes"] if kA["xsd_errors"] != ["XML parse error"] and "parse" not in " ".join(kA["xsd_errors"]).lower() else None
        n1 = fulfil.counts(fixed)["nodes"] if okB else None
        rec.update(B_valid=okB, B_delivered=okB and fB, B_changed=bool(log), B_rungs=[r for r, _ in log],
                   B_missing=missB if okB and not fB else [], nodes_before=n0, nodes_after=n1)
        final = ch[-1]; rec["recorded_final_valid"] = bool(final["valid"]); rec["recorded_model_repair_calls"] = len(ch) - 1
    out.append(rec)

def pct(a, b): return round(100 * a / b, 1) if b else None
res = {"validator": os.popen(f"git -C {os.environ['X3D_MCP_TREE']} rev-parse --short HEAD").read().strip(), "chains": len(out),
       "constraint_checker_vs_recorded_constraints_ok_on_valid_first": {f"recorded={k[0]},mine={k[1]}": v for k, v in calib.items() if k[1] is not None},
       "per_model": {}}
for m in sorted({r["model"] for r in out}):
    rs = [r for r in out if r["model"] == m]
    n = len(rs); a = sum(r["A_delivered"] for r in rs); b = sum(r["B_delivered"] for r in rs)
    fixedby = sum(1 for r in rs if not r["A_valid"] and r["B_valid"])
    dmg = sum(1 for r in rs if r.get("B_valid") and not r["A_valid"] and not r["B_delivered"])
    shrunk = sum(1 for r in rs if r.get("nodes_before") and r.get("nodes_after") and r["nodes_after"] < 0.9 * r["nodes_before"])
    # model repair calls avoided: recorded chains whose first attempt failed but the ladder made valid
    avoided = sum(r.get("recorded_model_repair_calls", 0) for r in rs if not r["A_valid"] and r["B_valid"])
    res["per_model"][m] = {"chains": n, "A_first_delivered_pct": pct(a, n), "B_first_delivered_pct": pct(b, n),
                           "ladder_made_valid": fixedby, "valid_but_unfulfilled_after_ladder": dmg, "scene_shrunk_over_10pct": shrunk,
                           "recorded_repair_calls_those_chains_used": avoided}
tot = lambda k: sum(v[k] for v in res["per_model"].values() if v[k] is not None)
res["all"] = {"A_first_delivered": sum(r["A_delivered"] for r in out), "B_first_delivered": sum(r["B_delivered"] for r in out),
              "ladder_made_valid": tot("ladder_made_valid"), "valid_but_unfulfilled_after_ladder": tot("valid_but_unfulfilled_after_ladder"),
              "scene_shrunk_over_10pct": tot("scene_shrunk_over_10pct"), "recorded_repair_calls_avoidable": tot("recorded_repair_calls_those_chains_used")}
res["rungs_used"] = collections.Counter(x for r in out for x in r.get("B_rungs", [])).most_common()
(HERE / "ablation_offline.json").write_text(json.dumps({"summary": res, "rows": out}, indent=1))
print(json.dumps(res, indent=1))
