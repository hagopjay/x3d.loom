# Flywheel turn 4 (26 Nov 2026): the USD rulebooks executed after a Blender export, and Newton as a second physics check

Turn 3 mapped all 340 rules of the three USD rulebooks to X3D and answered the 66 that X3D can state, on fixtures. Turn 4 runs the rulebooks on real Blender exports and keeps the one miss it found. The ledger row also has a new column: fired pairs after a Blender USD export (`turn.py measure --usd-join`).

## What was measured
- **Q12 run 2** (x3d.nVidia `q12/`, building on x3d_mcp #33). X3D scenes go into Blender 5.3 through x3d-blender-io 2.7.6 and come out as USD, exported both Z up and Y up. They are then judged by:
  - usd-core 26.11 (30 validators);
  - the Omniverse Asset Validator 1.18.0 (40 rules);
  - **SimReady, executed**: usd-validation-nvidia 1.23.0 and the five tiers from simready-foundation c3bd1d8, 216 rules covering 165 of the 270 pinned requirements.

  The verdicts are joined per rule with x3d_mcp's verdict on the source.
- **Fired pairs.** On 141 real files there are 359: 140 fire on both sides, 117 on X3D only, 102 on USD only. On the 84 fixtures there are 67 (17 / 32 / 18).
- **Up axis.** SimReady UN.006 passes all 225 Z-up exports and fails all 225 Y-up ones.
- **Q13** (x3d.nVidia `newton/`). X3D physics goes through `x3d2usdphysics` into Newton 1.8 on the CPU and faces the PhysX bridge's nine exact references.

  | Engine | References passed |
  |---|---|
  | PhysX 5.12 | 9 of 9 |
  | Newton XPBD | 6 of 9 |
  | Newton MuJoCo 4.0.1 | 6 of 9 |

  The run records pass the loom's physics witness on every gate except `PHYS_REFERENCE_FAIL`. That is the correct verdict for an engine that misses three references.

## What came back to the validator
- **One x3d_mcp miss.** Identical shapes in one world place under different Transforms (SimReady VG.008, on d3-bridge `scatter.x3d`).
- **The fix.** `mesh-coincident` gains a world-place pass (x3d_mcp branch `q12-coincident-world`, fixture `coincident-across`). It was surveyed on 1,538 files before it shipped: the same-parent findings are unchanged at 4 files, and the new pass flags 21 files.
- **The other USD-only pairs belong to the Blender leg:**
  - 38: PointSet and LineSet written as faceless Meshes;
  - 32: non-manifold vertices, Likely made on the Blender leg;
  - 6: PointSet normals of length 0;
  - 8 more: unused points and extents.

  They are filed against the add-on or `EXPECTED_LOSS`, never against x3d_mcp.

## Failure modes 393 to 401 (LOOM-v1.md)
- **393.** A rulebook called unrunnable from its pages ran from its packages.
- **394.** "Not evaluated" and rule crashes are reported at FAILURE severity.
- **395.** The same-parent coincidence miss. A world-place pass needs a survey before it ships, or idioms flood it.
- **396.** Default containerFields. A generator and a writer that matched only explicit fields made an engine "fail" against nothing.
- **397.** Newton's importer drops filter pairs to static colliders. A negative control that removes them must fail.
- **398.** Engine-neutral events: soft contacts turn round over several steps.
- **399.** A median at the sampling resolution returns the frame rate.
- **400.** One trigger, two outcomes. Compare engines on an unambiguous trigger.
- **401.** A fixed-step miss with its substep sweep beside it.

## Not shown
- A GPU.
- Another machine.
- Isaac Sim's schemas.
- A person's review of the rules: the ledger says "agent, not yet reviewed by a person".
