# Material Odyssey on Babylon: gap log

Standing rule (his words, 7 Nov): no pixel perfection; log the gaps for future receipts; quality Babylon engineering and intense visuals. Every claim names X_ITE 16.4.3, Babylon.js 9.32.0 and the rig: headless Chromium (Playwright), SwiftShader software WebGPU/WebGL, swap chain stubbed for Babylon, no timings, no real GPU.

| # | Gap | Grade | Note |
|---|-----|-------|------|
| G1 | No depth of field | Confirmed | film.json carries per-shot focus distance and f-number; the three.js engine uses them. Babylon's pipeline DOF needs the depth renderer; not wired. |
| G2 | No light shafts or volumetric beams | Confirmed | The three.js engine draws shafts for the top 4 spotlights. Babylon's volumetric light scattering handles one light; not attempted. |
| G3 | Shadows from 3 key lights only (Key, DaisPool, Oculus), 1024 map, only with Look on | Confirmed | The file asks for none (shadows=false everywhere). Added by the look layer, off in "As authored". |
| G4 | Dust is a CPU particle field around the lens, not lit by the beams | Confirmed | Faint, additive. The three.js engine's dust is lit by the nearest spots. |
| G5 | Reflections come from a generated gold-hall cube, not from the file | Confirmed | The file has no EnvironmentLight; X_ITE draws metals with no reflections. Look only; reflections only (no diffuse irradiance). |
| G6 | Texture-mapping fields (baseTextureMapping etc.) ignored by the reader | Confirmed | Reader logs "no field"; all maps use 'uv', so no visible effect. |
| G7 | No log depth buffer | Suspected | X_ITE runs a logarithmic depth buffer; Babylon uses a normal one with near 0.3 and far 2200. No z-fighting seen in the 6 stills; not tested in flight. |
| G8 | Hear (audio): the film has none | n/a | |
| G9 | (closed) Sky and door brightness differed from X_ITE | Confirmed | Cause was ours: Babylon's StandardMaterial ADDS an emissive texture to the emissive colour where X3D multiplies; fixed in odyssey-ext.js (texture moved to the diffuse slot with lighting off). |
| G10 | three.js engine not captured by this rig | Confirmed | Its WebGPU canvas comes out white in a headless screenshot; the receipts' own stills (`odyssey/shots/engine-high-*.png`) are used for the eye check. |
| G11 | One PBR material and one pipeline per mesh (286 materials for 273 shapes) | Confirmed | Babylon dedupes the shader, not the material object. A shared-material pass would cut uniform buffers. |
| G12 | Transparency flips (gold leaf 1 to 0.65) change the draw mode at run time | Suspected | May recompile one effect mid-film on a real GPU. |
| G13 | Safari and Firefox untested; no real-GPU timing | Confirmed | Page's Bench runs on the visitor's GPU and says how it measures. |
| G14 | Metals read slightly darker than X_ITE in the shelf shot with Look off | Likely | No environment in the file; X_ITE lights the shelf's gold and red spheres a little more. With Look on the generated gold hall adds reflections. Not tuned. |
| G15 | White-room glow panel is coplanar with the lit marble floor | Likely | The file places the unlit panel exactly on the floor; both engines pick a winner by depth. A depth bias (zOffset) keeps the panel behind the floor's lit surface in Babylon. |
| G16 | Look-on frames are brighter than As authored (PSNR vs X_ITE 18.4 to 28.2 dB against 25.5 to 30.7 As authored) | Confirmed | Intended: reflections, bloom, shadows and grain are additions (Loom law 39). The switch is on the page. |
| G17 | X_ITE's `assets/linetype/linetypes.png` returns 404 when the X_ITE engine runs | Confirmed | The original site ships without that folder, so the same 404 appears on the unported page. Not from the Babylon bundle; no lines in this film use it. Not fixed here. |
| G18 | Pause by Space not exercised in the play test | Confirmed | The key landed on the focused Begin button, which the page's own handler leaves to the button. Play, Look off/on, scrub, fly, About and both engine switches passed (play-result.json). Pause is page code unchanged by this port; check it by hand. |
