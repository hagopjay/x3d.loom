# Agent 13: blind reclassification of 30 sampled USD rules

**Caveat:** I am an AI of the same family as the claimant's rule writer. "Blind" only means I classified from my own knowledge before opening the project's classification (blind.md was written first, not edited). Shared model habits could make us agree for the wrong reasons.

## Method
Classified 30 seeded-random rules (S/D/F/P) from memory, then compared with the KEY and the parity page. The project counts as stateable only its xsd, semantic, new and x3d-4.1 rows (4+20+28+5 = 66); its "fixed" class (X3D's standard fixes the answer) is excluded.

## Binary agreement (stateable vs not): 27 of 30 (90%)

| Rule | Mine | Theirs | Verdict after argument |
|---|---|---|---|
| materials/material-assignment | S (Shape.appearance / Appearance.material absent) | fixed ("unlit white") | **Me.** An X3D author can leave a Shape unmaterialled, as a USD mesh can lack a binding. "Default is defined" also holds for zero-area faces and absolute paths, which the project does check. Would enlarge the denominator. |
| EncapsulationChecker | D | xsd | **Them.** Nested geometry can be written and the schema rejects it. |
| SPL.004 splat-has-orientations | F (4.0) | x3d-4.1 | **Them, with caveat.** GaussianSplats is a 4.1 node; the 5 such rules depend on 4.1, not 4.0. |

Fine-class differences among the 22 both called not-stateable were mostly labels: I said F or D where they said "engine" (DJ.010, RC.008, newton-mimic, newton/mujoco variant sets, mujoco collision) or "policy" (gripper-site-api, SPL.001, EL.001); AV.008 I guessed P, they say design. None move the denominator.

## Is "policy" a fair exclusion?
Partly. COCO labels, hash-object-format and the SR.001 metadata whitelist are ecosystem conventions, so exclusion is fair. But policy is the largest bucket (92 SimReady rules: electrical, connections, equipment profiles). It is fair as "not stateable today", not as "not needed": an accountable format claiming SimReady-style coverage would need an X3D profile for them, which the page itself admits. A few "policy" labels (SPL.001, gripper-site-api) look like features instead.

## Unrecognised
Low confidence on 7 of 30 (DJ.010, EL.001, RP.003, AV.008, AV.010, COCO.001, mujoco-mesh-collision). I truly could not say what AV.008 and AV.010 check; the rest I inferred from names.

## Statistics (n = 30)
Disagreement 3/30 = 10%, Wilson 95% interval about 3.5% to 26%. After argument I back the project on 2 and myself on 1. Of the 22 rules the project excluded, 1 is arguably stateable (4.5%, interval about 1% to 22%), scaling to roughly 12 of 274 (range 2 to 60). If my reading holds, stateable is about 66 + 12 = ~78 (plausible 68 to 126).

## Bias
The project's denominator looks mildly conservative: "fixed" removes at least one statable mistake. The larger issue is framing, not the count: "66 of 66" is true only relative to a denominator the project drew itself.

## Suggested honest headline
"The X3D validator checks 66 of 340 USD validation rules (19%). We estimate about 80 describe mistakes X3D can state, so those are nearly all covered; the other ~260 are USD structure, simulator schemas or ecosystem policy. The classification is the project's own; a 30-rule blind check by an AI of the same family disagreed on 3 (10%)."

Files: agents/13/blind.md and REPORT.md
