# selfcode: X3D behaviour written by search, from one demonstration

A program with no language model and no person in the loop is shown what a world did when it was poked. It writes
the X3D behaviour graph that does the same (sensors, timers, event utilities, followers, interpolator tables, ROUTEs),
runs what it wrote, has the kernel check the file, and remembers the wiring shape. The next batch of worlds is cheaper.

It stands on the behaviour graph in x3d-blender-io: a typed catalogue generated from the X3D object model, a graph
built in plain Python, and a simulator that was checked against X_ITE. The graph it writes is the one Blender's node
editor opens ("Behaviour as node graph" on import).

Pre-registration: [`PREREG.md`](PREREG.md), commit `ec934f1`, before any test seed was run.
Results: [`results/results.json`](results/results.json). Run 2026-11-26.
Judges: simulator `x3d-blender-io@e783aa1 source/behaviour_sim.py`; kernel `x3d_mcp@f0bde28 (X3D 4.0 XSD + semantic checks)`.
Model calls: 0. People in the loop: 0. Wall time 501 s on 4 cores.

## Results

Grades: C = run and counted here; L = likely, argued from what was run; S = suspected.

| | Hypothesis | Threshold | Result | |
|---|---|---|---|---|
| H1 | It codes itself | at least 80% of in-vocabulary test tasks solved and correct on the unseen stimulus | 87 of 90 (96.7%, 95% interval 91 to 99%) | pass, C |
| H2 | The kernel accepts what it writes | 0 schema and 0 semantic errors in every solved file | 267 of 267 files clean, no warnings | pass, C |
| H3 | The lesson matters | long lesson at least as good as short | 87 against 86 | pass, C (by one task) |
| H4 | Memory makes the next batch cheaper | total runs at most half, Wilcoxon p < 0.01, at most 3 tasks lost | 4,109 to 1,018 runs (25%), p = 2.9e-12; cheaper on 60, equal on 23, dearer on 4; 87 against 87 correct | pass, C |
| H5 | The controls are missed | at most 6 of 18 solved and correct | 1 of 18 | pass, C |

The registered code (`core.py`, `synth.py`, `tasks.py`, `run.py`, `kernel.py`, `stage.x3d`) is byte-identical between
the registration commit and the run. `results.json` says `dirty: true` because the results folder and the files
added afterwards (`court.*`, `stack.py`) were untracked when it was written.

Median simulator runs per solved in-vocabulary task: 54 without memory, 3 with. Median size of a found graph
against its reference: +0 nodes. Over all 108 test tasks, misses included, the total goes from 23,231
to 20,026 runs: a miss costs the full budget with or without memory.

### By family (unseen batch, six tasks each)

| Family | Short lesson, correct | Long lesson, correct | Long + memory, correct | Runs per task, no memory | Runs per task, memory | |
|---|---|---|---|---|---|---|
| slide | 6 of 6 | 6 of 6 | 6 of 6 | 59.0 | 3.0 |  |
| glow | 6 of 6 | 6 of 6 | 6 of 6 | 60.0 | 3.0 |  |
| turn | 6 of 6 | 6 of 6 | 6 of 6 | 57.0 | 3.0 |  |
| fade | 6 of 6 | 6 of 6 | 6 of 6 | 60.2 | 3.2 |  |
| hover | 6 of 6 | 6 of 6 | 6 of 6 | 3.2 | 1.2 |  |
| hide-while-pressed | 6 of 6 | 6 of 6 | 6 of 6 | 4.0 | 2.0 |  |
| toggle | 6 of 6 | 6 of 6 | 6 of 6 | 5.0 | 3.0 |  |
| loop | 6 of 6 | 6 of 6 | 6 of 6 | 4.0 | 4.0 |  |
| drag | 6 of 6 | 6 of 6 | 6 of 6 | 3.0 | 3.0 |  |
| drag-damped | 6 of 6 | 6 of 6 | 6 of 6 | 10.8 | 8.2 |  |
| light-while | 6 of 6 | 6 of 6 | 6 of 6 | 65.5 | 53.5 |  |
| two-targets | 6 of 6 | 6 of 6 | 6 of 6 | 134.3 | 32.0 |  |
| loop-after-click | 6 of 6 | 6 of 6 | 6 of 6 | 4.0 | 4.0 |  |
| start-on-press | 5 of 6 | 6 of 6 | 6 of 6 | 113.5 | 6.0 |  |
| follow-the-leader | 3 of 6 | 3 of 6 | 3 of 6 | 601.3 | 540.7 |  |
| eased | 1 of 6 | 1 of 6 | 1 of 6 | 687.0 | 668.0 | control |
| damped-fade | 0 of 6 | 0 of 6 | 0 of 6 | 1000.0 | 1000.0 | control |
| chased | 0 of 6 | 0 of 6 | 0 of 6 | 1000.0 | 1000.0 | control |

