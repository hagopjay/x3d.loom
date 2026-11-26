# Agent 16 report: headline reframing patches

Patches in agents/16/: x3d.loom.patch (12 hunks), x3d_mcp.patch (2), x3d.docs.patch (6). Each applies cleanly to fresh copies and gives byte-identical results. Labels are a/<path>, b/<path>, so use -p1. No number changed.

| File (repo) | Phrases | Places | Changed |
|---|---|---|---|
| flywheel/README.md (loom) | 52 of 53, 88 of 88, 66 of 66, no model no person, 39 of 53 | 5 | yes |
| flywheel/turn.py (loom) | generated ledger header | 1 | yes |
| flywheel/LEDGER.md (loom) | 52 of 53, 88 of 88, 66 of 66 | 4 rows | no, generated; see turn.py |
| selfcode/README.md | no model no person, 87 of 90, 39 of 53 | 3 | yes |
| selfcode/wild/README.md | 87 of 90, 39 of 53, people in loop 0 | 3 | yes |
| LEARNINGS-selfcode.md | 87 of 90 | 1 | yes |
| LEARNINGS-flywheel-turn-2.md | 88 of 88, 52 of 53 | 2 | yes |
| LEARNINGS-flywheel-turn-3.md | 66 of 66, 52 of 53, 88 of 88 | 3 | yes |
| docs/GLTF-VALIDATOR-PARITY.md (mcp) | covered 88 | 1 | yes |
| docs/USD-VALIDATION-PARITY.md (mcp) | 66 of 66 | 1 | yes |
| docs/self-coding.md (docs) | no person, 87 of 90, 39 of 53 | 3 | yes |
| docs/fault-court.md | 88 of 88, 52 of 53, 66 | 3 | yes |
| docs/usd-parity.md | 66 of 66 | 1 | yes |

Before and after:
1. "88 of 88 codes" becomes "88 of the 170 Khronos glTF-Validator codes (the 88 the project judged X3D can state; the project, not an outside party, classified the other 82)".
2. "52 of 53" gains ", a fix confirmation by a rule writer who had seen the faults (held-out figure: Loom arm, 17 to 20 of 25)".
3. "no language model, no person" becomes "The search made no model calls; its rules, tasks and checks were written by an AI agent with the owner present."
4. "87 of 90" gains "tasks written by the method's author, judged by the author's simulator".
5. "39 of 53 (74%...)" gains "47 of the 100 sampled scenes were left out by counted rules, 50 of the 53 tasks are animation only, and two preregistered predictions failed".

Not changed:
- E (Lean): no listed file compares the Loom to Lean. The only hit, flywheel/sprint-20261126/SPRINT.md, already has the safe wording; "Lean mode" in docs/learn/16 is unrelated. I put "a pass certifies the listed checks only" in the turn.py ledger header. The phrase "a deterministic, versioned, rerunnable checker with a public ledger of its misses" is placed nowhere; the owner may want it in flywheel/README.md.
- LOOM-v1.md rows 325 and 457: beyond the opening sections; 325 already says fix confirmation.
- Bare 66 of 66 and 88 cells in parity tables: the row label carries the denominator. Top-level READMEs and docs/learn "no model" hits are unrelated or absent; HTML pages not edited.

Apply from each repository root (regenerate LEDGER.md afterwards):
- cd x3d.loom && patch -p1 < agents/16/x3d.loom.patch
- cd x3d_mcp && patch -p1 < (same folder)/x3d_mcp.patch
- cd x3d.docs && patch -p1 < (same folder)/x3d.docs.patch

