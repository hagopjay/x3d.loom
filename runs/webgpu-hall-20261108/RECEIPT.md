# Library hall on Babylon WebGPU: receipt

Date 2026-11-08. Port #9 (Dynasty hypersphere was #8). Scope: the Library of PolyXandria hall (`library_v1_8_extras.x3d`, 14 MB, 23 viewpoints, 299.52 s film, 88 PBR materials, 17 lights, no shader) drawn by Babylon.js 9.32.0 in WebGPU mode through our own X3D reader and SAI shim, with the X_ITE 16.5.1 button kept for comparison.
Grades: C measured or seen here, L reasoned, S suspected. Rig: Chrome for Testing, SwiftShader WebGPU, framebuffer read back through a stubbed swap chain, correctness only, 640x360, page chrome hidden on the X_ITE side. Standing rule from the owner: not pixel perfect, log the gaps.

## What was built (C)
| piece | note |
|---|---|
| `hall/reader-ext-hl.js` | Collision, CoordinateInterpolator and 2D, MultiTextureCoordinate, PointProperties, Disk2D, Rectangle2D, Extrusion (the last three become IndexedFaceSets at parse time); a TimeSensor disable now clears the pause state |
| `hall/body-hl.js` | updatable geometry rewritten in place for 27 animated shapes, PointSet as camera-facing quads sized in WGSL, BlendMode mapping, PNG-alpha for textured Unlit, one shadow map per shadow light, ProximitySensor box test, bloom/vignette/grain look with an off switch |
| `hall/hall-boot.js`, `hall/hall.tpl.html`, `build-hall.py` | page, film clock, 23-viewpoint menu, Babylon/X_ITE toggle, builder with leak-safe asset checks |

Eight node types added to the bridge: Collision, CoordinateInterpolator, CoordinateInterpolator2D, MultiTextureCoordinate, PointProperties, Disk2D, Rectangle2D, Extrusion. Bridge coverage 74 to 78 of 260 X3D 4.0 types (30%).

## Checks against X_ITE 16.5.1 (C): `compare-hall.jpg`, `compare.json`
Rows alternate X_ITE (left) and Babylon (right) per shot.
| shot | PSNR dB | Babylon / X_ITE mean luma |
|---|---|---|
| ViewTriplet @40 s | 22.1 | 1.00 |
| ViewExterior @280 s | 25.3 | 2.37 (both near black) |
| ViewShadow @190 s | 18.7 | 1.19 |
| ViewRising @100 s | 17.8 | 1.43 |
| ViewThreshold @0 s | 17.5 | 0.62 |

Geometry, viewpoints and film clock agree in every shot. The lamp-lit interiors are 1.2 to 1.4 times brighter in Babylon. Light calibration: `lightScale=0.75` moved the luma ratio by only 4 percent (1.43 to 1.38) and the PSNR not at all, so the excess is not the punctual light unit; "As authored" (look off) is brighter still (1.59), so the look layer darkens, it does not brighten. Cause not found (S).

## Play test (C): `play-result.json`
Pause, seek to 150 s (fraction 0.502), resume, viewpoint change to the galaxy, Look off and on: no page errors, no WebGPU validation errors. Engine switch to X_ITE not driven inside the Babylon rig; the X_ITE page ran separately (`?engine=xite`) for all reference shots.

## Bugs found by running it (C)
Shadow varyings over the 16-location limit (fixed: one map per light), seek frozen by the demiurge pause state (fixed in the reader), opaque PNG shafts and glows (fixed: alpha from texture), note chip over the controls on a narrow screen (fixed), `loadURL` wants an MFString.

## Open
Text nodes (fonts not shipped), cascaded shadows, sky gradient match, real-GPU pass and Timing. See GAPS.md.
