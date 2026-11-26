# Eight-agent sprint on the flywheel, 26 Nov 2026

Eight agents (Claude Sonnet 5.5), launched together at 12:51 PM Eastern, each with one mission, about 15 minutes,
read-only on the repositories, no spend. All eight reported inside 4 minutes of wall time each. Their own reports
are in `reports/`; this page is the collation. Grades: C confirmed by a run or by data read, L likely, S suspected.
An agent's judgement of a file it only read is L at best. Kernel: x3d_mcp at `96e2849`. Simulator and pair judge:
x3d-blender-io at `5537e87`.

## The five results that change the plan

1. **A blind test of the kernel on behaviour faults: 11 of 20 caught, 6 as errors (C).** Agent 8 wrote 20 faults in
   event wiring and 5 decoys *before* reading any check (`fault-court-2/`). The XSD caught none. Two of the eleven
   are caught only by the half-turn rule merged the same morning. The nine misses are one family: **scenes that are
   wired legally and do nothing**: a sensor with nothing to sense, a sensor disabled with no way to enable it, a
   clock that can never start, a sequencer or toggle whose output goes nowhere, a Switch index past its children, a
   ROUTE cycle, a zero-size ProximitySensor, a Script with no code. Both flagged decoys were the agent's own
   mistakes, so the false-alarm count is 0 of 3 valid decoys. Caveat: the author is an agent in the same project.
2. **Why the search fails on larger scenes is mostly one constant (C for 3 scenes).** Agent 2 explained all 14
   unrebuilt wild scenes. Thirteen are one clock fanning out to many interpolators. The search throws away any table
   with more than 16 corners as "a recording" (`synth.py` `MAX_KEYS`): lifting the cap alone rebuilt 3 scenes, right
   on unseen input, in 8 to 32 runs. A loop whose length is not a multiple of the 0.05 s sample step (6.91 s,
   22.208 s) defeats the period detector (C for one scene). Reusing a solved clock for the remaining fields would
   cut 400 runs to about 40 on the many-field scenes (L).
3. **The 13 unjudged browser pairs are mostly the machine, not the scenes (L).** Agent 1: 9 are load (load 6.2 to
   8.0 on every pair), 3 are the judge's zero-overlap error that blender-io `5537e87` has since fixed, and 2 cannot
   be watched at all (no common ROUTE target; 74 unmatched nodes). A rerun on a quiet machine with the new judge is
   the whole remedy for 12 of 13.
4. **Lessons from node-editor recordings do not scale yet (C).** Agent 6 recorded 8 of the 20 gallery scenes (15 to
   54 behaviour nodes) and ran `lesson.py`: 1 solved, 0 right on unseen input. In 2 of 8 the recording did not match
   the lesson's own re-simulation, and the lesson ran anyway. The door and the counter were small; this is the
   honest size limit today.
5. **The red team's strongest points are about wording, and they are right (C: every quote is from our files).**
   Agent 7: "88 of 88" and "66 of 66" hide 88 of 170 and 66 of 340 behind a denominator we chose; the ledger
   headlines a fix confirmation; "no model, no person" is true of the search and false of rule writing; the wild
   headline of 74% is 39 of the 53 that survived exclusion; one browser engine is the referee; and glTF or USD with a
   rule writer could make the same claim. The Lean analogy survives only as: *a deterministic, versioned, rerunnable
   checker with a public ledger of its misses.*

## The other three lanes

- **Next rules of the "legal but plays wrong" kind (agent 3, counts C, judgements L).** Run on 2,589 scenes: a
  looping spin that does not close (21 scenes; 4 true and 3 deliberate of 7 read), a TimeSensor that can never start
  (17; 5 true, 3 deliberate of 8), an interpolator with nothing in or nothing out (44; 4 true, 2 deliberate of 6).
  Dropped after reading: "disabled TimeSensor" (0 true, all driven from page script) and "any loop jump" (120 hits,
  mostly deliberate). Candidates in `rule-candidates/`. These overlap the misses in result 1, from the other side.
- **Warning versus error (agent 5, sample of 600 scenes, C for counts).** 110 already fail on an error; 63 pass
  with warnings only. Proposal: three tiers, with a middle tier "blocks unless waived with a written reason" for the
  three orientation checks, route-never-fires, hanim-joint-name, shape-no-geometry and rotation-axis-not-unit. Upper
  bound 32 of 600 newly failing. It also reports `interpolator-key-unreachable` firing on keys inside 0 to 1 in two
  files (not yet checked by a second reader).
- **USD residue (agent 4): blocked, and the block is a finding (C).** The per-pair data behind "359 fired pairs:
  140 both, 117 X3D only, 102 USD only" is not in x3d_mcp or x3d.loom, only the sentence is. The JSON in x3d_mcp is
  the 84-fixture first run. From the prose, 85 of the 102 USD-only pairs are named and all look made by the Blender
  leg, not by the source scene.

## What follows

| Do | Why | Size |
|---|---|---|
| Write the "does nothing" checks (dead sensor, never-starting clock, output to nowhere, Switch index, ROUTE cycle), survey first | 9 blind misses and 3 corpus rules point at the same hole | one kernel turn |
| Keep `fault-court-2/` frozen as a benchmark and add it to `turn.py` | the first behaviour benchmark not written by the rule writer | small |
| Lift `MAX_KEYS`, sub-sample period, clock reuse; rerun the wild test sample as exploratory, then the 401 reserve as the registered test | 5, 3 and 4 to 6 of 14 scenes | one selfcode turn |
| Rerun the 13 pairs on a quiet machine with the new judge | 12 of 13 | 20 minutes of machine |
| Make `lesson.py` stop when the recording does not re-simulate; mark "unseen: untested" for recordings without calls | 2 of 8, and a false "no" | small |
| Reword the headlines the red team named, in the ledger, parity docs and the self-coding page | accuracy | small |
| Put the Q12 run 2 receipt where the number is cited | the claim cannot be re-split today | small |

## Limits of this sprint

Fifteen-minute agents read few files per claim (4 to 8). Counts they ran are C; their readings of intent are L.
Agents share one model family with the rule writer, so "blind" means "had not read the checks", not "independent
author". The sealed test by outside authors is still the experiment that would settle most of the red team's list.
