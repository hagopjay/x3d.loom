# Intent 1: can someone who never saw the mistake state intent that catches it?

Written and pushed before any intent was written. Nothing here is a result.

## Question

In court 5 the fault's own author wrote the intent lines, knowing the mistake. Rule 4 forbade giving it away and
the second reader found no giveaway, but the author still chose what to assert. This run removes that: a writer
who sees only the corrected scene writes the intent.

## Material

The 76 pairs and 20 decoys of court 5, unchanged (`../court-5/set-a`, `set-b`, `set-c`, `set-s`). They are no longer
unseen by the kernel's editor, but the kernel is not under test here. The kernel's court 5 verdicts are reused as
frozen (`../court-5/results/arm-f/results.json`, `arm-s/results.json`).

## Writers

One blind writer per set. Each receives the twins and decoys of one set with every machine intent line removed and
the one-sentence `intent:prose` kept, `INTENT.md`, `play.mjs` and the engine. No fault, no manifest, no results.
The writer states at most eight assertions per scene and may run the play test on what they were given until every
line holds. A scene whose purpose cannot be stated in this grammar gets an empty file.

## Scoring, fixed now

Three plays of every fault, twin and decoy with X_ITE 16.8.0, 640 by 480.

- **Caught**: at least one assertion fails on the fault in all three plays and every assertion holds on the twin
  in all three plays.
- **False alarm**: a twin or decoy that fails in any play. Reported per file; a pair whose twin fails cannot count
  as caught.
- **Flaky**: any file whose result differs between plays. Counted, never scored as a catch.
- **Headline**: caught, out of the 45 mistakes that repeat no earlier court's mistake and that the frozen kernel
  did not prove (36 in arm F, 9 in arm S). Printed beside the court 5 figure for author-written intent on the
  same 45 (13: 11 in F, 2 in S).
- Also printed: caught out of all 69 new mistakes, by set, by line kind that made the catch, scenes left empty,
  and kernel or play together.

## Known limits, stated before the run

- The prose sentence was written by the fault's author. It says what the scene is for and could steer a writer
  toward the fault. Results are also printed without the scenes where the court 5 reader questioned the intent.
- A writer who records everything the twin does would catch any change. The budget of eight and the rule that
  intent states purpose are the guard; the count of lines used per scene is printed.
- One engine. A fault that X_ITE happens to tolerate plays the same as its twin and cannot be caught.
- Writers are the same model family as the fault authors.

## Forecast

Between 18 and 28 of 45. Behaviour faults most, look faults next (pixels can now speak), structure and data faults
least where nothing visible changes.
