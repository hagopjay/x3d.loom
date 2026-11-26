# Learnings: the self-coding loop (26 Nov 2026)

The owner's ask: prove the thesis "with science and maths and visualizations", fold what is learned back into the Loom, and note that the Blender node editor is fully programmable so "Gobbler can code itself". This is what was built and measured. Grades: C = run and counted; L = likely; S = suspected.

Instruments: x3d-blender-io `e783aa1` (`behaviour_graph.py`, `behaviour_sim.py`, `behaviour_catalogue.py`); x3d_mcp fork `f0bde28` (X3D 4.0 XSD, semantic checks, scene to RDF); Khronos glTF-Validator 2.0.0-dev.3.10; X_ITE 16.8.1 in headless Chromium. Everything is in [`selfcode/`](selfcode/README.md).

## Numbers

| Measure | Value | Grade |
|---|---|---|
| Unseen in-vocabulary tasks solved and correct on an unseen stimulus | 87 of 90 (95% interval 91 to 99%) | C |
| Written files with 0 schema and 0 semantic errors | 267 of 267 | C |
| Search cost with memory, tasks solved both ways | 4,109 to 1,018 simulator runs, Wilcoxon p = 2.9e-12 | C |
| Out-of-vocabulary controls solved and correct | 1 of 18 (a recording, FM 329) | C |
| Test tasks glTF 2.0 core can state | 3 of 108 | C by construction of the tasks |
| Browser replay | 15 of 18 sampled solutions match their reference in X_ITE 16.8.1 at the strict threshold, 2 more are within the court's own replay noise, and 1 is a real disagreement between simulator and browser; 3 of 3 mismatched controls were told apart | C on the sample |
| Model calls, people in the loop | 0, 0 | C |

## What was learned

1. **A typed, executable scene language can be written by search alone (C on these tasks).** The X3DUOM catalogue gives every field a type and an access mode; the simulator gives every graph a meaning. Type checking removed 67% of the extensions on offer before a single run. This is the thesis from the author's side: what makes X3D checkable also makes it writable.
2. **Solve the numbers, search the wiring (C).** Interpolator tables were never searched. For each candidate wiring the table is fitted from the fraction stream and the demonstration, then verified by one run. Shapes that are remembered hold wiring only, which is why they transfer to worlds with other times and values.
3. **Causality is a cheap prune (C).** A stream whose first event comes after the target first changes cannot be the cause. 940 streams were refused this way.
4. **A recording can pass for a rule (FM 329, C).** The key cap must scale with the length of the motion, and the judge should sample finer than the learner.
5. **One demonstration underdetermines the program (FM 330, C).** Design the lesson to separate look-alikes, and keep an unseen stimulus as the judge. The equivalence signature must cover every lesson (FM 331).
6. **Memory is not free (FM 332, C).** A remembered shape must be cheap to refuse: by type from the catalogue with no run, then by whether its first event is present at each onset of change.
7. **Access type is not the whole story (FM 333, C).** `BooleanToggle.toggle` is inputOutput and is the node's output. Read outputs from what a node sends.
8. **Budgets need shares (FM 334).** One hard field must not starve the rest. Cause C; the fix is L because it was measured after the test data was seen.
9. **Prefer sensors as causes (FM 335, C).** Chains that start from another driven field are valid X3D and often convoluted.
10. **The four layers hold on one file (C).** A glTF payload passes the Khronos validator, the X3D around it passes the kernel, the RDF answers a causal question in one SPARQL query, and a browser agrees with the simulator. Two tooling traps on the way: FM 336 (SPARQL scoping) and FM 337 (relative URLs in a replay server).
11. **A search finds the holes in its judge (FM 338, C).** One solution starts a timer by routing `isActive` into `TimeSensor.loop` and `elapsedTime` into a second timer's `startTime`. The simulator calls it equivalent to the reference on every stimulus; X_ITE 16.8.1 does not (28 to 39% of samples differ, against 0.7% for the reference replayed against itself). An optimiser pointed at a simulator will exploit whatever the simulator gets wrong, so a sample of every batch has to go to a second, independent engine. This is a defect report for the simulator, not only a caveat.
12. **A court needs its own noise floor (FM 339, C).** Two browser disagreements of 1.8% and 7.8% looked like failures until the reference was replayed against itself: 1.6% and 2.0%. Measure the judge on identical inputs before reading its verdicts.
13. **The X3dToTurtle rules write the 4.1 ontology namespace** (`X3dOntology4.1#`) for a 4.0 document. Queries must use the namespace the converter writes (C).

## Not done

- A sealed task list by another author.
- A language-model arm: does a model write these faster, and does the kernel catch its mistakes? Needs a spend cap.
- Turning remembered shapes into Loom rules that an agent reads.
- Proximity, key and string sensors, sequencers, scripts, chasers: outside the vocabulary.

## After the simulator fix (x3d-blender-io 2.7.5, 26 Nov 2026)

The hole of item 11 was fixed in the add-on (a non-looping timer started with a startTime in the past). The search was run again against the fixed simulator, same code, seeds and budget (`selfcode/results-2.7.5/`, instruments in its README: simulator `91d6ad3`, X_ITE 16.8.1, kernel `4d433af`).

