# three-gpu-pathtracer on X3D (x3d.threejs/pathtracer)

An in-browser path tracer as a light-transport reference for X3D scenes drawn by the three.js bridge (`../bridge`). The same reader and body build the three.js scene; `src/pt-adapter.js` re-sets lights, materials and background for [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) 0.0.28 (three-mesh-bvh 0.9.18, three r187); `run-pt.js` renders it and X_ITE 16.6.0 on the same rig.

```sh
npm i                      # three, three-gpu-pathtracer, three-mesh-bvh, playwright, x_ite
CHROMIUM_EXECUTABLE=... node run-pt.js --out OUT --samples 96 --bounces 6 --xite scenes/e2-cornell-box.x3d   # --bounces 1 for the direct-only ladder
python3 build_results.py PT6DIR PT1DIR CYCDIR OUT [DEMODIR]        # FLIP table + strips (+ the x3d.demo page)
```
Cycles stills come from x3d.lab's `blender_worker.py` render task (bpy 5.3.0 CPU, 256 spp, OIDN, film transparent, 320x240). `scenes/` are the three Leg E scenes of x3d.lab (e1 PBR grid, e2 Cornell box, e3 light ladder).

## Result (object-pixel FLIP, lower is closer; Chromium 153 SwiftShader, X_ITE 16.6.0, 96 spp, 320x240; `results/results.json`)
| scene | PT(6 b) vs X_ITE | PT vs Cycles | PT(1 b) vs X_ITE | raster vs X_ITE | Cycles vs X_ITE | bound | PT within | raster within |
|---|---|---|---|---|---|---|---|---|
| e1 PBR grid | 0.641 | 0.616 | 0.665 | 0.476 | 0.594 | 0.644 | yes | no |
| e2 Cornell | 0.265 | 0.390 | 0.142 | 0.595 | 0.418 | 0.468 | yes | no |
| e3 light ladder | 0.491 | 0.781 | 0.490 | 0.693 | 0.769 | 0.819 | yes | no |

Bound = the Unreal lane's tier-1 test, max(PT-X, PT-C) <= X-C + 0.05. Noise floor: two 96 spp Cornell runs differ by 0.055. Cycles frames these scenes smaller than X_ITE, which inflates every number that involves Cycles. No real-GPU timing (software Vulkan, ~1 s per sample at 320x240).

## Findings
- 1 bounce lands on X_ITE (Cornell 0.142); the extra bounces are light X3D lighting does not carry, and they move the picture toward Cycles.
- Emissive surfaces light the scene in a path tracer and do not in X_ITE (the Cornell ceiling panel).
- The bridge's raster output sits outside the bound on all three scenes (it multiplies lights by pi; X_ITE lights PhysicalMaterial as rho/pi * I); the path tracer, with I unscaled, does not.
- The bridge's SAI shim overwrites `window.X3D`: a page that also runs X_ITE must keep its own reference.
- three-gpu-pathtracer 0.0.28 marks `WebGLPathTracer` deprecated in favour of `WebGPUPathTracer` (console warning); a WebGPU run is a next step.

## Handoff (paused 15 Nov 09:27Z at the owner's request)
Done: harness, adapter, scenes, results, strips, the x3d.demo page (live check in headless Chromium: 181 samples, X_ITE scene loaded, path-traced canvas non-black). Not done: x3d.docs chapter (strict template, id prefix PTR, linter), PR descriptions, a WebGPUPathTracer try, Cycles run with exact camera match, real-GPU timing (a Colab G4 cell would give it), the pick-sensor/three-mesh-bvh coordination note for the bridge thread.
