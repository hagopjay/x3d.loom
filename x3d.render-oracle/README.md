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

## Result 8: twelve lit, coloured, asymmetric scenes, six engines (step 3, 23 Nov 2026)
`scenes/lit_*.x3d` (made by `tools/make_scenes.py`; all 12 validate against X3D 4.0 XSD with xmllint, x3d_mcp fork 4d433af schemas): directional, spot and point light, specular, emissive and ambient, transparency, PixelTexture, PhysicalMaterial with a direct light only, linear fog, a nested Transform, an asymmetric IndexedFaceSet, the default headlight. No EnvironmentLight. Same rig as before (128x128, Chromium 157.0.8103.78 SwiftShader for X_ITE, three.js, Babylon; x3d-view 0.5.1 on SwiftShader Vulkan; Blender 5.3.0 / Cycles 64 spp; Castle snapshot dce6a4cd... on llvmpipe). Files: `results/2026-11-23-lit12/` (`matrix.md` 15 pairs, `vote.md`, `flip.md`, `sheet.png`).

**No external record exists for these scenes**, so there is no held-out judge of the earlier kind. Two substitutes, each weaker: a **majority vote** (each engine's median distance to the other five, `vote.md`) and **FLIP** (second metric on the same pictures, Spearman 0.922 with the primary MAE_obj over 60 engine-scene cells; whole frame, so it is diluted by the sky colour). Neither confirms a cause.

Pairs against X_ITE (12 scenes): x3d.wgpu 9 AGREE / 1 NEAR / 2 FAR; three.js 8 / 1 / 3; Babylon 6 / 2 / 4; Castle 1 / 7 / 4; Blender 0 / 3 / 9.

**Planted controls (4 scene mutants x 6 engines = 24 runs): 24 of 24 not-AGREE.** Light direction flipped 24.9 to 47.4 (FAR), red box to blue 13.4 to 27.9 (FAR), specular shininess 0.6 to 0.1 8.9 to 25.4 (FAR), cone 17% taller 4.3 to 5.7 (NEAR, caught but small). (`lit_controls.json`).

Gaps with a measured cause (centre or region pixel values; cause grade in brackets):
| scene | what the engines do | grade |
|---|---|---|
| fog_linear | X_ITE, three.js and Castle fog the far boxes (rgb 171,184,209 and 178,191,217, near the fog colour); **x3d.wgpu, Babylon and Blender do not** (far box stays 149,62,29 / 156,64,28 / 142,55,22) | picture Confirmed; "no Fog support" Likely |
| texture_pixel | **x3d.wgpu draws the box without the PixelTexture colours** (colour std equal across channels, white box in the sheet); Castle and Blender smooth the 4x4 texels (std 52 to 57 vs 75 in X_ITE: filtering) | wgpu picture Confirmed; filtering Likely |
| physical_direct (DirectionalLight only) | **Babylon draws both PhysicalMaterial objects black**; **three.js sphere hot (255,197,125 vs 152,119,97 in X_ITE) and box dark (48,7,7 vs 71,29,29)**; wgpu, Blender and Castle within 8 of X_ITE | picture Confirmed; causes unknown |
| emissive_ambient | three.js sphere 50 vs 121 (the bridge's fixed material ambientIntensity of 0.2, already a listed gap); Castle brighter (158); Blender darker (39) | three.js Likely (listed gap); others unknown |
| headlight_coloured | **Blender draws nothing** (the importer does not make the default headlight; Likely); every other engine within 5 of X_ITE | picture Confirmed |
| every scene with a Background | Blender draws a black sky (importer ignores Background, as in Result 6) | Confirmed |

Outlier count (vote): Blender 6 scenes, Babylon 3, Castle 1, x3d.wgpu 1, X_ITE 0, three.js 0. The fog and texture scenes have **no clear majority** (all pairs far apart), so the vote cannot name an outlier there; X_ITE and three.js agree (fog 0.013 FLIP, texture 0.008) and are used as the reference only because the older record shows X_ITE as the reference in the furnace set.

Limits: 12 scenes, one geometry each, 128x128, software rendering, all engines at defaults; the vote and FLIP are not independent measurements; no real-GPU claim.

## Result 9: the three.js PhysicalMaterial fixed (24 Nov 2026, "proceed at your discretion")
The Result 5 model (curve only the environment light by 1/2.2) was incomplete: it fitted the furnace scenes and broke under a direct light (`lit_physical_direct`: three.js sphere 255,197,125 vs X_ITE 152,119,97). Twelve probes (`results/2026-11-24-three-physical-fixed/probes/`, a sphere facing one DirectionalLight, base 0.5, metallic 0/1, roughness 1/0.5/0.2, intensity 1/2; centre pixel in `probe_centre_pixels.json`) showed X_ITE, x3d.wgpu, Blender and Castle agree within 5 and three.js alone off. Fit on the rough dielectric: X_ITE reads **110 at intensity 1 and 150 at intensity 2 = 255 x (0.5 x I / PI)^(1/2.2)**. So X_ITE does **not** multiply a PhysicalMaterial's light by PI, and writes the whole result through a 1/2.2 power (Confirmed on the probes; 1/2.2 versus sRGB differs by 1 to 2 grey levels, the wgpu 188 vs X_ITE 186 gap). Material and UnlitMaterial are unaffected.

Bridge change (`x3d.threejs/bridge/src/body-three.js`, `xiteGamma22`): a PhysicalMaterial divides its direct light terms by PI and curves the final colour; the IBL-only curve is gone. Same rig, three.js vs X_ITE:

| set | before | after |
|---|---|---|
| furnace 29 (AGREE/NEAR/FAR) | 19 / 9 / 1 | **20 / 9 / 0**, held-out 29 of 29 |
| lit 12 | 8 / 1 / 3 | **8 / 2 / 2** |
| `lit_physical_direct` | 24.9 FAR | **4.9 NEAR** |
| `exp2_c_physical_default` | 56.5 FAR | AGREE |
| PhysicalMaterial fixture vs X_ITE | mad 5.33 | **mad 0.5** |

**Open:** rough metals (metallic 1, roughness 1, base 0.5): X_ITE 59, three.js 80 (intensity 1); likely the multiple-scattering term (Suspected). Remaining three.js FAR in the lit set: `lit_emissive_ambient` (fixed material ambientIntensity 0.2) and `lit_point_attenuation` (fitted attenuation), both listed gaps. Bridge fixtures: 135 of 135 pass.

Corrections: Result 5's "direct lights are not curved" is withdrawn (its fixture was compared with the wrong light scale), and the "three.js is the lone outlier on the headlit PhysicalMaterial" finding of Results 6 and 8 is resolved. On `lit_physical_direct` the outlier is now Babylon (both objects black).

## Result 10: Cycles as a seventh engine (24 Nov 2026, from the Atlas bridge thread)
The Atlas bridge thread rendered the 41 scenes (12 lit + 29 conformance) with `x3d.castle tools/cycles_reference.py`: Blender 5.3.0 bpy, Cycles CPU, 128x128, 64 spp, no denoise, seed 0, Standard view transform, the X3D's own lights as ideal points, Background as camera-ray colour only, 12 bounces (`cycles-receipt.json`). Different path from the `blender` engine (same add-on, but ours uses the importer's own lights and materials). Results: `results/2026-11-24-seven-engines/`.

**Lit 12 (Confirmed numbers, referee role Suspected):**
- cycles|xite is AGREE 0, NEAR 3, FAR 9 (`lit12/matrix.md`); Cycles is the outlier in 1 of 12 scenes (`lit_spot_cone`, 41.4), `blender` in 5 (the importer lights are the odd ones), three.js and X_ITE in 0.
- `lit_physical_direct`, the one scene where Cycles is a true referee (PBR, a single direct light): Cycles vs X_ITE **4.8 NEAR**, vs x3d.wgpu **3.3 NEAR**, vs three.js **9.0 FAR**. So after the Result 9 fix three.js is still the engine farthest from the physical answer (and Babylon draws it black, 58.9 median), but X_ITE, wgpu, Castle and Blender sit within 6 of it.
- Legacy Material scenes: Cycles disagrees with X_ITE by 12 to 14 on `lit_dir_diffuse_colour` and `lit_dir_specular` (FAR). That is expected, not a defect: Cycles is physical; X_ITE's Phong/Blinn is not. Cycles is not a referee for legacy Material, and the FAR is recorded, not explained away.
- `lit_emissive_ambient`: Cycles 23.6 from X_ITE and 8.9 from three.js. The Atlas thread saw it nearly empty (max pixel 128,90,41); the emissive or the ambient term may be lost in import (Suspected, not checked).

**Furnace 29: not scored for Cycles.** 26 of 29 probes are an EnvironmentLight: the add-on drops it and the tool's world emits nothing, so Cycles draws a black sphere (20 of 29 outside the X_ITE record on the held-out judge; that is a missing world, not a Cycles result). Only the 3 headlit `ctrl_noenv_*` probes are meaningful: Cycles vs X_ITE 5.6 on `ctrl_noenv_m0_r1_c0.5`, `exp2_c_physical_default` 4.5. Building the EnvironmentLight as a Cycles world is the next step for a usable furnace reference; not done.

Per the Cycles receipt, add-on commit `0eb4809` (v2.7.4); script commit `5b13f70`. No determinism repeat for Cycles (seed 0, CPU, 64 spp; not yet re-rendered).

## Result 11: the Babylon black PhysicalMaterial fixed (24 Nov 2026)
Results 3 to 8 listed two Babylon faults as "cause unknown/Suspected": metals black under an EnvironmentLight, and both objects black under a DirectionalLight. They were **one bug**. The stock body (`x3d.webgpu/demo/src/brain/body.js`) gives every PBRMaterial `sideOrientation = CounterClockWise` (correct for data geometry), but Babylon's own Box, Sphere, Cylinder and Cone are wound the other way in this right-handed scene (the Phong path already handles that). On a primitive the PBR material therefore saw the outside as its back: with `solid` TRUE it drew the inside of the shape, whose normal points away from the light, so direct light gave 0. Confirmed by experiment on the 12 probes: `sideOrientation = ClockWise` alone turned 0 into 124 (X_ITE 124); `backFaceCulling = false` alone did nothing; the 1/1000 look of the light scale and the faint glow at intensity 1e6 were the specular term at grazing angles.

Fix (`x3d.webgpu/bridge/src/body-br.js`, new block "PhysicalMaterial side orientation"): a PBRMaterial on a primitive takes ClockWise, on vertex data stays CounterClockWise. 12 probes now: all four dielectrics and the four smooth metals equal X_ITE (255, 124/124, 110/110, 169/169, 150/150); rough metals still brighter (83 vs 59, 114 vs 81, 211 vs 207; the same multiple-scattering gap as three.js, Suspected).

Babylon vs X_ITE, before then after the fix (same rig, Babylon.js 9.32.0, bridge fixtures DirectionalLight, PointLight, SpotLight, TwoSidedMaterial still pass):

| set | before (AGREE/NEAR/FAR) | after |
|---|---|---|
| furnace 29 | 2 / 13 / 14, held-out 21 of 29 outside | **17 / 11 / 1**, held-out 2 of 29 outside |
| lit 12 | 6 / 2 / 4 | 7 / 2 / 3 |
| `lit_physical_direct` | 59.5 FAR | **1.5 AGREE** |

The one FAR left on the furnace set is `exp2_a_unlit_default` (127: Babylon draws a default-appearance sphere differently from X_ITE; pre-existing, not touched). In the vote Babylon is the outlier in 1 furnace scene and 1 lit scene (was 2). Seven-engine run with Cycles included in `furnace29/` and `lit12/`.

## Result 12: x3d.wgpu fog and PixelTexture, three.js ambient and attenuation (24 Nov 2026)
Four of the gaps listed since Result 4 closed. Same rig; all numbers are object-pixel MAE against X_ITE 16.6.0 unless said otherwise.

| gap | engine | before | after | fix |
|---|---|---|---|---|
| `lit_fog_linear` (Fog ignored) | x3d.wgpu | 70.5 FAR | **0.7 AGREE** | Fog node in parser, uniforms and shader (x3d.wgpu #9) |
| `lit_texture_pixel` (PixelTexture unsupported) | x3d.wgpu | 82.8 FAR | **0.5 AGREE** | PixelTexture to in-memory PNG, nearest-sampled; **and** Box faces now map the picture upright (they were an arbitrary axis pair, so a face came out rotated 90 degrees: found by trying the four flips and seeing none fit) |
| `lit_emissive_ambient` (material ambientIntensity fixed at 0.2) | three.js | 15.9 FAR | **0.25 AGREE** | the part of the material's own ambientIntensity beyond 0.2 goes into its emissive term (`refreshPhong`, `refreshAmbient` in `body-three.js`) |
| `lit_point_attenuation` (only one of a1 and a2 kept) | three.js | 10.4 FAR | **0.40 AGREE** | `decay` packs a1/a0 and a2/a0 in thousandths (`a1q + 4096 a2q`), the patched `getDistanceAttenuation` unpacks and uses 1 / (1 + a1 d + a2 d^2) |

Lit 12 against X_ITE (AGREE/NEAR/FAR): x3d.wgpu 9/1/2 to **11/1/0**; three.js 8/2/2 to **10/2/0**. Furnace 29 unchanged for both (wgpu 10/19/0, three.js 20/9/0). Three.js bridge fixtures 135 of 135 pass; x3d.wgpu `fog_and_pixel_texture` tests pass (its three golden mismatches 03, 04, 06 are identical before and after: the goldens were blessed on llvmpipe, this rig is SwiftShader). Left: Babylon has no fog and draws PixelTexture off (3 FAR on lit 12), rough metals (three.js 80 vs 59, Babylon 83 vs 59), Castle EnvironmentLight level, Blender importer ignoring Background and headlight, and Cycles has no furnace world. Direct rough-metal light is not the multiple-scattering term (three.js applies multiple scattering to indirect light only), so that Suspected cause from Result 9 is withdrawn; cause unknown.

## Result 13: Babylon fog, PixelTexture and point attenuation (24 Nov 2026)
- **Fog was read and never drawn.** In the Babylon bridge the per-frame fog code (`BR.fog.reg`) started only when a LocalFog registered itself, so a world with a plain `<Fog>` and no LocalFog never fogged: `lit_fog_linear` 71.5 FAR from X_ITE. `setWorld` now starts it when the world holds a Fog: **3.7 NEAR**. (The bridge's own fixtures only covered LocalFog and FogCoordinate, which is why this slipped through; the oracle found it in one scene.)
- **PixelTexture drew nothing.** The stock body reads a texture's url only. A `PixelTexture` is now a RawTexture, nearest-sampled, rows bottom first (`invertY` true; with false the picture came out upside down, tried both): `lit_texture_pixel` 53 FAR to **7.4 NEAR** (the rest is the shading difference every Babylon scene carries).
- - **Babylon point attenuation** (`lit_point_attenuation` 30.7 FAR from X_ITE) fixed in a second step: **1.3 AGREE, the sphere pixel identical to X_ITE (196,174,22)**. Babylon's falloff is linear to its `range`, X3D's is `1 / (a0 + a1 d + a2 d^2)`. First attempt patched the include `pbrDirectLightingFalloffFunctions`: the text changed and the picture did not (range 1 still drew black, the stock law), because a StandardMaterial does not use that function: its `computeLighting` has the law inline (`attenuation=max(0.,1.0-length(direction)/range)`). Now the bridge replaces that text in every include entry that holds it (WGSL and GLSL), keeps it through a setter (Babylon registers an include again when it loads the shader that uses it), and `range` carries the polynomial (`1 + a1q + 4096 a2q`, thousandths of a1/a0 and a2/a0; the light intensity carries 1/a0; the hard edge of `radius` was already a per-mesh cull). Spot lights go through the same line. PBR materials keep Babylon's physical falloff.
- Babylon vs X_ITE, lit 12: 7/2/3 to **8/4/0** (AGREE/NEAR/FAR); in the vote Babylon is now the outlier in 0 of 12 lit scenes (3 before the three fixes), the Blender importer in 7 and Cycles in 2. Furnace 29 unchanged (17/11/1). PointLight, SpotLight, LocalFog, FogCoordinate and the volume fixtures pass.
- **Babylon UnlitMaterial** (`exp2_a_unlit_default`, the last Babylon FAR on the furnace set: emissive 0.5 drew 255 against X_ITE's 128): the stock body looked at the Material type for Material and PhysicalMaterial only, so an UnlitMaterial became "no Material", white whatever its colour. The bridge now draws an untextured UnlitMaterial in its emissiveColor with 1 - transparency, no lighting (`materialsFor`, `makeMaterial`, `changed` wrappers in `body-br.js`; no bridge fixture covers it, the oracle scene is the test). **Final Babylon numbers vs X_ITE: furnace 29 from 2/13/14 (Result 11 start) to 18/11/0, held-out 1 of 29 outside; lit 12 8/4/0; Babylon is the outlier in 0 scenes of either set.**

## Limits (say them before anyone else does)
* The 29 scenes collapse to **10 distinct X_ITE pictures, 10 wgpu, 2 three.js**: they are furnace probes, built to test one thing. They cannot reveal geometry, texture or light-model differences. Widening the scene set is the next step, not a detail.
* Software rendering only (SwiftShader both sides). No real-GPU claim.
* X_ITE 16.6.0 here vs 16.7.1 in the record: the held-out result is a centre-pixel match, not identical builds.
* One held-out judge exists (the record); a second (FLIP, or a human eye sheet) is open.

## Run it
```sh
python3 tools/make_scenes.py scenes   # the 12 lit scenes; then python3 tools/vote.py RUN OUT and python3 tools/flip_judge.py RUN OUT
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

## scenes-260: one scene per node (28 Nov, batches 1 and 2)
`tools/make_scenes_260.py` writes `scenes-260/<Node>.x3d` for all 260 X3D 4.0 nodes, using the shortest legal parent chains and attribute tables of the Blender node board (x3d-blender-io `tools/node_board_probe.py`, add-on 2.9.0), so Blender, X_ITE, three.js, Babylon and wgpu share one row key. `index.json` records per node: file, component, level, `kind` (visible / invisible; invisible nodes get a parse/handled check, never AGREE/NEAR/FAR) and XSD validity. Batches 1 and 2: 260 nodes, 255 valid against x3d-4.0.xsd (lxml 6.1.3). The other 5 are `xsd_blocked` (Suspected schema defects, found by trying the spec-legal scene against the XSD; held, not filed): a lone Bounded/Force/WindPhysicsModel in a ParticleSystem (the XSD wants a fixed sequence Bounded, Force, Wind, ProtoInstance), LayoutGroup under Scene or LayoutLayer, and Contact (no parent references it). No engine has rendered them yet: no grade is claimed.

### scenes-260 batch 3 (28 Nov): scenes in which the node acts on geometry
The oracle grade of batch 1 (`/mnt/project-files/render-oracle/scenes260/table-batch1.md`: three.js 67 AGREE / 77 BLANK, Babylon 8 / 82, x3d-view 27 / 83 against X_ITE 16.6.0) showed that about half of the visible scenes drew nothing, so AGREE meant nothing there. Batch 3 rewrites about 60 of them (lights, fog, backgrounds, ElevationGrid, ClipPlane, Switch, layers, viewpoints, HAnim, volume styles, Geo, MultiTexture, cube map, Color) so lit geometry the node acts on is in frame. Kinds now: 122 visible, 122 invisible (audio graph, Geo sensors, Metadata, events, scripting: parse/handled check only), 16 deferred (particles need time, shaders need GLSL, a few layout and Geo cases need design). `tools/blank_check.js` (X_ITE 16.6.0 via Playwright/SwiftShader, 128x128; npm install x_ite@16.6.0 pngjs first) reports the share of pixels that differ from the corner pixel: In the last full pass over the 123 scenes then marked visible, 3 read 0 (Color, HAnimJoint, GeoViewpoint); Color and HAnimJoint were fixed and re-checked one by one (non-zero), GeoViewpoint was moved to deferred. The full pass was not repeated after those edits. A non-zero share only proves something is drawn, not that it is drawn correctly.
