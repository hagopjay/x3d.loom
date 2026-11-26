# Agent 11: three selfcode changes, measured (grade C, all numbers from my runs)

Setup: scratch copy, budget 400, share 100, 30 s per task, cold arm only, rebuilt = solved AND wild.py's `unseen` test passes. "Before" is the recorded wild-test.json cold arm. The 400-field scenes (11-hashing, sweep-and-prune) were skipped. Tinker-meadow was run (its path was found by name). The regression set is the first 12 rebuilt scenes available on disk in file order: the 14 "web/static-world/patches" scenes are not in the checkouts, so it is not the exact first 12 of 39.

## Changes (selfcode/synth.py)
1. `finish()`: a table over 16 corners is kept when corners <= samples/4, or when each fraction is seen on average 2.5 times or more (a loop covered repeatedly). One-key-per-sample tables stay rejected. A plain samples/4 rule alone failed bead-xpbd (234 corners, 841 samples), hence the repeat test.
2. New `period_between()` (scan of lags plus golden-section refinement on a straight-line reading between samples), used in `durations()` only when `period()` finds nothing; it adds the estimate and its 3- and 2-decimal roundings as the first candidates.
3. `solve()`: clock reuse (solved TimeSensor cycles put first in `cands`). Tried, then reverted from the patch (see below).

## The 13 failures I ran (before, after change 1, after change 2 = final patch)
| Scene | before | c1 | c2 | runs (final) |
|---|---|---|---|---|
| sankey | no | no | no (70 of 75 left) | 400 |
| bead-xpbd | no | yes | yes | 32 |
| sp-11 gimbal | no | no (1 of 4 left) | yes | 16 |
| odyssey | no | no (timeout) | not rerun | - |
| gsap-orrery | no | no | no (timeout, 263 runs) | 263 |
| mashtots-reveal | no | no (timeout) | not rerun | - |
| gobbler3 | no | yes | yes (not rerun) | 24 |
| theatre-box | no | yes | yes | 20 |
| gen1 orrery | no | no | yes | 48 |
| fall | no | no | no (timeout, 368 runs) | 368 |
| sp-03 cradle | no | yes | yes | 8 |
| tinker-meadow | no | no | no | 23 (timeout) |
| 11-hashing, sweep | skipped | | | |

Rebuilt: 0 of 13 before, 4 after change 1 (bead, theatre, gobbler3, sp-03), 6 after change 2 (adds gen1 orrery, sp-11). Not rerun after change 2: odyssey, mashtots (timeouts at about 90-100 runs, unchanged logic). Bead, theatre, sp-03, sp-11 held-out passes.

## Regression set
After change 1: 12 of 12 still rebuilt (identical runs). After change 3 on top: 12 of 12 still rebuilt, but 4bb9cf607cd2 went 12 to 52 runs and 4ffcdc9223ff 20 to 146 runs (15.7 s). I did not rerun the regression set after change 2 alone; the final patch has no change 3.

## What did not work
- Change 3 (clock first): no gain on the unsolved scenes (gsap, fall, sankey solved no field first, so there was no clock to reuse) and it broke gobbler3 (timeout at 139 runs) and inflated runs. Cause: a prepended cycle is tried with loop False and True before the specific candidates. A fix would be to try it only for fields whose own candidates fail.
- gsap-orrery: `period_between` gives 6.909675 (true 6.91) but the search still times out at 30 s with 76 fields; fall: `period()` returns a spurious exact 0.2 so the estimate is never used (suppression of short exact periods needed); sankey: 70 of 75 left.
- Tinker-meadow, odyssey, mashtots: still time-outs.

## Remaining
Fix fall's spurious 0.2 s period; make clock reuse cheap; budget per field for 75-217 field scenes; rerun the regression set under the final patch.

Files: agents/11/selfcode.patch (final, changes 1 and 2), selfcode-with-change3.patch, res_c1.jsonl, res_c2.jsonl, res_c3.jsonl, meas.py.
