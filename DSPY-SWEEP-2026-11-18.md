# DSPy across x3d.io: a ranked sweep (18 Nov 2026)

Written by the DSPy thread at HagopJay's request (18 Nov, 22:57Z): "a decent sweep of the most impactful areas where dspy can help with our prompting, our evaluations, particularly optimizations thereof, and of the overall x3d pipelines in general". It extends the 17 Oct and 27 Oct work (learned writer prompt, repair ladder, picture judge, Shroud seams), which is summarised, not repeated.

**What was read, and what was not.** Read this session: `x3d.loom` kit (`traps.py`, `foldback.py`, profiles, LOOM-v1 roles and DSPy lines), the x3d.ML 17 Oct run (383 call rows, 218 chains, saved bodies and renders), x3d.gobbler Flyte (`llm.py`, `relevance.py`, fixtures, Atlas claims), the heritage-geo, medical and math-ontology LEARNINGS, and the repository layout of x3d.chess, x3d.gamelab and x3d.mathslab. Not read: the code of those three demos beyond a directory listing and a grep for model calls, the Blender scivis package, Giza VI. Anything that depends on them is graded Suspected below.

**Grades.** C = a named tool ran here and showed it. L = read in code or a document. S = reasoned or a hunch. Every number names its instrument.

## 0. Revision (18 Nov, after the external engineering review of PR 130)

An outside review (merge commit 95c7b88) found real defects in the first version of this sweep's pilot. I re-ran its central probes before accepting any of it. **Confirmed (C):** (a) two of the three saved perfect rules overfit: `color-range` checks only `Material` and only the upper bound, `glsl-reserved-active` matches the single literal `uniform float active;`; (b) 63 exact-duplicate scene groups (382 distinct among 445 clean scenes here), 31 of them crossing the show, train and held partitions under the path-hash split; (c) the worker reused one namespace across scenes, so a call-count cheat could score 1.0; (d) the audit's `pass` ignored the oracle and the run did not require a passing audit. The hardened benchmark is in section 3.4; the sections below are corrected where the review showed an overclaim. What I did not accept, and where I disagree, is in section 9.

## 1. Bottom line

1. **The cheapest place to start is the part the Loom already calls the flywheel: failure in, rule out.** (The review is right that this is not shown to be the highest economic return; writer and repair already have a measured gain. Rule synthesis goes first because its judge is deterministic and free, not because it is proven best.) Today an agent writes each trap rule by hand. A DSPy program that turns an incident into a rule, scored two-sided by the Loom's own controls, automates the step the whole design turns on. It needs no new data (10 shipped rules, 451 clean scenes, mutators) and its metric is deterministic and free. The benchmark is built and audited (pilot 1). Grade of "this is the highest-leverage target": S. Grade of "the benchmark is lawful": it was C for the narrow claims in 3.1 and is re-audited in 3.4; the oracle that labels the benchmark also supplied its labels, so it measures reproducing the shipped rule, not discovering a new one.
2. **Optimise the metric before the prompt.** Building pilot 1 found a leak in its own first metric (section 3). A rule that only asked "does the file have a ROUTE?" scored 0.935 on the route rules because the positives came from route-bearing scenes. Unmutated twins and lawful near-misses closed it. Every metric in this project should ship with the same battery.
3. **Most first-answer failures are not a DSPy problem.** (Counts are of printed hints; the replay does not apply them, so "60 can be repaired" is not claimed.) On the saved 17 Oct run, replayed on the current validator, 60 of 136 first failures already carry a validator-printed fix hint, and 83 of 136 die of only five classes. Fix those with code (autofix, the exact report) and spend DSPy on what is left.
4. **Nothing in this sweep needs a paid call to start.** Two pilots ran at $0. The GEPA run HagopJay approved was not started: this session had no Vertex project id, a free-tier run was started and then stopped at his word, and the log shows only an initial validation and a proposed instruction, no learned-versus-seed result. The cost figures in section 5 were means, not ceilings (see 5).

## 2. The ranked sweep

Impact is what changes if it works. Effort is agent days. "Metric" says whether a program or a person decides. Cost bounds use the 17 Oct ledger means per call (scene-sized outputs, so an upper bound for shorter outputs): gemini-3.8-flash $0.0174, gpt-6.1-sol $0.0218, gemini-3.1-pro-preview $0.0705 (instrument: `runs/live-2026-10-17/events.jsonl`, 383 rows).

