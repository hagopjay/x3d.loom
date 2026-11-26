# Sixteen-agent sprint on the flywheel, 26 Nov 2026

Sixteen agents in two waves of eight, launched at 12:51 PM and 12:55 PM Eastern, one mission each, read-only on the
repositories, scratch folders only, no spend, no pushes. Wave 1 attacked the flywheel as it stood. Wave 2 was planned
from wave 1's results: write the checks the blind test asked for, fix the search, recount the denominators blind, and
say what a pass proves. Each agent's own report is in `reports/`; this page is the collation, and every headline number
on it was rerun or reread by the collator unless marked. Grades: C confirmed by a run or by data read, L likely,
S suspected. An agent's judgement of a file it only read is L at best. Kernel: x3d_mcp at `96e2849`. Simulator and
pair judge: x3d-blender-io at `5537e87`. Browser: X_ITE 16.8.1 (earlier runs only; no browser ran in this sprint).

## The sprint in eight lines

| # | Result | Grade |
|---|---|---|
| 1 | Blind test, behaviour: the kernel caught **11 of 20** faults written by an author who had not read its checks; XSD caught 0 | C |
| 2 | Blind test, structure: **13 of 20** caught, 11 as errors, 6 by XSD; **0 of 5** decoys flagged. Together: 24 of 40 | C |
| 3 | Eight candidate checks for "wired legally, does nothing" now flag all 9 behaviour misses (8 as warnings, 1 as info), with all valid decoys quiet. This is a fix confirmation, not a held-out score | C |
| 4 | The search's failures: two changes rebuilt **6 of 13** failed wild scenes that were 0 of 13 before; a third change (clock reuse) made things worse and was dropped | C |
| 5 | Blind recount of our denominators: a second reader agreed on **26 of 30** glTF codes and **27 of 30** USD rules. Three glTF "stateable" codes are loose analogues | C for the counts, L for the reading |
| 6 | A passing file proves 14 stated things and leaves 5 named holes (`KERNEL-GUARANTEES.md`) | L (read from code, not all run) |
| 7 | The red team's wording objections were right; the headlines are reworded in this change, no number altered | C |
| 8 | Lessons from node-editor recordings do not scale yet: 1 of 8 gallery scenes solved, 0 right on unseen input | C |

## Wave 1 (agents 1 to 8): five results that change the plan

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

### The other three lanes of wave 1

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
- **USD residue (agent 4): the agent's "blocked" was wrong, and the real finding is a disagreement (L).** The agent
  reported that the per-pair data behind "359 fired pairs: 140 both, 117 X3D only, 102 USD only" did not exist. It
  does: the lane that owns it reports the receipt at x3d.nvidia `q12/receipts/join-20261126.json` (commit `d8b2d9d`,
  hash matching ledger row 4). That repository was outside this sprint's reach, so this page has not read it. As
  reported, the receipt splits the 102 USD-only pairs into 44 "export-made" and 58 "x3d-missed?" over 24 scenes (top
  rules: ManifoldChecker 11, SimReady VG.007 11, ValidateTopology 9, VG.014 9, VG.008 6), while the prose in
  `LEARNINGS-flywheel-turn-4.md` attributes about 84 to the Blender leg. The two disagree by about 40 pairs, and the
  58 are the list to read next: they are candidate X3D rules.

## Wave 2 (agents 9 to 16): built from wave 1

1. **Eight candidate checks for the "does nothing" family (agents 9 and 10; `inert-checks/`, 48 unit tests pass,
   C).** Sensor with nothing to sense, sensor disabled and never enabled, clock that can never start, output that goes
   nowhere, Switch index past its children, ROUTE cycle, zero-size sensor, Script with no code, and a loop that does
   not close. Run by the collator on `fault-court-2/`: the nine misses are now flagged (05 at info, the rest as
   warnings) and fault 10 gains a second flag; the three valid decoys and all 25 files of `fault-court-2b/` stay
   quiet. On about 2,660 project scenes the agents count 79 flags from part A and 24 from part B. Of the flags
   they read, most are deliberate probes (41 of 48 for "output goes nowhere"; 14 of 16 for dead sensors), and the true
   finds are model-written scenes: eight doors whose clock never starts, two Proximity sensors with no size, three
   empty Scripts. One false-alarm class was found and exempted (a Switch child named Placeholder that page script
   fills). Two flagged demo scenes (odyssey, hall) are unread. **Not yet in the kernel**: the agents read the first
   flag per file only and did not check overlap with existing checks; that survey is the next kernel turn.
