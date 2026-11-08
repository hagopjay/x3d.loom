# Babylon / WebGPU bridge playbook, v3

Status: v3, 8 Nov 2026. A new file; v1 (`BABYLON-BRIDGE-PLAYBOOK.md`) and v2 (`BABYLON-BRIDGE-PLAYBOOK-v2.md`) are unchanged and still apply. v3 is the delta: what ports #7 (Gobbler Demiurge) and #8 (Dynasty Loom hypersphere) taught us, in the same trap-table shape. Read v2 section 0 (standing rules) and section 4 (checklist) first; nothing here replaces them.
Grades: C = Confirmed, L = Likely, S = Suspected. Every number names its reference (X_ITE version, Babylon 9.32.0, SwiftShader rig, correctness only).

## 1. Where each new trap bites

### 1.1 Scene graph, time and events

| Trap | Fix | Port |
|---|---|---|
| A looping TimeSensor with `startTime 0` starts at 1970 for a naive reader, so `elapsedTime` is 1.8e9 and a shader that adds `time * 0.1` to a noise coordinate loses every digit it needs (the Sun lost its granulation). X_ITE counts from activation. | Start such a sensor when the world activates (`startTime = now`). | Demiurge (C) |
| TimeSensor `pauseTime` / `resumeTime` were not read, so a camera path that the page pauses kept running. | Pause per 19775-1 8.4.6 and shift the clock by the pause on resume. | Demiurge (C) |
| A bare `Appearance` with no Material and a per-face `Color` is unlit colour in 19775-1; a reader that reads only per-vertex colour drew the 36 letters of a ring black on black. | Route it through an unlit vertex-colour program, opaque. | Demiurge (C) |
| `Inline` and `ProximitySensor` have no counterpart in Babylon; the page reads the camera through a huge ProximitySensor. | Fetch and adopt on `load`; box test of the eye in the sensor's frame, `position_changed` / `orientation_changed` while inside. | Demiurge (C) |
| `IMPORT` / `EXPORT`: a page asks `getImportedNode(AS)` for nodes that live in an Inline's world. | The shim merges the Inline's DEFs into the main scene on load; answer `getImportedNode` from `getNamedNode` when the AS name equals the exported name (it does in these scenes). The page's own wait loop covers the async load. | Dynasty (C) |

### 1.2 Camera and depth

| Trap | Fix | Port |
|---|---|---|
| One metre in a village is 0.0004 units; the default near plane (0.3) cut the Earth and the village out. | Honour the Viewpoint's `nearDistance` / `farDistance`, re-apply the camera when they change. | Demiurge (C) |
| X_ITE's logarithmic depth buffer has no Babylon counterpart. | `engine.useReverseDepthBuffer = true` (off with `?rz=0`); fragment shaders that wrote `gl_FragDepth` write the plain projected depth `c.z / c.w` (reversed depth is already in the projection). | Demiurge, Dynasty (C) |
| A proxy sphere in front of an opaque core paints its glow over the core unless it writes the depth of the true surface. | Write `fragmentOutputs.fragDepth` from the analytic entry point; keep depth *write* off on the blended material, the test still uses the written value. | Dynasty (C) |

### 1.3 Materials, blending and draw order

| Trap | Fix | Port |
|---|---|---|
| The brain body drew a textured UnlitMaterial at full opacity; the page fades portrait plates by interpolating `transparency` (14 plates showed at once). | Carry the material as a dependency, set the shader's `opacity` from `1 - transparency`, and re-apply on change. | Dynasty (C) |
| X_ITE `Appearance.alphaMode AUTO` lets X_ITE decide; the programs that write alpha 1 are opaque and write depth. | Treat AUTO as opaque for those programs; OPAQUE and BLEND as stated; keep blended shapes in document order (`alphaIndex`). | Dynasty (C) |
| `BlendMode` (ONE, ONE) on the glow layers: ignoring it drew the night look's glass black (the fragment returns `vec4(e, 1)` for additive). | Map (ONE, ONE) to `ALPHA_ONEONE`, (SRC_ALPHA, ONE) to `ALPHA_ADD`, anything else to the default with a note; re-apply when the page assigns `blendMode`. | Dynasty (C) |
| A page that probes for an X_ITE component (`getComponent`, `createNode('BlendMode')`) decides its own path from the answer. | Know which answer your shim gives: a reader that knows the node answers yes. Test both looks. | Dynasty (C) |

### 1.4 Shaders (hand ports)

| Trap | Fix | Port |
|---|---|---|
| GLSL `smoothstep(a, b, x)` with `a > b` is common and works on GL drivers; WGSL leaves it undefined. | Write it out: `t = clamp((x - a) / (b - a), 0, 1); t * t * (3 - 2t)`. | Dynasty (C) |
| `pow(x, 2.)` of a value that can be negative. | `x * x`. | Dynasty (C) |
| WGSL has no `inverse()`, no matrix / scalar divide, no implicit int-float mix. | Cofactor `inv3` for the model-view's 3x3 (ray set-up in a proxy-geometry vertex shader), multiply by `1 / det`, `f32(i)` everywhere. | Dynasty (C) |
| `uniform float u[32]` is not part of the port format. | Eight `vec4f` named `u0..u7`; one `uAt(i)` helper. | Demiurge, Dynasty (C) |
| Look constants differ per theme but the code does not; hash-keyed ports would need one per theme. | Key the port by the ComposedShader DEF and read the `const` lines out of the scene's own GLSL (a regex) into WGSL consts at material time. | Dynasty (C) |
| WebGPU window y runs down: `cross(dFdx, dFdy)` flips, dither and grain patterns mirror. | `cross(dpdy, dpdx)`; accept the mirrored pattern at the same density. | Demiurge (C) |
| A `*/` inside a block comment (a path glob) ends the comment and kills a concatenated bundle with one "Unexpected token". | `node --check` the bundle in every build. | Demiurge (C) |
| Derivatives (`fwidth`) must run before any `discard`. | Compute them first. | Demiurge, Dynasty (C) |

### 1.5 Page integration

| Trap | Fix | Port |
|---|---|---|
| The SAI shim holds one browser and one body, so a page with two views on two engines cannot move both. | Hybrid: a second custom-element name for the Babylon view (`x3d-babylon`), chosen by the shell when an adapter answers, the other view stays on X_ITE; CSS selectors name both. The page's own fallback (X_ITE for both) stays when WebGPU is absent. | Dynasty (C) |
| A hidden canvas keeps rendering. | Skip the frame when the canvas has no layout box (`getClientRects().length === 0`). | Dynasty (C) |
| X_ITE under a software GL has not settled its flights or its idle orbit when the shot is taken, so frames at the same shot name differ in pose. | Compare only shots whose reported poses match; use the page's own freeze (`A.freeze`) for the clocks. | Dynasty (C) |

## 2. Checklist additions

1. Build into a new folder, refuse an unported program (by hash, or by DEF when the programs share code), `node --check` the bundle.
2. Test every look and quality tier, not only the default.
3. List the page's probes of the engine (`getBrowserOption`, `getComponent`, `createNode`) and check what your shim answers.
4. Receipt names X_ITE version, Babylon version, rig, and which shots are poses-matched; GAPS.md grades each line.

## 3. Sources

`runs/webgpu-demiurge-20261108/` (RECEIPT, GAPS G1 to G13), `runs/webgpu-dynasty-20261108/` (RECEIPT, GAPS G1 to G14), `x3d.webgpu/demo/src/demiurge/`, `x3d.webgpu/demo/src/dynasty/`.
