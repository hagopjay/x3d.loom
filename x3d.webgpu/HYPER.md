# Hyper theoreticals: X3D rendering in the AI era

Date 2026-11-06. Status: ranked ideas with node sketches and first experiments, nothing built. Every node and field below is a **proposal**: none is in any X3D specification, and each would ship first as a flagged project extension (SPEC.md R-SHADER-05, R-SPLAT-08).

Grades: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected. arXiv references were opened at arxiv.org/abs (C that each exists with the title given); a rating (crazy, payoff) is a judgement (L).

**The answer.** Of 17 far-out ideas, three can start this week with no paid services and have the largest payoff: (1) the **shader tether**, (2) **GaussianSplats with a url and a splat budget**, (3) an **X3D conditioning pack** for image and video models. The ground is solid: KHR_gaussian_splatting reads "Complete, Ratified by the Khronos Group" (C, glTF main, 2026-11-06); OpenUSD 26.03 (2026-02-24) added `UsdVolParticleField3DGaussianSplat` (C, CHANGELOG); X3D 4.1's GaussianSplats node has 29 fields, all inline arrays, with no url, kernel, projection or sortingMethod (C, X3DUOM 4.1 generated 2026-10-31, md5 5d81124d); and the 4.1 shader enums still stop at Cg, GLSL, HLSL and VERTEX, FRAGMENT (C).

## 1. Splats today: spec, X_ITE and glTF

| item | X3D 4.1 (X3DUOM, XSD) | X_ITE 16.7.0 | KHR_gaussian_splatting |
|---|---|---|---|
| data | MFVec3f positions, scales; MFQuaternion orientations; MFFloat opacities; 16 MFVec3f SH fields (C) | the same 29 fields (C) | accessors, float32 or quantised (C) |
| external file | none on the node (C) | PLY binary parser and the glTF loader create GaussianSplats; no SPZ parser (C) | glTF buffers; the SPZ child extension is not on glTF main (L: 404 there, named in a cesium-native reference) |
| kernel, projection, sort | absent (C) | n/a | `kernel` required ("ellipse"); `projection` default "perspective"; `sortingMethod` default "cameraDistance" (C) |
| `pointerEvents`, `castShadow` | default TRUE, TRUE (C) | **FALSE, FALSE** on the GaussianSplats node; TRUE on GaussianSplatsShape (C) | n/a |
| sorting | not specified | CPU Web Worker (`mkkellogg-sort.worker.js`, from GaussianSplats3D) (C) | back to front, "typically uses a radix sort" (C) |

Trap: to pick splats in X_ITE, author `pointerEvents="true"`. The scene validates either way, so no validator catches it today (R-TETHER-06 adds the lint).

## 2. Ranking

Crazy and payoff run 1 to 5. "Needs" lists what must be agreed before the first experiment; "none" means no paid service and no GPU time.

