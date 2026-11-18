"""Metric audit for the DSPy trap-synthesis pilot: the benchmark must pass its own controls before any optimiser touches it.

Stdlib only; needs no model and no key. Run: python3 kit/tests/test_dspy_trap_synth.py
(1) the oracle (loomkit.traps itself) scores 1.0 on held-out scenes for every covered rule;
(2) every degenerate rule scores below 0.5 on every covered rule;
(3) the sandbox refuses imports, underscore names and a missing trap();
(4) a rule that only spots a keyword fails the twin term (the leak the first audit found).
Added after the 18 Nov external review:
(5) the two saved model rules the review found overfit (color-range, glsl-reserved-active) no longer score above 0.5;
(6) a call-count cheat and a mutation-fingerprint rule score below 0.5 (fresh namespace per scene; sealed held-out variants);
(7) no scene content crosses show/train/held; (8) the audit's pass field requires the oracle on twins too.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "dspy_pilots" / "trap_synth"))
import bench  # noqa: E402
import sandbox  # noqa: E402


class TrapSynthAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = bench.build()

    def test_cases_exist(self):
        self.assertGreaterEqual(len(self.cases), 8)

    def test_oracle_is_perfect(self):
        for rid, c in self.cases.items():
            self.assertEqual(bench.oracle_rows(c, "held")["score"], 1.0, rid)

    def test_degenerates_fail(self):
        import run_pilot
        for rid, c in self.cases.items():
            for name, src in run_pilot.degenerates(c).items():
                s = bench.run_rule(src, c["pos_held"], c["neg_held"], c["twin_held"])["score"]
                self.assertLess(s, 0.5, f"{name} on {rid}")

    def test_keyword_rule_loses_on_twins(self):
        c = self.cases["route-undefined"]
        r = bench.run_rule(bench.DEGENERATE["has-route"], c["pos_held"], c["neg_held"], c["twin_held"])
        self.assertEqual(r["tnr_twin"], 0.0)

    def test_saved_overfit_rules_now_fail(self):
        import json
        saved = json.loads((Path(bench.__file__).parent / "out" / "seed_baseline.json").read_text())
        for rid in ("color-range", "glsl-reserved-active"):
            c = self.cases[rid]
            r = bench.run_rule(saved[rid]["code"], c["pos_held"], c["neg_held"], c["twin_held"])
            self.assertLess(r["score"], 0.5, rid)

    def test_no_content_crosses_partitions(self):
        for rid, c in self.cases.items():
            sets = {g: {bench.ckey(x) for _, x in c[f"neg_{g}"]} for g in ("show", "train", "held")}
            self.assertFalse(sets["train"] & sets["held"] or sets["show"] & sets["held"] or sets["show"] & sets["train"], rid)

    def test_audit_passes_and_requires_oracle(self):
        import run_pilot
        res = run_pilot.audit()
        self.assertTrue(res["pass"]); self.assertTrue(res["oracle_all_one"])

    def test_sandbox_screen(self):
        for bad in ("import os\ndef trap(root):\n    return True\n", "def trap(root):\n    return root.__class__\n",
                    "def f(root):\n    return True\n", "def trap(root):\n    return open('x')\n"):
            self.assertIsNotNone(sandbox.screen(bad), bad)
        self.assertIsNone(sandbox.screen("def trap(root):\n    return False\n"))

    def test_sandbox_survives_a_loop(self):
        res, err = sandbox.run("def trap(root):\n    while True:\n        pass\n", ["<X3D/>"], timeout=40)
        self.assertEqual(res, [None])


if __name__ == "__main__":
    unittest.main()
