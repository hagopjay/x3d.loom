# WebGPU quick wins: receipt

Date 2026-11-07. Spend $0. No timings taken (G0 consent still open); frames come from headless Chromium 153.0.8010.12 on SwiftShader with the swap chain stubbed (`stub-swapchain.py`, `capture.js`, same harness as the Pantheon port), so they show correctness only.

## Win 1: the five Loom HEP event scenes

Scenes regenerated with `kit/examples/hep/build_event_scene.py --look v3` from the committed fixtures. The pages reuse the Collider v2 viewer unchanged; `x3d.webgpu/demo/src/build-events.py` fills the template per scene.

| event | scene sha256 (first 12) | five GLSL keys match the Collider's | page size |
|---|---|---|---|
| pythia-dijet-hero | 59dfeb32e9ef | yes | 2.37 MB |
| pythia-qcd-demo | 5058e43501f5 | yes | 2.84 MB |
| pythia-zmumu | 346f43c14d41 | yes | 2.83 MB |
| pythia-qcd-inflight | 3cca0ee458d0 | yes | 2.56 MB |
| exact-zmumu | 1aeb3ad82f2d | yes | 0.75 MB |

The first three equal the hashes in `runs/hep-demo-v3-20261106/scenes.sha256`; the other two had no recorded hash. Each page loaded with 0 page errors, "5 GLSL programs matched their WGSL ports", and drew a frame (`frames-events-grid.png`, `frame-dijet.png`). The event grows over time, so a frame taken early shows only the vertex flash. No X_ITE comparison was repeated here; the same viewer and shaders were compared in the Collider v2 work.

## Win 2: synthetic heritage facade (140,000 splats)

A procedurally generated rock-cut facade (CC0, generated; not a scan of anything), X3D 4.1 with one GaussianSplats node, plus three Viewpoints added in a copy of the scene. The scene is not committed. Built with `build-v3.py`, no viewer change.

| check | result |
|---|---|
| page vs X_ITE 16.4.3, same file, 960 x 540, caption rows cropped | 41.9 dB PSNR, mean abs error 0.79 of 255 (Likely: one view, software GL) |
| page errors | 0 |
| bitonic sort size | 140,000 pads to 262,144, 171 dispatches |

## Win 3: torso CT

Not done here: the brain port thread already covers the torso scene.

## Not done

No timings. No spherical-harmonic degrees above 0. No second view per comparison.
