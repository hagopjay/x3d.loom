# x3d.render-oracle: cross-engine differential rendering

Frontier `cross-render` (Loom Frontier Board 2026-11-23, rank 2). One fixed rig, many engines, one differ, with known-bad controls so the differ is *shown* to catch a defect. Step 1: the 29 x3d.wgpu conformance scenes in **3 engines**. Step 2: six engines (Results 6 and 7).

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

**Cause (Confirmed by the fix in Result 5): the three.js bridge drew no `EnvironmentLight`.** Every scene whose only light is an environment renders black. `exp2_c_physical_default` is a different cause (headlight on a PhysicalMaterial, see Result 5).

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

## Result 5: the three.js bridge fixed (same day, same rig; x3d.loom branch of this PR)
The oracle's finding was acted on first, as asked. `EnvironmentLight` is now drawn by the three.js bridge (`src/nodes/EnvironmentLight.js`: the cube map becomes `scene.environment`, intensity is `environmentIntensity`) and a second finding came out of the re-run: **X_ITE curves the indirect light a PhysicalMaterial gets from an EnvironmentLight by 1/2.2 after the material has multiplied it** (white light 0.5 on base colour 1 reads 186 = 255 x 0.5^(1/2.2); on base colour 0.5 it reads 137 = 255 x 0.25^(1/2.2)), and direct lights are not curved (a global curve moved the PhysicalMaterial fixture's foreground mean from 86 to 110 and broke its bounds). The bridge now puts the power on the indirect term only.

| pair | before AGREE / NEAR / FAR | after |
|---|---|---|
| X_ITE vs three.js | 2 / 6 / **21** | 19 / 9 / **1** |
| three.js vs x3d.wgpu | 8 / 0 / **21** | 18 / 10 / **1** |
| X_ITE vs x3d.wgpu | 10 / 19 / 0 | unchanged |

