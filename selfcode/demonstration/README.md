# Lessons from recordings

`door.activity.json` and `counter.activity.json` were made by x3d-blender-io's recorder (`tools/behaviour_record.py`,
schema `x3d.activity/1`, draft at x3d-blender-io commit `af4fc37`) from `tests/behaviour/door.x3d` and `counter.x3d`.
The same recorder sits behind the Record button of the Blender node editor.

`../lesson.py` gives the search the pointer calls and the deliveries that land on stage fields, and nothing else.

| World | Shown to the search | Runs | Written graph | Unseen stimulus |
|---|---|---|---|---|
| door | 2 pointer calls, `Door.translation` | 60 | TouchSensor, TimeSensor, PositionInterpolator: the original's three nodes | agrees |
| counter | 6 pointer calls, `Bit0.visible`, `Bit1.visible` | 664 | TouchSensor, BooleanToggle, two BooleanFilters (ripple carry) | agrees |

`*.lesson.json` is the result record, `*.written.x3d` the scene the search wrote. Two worlds, simulator
`x3d-blender-io@3e3c1e8`: a first result, not a rate.

```
python3 selfcode/lesson.py <world.x3d> <world.activity.json> --out result.json --x3d-out written.x3d
```
