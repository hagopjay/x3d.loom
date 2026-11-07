# Manifold of Emotion on Babylon / WebGPU (scaffold)

Plan and rationale: [../../MANIFOLD-PORT-PLAN.md](../../../MANIFOLD-PORT-PLAN.md). Playbook: [../../../BABYLON-BRIDGE-PLAYBOOK.md](../../../BABYLON-BRIDGE-PLAYBOOK.md).

| File | State | Next |
|---|---|---|
| `census.py` | works | rerun after any scene change |
| `manifold-wgsl.js` | `MF_PRELUDE` has uniforms, array accessors and `metric()`; 7 ports are `null` stubs with the key table filled in | port `foldSurface`, `surface`, `display`, `overlay`, `lightOut`, then Surface, Sky, Veil, Flow, Fiber, Node, Mote |
| `manifold-reader-ext.js` | declares ElevationGrid, TriangleSet, PointSet, MFVec4f | parse test against the real scene; SAI field setters |
| `body-manifold.js` | mesh builders and material factory sketched | custom vertex buffers, alpha modes, uniform push for MFVec4f |
| `../build-manifold.py` | key check works; bundle step stubs out | page template, `boot-manifold.js`, lens-off notice |

Harness (same as the brain port, `runs/webgpu-brain-20261107/`): headless Chromium with `--enable-unsafe-webgpu --use-angle=swiftshader --use-webgpu-adapter=swiftshader`, canvas context stubbed with an offscreen texture, `requestAnimationFrame` slowed to 1.2 s, read back through `__demo.capture`. X_ITE reference: the page's own `vendor/x_ite` (16.5.1), lens off. Correctness only; no timings (G0 open).

Run the census: `python3 -I census.py --site <folder with scenes/manifold.x3d>`.
