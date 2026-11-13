# Archive A: recovered teaching assets

These files recover useful material from **mujoco-expert-training-playground.zip**,
the prototype with the larger teaching interface. They are reference assets;
they are not imported into the recovered application's active simulation.

The source archive's SHA-256 is recorded in `model-provenance.json` and both
historical content files. The uploaded archive remains the source of record.

## Recovered files

| File | What it contains | Status |
| --- | --- | --- |
| `models/cartpole_balance.xml` | Rail, cart, hinged pole, motor, sensors | Starter; requires an external controller |
| `models/double_pendulum.xml` | Two nested hinges and capsule links | Starter; corrected anchor height |
| `models/driven_pendulum.xml` | Hinged rod/bob and torque motor | Starter; corrected anchor height; requires a drive signal |
| `models/planar_arm.xml` | Two motorized joints and a home keyframe | Starter; inspect keyframe and implement control |
| `models/drop_test.xml` | Free box, floor, state sensors | Starter; invalid restitution attribute replaced |
| `model-provenance.json` | Original emitted XML, source parameters, exact changes, remaining caveats, recovered hashes | Provenance and review ledger |
| `historical-curriculum.json` | Three modules containing eleven lessons | Historical and unreviewed, with issue metadata |
| `historical-quiz.json` | Five questions, answer keys, and explanations | Historical and unreviewed, with issue metadata |
| `historical-formula-smoke-results.json` | Five legacy-equation execution summaries | A narrow execution check, not MuJoCo validation |

The XML starters are not behavioral equivalents of the old browser demo. The
old demo integrated handwritten equations; it did not run these XML models in
MuJoCo. Original XML is preserved inside the provenance file for comparison.

## Minimal XML corrections

1. **Double pendulum:** moved the anchor from `0 2.1 0` to `0 0 2.1`.
   The floor, gravity, and downward links already use Z as vertical. The
   original anchor placed the downward links below the floor.
2. **Driven pendulum:** moved the mount from `0 1.9 0` to `0 0 1.9` for the
   same reason.
3. **Drop test:** replaced `restitution="0.45"` with `solref="0.02 1"` and
   corrected the explanatory comment. This is an explicit contact baseline,
   **not a conversion preserving a coefficient of restitution of 0.45**.
4. Added a provenance comment to each file.

MuJoCo's [solver parameter documentation](https://mujoco.readthedocs.io/en/stable/modeling.html#solver-parameters)
defines positive `solref` values as time constant and damping ratio. Contact
response still depends on the model and simulation settings and must be
measured rather than inferred from the historical JavaScript bounce rule.

The provenance file records additional limitations. In particular, the
cartpole sensor called `pole_tip` measures a body origin, the arm's home
keyframe needs geometric inspection, and the box's small central touch site
does not enclose its floor-contact surface. These preserved features must be
corrected before those sensor names are used as authoritative observations.

## Actual capabilities versus presentation

Line references below identify files inside the original archive.

| Presented behavior | What the source implements | Evidence |
| --- | --- | --- |
| MuJoCo simulation | Five scene-specific JavaScript dynamics models | `src/lib/physics.ts:64–215`; imported by `src/App.tsx:23–31` |
| MJCF compilation | XML parsing plus extraction of selected scalar parameters | `src/data/models.ts:504–615`; `src/App.tsx:269–279` |
| 2 ms / implicitfast / Newton | Actual tick is 1/240 s, about 4.167 ms; equations use explicit updates | `src/App.tsx:208`; static labels at `src/components/Inspector.tsx:444–446` |
| Compile/reset engine log | Prewritten JSX log text | `src/components/Inspector.tsx:456–460` |
| Fresh learner progress | Two lessons and 240 XP are seeded as defaults | `src/data/learn.ts:324–325` |
| RL training support | An incomplete instructional Gymnasium class outline | `src/data/learn.ts:264–278` |
| Double-pendulum Joint 1 in degrees | Radians returned for that field | `src/data/models.ts:149`; `src/lib/physics.ts:291–293` |

The mathematical demonstrations are executable; they are not prerecorded
animations. They can be useful in an explicitly labeled simplified-model
comparison, but should not be the physics authority for the recovered lab.

## Reusable interface ideas

- **Scene selection:** category filters, search, sorting, saved parameter
  presets, and distinctive scene glyphs from `SceneLibrary.tsx`.
- **Command palette:** searchable actions and keyboard navigation from
  `CommandPalette.tsx`. Derive its lesson count from content instead of
  preserving the stale label of ten lessons.
- **Learning workspace:** module navigation, lesson detail, linked lab
  exercises, and progress from `Curriculum.tsx`; correct the course text
  before publishing it.
- **Reference and quiz:** searchable code cards and immediate explanatory
  feedback from `Reference.tsx` and `Quiz.tsx`.
- **Editor presentation:** highlighted XML, line numbers, copy/download,
  synchronized scrolling, and keyboard apply from `Inspector.tsx:84–299`.
  Replace the validation and application semantics with a real compiler.
- **Visual language:** olive/lime palette, warm key light, cool fill,
  reference rings, trails, target ghosts, and contact indicators. Drive
  overlays from named model objects and measured state.
- **Small widgets:** tags, keyboard hints, progress rings, sparklines,
  sliders, and scene glyphs from `src/components/ui.tsx`.

These are extraction targets and design references, not assertions that every
accessibility or interaction detail is complete.

## Renderer logic to replace

Recover the art direction separately from the transforms:

- `Viewport.tsx:302–365` constructs a two-link display for both single and
  double pendulums. It scales the lower group and lower cylinder by
  `length2`, effectively applying the length twice. The second angle is
  nested under the first even though the handwritten double-pendulum
  equations use two absolute angles.
- `Viewport.tsx:431,435` changes local X scale on cylinders whose length is
  along local Y. Endpoint placement changes independently from rod length.

A model-driven viewer should render compiled geom sizes and actual engine
poses. This preserves visual clarity while removing disagreement between
the rendered mechanism and the simulated mechanism.

## Content review priorities

The historical JSON preserves the original text, including its errors, and
attaches review metadata. Confirmed examples include a claim of 50 Hz control
with 4 ms actions (50 Hz requires 20 ms), an incomplete Gymnasium environment,
and prefilled learning progress. Other flagged claims concern `mjData` reuse,
model mutability, sensor evaluation stages, the split-step pipeline,
`implicitfast`, and actuator-force/transmission terminology.

Treat these assets as a course outline to edit, not a reviewed training
manual. A productive lesson pattern is **predict → change one parameter →
observe → measure → explain**, using an actual compiled model and recorded
telemetry for the experiment.

## Validation scope

The extraction pass loaded the legacy equations directly with Node's native
TypeScript stripping, advanced each of the five scenes for 4,800 ticks at
1/240 s, and checked every numeric field of the resulting state for finiteness.
All five passed that narrow check. Results are in
`historical-formula-smoke-results.json`.

This does not validate the equations' physical fidelity, energy formulas,
render transforms, or exported MJCF. Real MuJoCo compiler/step validation is
performed separately by the recovery application's validation workflow; its
results should be consulted before promoting a starter into the active lab.

No handwritten legacy physics, seeded progress, or unreviewed curriculum is
automatically activated by this extraction.
