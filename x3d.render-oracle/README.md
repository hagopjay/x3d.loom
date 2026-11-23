# x3d.render-oracle: cross-engine differential rendering

Frontier `cross-render` (Loom Frontier Board 2026-11-23, rank 2). One fixed rig, many engines, one differ, with known-bad controls so the differ is *shown* to catch a defect. Step 1: the 29 x3d.wgpu conformance scenes in **3 engines**. Next: widen to six (Babylon, Castle, Blender).

## Rig (named beside every claim)
| item | value |
|---|---|
| canvas | 128 x 128, scene's own `Viewpoint`, headlight as authored, tone mapping off |
| X_ITE | 16.6.0 (the three.js bridge's pin; the held-out record below is 16.7.1) |
| three.js bridge | `x3d.threejs/bridge` body at x3d.loom `3ebed01`, three r187 |
| x3d.wgpu | `x3d-view 0.5.1`, x3d.wgpu `86f39bd`, wgpu on SwiftShader Vulkan (no GPU in this container) |
| browser | Chromium 157.0.8103.78, ANGLE on SwiftShader Vulkan |
| scenes | `x3d.wgpu/conformance/scenes/*.x3d`, 29 files (the "30" in expected.json is 29 scenes + 1 background probe) |

## Judges (pre-registered in `tools/oracle.py`, thresholds never tuned after)
* **Primary**: MAE on object pixels, 0-255. AGREE <= 2.0, NEAR <= 8.0, FAR > 8.0. (v1 scored the whole frame; the control run showed it hides defects on white furnace backgrounds, so v2 scores object pixels with the same thresholds.)
* Secondary: foreground IoU, centre 5x5 delta, PSNR, share of pixels off by > 8. FLIP is not installed here; not claimed.
* **Held out**: each engine's centre pixel against the X_ITE 16.7.1 / SwiftShader record in `x3d.wgpu/conformance/expected.json` (`x3d.loom@9a73e44 xite-furnace-colour.json`). Never used to set a threshold.

## Result 1: the matrix (29 scenes, Confirmed: measured here)
| pair | AGREE | NEAR | FAR |
|---|--:|--:|--:|
| X_ITE vs x3d.wgpu | 10 | 19 | **0** |
| X_ITE vs three.js bridge | 2 | 6 | **21** |
| three.js bridge vs x3d.wgpu | 8 | 0 | **21** |

Full table: `results/2026-11-23-conformance29/matrix.md`; pictures: `sheet.png`.

## Result 2: the 5 largest gaps (three.js bridge vs X_ITE; same five against wgpu)
All five are one cause. Ties at 250.6 mean the picture is all-or-nothing:
| scene | MAE | X_ITE centre px | three.js | x3d.wgpu |
|---|--:|---|---|---|
| furnace_m0_r1_c1 (and 5 more `furnace_m1_*_c1`, same numbers) | 250.6 | 255 | 0 | 255 |
| furnace_m0_r0_c0.5 | 192.6 | 189 | 0 | 191 |
| furnace_m0_r0.5_c0.5 | 189.2 | 189 | 0 | 190 |
| half_m0_r0_c0.5 | 141.1 | 138 | 0 | 140 |
| ctrl_intensity05_m0_r1_c0.5 (and half_m0_r1_c0.5) | 135.7 | 137 | 0 | 138 |

**Cause (Likely, not yet fixed): the three.js bridge draws no `EnvironmentLight`.** Every scene whose only light is an environment renders black. `exp2_c_physical_default` (no light, PhysicalMaterial) is the same class: three.js 128 vs X_ITE 186 vs wgpu 188 (MAE 56.5). This is the already-listed gap "X_ITE lights PhysicalMaterial with a default environment glow that three.js has no counterpart for", now measured as 21 of 29 scenes.

**The only gap between two engines that both draw the scene: X_ITE vs x3d.wgpu, max MAE 3.87** (`furnace_m0_r0_c0.5`, IoU 0.982), 0 FAR. wgpu runs 1 to 2 grey levels brighter in the centre (188 vs 186, 190 vs 189): small, systematic, on the rim as well (`top5_wgpu_vs_xite.png`).

## Result 3: the held-out judge agrees
| engine | rows within the record's tolerance (centre px vs X_ITE 16.7.1) |
|---|--:|
| X_ITE 16.6.0 (this rig) | 29 / 29 |
| x3d.wgpu | 29 / 29 |
| three.js bridge | 8 / 29 (21 outside) |

So the rig reproduces the earlier X_ITE record, and the three.js gap does not come from the differ.

## Result 4: the differ catches planted defects (and where it cannot)
Planted on all 29 X_ITE pictures (`oracle.json: controls`), plus real scene mutants rendered by each engine (`scene_controls.json`).
| control | observable on | caught | median MAE |
|---|--:|--:|--:|
| brightness +4 | 29 | **29** | 4.0 |
| brightness +12 | 29 | **29** | 12.0 |
| shift 1 px | 29 | **29** | 8.2 |
| shift 3 px | 29 | **29** | 23.9 |
| gain x1.10 | 29 | 3 | 0.44 |
| flip vertical | 29 | 0 | 1.18 |
| swap R and B | 0 (scenes are grey) | n/a | 0 |
| noise sd 1 (must pass) | 29 | 0 flagged (correct) | 0.40 |

* Real scene mutants (radius 1.2 to 1.3, sphere to box): caught in 18 of 18 engine runs (MAE 10 to 58) and 20 of 21 observable mutant runs overall. A colour cast (baseColor to 1 0.85 0.85) on `half_m1_r0.5_c1`: caught by X_ITE (9.4) and x3d.wgpu (11.5), **missed by the three.js bridge** (black either way). On the two `exp2` scenes the cast never reaches the picture (0.0 in every engine), so those 6 runs are unobservable and excluded.
* **Blind spots, Confirmed**: a 10% gain error on dark objects and a vertical flip of a symmetric sphere pass as AGREE. These scenes are uniform spheres, so the differ cannot see orientation or colour-channel mistakes; the next scene set needs asymmetric, coloured, lit objects.
* three.js is blind to material changes under no environment (it draws black either way): that is the engine gap, not the differ.
* Determinism: two full runs per engine, max MAE 0.000 in all three engines.

## Limits (say them before anyone else does)
* The 29 scenes collapse to **10 distinct X_ITE pictures, 10 wgpu, 2 three.js**: they are furnace probes, built to test one thing. They cannot reveal geometry, texture or light-model differences. Widening the scene set is the next step, not a detail.
* Software rendering only (SwiftShader both sides). No real-GPU claim.
* X_ITE 16.6.0 here vs 16.7.1 in the record: the held-out result is a centre-pixel match, not identical builds.
* One held-out judge exists (the record); a second (FLIP, or a human eye sheet) is open.

## Run it
```sh
(cd ../x3d.threejs/bridge && npm install)            # three, x_ite, playwright pins
(cd ~/x3d.wgpu && cargo build --release -p x3d-render --bin x3d-view)
S=$(ls ~/x3d.wgpu/conformance/scenes/*.x3d)
node tools/render_web.js RUN $S                       # X_ITE + three.js  -> RUN/xite, RUN/three
tools/render_wgpu.sh RUN $S                           # x3d.wgpu          -> RUN/wgpu
python3 tools/oracle.py RUN --repeat RUN2 --expected ~/x3d.wgpu/conformance/expected.json --out OUT
python3 tools/report.py RUN OUT
```
Playwright's own pinned Chromium is not installed here; `render_web.js` falls back to a global `playwright` (NODE_PATH). Vulkan: `VK_ICD_FILENAMES` points at the SwiftShader ICD inside Chromium.
