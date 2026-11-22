# The Loom for glTF 2.0: scope and spec (v0.1, 20 Nov 2026)

The Loom is the accountability method of x3d.loom: **gate → render in N engines → score against a reference → receipt**, and every failure folds back into a rule. This folder ports it to glTF 2.0 to prove the method is format-agnostic, and adds a **semantic witness** so X3D meaning (Metadata, IFC, CIDOC-CRM, PROV-O) can be carried through glTF and checked on the way back.

Every number below names its instrument. Unless a row says otherwise: Chromium 157.0.8103.78 headless (Playwright), WebGL 2.0 via `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`, no GPU, Intel Xeon @ 2.10 GHz x4, 15.7 GB, Linux 6.18.44, Node v22.23.5; Khronos glTF-Validator 2.0.0-dev.3.10 (npm `gltf-validator`); Blender 5.3.0 `bpy` wheel, Cycles CPU, 64 spp + OpenImageDenoise. Runs: `runs/2026-11-20-v0/` and `runs/2026-11-20-v0-x3d-semantic/` (x3d.loom @ bada843 plus this folder, uncommitted at run time; receipts say `loom_dirty: true`). 10/10 receipts pass the JSON Schema and the sha256 seal (`tools/check_receipts.py`). Claims are graded **Confirmed** (measured here, receipt on disk), **Likely** (measured symptom, cause read from source), **Suspected** (symptom only).

---

## 1. Stage map: X3D Loom → glTF Loom

| Loom stage | X3D Loom (today) | glTF Loom (this folder) | Status |
|---|---|---|---|
| **Corpus** | project scenes, X3D Archives examples | Khronos glTF-Sample-Assets, pinned to commit `f0920f5b32d1` with sha256 per file (`corpus/manifest.json`, 7 assets) | Confirmed |
| **Gate (grammar)** | X3D XSD + x3d_mcp fork validator (fork 688174f / d5598c4 / main eb4b4b4) | Khronos glTF-Validator 2.0.0-dev.3.10 on the delivered file and on its decoded canonical form (reused from `x3d.gltf/src/validate.mjs`) | Confirmed |
| **Gate (meaning)** | x3d_mcp semantic checks | semantic rules S0-S7 (section 5) for files that carry X3D meaning; KHR_xmp_json_ld structure checked by S0 because the validator does not know that extension | Confirmed |
| **Harness** | the X3D file's own Viewpoint / lights | a harnessed copy: + one camera node + one `KHR_lights_punctual` directional key light, both at the scene root (section 3) | Confirmed |
| **Reference** | measured tables (furnace, conformance rows), X_ITE as the browser yardstick | Khronos glTF Sample Renderer 1.1.0 (`@khronosgroup/gltf-viewer`), with Blender Cycles as a second, path-traced witness | Confirmed |
| **Engines** | X_ITE, three.js, Babylon, Castle, Blender, x3d.wgpu | three.js r187, Babylon.js 9.32.0, X_ITE 16.7.1 (glb through an X3D 4.0 `Inline`), Blender Cycles 5.3.0; x3d.wgpu 0.5.1 listed as `not_run` | 4 of 5 run |
| **Score** | furnace / probe deltas, PSNR | PSNR (whole frame and foreground), SSIM (luma, 11x11 Gaussian), mean abs, over-16 fraction, silhouette IoU, all after matching the display encode (section 4) | Confirmed |
| **Receipt** | `loom.receipt/1` (kit/loomkit/receipt.py), `x3d-wgpu-conformance/1` | `loom.render-receipt/1` (schema in `schema/`), sealed with sha256 over canonical JSON, never overwritten | Confirmed |
| **Fold-back** | LEARNINGS-*.md → rules | section 7 of this file; `LEARNINGS-loom-gltf.md` at the repo root | Started |

## 2. Where "correct" is pinned

