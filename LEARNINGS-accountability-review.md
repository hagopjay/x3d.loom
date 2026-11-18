# Learnings: external accountability review (18 Nov 2026)

An outside frontier model reviewed the framework against "X3D is the 3D format an AI can be held accountable to"
and ranked ten defects. Each was re-checked here before any fix; grades are this thread's, not the reviewer's.

| # | Defect | Grade | How it was checked | Fix | Where |
|---:|---|:-:|---|---|---|
| 1 | `loom traps` wrote status=fail and exited 0 | **C** | the kit's own subprocess control asserted exit 0 for a failing fixture: the test enshrined the bug | exit follows the records: fail 1, error 2, written first | `kit/loomkit/cli.py` `witness_exit` |
| 2 | Blender basic checker accepts `<Banana>`; compressed exports skip checks; semantic errors only log | **C** (source at 044bea3) | `validate.py:38-52` checks root and version only; `export_x3d.py:1967` returns early on compress | owned by the blenderizer thread, x3d-blender-io PR #46 | not here |
| 3 | `record --status pass --grade C` satisfies a required witness | **C** | the reviewer's probe, now a control | typed `origin` (executed/declared/reviewed); `record` refuses C; a non-executed pass needs the rule to name its origin; `instrument` pins the tool | `core.py`, `accept.py`, `cli.py` |
| 4 | profile requires 11 trap rules, tool emits 15, acceptance compares equality | **C**, wider than reported | 17 of 20 shipped profiles were stale (traps 11 vs 15; page-traps 6 or 7 vs 8) | `rules_include: [ids]` (rule sets only grow, verified in git history), `{min: n}`; a control loads every shipped profile against a fresh witness | `kit/profiles/*.json`, `accept.coverage_ok` |
| 4b | no workflow covered `kit/**` | **C** | path filters in bridge/gltf/s1 workflows | `.github/workflows/kit.yml` | |
| 10 | fold-back applied to an empty repo with the author's own smoke | **C** (source) | `foldback.py:57-80` | `--target REPO --base SHA --consumer CMD`: clean clone at the base, consumer before and after, outcome held / improved / regressed / still failing; `x3d-static/v2` demands `target_bound` | `foldback.check_target` |

Controls: `kit/tests/test_gates.py` 88 to **102** negative controls caught with the intended code, normal and `-O`
(Python 3.13, git 2.x, node 22); hep-event 207 and metal-site 25 unchanged.

## Lessons (new failure modes)

- **A test can pin a defect.** `cli_subprocess_controls` required `returncode == 0` for the trap fixture. Before
  fixing an exit code, grep the tests for the old code: they will fail, and that failure is the evidence.
- **A count is not an identity.** "11 rules" stayed true of no tool for 11 days. Bind ids, let sets grow.
- **A declaration is not a measurement.** Grade C must mean an instrument ran. Keep origin on the record.
- **Same-second `.pyc` masks a patch.** In target mode the regressing fixture passed: the before-run wrote
  `__pycache__/lib.cpython-*.pyc` stamped in the same second, with the same source size, so Python reused it after
  the patch. `PYTHONDONTWRITEBYTECODE` does not help under `-E`. Fix: `git checkout -- . && git clean -fdx` between
  the before- and after-runs.
- **Exit codes break scripts on purpose.** Six expected-fail control lines in `kit/examples/*.sh` and
  `x3d.brain/run_brain.sh` now say `|| [ $? -eq 1 ]` and still check the record's status next.

Residual (graded honestly): records are unsigned JSON, so a hand-edited file with `origin: executed` still passes;
origin typing closes the CLI path, not a forger. A target-bound fold-back shows one base stays green, not that the
knowledge helps a later independent task (the held-out comparison the review asks for is still open).

Sibling fixes from the same review: x3d.demo `tools/assurance/validate_scenes.py` (D5), `heritage-geo/v3` (D6),
`tools/tiles3d` v2 (D7), `docs/lib/gfx-guard.js` + `giza-osiris-hall/v6.1` (D9); x3d_mcp
`tests/fixtures/standards-disagreements/volume-transferFunction` (D8, upstream report HELD).
