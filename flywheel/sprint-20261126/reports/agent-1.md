# Agent 1: the 13 unjudged pairs (run 3, judge 09a7a99)

Run-wide fact (C): load_1min was 6.2 to 8.0 on every pair (JSON `load.max_1min`); each pair took 61-119 s of wall time for a 3-13 s watch. Frame rate per run: not in data (run 3 judge did not record it). Scene names are x3d.ml/runs/... unless noted; hash prefixes in brackets.

| Scene | Run 3 | Cause | Evidence | What settles it |
|---|---|---|---|---|
| sp-09_a1 [433f] | unclear, blind | load-induced self-disagreement (L) | FlagTransform.rotation outside 0.90, floor 0.89, widest gap 0.078 rad; 2 s cycle, watch 4 s | quiet machine; new per-run fps and "low frame rate" note |
| sp-12_a2 [5c5f] | unclear, blind | load self-disagreement (L) | both Apples streams outside 0.506, floor 0.629, gap 0.0083 | same |
| sp-18_a2 [5e00] | unclear, blind | load self-disagreement plus missing nodes (L) | Pivot1-4 outside 0.59-0.72 vs floor 0.53-0.61; `only_in_one_file` 2; 10 s watch | quiet machine; check the 2 unmatched nodes |
| avalanche live.x3d [610f] | unclear, blind | cannot watch reliably: 16 streams, 15 blind or all-noise (C: JSON) | T_p* outside 1.0, floor 1.0; `only_in_one_file` 74; original_nodes 0; watch 3 s | not settled by judge changes; stage mismatch (74 nodes one side only), quiet machine, longer watch. Original file not found at path (not in data) |
| anim-02_a1 [546b] | unclear | load noise, one stream just over floor (L) | BallTransform.translation outside 0.606, floor 0.451, gap 0.34 value | quiet machine; fps and span notes |
| anim-01 qwen2.5 [5f3c] | unclear | one-sample misalignment, not a real difference (L) | outside 0.0083 (1 of 121), floor 0.0, gap 0.072 rad. Scene: 4 s spin, so 1.571 rad/s x 0.05 s grid step = 0.079 rad | window from recording start; a repeat; floor 0 makes any single outlier unclear |
| asm-02_a1 [6053] | unclear | Planet1Orbit just over floor (L) | outside 0.038 vs floor 0.031, gap 0.098; Planet2, 3 same | quiet machine |
| asm-02_a2 [6239] | unclear | same (L) | Planet1Orbit outside 0.061 vs floor 0.034, gap 0.093 | quiet machine |
| sp-12_a1 [64e6] | unclear | AppleBobber just over floor (L) | outside 0.455 vs floor 0.307, gap 0.0077 (small) | quiet machine |
| sp-16_a1 [5dac] | error | judge reader error (C): "the two simultaneous runs overlapped for 0.00 s: too little to compare" | touch-only scene (TouchSensor, TimeSensor stopTime=1, nothing presses it); watch 6 s | 5537e87: window from recording start, plus "nothing-moved" |
| sp-16_a2 [48e1] | error | same (C) | identical error text | same |
| geo-03_a1 [53a2] | error | same (C); GeoViewpoint plus TouchSensor | identical error text | same |
| marble-minimal [560c] | error | judge cannot watch: "the two files have no ROUTE target in common (same DEF and field): nothing to compare" (C) | original ROUTEs end at MarbleT set_translation/set_rotation (physics); original_nodes 0; seconds 0.0 | not settled by 5537e87; needs judge to read set_translation/set_rotation aliases or a stage written to the same field |

## Count by cause
- Load / noise floor, one stream near floor: 6 (L)
- Load self-disagreement, blind: 3 (L)
- Judge reader error, 0.00 s overlap: 3 (C)
- Cannot watch (avalanche, marble): 2 (C for the error text, L for the reading)
- One-sample misalignment: 1 (L)

No scene shows nothing moving in a watch with a motion cause; "too short a cycle" was not seen (every cycle at least 1.5 s). Cycle against watch: the watch is lesson/3.5+2, under one cycle never occurred (L).

## Top 3 changes
1. Rerun the 3 overlap errors and 9 unclear on 5537e87 on a quiet machine (load under 1 versus 6-8). It settles 9 (the 3 errors via the window fix, 6 via noise) (L). Fps and wall time are then recorded.
2. For touch-only scenes (sp-16, geo-03), use a stimulus that presses the sensor; otherwise "nothing-moved" is the best that new judge returns (L).
3. Fix the judge or stage for the 2 unwatchable cases: marble set_translation versus translation aliasing (judge route matching, behaviour_pair_judge.py near line 594, `common` keys) and avalanche's 74 unmatched nodes (S). Also give a floor of 0 a minimum count (e.g. at least 2 samples) before unclear, line 208 `verdict_of` (S).
