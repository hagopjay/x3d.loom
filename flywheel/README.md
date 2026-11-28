# The flywheel, measured

The X3D flywheel is a loop: **measure** what the kernel catches, **read the misses**, **write rules** for them, **measure again**. This folder is where a turn of that loop gets a number and a line in a ledger, so "the flywheel turned" is a count somebody else can rerun, not a story.

- `turn.py`: one command that measures a validator checkout on the fixed benchmarks and appends the result.
- `LEDGER.jsonl`: one JSON line per measured turn (the record).
- `LEDGER.md`: the same, as a table (generated).

```
python3 flywheel/turn.py measure --x3d-mcp ../x3d_mcp --what "what changed since the last entry"
python3 flywheel/turn.py show
python3 flywheel/turn.py measure --x3d-mcp ../x3d_mcp --base <commit> --patch <kit>.patch --what "..."   # a kit not yet merged
```

Needs Python with lxml and a checkout of the x3d_mcp validator. No model is called, nothing is rendered, no GPU.

## Benchmarks

| Name | What it is | Where |
|---|---|---|
| fault-court | The X3D arm of the Fault Court: 60 planted faults (53 stateable in X3D), 10 legal decoys, 1 clean control | `fault-court/` |
| gltf-parity | One failing and one passing scene for each Khronos glTF-Validator code X3D can state (88 of 170) | x3d_mcp `tests/gltf_parity.py` |
| usd-parity | One failing and one passing scene for each rule of OpenUSD's validators, NVIDIA's Omniverse Asset Validator and the SimReady Foundation that X3D can state (66 of 340) | x3d_mcp `tests/usd_parity.py` (from turn 3) |

## The ledger so far

See `LEDGER.md`. Turn 1 is the baseline (x3d_mcp `4d433af`): 39 of 53 faults, 40 of 88 codes. Turn 2 (`f0bde28`): 52 of 53 faults (a fix confirmation by a rule writer who had seen the faults; the held-out figure is the Loom arm, 17 to 20 of 25), 88 of the 170 Khronos glTF-Validator codes (the 88 the project judged X3D can state; the project, not an outside party, classified the other 82), 1 of 10 decoys flagged. Turn 3 (`f0bde28` + kit `x3d_mcp-usd-parity`): the same, plus 66 of the 340 USD rules (the 66 the project judged X3D can state; the project classified the other 274); see `LEARNINGS-flywheel-turn-3.md`. Turn 4 (`9e21c4c` + the `q12-coincident-world` patch) adds fired pairs after a Blender USD export (`--usd-join`, x3d.nVidia `q12/join.py`): real files 359 (140 both, 117 X3D only, 102 USD only); see `LEARNINGS-flywheel-turn-4.md`.

## How to read it honestly

- **Turn 2's Fault Court number is a fix confirmation, not a prediction.** The checks were written by someone who had seen the faults. The only held-out evidence in this repository is still the Fault Court's own Loom arm (17 to 20 of 25, rules written from the other half). A fresh claim needs a new sealed fault list, written by somebody else.
- **The one fault still missed, F03, is not a fault in X3D** (nearDistance -1 means automatic, failure mode 319). The real ceiling is 52 of 52.
- **The flagged decoy, Z04, is counted as a false alarm because the pre-registration says so.** Keys of 0, 5 and 10 are legal in glTF, where they are seconds. In X3D a TimeSensor fraction runs 0 to 1, so that animation never gets past its first key, and the new check says so. See failure mode 326.
- **"88 of 88" means 88 of the 170 Khronos codes, and the project classified the rest.** The 88 are the mistakes the project judged X3D can state; the same applies to 66 of the 340 USD rules. No outside party has checked that classification. 46 more codes guard glTF's byte layout and 21 guard structures X3D's design has no place for; those are a property of the format, not a score. 12 are glTF material features X3D 4.0 cannot express at all, which counts against X3D as a language. Three more wait for the Tangent node of X3D 4.1.
- **Rules by, and model calls.** Every turn so far had its rules written by an agent in a working session with a person present, and the loop itself made 0 model calls. The plan's metric "turns without a person" is still 0.

## What a turn needs next

