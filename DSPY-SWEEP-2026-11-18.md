# DSPy across x3d.io: a ranked sweep (18 Nov 2026)

Written by the DSPy thread at HagopJay's request (18 Nov, 22:57Z): "a decent sweep of the most impactful areas where dspy can help with our prompting, our evaluations, particularly optimizations thereof, and of the overall x3d pipelines in general". It extends the 17 Oct and 27 Oct work (learned writer prompt, repair ladder, picture judge, Shroud seams), which is summarised, not repeated.

**What was read, and what was not.** Read this session: `x3d.loom` kit (`traps.py`, `foldback.py`, profiles, LOOM-v1 roles and DSPy lines), the x3d.ML 17 Oct run (383 call rows, 218 chains, saved bodies and renders), x3d.gobbler Flyte (`llm.py`, `relevance.py`, fixtures, Atlas claims), the heritage-geo, medical and math-ontology LEARNINGS, and the repository layout of x3d.chess, x3d.gamelab and x3d.mathslab. Not read: the code of those three demos beyond a directory listing and a grep for model calls, the Blender scivis package, Giza VI. Anything that depends on them is graded Suspected below.

**Grades.** C = a named tool ran here and showed it. L = read in code or a document. S = reasoned or a hunch. Every number names its instrument.

## 1. Bottom line

1. **The best use of DSPy in this project is the part the Loom already calls the flywheel: failure in, rule out.** Today an agent writes each trap rule by hand. A DSPy program that turns an incident into a rule, scored two-sided by the Loom's own controls, automates the step the whole design turns on. It needs no new data (10 shipped rules, 451 clean scenes, mutators) and its metric is deterministic and free. The benchmark is built and audited (pilot 1). Grade of the claim "this is the highest-leverage target": S. Grade of "the benchmark is lawful": C.
2. **Optimise the metric before the prompt.** Building pilot 1 found a leak in its own first metric (section 3). A rule that only asked "does the file have a ROUTE?" scored 0.935 on the route rules because the positives came from route-bearing scenes. Unmutated twins and lawful near-misses closed it. Every metric in this project should ship with the same battery.
3. **Most first-answer failures are not a DSPy problem.** On the saved 17 Oct run, replayed on the current validator, 60 of 136 first failures already carry a validator-printed fix hint, and 83 of 136 die of only five classes. Fix those with code (autofix, the exact report) and spend DSPy on what is left.
4. **Nothing in this sweep needs a paid call to start.** Two pilots ran at $0. Real optimisation runs are listed with a cost bound in section 5 and wait for a typed yes.

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

**Mean held-out score 0.494; 3 of 10 perfect.** Two of the four zeros are a token budget, not a capability, so treat the mean as a floor for this model (S). The useful reading is that the benchmark separates: it passes three rules outright, and its twin term fires exactly on the two keyword-style answers. That is headroom for GEPA with feedback naming the false alarms. It is one sample per rule on one small model; it is not an estimate of what GEPA or a stronger writer would score.

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
| Rule-synthesis GEPA, 5 train rules, 24 metric calls each, held-out on the other 5 | about 144 | **at most $2.50** on gemini-3.8-flash writer and reflection (144 x $0.0174); expect about $0.6 because rule outputs are shorter than scenes | Needs his typed yes. Or free-tier nemotron-3.5-lightning, $0, about 12 to 20 s per call, 45 to 60 minutes serial |
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
| DS-7 | **For ontology mapping, grade existence by tool and meaning by person.** A metric for meaning would train a model to sound sure. | MP-1, MP-3 | L |

## 7. Order of work and decisions

1. Seed baseline on the free tier: done (section 3.3). Next, rerun the two empty replies with a larger token budget.
2. Row 1 GEPA run on gemini-3.8-flash, about $0.6 expected and $2.50 at most, only on his typed yes.
3. Apply the battery to the picture judge and the Loom fidelity metrics (row 2), $0.
4. Replay-first ontology pilot (row 4) from the cached fetches.
5. Read the chess, gamelab and mathslab code before building anything for rows 7 to 9.

Decisions for HagopJay, one word each:

| Question | Pick |
|---|---|
| Run the rule-synthesis GEPA on gemini-3.8-flash (at most $2.50, expect $0.6)? | **yes** / free-tier only / no |
| Should rule synthesis cover the four rules that need new mutators (light fade, transparent shadow, night-sky keys, host scripts)? | **yes** / later |
| Sign tuned prompts in x3dprov before the next optimisation run? | **yes** / later |
| Next area after rule synthesis? | **ontology** / chess / gamelab |

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