2. **The search's limits, measured (agent 11; `search-limits/`, C from the agent's runs, not rerun here).** On the
   13 failed wild scenes that could be run: 0 rebuilt before; 4 after keeping a large table when it explains at least
   four samples per corner or covers a loop 2.5 times; 6 after adding a between-samples period estimate (bead-xpbd,
   theatre-box, gobbler3, sp-03 cradle, gen1 orrery, sp-11 gimbal). Clock reuse, the change wave 1 expected most
   from, solved nothing new, broke gobbler3 and took one regression scene from 20 runs to 146; it is left out of
   `selfcode.patch`. Still failing: sankey (70 of 75 fields left), gsap-orrery and fall (time-outs; fall's detector
   returns a false exact period of 0.2 s), tinker-meadow, odyssey, mashtots. Gaps: the regression set (12 of 12 kept
   after the first change) was not rerun under the final patch, and it is not the exact first 12 of the 39. The patch
   is a candidate; `selfcode/synth.py` is unchanged.
3. **Blind recount of the denominators (agents 12 and 13; `blind-recount/`, key files written before the compare).**
   glTF: 30 sampled codes, 26 agree. Three of the four disagreements are codes we count as "X3D can state" whose X3D
   counterpart is a loose analogue (MESH_PRIMITIVE_NO_TANGENT_SPACE, ANIMATION_CHANNEL_TARGET_NODE_WEIGHTS_NO_MORPHS,
   NODE_SKIN_NO_SCENE). Scaled up, true counterparts may be nearer 75 than 88 (S: 30 codes, one reader). USD: 30
   sampled rules, 27 agree; one excluded rule (material assignment) is arguably stateable, so the 66 may be a little
   low. Neither recount moves a code across the line by itself; both say the classification needs a second reader
   before the number is quoted outside.
4. **Blind test, structure (agent 14; `fault-court-2b/`, rescored by the collator, C).** 13 of 20, 11 as errors, 6 by
   XSD, 0 of 5 decoys flagged. The seven misses: coordIndex with no terminator, creaseAngle 30, an Extrusion with one
   spine point, the only object fully transparent, a rotation angle of 90, an object 10 million metres away, a
   DirectionalLight pointing nowhere. Four are legal and unwise; two are a number in degrees where radians are meant.
   Whether the other three break the standard was the agent's reading (L).
5. **What a pass proves (agent 15; `KERNEL-GUARANTEES.md`, L).** About 116 named checks: about 57 can fail a file, 38
   warn, 21 inform. Fourteen guarantees are written as sentences a reader can test. Five holes: behaviour that does
   nothing (now with candidate checks), DEF and USE checks that ignore Proto scopes, a profile check that passes
   unknown tags, file checks that run only when a base folder is given, and route checks that skip IMPORT names. The
   proposed sentence: the Loom is "a deterministic, versioned, rerunnable checker that certifies a stated list of
   structural guarantees", with a public ledger of its misses.
6. **Headlines reworded (agent 16; applied in this change to x3d.loom, and offered to x3d_mcp and x3d.docs;
   `headline-patches/`).** "88 of 88" now reads 88 of the 170 Khronos codes, "66 of 66" reads 66 of the 340 USD rules,
   and both say the project did the classifying. "52 of 53" says it is a fix confirmation and names the held-out
   figure (17 to 20 of 25). "No model, no person" says the search made no model calls and that its rules, tasks and
   checks were written by an AI agent. "87 of 90" and "39 of 53" carry their limits in the same cell. No number
   changed.

## What follows

| Do | Why | Size |
|---|---|---|
| Kernel turn: survey the eight candidate checks against existing checks, read every flag, then merge with tests | 9 blind misses, 3 corpus rules and guarantee hole 1 are the same hole | one kernel turn |
| Add `fault-court-2/` and `fault-court-2b/` to `turn.py` as frozen blind benchmarks (40 faults, 8 valid decoys) | the first benchmarks not written by the rule writer; today 24 of 40 | small |
| Degrees-for-radians check (creaseAngle, rotation angle near 30, 45, 90, 180, 360) | 2 blind misses, legal and silent | small, survey first |
| Selfcode turn: apply the two search changes, fix the false 0.2 s period, rerun the full regression set, then run the 401 reserve as the registered test | 6 of 13 so far | one selfcode turn |
| Read the 58 "x3d-missed?" pairs in the Q12 receipt | candidate X3D rules from USD's validators | needs the x3d.nvidia lane |
| Second blind reader for all 170 and 340 classifications | the denominators are ours until then | half a day of agents, or the outside reader |
| Rerun the 13 unjudged browser pairs on a quiet machine with the new judge | 12 of 13 were the machine | 20 minutes of machine |
| `lesson.py`: stop when the recording does not re-simulate | 2 of 8 | small |
| Publish `guarantees.json` with each kernel version, and a pass certificate that names it | so "passed" says what it means | medium |

## Limits of this sprint

Fifteen-minute agents read few files per claim (4 to 8). Counts they ran are C; their readings of intent are L.
The agents share one model family with the rule writer, so "blind" means "had not read the checks", not "independent
author". The two blind benchmarks are now seen: every score on them from here on is a fix confirmation. Agent 4 called
data missing that was only out of its reach; treat any agent's "does not exist" as "not found where I looked". The
sealed test by outside authors is still the experiment that would settle most of the red team's list.
