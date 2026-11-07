# Rebuild review: Collider on WebGPU, rebuilt by an outside pass, 2026-11-07

The outside pass ("Collider / Luminance") took the published Collider on WebGPU page and returned an upgraded page and a patch. This record follows the rebuild-review form (Loom step 9). Every line is graded C (checked: run or read in the exact code), L (likely) or S (suspected). Instrument for "run": headless Chromium with WebGPU on a software Vulkan adapter (SwiftShader), correctness only, no timings.

## 1. Inputs

| Item | sha256 (prefix) | How read |
|---|---|---|
| Our master scene `x3d.webgpu/demo/collider.x3d` | `59dfeb32e9efefeb` | embedded byte for byte in all three pages |
| Their page | `92ee5e792ba96456` | read, and run in headless Chromium |
| Their patch | `b1c2f494812370ab` | `git apply` on our published page reproduces their page exactly (C) |

## 2. Source and master

- [x] The scene survived byte for byte (C): their patch never touches the embedded X3D.
- [x] Their renderer reads the master, not a copy (C): it is our runtime, so law 38 holds by construction.
- [x] What they draw that the master does not hold: studio reflections, an edge coat and an event light on the detector shells, a six-blade diffraction flare and corona on the flash, a veil in the haze, a horizontal glare. All of it lives in the cinematic branch of the WGSL ports (gated on the look uniform); none of it is X3D geometry (C).

## 3. Critiques, both ways

| Critique | By | Held / fell | Instrument | Fix lands in |
|---|---|---|---|---|
| Our bloom strength changes with canvas size (the composite divides by the number of bloom levels, which depends on resolution) | them | held (C) | read | page: their size-independent weighting (0.72 per level) |
| Our log line says "ACES" while the page runs the exponential curve | them | held (C) | read | page: the log names the real tone curve |
| Fine detail on the shells shimmers and moirés; MSAA does not filter shader stripes | them | held (L) | read, screenshots | page: their derivative-filtered stripes and dashes, cinematic look only |
| The haze ignores the viewport's aspect ratio | them | held (C) | read | page: cinematic look uses the real aspect; authored keeps the GLSL's 16:9 constant |
| `smoothstep(0.86, 0.70, r)` in the haze port has its edges reversed | them | held, weaker than stated (L): both pages compile and draw it | read | page: `1 - smoothstep(0.70, 0.86, r)` in both looks, the same value with defined edges |
| Their default (Neutral curve at exposure 1.65) turns the hot calorimeter towers pink-white, so the blue-amber-red energy scale reads wrongly | us | held (C): 13.9 % near-white lit pixels in the crown against 1.2 % ours and 3.6 % for their pipeline with our curve | pixel count on matched screenshots | page: default grade uses the exponential curve at 1.35 |
| Their brightened shells compete with the tracks | us | held (L) | screenshots against the X_ITE reference frame | page: shell additions at half strength |
| Their 4K export reports "PNG ready" inside a frame that ignores `<a download>` | us | held (C), failure mode 113 | read | page: the still opens in a preview with a Save link and a right-click hint |
| Their browser playback was never run (their own note) | them about themselves | resolved (C): their page and ours play with 0 WebGPU errors here | headless Chromium | record |
| The authored look stays a faithful port under their changes | them | held (C): authored screenshots differ only in the spark burst (0.66 % of pixels) | pixel diff | none needed |

## 4. Enhancements

| Enhancement | Adopt / adapt / keep local | Why |
|---|---|---|
| Studio reflections, coat and event light on the shells | adapt: half strength, labelled as art in the page | glass reads as glass; must not out-shine the event |
| Six-blade flash diffraction and corona | adopt | the vertex reads as a hot point of light |
| Filtered stripes, dashes and track heads | adopt | stable fine detail at low render scale |
| Size-independent bloom, bounded sharpening, new vignette | adopt | sound, cheap, no overshoot |
| Horizontal glare (14 bloom taps per pixel) | adapt: off by default, on in the Radiant grade | costly on an integrated GPU for a cosmetic streak |
| Grades and the Light and lens panel | adapt: Luminance (exponential 1.35), Radiant, Precision; their ACES grade dropped | ACES at 1.9 washed the vertex into a pink-white blob |
| Quality tiers | adopt, default Balanced (2.2 MP) | High and Ultra are for discrete GPUs |
| Offscreen PNG export with padded rows and BGRA handling | adapt: 2K default, aspect from the canvas, out-of-memory scope, preview with Save link, caption burned in | law 39, failure mode 113 |
| Opening on the three-quarter view at a developed moment | adapt: bound through `set_bind` so the event log and buttons agree | first frame is the hero |
| Navy restyle | adopt, 11 px type floor, settings folded into a closed "Settings and export" | small text failed contrast; phone card was too tall |
| Title overlay, Aurora grade, their test harness and native-render tool, package files, validation file | keep local (not adopted) | overlay repeats the title over the detector; the tools carry a host-runtime variable and hashes of a wrapped page that do not match ours |

## 5. Under the host

- [x] Every fallback announces itself (law 40): no WebGPU shows the reason; a blocked download leaves the picture in the preview with a hint.
- [x] Saves use a click on a real link in a preview, not a scripted anchor click (failure mode 113).
- [x] Exported stills carry a burned-in caption, "a generated event · artistic render" (or "shaders as authored"), and the filename says render (law 39).

## 6. Fold

- Scene fixes: none needed; the scene is untouched.
- Page facts: [x3d.webgpu/demo/collider-v2.html](../../x3d.webgpu/demo/collider-v2.html), built by `python3 -I x3d.webgpu/demo/src/build-v2.py`.
- Learnings: [x3d.webgpu/demo/README.md](../../x3d.webgpu/demo/README.md), section "Collider v2".
- Claims of ours that fell: our bloom was resolution-dependent; our log named the wrong tone curve.
- Not proved: the owner's GPU (Intel UHD 620, bgra8unorm) has not run v2; the BGRA export swap is checked by reading only, since the software adapter uses rgba8unorm.
