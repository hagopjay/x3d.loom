# Physics study card

Fill this in **before** the first scene. Copy it to `docs/CARD.md` in the project. A field left empty is a decision not yet made; say "none" when the answer is none. The patterns are in [PHYSICS-PLAYBOOK.md](../../PHYSICS-PLAYBOOK.md); the laws are 41 to 43 in LOOM-v1.md.

## 1. Question and audience
- The one sentence a visitor should leave with:
- What the engine is allowed to get wrong (a cartoon may; a measurement may not):
- Content boundaries (what the figures, effects and sounds will not do):

## 2. Engine and hosts
- Engine, version, build (pin it; a replay on another version is `PHYS_ENGINE_DRIFT`):
- Fixed step and how the page paces it (clocks follow physics when it lags):
- Hosts you will claim (browsers with versions, Node), and the machine(s):
- Hosts you will **not** claim (say so; they go in `visible_not_run`):

## 3. Exact references (at least one) — write the limits now
| Reference | Closed form or the scheme's own discrete solution | Where it is computed | Declared limit | Continuum gap, if any |
|---|---|---|---|---|
|  |  |  |  |  |

If the physics has none (a ragdoll, a ride, a machine of 300 bodies), say so here. The record will show self-consistency and stated tolerances only, and the page must not claim more.

## 4. Tolerances and who may waive them
| Measure | Tolerance (declared now) | Owner who may accept an excursion | Profile cap |
|---|---|---|---|
|  |  |  |  |

An excursion beyond a tolerance is a waiver with owner, date, reason and its own numbers (law 43). A self-check that misses its closed form is logged with its probable cause and is not tuned to fit.

## 5. Takeover (if page code replaces a runtime's engine)
- What is replaced, in which hosts it exists (`applies_to`):
- The proof: 0 events in 120 frames; a write while disabled sticks; disabled mid-flight freezes; re-enabled resumes:
- Leaks (steps taken before the switch) and how each is handled:

## 6. What the engine cannot honour
| Authored field | Engine | What happens | In the loss report? |
|---|---|---|---|
|  |  |  |  |

## 7. Determinism
- What the per-step hash covers (every moving body's pose and velocity; anything else the physics depends on):
- Recording host, steps, command batches and teleports in the run:
- Replays: each host, same page or fresh page:
- Across machines: run / not run (then `visible_not_run: cross-machine`):

## 8. Witnesses
| Witness | Limit or contract | Negative control that must fail |
|---|---|---|
| grammar, meaning (every exported scene) |  |  |
| traps, page-traps |  |  |
| physics (`kit/loom physics`, `loom.physics-run/1`) |  |  |
| behaviour (the shipped page at two frame rates) |  |  |

## 9. Derived scores and self-checks
- Any score (a head injury criterion, a heat map, a rating): the quantity it is built from, and a hand-checkable unit test:
- Any self-check with a closed form: expected, measured, the gap and its probable cause:

## 10. Not checked
- Another machine, another engine build, a real GPU, listening, a paired review, feel:
