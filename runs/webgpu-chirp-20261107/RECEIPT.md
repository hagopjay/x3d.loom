# Chirp on Babylon WebGPU: receipt

Date 2026-11-07. Port #4 (Pantheon splats, brain, KANSEI before it). Scope: draw the Chirp study (two black holes spiralling in, heard) with Babylon.js 9.32.0 in WebGPU mode through our own X3D reader and SAI shim, the study's own `src/app.js` byte for byte, plus an optional cinematic look. Spend $0.

Rule for this port (owner, 7 Nov 22:12Z): no pixel perfection. Parity gaps are logged in [GAPS.md](GAPS.md) for a later receipts pass; the effort went into Babylon integration and visual intensity.

Grades: **C** measured here with the named instrument; **L** reasoned from sources; **S** suspected.

## Source

The study folder as hosted in hagopjay/x3d.demo `docs/demos/stem/v1/chirp` (its payloads are rebuilt by the study's own tools; they are not committed in the study repo). Build: `python3 -I x3d.webgpu/demo/src/build-chirp.py --study <that folder> --out OUT`. Source hashes (sha256, first 16): app.js 5d86ceb5a277314b, scenes/chirp.x3d 9c922d5138b3e687, cases/equal/orbit.bin 70304bca6ea20fd6.

## What ran (C: headless Chromium 153.0.8010.12, SwiftShader adapter, 1100 x 700, correctness only, no timings)

| check | result |
|---|---|
| the study's browser witness (36 wave-height reference points vs the builder) | pass on all three inspirals, worst relative difference 1.96e-15 |
| load all three inspirals, switch between them | pass, 0 page errors |
| Watch (the scene's TimeSensor drives the picture) | advances: fraction 0.19 then 0.39 after 9 s and 18 s |
| EXAMINE orbit by mouse drag, Wide view | camera moved from [0, 2.6, 3.4] to [-2.57, 1.19, 3.21] |
| look switch off and on | works; trails switch between ribbon and tube |
| wave sheet updated in place | 45 of 48 draws in a Watch run took the in-place path (the first draw per load rebuilds) |
| KANSEI page after the shared edits | loads, `KANSEI.ready`, 0 errors (`kansei-smoke.js`) |
| Neural Canvas page after the shared edits | all 9 states of `runs/webgpu-brain-20261107/page-states.js` ran, 0 page errors |

Not exercised: **Hear** (the study plays its own audio element; headless run did not play sound), Safari and Firefox, any real GPU.

## The look (optional, switchable, default on; law 39)

HDR rendering path with Babylon `DefaultRenderingPipeline` (bloom, FXAA, one tone-mapping step at the end, KHR PBR Neutral), a WGSL post-process for gravitational lensing of the two holes (thin-lens deflection, strength reduced and capped so the picture stays readable, horizon shading), an unlit vertex-colour wave sheet whose brightness follows how far a point is from the calm-sheet grey (crests warm, troughs cool, calm water dark, peaks past 1 so they bloom), glowing orbit-trail tubes. The pill at the top right switches to As authored (lit PBR sheet, one-pixel ribbons, scene tone mapping, no pipeline). `?look=0` starts there. `compare-sheet.jpg`: row 1 X_ITE 16.5.1, row 2 Babylon As authored, row 3 Babylon cinematic, at t = 0, 0.5, 0.9, 0.99 of the equal-mass inspiral.

## Engineering in the body (shared files, all additive)

| change | file | why |
|---|---|---|
| MF fields answer like X_ITE's field objects (`.setValue`, `.getValue`, flat typed arrays accepted) | brain/sai.js | the study calls `coord.point.setValue(Float32Array)` |
| fields the body reads as flat typed arrays stay flat whichever way the page sets them (`R.FLAT`) | brain/sai.js, brain/reader.js | an empty `<Coordinate/>` parsed from a file starts as a plain list; the first version drew an empty sheet and no trails because of this (F1) |
| `createNode` makes flat typed arrays for those fields | brain/sai.js | same |
| `B.getCurrentTime()` | brain/sai.js | Watch starts the TimeSensor from the browser clock |
| the body's own outputs (a TimeSensor's `fraction_changed`) reach `addFieldCallback` listeners | brain/sai.js | Watch drew nothing until this (F2) |
| EXAMINE navigation kept when `window.__keepNav` is set | drift/drift-ext.js | KANSEI turns it off, a study must not |
| first Viewpoint bound at load | chirp/chirp-look.js | X3D rule; the page only bound on a click |
| in-place vertex update for a same-size triangle set | chirp/chirp-look.js | 21,120 vertices change every frame; dispose-and-rebuild is wasteful |

Findings that cost time, kept for the playbook: **F1** typed-array fields (above). **F2** TimeSensor outputs did not reach SAI callbacks. **F3** Babylon `StandardMaterial` computes colour as clamp(emissive + lit) times the vertex colour, so an unlit HDR vertex-colour surface needs emissive 1, diffuse 0 and the gain in the vertex colour (a white diffuse with lights off draws black). **F4** the brain port's screen-space ribbon is untested for geometry rebuilt every frame (the cause here was F1, not the ribbon).

## Not in this repository

The built page is not committed (it embeds the study's payload bytes). Build it with the command above. No timing is claimed; no Timing button yet (GAPS G6).