| | X3D | glTF 2.0 |
|---|---|---|
| Normative lighting model | ISO/IEC 19775-1:2023 section 17 (lighting equations), PhysicalMaterial = glTF metal-rough | Appendix B of the glTF 2.0 spec (BRDF: Lambert + GGX/Smith/Schlick, metal-rough mix) |
| Lights | in the standard (DirectionalLight, PointLight, SpotLight, EnvironmentLight in 4.0) | **not in core**; `KHR_lights_punctual` (lux / candela, inverse-square) |
| Camera / default view | in the standard (Viewpoint, NavigationInfo headlight on by default) | optional `cameras`; no default view, no headlight |
| Environment / ambient | EnvironmentLight (4.0), Background | **none in core**; every viewer brings its own IBL |
| Tone map + display encode | X3D 4.0 says the output is sRGB; X_ITE uses gamma 2.2 | **undefined**; Appendix B stops at linear radiance |

So glTF pins the BRDF and nothing around it. The Loom therefore pins the rest itself (the harness, section 3) and says so in every receipt (`format.correct_is_pinned_by`). X3D stays the reference format of the project because its ISO text defines the picture end to end; glTF needs the harness to become judgeable at all. **Confirmed** by reading both specs; the consequence is measured in section 6.

The reference renderer is not normative either. Khronos Sample Renderer 1.1.0 encodes with `pow(c, 1/2.2)` (`tonemapping.glsl`, `GAMMA=2.2`), not the IEC 61966-2-1 sRGB curve. **Confirmed** (source read in the npm package). That is why the score matches the encode before judging (section 4).

## 3. The lighting and camera contract (the harness)

| Item | Value | Why |
|---|---|---|
| Camera | perspective, yfov 0.7854 rad, aspect 1, framed by the `x3d.gltf/render/frame.mjs` rule from the ORIGINAL file's world AABB, direction (0.55, 0.35, 1), 10% margin | same camera in every engine; the Khronos renderer reads it as `cameraIndex`, the others get it explicitly |
| Key light | one `KHR_lights_punctual` directional, white, **2.5 lux**, from above-behind the camera (camera offset + (-0.6, 0.9, 0)) | glTF core has no light; 2.5 keeps white Lambert under 1.0 for every engine that follows the 1/pi convention |
| Ambient / IBL | none (Khronos: `useIBL=false`, black 16x8 environment bound, `u_EnvIntensity` forced 0; Cycles: world strength 0) | the IBL is where viewers differ most; it is a later, separate witness |
| Tone map | none, exposure 1 | linear-and-clamp is the only mapping all five share |
| Clear | #20242c, verified (32,36,44) at the corner in all five | the foreground mask needs one exact background |
| Frame | 512 x 512, MSAA on (browser), 64 spp + OIDN (Cycles) | |
| Gate | the harnessed file is validated too and must add 0 errors | 7/7 added 0 errors, 0 warnings (**Confirmed**) |

Key finding of the harness: with the same 2.5 lux sun, three.js, Babylon, X_ITE, Khronos **and** Cycles (light import mode `COMPAT`) agree within 1 to 6 levels on the lit face of the red Box. All five follow the 1/pi Lambert convention. **Confirmed** (Box receipt). Blender's glTF importer default mode `SPEC` divides lux by 683 and would render the same light 683x darker; the Loom pins `COMPAT`. **Confirmed** (importer source `io_scene_gltf2/blender/imp/light.py`, Blender 5.3.0).

## 4. The score

| Metric | Definition | Why it is there |
|---|---|---|
| `psnr_db` | RGB, whole frame | comparable with older Loom receipts; flatters small objects |
| `psnr_fg_db` | RGB, only pixels where either picture differs from #20242c | the object as either renderer drew it |
| `ssim` | luma BT.601, 11x11 Gaussian window, sigma 1.5, K1 0.01, K2 0.03 (Wang et al. 2004) | structure, not just energy |
| `mean_abs`, `over16` | mean abs delta; share of pixels with a channel delta > 16 | readable by people |
| `coverage_iou` | IoU of the two foreground masks | silhouette agreement (geometry, culling, alpha) |
| encode match | candidate foreground pixels re-encoded from the engine's encode to the reference's (byte table) | glTF does not define the encode; judging three.js's correct sRGB as "wrong" would be the Loom's error |

Display encodes, read from shipped source: **gamma 2.2** for Khronos 1.1.0, Babylon 9.32.0 (`GammaEncodePowerApprox = 1/2.2`) and X_ITE 16.7.1 (`linearToSRGB = pow(color, INV_GAMMA)`); **sRGB piecewise** for three.js r187 and Cycles (view transform Standard). **Confirmed.** Effect: matching lifts three.js on Box from 35.83 to 48.10 dB (foreground) and on DamagedHelmet from SSIM 0.9686 to 0.9893, which turns a would-be warn into a pass.

