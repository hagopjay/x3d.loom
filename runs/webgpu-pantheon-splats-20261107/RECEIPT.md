# Pantheon splats on the WebGPU bridge: receipt

Date 2026-11-07. Port #1 from the WebGPU port map. Scope: add the X3D 4.1 draft `GaussianSplats` node to the bridge and draw a 50,058-splat interior scene with it.

## What was added (x3d.webgpu/demo/src/viewer-v3.tpl.html, built by build-v3.py)

| piece | what it does |
|---|---|
| `GaussianSplats` node | reads `positions`, `scales`, `orientations` (x y z w), `opacities`, `sphericalHarmonicsDegree0Coef0` as flat typed arrays; colour is 0.5 + 0.28209 x coefficient (degree 0 only) |
| GPU depth sort | compute shader writes one key per splat (view depth), then a bitonic network (one dispatch per step, parameters in one dynamic-offset uniform) orders them far to near; re-run only when the view-depth row of the model-view matrix changes. 50,058 splats pad to 65,536 and take 136 dispatches |
| draw | one instanced quad per splat; covariance, 2D conic and the 3-sigma quad are a term-for-term port of X_ITE 16.4.3's GaussianSplats shader (it uses the conjugate quaternion and a 0.3 px low-pass); alpha = min(0.99, exp(e) x opacity), discard below 1/255; source-over blend into the 4x MSAA rgba16float target |
| page | "as authored" path: values go straight to the screen, as X_ITE writes them (no tone map, no bloom) |
| fixes found on the way | a Viewpoint nested in a rotated Transform ignored the parent's rotation (v2 never nested one); with the eye at the centre of rotation the wheel zoomed by dividing by zero, so it now changes the lens |

Not done: spherical-harmonic degrees 1 to 3 (view-dependent colour), SPZ and PLY by `Inline url`, per-node bounding-box culling, ROUTEs into splat fields. The page says so. The splat code takes the node's arrays and a model-view matrix and returns draw calls, so a Babylon body could replace it later.

## Check against the reference (Confirmed, headless Chromium 153.0.8010.12, SwiftShader; correctness only, no timings)

Same X3D file, 960 x 540, X_ITE 16.4.3 (WebGL2) against this page (WebGPU), caption rows cropped:

| view | PSNR | mean abs error (of 255) | luma correlation |
|---|---|---|---|
| PantheonEye (eye at the origin) | 50.17 dB | 0.50 | 0.9999 |
| Oculus (looking up through the dome) | 51.01 dB | 0.47 | 0.9999 |

A procedural test scene (`demo/splat-test.x3d`, 6,100 splats, CC0) shows pillars occluding a sphere in the right order.

## Harness notes

Headless shell cannot present a WebGPU swap chain here (its shared-image backing is missing, the device then reports "Instance dropped"), so `stub-swapchain.py` swaps the canvas context for an offscreen texture of the same format and `capture.js` reads it back through the page's own export. `requestAnimationFrame` is slowed to 600 ms so SwiftShader keeps up. Frame times from this setup mean nothing and none are quoted. The 50k scene is not in this repository; build the page with `python3 -I src/build-v3.py SCENE.x3d OUT.html`.
