# Self-coding from one demonstration: pre-registration

Written and committed before any test seed was run. The commit that adds this file is the registration; the results
commit comes after it and names it.

## The question

The behaviour graph in x3d-blender-io is plain Python: `Behaviour().add(...)`, `>>` for a ROUTE, `weave()` to write
it into an X3D file, and a simulator that says what the graph does. So a program can write X3D behaviour, run it, and be
told whether it is right. Can a program with no language model and no person in the loop go from "this is what the
world did when it was poked" to the X3D that does it, and does what it learns on one batch of worlds make the next
batch cheaper?

That is one small turn of the flywheel, closed end to end: state (X3D), execute (simulator), check (kernel), remember
(shapes), reuse.

## Set-up (frozen)

- **Stage**: `stage.x3d`, four touchable objects, four materials, a light, a viewpoint, no behaviour.
- **Tasks**: `tasks.py`, 18 families. A task is a reference behaviour graph drawn from a seed. The synthesiser never
  sees the reference, only the stage, the stimulus script and the values of the watched fields every 0.05 s.
  15 families use only nodes the synthesiser may place. 3 do not (an eased motion, a damper after a table, a chaser):
  they are controls that should be missed.
- **Lessons**: *short* = hover, press, drag, release and leave every object, twice. *Long* = the short lesson followed
  by a second pass with a double click, a long hold and a hover with no press.
- **Unseen stimulus**: another order, off-grid times, other drag points, a second click while the first is playing.
  A solution passes when it matches the reference on it within 0.02.
- **Synthesiser**: `synth.py` at this commit. Budget: 1,000 simulator runs per task. One simulator run is the unit
  of cost.
- **Seeds**: seed 0 was the development seed and was looked at freely. Seeds 1, 2, 3 are the learning batch (54
  tasks). Seeds 4 to 9 are the test batch (108 tasks: 90 in vocabulary, 18 controls). No test seed has been run.
- **Arms on the test batch**: short lesson with no memory; long lesson with no memory; long lesson with the memory
  frozen after the learning batch (shapes ordered by how often they solved a learning task).
- **Kernel**: every solved program is woven into the stage and checked by the x3d_mcp fork (X3D 4.0 XSD plus its
  semantic checks), commit named in the results.
- **Simulator**: x3d-blender-io `source/behaviour_sim.py`, commit named in the results.

## Hypotheses

- **H1, it codes itself.** Long lesson, no memory, in-vocabulary test tasks: at least 80% are solved and pass the
  unseen stimulus.
- **H2, the kernel accepts what it writes.** Every solved program in every arm has 0 schema errors and 0 semantic
  errors. One failure fails H2.
- **H3, the lesson matters.** The share of in-vocabulary test tasks that are solved and pass the unseen stimulus is
  at least as high with the long lesson as with the short one. (On the development seed the short lesson let one
  look-alike through.)
- **H4, memory makes the next batch cheaper.** On in-vocabulary test tasks solved in both long arms, total simulator
  runs with memory are at most half the total without, and a one-sided Wilcoxon signed-rank test on the pairs gives
  p < 0.01. Memory must not cost correctness: solved-and-passing with memory is not more than 3 tasks below without.
- **H5, the controls are missed.** Of the 18 out-of-vocabulary tasks, at most 6 are solved and pass the unseen
  stimulus in the long arm. Any that pass are reported with their graphs, since a pass would mean the vocabulary
  reaches further than intended.

## Reported without a threshold

- How many test tasks glTF 2.0 core could state at all (a free-running loop of translation or rotation, by
  construction of the task).
- What each pruning rule removed: extensions offered, kept by type, kept as new event streams, refused as too late,
  tables refused as recordings.
- Size of each solution against its reference.
- The node editor's own test worlds (door, counter, snake) from x3d-blender-io, with and without memory.
- The cost of each learning task alone and in a fixed order with a growing memory.

## What this cannot show

- The tasks and the method have one author. The families were written from the node list, not collected from scenes
  in the wild. A sealed task list from someone else is the fix.
- The judge is the simulator. It agrees with X_ITE 16.7.1 on the recorded streams in x3d-blender-io, but a found
  graph may use wiring those recordings never exercised. A browser replay of a sample is planned and is exploratory.
- No model is involved, so nothing here says how a language model would do. It is the floor: what search alone
  reaches when the format is typed, executable and checkable.
- The memory is a list of wiring shapes, not Loom rules in the r2r sense.

## Deviations

Any change to the code between this commit and the results commit is listed in the README with its reason.
