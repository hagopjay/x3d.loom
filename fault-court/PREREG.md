# Fault Court: pre-registration (T2, with a Loom-learning arm)

Written 26 Nov 2026, **before any checker ran on a faulty file.** The only checker runs before this commit were the three clean controls, used to fix the writers until each format's own checkers reported 0 findings on the clean scene.

## Question

When the same mistakes are written natively into an X3D 4.0, a glTF 2.0 and a USD file, how many does each format's own checking stack catch? And does a Loom step (rules learned from one half of the misses) catch more of the other half?

This is claim **T2** of the X3D flywheel plan, with elements of **T4** (the Loom helps), run without any model calls.

## Materials (all in this folder)

- `court.py`: one small scene (a textured, vertex-coloured cube with normals and UVs, a box, a camera, a translation animation, one metadata number, a declared length unit), written by **three independent writers**, one per format. No file is converted from another.
- `faults.py`: **60 faults** in six format-neutral families of 10, plus **10 decoys** (legal but unusual edits). Each fault gives one edit per format, or marks it:
  - **NE**: the format cannot state this mistake, or
  - **NA**: the edit is legal in that format.
- `checks.py`: each format's own checkers at their strictest.
  - **X3D:** x3d_mcp fork `4d433af` XSD validation plus `semantic_diagnostics` (errors and warnings).
  - **glTF:** Khronos glTF-Validator (npm `gltf-validator`, errors and warnings, external resources resolved).
  - **USD:** usd-core 26.11, `Usd.Stage.Open` plus all 30 registered `UsdValidation` validators (errors and warnings), plus USD runtime errors and warnings printed while loading.
- Clean controls: 0 findings in all three formats (checked before this commit).

## Scoring (fixed now)

- A fault is **caught** in a format when the file fails to load, or when the checkers report at least one error or warning. The clean control reports none, so any finding is new.
- A fault is **missed** when it loads and nothing is reported.
- NE and NA are counted separately and excluded from catch rates.
- A decoy that is flagged is a **false alarm**.
- Secondary measures, reported but not used for verdicts:
  - **where** the catch came from: load or parse, schema, semantic or other validator;
  - **localised**: the message names the element, pointer or prim that was edited.

## Hypotheses and thresholds

- **H1 (accountability).** For each other format F (glTF, USD): on the faults stateable in both X3D and F, X3D's base catch rate is at least **15 percentage points** higher than F's, and an exact McNemar test on the paired outcomes gives **p < 0.05**.
- **H2 (no crying wolf).** X3D's base checkers flag the clean control 0 times and at most **1 of 10** decoys.
- **H3 (the Loom helps; T4-lite).** For each format, rules written from the **learn half** (odd-numbered faults: A01, A03 …) raise the catch rate on the **held-out half** (even-numbered faults) by at least **10 points**, for at least **2 of 3** formats. The rules may add at most 1 false alarm on the decoys per format.
- **H4 (stateability, descriptive).** We count how many of the 60 faults each format can state at all (not NE). No threshold.

**Kill criteria.** If H1 fails for either comparison, we write "T2 is not supported against F". If H3 fails, we write "the Loom step did not transfer in this test". Every outcome is published, whichever way it goes.

## Procedure for the Loom arm (fixed now)

1. Run the base checkers on all 70 cases, but **score and inspect only the learn half and the clean control** first. The held-out half's outcomes are written to a sealed file (`held-base.json`, its sha256 printed), not opened.
2. For each format, write at most **5 rules** (`loom_rules_<format>.py`) from the learn-half misses. Each rule must check a general property, such as "every index is less than the vertex count". A rule must not mention a case id, a planted value or a file name. Rules for each format are written to the same budget by the same author.
3. Commit the rules. Then score the held-out half with base checkers, and with base checkers plus rules. Decoys are scored in both arms.
4. Report per family, per format and per arm.

## Threats, stated before data

- **Author bias.** One author (Claude, for HagopJay) chose the faults and knows X3D's checkers best. The families were fixed to be format-neutral, and every fault's edit for each format is in `faults.py`. Next round: an independent fault list (for example from Dr Polys's students).
- **Small scene.** One scene. These are kinds of mistake, not real-world files.
- **Loom rules by hand.** H3 tests whether rules learned on half the mistakes transfer to the other half. It does not test an automated rule writer, which would need model calls.
- **Validators move.** Every result is tied to the tool versions named above.
