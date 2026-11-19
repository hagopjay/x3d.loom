# What Gobbler.flyte teaches (18 Nov 2026)

Source: hagopjay/x3d.gobbler, folder `flyte/` (PR #1). Gobbler.flyte is one Gobbler run as a LangGraph 1.2.22 graph with four organs, turning every 30 minutes:

- **Scout** reads the X3D web.
- **Weaver** proposes a loom action and an X3D fragment.
- **Witness** referees the fragment with the x3d.accrete gate 2.0.0 @ 93063bf, x3d_mcp b5c9956 and this repo's `kit/loomkit/traps.py`.
- **Keeper** appends the fragment to an x3d.accrete world.

Questions to the human go through GitHub Issues. A reversible question takes its preferred pick after 4 h; an irreversible one never times out.

Grades: **C** = a named tool ran, **L** = read or reasoned, **S** = suspected. Environment: Linux x86_64, CPython 3.13.18, langgraph 1.2.22, langgraph-checkpoint-sqlite 3.1.3, lxml (as pinned by x3d.accrete), X_ITE 16.6.0 in Chromium 157 headless with SwiftShader. No model call was made: the simulated day prices scripted usage at the Haiku 5.5 list price.

## 1. Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **"x3d" on the open web is mostly not X3D.** In a live snapshot (18 Nov 01:46Z), 6 of 12 HN title hits were AMD Ryzen X3D chips and 11 of 15 arXiv hits were the X3D video-recognition network. web3d.org RSS was 10 of 10 real. | C | `flyte/fixtures/feeds/` + SHA256; `relevance.py` tests on "9800X3D" and "X3D-M backbone" | A watcher classifies namesakes before it scores. Trusted sources short-circuit; untrusted ones prove relevance. |
| 2 | **Accretion finding 1 is still open at 93063bf, and an agent loop pays for it.** The gate admits `PhysicalMaterial`; the pinned validator in accrete's own commit path refuses it (`MCP_SEMANTIC_PROFILE_COMPONENT`). Committing straight after the gate lost 22 of 44 turns in the first simulated day. | C | `tests/test_flyte.py::Referee` | Run the full commit-path validator before the commit, and feed its code back to the generator. See [LEARNINGS-accretion.md](LEARNINGS-accretion.md) row 1. |
| 3 | **Refusal codes are free training signal.** With the code fed back, Weaver's 61 attempts produced 35 admitted turns out of 35. The 26 refusals were GATE_CONTAINMENT 9, MCP_SEMANTIC_PROFILE_COMPONENT 9 and GATE_NODE_FORBIDDEN 8. There were at most 3 attempts per cycle, then the procedural generator took over (9 turns). | C (simulated replies) | `runs/sim-2026-11-18/summary.json` | Cap retries, keep a zero-cost fallback, and log each code. |
| 4 | **Web text is untrusted input to a model.** A public HN item carried private claude.ai artifact links. Scout now withholds such links. Every title reaches the model through `quote_untrusted` (vendored `x3d.s1/x3d_s1/untrusted.py`), and lint flags travel with the signal. | C | leak sweep; `VendoredLoom.test_injection_lint` | Lint and quote before prompting; withhold private-link shapes at ingest, not at publish. |
| 5 | **Interrupt per cycle, not per run.** Each cycle is its own LangGraph thread, so a question waiting 6 h does not stop the clock. Checkpoints grew to 4.1 MB a day until finished threads were deleted and the file was VACUUMed. | C | `runner.py`; sim tape | One thread per decision; prune finished threads; keep text ledgers in git and SQLite in a cache. |
| 6 | **Keep three counters apart.** The counters are admitted (entered the world), drafted (a foldback note was written) and reused (later work used it). The sim shows 35 / 35 / 0. Reuse stays 0 until something proves it. | L | `turns.jsonl` | Never report a flywheel as turning on admit or draft counts alone. |
| 7 | **Spend gates must parse who typed what.** Only an allowance comment from an authorized login counts. "OK $5/day" is refused as implausible, and an allowance text is never read as an answer to a question. | C | `Spend` and `Answers` tests | The human's typed words are the only key; parse narrowly. |

## 2. Reusable pieces (in x3d.gobbler `flyte/`)

* `gobbler_flyte/relevance.py`: the namesake classifier (Ryzen X3D, the X3D video net, variants).
* `gobbler_flyte/hitl.py`: GitHub Issues HITL with a timeout to the preferred pick, a typed "send" for outside steps, and authorized logins only.
* `gobbler_flyte/budget.py`: a worst-case pre-check, then usage recorded after the call.
* `gobbler_flyte/loom/`: hash-pinned copies of `traps.py` (sha 880195a4…01cc) and `untrusted.py` (sha 046d8b79…66f1) from this repo at 4cf5c7a. A test fails if either drifts.

## 3. What this does not prove

* No Haiku call ran. Model quality, real token counts and real spend are **S** until he types an allowance.
* GitHub release atoms (403) and Reddit (404) were unreachable from the build container; those rows are labelled SYNTHETIC.
* Reuse is 0. Nothing here shows that the world or the drafts help later work yet.

## 4. After a second model's review (18 Nov, x3d.gobbler PR #2)

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 8 | **"Confirmed" from structure plus path existence overstated the turn.** The review capped the loop's grade at Likely and split it into facets: candidate structure, source, target presence, admission, human, render and reuse. Re-running the same simulated day gives the same counts; only the labels changed (31 Confirmed became 31 Likely). | C | `flyte/runs/sim-2026-11-18-r2/summary.json` | Name the facet a gate tests. A broad grade never stands in for unrun facets. |
| 9 | **A green receipt from a host that could not launch the browser is `not_run`, not pass.** On a host that could, the observatory passed 15/15. The single-file export failed 2/15: X_ITE fetched its logo (from its SRI-pinned stylesheet) and its PT Sans font (`getFontsURL`) from the page origin. | C | `receipts/review-browser-standalone.json` | Every single-file X_ITE export inlines CSS `url(assets/...)` and fonts too, not only components and wasm. If you change a pinned stylesheet, re-pin its SRI to the bytes you serve. |
| 10 | **A retry is not a return, and that holds in the browser.** The Intervention Lab's 12 rules hold natively. Retrying the same consumption 3 times counts 1, a new input and target counts 2, and an always-accept guard does not qualify. | C | `tools/lab_browser_check.cjs`, `receipts/review-lab-browser.json` | Count distinct (guard, target, input digest) tuples; keep failing controls in every guard test. |
| 11 | **A durable graph checkpoint does not make side effects atomic.** A tick that crashed after the world append re-ran the same cycle. A per-cycle operation key in the world entry, plus one ledger row per cycle, made the retry find its entry instead of admitting twice. | C | `CrashRecovery` tests (fault injected) | Give every side effect an operation key and reconcile with the store before writing. A lock rejects overlapping ticks. |

## 5. Agentic memory (19 Nov, x3d.gobbler PR #3)

He sent an outside "X3D Agentic Flywheels" package (LangGraph, 33 tests, a memory schema with 9 record types) for comment. It was run in an isolated venv and probed before anything was copied.

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 12 | **Exposure labels leak unless they are computed.** In the package, a memory labelled `development` that cites `sealed` evidence reached the model's context with its text, and so did a memory citing evidence the registry did not know. | C (probe) | x3d.gobbler `flyte/tests/test_flyte.py::Memory::test_reference_package_leaks_are_closed` | Effective exposure is the union over the whole lineage and every cited evidence id. Unknown evidence is excluded, never trusted. |
| 13 | **Filter before you rank.** Ranking first lets a strong but ineligible memory push out eligible ones, and the reason it vanished is lost. Gobbler.flyte's Weaver context now filters (revoked lineage, review state, reader, valid time, scope, unknown evidence, held out) and reports each exclusion with its reason, then ranks counterexamples first. | C | `memory.py::compile_context`; sim r3: 45 contexts, 2 held out | Every context compiler returns what it left out and why, and journals a digest of what it sent. |
| 14 | **A sealed hold-out needs an audit with a failing control.** About 1 in 5 Witness refusals is sealed by its bytes, so the generator never sees them. `audit_contamination` re-reads every journaled context; a planted leak makes it fail. | C | sim r3: 0 leaks; `test_audit_catches_a_prompt_built_with_a_sealed_record` | Never report "no contamination" from an audit that has not caught a planted one. |
| 15 | **The inner loop already makes lawful twins.** A refusal followed by an admission in the same cycle is the pair (counterexample, lawful twin) that the package's transport schema has a slot for. Gobbler.flyte exports them as v1 transport records: 44 records, 0 schema errors, ids verify with the package's own builder. | C | `transport.py`, `runs/sim-2026-11-18-r3/memory-transport-validation.json` | Export refusals with the fix that followed; a refusal alone teaches less. |

Not adopted: the package's 17 prompts (other lanes), its mandatory review step (conflicts with the 4 h timeout rule) and its tenancy, Neo4j and LangChain layers (single tenant, no server). Its ranking is lexical only. Honest scale: the simulated day has only 3 distinct counterexamples, because scripted replies repeat.
