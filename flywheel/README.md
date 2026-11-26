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

See `LEDGER.md`. Turn 1 is the baseline (x3d_mcp `4d433af`): 39 of 53 faults, 40 of 88 codes. Turn 2 (`f0bde28`): 52 of 53 faults, 88 of 88 codes, 1 of 10 decoys flagged. Turn 3 (`f0bde28` + kit `x3d_mcp-usd-parity`): the same, plus 66 of 66 USD rules X3D can state (of 340); see `LEARNINGS-flywheel-turn-3.md`. Turn 4 (`9e21c4c` + the `q12-coincident-world` patch) adds fired pairs after a Blender USD export (`--usd-join`, x3d.nVidia `q12/join.py`): real files 359 (140 both, 117 X3D only, 102 USD only); see `LEARNINGS-flywheel-turn-4.md`.

## How to read it honestly

- **Turn 2's Fault Court number is a fix confirmation, not a prediction.** The checks were written by someone who had seen all 60 faults. The only held-out evidence in this repository is still the Fault Court's own Loom arm (17 to 20 of 25, rules written from the other half). A fresh claim needs a new sealed fault list, written by somebody else.
- **The one fault still missed, F03, is not a fault in X3D** (nearDistance -1 means automatic, failure mode 319). The real ceiling is 52 of 52.
- **The flagged decoy, Z04, is counted as a false alarm because the pre-registration says so.** Keys of 0, 5 and 10 are legal in glTF, where they are seconds. In X3D a TimeSensor fraction runs 0 to 1, so that animation never gets past its first key, and the new check says so. See failure mode 326.
- **"88 of 88" is over the mistakes X3D can state.** 46 more codes guard glTF's byte layout and 21 guard structures X3D's design has no place for; those are a property of the format, not a score. 12 are glTF material features X3D 4.0 cannot express at all, which counts against X3D as a language. Three more wait for the Tangent node of X3D 4.1.
- **Rules by, and model calls.** Every turn so far had its rules written by an agent in a working session with a person present, and the loop itself made 0 model calls. The plan's metric "turns without a person" is still 0.

## What a turn needs next

1. A **sealed** benchmark each turn: a fault list the rule writer has not seen (the plan asks Dr Polys's students or another independent author).
2. A **real-file** benchmark: the false-alarm rate on scenes nobody planted anything in. A first survey of 1,496 X3D scenes from these repositories is in `LEARNINGS-flywheel-turn-2.md`.
3. The **rule writer in the loop**: a model proposes the check from the miss, the kernel accepts it only if the benchmark improves and no decoy or real file is newly flagged. That needs a spend cap from the owner and is not switched on.

## A second loop: selfcode

[`selfcode/`](../selfcode/README.md) closes a smaller loop end to end with no model and no person: a search writes X3D behaviour from one demonstration, a simulator runs it, the kernel checks the file, a memory of wiring shapes makes the next batch cheaper, and a browser replays a sample. It is not in `LEDGER.jsonl`, which tracks the validator; its numbers are in `selfcode/results/results.json`. On real scenes nobody wrote for it ([`selfcode/wild/`](../selfcode/wild/README.md), pre-registered) it rebuilt 39 of 53, nearly all of the small ones and few of the large ones, and it has learned two worlds from recordings made in the Blender node editor.

## From finding to rule

[`rules-from-findings/`](rules-from-findings/README.md) is the first time notes from the selfcode loop were turned into a kernel check and run on real files: the half-turn rule, 8 of 8 predictions confirmed in X_ITE, 41 of 463 scenes flagged (a first count of 136 read a stale checkout and is corrected there), 10 false alarms found and removed before it shipped.
