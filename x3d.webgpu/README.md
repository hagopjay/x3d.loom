# x3d.webgpu: a specification scaffold for X3D on WebGPU

Date 2026-11-06. Status: **spec scaffold, docs only, no build yet.** Nothing in this folder runs. It records what is true today, what an X3D renderer on WebGPU must do to be trusted, the paths to one, and the gates that decide when building starts.

Grades follow the Loom: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected.

## The verdict

No X3D runtime ships a WebGPU renderer as of 2026-11-06. X_ITE, the reference browser this project renders with, is at 16.7.0 (npm, 2026-10-31) and is WebGL2-only: one `getContext("webgl2")` call, no fallback, 0 "webgpu" strings in its bundle, source, issues, PRs, commits and release notes, and 1,396 direct `gl.*` call sites with no rendering layer between them (C). X3D itself cannot yet name a WebGPU shader: the 4.1 draft lists only Cg, GLSL and HLSL, and only VERTEX and FRAGMENT parts (C, X3DUOM 4.1 generated 2026-10-31). WebGPU, meanwhile, is on by default in Chrome and Edge since 113, Firefox on Windows since 141 and Safari since 26, but not in stable Firefox on Linux or Android, Chrome on Windows ARM64, or most Linux GPUs (C, gpuweb wiki), so WebGL2 stays required. The recommended path is **F, the hybrid**: X_ITE stays the truth renderer, and a renderer-agnostic X3D runtime with a Babylon WebGPU body ([BABYLON.md](BABYLON.md), path G) renders showpieces, each gated by pixel parity and event-trace equality against X_ITE ([PATHS.md](PATHS.md); F scores 30 of 35, efforts S). Babylon is the default body only because it alone among the engines surveyed can carry X3D GLSL shaders onto WebGPU (L, files present, not executed). No speed claim stands yet: the only real-GPU number is a vsync-capped 59.7 fps median on the owner's Intel UHD 620 (C for that machine).

## Files

| file | what it is |
|---|---|
| [SPEC.md](SPEC.md) | **The normative scaffold.** Goals, non-goals, terms, 5 conformance levels (L0 static Interchange to L4 Immersive-plus, mapped to X3D profiles and components), 106 numbered requirements in 11 groups (R-PARSE, R-SCENE, R-EVENT, R-SAI, R-RENDER, R-SHADER, R-SPLAT, R-PICK, R-PERF, R-TETHER, R-SEC), each with MUST, SHOULD or MAY, a rationale and a verification method; 32 TBD items with owners left blank (TBD-04 closed on 2026-11-06) |
| [STATE.md](STATE.md) | X_ITE today (scorecard, cadence, coupling, roadmap evidence), the X3D runtime field, the spec status, the comparables, the WebGPU platform matrix, the owner's machine, the sandbox probe |
| [PATHS.md](PATHS.md) | Options A to G scored, what each keeps and loses, the component-to-WebGPU map and field-level friction, KHR_interactivity against ROUTE, the GLSL to WGSL and TSL port notes, the recommendation |
| [BABYLON.md](BABYLON.md) | **Path G**, written separately: how Babylon.js should speak X3D (a renderer-agnostic TypeScript X3D runtime plus a thin Babylon SceneLoader plugin; 17.5 to 32 person-weeks for the project's scenes, 25.5 to 52 for roughly X_ITE's coverage) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | **Path E**: the Rust/wgpu design (layers, crate layout, event model, SAI, renderer passes, tether hooks), milestones M0 to M6 with gates, risk register |
| [BENCHMARK.md](BENCHMARK.md) | The Dirac collider benchmark: the scene measured, six arms in two 2x2s, a track ladder to 100k, the harness, metrics, fairness rules, the decision rule, an empty results table |
| [bench/receipt.schema.json](bench/receipt.schema.json) | JSON Schema (draft 2020-12) for one benchmark run receipt, `x3d.bench/1`; data only |
| [bench/webgpu-probe.html](bench/webgpu-probe.html) | gate G1 probe: one self-contained page that asks for a WebGPU adapter and lists its features and limits; no timings, no network |
| [bench/receipts/](bench/receipts/) | probe and run receipts; `g1-probe-2026-11-07.json` is the owner machine's G1 result |
| [demo/](demo/) | **First light**: one self-contained page that parses an X3D 4.0 scene, runs its events and draws it with WebGPU (no libraries, no network); see [demo/README.md](demo/README.md) |
| [HYPER.md](HYPER.md) | 17 far-out ideas ranked, each with an X3D node sketch and a first experiment; the top three can start with no paid services |
| [SOURCES.md](SOURCES.md) | Every source, how it was read (opened, measured, local, search only, notes) and its as-of date, grouped by file |

## Decision gates

Building starts only after G0 to G2. Owners are left blank. Status on 2026-11-07: G1 passed; G0 is deferred by the owner ("probe only, decide later"), so no timing runs anywhere yet.