### What the search threw away

Over the 64 in-vocabulary test tasks that needed a search: 11,538 one-node extensions were on offer;
3,770 were legal by type and were run; 3,184 event streams were new and kept; 940 were refused because
their first event came after the effect; 6 tables were refused as recordings (more than 16 keys).

### What it remembered

14 wiring shapes after the learning batch. The most used: `TouchSensor.touchTime → TimeSensor.startTime →
fraction_changed → table` (16 learning tasks). Shapes hold wiring only. Times and table values are solved
fresh for each world, by fitting the table to the demonstration.

### The node editor's own worlds

| World (x3d-blender-io `tests/behaviour/`) | Fields that change | Without memory | With memory |
|---|---|---|---|
| door | 1 | solved in 65 runs, correct on the unseen stimulus | 8 runs |
| counter | 2 | solved in 44 runs, correct on the unseen stimulus | 44 runs |
| snake | 3 | missed: head solved, 2 follower fields left at the budget | missed |

The counter is the one to look at. From the bare scene and the bits' behaviour it wrote a ripple carry: Bit 1 toggles
when Bit 0 falls.

```
TouchSensor Touch_Button.isActive --SFBool--> BooleanToggle BooleanToggle4.set_boolean
BooleanToggle BooleanToggle4.toggle --SFBool--> Transform Bit0.visible
Transform Bit0.visible --SFBool--> BooleanFilter BooleanFilter7.set_boolean
BooleanFilter BooleanFilter7.inputFalse --SFBool--> BooleanFilter BooleanFilter24.set_boolean
BooleanFilter BooleanFilter24.inputNegate --SFBool--> BooleanToggle BooleanToggle42.set_boolean
BooleanToggle BooleanToggle42.toggle --SFBool--> Transform Bit1.visible
```

### glTF

3 of the 108 test tasks could be stated in glTF 2.0 core: the free-running loops of translation or
rotation. Core glTF has keyframed channels and no event, sensor or trigger. The Khronos interactivity extension
was submitted for ratification on 16 July 2026; no ratification notice was found on 26 Nov 2026 (L, one search).

## Four layers on one file (`stack/`)

`stack.py` puts the thesis on one scene. Not part of the registered experiment.

| Layer | What | Judge | Verdict |
|---|---|---|---|
| Payload | `door.gltf`, the door leaf | Khronos glTF-Validator 2.0.0-dev.3.10 | 0 errors, 0 warnings (C) |
| Scene | `door-stack.x3d`: the stage Inlines the glTF; the behaviour was written by search in 65 simulator runs | x3d_mcp@f0bde28 (X3D 4.0 XSD, semantic checks, file checks) | 0 schema errors, 0 semantic errors, 0 warnings (C) |
| Meaning | the scene as RDF in X3D Ontology terms, 322 triples | one SPARQL query: what does a press on a TouchSensor end up changing? | `Touch_Button.touchTime` reaches `Door.translation` over 3 ROUTEs (C) |
| Proof | `RECEIPT.json`: files by hash, judges by version, verdicts | X_ITE 16.8.1 replay against the reference | same behaviour, 0.0 of samples outside the tube (C) |

Not checked: whether X_ITE drew the glTF door (the replay reads `Door.translation`, not pixels).

## A second judge: the browser

Exploratory, not registered. `court.py` wove the reference graph and the found graph of a sample of click-driven test tasks into the stage, loaded each in X_ITE 16.8.1 (headless Chromium, software GL) and gave both the same real mouse gestures: a click, two quick clicks, leave and return, a long hold. The watched fields were read on every frame. Two runs agree when at most 1% of samples have no partner within 0.15 s and 0.05.

| Pairs | Judged | Same behaviour | Could not judge |
|---|---|---|---|
| Found graph against its reference | 18 | 15 | 0 |
| Control: a reference against another task's graph (should differ) | 3 | 0 | 0 |
| Look-alike from the short lesson against its reference | 1 | 0 | 0 |

