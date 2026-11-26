# Agent 3: animation and event-wiring rules, corpus survey

Corpus: 2,589 distinct scenes (survey.py's dedupe; 2 more than its 2,587); 763 contain an interpolator, 821 a TimeSensor. All counts [C] from my runs (candidates.py, run.py, flagged.json, details.json in my folder). "Read" = I opened the flagged lines in the file. Judgements are [L] (my reading) unless stated; sample sizes are small and partly share one generator.

## Already in x3d_mcp (not duplicated) [C: grep of check names]
key order (`interpolator-key-order`), key count x width vs keyValue (`interpolator-key-length`), constant interpolator (`interpolator-constant`), keys outside 0..1 (`interpolator-key-unreachable`), cycleInterval <= 0. PositionInterpolator all-identical is `interpolator-constant`.

## Ranked table
| Rank | Candidate | Flagged / relevant | True / deliberate / false (read) | In x3d_mcp | Level |
|---|---|---|---|---|---|
| 1 | Loop spin that does not close: looping OrientationInterpolator, all keys on one axis, last angle differs from first mod 2pi, span >= 0.5 rad | 21 / 763 (demo 14, ml 5, loom 1, blender-io 1) | 4 true, 3 deliberate (baked limb poses), 0 false in 7 read | no | warning |
| 2 | TimeSensor that never starts: loop false, startTime <= 0, enabled, nothing routed into it, no Script/Proto | 17 / 821 (ml 12, demo 3 incl. giza versions, castle 1) | 5 true (anim-03 DoorTimer, model output), 3 deliberate (page JS starts it, test harness), 0 false in 8 read; the other 9 mostly the same anim-03 pattern or harness probes [L] | no | warning |
| 3 | Dangling interpolator: value_changed routed nowhere (33), set_fraction fed by nothing (8), anonymous (3) | 44 / 763 | 4 true (LLM wrote fromField 'value'/toField 'fraction', toField 'set_fraction' fed by TouchSensor position), 2 deliberate (JS-driven Dolly, Glow), 0 false in 6 read | no (route-field-name check may overlap, unverified) | warning |
| 4 | Loop jump, any type (last value != first, loop true; rotations compared mod 2pi) | 120 / 763 (demo 78, loom 17, ml 17, blender-io 6, gobbler 2) | 3 true, 5 deliberate (baked physics/timeline sweeps, spacetime SWEEP), 0 false in 8 read; too noisy | no | info only; rank 1 is its tight form |
| 5 | Dead time: driven interpolator whose keys stop short of 1 or start after 0 | 23 / 763 (loom 19, ml 2, demo 1, blender-io 1) | 19 of 23 are one synthesiser's 0.95-0.983 end (selfcode); 4 others read: pause/hold, deliberate | no | info, or drop |
| 6 | TimeSensor disabled with no enable route | 20 / 821 | 0 true; the ones I read say in comments they are SAI-driven (stem, mashtots) | no | drop (false alarm) |
| - | Scalar to transparency / Color to colour out of 0..1 | 0 / 763 | none exist | no | not worth shipping yet |
| - | Equal adjacent keys, different values (control) | 7 scenes have them | all deliberate steps; none of my rules flag them [C] | n/a | do not flag |

## Example files (kept rules)
- Rank 1: x3d.ml/runs/gpu-phase/qwen2.5-coder-14b-awq/grounded/int-01.x3d (keys 0 0.5 1, angle 0 to 3.14, loops: snaps back a half turn each cycle); x3d-blender-io/tests/behaviour/demos/gallery-09-clockwork-bird/gallery-09-clockwork-bird.x3d (TurnB ends at -8.3776 = -120 deg, jump each cycle).
- Rank 2: x3d.ml/runs/gpu-phase/qwen2.5-coder-14b-awq/oneshot/anim-03.x3d; x3d.ml/runs/live-2026-10-17/x3d/z-ai_glm-5.3/anim-03_a1.x3d.
- Rank 3: x3d.ml/runs/gpu-phase/qwen3-8b/oneshot/hanim-05.x3d (routes use 'fraction'/'value'); x3d.ml/runs/gpu-phase/qwen3-8b/grounded/int-03.x3d (TouchSensor position into set_fraction).

## Ship first
1. Spin that does not close (rank 1). Exempt: a TimeSensor with loop false; non-single-axis keys; spans under 0.5 rad; last rotation equal to first mod 2pi (so 0 to 6.28 is fine, and 0..-8.3776 is flagged); consider exempting interpolators that drive HAnim joints (baked limb poses, 3 deliberate reads).
2. Never-starting TimeSensor (rank 2). Exempt: any ROUTE into the node (set_startTime, set_enabled), any Script, ProtoInstance, IMPORT/EXPORT, loop true, startTime > 0, enabled false (handled separately, dropped). Residual deliberate cases (page JS starts the clock, harness tests) argue for warning, not error.
3. Dangling interpolator (rank 3). Exempt: scenes with Script/Proto/IMPORT; split the message into no route from value_changed versus nothing into set_fraction; if x3d_mcp already rejects unknown route fields, suppress cases where a route from the node exists with a bad field name, so it is not double-reported.

## Caveats
Counts inflated by x3d.ml model runs and near-duplicate demo versions; rule 1 rests on 7 files read.
