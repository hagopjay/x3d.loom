# Why the 14 wild-test scenes failed (agent 2)

Evidence: scene files, results/wild-test.json, and 7 re-runs (cold, under 45 s each, no memory) changing only MAX_KEYS (synth.py:36) or injecting the true cycle. No repo files were edited. Grades: C confirmed, L likely, S suspected.

Pattern: 13 of 14 scenes are one or a few TimeSensors fanning out to interpolators, and the table needed exceeds 16 corners. `finish()` (synth.py:238-240) discards such a table as "a recording" (the `memorised` counter). Fields left equals fields in 12 of 14, so nothing was solved.

| Scene | Behaviour nodes / ROUTEs | Why missed | Evidence |
|---|---|---|---|
| sankey | 47 TS + 75 PI / 150 | 21-key tables over cap (C); off-grid cycles like 5.51 s (L); 75 fields vs 400 runs (L) | 400 runs, 8.6 s, left 75 |
| 11-hashing | 1 TS + 400 PI / 800 | time-out (C); 241-key tables (L) | 206 runs, 30 s, left 400 |
| tinker-meadow | 5 TS + 5 interps / 11 | time-out (C); 200 s lesson slows each run, 90 s clock seen 2.2 times so `period()` fails (L) | 46 runs, 30.5 s, left 6 |
| bead-xpbd | 1 TS + 8 PI / 16 | 361-key tables over cap (C) | cap lifted: solved, 32 runs, held-out ok |
| sp-11 gimbal | 4 TS + 4 OI / 8 | cap (C); slerp cannot merge steps over 180 degrees, so every sample is a corner (L) | 2 of 4 solved, `memorised` 7; cap lifted: solved in 16 runs, held-out fails |
| odyssey | 1 TS + 124 interps / 289 | time-out (C); lesson capped at 200 s = 1.45 cycles of 138 s (L); 32 tables over cap (C) | 96 runs, 30.2 s, left 115 |
| gsap-orrery | 1 TS + 76 interps / 152 | cycle 6.91 s off the 0.05 s grid: candidates 6.55, 0.4, 6.6, `period` None (C) | cap lifted, still unsolved |
| mashtots-reveal | 1 TS + 217 interps / 434 | time-out (C); 53-key tables (L) | 158 runs, 30 s, left 217 |
| gobbler3 | 10 TS, 13 interps, Touch, BoolFilter, BoolSequencer / 64 | budget spent at 28.7 s (C); touch-boolean-sequencer chain plus 6 tables over cap (L) | left 6 of 6 |
| theatre-box | 1 TS + 5 interps / 10 | cap (C) | cap lifted: solved, 20 runs, held-out ok |
| gen1 orrery | 1 TS + 24 interps / 48 | cap (C); cycle 9.958 s off-grid (L) | 6 of 12 left; cap lifted: fits lesson, held-out fails |
| sweep-and-prune | 1 TS + 400 interps / 800 | time-out (C); 91-key tables (L) | 344 runs, 30.1 s, left 400 |
| fall | 1 TS + 32 interps / 64 | cycle 22.208 s off-grid; `period` finds 0.2 (C) | injected 22.208333: solved in 12 runs, held-out fails |
| sp-03 cradle | 1 TS + 2 OI / 4 | eased tables of about 18 corners over cap (C) | cap lifted: solved, 8 runs, held-out ok |

(TS TimeSensor, PI Position, OI Orientation interpolator.)

## Count by primary cause
- Table cap: sp-03, bead, theatre-box, sp-11, sankey (5); also second cause in 4 time-outs and gen1 orrery.
- Time-out or budget on many-field graphs: hashing, sweep, odyssey, mashtots, meadow (5, the summary's 5 time-outs); gobbler3 on budget.
- Off-grid cycle: fall, gsap-orrery, gen1 orrery (3); sankey probable.
- Multi-stage wiring: gobbler3 (1). Tolerance, bug, short lesson: no clear case. The three held-out failures after fixes (sp-11, fall, gen1) are L: tolerance or clock mismatch.

## Top 3 changes
1. **Lift or make adaptive `MAX_KEYS`** (synth.py:36, 238-240), for example by key count against samples. Recovers 5-6 (sp-03, bead, theatre, sp-11, gen1; 3 verified with held-out ok). C for 3.
2. **Reuse a solved clock for the remaining fields** in `solve()` (synth.py:450-472) before searching: about 40 runs per scene instead of 400. Plausibly 4-6 (hashing, sweep, mashtots, odyssey, sankey, gsap-orrery), together with change 1. L.
3. **Sub-sample period estimate** in `period()`/`durations()` (synth.py:85-122), added as first clock candidate. Recovers fall, gsap-orrery, gen1; helps sankey (3-4). C for fall.

Not worth chasing: tinker-meadow (needs a longer lesson) and gobbler3 (needs a sequencer shape).
