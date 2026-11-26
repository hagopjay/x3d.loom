# The wild set in a browser: what is expected

Written and committed before `court_wild.py` was run.

The wild run's 39 "rebuilt" verdicts are the simulator's. This sends a sample to a second engine: the first 12 rebuilt
scenes in hash order, each original against the scene the search wrote, in X_ITE (headless Chromium) through
x3d-blender-io's pair judge at `8f3fc54`, three replays each, watched for 6 seconds. Six seconds is a slice of the slow
scenes (some loops are 30 s and more), chosen to keep the run under ten minutes; it can show a wrong direction or speed,
not a fault late in a loop.

Expected:

- **C1.** At least 10 of the 12 sampled solutions are judged "same" and none "differs".
- **C2.** Every control is judged "differs". A control is a written scene whose half-turn key 3.14159265 is printed to
  six decimals (failure mode 357).

If a solution "differs", the simulator and the browser disagree about a real scene, and that goes to the node editor
thread as a simulator finding.

## Run 1: both expectations failed, and the instrument is why

`results/court-wild-run1.json` (script kept as `court_wild_run1.py`). Solutions: 9 same, 2 differs, 1 unclear.
Controls: 3 of 3 "same". C1 and C2 both fail as stated.

Looking at the raw streams:

- **The judge was blind on slow loops.** In X_ITE a looping TimeSensor with startTime 0 takes its phase from the wall
  clock (its cycle starts fall on whole multiples of cycleInterval since 1970). Two replays ten seconds apart are at
  different points of a 30 s loop, and with a 6 s watch no cycle start falls inside to line them up. A file then
  disagrees with itself on every sample (floor 1.0), anything is "no worse than the floor", and the three controls came
  out "same" for that reason, not because they are.
- **Both "differs" are artefacts.** In `anim-05` three timers of 3, 5 and 7 s run at once; one time zero per run lines up
  one of them. In `sp-09` X_ITE spells the same rotation as `0 1 0 6.17` in one file and `0 -1 0 0.11` in the other;
  compared as rotations, original against written is 0.041 rad apart at worst, the same as either file against itself
  (0.044 and 0.043).

Three pairs had a quiet floor and are real agreements: `elevator.x3d` (0 of the samples outside, floor 0),
`joints-and-sensors.x3d` and the 3 s cube of `anim-05`.

## Run 2: the method, fixed before running it

`court_wild.py` now starts the original and the written scene together in two browsers and compares them at the same
instants of X_ITE's clock, so equal loops are in equal phase with no alignment; rotations are compared as rotations;
the floor is each file against itself, started together. The verdict rule is in the script's header. Same sample (first
12 by hash), same 6 s watch, same controls.

Expected: **C1'** at least 10 of 12 solutions "same", none "differs" (the scene with a touch sensor and nothing to
start it will be "unclear"). **C2'** every control "differs".

## Run 2: result

`results/court-wild.json`, 456 s. Recorder `x3d-blender-io@8f3fc54`, X_ITE 16.8.1, headless Chromium 158.

| | Expected | Result | |
|---|---|---|---|
| C1' | at least 10 of 12 solutions "same", none "differs" | 9 same, 0 differs, 2 unclear, 1 tool error | **fail** by one, C |
| C2' | every control "differs" | 1 of 3 | **fail**, C |

What changed against run 1 is the instrument: a file now agrees with itself. On the three turntables the floor went
from every sample outside to none, and the agreement of original and written scene is to 0.004 rad.

The two unclear pairs: `anim-04` flickers faster than this browser draws under load (32% of samples outside against a
floor of 22%), and `sp-16` has a touch sensor and nothing in a watch to start it.

## After run 2 (exploratory: `court_followup.py`, `results/court-wild-followup.json`)

- **The tool error was the reader, not the scene.** `joints-and-sensors.x3d` has a stream of nodes (contacts) that is
  not a number. With such streams skipped the pair is "same" (0 of the samples outside, floor 0). Counting it, 10 of 12
  are the same in the browser; that count is after the fact.
- **The controls were weak, and the reason is checkable.** Printing 3.14159265 as 3.141593 reverses only the first half
  of the loop (0 to pi goes the other way round; pi back to 0 is the same short way in both files). A 6 s watch at a
  random point of a 32 to 53 s loop sees the changed half about one time in two. Started on purpose in each half:

  | Control | First half of the loop | Second half |
  |---|---|---|
  | 000094 (32 s) | 100% of samples outside, 3.14 rad apart | 3% outside |
  | 000087 (53 s) | 100% outside, 2.63 rad apart | 0% |
  | 000015 (46 s) | 100% outside, 3.01 rad apart | 0% |

  So failure mode 357 is now seen in X_ITE on three real scenes, and the judge tells the files apart whenever the
  difference is in view.

Not done: the other 27 rebuilt scenes; a watch as long as the loop (the slow scenes were seen for a fifth of a turn);
scenes with a sensor.

## Run 3: all 39, with the fixed judge (expectations, written before the run)

The node editor's pair judge now replays both files at the same moment, compares rotations as rotations and says
"unclear, blind" when it cannot see (x3d-blender-io 2.7.8, `09a7a99`). `court_full.py` sends all 39 rebuilt scenes
through it, each watched for one whole loop plus 2 s (40 s at most), two repeats, with three controls.

Expected: **C1''** at least 30 of 39 "same" and none "differs". **C2''** 3 of 3 controls "differs" (a whole loop is in
view, so the changed half is too). Scenes with a sensor and nothing to press it will be "unclear".

## Run 3: result

`results/court-wild-full.json`, 108 minutes in the cloud. Judge `x3d-blender-io@09a7a99` `judge_pair(mode="simultaneous", repeats=2)`, X_ITE 16.8.1.

| | Expected | Result | |
|---|---|---|---|
| C1'' | at least 30 of 39 "same", none "differs" | 25 same, 1 differs, 9 unclear, 4 tool errors | **fail**, C |
| C2'' | 3 of 3 controls "differs" | 3 of 3, each about 3.14 rad from its original | pass, C |

- **The one "differs" is real and small.** `gpu-phase/gpt-oss-20b/oneshot/anim-01.x3d` means to spin a cube with keys 0 and 6.28319. That is 0.000005 rad past a full turn, so by the short way the cube moves five millionths of a radian: it does not spin (a cousin of failure mode 361). The search matched that stillness inside its tolerance of 0.001 with a clock of 0.6 s where the original has 4 s. The browser judge scales its tolerance to the stream and sees the two differ by 0.000004 rad. Nothing a person could see, but the written rule is not the original's rule: the task should have been left out as "moves less than the tolerance".
- **The 9 unclear.** 5 are "blind" or near it: short, fast scenes (3 to 10 s) on a machine at load 7, where a file disagrees with itself on half the samples or more. 4 have one stream a little over a quiet floor (0.8 to 6% of samples outside against 0 to 3%).
- **The 4 tool errors.** 3 scenes have a sensor and nothing moving, so the two runs share no samples; 1 (`marble-minimal.x3d`) has no ROUTE end in common between the files, because the judge watches what ROUTEs end at and the stage watched a different field.

Reading: of 39 rebuilt scenes, 25 were seen to behave the same in X_ITE over a whole loop, 1 differs by an amount below sight, and 13 could not be judged on this machine. The planted errors were all caught. A quiet machine would settle most of the 9 unclear.

