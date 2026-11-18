# Writer ablation (arms A to D): design, and the free part already measured

Chosen by HagopJay on 18 Nov 2026 ("writer ablation it is"). Question: how much of the first-answer gain is code (the exact report and a deterministic repair ladder) and how much is an optimised prompt? Metric: **delivered** = valid on the current fork AND the prompt's structural constraints hold (`fulfil.py`); not valid alone.

| Arm | Intervention | Isolates | State |
|---|---|---|---|
| A | Fixed writer, exact validator report on repair | Baseline with good diagnostics | Recorded (17 Oct run, 218 chains, 5 models) |
| B | A plus the deterministic ladder before any model repair | Value of code repair | **Measured offline below** |
| C | Optimised writer prompt plus the same ladder and report | Added value of optimisation | Needs a model; cost below |
| D | C plus a learned repair router | Added value of a policy | Not defined yet: the offline replay says "ladder first when a rung applies" is already arm B; D must route something B does not |

## Result, arms A and B, $0, no model call (C for this sample)

Instrument: `ablation_offline.py` on the saved 17 Oct run (x3d.ML `runs/live-2026-10-17`, 218 first answers), current fork `39c6e94` (`validate_xml` + `validate_semantic`), ladder in `ladder/` (rungs names, pbr, syntax, container, component; **prune rung off**; each rung kept only if the validator's error count does not rise), structural constraints from `prompts_live.jsonl`.

| Model | A first-try delivered | B (ladder first) delivered | Made valid by the ladder |
|---|---|---|---|
| gpt-6.1-sol | 76.7% | 97.7% | 9 |
| gemini-3.1-pro-preview | 54.0% | 70.0% | 8 |
| gemini-3.8-flash | 20.0% | 68.0% | 25 |
| glm-5.3 | 25.0% | 25.0% | 0 |
| nemotron-3-super | 9.3% | 14.0% | 2 |
| **All 218** | **82 (37.6%)** | **125 (57.3%)** | **44** |

- Rungs used: component 57, pbr 33, container 4, names 2.
- **Intent damage:** 0 scenes shrank by more than 10% in node count after the ladder. One scene became valid but misses a required node (`obj-03` lacks a Cone); the original never had it, so this is a writer miss that validity hides, not damage by the ladder.
- **Model repair calls the ladder makes unnecessary:** 44 of the recorded repair calls (one per ladder-fixed chain).
- On gemini-3.8-flash the ladder alone takes first-try delivery from 20% to 68%, close to what the 27 Oct learned prompt reached (73.0% valid on a different 61-prompt set, fork 2b696f5). That is the point of the ablation: **an optimised prompt must be judged against B, not A.**

**Limits (S).** (1) The ladder rungs were designed from failures of this model family on these and related prompts (ladder v1 to v4, 17 to 27 Oct), so B here is in-sample and optimistic; the out-of-sample ladder gain recorded earlier was smaller (test half 83.7% to 86.9% after model repair). (2) B's repair of an unfixed scene is not simulated: the saved model repairs saw the original text, not the laddered text. (3) The constraint checker agrees with the recorded `constraints_ok` on all 82 valid first answers, but those are all positives; it has no negative calibration yet. (4) Structural constraints only: no dimensions, ratios, direction or camera check. A valid unrelated cube still draws; a gear request needs a per-prompt behavioural check (ratio, direction, frames that change), not yet written. (5) 50 prompts per model is a small sample.

## Arms C and D: not run

Needs a writer endpoint. This session has no Vertex project id, so the gemini-3.8-flash route is closed here; the free NVIDIA models are weak writers (first-try 9% to 25% in the saved run) and not comparable with flash.

Estimate for a fresh C versus B pair on gemini-3.8-flash, 50 prompts, one repeat, from the saved flash chains (1.05 repair calls per failing chain; mean $0.0174 per call in the 17 Oct ledger): B about 67 calls, C about 55 to 64 calls with the learned prompt (27 Oct, x3d.onto `claude/dspy-agent-wvxa5n`, `out/dspy/new_prompt.json`), so **about $1.0 to $1.2 per repeat by mean cost**; three repeats about $3.5. These are means, not ceilings: the run needs a ledger with an atomic reservation before each call and a hard stop before it starts. Paired comparison by prompt (McNemar), with delivered per dollar, p95 latency and failure categories reported; 50 paired prompts detect only large differences.
