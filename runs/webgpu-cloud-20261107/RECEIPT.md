# Electron Cloud Observatory on Babylon WebGPU: receipt

Date 2026-11-07. Port #5 (Pantheon splats, brain, KANSEI, Chirp before it). Scope: draw the Electron Cloud Observatory study (hydrogen orbitals as iso-surface shells you can cut, step through and play) with Babylon.js 9.32.0 in WebGPU mode through our own X3D reader and SAI shim, the study's own `src/app.js` byte for byte, plus an optional cinematic look. Spend $0.

Rule for this port (owner, 7 Nov 22:12Z): no pixel perfection. Parity gaps are logged in [GAPS.md](GAPS.md); the effort went into Babylon integration and visual intensity.

Grades: **C** measured here with the named instrument; **L** reasoned from sources; **S** suspected.

## Source

The study folder as hosted in hagopjay/x3d.demo `docs/demos/stem/v1/electron-cloud` (cases and scenes are rebuilt by the study's own tools; they are not committed in the study repo). Build: `python3 -I x3d.webgpu/demo/src/build-chirp.py --kind cloud --study <that folder> --out OUT [--single]`. `--single` writes one offline page (`single.html`) with scenes and cases inlined; only Babylon is then loaded from a CDN.

## What ran (C: headless Chromium 153.0.8010.12, SwiftShader adapter, 1100 x 700, correctness only, no timings)

| check | result |
|---|---|
| the study's browser witness: meshes rebuilt in the page vs the builder | 4fxyz worst volume difference 1.1e-15; Lyman 24 of 24 frames, worst 5.2e-15; 1s and 3s pass |
| states 1s, 3s, 4fxyz, 5gz4, 3dz2, Lyman | each loads and draws, `meshed === frames` |
| Lyman playback (TimeSensor to IntegerSequencer to Switch, 24 frames) | frames cycle (polled each frame) |
| cut slider (ClipPlane) | works, per-material clip plane |
| EXAMINE orbit by mouse drag | camera moved from [2.15, 1.53, 2.87] to [0, 0.31, 3.89] |
| look switch off and on | works, skin material, bloom, fill light and tone mapping switch together |
| page errors | 0 |
| Chirp, KANSEI, Neural Canvas pages after the shared edits | see GAPS G11 |

Not exercised: Safari and Firefox, any real GPU, sound (the page has none).

## The look (optional, switchable, default on; law 39)

`DefaultRenderingPipeline` HDR (bloom, FXAA, vignette, one tone-mapping step at the end, KHR PBR Neutral), a lit glossy shell per skin whose emissive rim glows through a Fresnel (the vertex colour carries the wave sign: orange positive, blue negative, so both the lit side and the glow take it), a soft hemispheric fill, key lights at 0.55. The pill at the top right switches to As authored (the shared body's lit material, scene tone mapping). `?look=0` starts there. `compare-sheet.jpg`: row 1 X_ITE 16.5.1, row 2 Babylon As authored, row 3 Babylon cinematic; columns 4fxyz, 3s, Lyman frame 0.

## Engineering in the body (shared files)

| change | file | why |
|---|---|---|
| `IntegerSequencer` (a step interpolator) | brain/reader.js | the Lyman clock drives the 24 frames through one |
| a Shape that gets its `geometry` after it was built is built in place (and a Switch re-applied) | cloud/cloud-look.js | the page makes empty Shapes in a Switch and fills them later |
| **geometry cache key now carries the colour variant** (`g.id` plus `c` or `n`), dispose loops cover both | brain/body.js, drift/drift-ext.js | F5 below |
| EXAMINE navigation kept via `window.__keepNav` | chirp/chirp-pre.js (also used by Chirp) | shared with Chirp |
| first Viewpoint bound at load | cloud/cloud-look.js | X3D rule |

Findings kept for the playbook: **F5** `geometryData` and `babylonGeometry` shared one cache key, so the second rebuild of any non-glass triangle set got the first call's vertex data without colours or the other way round and drew 0 vertices. It stayed hidden because the brain and KANSEI pages rebuild only once. Fixed by suffixing the key; Chirp, KANSEI and Neural Canvas re-checked (GAPS G11). **F6** an `IntegerSequencer` is not in the nodes the reader interpolated; add it wherever a study steps through frames. **F7** a lit Babylon `StandardMaterial` goes black on the side facing away from the key lights; a `HemisphericLight` is the dependable fill (GAPS G7).

## Not in this repository

The built page is not committed (it embeds the study's payload bytes). Build it with the command above. No timing is claimed; no Timing button yet (GAPS G9).
