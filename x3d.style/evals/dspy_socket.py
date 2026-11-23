"""The DSPy socket for the X3D style grammar. Designed, switched OFF.

What an optimizer needs, and where it is:
  dataset   node bin/eval.mjs tasks train|dev      JSON lines: id, family, brief, input (a failing style or null)
  metric    node bin/eval.mjs score <task-id>      reads a candidate style on stdin, prints {"score": 0..1, ...}
  baseline  node bin/eval.mjs baselines            identity, home-palette and the deterministic repair operator

The metric is a measurement (14 grammar rules, colour distance in OKLab), not a model's opinion, so a program
cannot mark its own homework. A DSPy optimizer (MIPROv2, GEPA) maximises `metric` below over the train split and
is judged on dev against the `repair` baseline. GEPA can read `feedback`: the failing rules with their measured
values and thresholds, which is the text a reflective optimizer wants.

Nothing in this file imports dspy or calls a model until XST_DSPY=1 is set AND a language model is configured by
the person running it. The lane's standing instruction is no language-model spend.

Run (only when switched on):  XST_DSPY=1 python3 evals/dspy_socket.py --optimizer mipro --budget light
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
EVAL = ["node", os.path.join(ROOT, "bin", "eval.mjs")]


def load_tasks(split):
    """The task set as plain dicts. Needs Node only."""
    out = subprocess.run(EVAL + ["tasks", split], capture_output=True, text=True, check=True).stdout
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def score(task_id, style_json_text):
    """Score one candidate. Returns the metric dict; a candidate that is not JSON scores 0."""
    try:
        json.loads(style_json_text)
    except Exception as e:  # noqa: BLE001
        return {"score": 0.0, "detail": f"not JSON: {e}"}
    r = subprocess.run(EVAL + ["score", task_id], input=style_json_text, capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else {"score": 0.0, "detail": r.stderr[:300]}


def metric(example, pred, trace=None, pred_name=None, pred_trace=None):
    """DSPy metric. Returns a float for MIPROv2/BootstrapFewShot; GEPA also reads .feedback via the dict form."""
    m = score(example.task_id, getattr(pred, "style_json", "") or "")
    if pred_name is not None:  # GEPA asks for feedback
        return {"score": m.get("score", 0.0), "feedback": f"grammar {m.get('grammar')}, fidelity {m.get('fidelity')}, failing rules: {m.get('detail') or 'none'}"}
    return m.get("score", 0.0)


def main():
    if os.environ.get("XST_DSPY") != "1":
        print("DSPy socket is OFF (set XST_DSPY=1 and configure a model to use it). Nothing was run, nothing was spent.")
        print(f"tasks available: train {len(load_tasks('train'))}, dev {len(load_tasks('dev'))}")
        return 0
    import dspy  # noqa: PLC0415  (imported only when switched on)

    class StyleFromBrief(dspy.Signature):
        """Return one X3D style as JSON with all 10 parts of speech (palette, surface, light, air, line, form, type,
        motion, encode, view). It must pass the grammar. For a repair task change only palette lightness."""
        brief: str = dspy.InputField()
        input_style_json: str = dspy.InputField(desc="the failing style, or 'null' for an authoring task")
        style_json: str = dspy.OutputField(desc="the complete style as one JSON object")

    def ex(t):
        return dspy.Example(task_id=t["id"], brief=t["brief"], input_style_json=json.dumps(t["input"])).with_inputs("brief", "input_style_json")

    train, dev = [ex(t) for t in load_tasks("train")], [ex(t) for t in load_tasks("dev")]
    if dspy.settings.lm is None:
        print("XST_DSPY=1 but no language model is configured (dspy.configure(lm=...)). Stopping before any call.")
        return 2
    program = dspy.ChainOfThought(StyleFromBrief)
    name = sys.argv[sys.argv.index("--optimizer") + 1] if "--optimizer" in sys.argv else "mipro"
    budget = sys.argv[sys.argv.index("--budget") + 1] if "--budget" in sys.argv else "light"
    opt = dspy.GEPA(metric=metric, auto=budget) if name == "gepa" else dspy.MIPROv2(metric=metric, auto=budget)
    best = opt.compile(program, trainset=train, valset=dev) if name == "gepa" else opt.compile(program, trainset=train)
    result = dspy.Evaluate(devset=dev, metric=metric, num_threads=4)(best)
    best.save(os.path.join(ROOT, "out", f"dspy-{name}-program.json"))
    print("dev score", result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