| gate | question | pass condition | evidence it produces | owner |
|---|---|---|---|---|
| **G0** consent | May any timing run on the owner's machine? He asked that his GPU not be used for metrics (S, project note, 28 Oct) | his explicit yes on one decision card: (a) his PC as a ratio-only floor machine, (b) another machine with a discrete GPU, (c) wait | `machine.consent` in every receipt (the schema refuses a floor-machine receipt without it) | |
| **G1** adapter | Does Chrome 156 on his UHD 620 give a WebGPU adapter, and with which features and limits? | a probe page served from file:// or localhost, never about:blank (C: `navigator.gpu` is absent there) | **passed 2026-11-07 (C):** a hardware Intel gen-9 adapter (not the fallback), device opened; `shader-f16` and `timestamp-query` on, `subgroups` off; receipt `bench/receipts/g1-probe-2026-11-07.json` from `bench/webgpu-probe.html` | |
| **G2** shaders | Do the Collider's ComposedShader programs compile through the default body's GLSL path (Babylon glslang plus twgsl, self-hosted) and match X_ITE? | 0 compile errors and `parity/look` (SPEC R-TETHER-04) on the hero scene | picks the body: Babylon (G) on pass, three.js with hand TSL or WGSL (C) on fail | |
| **G3** benchmark | Is the WebGPU body faster where it matters? | the four-clause rule in BENCHMARK.md section 9 | Go, No-go or Inconclusive, with receipts | |
| **G4** parity, per showpiece | Is the showpiece what X_ITE shows? | `parity/look` on three views, event traces equal, 0 blank frames, a load receipt with every approximation coded | the showpiece may ship on WebGPU | |
| **G5** standard | Can X3D name WGSL and COMPUTE? | a proposal with an example scene sent to the Web3D X3D working group (SPEC TBD-11) | until then `language="WGSL"` is a flagged project extension | |
| **G6** native | Start the Rust/wgpu track (path E)? | the TypeScript runtime's IR passed its M2 (BABYLON.md), or a recorded decision to go native first | ARCHITECTURE.md M0 | |

Standing watch, not a gate: once a month, download the latest `x_ite` tarball and grep it for `webgpu`, `navigator.gpu` and `wgsl`, and rerun the GitHub search counts, so "is WebGPU coming to X_ITE" stays a dated measurement.

## Milestone tracks

| track | milestones | to the first showpiece | to roughly X_ITE coverage | where |
|---|---|---|---|---|
| F on G (recommended) | M0 codegen and parsers, M1 static body, M2 events, M3 sensors, M4 Script, SAI, PROTO, M5 shaders and the Collider, M6 PBR extras, IBL, H-Anim, splats, M7 long tail, M8 glTF export | 8.5 to 15 pw (M0, a static subset, M2, M5, the parity harness) | 25.5 to 52 pw | [BABYLON.md](BABYLON.md) section 10 |
| E (deferred) | M0 triangle, M1 static Interchange, M2 events, M3 Collider parity, M4 Immersive subset, M5 glTF, splats, H-Anim, M6 native and CI | M0 to M3: 25 to 43 engineer-weeks | M0 to M4: 40 to 70 | [ARCHITECTURE.md](ARCHITECTURE.md) section 7 |

Every effort figure is S: nothing has been built and timed. Compare tracks by ratio.

## How it ties to the tether

The project's thesis is that X3D is the 3D format an AI can be held accountable to: a model writes, the validator says exactly what is wrong, the model repairs, the browser shows, Blender round-trips. A second renderer is only worth having if it keeps that loop honest:

```
 a hosted model writes X3D
        |
        v
 validator (x3d_mcp fork, kit/loom grammar and traps) --codes--> repair
        |  + portability lint: valid is not the same as portable  (R-TETHER-06)
        v
 X_ITE (pinned)  ---- truth frame + event trace ----+
        |                                           |
 runtime + WebGPU body --- showpiece frame ---------+--> parity witness  (R-TETHER-04, 05)
        |                                           |
        +-- load receipt: mapped | approximated | dropped, with codes  (R-TETHER-01)
        +-- render report: backend, draws, pixels per DEF, blank flag   (R-TETHER-02)
        |
        v
 every code goes back to the model in the validator's shape  (R-TETHER-03)
```

Three rules carry the thesis into rendering. A lossy mapping is never silent: it gets a stable code (R-PARSE-07, R-SHADER-04). A blank frame is a failure even when the file validates, because valid is not the same as visible (R-TETHER-08). And a speed claim needs a receipt from a named real GPU, never from the software-rendered sandbox (R-PERF-01, R-PERF-02).

One finding cuts against the project's own showpiece: the Collider depends on BlendMode and DepthMode, which exist only in X_ITE (C, absent from X3DUOM 4.1). It is valid to X_ITE and not portable X3D. The lint should say so, and SPEC section 4 counts it at L4 only with the X_ITE compatibility flag on.
