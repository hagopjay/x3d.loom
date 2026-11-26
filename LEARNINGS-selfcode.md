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
