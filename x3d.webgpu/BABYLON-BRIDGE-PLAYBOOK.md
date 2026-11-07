# Babylon / WebGPU bridge playbook

Status: v1, 7 Nov 2026. Consolidates what ports #1 and #2 and the quick wins taught us. Docs only, $0 spend.
Grades: C = Confirmed, L = Likely, S = Suspected. Every number names its reference (X_ITE version, Babylon version, rig).

## 0. The three rules (Loom laws 38 to 40)

| Law | Meaning in practice |
|---|---|
| 38 One master, many renderers | The `.x3d` file is the source of truth. X_ITE is the reference renderer; Babylon and the hand-written WebGPU viewers are bodies that must agree with it. Never edit the scene to please one renderer. |
| 39 A look may add but never assert | A renderer look (bloom, tone map, glare, HDR) can decorate, but must be switchable off to an "As authored" mode that matches the reference. Never present a look as the scene's own claim. |
| 40 A fallback must say so | If a shader hash misses, a node is unsupported, or the adapter is a software one, the page says so on screen. No silent degradation. |

Standing rules for this track: no timings while gate G0 (owner consent to use the GPU for metrics) is open; sandbox numbers are correctness only; never overwrite, every demo and doc is a new versioned file; nothing vendor-, model-, project-id- or private-link-bearing on public pages.

## 1. Map of what exists (all in hagopjay/x3d.loom, `x3d.webgpu/`)

