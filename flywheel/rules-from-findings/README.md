# From finding to rule: the half turn

The self-coding experiments left three notes about rotation in the failure-mode table (357, 361, 451). A note
is read by people. This folder records turning those notes into **one check the kernel runs on every file**,
and what the check found when it was run on files nobody had looked at for this.

The check is `check_orientation_steps` in the x3d_mcp validator (`docs/ORIENTATION-STEPS.md` there).

## The prediction, and the browser

An OrientationInterpolator turns along the shortest path. So the usual turntable "0, pi, 2 pi" depends on how
pi was rounded. The check predicts the direction of each half from the numbers alone; `spell.cjs` plays the
same eight spellings in X_ITE 16.8.1 (headless Chromium 158, software GL) and reads the angle at four points
of the cycle (`spell-xite.json`).

| Angles written | Predicted | X_ITE |
|---|---|---|
| `0 3.14159 6.28318` | forward, forward | full turn forward |
| `0 3.1416 6.2832` | back, back | full turn, wrong way |
| `0 3.141593 6.283185` | back, forward | rocks |
| `0 3.14159265 6.28318531` | forward, back | rocks |
| `0 3.1415927 6.2831853` | back, forward | rocks |
| `0 6.28319` | still | still |
| `0 4` | 2.28 rad the other way | 2.28 rad the other way |
| `0 2.0944 4.18879 6.28319` | forward | full turn forward |

**8 of 8 as predicted (C, X_ITE 16.8.1).** One engine. `3.14159265` is 3.6e-9 short of pi and a 32-bit float
reads it as past pi, so engines that store floats may turn the fourth row's first half the other way (L,
arithmetic only).

## The survey

`survey.py` ran the check on every distinct `.x3d` in the project's repositories, each at the head of its
default branch on 26 Nov 2026 (`survey.json`): 2,587 scenes, 463 with an OrientationInterpolator.

- **41 of 463 (9%) play differently from how they are written.** 31 more get a note only.
- 25 of 190 scenes written by language models are spins that never turn (0 to 6.28-something in one step),
  and 4 more turn the wrong way or rock. Every one of them passed the kernel before today.
- 4 hand-written platformer levels in this repository have fans that turn the wrong way (3.1416).
- 4 in x3d-blender-io: two deliberate probes, and two gallery demos written with 3.1416 and 3.142.
- 2 Gobbler simulation worlds, 1 archived accrete world kept on purpose, and 1 "repaired" example in an
  older demo.

**Correction, same day.** The first run of this survey reported 136 of 443.
It read a checkout of x3d.accrete that was one commit behind: 97 of those were turntables
the generator fix (x3d.accrete #1, made from failure mode 361) had already regenerated that morning. The numbers here are from every repository at the head of its default branch. A survey
must name the commit of every repository it reads (failure mode 456).

## The rule was wrong first

The first draft reported every step over pi. The survey showed 10 scenes with baked animation among them:
sampled paths wrap their angle (6.28 back to 0.01, pi to minus three quarters of pi, an axis that flips sign
as the angle passes pi) and mean the short way. Those were false alarms. The check now leaves a step alone
when it plays the same way round as a neighbouring step. Without the survey the rule would have shipped with
them (failure mode 454).

## Limits

- One project's files; one family (model-written scenes) makes most of the count. Not a rate for X3D at large.
- The rule was written by an agent in a working session, after the findings were known. This is a fix
  confirmed on old files, not a prediction on sealed ones. "Turns without a person" is still 0.
- A whole turn in one step followed by real motion is not reported (it reads as a wrap).
- Not in `LEDGER.jsonl`: the ledger's benchmarks have no rotation-step fault, so its numbers do not move.

## Rerun

```
node flywheel/rules-from-findings/spell.cjs <x_ite dist dir>
python3 flywheel/rules-from-findings/survey.py <x3d_mcp checkout> <folder of repositories>
```
