# Electron Cloud on Babylon: parity gaps, logged for a later receipts pass

Owner rule (7 Nov 22:12Z): no pixel perfection; log the gaps. Nothing below was tuned away. Reference X_ITE 16.5.1 (the version vendored in the study), Babylon 9.32.0, headless Chromium 153.0.8010.12 on SwiftShader, 1100 x 700, "As authored" look (`?look=0`) unless the row says cinematic. Correctness only, no timings.

| id | gap | measured | grade |
|---|---|---|---|
| G1 | As authored vs X_ITE, whole frame | PSNR 19.24 dB (4fxyz), 19.40 (3s), 19.26 (Lyman, frame 0) | C |
| G2 | the same with the background pixels left out (only pixels where either picture differs from its own background) | PSNR 21.01 dB (4fxyz), 23.03 (3s), 24.96 (Lyman); the whole-frame number is mostly the background | C |
| G3 | Background | X_ITE headless draws black where the Background node's sky gradient is (0.012 0.014 0.03 up to 0.04 0.035 0.06); Babylon draws that gradient sRGB-encoded (about 22 25 36) | C |
| G4 | Lobes are brighter on Babylon | e.g. 4fxyz object mean RGB 117 100 116 vs 100 88 100 on X_ITE; light intensity mapping and the PBR response differ | C |
| G5 | The skin is a glass PhysicalMaterial in the scene (`baseColor 1 1 1, roughness 0.3`) | the port draws it as one opaque lit StandardMaterial per skin (the X3D PBR to Babylon StandardMaterial mapping of the shared body); no refraction, no transparency | L |
| G6 | Cinematic look is an addition, not a measurement | glowing glossy shell (rim glow through an emissive Fresnel, vertex colour carries the wave sign), a soft hemispheric fill light, Babylon bloom, KHR PBR Neutral tone map, vignette. Switchable; law 39 | C |
| G7 | Shell material properties at run time | in the Lyman still, changing the look material's `ambientColor`, `disableLighting` and emissive Fresnel at run time left the picture byte identical, while adding a `HemisphericLight` changed it. Cause not found; the fill is therefore a light | S |
| G8 | Hear (audio) | the study has none for this page; n/a | C |
| G9 | Timing | no Timing button on this page yet; no real-GPU numbers (the owner runs his own); G0 consent was given for ports in his typed words, so the button can be added from `drift-timing.js` | L |
| G10 | Safari, Firefox, mobile | not tested | S |
| G11 | Shared-file edits | `brain/body.js`, `drift/drift-ext.js` (geometry cache key, see RECEIPT), `brain/reader.js` (IntegerSequencer), `brain/sai.js` (earlier Chirp edits). After them: Chirp page play pass: browser witness pass, Watch advances; KANSEI smoke: ready, 0 errors; Neural Canvas page-states: 9 states, 0 page errors. The KANSEI, Neural Canvas and Chirp PSNR receipts were not re-run | C |
