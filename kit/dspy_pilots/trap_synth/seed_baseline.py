"""Seed baseline: one call per rule, no optimiser. Model: set X3D_DSPY_LM / X3D_DSPY_BASE (an OpenAI-compatible endpoint).
Writes out/seed_baseline.json and appends one row per call to out/calls.jsonl (model, tokens, seconds, error)."""
import json, os, time
import dspy
import bench, program

lm = dspy.LM(os.environ["X3D_DSPY_LM"], model_type="chat", api_base=os.environ.get("X3D_DSPY_BASE"), api_key=os.environ.get("X3D_DSPY_KEY", "x"),
             temperature=0.3, max_tokens=int(os.environ.get("X3D_DSPY_MAXTOK", "6000")), cache=False, num_retries=2, timeout=240)
dspy.configure(lm=lm)
cases = bench.build(); ids = sorted(cases)
pred = dspy.Predict(program.WriteTrap)
out, log = {}, open(os.path.join(os.path.dirname(__file__), "out", "calls.jsonl"), "a")
for ex in program.examples(cases, ids):
    t = time.time(); err = None; code = ""
    try:
        code = pred(**ex.inputs()).rule_code
    except Exception as e:  # noqa: BLE001
        err = f"{type(e).__name__}: {str(e)[:160]}"
    h = lm.history[-1] if lm.history else {}
    u = (h.get("usage") or {}) if isinstance(h, dict) else {}
    log.write(json.dumps({"case": ex.case_id, "model": lm.model, "s": round(time.time() - t, 1), "tokens_in": u.get("prompt_tokens"),
                          "tokens_out": u.get("completion_tokens"), "err": err}) + "\n"); log.flush()
    c = cases[ex.case_id]
    r = bench.run_rule(program.strip_fences(code), c["pos_held"], c["neg_held"], c["twin_held"]) if code else {"score": 0.0, "error": err}
    out[ex.case_id] = {"held": r, "code": program.strip_fences(code)}
    print(ex.case_id, r["score"], r.get("tpr"), r.get("tnr"), r.get("tnr_twin"), (r.get("error") or "")[:60], flush=True)
json.dump(out, open(os.path.join(os.path.dirname(__file__), "out", "seed_baseline.json"), "w"), indent=1)
vals = [v["held"]["score"] for v in out.values()]
print("mean held score", round(sum(vals) / len(vals), 3), "perfect", sum(v == 1.0 for v in vals), "of", len(vals))