| Piece | PR | What it is |
|---|---|---|
| Spec + scaffold | #7 | SPEC, PATHS, BABYLON, ARCHITECTURE, BENCHMARK, gates G0 to G6. Verdict: path F on G (X_ITE stays truth; renderer-agnostic runtime plus a Babylon WebGPU body for showpieces). |
| First-light viewer | #8 | Own tiny X3D runtime + core WebGPU, no libraries. Collider look v3 with 5 GLSL shaders hand-ported to WGSL. |
| Collider v2 | #10 | HDR + bloom look, "As authored" toggle, live on the dirac Pages site. |
| Pantheon splats (port #1) | #11 | GaussianSplats, GPU bitonic depth sort, 50.2 / 51.0 dB vs X_ITE 16.4.3 (C, SwiftShader, 960x540). |
| Quick wins | #12 | `build-events.py`: five HEP event pages; synthetic 140k-splat heritage facade at 41.9 dB vs X_ITE 16.4.3. |
| Brain on Babylon (port #2) | #13 | Babylon 9.32.0 body + our X3D reader + SAI shim; 21.5 to 35.1 dB per layer vs X_ITE 16.6.0 (C, SwiftShader, 640x360). |
| Adapter fallback | #14 | Viewers retry `requestAdapter()` without options before giving up. |

Pipeline shape for a Babylon port:

```
scene.x3d --> reader.js (our X3D parser, DEF/USE, ROUTEs) --> body.js (Babylon meshes/materials/lights)
                   |                                              ^
                   +--> sai.js shim (X3D.getBrowser().*) ---------+  app.js runs unchanged
shader nodes --> FNV-1a hash of whitespace-collapsed GLSL --> hand-ported WGSL (wgsl.js)
```

Babylon is the body, never the parser: native X3D runtime plus a thin loader, not an export through glTF (glTF drops ROUTEs, Scripts and shader nodes).

## 2. How to port an X3D / X_ITE demo to Babylon

1. **Census first.** Count node types in the scene against the bridge's coverage (42 of 260 X3D 4.0 node types plus 5 hash-matched GLSL ports as of main 8f400d0, C). Scenes that already fit are cheap; the shared gates are textures, Text/FontStyle, IndexedLineSet/PointSet, Inline, GaussianSplats, HAnim, Geo. Efforts are guesses (S).
2. **Reuse, do not rewrite.** Copy the brain layout: `reader.js`, `body.js`, `body-cam.js`, `sai.js`, `wgsl.js`, `boot.js`. The demo's own `app.js` should run unchanged against the SAI shim; if you must patch `app.js`, that is a finding to record.
3. **Pin the library.** Babylon from a CDN pinned to the exact version (9.32.0 for the brain) with SRI. A single-file page works offline-after-load.
4. **Shaders by hash.** Hash the whitespace-collapsed GLSL with FNV-1a; look up a hand-ported WGSL by key. A miss falls back to no shader and says so on screen (law 40). Keep the key list in the README so edits are detectable.
5. **Port the look separately from the scene.** Scene fidelity first (matches X_ITE), then optional look layers (law 39).
6. **Measure** (section 3), record a RECEIPT in `runs/<name>-<date>/`, then publish (section 5).

### Babylon traps (all Confirmed on the brain port)

| Trap | Fix |
|---|---|
| PhysicalMaterial colours are linear | Convert authored sRGB colours before assigning. |
| X3D counter-clockwise = front face | Set `sideOrientation = CounterClockWise` for PBR. A cool, inside-out looking surface is this, not lighting. |
| `alphaIndex` defaults to MAX_VALUE | Sprites drew over glass. Set explicit alpha indices to control draw order. |
| `billboardMode` faces the wrong way in a right-handed scene | Orient billboards yourself each frame. |
| Unlit text colour | Use `emissiveColor`. |
| Clip planes | `material.clipPlane` is per material; `scene.clipPlane` clips everything. |
| Transform `center` / `scaleOrientation` | Use `toRotationMatrix`, not `Matrix.FromQuaternion`. |
| Line set with no Color node | Uses the Material `emissiveColor`. |
| Viewpoint inside a rotated Transform | Apply the parent rotation (the v2 collider viewer missed this; v3 fixed it). |
| Zoom divides by zero with the eye at the centre of rotation | Clamp distance. |
| First Light V1 loses `touchTime` when a press lasts more than one frame | Fixed in v1.1; latch the press. |

Not yet done in the Babylon body: Sound/AudioClip, Layout/ScreenGroup, bloom/HDR, Transform shear.

## 3. How to measure PSNR against X_ITE

Goal: correctness evidence, not speed. State both renderers and the rig with every number.

1. Render the **same scene file, same viewpoint, same resolution** in X_ITE (record the version: 16.4.3 for Pantheon and the facade, 16.6.0 for the brain) and in the bridge page.
2. Use the "As authored" look only; look layers off.
3. Compute PSNR on 8-bit RGB (also luma correlation if useful). Report per layer when a scene stacks layers (brain: glass 35.1, wet 30.5, deep 31.5, torso 30.3, tracts 22.5, slices 25.7, labels 21.5 dB vs X_ITE 16.6.0, SwiftShader, 640x360).
4. Layers that differ in detail (tracts, slices, labels) score lower by construction: say so, do not tune to the metric.
5. Event-driven scenes (HEP events) grow over time: capture with a delay, or hash the scene file against the committed `scenes.sha256` instead.

Headless harness (needed because headless Chrome here cannot present a WebGPU swap chain; "Instance dropped" on every pipeline):

- stub the canvas context with an offscreen texture (`stub-swapchain.py`);
- slow `requestAnimationFrame` (600 ms for the splat viewers, 1.2 s for the Babylon brain) or frames pile up and the read-back waits more than 10 minutes;
- read back via `__demo.capture`.

Scripts: `runs/webgpu-pantheon-splats-20261107/`, `runs/webgpu-brain-20261107/`, `runs/webgpu-quick-wins-20261107/` (capture.js).

**Timings stay off.** SwiftShader fps is meaningless and G0 (owner consent to use the GPU for metrics) is open. G3, the benchmark go rule (B p95 at most 0.70x A and at most 0.85x C), only runs after the owner decides.

## 4. Pitfalls

### 4.1 No WebGPU adapter on some Windows machines

Symptom: "requestAdapter() returned no adapter" or "WebGPU not available", with `high-performance` and plain requests both returning null.

Cause (C, Chrome 156 about:gpu on an Intel gen-9 laptop GPU): Dawn lists the integrated adapter only on the D3D11 backend and marks it blocklisted ("D3D11 backend not fully implemented", crbug.com/41479539); the only other adapter is the CPU Basic Render Driver, also blocklisted. So every `requestAdapter()` returns null. The earlier theory (viewer only asked for `powerPreference: high-performance`) was wrong for this case; the PR #14 retry is harmless but not the cure.

Fix that worked: open `chrome://flags/#enable-unsafe-webgpu`, set Enabled, relaunch the browser. A Mac with a normal Metal adapter was fine. Edge or another machine are alternatives. An earlier probe on the same hardware had passed (G1, 7 Nov), so browser state had differed at that time (cause unknown).

Every public WebGPU page should show this tip when `requestAdapter()` is null, and should say which adapter it did get (law 40).

### 4.2 Other pitfalls

- **Edited GLSL falls back to no shader.** By design (X3D 31.2.2); say so on the page.
- **BlendMode / DepthMode are X_ITE-only nodes.** The 4.0 DTD/XSD reject them; expected, note it in the validation line. There is no WGSL/COMPUTE field in X3D (proposal gate G5 needs the owner's explicit go-ahead).
- **Official XSDs reject ParticleSystem with physics** (see the xsd particle-physics note in project memory).
- **Tone-map choice changes the picture.** Neutral at 1.65 turned the Collider towers pink (13.9% vs 1.2% pink crown); the kept default is per-channel exp at 1.35.
- **fp16 clamp** at 8192 and a 2.2 Mpx budget in the first-light core; SpotLight 4.0 defaults and headlight default were review fixes.
- **Third-party data licences.** The brain page embeds a lite cortex whose licence is Suspected: keep such pages private or credit and flag them; do not commit the scene to a public repo without a decision.
- **Stamping.** PNG/JPEG/SVG written to the shared project folder get a vendor-naming provenance block within 15 s. Build and sweep in scratch, hand over as a tar plus sha256.

## 5. Publishing to x3d.demo with versioning

Repo: public `hagopjay/x3d.demo`, Pages from `main` `/docs`. Only the site-owner thread pushes there; finished ports are routed to it.

Layout:

```
docs/index.html                 newest doc (copy of latest docs/versions/vN)
docs/versions/vN/               frozen doc versions
docs/demos/<name>/vN/index.html one folder per demo version, NEVER overwritten
docs/demos/SOURCES.md           where each demo's bytes came from
CHANGELOG.md
```

Steps for a new port:

1. Build the single-file page from `x3d.loom` (`build-*.py`; `python3 -I src/build.py`-style builders rebuild byte for byte). Copy the NOTICE/licence files with it.
2. Put it in a **new** `docs/demos/<name>/v1/` (or vN+1 for a revision). Add a new doc version `docs/versions/vN` and update `docs/index.html`; add a CHANGELOG line and a SOURCES row.
3. **Leak sweep on the served bytes**, not just the source: no model or vendor names, no cloud project id or run-as identity, no cost figures, no private links, no unpublished-plate material, no keys. Check the built page and any embedded metadata.
4. State on the page what it is and is not: renderer and version, "correctness evidence, no timings", the WebGPU flag tip, the fallback notice.
5. Commit trailer-free as the shared public-commit identity; open a PR; merges are quick. Verify the live URL after Pages builds.

Demos live so far: Collider events x5, heritage facade, Neural Canvas (brain + torso CT, v1). Next in the owner's order: Gobbler v3 (on hold), then Babylon integration with the drift (KANSEI) showpiece, whose simulation stays separate from the picture rather than using Babylon physics.

## 6. Checklist for the next Babylon port

- [ ] Node census against the bridge; list missing nodes and their effort (S).
- [ ] Reuse reader/body/SAI shim; `app.js` unchanged or the patch recorded.
- [ ] Babylon version pinned with SRI; shader keys hashed and listed.
- [ ] "As authored" matches X_ITE (version named); look layers optional.
- [ ] Per-layer PSNR table, rig named, no timings.
- [ ] On-screen fallback notices and the `chrome://flags/#enable-unsafe-webgpu` tip.
- [ ] RECEIPT in `runs/<name>-<date>/`; scene licence decision recorded.
- [ ] New versioned folder in x3d.demo; leak sweep on served bytes.

## 7. Sources

x3d.loom PRs #7, #8, #10, #11, #12, #13, #14; `x3d.webgpu/{README,SPEC,BABYLON,PATHS,ARCHITECTURE,BENCHMARK,STATE}.md`; run receipts under `runs/webgpu-*`; project memory notes on the renderer spec, each port, the port assessments, the adapter blocklist and the demo repo.
