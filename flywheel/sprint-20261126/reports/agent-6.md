# lesson.py on gallery scenes (agent 6)

Tried 8 of 20 (smallest first). Solved 1 (06). Right on unseen stimulus: 0 of 8. Every figure below comes from my runs; code reading is marked L.

## Commands that worked (C)
Helper, one scene per call: `agents/6/run.sh <scene> <seconds> '<script json or empty>'`. It runs:
- `venv/bin/python x3d-blender-io/tools/behaviour_record.py <scene.x3d> [--script s.json] --seconds N --out S.activity.json`
- `X3D_BLENDER_IO=x3d-blender-io venv/bin/python x3d.loom/selfcode/lesson.py <scene.x3d> S.activity.json --budget 1000 --out S.lesson.json --x3d-out S.written.x3d`

Script calls: `{"time":1,"call":"click","node":"<TouchSensor DEF>","args":{}}`, or press/drag(point)/release on a PlaneSensor. The behaviour node count comes from `core.bg.Behaviour.from_x3d` (role BEHAVIOUR); lesson.py itself reports it only when solved. Neither tool crashed on any scene.

## Results
| scene | beh. nodes | stimulus | solved | runs | nodes written | rec==resim | unseen ok | fields left | wall s |
|---|---|---|---|---|---|---|---|---|---|
| 15 bead-puppet | 15 | press/drag/release PlaneSensor, 6 s | no | 1000 | 0 | yes | n/a | 12 | 2.6 |
| 09 clockwork-bird | 20 | click, 10 s | no | 1000 | 0 | yes | n/a | 11 | 21.0 |
| 10 ferris-wheel | 32 | click, 10 s | no | 1000 | 0 | NO (13 fields drift) | n/a | 23 | 11.7 |
| 06 solar-gauntlet | 45 | none, 10 s | YES | 272 | 28 | yes | NO | 0 | 7.8 |
| 05 spin-the-planet | 50 | none, 10 s | no | 1000 | 0 | yes | n/a | 16 | 27.1 |
| 01 pendulum-wave | 49 | click Restart, 10 s | no | 1000 | 0 | NO (20 fields drift) | n/a | 30 | 4.6 |
| 04 jellyfish-swarm | 51 | drag, 8 s | no | 1000 | 0 | yes | n/a | 45 | 11.9 |
| 18 newtons-cradle | 54 | 2 clicks, 8 s | no | 1000 | 0 | yes | n/a | 8 | 4.5 |

n/a means no program was written, so the unseen check did not run. Scenes 08, 12, 17, 19 and the rest were not tried.

## Totals
Tried 8, solved 1 (12.5%), right on unseen 0 (the single solve disagrees on the held-out script). Recording matched re-simulation in 6 of 8.

## Failure causes
1. Search exhausted its budget (6 scenes): the original graphs are 15 to 54 behaviour nodes of TimeSensor/interpolator/chaser clusters. The door and counter examples were far smaller (S).
2. Recording does not match re-simulation (01, 10): lesson.py's own simulator disagrees with the recording on rotations of looping pendulums and wheels (S, from `fields_that_drift`). The lesson is then unfair, though the search still runs and fails. Likely cause is time-sampling or loop phase (L, not tested).
3. The one solve (06, 28 nodes against 45 originals, no stimulus) is overfit: it matches the 10 s recording but diverges on the held-out script (S). That script includes pointer calls (L, `heldout_script`), which the recording never exercised.
4. Watch-only scenes (05, 06) have no calls, so touchable stage objects are never exercised and unseen behaviour is unconstrained (L).

## Most useful fixes
1. `lesson.py` `learn()` (~line 99): when `drift` is non-empty, stop with a clear "recording is not reproducible" result. Also always write `reference_nodes` (it is only set in the `if program:` branch), so failures can be compared with the original size.
2. `lesson.py` heldout call (`heldout(stage, reference, program)`, `run.py` line 54): for a recording with 0 calls, run it as "no stimulus" or mark the result `unseen: untested`, not False. Also report the drift field list in the top-level result.
3. `behaviour_record.py` `main` (~line 54): accept a `--click-all` / `--auto-script` option that clicks every pointer sensor, so recordings are not hand-scripted. Add a `--loops N` option (L, not tested).

Grades: C = checked by running, S = measured in my runs, L = from reading code.
