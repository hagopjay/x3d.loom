# The wild set: the search on scenes nobody wrote for it

The registered self-coding experiment (`../README.md`) scored 87 of 90, on tasks written by the same hand as the
search. This folder asks whether that survives contact with real files: every qualifying `.x3d` scene in the project's
eighteen repositories, behaviour stripped out, rebuilt by the same search from one demonstration, and marked against
the original on input the search never saw.

Pre-registration: [`PREREG.md`](PREREG.md), commit `31461d5`, pushed before the test sample was run.
Results: [`results/wild-test.json`](results/wild-test.json). Run 2026-11-26, 183 s on 4 cores.
Judges: simulator `x3d-blender-io@3e3c1e8 source/behaviour_sim.py`; kernel `x3d_mcp@f0bde28` (X3D 4.0 XSD + semantic
checks). No browser in this experiment: every "rebuilt" is the simulator's verdict.
Model calls: 0. People in the loop: 0.

## Result

656 scenes qualify. The split is by hash. The test sample is the first 100 scenes of the test split, never opened
before the run.

| | Prediction | Result | |
|---|---|---|---|
| W1 | at least 45% of tasks rebuilt and right on unseen input | **39 of 53 (74%, 95% interval 60 to 84%)** | pass, C |
| W2 | no written scene adds a kernel error to its original | 39 of 39 add none | pass, C |
| W3a | originals of 1-3 behaviour nodes: at least 75% rebuilt | 31 of 32 (97%) | pass, C |
| W3b | originals of 11 or more nodes: at most 15% rebuilt | 2 of 11 (18%) | **fail** by one scene, C |
| W4 | memory changes nothing: total runs within 10%, rebuilt within 2 | rebuilt 39 and 39; runs 487 without memory, 325 with (33% fewer; 3 cheaper, 3 dearer, 33 equal; Wilcoxon p = 0.17) | **fail** on the runs clause, C |
| W5 | 30 to 55% of qualifying scenes left out before they become tasks | 47 of 100 | pass, C |

Middle size (4-10 nodes): 4 of 8. Median cost of a rebuilt scene: 4 simulator runs. Five scenes hit the 30 s limit.

### What was left out, and why (47 of 100)

| Reason | Scenes |
|---|---|
| The original does nothing the stage can see under the lesson | 26 |
| Its behaviour ends only at node types the search does not watch (shaders, HAnim joints, viewpoints, ...) | 11 |
| Its sensors sit on no named object the lesson can poke (a TouchSensor at the Scene root, or under an unnamed parent) | 8 |
| The tools cannot read it (XML parse error) | 2 |

Looked at afterwards (exploratory): of the 26 that "do nothing", 10 are validator test fixtures with ROUTEs between
static nodes, 3 have a timer that nothing ever starts, 2 have a sensor that fires into nothing, and the rest have a
running clock whose events reach no watched field. 20 of the 26 are model-written scenes from the x3d.ml live runs.

### By repository (tasks, rebuilt)

x3d.ml 25, 22. x3d.accrete 13, 13. x3d.demo 9, 1. x3d.loom 5, 3. x3d.mashtots 1, 0.

## In a real browser (a sample)

The 39 verdicts above are the simulator's. [`COURT.md`](COURT.md) sends the first 12 rebuilt scenes (by hash) to X_ITE
16.8.1, original against written scene. Expectations were written before each run and **both runs failed them**:

- Run 1, with x3d-blender-io's pair judge as shipped: 9 same, 2 differs, 1 unclear, and all 3 planted controls "same".
  The judge was blind: in X_ITE a looping timer takes its phase from the wall clock, so two replays never line up, and
  it compared rotations as raw numbers.
- Run 2, original and written scene started at the same moment and rotations compared as rotations: 9 same, 0 differs,
  2 unclear, 1 tool error; controls 1 of 3. A file now agrees with itself (floor 0 on the turntables, was 1).
- Afterwards (exploratory): the tool error was a non-numeric stream, and that pair is "same"; the controls only differ
  in the first half of the loop, and all 3 differ on every sample when the watch is put there.

- Run 3, all 39 through the fixed judge (x3d-blender-io 2.7.8), each watched for a whole loop: 25 same, 1 differs,
  9 unclear, 4 tool errors; controls 3 of 3 caught. Expected 30 same and none different, so this failed too.

Reading: 25 of 39 rebuilt scenes were seen to behave the same in X_ITE. One differs by 0.000004 rad: a scene that
barely moves, matched with the wrong clock inside the simulator's tolerance. Thirteen could not be judged on a loaded
machine or without a click.

## How to read this

- **It is a test of animation, not of interaction.** 50 of the 53 tasks had nothing to poke: a clock, a table, a
  field. The search rebuilds those almost every time when the original is small. The corpus holds few scenes with
  sensors on named objects, so this run says little about buttons, toggles and drags; the registered synthetic set and
  the recordings in `../demonstration/` carry that claim for now.
- **Size is the wall.** 97% at 1-3 nodes, 50% at 4-10, 18% at 11 or more. The big misses are generated scenes with
  75 to 400 animated fields; 400 runs and 30 s do not reach them. The share of all fields matched on the lesson is 90
  of 1,411, because a handful of huge scenes hold most of the fields.
- **The scenes are a family, not a sample of the web.** Most come from this project's own generators and model runs,
  and scenes from one generator succeed or fail together (x3d.accrete 13 of 13, x3d.demo 1 of 9). The interval above
  treats scenes as independent and is therefore too narrow.
- **Two predictions failed.** Large scenes did slightly better than predicted, and memory saved a third of the runs
  where it was predicted to save nothing, though on 6 scenes out of 39 and without statistical support.

## What the development split taught (before registration)

Four things changed between the first try and the registered run, all found on the 60 development scenes and listed
in the registration: lessons for worlds with nothing to poke, the length of those lessons (3.5 turns of the slowest
clock), writing table numbers in full, and the limits. On the first try 21 of 60 scenes were lost to one bug in the
marking code and counted as unreadable. See `LEARNINGS-selfcode.md`, "The wild set".

## Run it

```
python3 selfcode/wild/wild.py --roots <repository folders> --x3d-mcp ../x3d_mcp --kernel-python <python> --split test --limit 100
```

The other 401 scenes of the test split are an unread reserve for a replication.
