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
