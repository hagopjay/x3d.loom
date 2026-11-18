"""Pilot 1 runner. Modes:
  audit    offline, $0: oracle and degenerate-rule scores on held-out scenes (the metric must pass this before any optimiser)
  plan     offline, $0: leave-one-out plan, call count and a cost bound for the model you name; calls nothing
  run      calls a model through DSPy GEPA. Refuses without --ok-spend and a model that you set in X3D_DSPY_LM.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import bench

OUT = Path(__file__).with_name("out"); OUT.mkdir(exist_ok=True)


def audit():
    cases = bench.build()
    rows = []
    for rid, c in cases.items():
        row = {"rule": rid, "pos_held": len(c["pos_held"]), "neg_held": len(c["neg_held"]), "twin_held": len(c["twin_held"]),
               "oracle": round(bench.oracle_rows(c, "held")["score"], 3)}
        for n, src in bench.DEGENERATE.items():
            row[n] = bench.run_rule(src, c["pos_held"], c["neg_held"], c["twin_held"])["score"]
        rows.append(row)
    worst = max(max(v for k, v in r.items() if k in bench.DEGENERATE) for r in rows)
    res = {"rules_covered": list(cases), "not_covered": bench.NOT_COVERED, "rows": rows,
           "oracle_all_one": all(r["oracle"] == 1.0 for r in rows), "worst_degenerate": worst, "pass": worst < 0.5}
    (OUT / "audit.json").write_text(json.dumps(res, indent=1))
    print(json.dumps({k: v for k, v in res.items() if k != "rows"}, indent=1))
    return res


def plan(k_train, calls_per_rule):
    cases = bench.build(); ids = list(cases)
    n_writer = len(ids) * calls_per_rule
    print(f"{len(ids)} rules; leave-{len(ids) - k_train}-out: optimise on {k_train}, test on {len(ids) - k_train}")
    print(f"GEPA budget {calls_per_rule} metric calls per training rule -> about {k_train * calls_per_rule} writer calls "
          f"plus reflection calls (one per ~5 metric calls); about {k_train * calls_per_rule + k_train * calls_per_rule // 5} calls "
          "in total, ~1.1k tokens in and ~0.4k out each. Plus 2 held-out calls per rule for seed and learned.")
    print("Multiply by your model's price. Nothing was called.")


def run(args):
    if not args.ok_spend:
        sys.exit("refusing: pass --ok-spend only after the owner has typed a yes for this model and this budget")
    import dspy
    from program import WriteTrap, examples, make_metric
    lm_name = os.environ.get("X3D_DSPY_LM")
    if not lm_name: sys.exit("set X3D_DSPY_LM (a LiteLLM model id); the key comes from your environment, never from this repo")
    kw = dict(model_type="chat", api_base=os.environ.get("X3D_DSPY_BASE"), api_key=os.environ.get("X3D_DSPY_KEY", "x"), cache=False, num_retries=2, timeout=300)
    mt = int(os.environ.get("X3D_DSPY_MAXTOK", "10000"))
    lm = dspy.LM(lm_name, temperature=0.5, max_tokens=mt, **kw); dspy.configure(lm=lm)
    cases = bench.build(); ids = sorted(cases)
    rng = __import__("random").Random(7); rng.shuffle(ids)
    tr, te = ids[:args.k_train], ids[args.k_train:]
    prog = dspy.Predict(WriteTrap)
    gepa = dspy.GEPA(metric=make_metric(cases, "train"), max_metric_calls=args.k_train * args.calls_per_rule,
                     num_threads=int(os.environ.get("X3D_DSPY_THREADS", "4")),
                     reflection_lm=dspy.LM(os.environ.get("X3D_DSPY_REFLECT", lm_name), temperature=1.0, max_tokens=mt, **kw))
    learned = gepa.compile(prog, trainset=examples(cases, tr), valset=examples(cases, tr))
    ev = lambda p, name: [(g.case_id, make_metric(cases, "held")(g, p(**g.inputs())).score) for g in examples(cases, te)]  # noqa: E731
    res = {"train": tr, "test": te, "seed": ev(prog, "seed"), "learned": ev(learned, "learned"),
           "instruction": learned.signature.instructions}
    (OUT / "run.json").write_text(json.dumps(res, indent=1)); print(json.dumps(res, indent=1)[:1500])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("mode", choices=["audit", "plan", "run"])
    ap.add_argument("--k-train", type=int, default=5); ap.add_argument("--calls-per-rule", type=int, default=24)
    ap.add_argument("--ok-spend", action="store_true")
    a = ap.parse_args()
    {"audit": lambda: audit(), "plan": lambda: plan(a.k_train, a.calls_per_rule), "run": lambda: run(a)}[a.mode]()