Verdict thresholds v0 (hand-set, not calibrated; **Suspected** until a calibration run): **pass** SSIM >= 0.98 and PSNR-fg >= 30 dB; **warn** SSIM >= 0.95 and PSNR-fg >= 25 dB; else **fail**.

## 5. The semantic witness (X3D meaning through glTF)

`semantic/x3dsem.py` (stdlib only) converts X3D → glTF 2.0 → X3D and checks the meaning survived.

| X3D | glTF | Notes |
|---|---|---|
| a `Metadata*` node whose host becomes a glTF node: Transform, Group, HAnim*, Collision, Anchor, Billboard, LOD, Switch, GeoLocation, Shape | `KHR_xmp_json_ld` packet on the host's glTF node | Shape metadata goes on the node that carries the mesh. **Metadata on any other host is not carried** (Material, Appearance, WorldInfo, sensors, interpolators, lights, viewpoints): measured on `semantic/fixtures/metadata-host-probe.x3d`, 3 of 5 trees and 3 of 6 nodes are dropped. The loss is not silent: S1 and S2 fail and the verdict is `fail` |
| MetadataSet / String / Double / Float / Integer / Boolean | JSON-LD `@type x3d:Metadata*`, `x3d:name`, `x3d:reference`, `x3d:value {"@list": [...]}` (ordered), nested sets, metadata-on-metadata | `@list` because JSON-LD arrays are unordered |
| `reference` = CIDOC-CRM class IRI | kept verbatim + `@type crm:E22...` | queryable without knowing X3D |
| MetadataSet `IFC` with `GlobalId`, `IfcClass` | kept verbatim + `loom:ifcGlobalId`, `@type ifc:IfcBeam` | |
| `<head>` meta, profile, version, components | asset packet: `x3d:head`, `prov:wasDerivedFrom urn:sha256:<source>`, `prov:wasGeneratedBy` | PROV-O lineage of the glTF itself |
| Transform TRS + center (scaleOrientation → matrix) | node TRS / matrix | HAnimHumanoid `joints/segments/sites` USE lists are indexes, not children |
| IndexedFaceSet, IndexedTriangleSet, Box | mesh (positions, fan-triangulated) + PBR factors | other geometry, ROUTEs, interpolators, sensors, lights, viewpoints, Inline are counted, not converted |

Rules (each has a mutation test that makes it fail, `semantic/test_x3dsem.py`, 11/11 pass):

| Rule | Checks |
|---|---|
| S0 | KHR_xmp_json_ld declared, every packet has `@context`, every packet index in range |
| S1 | every Metadata tree comes back on the same host type and DEF, in document order, value for value |
| S2 | Metadata node count unchanged |
| S3 | every IFC GlobalId survives once, is queryable in the glTF JSON-LD, and its Shape keeps the same triangle count (the element kept its body) |
| S4 | every CIDOC-CRM reference survives and is typed `crm:E..` in JSON-LD |
| S5 | `<head>` meta list survives in order |
| S6 | asset packet carries PROV-O derivation (source sha256) and generation |
| S7 | `.gltf → .glb` through glTF-Transform 4.5.1 keeps every packet byte-equal (canonical JSON) and every node reference |

Results are in section 6b. The semantic verdict is a separate field of the same receipt (`verdict.semantic`), next to the visual scores.

### 5b. The extras lift (Blender glTF extras into packets)

`semantic/blender_extras.py` (stdlib only) reads a glTF or glb that Blender's exporter wrote with custom properties on, after an import through x3d-blender-io 2.6.5 or later, and turns each Metadata tree it finds in `extras` into a `KHR_xmp_json_ld` packet on the same glTF object. It only adds: extras, geometry and the binary chunk stay as they were.

| extras key | on | packet goes on | host kind |
|---|---|---|---|
| `x3d_transform_metadata` | node | the node | `node:Transform`, DEF = last segment of `x3d_def_path` |
| `x3d_metadata` | node | the node | `node:Shape` |
| `x3d_metadata` | material | the material | `material` (the extras do not say which material node type) |
| `x3d_scene_metadata[]` | scene | the scene | the entry's `host` (WorldInfo, sensors, ...) |

