"""Metric audit for the DSPy trap-synthesis pilot: the benchmark must pass its own controls before any optimiser touches it.

Stdlib only; needs no model and no key. Run: python3 kit/tests/test_dspy_trap_synth.py
(1) the oracle (loomkit.traps itself) scores 1.0 on held-out scenes for every covered rule;
(2) every degenerate rule scores below 0.5 on every covered rule;
(3) the sandbox refuses imports, underscore names and a missing trap();
(4) a rule that only spots a keyword fails the twin term (the leak the first audit found).
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
        for rid, c in self.cases.items():
            for name, src in bench.DEGENERATE.items():
                s = bench.run_rule(src, c["pos_held"], c["neg_held"], c["twin_held"])["score"]
                self.assertLess(s, 0.5, f"{name} on {rid}")

    def test_keyword_rule_loses_on_twins(self):
        c = self.cases["route-undefined"]
        r = bench.run_rule(bench.DEGENERATE["has-route"], c["pos_held"], c["neg_held"], c["twin_held"])
        self.assertEqual(r["tnr_twin"], 0.0)

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
