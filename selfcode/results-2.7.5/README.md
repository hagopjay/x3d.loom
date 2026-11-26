# Results against the fixed simulator (x3d-blender-io 2.7.5)

Question: after the add-on's fix for "a non-looping TimeSensor started with a startTime in the past", does the search still
write graphs the simulator likes and X_ITE does not? Everything here is exploratory, as the browser court was. Run 2026-11-26.

Instruments
- Simulator before: `x3d-blender-io@e783aa1 source/behaviour_sim.py` (extracted with `git archive`). After: `x3d-blender-io@91d6ad3` (2.7.5), read-only checkout.
- Search: the registered `selfcode/` at commit 476d9ea, byte-identical (`git diff` of core.py, synth.py, tasks.py, run.py, kernel.py, stage.x3d is empty). Same seeds (learn 1 to 3, test 4 to 9), budget 1,000 runs, order seed 2026. Run with `X3D_BLENDER_IO=<checkout> python3 selfcode/run.py --x3d-mcp ../x3d_mcp --out <folder>`; `run.py` already had both switches, no scratch copy was needed.
- Kernel: `x3d_mcp@4d433af` (X3D 4.0 XSD + semantic checks), run with Python 3.13.18. The first run used `f0bde28`, which is not in the checkout on this machine; the 267 files still come out clean, but that is a different kernel revision.
- Browser: X_ITE 16.8.1 in headless Chromium (Playwright, software GL), `court.py` / `court.cjs` unchanged, thresholds unchanged (slack 0.15 s, tolerance 0.05, at most 1% outside).
- Machine: 4-core Intel Xeon @ 2.1 GHz VM, shared with other jobs while this ran (load average 3 to 5). That matters for the browser numbers; see Q3.
- Model calls: 0. Network: none beyond a `pip install scipy` (Wilcoxon p).

## Q1. Does the fixed simulator call start-on-press-4's old solution different from its reference?

Yes. The old run was first re-run with the old simulator and reproduces `results/results.json` exactly (every solved, held-out and run count of the 324 test records, and the summary; `results-old-sim-rerun.json`). Each of the 267 old solutions was then read back and compared with its reference on the lesson it was found from and on the unseen stimulus (tolerance 0.02), by both simulators (`selfcode/replay_solutions.py`):

| | old simulator e783aa1 | fixed simulator 91d6ad3 |
|---|---|---|
| start-on-press-4, long-lesson solution (`isActive -> loop`, `elapsedTime -> startTime`) | equal on lesson and unseen | differs on lesson and on unseen (C) |
| start-on-press-4, short-lesson solution (same wiring) | equal | differs on both |
| the 267 solutions, number differing from their reference | 4 (start-on-press-5 short, 3 eased-5) | 10 |

The six more that now differ are exactly the other `elapsedTime -> startTime` solutions: the short-lesson solutions of start-on-press-5, 6, 7, 8, 9. Of the 267 old files, 7 use that wiring (start-on-press-4 long and short, 5 to 9 short); the fixed simulator rejects exactly those 7 and no other (`replay-old-solutions-fixed-sim.json`). The eased-5 entries are a control that was "solved" and failed the unseen stimulus before and after. The hole is closed for every file the search wrote in this batch (C).

## Q2. The search against the fixed simulator

| | Before (e783aa1, results/results.json) | After (91d6ad3, results.json here) |
|---|---|---|
| H1 solved and correct on the unseen stimulus, long lesson | 87 of 90 (96.7%, 91 to 99%) | 87 of 90 (96.7%, 91 to 99%) |
| H2 kernel-clean solved files | 267 of 267 | 267 of 267 (kernel 4d433af) |
| H3 short against long lesson | 86 against 87 | 87 against 87 |
| H4 runs without and with memory, tasks solved both ways | 4,109 to 1,018, p = 2.9e-12; cheaper 60, equal 23, dearer 4; 87 against 87 correct | 4,270 to 1,018, p = 2.9e-12; cheaper 60, equal 23, dearer 4; 87 against 87 correct |
| H5 controls solved and correct | 1 of 18 | 1 of 18 |
| Wall time | 501 s (4 workers) | 875 s (3 workers, shared machine); the old-simulator re-run took 1,071 s the same way |

All five hypotheses pass as before. What start-on-press now finds:
- Long lesson, no memory: still 6 of 6 correct. Seeds 4, 5, 8, 9 are `TouchSensor.isActive -> TimeSensor.loop` and `TimeSensor.cycleTime -> TimeSensor2.startTime` (the `cycleTime` variant the original README already named). Seeds 6 and 7 use `TimeTrigger.triggerTime -> startTime`. Seed 4 now costs 262 runs, was 101; seeds 5 to 9: 112, 160, 142, 83, 83, unchanged from before.
- Short lesson: 6 of 6 correct and held out (was 5 of 6: the look-alike start-on-press-5 is gone). All six cost more: 434, 434, 204, 155, 179, 260 runs against 91, 91, 91, 81, 91, 91, because the cheap wiring is refused.
- With memory: unchanged, 6 runs each, all through `triggerTime`.
- No solution in the new run uses `elapsedTime -> startTime` (0 of 271 files, against 7 before).