Material and scene packets are the two hosts x3dsem 0.1.0 does not carry (section 5, first row); through this path they arrive.

| Rule | Checks |
|---|---|
| L0 | KHR_xmp_json_ld declared, every packet has `@context`, every packet index in range |
| L1 | every Metadata tree of the source X3D is a packet on the same kind of host with the same DEF, value for value |
| L2 | Metadata node count equals the source's |
| L3 | every CIDOC-CRM class reference of the source is typed `crm:E..` in JSON-LD |
| L4 | numbers in numeric Metadata packets are JSON numbers, booleans JSON booleans (extras hold X3D text) |
| L5 | additive: the output without the extension equals the input |
| L6 | asset packet carries PROV-O (sha256 of the input glTF, the lifter) |

L1 to L3 need the source X3D; without it they report "not run", never pass. Each rule has a mutation test (`semantic/test_blender_extras.py`, 17/17 pass).

First result, **Confirmed** on one scene (Fault Lab clean twin, Blender 5.3.0 `bpy`, x3d-blender-io f68adbd; fixture `semantic/fixtures/blender-twin.glb`): 3 of 3 trees and 6 of 6 Metadata nodes lifted, L0 to L6 pass, binary chunk byte-identical, glTF-Validator 2.0.0-dev.3.10 reports 0 errors and 0 warnings before and after (one more info line, `UNSUPPORTED_EXTENSION`), Babylon.js 9.32.0 loads 12 meshes from both files. Shown in x3d.demo `fault-lab/v3`. Not handled: metadata-on-metadata (the add-on does not keep it; L1 and L2 fail on it).

## 6. First run (runs/2026-11-20-v0, 7 assets x 4 engines = 28 scored runs)

Encode-matched SSIM / PSNR-fg (dB), verdict:

| Asset (what it stresses) | three r187 | Babylon 9.32.0 | X_ITE 16.7.1 | Cycles 5.3.0 |
|---|---|---|---|---|
| Box (minimal) | 0.9996 / 48.10 pass | 0.9999 / 51.39 pass | 1.0000 / 103.69 pass | 0.9887 / 39.57 pass |
| BoxTextured (sRGB texture) | 0.9969 / 38.16 pass | 0.9971 / 38.29 pass | 0.9999 / 45.56 pass | 0.9878 / 36.11 pass |
| Duck (texture + node scale) | 0.9994 / 44.37 pass | 0.9997 / 45.44 pass | 0.9996 / 41.65 pass | 0.9726 / 20.91 **fail** |
| MetalRoughSpheresNoTextures (the BRDF) | 0.9856 / 27.32 warn | 0.9878 / 27.48 warn | 0.9976 / 35.86 pass | 0.9013 / 19.77 **fail** |
| NormalTangentMirrorTest (tangent handedness) | 0.9762 / 28.50 warn | 0.9150 / 19.80 **fail** | 0.9891 / 31.54 pass | 0.9563 / 27.26 warn |
| AlphaBlendModeTest (OPAQUE / MASK / BLEND) | 0.9986 / 39.88 pass | 1.0000 / 61.72 pass | 0.9581 / 22.73 **fail** | 0.9663 / 21.59 **fail** |
| DamagedHelmet (full texture set) | 0.9893 / 31.17 pass | 0.9891 / 30.05 pass | 0.9783 / 27.36 warn | 0.9539 / 24.54 **fail** |
| **Totals** | 5 pass, 2 warn | 5 pass, 1 warn, 1 fail | 5 pass, 1 warn, 1 fail | 2 pass, 1 warn, 4 fail |

Gate: 7/7 pass, 0 errors; DamagedHelmet has 1 warning (`MESH_PRIMITIVE_GENERATED_TANGENT_SPACE`, "runtime-generated tangent space may be non-portable"). Timing per asset ~47-79 s, of which the Khronos renderer's first frames take ~40 s (shader compile on SwiftShader).

What the run says:

