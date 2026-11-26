# The wild set: pre-registration

Written and committed before the test sample was run. The commit that adds this file is the registration.

## The question

The registered self-coding experiment (`../PREREG.md`) used tasks written by the same hand as the search. This one asks
the harder question: **does the same search rebuild the behaviour of scenes nobody wrote for it?**

## The corpus

Every `.x3d` file in the eighteen repositories of the project, at the commits recorded in the result file
(`meta.corpus`). A scene **qualifies** when it has a `ROUTE`, has no `Script`, and every behaviour node it uses is one
the simulator runs (`behaviour_sim.SIMULATED`, x3d-blender-io at the commit in `meta.simulator`). Files under
`selfcode/`, `node_modules/` and `.git/` are skipped. A scene is identified by the SHA-1 of its text with white space
removed, so a file copied between folders counts once. **656 scenes qualify.**

Most were written by programs or by language models in earlier experiments of this project (x3d.ml live runs 333,
x3d.demo 113, x3d.accrete 98, x3d.loom 59, others 53). None was written for this test. They are not independent of
each other: one generator or one model run gives a family of similar scenes, so results are also reported by
repository, and nothing here is a claim about X3D on the open web.

## The split

Fixed by the hash, not by a choice of mine: scenes whose hash starts with `0`-`3` are the **development split** (155),
the rest are the **test split** (501). Everything below was tuned on the first 60 development scenes in hash order.
The **test sample** is the first **100** scenes of the test split in hash order (the hash order is as good as random).
The other 401 test scenes stay unread as a reserve for a replication.

## The task

For each scene: strip its behaviour (`behaviour_graph.strip`), keep the original graph as the hidden reference, show
the search what the watched fields did under one lesson, and let it write a graph. No model, no person.

- **Lesson.** If the original has a pointing sensor on an object the lesson can poke, the long lesson of the registered
  experiment, unchanged. Otherwise the world is only watched, for 3.5 turns of its slowest clock (3 s at least, 200 s
  at most). The demonstrator is allowed to know how long the loop is; the search is not told.
- **Search.** `synth.Synth` as merged, 400 simulator runs per scene, first share 100 per field, 30 s of wall time per
  arm. Two arms: no memory, and the 14 wiring shapes frozen from the registered run.
- **Marking.** A scene is **rebuilt** when the written graph matches the lesson on every field *and* agrees with the
  original on a stimulus the search never saw: the held-out script when there is something to poke, otherwise the same
  world watched 1.7 times longer. Tolerance 0.02, as registered.
- **Kernel.** The written scene must add no error to what the original scene already had (x3d_mcp XSD and semantic
  checks, commit in `meta.kernel`). Many originals are deliberately broken, so the count is of *new* errors.

## What was changed after looking at the development split (and so is not evidence)

1. Watch-only lessons and their unseen test (the registered experiment always had objects to poke).
2. Lesson length 3.5 turns: the search calls a value periodic only when it sees the period three times.
3. Table numbers are written in full. Six-decimal printing turned a key of 3.14159265 into 3.141593, past pi, and a
   half turn then ran the other way; eleven turntables failed for that reason alone.
4. Limits: 400 runs, 30 s, lesson at most 200 s.

Development result with these settings (60 scenes): 24 left out, 36 tasks, 25 solved, 21 rebuilt (58%); by size of
the original: 19 of 23 at 1-3 nodes, 2 of 3 at 4-10, 0 of 10 at 11 or more. Four of the misses were the 120 s cap
that is now 200 s.

## Predictions (test sample, no-memory arm unless said)

- **W1 (main).** At least **45%** of the tasks are rebuilt. Below 25% I stop saying the search works outside its own
  test.
- **W2.** No written scene adds a kernel error.
- **W3 (scale is the limit).** At least 75% of originals with 1-3 behaviour nodes are rebuilt; at most 15% of those
  with 11 or more.
- **W4 (memory does not matter here).** Total runs with memory are within 10% of total runs without, and the rebuilt
  count differs by at most 2. Real scenes are mostly "clock, table, field", which is found in a handful of runs.
- **W5.** Between 30% and 55% of qualifying scenes are left out before they become tasks. Every reason is counted and
  published: the search does not get to choose its exam.

## What will be reported whatever happens

Counts for every left-out reason; tasks, solved, rebuilt, with Wilson 95% intervals; by repository; by size; runs;
time-outs; share of fields matched on the lesson (not verified on unseen input, so a secondary number). Anything
looked at after the run is labelled exploratory.

## Judges

Simulator: x3d-blender-io `source/behaviour_sim.py` at the commit in `meta.simulator`. Kernel: x3d_mcp at the commit in
`meta.kernel`. No browser in this experiment: every "rebuilt" is the simulator's verdict.