| # | Area | Impact | Effort | Data in hand | Metric (who decides) | Pilot | State |
|---|---|---|---|---|---|---|---|
| 1 | **Rule synthesis (flywheel step 4)**: incident to a trap rule or two-sided test | Highest. Turns the Loom's core loop from hand work to proposed-and-witnessed | M | 10 shipped rules, 4 more not yet covered, 451 clean scenes, 10 mutators plus near-miss mutators | Deterministic: recall x clean specificity x twin specificity; a human still merges | `kit/dspy_pilots/trap_synth/` | Built, audited; free-tier seed baseline mean 0.494, 3 of 10 perfect (section 3.3) |
| 2 | **Evaluate the evaluators**: degenerate battery, twin negatives, held-out by base, validator pin on every metric | High. Every other row is only as good as its metric | S | Picture-judge audit (17 Oct), trap metric, `scene_metric.py` | Deterministic | Battery inside pilot 1 (`test_dspy_trap_synth.py`) | Built for the trap metric; not yet applied to the picture judge or Loom witness metrics |
| 3 | **Writer prompt for X3D**, metric = delivered (valid + placed + types + draws) | High, already measured: 34.4 to 63.9% first-try (Full barred), 74.3% (Full open), transferred to stronger models (d5598c4) | S | 61 prompts, 17 Oct run, cached answers | Deterministic validator + X_ITE render; judge only screens | `x3d.onto` branch `claude/dspy-agent-wvxa5n`, `dspy/run_onto_gepa.py` (27 Oct A/B) | Done once; refresh on the new fork and a delivered metric |
| 4 | **Ontology mapping with verifier-graded claims** (FMA, CIDOC, OntoMathPro, OpenMath, PhySH, IFC) | High and new: three ontology demos in 3 days did the mapping by hand | M | 120 FMA attempts, 18 lessons x 4 ontologies, 202 cached fetches, SHACL tools | Existence is Confirmed by a fetch; meaning stays Suspected and is never auto-graded | Design only (section 4.3) | Not built |
| 5 | **Gobbler**: relevance rules and claim extraction | Medium. Learns rules from the flywheel's own feeds | M | Atlas claims (1,360 rows with quote + value), 7 feed fixtures | Quote-contains-value is deterministic; namesake labels need a human sample | Design only | Not built |
| 6 | **Repair ladder per model family** | Medium. Already 83.7 to 86.9% on a test half; a model-written ladder did not carry across families | M | 383 call rows, fix hints in 60 rows | Deterministic | Pilot 2 gives the failure classes | Partly measured |
| 7 | **Chess Analyst commentary** (Demo 43) | Medium. A new surface, not a rewrite: the desk is engine-driven today | M | Engine lines from Stockfish; no commentary corpus yet | Deterministic claim check: every move, eval and plan the text names must match the engine PV | Design only | Suspected (code not read) |
| 8 | **Procedural levels and NPC lines** (gamelab, KANSEI roam) | Medium. Solvable-by-agent is a free metric | L | Level recipes in `src/recipes.js`, `level.js`; runs/ | Deterministic: X3D validates, a scripted agent can finish, no stuck state | Design only | Suspected |
| 9 | **STEM and Math Lab authoring** (lesson cards, scene profiles) | Medium. 18 lessons exist as code with witnesses | M | `mathlab/lessons_*.py`, 8 `x3d-stem-*` profiles, `sci.py` witnesses | Deterministic witnesses; the teaching quality is a person's | Design only | Suspected |
| 10 | **Loom technique application**: choose a profile and witnesses for a new project | Medium-low. Classification, small | S | 18 profiles in `kit/profiles/`, LOOM-v1 laws | Deterministic once a profile is chosen: does `accept` pass | Design only | Not built |
| 11 | **Provenance of tuned prompts**: sign what was optimised, with run id, validator commit, prompt revision, scene hash | Enabling. Tuned prompts are unsigned anywhere today | S | x3dprov in x3d.ML, 22-field ledger row (27 Oct) | n/a | Not a DSPy run | Proposed 27 Oct |
| 12 | **Blenderizer scripts** (Blender Python that must export valid X3D) | Medium, expensive to test | L | 194-case export suite | Deterministic export validation, but needs Blender in the loop | Design only | Not built |

