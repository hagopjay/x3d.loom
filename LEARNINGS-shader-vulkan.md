# What the Shader-Vulkan Fieldbook and the Vulkan Light Lab teach the Loom (17 Nov 2026)

Sources: two teaching packages (the Fieldbook, 18 sections and a 17-row correction ledger; the Light Lab, three GLSL compute passes, a C17 host and Python tools), re-run here, plus one new measurement of X_ITE. Grades follow the Loom convention: **C** = a named tool ran or the exact file was read, **L** = read or reasoned, **S** = suspected. Records: `runs/shader-vulkan-20261117/`. Rigs: CPython 3.13.18 and GCC on Linux x86_64 (4 vCPU); Mesa 25.2.8 lavapipe (LLVM 20.1.2) for Vulkan; X_ITE 16.7.1 in Chromium 153.0.8010.12 with Playwright 1.63.0 on SwiftShader.

## 1. Seven findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **X_ITE writes its output with a 2.2 power, not piecewise sRGB.** `x_ite.js` 16.7.1 line 67921 is `const float GAMMA=2.2; ... pow(color, vec3(1./GAMMA))`. Linear 0.5 becomes byte 186 (exact sRGB: 188); the two curves differ most in deep shadow (about 8.5 bytes near linear 0.002). | C | source read; PhysicalMaterial emissive 0.5 renders 186 | Name each engine's encode function in every parity receipt; a 2-byte mid-grey gap (and a larger one in darks) is a known cause, not a bug. |
| 2 | **Which materials are encoded depends on `ColorSpace`.** Default `LINEAR_WHEN_PHYSICAL_MATERIAL`: UnlitMaterial and legacy Material emissive 0.5 give byte 128 (raw), PhysicalMaterial gives 186. `LINEAR`: all three 186. `SRGB`: all three 128. | C | `xite-furnace-colour.json`, 15 rows | A scene that mixes materials has two colour contracts in one frame; test both. |
| 3 | **A reader's decode can fake an energy loss.** Decoding X_ITE bytes with exact sRGB read a white furnace as 0.491 ("1.8 % low"); decoding with the 2.2 inverse reads 0.4995. | C | same receipt, both columns | Decode with the inverse of what wrote the bytes. |
| 4 | **White furnace on PhysicalMaterial.** Metal baseColor 1, EnvironmentLight intensity 0.5: byte 186 at roughness 0, 0.25, 0.5, 0.75, 1 (flat; consistent with energy compensation or with a lookup that has no roughness-dependent term, which a uniform environment cannot separate). Dielectric 0.5: 187 rough, 189 smooth (+0.012 specular). With no EnvironmentLight (or intensity 0) and the headlight off the sphere is byte 0 although the background is white. | C | `xite-furnace-colour.json` | Add furnace + roughness sweep as a cross-engine fixture; it needs no reference image. |
| 5 | **Same shader, other driver, not bit-identical.** 1440x900, 4 spp: 258 of 3,888,000 bytes differ (0.0066 %), max 14 of 255, LLVM 19.1.7 vs 20.1.2; the particle oracle error is bit-identical (9.313e-10). | C | `lightlab-rerun.json` | Compare images across drivers with a stated tolerance and name the driver; the Math Lab float-hash rule holds on GPU stacks too. |
| 6 | **The Fieldbook's four labels fit our grades.** Identity, Guarantee, Approximation, Observation map onto C-if-derived, L-from-spec, C-with-measured-error, C-on-a-named-rig. | L | Fieldbook section 1 | Use them as a gloss when a claim's *kind* is unclear. |
| 7 | **A model-written primer is a lead.** The source primer was a saved chat in reverse order with a truncated last section; the Fieldbook folds 19 ledger rows into one canon. | C (counted) | `Fieldbook.md` section 17 | Publish the corrected text and keep retractions as a ledger. |

## 2. Mapped onto this repository

| Idea | Where it applies | Action |
|---|---|---|
| Clip depth 0..w, forward-Z `A=f/(n-f)`, `B=fn/(n-f)` (n=0.1, f=100: z=-n gives 0.0, z=-f gives 0.9999999999999999, z=-1 gives 0.9009) | `x3d.webgpu/SPEC.md` R-RENDER-07 requires [0,1] with reversed-Z (so the test there is -n to 1, -f to 0) | add the closed form and a two-point test in the spec's convention, with a tolerance at the far plane in f32 |
| Diagnostic non-beauty views (normal, roughness, linear distance) | bridges and the WebGPU body | cross-engine diffs of normals are more diagnostic than of the beauty pass |
| CPU twin plus float32 caveat | `x3d.compute` (particle twin copies the f32 operation order, NURBS twin is a different algorithm, 14 of 14 planted bugs caught) | cite: double-precision agreement does not prove float32 GPU agreement |
| Tail lanes carry identities and reach barriers | splat sort pads culled keys with `0xFFFFFFFF` | add lengths 0, 1, W-1, W, W+1 and a prime to the compute fixtures |
| Timing scopes, `null` instead of CPU time when a timestamp is missing | `x3d.webgpu/BENCHMARK.md` | adopt "null, never a substitute" in receipts |
| Furnace as its own isolated view | `x3d.threejs` marks PhysicalMaterial reference-only (IoU 0.91, X_ITE default environment glow) | furnace fixture per engine |

## 3. Reusable pieces

* `runs/shader-vulkan-20261117/probe/xite-furnace-colour.js` and `xite-furnace-half.js`: a Playwright harness that renders one sphere per case in X_ITE with a uniform 1x1 white cube environment and prints centre-pixel bytes. Reusable for any colour or furnace fixture.
* Fieldbook lesson card (question, contract, small model, visible intermediate, invariant, controlled fault, measurement, transfer) as a drill template.

## 4. What this does not prove

* No physical GPU, no WSL, no native window, in the authors' run or here; the Light Lab timings are lavapipe numbers.
* X_ITE numbers are SwiftShader only; the furnace environment has no prefiltered mip chain, so it tests the uniform path, not Filament-style IBL energy compensation.
* `DisplayColorSpace=DISPLAY_P3` had no effect in a headless Chromium screenshot; that is this rig only.
* The three.js, Babylon, Blender and Unreal encode functions were not re-read here [S].
* Not reported upstream: finding 1 is a candidate for the X_ITE maintainer and is held until the owner decides.