* Held-out record: three.js 8 of 29 rows in tolerance before, **28 of 29** after (X_ITE and wgpu 29 of 29, both times). Determinism: two runs per engine, max MAE 0.000.
* **Remaining FAR, 1 of 29: `exp2_c_physical_default`** (PhysicalMaterial, headlight only, no EnvironmentLight): three.js 128, X_ITE 186, x3d.wgpu 188. The same scene with `headlight="false"` is black in every engine, so the 186 comes from the headlight, not a default environment (Confirmed by the `ctrl_noenv` rows). A default white environment at 0.5 was tried, broke the headlight=false controls (MAE 133 to 181) and the PhysicalMaterial fixture, and was reverted. Cause Suspected: X_ITE curves the headlight on a PhysicalMaterial too, but not an explicit DirectionalLight (fixture). Open.
* The residual 2.4 to 3.2 NEAR rows are rim pixels on the smooth dielectric (three.js IBL vs X_ITE), not fitted.
* Regression: all 135 three.js bridge fixture runs pass after the change (X_ITE 16.6.0, Chromium 153.0.8010.12 SwiftShader, the bridge's own rig); one new fixture `EnvironmentLight` (mad 0.22, IoU 0.99 against X_ITE).
* Files: `results/2026-11-23-conformance29-three-fixed/`.

## Result 6: five engines (X_ITE, three.js bridge, x3d.wgpu, Babylon bridge, Blender importer + Cycles)
Same 29 scenes, same 128x128 rig. Babylon: x3d.webgpu bridge body, Babylon.js 9.32.0, WebGPU on SwiftShader (the bridge's own offscreen stub), tone mapping off. Blender: bpy 5.3.0 wheel, the x3d-blender-io importer at x3d-blender-io `0eb4809`, Cycles CPU 64 spp, no denoise, Standard view transform; nothing added to the scene but render settings, the first imported camera bound, and its vertical angle set to the X3D `fieldOfView` (the importer's 16:9 camera made every Blender sphere the wrong size, MAE 8 to 30 on the first run: the Cycles camera trap, already in the Loom memory; after the fix the exp2 scenes are AGREE/NEAR).

| pair | AGREE | NEAR | FAR |
|---|--:|--:|--:|
| x3d.wgpu vs X_ITE | 10 | 19 | 0 |
| three.js vs X_ITE | 19 | 9 | 1 |
| three.js vs x3d.wgpu | 18 | 10 | 1 |
| Babylon vs X_ITE | 2 | 13 | 14 |
| Blender vs X_ITE | 6 | 9 | 14 |
| Babylon vs Blender | 7 | 2 | 20 |

Held-out X_ITE 16.7.1 record, rows in tolerance: X_ITE 29/29, x3d.wgpu 29/29, three.js 28/29, Babylon 8/29, Blender 9/29. Full table: `results/2026-11-23-five-engines/matrix.md`, pictures `sheet.png`.

Gaps by cause (centre pixel, 0-255):
| cause | scenes | evidence | grade |
|---|--:|---|---|
| **Blender importer ignores `Background` and `EnvironmentLight`**: world stays black, sphere black under a white environment | 20 | `furnace_m0_r1_c1`: Blender 0, others 250 to 255; unlit and legacy spheres match (127 vs 128) | Confirmed (picture), cause Likely (importer behaviour, source not read) |
| **Babylon bridge draws metals black under an EnvironmentLight** (metal 0 or 1 vs 186 to 255; dielectrics 133 to 183, close to X_ITE) | 11 | not a 1x1 cube (32x32 white faces also 0), not settle time (4 s also 0) | Confirmed (picture), cause Suspected (the specular IBL path in the bridge or in WebGPU on SwiftShader) |
| **Babylon unlit default reads 255, the others 128** (`exp2_a_unlit_default`) | 1 | five engines, four agree | Confirmed picture, cause unknown |
| **three.js is the odd one on `exp2_c_physical_default`**: Babylon 186, Blender 187, x3d.wgpu 188, X_ITE 186, three.js 128 | 1 | four of five engines agree: a headlit PhysicalMaterial is written through a 1/2.2 or sRGB curve everywhere except three.js | Confirmed picture; replaces the earlier "headlight not curved" suspicion with a vote. The bridge's own fixture (X_ITE vs three.js, explicit DirectionalLight) still says direct light is not curved, so the open question is why the headlight differs |

Limits repeated: furnace probes, software rendering only, one scene geometry. Castle is added in Result 7.

## Result 7: six engines (Castle added, 23 Nov 2026)
Castle: `castle-render` 0.1 from x3d.castle at the Castle 7.0-alpha.3 **snapshot downloaded today, sha256 `dce6a4cd488914b67963b2eb7e86ecc5dd37719512e856fe786b688e4e905c77`**. The checksum pinned in x3d.castle's Dockerfile (`4b8935a4...`) no longer matches the snapshot at the same URL (a moving snapshot), so these numbers are for a different Castle build than the earlier Castle quality leg; used on HagopJay's yes on the decision card. Rig: Xvfb, Mesa llvmpipe 25.2.8 (LLVM 20.1.2), `--size 128`, every lever default. Files: `results/2026-11-23-six-engines/`, `castle-version.txt`.

| pair (vs X_ITE) | AGREE | NEAR | FAR | held-out rows in tolerance |
|---|--:|--:|--:|--:|
| x3d.wgpu | 10 | 19 | 0 | 29 / 29 |
| three.js | 19 | 9 | 1 | 28 / 29 |
| Castle | 2 | 7 | 20 | 11 / 29 |
| Blender | 6 | 9 | 14 | 9 / 29 |
| Babylon | 2 | 13 | 14 | 8 / 29 |

* **Castle draws an EnvironmentLight, at the wrong level (Confirmed picture).** Furnace `furnace_m0_r1_c1`: Castle 147 vs X_ITE 255; `half_m0_r1_c0.5`: 79 vs 137; metal under the half light 206 vs 186. This matches the already-listed gap "Castle EnvironmentLight (IBL) unfinished" (x3d.castle quality leg); not re-diagnosed here.
* Unlit, legacy and the headlit PhysicalMaterial agree (128, 128, 186 vs X_ITE 128, 128, 186): **five of six engines now read 186 to 188 on `exp2_c_physical_default`; three.js alone reads 128.**
* The no-light controls (`ctrl_noenv`, `ctrl_intensity0`) read black everywhere, Castle included (NEAR, rim only).

## Limits (say them before anyone else does)
* The 29 scenes collapse to **10 distinct X_ITE pictures, 10 wgpu, 2 three.js**: they are furnace probes, built to test one thing. They cannot reveal geometry, texture or light-model differences. Widening the scene set is the next step, not a detail.
* Software rendering only (SwiftShader both sides). No real-GPU claim.
* X_ITE 16.6.0 here vs 16.7.1 in the record: the held-out result is a centre-pixel match, not identical builds.
* One held-out judge exists (the record); a second (FLIP, or a human eye sheet) is open.

## Run it
```sh
# Castle: CASTLE_RENDER=path/to/castle-render tools/render_castle.sh RUN $S   (see castle-version.txt in results for the bundle)
# Babylon: BABYLON_JS=path/to/babylon.js (npm pack babylonjs@9.32.0) node tools/render_babylon.js RUN $S
# Blender: python tools/render_blender.py ~/x3d-blender-io/source RUN $S   (pip install the bpy 5.3.0 wheel)
(cd ../x3d.threejs/bridge && npm install)            # three, x_ite, playwright pins
(cd ~/x3d.wgpu && cargo build --release -p x3d-render --bin x3d-view)
S=$(ls ~/x3d.wgpu/conformance/scenes/*.x3d)
node tools/render_web.js RUN $S                       # X_ITE + three.js  -> RUN/xite, RUN/three
tools/render_wgpu.sh RUN $S                           # x3d.wgpu          -> RUN/wgpu
python3 tools/oracle.py RUN --repeat RUN2 --expected ~/x3d.wgpu/conformance/expected.json --out OUT
python3 tools/report.py RUN OUT
```
Playwright's own pinned Chromium is not installed here; `render_web.js` falls back to a global `playwright` (NODE_PATH). Vulkan: `VK_ICD_FILENAMES` points at the SwiftShader ICD inside Chromium.