1. **X_ITE is the closest engine to the Khronos reference** on 5 of 7 assets, bit-identical on Box (mean abs 0.000). Both use gamma 2.2 and the same Appendix B BRDF. **Confirmed.**
2. **Babylon on NormalTangentMirrorTest** draws bright specular highlights on the right-hand panel where Khronos and Cycles both draw near-black. Babylon is the outlier against both references. Outlier **Confirmed**; cause (tangent-space or punctual-specular handling for the mirrored set) **Suspected**.
3. **X_ITE on AlphaBlendModeTest** differs on every panel including OPAQUE: label text and marble come out darker and sharper, stripes alias. Symptom **Confirmed**; cause texture minification / mipmap filtering **Suspected**.
4. **Cycles fails where it should**: it is a path tracer and casts shadows (the Duck's head on its body, sphere-on-sphere occlusion) that no raster engine in this run draws. It is the second witness, not a candidate; its scores say how far the raster reference is from light transport. **Confirmed** by eye on the contact sheet (`runs/2026-11-20-v0/contact-sheet.png`).
5. **three.js and Babylon warn on the BRDF sweep** (MetalRoughSpheres, 27.3 / 27.5 dB) while X_ITE passes at 35.9 dB. The deltas sit on the rough-metal spheres. **Confirmed** symptom; cause (specular / multi-scatter approximations) **Suspected**.

### 6b. Semantic + visual run (runs/2026-11-20-v0-x3d-semantic)

Three project X3D scenes (x3d.demo main) went X3D → glTF (KHR_xmp_json_ld) → glb → X3D, and the glb went through the same visual Loom. One receipt each, `verdict.semantic` next to `verdict.subject`.

| Scene | Hosts | Metadata nodes | Domain ids | Packets | S0-S7 | Visual (three / Babylon / X_ITE / Cycles vs Khronos) | Engines vs each other |
|---|---:|---:|---|---:|---|---|---|
| Demo 61 Walking Twin `twin.x3d` | 24 Shapes | 192 | 24 IFC GlobalIds (queryable as `loom:ifcGlobalId`, typed `ifc:IfcBeam`...) | 25 | **8/8 pass** | 0.9954 / 23.36, 0.9948 / 22.65, 0.9952 / 21.93, 0.9887 / 22.13: all fail | agree (SSIM 0.9993-0.9999): **reference suspect** |
| Demo 46 heritage-geo v3 `giza-provenance-twin.x3d` | 4 Transforms | 66 | 9 CIDOC-CRM class refs (typed `crm:E22`...) + Pleiades IRIs | 5 | **8/8 pass** | 0.9985 / 36.6, 0.9985 / 36.5, 0.9985 / 36.51, 0.9982 / 36.25: all pass | agree (SSIM 1.0000) |
| Demo 46 heritage-geo v3 `burruss-geo.x3d` | 1 Transform | 9 | IFC placement label | 2 | **8/8 pass** | 0.9747 / 19.07, 0.9651 / 17.32, 0.9766 / 19.21, 0.9781 / 21.01: all fail | three = X_ITE (0.9996 / 44.66 dB), Babylon apart (23.98 dB) |

Semantic: **Confirmed** lossless on all three (every Metadata tree, value for value, back on the same host; 24/24 IFC ids keep their element and its triangle count; 9/9 CRM refs; head meta; PROV-O lineage; packets byte-equal through glTF-Transform 4.5.1). The converter writes geometry without normals (legal: glTF says clients MUST compute flat normals) and the transparent Burruss box is double-sided BLEND.

Visual: on those normal-less meshes the **Khronos Sample Renderer 1.1.0 is the outlier**: the twin's station comes out darker and the Burruss box's back faces black, while three.js, Babylon and X_ITE agree with each other at SSIM >= 0.9993 on the twin. Outlier **Confirmed**; cause (flat-normal generation or back-face lighting in the reference for double-sided, normal-less primitives) **Suspected**. This is why the receipt now carries a **consensus** block (R-GLTF-8): when every raster candidate passes against the others and two or more fail against the reference, the subject verdict is `reference-suspect`, not `fail`.

Repeatability: the corpus run was executed twice (the first was cut by a session restart after 3 assets); every SSIM and PSNR printed for those assets was identical to the last digit. **Confirmed** (same container, SwiftShader is deterministic here).

## 7. Fold-back rules (first set)

| Id | Rule | Source |
|---|---|---|
| R-GLTF-1 | Every glTF render receipt names the display encode of each engine; judge after matching the encode | section 4 |
| R-GLTF-2 | Never compare glTF renders without a harness: pin camera, lights, ambient, tone map and clear in the file or the receipt | section 2 |
| R-GLTF-3 | Import glTF lights into Blender with `COMPAT`, not the default `SPEC` (683x) | section 3 |
| R-GLTF-4 | A path tracer is a witness, not a candidate, until raster engines draw shadows | section 6, item 4 |
| R-GLTF-5 | glTF-Validator 2.0.0-dev.3.10 is blind to KHR_xmp_json_ld: the semantic gate must check packet structure itself (S0) | section 5 |
| R-GLTF-6 | Carry X3D Metadata as JSON-LD with `@list` values and lifted IRIs, read back only the X3D-exact terms | section 5 |
| R-GLTF-7 | Treat a validator warning about generated tangents as a render-risk flag: the Loom measured it on DamagedHelmet (spread 0.9783-0.9893 SSIM across engines) | section 6 |
| R-GLTF-8 | Score the candidates against each other too; if they agree and fail the reference, suspect the reference (`verdict.subject = reference-suspect`) | section 6b |

## 8. Shared receipt: `loom.render-receipt/1`

One receipt per subject per run, schema in `schema/loom.render-receipt-1.schema.json`. Top level: `format` (with `correct_is_pinned_by`; x3d.wgpu writes `format` as a plain string, same values), `subject` (sha256 + corpus repo/commit/path), `gate` (validator name/version/commit, counts, issues, `harnessed_counts`), `harness`, `semantic` (null or `loom.semantic/1`), `reference`, `runs[]`, `thresholds`, `consensus` (candidate-vs-candidate scores, `reference_suspect`), `verdict` (`subject`, `semantic`), `host_machine`, `tools`, `grade`, `limitations`, `written_at`, `prev`, `signed:false`, `sha256`.

Each run row: `engine {id,name,version}`, `status` (pass / warn / fail / error / not_run / reference) with `reason`, `host {kind,name,version,user_agent}`, **`gpu {api, adapter, backend, device_type, driver, driver_info}`** = the `adapter` block of `x3d-wgpu-conformance/1` (wgpu `AdapterInfo`) plus `api`, **`api_validation {layer, layer_version, enabled, errors, warnings, message_ids, log_sha256}`** = the block x3d.wgpu now writes (main, `docs/RECEIPT-SCHEMA.md`, `x3d-wgpu-conformance/2`), field for field, including `mode`, `requested`, `unexpected_errors`, `known_errors`, `suppressed_by_engine`, `attribution` (`layer: VK_LAYER_KHRONOS_validation`; WebGL engines report `layer: null` and count GL errors from the console), `encode`, `output`, `score {vs, raw, encode_matched, judged_on}`, `console`, `timing_ms`.

| loom.render-receipt/1 | x3d-wgpu-conformance/1 | loom.receipt/1 (kit) |
|---|---|---|
| `runs[].gpu.*` | `adapter.{name→adapter, backend, device_type, driver, driver_info}` | – |
| `runs[].engine` | `renderer {tool, version}` | `tools` |
| `gate.validator` | `validator` | `witnesses` |
| `runs[].status` | `rows[].verdict` (pass / fail / not run / blocked) | `witnesses[].ok`, `not_run` |
| `subject.sha256` | – | `candidate_sha256` |
| `sha256`, `prev`, `signed:false` | – | same |

## 9. Scope: what is in, what is next

| In v0.1 (this PR) | Next |
|---|---|
| 7 pinned assets, 5 renderers, 28 scored runs | the full Sample-Assets core set (~70 static assets), animated + skinned with fixed time |
| SwiftShader only | a real-GPU receipt (his PC / G4), same receipts, `gpu` block changes |
| no IBL | an IBL witness: one shared HDR, KHR_PBR_NEUTRAL tone map, all engines |
| thresholds hand-set | calibration: thresholds from the distribution of engine-vs-engine spread |
| x3d.wgpu `not_run` | x3d.wgpu glTF route (Inline of a glb via the `gltf` crate), then its VVL result fills `api_validation` |
| Castle not wired | Castle Game Engine glTF loader as a native engine row |
| semantic: Metadata, IFC, CIDOC-CRM, PROV-O | IFC property sets from the .ifc itself (IfcOpenShell), Pleiades / Wikidata IRIs, a SHACL shape for the packets |