1. A **sealed** benchmark each turn: a fault list the rule writer has not seen (the plan asks Dr Polys's students or another independent author).
2. A **real-file** benchmark: the false-alarm rate on scenes nobody planted anything in. A first survey of 1,496 X3D scenes from these repositories is in `LEARNINGS-flywheel-turn-2.md`.
3. The **rule writer in the loop**: a model proposes the check from the miss, the kernel accepts it only if the benchmark improves and no decoy or real file is newly flagged. That needs a spend cap from the owner and is not switched on.

## A second loop: selfcode

[`selfcode/`](../selfcode/README.md) closes a smaller loop end to end. The search made no model calls; its rules, tasks and checks were written by an AI agent with the owner present. A search writes X3D behaviour from one demonstration, a simulator runs it, the kernel checks the file, a memory of wiring shapes makes the next batch cheaper, and a browser replays a sample. It is not in `LEDGER.jsonl`, which tracks the validator; its numbers are in `selfcode/results/results.json`. On real scenes nobody wrote for it ([`selfcode/wild/`](../selfcode/wild/README.md), pre-registered) it rebuilt 39 of 53 (47 of the 100 sampled scenes were left out by counted rules, 50 of the 53 tasks are animation only, and two preregistered predictions failed), nearly all of the small ones and few of the large ones, and it has learned two worlds from recordings made in the Blender node editor.

## From finding to rule

[`rules-from-findings/`](rules-from-findings/README.md) is the first time notes from the selfcode loop were turned into a kernel check and run on real files: the half-turn rule, 8 of 8 predictions confirmed in X_ITE, 41 of 463 scenes flagged (a first count of 136 read a stale checkout and is corrected there), 10 false alarms found and removed before it shipped.

## Sprint, 26 Nov 2026

[`sprint-20261126/SPRINT.md`](sprint-20261126/SPRINT.md): sixteen agents in two waves, one question each, fifteen minutes. Two blind benchmarks (`fault-court-2/` behaviour, 11 of 20 caught; `fault-court-2b/` structure, 13 of 20), eight candidate checks for scenes that are wired legally and do nothing, two measured fixes to the search (6 of 13 failed scenes rebuilt), a blind recount of the glTF and USD denominators, a list of what a pass proves (`KERNEL-GUARANTEES.md`), a red-team review of the claims on this page, and the work list that follows.

## Blind court 3 (27 November 2026)

[`court-3/RESULTS.md`](court-3/RESULTS.md): the first held-out score taken with the test sealed before the checker was
frozen. Two blind authors wrote 40 faults, 40 corrected twins and 10 decoys; the plan was pushed before the set was
opened ([`court-3/PREREG.md`](court-3/PREREG.md)). On that one unseen set the old kernel (`ebe969b`) catches 19 of
40 and the new one (`d647a10`, 11 checks written from courts 2 and 2b) catches 25, with none lost and no complaint
from the new checks on the 50 legal files. Of four expectations three held and one failed by one (26 was expected).
Seen sets at the same commit: 37 of 40. The set is now seen and is a regression set from here on.

## Blind court 4 (28 November 2026)

[`court-4/RESULTS.md`](court-4/RESULTS.md): the second sealed test, one turn later. Two new blind authors wrote 40
faults, 40 corrected twins and 10 decoys; the plan and the frozen kernel were pushed before the set was opened
([`court-4/PREREG.md`](court-4/PREREG.md)). On that unseen set the old kernel (`ca0e75c`) catches 19 of 40 and the
new one (`c185673`, 20 checks for scenes that are legal and play wrong) catches 23, with none lost and no warning
or error on the 50 legal files. The target was 30 and was missed. A second reader marked 19 of the 40 faults as
repeats of court 3: the new kernel names 18 of those and 5 of the 21 that are new (the old one 16 and 3). Of five
expectations four held. The set is now seen and is a regression set from here on. The next court should give its
authors the list of mistakes already planted and take its headline from new mistakes only.

## Blind court 5: the standing plan (28 November 2026, no result yet)

[`court-5/PLAN.md`](court-5/PLAN.md) is the plan for the next sealed test and the scaffold to run it. It changes
five things, in this order: the headline is taken from new mistakes only (authors get the 120 mistakes already
planted and may repeat none); new rules are written from a grid of 6,434 places where the X3D 4.0 object model
says a mistake can occur, and each new check is labelled by where it came from; a scene may state its intent in
lines a headless play test checks, scored as a separate arm; a catch must be proven against the corrected twin by
machine; and a slot is kept for a set written by a stranger. It lists twelve tricks the court may not use. Every
script has been run on a dummy set (`court-5/dry-run/run.sh`). Nothing is sealed, nothing is frozen, and there is
no court 5 score.
