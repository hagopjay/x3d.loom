# Learnings: the cross-engine render oracle (step 1, 23 Nov 2026)

Frontier `cross-render` from the Loom Frontier Board. Code and data: [`x3d.render-oracle/`](x3d.render-oracle/) (README holds every table). No model call, nothing spent; one cloud container (4 cores, software rendering only).

Rig: 128x128, Chromium 157.0.8103.78 on ANGLE/SwiftShader; X_ITE 16.6.0; x3d.threejs bridge (x3d.loom 3ebed01, three r187); x3d-view 0.5.1 (x3d.wgpu 86f39bd) on SwiftShader Vulkan. 29 scenes from `x3d.wgpu/conformance/scenes`.

## What was found
| Claim | Grade | Evidence |
|---|---|---|
| X_ITE vs x3d.wgpu: 0 of 29 scenes FAR, 10 AGREE, 19 NEAR, max MAE 3.87 | Confirmed | `oracle.json`, rig above |
| three.js bridge vs X_ITE and vs wgpu: 21 of 29 FAR; the five largest gaps (MAE 135 to 251) are one cause, no EnvironmentLight (renders black) | Confirmed for the numbers; cause Likely (not yet fixed in the bridge) | `matrix.md`; centre px 0 vs 186 to 255 |
| The held-out X_ITE 16.7.1 record (`conformance/expected.json`) agrees: X_ITE 29/29 in tolerance, wgpu 29/29, three.js 8/29 | Confirmed | `oracle.json: heldout` |
| The differ catches planted defects: brightness +4/+12 and 1/3 px shifts 29/29; real scene mutants (radius, sphere to box) 18/18 | Confirmed | `oracle.json: controls`, `scene_controls.json` |
| The differ misses: gain x1.10 (3/29), vertical flip of a sphere (0/29), colour swap on grey (not observable) | Confirmed | same |
| Two full runs per engine are pixel-identical | Confirmed | determinism block |

## Lessons (candidate laws and failure modes; numbers left to the Loom owner)
1. **Score the object, not the frame.** v1 judged whole-frame MAE and the planted +4 brightness passed on 26 of 29 scenes because the white furnace background clipped it. The judge was changed to object pixels after seeing the control run, thresholds untouched, and the change is recorded in the judge's header. A control that the differ cannot see is a finding about the differ.
2. **The conformance scenes are probes, not a test set.** 29 scenes collapse to 10 distinct pictures in X_ITE and wgpu and 2 in three.js. They cannot show geometry, texture or direction errors (a flipped sphere scores 1.18). The six-engine step needs asymmetric, coloured, lit scenes.
3. **Ties hide structure.** "The 5 largest gaps" is six scenes at 250.589 here. Rank by cause (cluster) as well as by number.
4. **Use the older record as the held-out judge.** Comparing engines only to each other cannot tell which one moved; the 16.7.1 record said three.js is the odd one, independent of the differ.
5. **Rig traps hit this session:** the bridge pins Playwright 1.62.1 whose Chromium is absent here (fell back to the global Playwright); no GPU, so Vulkan comes from the SwiftShader ICD inside Chromium (`VK_ICD_FILENAMES`); `npm ci` fails in the bridge (no lockfile), `npm install` works.

## Next
Widen to six engines (Babylon via x3d.webgpu, Castle via x3d.castle castle-render, Blender via the add-on) on a scene set with asymmetric lit coloured objects (Demo 57 coverage-board nodes); add FLIP as a second held-out judge; fix or document the three.js EnvironmentLight gap and re-run (the oracle should then show 21 FAR fall).