1. **The fix closes the hole the search found (C).** Replayed through the fixed simulator, the old start-on-press-4 solution no longer equals its reference, on the lesson or on the unseen stimulus. So do the other six solutions built on `elapsedTime -> startTime` (the short-lesson start-on-press-5 to 9, and start-on-press-4 short): 7 of 267 old files, and no other file changes verdict. The old run was first reproduced exactly with the old simulator, so the comparison is like for like.
2. **The search finds a legal route round it (C).** Against the fixed simulator the headline is unchanged: H1 87 of 90, H2 267 of 267, H3 87 against 87 (was 86), H4 4,270 to 1,018 runs (p = 2.9e-12), H5 1 of 18. The long lesson now writes `isActive -> loop` plus `cycleTime -> startTime`, or a TimeTrigger. Start-on-press-4 costs 262 runs where it cost 101; the short lesson costs 155 to 434 where it cost 81 to 91, and no longer lets the look-alike through. No other task changed outcome or cost.
3. **The browser agrees now (C for the number, L for the reading).** Start-on-press-4: 0.2% of samples outside in X_ITE, was 38.5%; the 7 old solutions read 6.5 to 38% on the same day, the new ones 0.2 to 5.0%. At the strict 1% threshold 12 of 18 sampled solutions agree (15 before), but the noise floor on a shared machine that day was up to 5.5% (reference against itself, same file, 4.4% for slide-4), and the 6 strict failures are the same size as that noise. Read by the first court's method, 0 of 18 now differ in a repeatable way, against 1 before.
4. **Measure the instrument on the day (C).** The court's own noise moved from 0.7 to 2% to up to 5.5% with machine load alone. A threshold fixed once is only valid at the load it was set at; a court should re-measure its floor in the same session as its verdicts (extends FM 339).
5. **The hole was wider than the one solution (C).** The first court sampled one pair and found it. All seven solutions on that wiring differ from their reference in X_ITE at the same day's load (10.9 to 38.2% for six; 6.5% for start-on-press-7 short, inside twice the noise, L).

Not done: a court on a quiet machine, drag and hover tasks in the browser, the memory arm in the browser, the kernel at its original revision.

## The wild set and lessons from recordings (26 Nov 2026, later)

Instruments: x3d-blender-io `3e3c1e8` (simulator), x3d_mcp `f0bde28` (kernel). Registration `selfcode/wild/PREREG.md` at `31461d5`. Full table in [`selfcode/wild/README.md`](selfcode/wild/README.md).

1. **The search works outside its own test, on small animated scenes (C).** 656 real scenes in the project's repositories qualify (a ROUTE, no Script, only simulated nodes). On a hash-chosen test sample of 100, 47 were left out for stated reasons, 53 became tasks, and 39 (74%, interval 60 to 84%) were rebuilt from one demonstration and agreed with the original on input the search never saw. None added a kernel error. Median cost 4 simulator runs.
2. **Size is the wall (C).** 31 of 32 at 1-3 behaviour nodes, 4 of 8 at 4-10, 2 of 11 at 11 or more. Generated scenes with 75 to 400 animated fields are out of reach of 400 runs.
3. **The wild corpus is animation, not interaction (C).** 50 of 53 tasks had nothing to poke. A wild set is only a test of what is in it; the claim about buttons and toggles still rests on the synthetic set (FM 362).
4. **Two registered predictions failed (C).** Large scenes: 18% against "at most 15%". Memory: 33% fewer runs against "within 10%" (3 cheaper, 3 dearer, 33 equal, p = 0.17). Reported as failed, not re-read.
5. **Six decimals reversed a half turn (C in the simulator, browser not checked).** The graph writer printed a key of 3.14159265 as 3.141593, which is past pi, and shortest-path slerp then ran the other way on every sample. Eleven of eleven turntables in the development split failed for that alone and passed once numbers were written in full (FM 357). Sent to the node editor thread, which is moving the writer to shortest round-trip text.
6. **A two-turn lesson teaches a recording, not a rule (C).** The period detector wants the period three times over. With lessons of 2.2 turns the search fitted one long table to the lesson, "solved" 12 worlds and failed 11 of them when watched longer. At 3.5 turns the same worlds pass (FM 358).
7. **An exception is not a reason (C).** The first run filed 21 of 60 scenes under "cannot be read". They had been solved; the marking code assumed two objects to poke and raised. Left-out counts are now split by named reason, and an exception has its own row (FM 360).
8. **A half-turn table does not make a full turn (L: simulator; browser not checked).** Keys 0, pi, 2 pi send the second half back the short way, so the "turntables" in x3d.accrete static-world rock instead of turning. The search rebuilt the rocking faithfully. A full turn needs steps shorter than pi (FM 361).
9. **A recording from the editor is enough of a lesson (C, two worlds).** `selfcode/lesson.py` reads an `x3d.activity/1` file from x3d-blender-io's recorder, hides every node, ROUTE and inner delivery, and shows the search only the pointer calls and what landed on stage fields. Door: rebuilt in 60 runs, same three nodes as the original. Counter (ripple carry): 664 runs. Both agree with the original on an unseen stimulus. Recordings are in `selfcode/demonstration/`.
10. **One press hides a bug that two presses cover (C).** The door recording has a single press. The timer-length reader began counting bursts at the second one, so the true length (3 s) was never offered and 1,000 runs found nothing. Fixed behind a switch so the registered run is unchanged: 36 of 36 registered tasks re-checked give identical verdicts and run counts (FM 359).
11. **Sensors with no named parent cannot be poked (C for the count).** 8 of 100 real scenes put a TouchSensor at the Scene root or under an unnamed group. That is valid X3D (it senses its siblings); the simulator has no handle for it (FM 363).