## Q3. The browser court on the new solutions

Same pair selection as the first court (first two solved tasks per clicked family; 18 solutions, 3 controls). `court.json`: 12 of 18 solutions agree at the strict 1% threshold (15 of 18 before); 0 of 3 controls agree (0 of 3 before); the look-alike pair no longer exists, because the short-lesson start-on-press-5 now is correct.

start-on-press-4: 0.17% outside (was 38.5%). Second replay 0.0% (was 27.6%); the reference against itself 0.0% (was 0.7%). With the strict threshold it agrees, in the sampled replay (`court.json`); a further full-family replay (`court-start-on-press.json`) read 2.5% (long) and 1.1% (short) because the machine was busier.

The drop from 15 to 12 is not the fix. The six that fail are slide-4, glow-5, turn-5, two-targets-4, two-targets-5 and start-on-press-5. For slide-4, glow-5, turn-5, two-targets-4 and two-targets-5 the solution file is byte-identical to the one that agreed (or was noise) before; only the machine's load had changed. The noise floor (`court_noise.py`, now with an option for the results folder and the task list; `court-noise.json`, `court-noise-sop6-9.json`) measured on the same load:

| Task | First replay, outside | Reference against itself | Second replay of the solution |
|---|---|---|---|
| slide-4 | 1.8% | 4.4% | 5.2% |
| glow-5 | 8.9% | 0.0% | 2.2% |
| turn-5 | 1.0% | 0.6% | 0.8% |
| two-targets-4 | 1.1% | 1.5% | 2.6% |
| two-targets-5 | 2.9% | 3.4% | 3.7% |
| start-on-press-4 | 0.2% | 0.0% | 0.0% |
| start-on-press-5 | 5.0% | 3.4% | 1.4% |
| start-on-press-6 / 7 / 8 / 9 | (full family, long) 1.4 / 1.1 / 2.3 / 2.2% | 1.6 / 1.1 / 2.3 / 2.6% | 2.0 / 1.1 / 5.5 / 1.0% |

On this load the court's own noise runs up to 5.5% (the first court measured 0.7 to 2%). By the method of the first court (a disagreement counts as real only when it is repeated and clearly above the reference against itself), 0 of 18 solutions disagree with X_ITE now, against 1 of 18 before (L: the strict count is 6 of 18, and every one of those 6 sits inside the noise measured the same day; the machine was shared, so the strict threshold is not a clean instrument today). I did not tune the threshold, and I did not repeat the court on a quiet machine.

Same method on the old solutions of the whole start-on-press family (`court-start-on-press-old-sim-solutions.json`, same day, same load): the seven `elapsedTime` solutions read 23.5% and 19.9% (seed 4 long, short), 38.2% (5 short), 10.9% (6 short), 6.5% (7 short), 15.4% (8 short) and 16.1% (9 short). Their long-lesson `cycleTime` solutions for 5 to 9 read 2.3 to 4.7%, inside the noise. So the hole was wider than the one solution the first court found: all seven solutions built on it differ from the reference in X_ITE by more than the noise, at least five by more than 10% (C for the readings; L for calling 6.5% real).

## Q4. Did the fix change any other task's outcome?

No. Compared record by record (`solved`, `heldout`, runs, nodes, routes, in all three arms, 108 test tasks) the only differences are the six start-on-press tasks and one cell: short-lesson start-on-press-5 went from solved-but-wrong to solved-and-correct. Every other family, the learning batch (10,482 runs alone, 9,045 with memory, both runs), the memory (14 shapes) and the three node-editor worlds are identical: door 65 and 8 runs, counter 44 and 44, snake missed (C). Of the 271 solution files (267 test files plus 4 for the door and counter worlds), exactly 7 differ byte for byte between the two runs: the 7 that used `elapsedTime -> startTime`. Nothing that was solved is now missed, and nothing that was missed is now solved.

## Not run
- The court on a quiet machine, and any repeat of the court on the new solutions beyond the second replays above.
- The court on drag and hover tasks (the gestures are clicks on one object, as before).
- The `warm` (memory) arm in the browser.
- The kernel at `f0bde28`; `4d433af` was used.
- Why X_ITE and the old simulator differed, beyond the fix described in 2.7.5 (not traced here).

## Files
`results.json` (the new run; the same format as `results/results.json`), `results-old-sim-rerun.json` (the old simulator re-run), `court.json`, `court-noise.json`, `court-noise-sop6-9.json`, `court-start-on-press.json` (new solutions, whole family, long and short), `court-start-on-press-old-sim-solutions.json`, four `replay-*.json`, and the start-on-press solution files (`solutions-start-on-press-new/`, and the 7 old `elapsedTime` ones in `solutions-elapsedTime-old-sim/`). The other solution files are rebuilt by `run.py`.
Added to `selfcode/`: `replay_solutions.py`, `court_family.py`, and an optional results-folder and task-list argument for `court_noise.py`. No registered file changed.
