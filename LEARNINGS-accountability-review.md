# Learnings: external accountability review (18 Nov 2026)

An outside frontier model reviewed the framework against "X3D is the 3D format an AI can be held accountable to"
and ranked ten defects. Each was re-checked here before any fix; grades are this thread's, not the reviewer's.

| # | Defect | Grade | How it was checked | Fix | Where |
|---:|---|:-:|---|---|---|
| 1 | `loom traps` wrote status=fail and exited 0 | **C** | the kit's own subprocess control asserted exit 0 for a failing fixture: the test enshrined the bug | exit follows the records: fail 1, error 2, written first | `kit/loomkit/cli.py` `witness_exit` |
| 2 | Blender basic checker accepts `<Banana>`; compressed exports skip checks; semantic errors only log | **C** (source at 044bea3) | `validate.py:38-52` checks root and version only; `export_x3d.py:1967` returns early on compress | owned by the blenderizer thread, x3d-blender-io PR #46 | not here |
| 3 | `record --status pass --grade C` satisfies a required witness | **C** | the reviewer's probe, now a control | typed `origin` (executed/declared/reviewed); `record` refuses C; a non-executed pass needs the rule to name its origin; `instrument` pins the tool | `core.py`, `accept.py`, `cli.py` |
| 4 | profile requires 11 trap rules, tool emits 15, acceptance compares equality | **C**, wider than reported | 15 of 20 shipped profiles were stale, 24 requirements in all, at ba8ea1a (traps 11 vs 15; page-traps 6 or 7 vs 8); 17 existing profiles were migrated to `rules_include` (the 15 stale plus 2 that were current; `git diff --name-status ba8ea1a main -- kit/profiles`: 17 M, 2 A). Corrected after the second review: the first count said 17 stale | `rules_include: [ids]` (rule sets only grow, verified in git history), `{min: n}`; a control loads every shipped profile against a fresh witness | `kit/profiles/*.json`, `accept.coverage_ok` |
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

## Second review, 18 Nov 2026 (Loom items)

| # | Finding | Grade (ours) | Reproduced | Fix | Control |
|---|---|---|---|---|---|
| R2-1 | `foldback --target` hashed the patch file at start, then `git apply` re-read it after the baseline consumer run: a swapped file gave hash A, applied B | **C** | old code: original hash recorded, outcome `regressed` from the swapped bytes | `freeze()`: read once, hash those bytes, apply only a private read-only copy; record `patch_frozen` | `test_gates.py` R2-D1 race control fails on the old code, passes now |
| R2-1b | a patch that edits its own oracle (test file, or a file the consumer names) reads as `held` / `improved` | **C** | patch breaking `lib.py` and rewriting `check.py` to accept it: `held` | `scorer_changed` list; outcome gains `(scorer changed: …)`; coverage `scorer_unchanged`; profile `x3d-static/v3` requires it | R2-D1 cheat control + v3 coverage control |
| R2-6 | README publication example still used empty-repo `--patch` and `x3d-static.json` (v1) | **C** | README lines 48, 60, 63 | target-bound example; accept/receipt on v3; v1 marked LEGACY | read-through |
| R2 | `origins` as a string matched by substring (`"declared" in "undeclared"`) | **C** | `rule.get("origins")` used with `in` | `load_profile` refuses a non-list or unknown origin (`PROFILE_ORIGINS`) | string-origins control |
| R2 | recount: 15 of 20 stale (24 requirements), not 17 | **C** | `git show ba8ea1a:kit/profiles/*` against 15 trap / 8 page-trap rules | table row above corrected | — |

Lesson: a hash only binds evidence if the hashed bytes are the bytes used. Freeze inputs before anything slow runs.

## Third review, 18 Nov 2026 (Loom items)

| # | Finding | Grade (ours) | Reproduced | Fix | Control |
|---|---|---|---|---|---|
| R3-2 | `scorer_unchanged` was a path-name heuristic: an edited `expected.json`, or `check.py` run through `sh -c`, earned `true` and passed the v3 rule | **C** | reviewer's `loom-adversarial-probes.py` on c38bae2: both accepted; on this branch both refused (v3 acceptance exit 1) | `--scorer` globs declare the oracle closure, hashed at base; undeclared = `unknown`; `--impl` bounds the patch; a declared scorer edit is re-scored with the BASE scorer over the patched tree | `review3_controls` (6 scorer cases) |
| R3 | `my scene.txt` / C-quoted `café.txt` crashed the patch parser (INSTRUMENT_CRASH, no record) | **C** | reviewer probe | paths from `git apply --numstat -z` and `--summary`; an unparseable patch is an `error` record | 2 cases |
| R3-9 | receipt written, then the shared manifest collided: exit 1 with a partial successor | **C** | reviewer's `loom-policy-probe.py` | manifest versioned with its receipt (`receipt-v2.evidence-manifest.json`); both destinations preflighted, both staged, then renamed; failure removes only this run's files | 2 cases |
| R3-10 | a failed optional witness was written into `not_run`, which the schema forbids | **C** | jsonschema 4.26.0 on the generated manifest | manifest `loom.evidence-manifest/2` with a separate `failed` list; generated bytes validated before publishing (jsonschema if present, the same rules by hand if not) | 1 case |
| R3 | receipt named the profile but not its bytes | **C** | reviewer | `profile_sha256` in receipt inputs and manifest | 1 case |