## 3. What the pilots found

### 3.1 Pilot 1: trap-rule synthesis, a benchmark that had to be repaired

`kit/dspy_pilots/trap_synth/`. The task: given an incident (the rule's own `origin` text), the runtime, and two XML excerpts of the fault, write `def trap(root)`. Scoring runs the candidate in a child process (AST screen, CPU and memory limit) on held-out scenes.

- **Cases:** 10 of the 15 shipped rules (`loomkit.traps.RULES`). Four are not covered, each for a stated reason (`color-keys-sparse`, the two X_ITE light and shadow rules, `no-script-under-host`). `loop-seam` has real hits but too few for a train and held-out split. Instrument: `bench.build()` over 451 clean scenes from the x3d.loom and x3d_mcp checkouts.
- **Positives** are mutants of clean scenes (the mutator is the negative control, as in the Loom's two-sided tests) plus natural hits. **Negatives** are clean scenes, the unmutated twin of every mutant, and a near-miss of every mutant (the same edit done lawfully: a ROUTE to a DEF that exists, a colour in range, a `containerField` set, a `data:` prefix). Bases are split by path hash into show, train and held-out, so a proposer is scored on scenes it never saw.
- **Oracle:** `loomkit.traps` itself scores 1.0 on held-out for all 10 rules (C, `run_pilot.py audit`).
- **Degenerate battery** (six rules: always-true, always-false, has-ROUTE, has-Material, big-scene, has-Metadata): worst score 0.432, all below 0.5 (C, `kit/tests/test_dspy_trap_synth.py`, 6 tests pass).
- **The leak the audit found (C).** The first metric used clean scenes only as negatives. On `route-undefined` and `route-before-def`, the rule "the file has a ROUTE" scored **0.935** because positives came from route-bearing scenes and most clean scenes have none. Adding the unmutated twins dropped it to 0.0. The same pattern appeared for `has-Metadata` on the containerField rule (0.864 with twins, 0.432 once near-misses were added). The metric would have rewarded a keyword spotter and an optimiser would have found it. This is Loom failure-mode material: the instrument is tested too.

### 3.2 Pilot 2: the 17 Oct run replayed, no model call

`kit/dspy_pilots/chain_replay/replay_17oct.py`. Instrument: x3d_mcp fork checkout `39c6e94` (`validate_xml`, XSD, and `validate_semantic`, error count) over the 383 saved bodies; renders from the saved X_ITE 16.5.0 `nonblank` field (above 0.001 counts as drawing). Everything below is C for this sample.

| Fact | Value |
|---|---|
| Call rows, chains, first attempts | 383, 218, 218 |
| First-try valid | 82 of 218 = 37.6% (gpt-6.1-sol 76.7%, gemini-3.1-pro 54.0%, glm-5.3 25.0%, gemini-3.8-flash 20.0%, nemotron-3-super 9.3%) |
| Final valid | 178 of 218 = 81.7% |
| First failures | 136; 79 die of a single error class |
| Top classes | profile-component 60, xml-parse 35, `Material.roughness` 30, `PhysicalMaterial.diffuseColor` 11, `PhysicalMaterial.metalness` 10 |
| First failures made only of the top five classes | 83 of 136 (61%) |
| First failures with a validator-printed fix hint | 60 of 136; 20 of them have only the profile-component class |
| Validator drift since the recorded run (fork eb4b4b4 then, 39c6e94 now) | 1 of 383 verdicts changed (valid to invalid) |
| Final-valid scenes that draw nothing | 3 by this replay's threshold; the x3d.ML README says 7. Different instruments, not reconciled (S) |

Reading: the biggest first-answer killers are knowledge the prompt can carry (PBR attributes on the wrong node, the profile component list) or code can fix (60 of 136 have the fix printed). That is the case for autofix first and DSPy second, and it matches the Firehose 4 result (showing the exact report lifts repairs to 98 to 100%; autofix first lifted two Nemotron lanes 42 to 64% and 76 to 81%, fork 8dd0d3e).

### 3.3 Seed baseline on a free-tier model

One call per rule, no optimiser, `nvidia/nemotron-3.5-lightning-30b-a3b` on the free NVIDIA endpoint (a reasoning model; `max_tokens` 6000; 10 calls, about 6 minutes, 0 USD billed; per-call tokens and seconds in `out/calls.jsonl`). Scored on held-out scenes with the audited metric (C, `seed_baseline.py`).

| Held-out score | Rules |
|---|---|
| 1.0 (3 of 10) | `color-range`, `glsl-reserved-active`, `route-undefined` |
| 0.937 | `color-emissive-white` (3.6% false alarms on clean scenes and twins) |
| 0.5 (2) | `movie-not-still`, `version-fits-nodes`: caught every positive but fired on half the lawful near-misses (a `.mp4` movie, a 4.1 file), which is the keyword mistake the twin term exists to catch |
| 0.0 (4) | `splat-bbox` (rule never fired on the positives), `metadata-containerfield` (syntax error), `route-before-def` and `shader-raw-source` (empty reply: reasoning used all 6000 tokens) |

**Mean held-out score 0.494; 3 of 10 perfect.** Two of the four zeros are a token budget, not a capability, so treat the mean as a floor for this model (S). The useful reading is that the benchmark separates: it passes three rules outright, and its twin term fires exactly on the two keyword-style answers. That is headroom for GEPA with feedback naming the false alarms. It is one sample per rule on one small model; it is not an estimate of what GEPA or a stronger writer would score. **Correction (review, reproduced in 3.4):** two of the three perfect scores were overfit to the benchmark. On the hardened held-out set `color-range` falls from 1.0 to 0.179 and `glsl-reserved-active` from 1.0 to 0.0. Only `route-undefined` stays at 1.0; the honest baseline is 1 perfect rule of 10.

### 3.4 Hardened benchmark (v2), after the review

Changes in `bench.py`, `_worker.py`, `run_pilot.py`, `program.py`. Every number is C, `run_pilot.py audit` and `kit/tests/test_dspy_trap_synth.py` (9 tests pass), on 445 clean scenes (382 distinct) from the x3d.loom and x3d_mcp checkouts.

| Review finding | Change | Result |
|---|---|---|
| Identical scene bytes cross partitions (31 of 63 duplicate groups) | One row per distinct content; partition key is the content hash, not the path | 0 content leaks across show, train and held |
| Held-out backgrounds are not held-out defect variants | Each rule has a dev mutator and 1 to 4 sealed variants that only held-out sees (negative channel, `PhysicalMaterial.baseColor`, comma format, `uniform vec3 active;`, doubled whitespace, other node families, `.jpg`, other 4.1-only nodes); every variant has its lawful near-miss | Saved `color-range` 1.0 to 0.179, `glsl-reserved-active` 1.0 to 0.0, `movie-not-still` 0.5 to 0.495, `version-fits-nodes` 0.5, `splat-bbox` 0.0, `route-undefined` 1.0 |
| Candidate state carries across scenes (call-count cheat) | Fresh namespace per scene; each evaluation shuffled under two seeds and the worse seed scored | Call-count cheat now scores like always-true (0.0) |
| Degenerate battery too small | Added a call-count cheat and a mutation-fingerprint rule built from what the dev mutator planted | Worst of 8 degenerates 0.206 (was 0.432 of 6) |
| Audit `pass` ignored the oracle; run did not require the audit; oracle skipped twins | `pass` needs oracle = 1.0 on positives, clean scenes and twins, worst degenerate below 0.5, 0 content leaks, a sealed variant per rule; `run` refuses unless the audit passes | Audit passes; run refuses to spend otherwise |
| Reflection feedback named files, not causes | Feedback carries the offending XML of the first misses and the score split (recall, clean, twin) | Not yet exercised on a model |
| Twins and near-misses scored together | Scored separately, the worse counts | Fingerprint rule on `splat-bbox` falls from 0.5 to 0.141 |

Limits that remain (S): the sealed variants were written by the same author as the dev ones, so they test breadth, not independence; real independence needs natural incidents that arrive after a prompt is frozen, or the fork's separately written negative controls. The held-out sets are small for the route rules (14 and 17 positives; zero misses in 14 leaves a one-sided 95% upper miss bound near 19%). The clean pool contains no scene with other defects, so "does this rule apply to an imperfect project" is untested.

## 4. Area notes

### 4.1 Prompting and evaluation (rows 2, 3, 6)

- Keep the lawful-metric rule from LOOM-v1: the validator is the score, its report is the GEPA feedback, `profile="Full"` stays barred. Add **delivered** to the metric (valid, placed, type-clean, draws): compact JSON encodings raised first-try valid 21.3 to 35.7% but delivered 17.6 vs 17.2% (cf84f64).
- Every metric ships the battery in 3.1: oracle = 1, degenerates below 0.5, twin and near-miss negatives, held-out split by base, validator commit named. Apply it next to the picture judge (one of three judges passed the real-photo control; 35% of order swaps flipped) and to the fidelity-gate witness metrics in `kit/profiles/`.
- Select on held-out. The Shroud EVAL_PLAN found 14 of 16 mechanism families reach 0.98+ on TRAIN by random search; a train score proves nothing.
- Use `dspy.Refine` or `BestOfN` with the validator as reward for inference-time search before reaching for optimisation: it costs calls per answer but needs no dataset.

### 4.2 The Loom (rows 1, 10, 11)

- The fold-back witness checks a patch applies and its controls hold. It does not write the patch. Row 1 is the writer for the trap-rule half of a patch; the witness stays the judge.
- Candidate rules start at grade S, as every model output does in LOOM-v1. A proposed rule becomes C only after the two-sided run, and a person merges it.
- Profile selection (row 10) is a small classifier over 18 profiles; it earns its place only after row 1.
- Row 11 is the part DSPy cannot do for itself: nothing records which prompt revision, validator commit and scene hash produced a number. The 27 Oct 22-field ledger row covers it.

### 4.3 Ontology (row 4)

The recent mapping work is shaped like a DSPy task with a free verifier on one half. LEARNINGS-medical-provenance MP-1 separates **existence** (an exact-label hit in FMA, 120 of 120, Confirmed) from **meaning** (does the mesh denote that class: L for 103, S for 18). Design: a `Signature(label, context) -> class_id, evidence` module, a metric that is 1 only when the id exists in the cached fetch and the Uberon or Wikidata cross-check agrees (82 of 82 agreed in MP-3), and **no metric for meaning**: that stays graded by a person. Held-out unit: a whole lesson or organ system, never a random row. The first target should be the 9 Math Lab lessons with no OpenMath link (MO-6), where the answer may be "none", so the metric must reward a refusal. Data are cached; the first run can be replayed offline.

### 4.4 Gobbler (row 5)

`relevance.py` is a hand-written regex classifier whose lesson came from one 18 Nov snapshot. It is the opposite of a DSPy-shaped problem right now (small, precise, explainable), so leave it alone until labelled misses exist. The better target is claim extraction: the Atlas holds 1,360 rows of (value, quote, source line). A module that copies a number and its quote from a source line is checked by "does the quote contain the value on that line", the same relation the claims file records in its `quote` and `value` fields (I did not read `check_atlas.py`, so whether it enforces exactly this is L at best). Haiku runs only on his typed OK (standing rule); a free-tier writer is enough for a pilot.

### 4.5 Gameplay, STEM and Math Lab (rows 7 to 9) — Suspected

I read layouts, not code. The shared pattern is the useful part: each already has a deterministic judge, so DSPy would add a **writer** the judge can grade.

- **Chess Analyst:** commentary whose every named move, evaluation and plan must match the Stockfish principal variation. Metric: a parser extracts the claims and the engine checks them. The failure to design against is fluent text that agrees with nothing; score the grounded fraction, and a refusal to comment beats a wrong comment.
- **Levels and NPCs:** metric: the scene validates, a scripted agent reaches the goal, no stuck state in N steps. The same check can seed GEPA feedback ("unreachable platform 4").
- **STEM and Math Lab:** lesson cards written against the existing witnesses (`sci.py`) and the 8 `x3d-stem-*` profiles. The deterministic judge says the card is lawful; whether it teaches is the human's.

## 5. Spend: nothing real yet, with the cost of each next step

No paid call has been made. The only model calls this session went to a free-tier endpoint and are listed with tokens and seconds in `kit/dspy_pilots/trap_synth/out/calls.jsonl`.

| Next run | Calls | Cost bound | Notes |
|---|---|---|---|
| Rule-synthesis GEPA, 5 train rules, 24 metric calls each, held-out on the other 5 | about 144 | an estimate of about $0.6 to $2.50 on gemini-3.8-flash (144 x the $0.0174 mean call). **Not a ceiling:** a mean is not an upper bound, the runner allows retries and a configurable reflection model, and `max_metric_calls` counts evaluations, not all billed calls | He approved this run (18 Nov); it was not started (no project id in the session). A real ceiling needs an atomic spend reservation before each request, bounded tokens, retry and in-flight accounting, and reconciliation to actual usage. Or free-tier nemotron-3.5-lightning, $0, about 12 to 20 s per call, 45 to 60 minutes serial |
| Writer prompt refresh on the delivered metric (17 Oct recipe) | about 240 writer + 240 eval | the 17 Oct run cost $4.83 in all; do not repeat it without a yes | Not recommended until row 1 is judged |
| Ontology mapping, replayed from cached fetches | about 200 | $0 on the free tier, about $3 on flash | After a yes |

## 6. Lessons to fold into the Loom

| ID | Lesson | Evidence | Grade |
|---|---|---|---|
| DS-1 | **A metric is lawful only after it beats its own degenerates.** Ship the battery with every optimiser metric: always-true, always-false and three cheap keyword rules must all score below 0.5. | `test_dspy_trap_synth.py`, 6 tests, worst degenerate 0.432 | C |
| DS-2 | **Negatives must be twins, not strangers.** Positives made by mutation share structure the clean pool lacks. Add the unmutated twin and a lawful near-miss of every positive. | has-ROUTE 0.935 to 0.0 on the route rules | C |
| DS-3 | **Split by base scene, not by row.** Mutants of one scene are the same scene; the held-out group must be bases the proposer never saw. | `bench.group()`, path-hash split | C |
| DS-4 | **A model-written rule is code and runs in a sandbox.** AST screen, no imports, CPU and memory limit, child process. It is a guard against runaway code, not a security boundary. | `sandbox.py`, loop test | C |
| DS-5 | **Count what the prompt can carry before optimising it.** 60 of 136 first failures had a fix hint printed; 83 of 136 had only five classes. Autofix and the exact report first, DSPy on the rest. | `replay_17oct.json` on fork 39c6e94 | C |
| DS-6 | **The saved run is a free dataset and a free drift check.** 1 of 383 verdicts changed after a month of fork commits; replaying saved bodies on every validator bump is cheap. | `replay_17oct.py` | C |
| DS-8 | **Held-out backgrounds are not held-out defects.** Give each rule dev mutators and sealed variants (other fields, boundaries, formats, node families) with lawful twins; two of three "perfect" saved rules fell to 0.179 and 0.0. | 3.4 | C |
| DS-9 | **Partition by content hash.** 31 of 63 duplicate-content groups crossed the path-hash split. | 3.4 | C |
| DS-10 | **Candidate code must be stateless per scene, and the audit must gate the run.** A reused namespace lets a call counter score 1.0; an audit whose pass field skips the oracle gates nothing. | 3.4, `run_pilot.py` | C |
| DS-11 | **An oracle that labels the benchmark cannot validate it.** A perfect oracle score shows consistency with the shipped rule, not that the rule is right or that runtime behaviour matches. | review | L |
| DS-7 | **For ontology mapping, grade existence by tool and meaning by person.** A metric for meaning would train a model to sound sure. | MP-1, MP-3 | L |

## 7. Order of work and decisions

1. Hardened metric and audit gate: done (3.4). Remaining: freeze the corpus manifest and record validator commit, dependency versions and model ids with every run.
2. Writer, autofix and report ablation at equal budget (section 9, table A to D). Needs a task-fulfilment metric, not only draws.
3. Rule synthesis as two separate experiments (reusable synthesiser vs one detector), with a real spend reservation before any paid run.
4. Gobbler relation-aware extraction on new layouts; ontology ranking with abstention.
5. Typed chess and STEM explanations; gameplay only after a human challenge assessment exists.
6. Read the chess, gamelab and mathslab code (the review read chess `branches.js`, `sci.py` and `play.py`; I had not).

Decisions for HagopJay, one word each:

| Question | Pick |
|---|---|
| Run the rule-synthesis GEPA on gemini-3.8-flash (answered 18 Nov: yes, then "skip the runs for now"; not started) | wait |
| Should rule synthesis cover the four rules that need new mutators (light fade, transparent shadow, night-sky keys, host scripts)? | **yes** / later |
| Sign tuned prompts in x3dprov before the next optimisation run? | **yes** / later |
| Next area after rule synthesis? | **ontology** / chess / gamelab |

## 9. What I took from the review, what I would change, and where I disagree

**Accepted and acted on (C unless noted).** The four defects in section 0; the audit gate; sealed variants; content-hash split; fresh state per scene; the review's wording fixes (means are not ceilings; the replay counts hints, it does not apply them; the GEPA log is not a result).

**Accepted, not yet built (S).**

| Idea from the review | Why it matters here | Next step |
|---|---|---|
| Three learning problems: reusable synthesiser, one detector, new invariant. Ten rules are about ten concepts, not 451 lessons | The scene corpus measures detectors; it is not a corpus of synthesis tasks | Report two result tables; leave-family-out only as exploratory, then confirm on incidents collected after the prompt is frozen |
| Counterexample loop with minimised failing XML, target node, expected and actual verdict | Feedback now carries the offending XML; it is not minimised and has no locator | Add a delta-debugging minimiser over the XML and a node locator to the rule's contract |
| Evidence package: applicability, locator, explanation, minimal pass and fail pair, conditional fix | A Boolean scene result cannot show the rule found the right node or a safe repair | Extend the `Signature` outputs and score the locator |
| Writer ablation: A fixed writer plus exact report; B plus autofix; C optimised writer plus B; D plus learned repair routing, at equal budget | Isolates what optimisation adds beyond code repair; the 60-of-136 hint count says B may take most of it | Design with a task-fulfilment checker per prompt (for gears: right objects, ratios, direction, frames that change) |
| Compare against MIPROv2 at equal charged budget; promote on severity-specific false positives and recall per variant, not a mean | A mean can hide one severe failure | Add both to the run plan |
| Gobbler: score relations (subject, predicate, value, unit, scope, polarity), penalise omission, include empty documents | A value inside a real quote can still be attached to the wrong subject | Build a small relation-labelled set from the 24 pinned sources; keep the Atlas copy checks as gates |
| Ontology: retrieve a finite candidate set, rank or abstain; report risk against coverage | An existing id can be the wrong class | Replace my "reward refusal" with a risk-coverage curve |
| Chess and STEM: typed claim records first, fixed wording for critical numbers (a lower-bound score is not a forced win; a small residual is not proof) | Fluent text can overstate the evidence | Typed evidence records before any generator |
| Native-X3D Evidence Observatory for the optimisation (original, mutant, lawful-twin triptych, node highlights, candidate lineage) | Would make the learning inspectable and fits the Gobbler Evidence Loom | Proposal only; not built or benchmarked |

**Where I would qualify the review (S).**
1. *Economic ranking.* Agreed that rule synthesis is not shown to be the top return, and I changed the wording. I still start there because a free deterministic judge makes the first mistakes cheap, while writer and repair gains need paid calls to confirm. If HagopJay prefers the review's order, the writer ablation goes first.
2. *Sealed variants are my own.* The review asks for independently authored variants. Mine broaden the test but share an author with the dev mutators; the real fix is natural incidents and the fork's separate negative controls, and I say so in 3.4.
3. *The oracle's circularity* also applies to this doc's own use of "Confirmed": a C here means a named tool agreed with another named tool, not that the world agrees. Both the review and DS-11 now say so.
4. *Corpus counts differ* between the review (418 files, x3d_mcp checkout absent) and mine (445 clean, 382 distinct). The duplicate structure reproduced exactly (63 groups, 31 crossing); the totals are not expected to match.

## 8. Files

| Path | What |
|---|---|
| `kit/dspy_pilots/trap_synth/bench.py` | Cases, mutators, near-misses, degenerates, scoring |
| `kit/dspy_pilots/trap_synth/sandbox.py`, `_worker.py` | Screened child-process runner |
| `kit/dspy_pilots/trap_synth/program.py` | DSPy signature, GEPA metric with feedback |
| `kit/dspy_pilots/trap_synth/run_pilot.py` | `audit`, `plan`, `run` (refuses without `--ok-spend`) |
| `kit/dspy_pilots/trap_synth/seed_baseline.py` | One call per rule, no optimiser |
| `kit/dspy_pilots/chain_replay/replay_17oct.py` and `.json` | Pilot 2 and its output |
| `kit/tests/test_dspy_trap_synth.py` | The metric audit |