Not done: the 401 reserve scenes; a browser court on the wild solutions; the public Web3D example archive as an independent corpus; any scene with a Script.

## The wild set in a browser (26 Nov 2026, x3d-blender-io 2.7.7 at `8f3fc54`, X_ITE 16.8.1)

Full account in [`selfcode/wild/COURT.md`](selfcode/wild/COURT.md). Expectations were written before each run; both runs failed them.

1. **A loop's phase is the wall clock's (C).** In X_ITE a looping TimeSensor with startTime 0 starts its cycles on whole multiples of cycleInterval since 1970, as the standard's formula says. Replays ten seconds apart are at different points of the loop, and two loops of different length have no fixed relation at load. The simulator starts every loop at 0, which is one legal instant out of many (FM 379).
2. **A judge that cannot line two runs up calls everything the same (C).** With a 6 s watch of 30 to 50 s loops, a file disagreed with itself on every sample, the floor was 1.0, and three planted controls passed as "same". A floor near 1 means blind, and the verdict for blind is "unclear" (FM 380).
3. **Start both files at the same moment (C).** Two browsers launched together share the clock, so equal loops are in equal phase with no alignment step. The floor on the turntables fell from 1.0 to 0.0 and original against written agreed to 0.004 rad.
4. **One rotation, two spellings (C).** X_ITE reported `0 1 0 6.17` from one file and `0 -1 0 0.11` from the other for the same rotation; number by number they are 6.2 apart, as rotations 0.04 rad, which is the noise. Compare rotations as rotations (FM 381).
5. **A control has to differ where you look (C).** The six-decimal half turn reverses only the first half of the loop. At a random 6 s watch 1 of 3 controls was caught; started in the first half 3 of 3 differ on every sample, in the second half 0 of 3. Check a control's reach before trusting a run that used it (FM 382).
6. **Failure mode 357 is real in a browser, on real scenes (C).** Three accrete turntables with the half-turn key printed to six decimals turn the other way in X_ITE, up to 3.14 rad from the original.
7. **What the court says about the wild result (C on the sample).** Of the first 12 rebuilt scenes, none was seen to differ from its original in X_ITE; 9 were "same" as run, a tenth after a reader fix, 2 unclear (one flickers faster than the browser draws, one needs a click). 27 rebuilt scenes were not sent, and slow loops were watched for a fifth of a turn.
8. **Lessons from recordings still hold on 2.7.7 (C).** With the recording naming the object that was hit, the loader needs nothing from the world but the bare scene; door 60 runs, counter 664, both right on unseen input. The registered experiment is unchanged on the new simulator and writer (36 of 36 tasks identical).

### All 39 in the browser (run 3, x3d-blender-io 2.7.8 at `09a7a99`)

9. **25 of 39 rebuilt scenes behave the same in X_ITE over a whole loop; 1 differs; 13 could not be judged (C).** The expectation (30 same, none differs) failed. The 3 planted errors were all caught, about 3.14 rad off.
10. **The one difference is a rule the simulator's tolerance let through (C).** A model-written "spin" with keys 0 and 6.28319 moves 0.000005 rad; the search matched that stillness with the wrong clock, inside 0.001. A task that moves less than the tolerance is not a task (FM 451).
11. **Load is part of the instrument (C).** At load 7 on 4 cores, 9 short fast scenes read unclear or blind (FM 452).

## From finding to rule: the half turn (26 Nov 2026, later still)

12. **Three notes became one kernel check, and the check found 41 scenes (C).** Failure modes 357, 361 and 451 are now `check_orientation_steps` in x3d_mcp. Its predictions for eight spellings of "0, pi, 2 pi" matched X_ITE 16.8.1 eight times of eight. On 2,587 project scenes, 41 of the 463 with an OrientationInterpolator play differently from how they are written (FM 453, 455). The first count, 136 of 443, read an x3d.accrete checkout one commit behind and included 97 turntables already fixed that morning (FM 456). See `flywheel/rules-from-findings/`.
13. **The spelling of pi picks the direction (C).** 3.14159 is under pi and goes forward; 3.1416 and 3.141593 are over and go back; 3.14159265 followed by 6.28318531 goes forward then back.
14. **A rule needs a survey before it ships (C).** The first draft flagged 10 baked animations whose wrapped angles are correct (FM 454).
