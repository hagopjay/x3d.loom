# What the Blender interaction, instancing, HAnim, splat and capture work teaches (18 Nov 2026)

Source: x3d-blender-io (the blenderizer), branch `claude/project-thread-eqjqvi`, PR #46, from a review of the 6-month-old `x3d.adv.technicals.md` note. Grades: **C** = a named tool ran in this work, **L** = read or reasoned, **S** = suspected. Environment of every **C**: Linux x86_64, CPython 3.11, Blender `bpy` wheel 5.2.4 headless, X_ITE 16.7.1 on headless Chromium with SwiftShader (about 0.6 s a frame, so no frame-rate claims).

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A `TimeSensor` with `startTime=0` and `loop=false` fires `fraction_changed = 1` at load**, so a play-once door loads already open. `startTime="1e+30"` never starts it. | C | route demo, X_ITE 16.7.1 | Play-once timers get a never-start time; Eyes must look at the first frame. |
| 2 | **X_ITE picking needs `x_ite.css`.** Without it headless mouse picking never fired. | C | route demo verify script | A pointer test names the stylesheet as part of the rig. |
| 3 | **`matrix_world` is stale for objects not in a view layer** (library collections for instancing). Use `matrix_basis` and `matrix_parent_inverse`. | C | instancing tests (copies were flat before the fix) | Never trust a derived matrix on an object outside the evaluated scene. |
| 4 | **Collection instances emit as one `Group DEF` plus `USE`** per instance; sizes are in the demo receipt. | C | x3d.demo `blender-instancing/v1/receipts/sizes.json` | Size claims name the file, bytes before and after, and the tool. |
| 5 | **Opt-in beats default for anything that renames.** Mapping bones to HAnim joint names by default changed existing output and failed the Z14 conformance suite; it is now gated on `x3d_hanim_names == "standard"`. | C | CI Z14 failure on PR #46; local suite CORE 148/148 after | A new mapping is opt-in until the corpus is re-run (law 8). |
| 6 | **KHR_gaussian_splatting spherical-harmonic attribute names are prefixed** (`KHR_gaussian_splatting:SH_DEGREE_0_COEF_0`); unprefixed names rendered grey in X_ITE. | C | splat glb test plus X_ITE render | Read the extension's attribute grammar, not a similar one. |
| 7 | **Blender can be the training-image source for splats**: `tools/splat_capture.py` writes Fibonacci-sphere views, `transforms_*.json` and a seed `points3d.ply`; 16 views at 96 px and 8 samples rendered in 1.2 s wall, CPU Cycles. | C (renders ran), S (a trainer consuming them: none ran) | smoke run; 5 maths tests | A synthetic capture needs no SfM; the open question is whether a trainer's splats pass the gates below. |
| 8 | **Proximity firing during a live tour is unresolved.** | S | not reproduced in isolation | Do not claim it works until a verify script shows it. |

## Proposed gates (profile `x3d-blender-fidelity/v1`, `kit/profiles/`)

Zero vertex loss, mean delta-E 2000 below 2.0, SSIM above 0.95, taken from the PRD. **No comparator exists in the kit yet**; the profile fixes the contract and refuses acceptance until a project supplies the witness records. Thresholds are unmeasured (L).

## What this does not prove

* No splat trainer ran, so the splat round trip (Blender, images, splats, X3D) is only half closed.
* Interaction results are from software GL; no real-GPU or frame-rate evidence.
* The upstream texture-export patch to projects.blender.org is prepared but held until HagopJay types "send".