The three that did not agree were replayed, and each reference was replayed against itself to find the court's own noise (`court_noise.py`, `results/court-noise.json`):

| Task | First replay, outside | Second replay, outside | Reference against itself | Reading |
|---|---|---|---|---|
| two-targets-4 | 7.8% | 0.0% | 1.6% | not repeatable; within what the court can resolve (L) |
| two-targets-5 | 1.8% | 1.7% | 2.0% | the same size as the reference against itself (L) |
| start-on-press-4 | 38.5% | 27.6% | 0.7% | **a real difference, repeated (C)** |

`start-on-press-4` is the finding. The search did not use a TimeTrigger. It wrote `TouchSensor.isActive → TimeSensor.loop` and then `elapsedTime → TimeSensor.startTime`, which the simulator accepts as equivalent on every stimulus it was shown and X_ITE does not. `elapsedTime` is a duration, so the second timer's startTime is set to a moment long past; why the two engines then differ was not traced (S). Four of the 89 long-lesson solutions (all start-on-press) start a timer through `loop`; three use `cycleTime` and the one of those that was sampled agrees in the browser.

So the simulator is a kernel only as far as it has been checked against a browser. A search will find the corners where it has not (FM 338).

Every pair is in `results/court.json`. The gestures are clicks on one object, so drag tasks and hover-only tasks are not covered.

## Misses, and what was learned from them

1. **Three in-vocabulary misses, one cause (FM 334).** All are follow-the-leader. The follower's field was tried
   first and spent the whole budget before the leader's loop was tried. With `share=100` (a first share of runs per
   field, then come back) all 6 of 6 solve and pass the unseen stimulus. This was measured after the test data was seen;
   the option is off by default so the registered behaviour is unchanged.
2. **A recording passed for a rule (FM 329).** Control `eased-9` was solved by a 13-key table over a 0.65 s timer. It
   copies the eased curve sample by sample at the 0.05 s step it was judged at. The 16-key cap is too blunt.
3. **One lesson can be too little (FM 330, 331).** On the short lesson `start-on-press-5` came out as
   `isActive → TimeSensor.loop`, which fails on a double click. The long lesson removes it.
4. **Memory first made things worse (FM 332).** On the development seed, replaying shapes naively turned a 3-run task
   into 75 runs. Type gate, onset gate, depth-first replay and a shared run cache fixed it before registration.
5. **The snake is out of reach** at this budget: three dampers in a chain, each a slow run.
6. **The search found a hole in the simulator (FM 338).** See the browser section: one solution is equivalent in the
   simulator and different in X_ITE.

## What this cannot show

- The tasks and the method have one author. A sealed task list from someone else is the fix.
- The first judge is a simulator, and the browser found one solution where the simulator is wrong about equivalence. H1 is a claim about the simulator's verdict. The browser replay covers a sample and only click gestures.
- No model was involved. This is the floor: what search reaches when the format is typed, executable and checkable.
- The memory is a list of wiring shapes, not Loom rules in the r2r sense.

## Run it

```
python3 selfcode/run.py --x3d-mcp ../x3d_mcp --kernel-python <python with the fork's requirements>
python3 selfcode/stack.py --x3d-mcp ../x3d_mcp --kernel-python <same> --gltf-check <gltf_check.mjs> --x-ite <x_ite dist>
python3 selfcode/court.py --x-ite <x_ite dist>      # needs node with playwright
```

`X3D_BLENDER_IO` points at an x3d-blender-io checkout (default `../x3d-blender-io`). `results/solutions/` (267 woven
files) is not committed; `run.py` rebuilds it.

## Deviations from the registration

None in the registered code or thresholds. Added after the run: `court.cjs`, `court.py`, `court_noise.py`,
`fair_share.py`, `stack.py`, and an optional `share` argument to `Synth` (default off) for miss 1.

## After the registered run

- [`wild/`](wild/README.md): the same search on real scenes nobody wrote for it. Pre-registered; 39 of 53 rebuilt and
  right on unseen input, 31 of 32 when the original has three behaviour nodes or fewer, 2 of 11 at eleven or more.
- [`lesson.py`](lesson.py) and [`demonstration/`](demonstration/): the search learns from a recording made by the
  node editor's recorder (`x3d.activity/1`). Door in 60 runs, counter in 664, both right on unseen input.
- [`trace.py`](trace.py) and [`traces/`](traces/): everything the search tried, in order, for three tasks
  (`x3d.selfcode.trace/1`), for replay in a viewer.