Lesson: "unchanged" can only be claimed about a set someone wrote down. Anything undeclared is unknown, and unknown must not pass.

## Fourth review, 18 Nov 2026 (Loom items)

Instrument for every "now" column: the reviewer's round-4 probe scripts (`policy-probes.py`, `policy-failure-probes.py`, `policy-profile-race-probe.py`, the physics, science and foldback probes) run against this branch on Python 3.13.18, git 2.x, jsonschema 4.26.0, Linux CPU; "old" is main at 3da026a. `kit/tests/test_gates.py` `review4_controls`: 20 new negative controls, 135 caught in all, plain and `-O`.

| # | Finding | Grade (ours) | Old | Now | Fix |
|---|---|---|---|---|---|
| R4-1 | profile read twice: the hash attested was not of the bytes evaluated (race) | **C** | reviewer race probe | receipt hash = evaluated bytes in 3 of 3 swaps | `read_profile` parses and hashes one read |
| R4-2 | a symlinked `--scorer` hid an edit to its target | **C** | unchanged, pass | changed, base oracle fails | inventory records link text and resolved sha256 |
| R4-3 | a renamed scorer data file escaped the base hash | **C** | unchanged | changed | inventory of the tree matched against the globs, before and after the patch |
| R4-4 | an optional pass recorded for another candidate was shown as pass | **C** | `eyes: pass` | `eyes: stale` | `binding_problem` on every visible witness; manifest enum gains `stale` |
| R4-5 | comparator typo `at mots` read as at least | **C** | accepted | `PHYS_SCHEMA` | closed rule set |
| R4-6 | empty or missing controls passed (`all([])`) | **C** | pass | `PHYS_NO_CONTROLS` | at least one control required |
| R4-7 | runs keyed by basename: `a/run.json` overwrote `b/run.json` | **C** | 2 runs read as 1 | `PHYS_WAIVERS_OVER_CAP` 6 of 3 | keyed by relative path; ids distinct (`PHYS_DUPLICATE_RUN`) |
| R4-8 | a PNG of signature + IEND passed "decodable" | **C** | pass | `SCI_PUBLICATION_UNDECODABLE` | stdlib bounded decoder (CRC, IHDR first, IDAT size, filters, IEND last) |
| R4-9 | waiver cap applied per run, profile says total | **C** | 6 waivers under cap 3 | refused | cap counted across runs; unit recorded |
| R4-10 | `--force` receipt inside the evidence folder inventoried itself | **C** | stale on placement | `RECEIPT_INSIDE_EVIDENCE` | destination may not be inside evidence |
| R4 | NaN `declared_limit` skipped the widening check | **C** | accepted | refused | strict JSON + finite check |
| R4 | `--prev` accepted any file | **C** | stored its hash | `PREV_NOT_RECEIPT` / `RECEIPT_SCHEMA` | predecessor must verify |
| R4 | `--force` pair: manifest rename failed after the receipt was replaced | **C** | new receipt, old manifest; then manifest lost | both originals byte-identical, no spare files | originals copied aside, atomic replace, restore only what this run replaced |
| R4 | stdlib schema fallback accepted `profile.name: 42` | **C** | manifest written | `PROFILE_SCHEMA` before acceptance; fallback validator covers every keyword the schema uses | typed profile parse |
| R4 | glob meaning changed between Python 3.12 and 3.13 | **C** | directory-only on 3.12 | one Loom glob language | `glob_re` / `matches` |
| R4 | absent coverage key read as an expected `null` | **C** | pass | `COVERAGE_REQUIRED` | key must be present |
| R4 | cached bytecode let a patched scorer replay | **C** | pass | fail | replay in a fresh clone, base scorer restored, consumer run there |
| R4 | committed-limit metric identity: a limit file number is matched by value, not by which metric it belongs to | **L** | — | documented limit | still open: name metrics in the limits file |

Lesson: every set the Loom vouches for (the profile, the scorer, the runs, the visible witnesses) must be read once, keyed by full identity, and closed; an open set or a second read is where a wrong pass gets in.