## Update, same day: the three.js fix (his order: "fix threejs first")
* `src/nodes/EnvironmentLight.js` + a 1/2.2 power on a PhysicalMaterial's indirect light (in `src/body-three.js`). X_ITE vs three.js FAR 21 to 1 of 29, held-out rows 8 to 28 of 29, 135 of 135 bridge fixture runs pass, new fixture EnvironmentLight (mad 0.22). Confirmed (x3d.render-oracle, X_ITE 16.6.0, three r187, Chromium 157 / 153 SwiftShader).
* **Lesson: fixing one defect exposed the next.** The black spheres hid a second, independent X_ITE behaviour (gamma on indirect light only). A differ's FAR count can be dominated by one cause; re-run after every fix.
* **Lesson: a plausible cause can be wrong.** The bridge's own note said X_ITE adds "a default environment glow". Trying it broke the `headlight=false` controls: the 186 on `exp2_c` is the headlight. Controls decided it; the note was corrected.
* Remaining: `exp2_c_physical_default` (three.js 128 vs 186). Suspected, unproven: X_ITE curves the headlight on a PhysicalMaterial.

## Update: five engines (Babylon and Blender added)
* Babylon (x3d.webgpu bridge, Babylon.js 9.32.0) and Blender (x3d-blender-io 0eb4809, bpy 5.3.0, Cycles) now run on the same 29 scenes. Babylon vs X_ITE 14 FAR, Blender vs X_ITE 14 FAR. Causes in README Result 6: Blender importer ignores Background and EnvironmentLight (20 scenes; Likely), Babylon bridge draws metals black under an EnvironmentLight (11; cause Suspected), Babylon unlit default 255 vs 128 (1), three.js alone is dark on the headlit PhysicalMaterial (1).
* **Lesson: an outside engine needs its camera checked before its pixels are believed.** The importer's 16:9 camera made Blender's first run FAR on scenes the others agreed on; fixing the camera (vertical fit) turned it to AGREE/NEAR. The Loom already held this trap for Cycles (three-gpu-pathtracer lane); a rig script now carries it.
* **Lesson: majority vote localises the odd engine.** On `exp2_c_physical_default` four of five engines write 186 to 188, so the three.js 128 is the outlier, not a shared convention. This corrects my own earlier guess (headlight not curved).
* **Castle** was blocked by the moving-snapshot checksum (pinned 4b8935a4... vs today's dce6a4cd...); done after his yes on a card, result below.

## Update: six engines (Castle added, same day)
* Castle (snapshot sha256 dce6a4cd..., not the pinned build) vs X_ITE: 2 AGREE, 7 NEAR, 20 FAR; held-out rows 11 of 29. Castle's EnvironmentLight draws but at the wrong level (255 vs 147 on a white furnace); the headlit PhysicalMaterial matches (186), so five of six engines agree there and three.js is the lone outlier.
* **Lesson: a pinned download that stops matching is a result, not noise.** The Castle snapshot URL is moving; the Dockerfile's checksum caught it. Using the new build needed his yes, and the number now names the new sha. Do not strip the check to get past it.
* Setup facts: `apt-get update` first, then `libharfbuzz-gobject0` and `xvfb`; castle-render links in 3.4 s once the library exists; a failed link leaves `link*.res` (do not `git add -A`).

## Update: twelve lit scenes, FLIP and the vote (step 3)
* Result 8 in the README. 24 of 24 planted scene mutants caught across six engines; X_ITE vs x3d.wgpu 9 AGREE / 1 NEAR / 2 FAR, three.js 8 / 1 / 3, Babylon 6 / 2 / 4, Castle 1 / 7 / 4, Blender 0 / 3 / 9.
* New gaps the furnace set could not show: x3d.wgpu draws no PixelTexture and no linear fog (with Babylon and Blender also no fog); Babylon draws a PhysicalMaterial lit by a DirectionalLight black; three.js lights PhysicalMaterial wrongly under a direct light (hot sphere, dark box); Blender importer draws no headlight.
* **Lesson: the furnace set could not show texture, fog or direct-light gaps at all; twelve lit scenes showed all three within one run.** A conformance probe set measures one behaviour; a differ needs scenes that exercise light models, textures and fog.
* **Lesson: when no record exists, say so.** For these scenes there is no held-out record; the majority vote and FLIP are consistency checks, not independent evidence, and where all pairs disagree (fog, texture) the vote names no outlier. Do not let a reference engine stand in for the standard.
* Next candidates: fix the cheap ones in their owners' lanes (x3d.wgpu fog and PixelTexture, three.js PhysicalMaterial under a direct light), then re-run; give Babylon's black PhysicalMaterial a lane.