| # | idea | crazy | payoff | time to first experiment | needs | state of the art |
|---|---|---|---|---|---|---|
| **1** | **Shader tether** | 2 | 5 | 1 to 2 days | none | C papers; the full chain: L (none found) |
| **2** | **GaussianSplats url, SPZ, splatBudget** | 2 | 5 | 1 day | none | C |
| **3** | **X3D conditioning pack** | 3 | 5 | 1 to 2 days | none (one diffusion run only with the owner's yes) | C |
| 4 | per-frame render report | 1 | 5 | half a day | none | S (no standard found) |
| 5 | intent layer in MetadataSet | 1 | 4 | half a day | none | L |
| 6 | video to splats to X3D (the Loom's 8-second stage) | 2 | 4 | 1 day after a GPU yes | owner's yes for GPU time | C |
| 7 | inverse graphics back to X3D | 3 | 4 | 2 days | none (CPU) | C |
| 8 | splat relighting, splat-mesh hybrids, collision | 3 | 4 | 1 day | none | C |
| 9 | neural and continuous LOD | 3 | 4 | with #2 | none | C |
| 10 | WebGPU path tracing (stills) | 3 | 4 | 1 day | owner's PC, with consent | C |
| 11 | neural textures, upscaling, denoising | 4 | 3 | 3 days | owner's PC, with consent | C papers, S WebNN |
| 12 | WebGPU compute physics and particles | 3 | 3 | 2 days | real GPU for timings | L |
| 13 | procedural worlds from an ontology | 3 | 3 | 2 days | none | C |
| 14 | an AI director camera | 2 | 3 | 1 day | a hosted model | S |
| 15 | a world model as the renderer | 5 | 3 | weeks | owner's yes for generation runs | C papers, S products |
| 16 | light-field and holographic displays | 4 | 2 | 1 day | none (no device needed for quilts) | C |
| 17 | visionOS and WebXR | 2 | 3 | half a day with a headset | a headset | S |

**Why these three first.**
1. **Shader tether.** The tether already worked once on splats: with the validator report plus a render, blind replies went from 0/30 right as written to 16/30 for one agent family, and the spec arm from 11/18 to 18/18 (S, project note, X_ITE 16.5.1). Shaders are the one X3D content type nothing checks today beyond "it compiled".
2. **Splat url and budget.** It fixes two measured traps, the XML parser wall between 76,250 and 76,875 inline splats and X_ITE's culled-node sort hang (both S, project notes), and reaches KHR parity.
3. **Conditioning pack.** It makes X3D the scene description that image and video models consume. 4.1 already has the hook: RenderedTexture with `depthMap`, `url`, `singleFrame`, `maxNumberFrames` (C, X3DUOM 4.1).

## 3. The ideas, each with a sketch and a first experiment

### 3.1 Shader tether (#1)

```
ShaderPart.type        += "COMPUTE"          # proposal
ComposedShader.language += "WGSL"             # proposal
ShaderProgramIR : X3DNode
  SFString [in,out] irFormat "TSL-JSON"     MFString [in,out] url []
  MFString [in,out] targets  ["WGSL","GLSL"] SFNode   [in,out] witness NULL   # MetadataSet receipt
  SFBool   [out]    isValid
```
First experiment: 20 fixed shader tasks. A hosted model writes an X_ITE ComposedShader in GLSL, and WGSL checked with Chrome's `getCompilationInfo`. The chain: compile (naga or Tint), the X3D validator, an X_ITE draw witness (a frame watcher armed before load), a pixel judge, with the report fed back. Score compile, visible and right, blind against with-report; publish counts, not rates.
References (C): ShadAR 2602.17481, AI Co-Artist 2512.08951; DarthShader 2409.01824 (WebGPU shader translators as an attack surface); CrossTL 2508.21256 ("can compile and still compute something else"); naga in wgpu v30.0.1 (2026-08-21).

### 3.2 GaussianSplats with a url and a budget (#2) and continuous LOD (#9)

```
GaussianSplats (all 4.1 fields kept) + X3DUrlObject
  MFString [in,out] url            []                # .spz | .ply | .glb
  SFString [in,out] kernel         "ellipse"         # KHR parity
  SFString [in,out] projection     "perspective"
  SFString [in,out] sortingMethod  "cameraDistance"
  SFInt32  [in,out] splatBudget    -1                # draw the first N of an importance-ordered file
  SFInt32  [in,out] maxShDegree    3
  SFNode   [in,out] collisionProxy NULL              # X3DGeometryNode (idea 8)
  SFInt32  [out]    splatCount
```
First experiment: the Blacksburg tile (562,348 splats, S) to SPZ with `@playcanvas/splat-transform` 3.10.3 (npm 2026-10-21, C); compare bytes with the inline XML; render importance-ordered prefixes at 25, 50 and 100% and record PSNR against the full set.
References (C): SPZ v4 is ZSTD with independent attribute streams and a 32-byte header, "typically around 10x smaller" than PLY (nianticlabs/spz README); WebSplatter 2602.03207 (WebGPU radix sort, 1.2x to 4.5x over web viewers, author-reported); Hierarchical 3DGS 2406.12080; Octree-GS 2403.17898; KoalaGS 2610.28615 (prefix LOD); A LoD of Gaussians 2507.01110; StopThePop 2402.00525.

### 3.3 X3D conditioning pack (#3) and a world model as the renderer (#15)

```
ConditioningCapture : X3DChildNode
  MFString [in,out] channels ["depth","normal","segmentation","semantic"]
  SFNode   [in,out] viewpoint NULL      SFString [in,out] labelKey "DEF"   # | "class" | ontology IRI
  MFString [in,out] url []              SFBool   [out]    isActive
ModelRenderPass : X3DChildNode
  SFNode   [in,out] conditioning NULL   SFString [in,out] prompt ""   SFInt32 [in,out] seed 0
  MFString [in,out] modelUrl []         SFNode   [out]    output      SFString [out] receipt
```
First experiment (#3): from one Dirac world through X_ITE, export depth (RenderedTexture `depthMap`), normals, a DEF-keyed flat-colour id pass and `labels.json` from MetadataString values and ontology IRIs, as an SAI tool before any node is asked for. For #15, a world-model export (SPZ) into GaussianSplats comes later, behind the owner's yes.
References (C): ControlNet 2302.05543; Diffusion as Shader 2501.03847; GEN3C 2503.03751; Cosmos 2501.03575 and Cosmos-Transfer1 2503.14492; DiffusionRenderer 2501.18590; Genie 2402.15391; GameNGen 2408.14837; Visionary 2512.08478 (WebGPU splats with per-frame ONNX inference).

### 3.4 The rest

| # | idea | X3D node sketch (proposal) | first experiment | references (C unless marked) |
|---|---|---|---|---|
| 4 | per-frame render report | no node; SAI `browser.getRenderReport()` returning backend, adapter, visible DEFs, coverage per DEF, splats drawn (SPEC R-TETHER-02) | SAI JSON per frame from X_ITE on three project worlds; a judge reads only that | none found (S) |
| 5 | intent layer | `MetadataSet name="intent"` { MetadataString `purpose`; MetadataString `mustBeVisible` (DEF list); MetadataString `shotList` } (MetadataSet has name, reference, value: C) | intent sets on 5 worlds plus a `mustBeVisible` checker over the render report | SceneScript 2403.13064 |
| 6 | video to splats to X3D | GaussianSplats + `MetadataSet name="provenance"` { source sha256, pipeline, witness results } | an 8 s clip through frames, masks and depth, poses (VGGT or AnySplat), gsplat, clean-up, X3D 4.1 GaussianSplats; Pose and Fidelity (held-out PSNR, SSIM, LPIPS) witnesses, as in LOOM-v1.md section 9.4 (C) | DUSt3R 2312.14132; VGGT 2503.11651; AnySplat 2505.23716; 4DGS 2310.08528; gsplat 2409.06765 (PyPI 1.5.3) |
| 7 | inverse graphics | `MetadataSet name="optimize"` { MetadataString `target` "DEF.field"; MetadataFloat `range`; MetadataFloat `rate` } | mitsuba 3.9.1 on the CPU (`llvm_ad_rgb`) fits a Material and a light to an X_ITE frame; write the values back; validate; re-render | survey 2006.12057; nvdiffrast 2011.03277; Dr.Jit 2202.01284 (drjit 1.5.0); PyTorch3D 2007.08501 (PyPI 0.7.4 is stale, 2023); Thinking in Blender 2606.02580; SceneCraft 2403.01248; LL3M 2508.08228 |
| 8 | splat relight, hybrid, collision | GaussianSplats + `collisionProxy` SFNode, MFVec3f `normals`, MFFloat `roughness` | a heightfield proxy from splat centres; X_ITE picking with `pointerEvents` TRUE | Relightable 3D Gaussians 2311.16043; SuGaR 2311.12775; 3DGRT 2407.07090; PhysGaussian 2311.12198; mesh-Gaussian physics 2606.00444 |
| 10 | WebGPU path tracing (stills) | `RenderSettings` { SFString `integrator` "RASTER"; SFInt32 `samplesPerPixel`; SFInt32 `maxBounces` } | three-gpu-pathtracer 0.0.28 (npm 2026-11-02) `WebGPUPathTracer`, one hero still on a real GPU | WebGPU + OpenPBR path tracer 2407.19977; Bevy's `bevy_solari` "raytraced lighting" in main; WebGPU has no ray-tracing API, so a compute BVH (L) |
| 11 | neural textures, upscale, denoise | `NeuralTexture : X3DTexture2DNode` { MFString `url` (weights); SFString `decoder`; SFInt32 `channels` }; `RenderSettings.upscaler` | onnxruntime-web 1.31.1 (npm 2026-10-26) on WebGPU: a 2x upscale of a 1105x576 capture, on a real GPU | neural texture compression 2305.17105; neural appearance models 2305.02678; supersampling 2308.01483; KPN denoising 2202.05977; subgroups shipped in Chrome (S); subgroup-matrix experimental (S); WebNN at Candidate Recommendation Draft with a Chrome 146 origin trial (S) |
| 12 | compute physics and particles | `ParticleSystem` { SFNode `computeShader` NULL } holding a ComposedShader with a COMPUTE part | the Collider's 700-particle system on compute at 100x the count | X_ITE uses transform feedback today (C); Babylon and three ship compute (C) |
| 13 | procedural worlds from an ontology | `MetadataSet name="generator"` { MetadataString `query`; MetadataInteger `seed` }, output as ProtoInstances | a knowledge-graph query becomes PROTO instances; the validator gates them | Holodeck 2312.09067; Infinigen 2306.09310; neural geometric LOD 2101.10994 |
| 14 | an AI director camera | Viewpoint + interpolators, plus `MetadataSet name="shot"` { purpose, subject DEF, duration } | a hosted model writes Viewpoint keys from the intent layer; a judge reads the render report | none found (S) |
| 16 | light field, holographic | `QuiltViewpoint` { SFInt32 `views` 45; SFFloat `viewCone`; SFVec2f `layout` } | a 45-view quilt from X_ITE viewpoints through the SAI, no device needed | DirectL 2407.14053; real-time 3D desktop display 2506.08064; `@lookingglass/webxr` 0.6.0 (npm 2024-07-08) |
| 17 | visionOS and WebXR | none: existing Viewpoint and NavigationInfo, X_ITE's XRSessionMode option | an X_ITE WebXR splat world on a headset | Safari on visionOS supports immersive-vr only (S); WebGPU on by default in visionOS 26 (C, gpuweb wiki); X_ITE uses XRWebGLLayer (C) |

## 4. X3D, OpenUSD and glTF as the scene description for AI

| axis | X3D 4.1 | OpenUSD 26.08 (2026-07-20) | glTF 2.0 |
|---|---|---|---|
| Gaussian splats | GaussianSplats in the draft (C) | `UsdVolParticleField3DGaussianSplat` since 26.03 (C) | KHR_gaussian_splatting, ratified (C) |
| events and behaviour | ROUTE, sensors, Script, native (C) | no runtime event model in core (L) | KHR_interactivity, ratified, 135 operations (C) |
| semantics | MetadataSet name, reference, value, plus the X3D ontology (C) | schemas, custom attributes (L) | `extras` (L) |
| validation | XSD, X3DUOM, the x3d_mcp fork's layers (C) | usdchecker (S) | glTF-Validator (L) |
| shader languages | Cg, GLSL, HLSL; VERTEX, FRAGMENT only (C) | MaterialX, UsdShade (L) | none; material model only (L) |

X3D's edge is the tether: events, semantics and a validator in one text format. Its gaps are external splat data and WGSL. KHR_interactivity being ratified (C) narrows X3D's events lead over glTF to the parts it lacks: drag, proximity and visibility sensors, Script, PROTO (PATHS.md 4.2).

## 5. Open items

| id | question | owner |
|---|---|---|
| H-1 | Status and ratification date of the SPZ child extension of KHR_gaussian_splatting (reported 2026-09-03 for the parent, S): hand fetch of the glTF pull request | |
| H-2 | WebNN shipping status in Chrome 156 and the subgroup-matrix feature: hand fetch of Chrome Platform Status | |
| H-3 | visionOS Safari WebXR scope and whether splats reach the web (WWDC 2026 session): hand fetch | |
| H-4 | Does the Web3D working group intend KHR parity (url, kernel, projection, sortingMethod) for GaussianSplats? Ask on the X3D list | |
| H-5 | Can wgpu-py 0.33.0 (PyPI 2026-11-06) validate WGSL through naga with no adapter in the sandbox, or must WGSL checks run in a browser? | |
| H-6 | Is the X_ITE culled-node hang still present in 16.7.0 (TBD-12)? | |
| H-7 | Does the owner have a headset (idea 17) or a light-field display (idea 16)? | |
