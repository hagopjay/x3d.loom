# Gobbler 3 on Babylon WebGPU: receipt

Date 2026-11-07. Port #2 of the WebGPU port map (Pantheon splats was #1). Scope: draw the Gobbler 3 page (`hagopjay/x3d.ml` `gobbler-v3/build-public-candidate`, scene sha256 `1fd1be53...30c2`, 121 entities, 17 ComposedShaders, 64 ROUTEs) with Babylon.js in WebGPU mode through our own X3D reader, the page's own `common.js`, explorer and tour unmodified. No cloud services or paid APIs were used. The owner asked for sound Babylon engineering and strong visuals, not pixel parity, and for every gap to be logged: section 4 is that log.

Grades: **C** measured here with the named instrument, **L** reasoned from sources or read by eye, **S** suspected.

## 1. What was built (C: counted from the repository)

| piece | size | note |
|---|---|---|
| `src/gobbler/reader-ext.js` | 8 node types added | PointSet(7 in the scene), TextureCoordinate3D(4), TextureCoordinate(2, 2D), IndexedLineSet(2, hidden), PixelTexture, VolumeEmitter, BooleanFilter, BooleanSequencer; Boolean nodes run as events through a wrapped `receive` |
| `src/gobbler/body-gob.js` | wraps `brain/body.js`, edits nothing in `brain/` | shader lookup by hash, per-corner attributes with RGBA and 3D texture coordinates, PointSet as camera-facing quads, CPU embers, bbox-centre sort, first Viewpoint bound at load (fires `bindTime`) |
| `src/gobbler/wgsl-*.js` | 733 lines for 6 programs | sky, eye, point, facet, line, hide; 17 ComposedShader nodes use these 6 distinct programs |
| `src/build-gobbler.py` | refuses a scene with an unported program | `--single` inlines scene, graph, css and js: 643 KB; multi-file build 197 KB (Babylon from the CDN, pinned 9.32.0 with SRI) |

## 2. How the shaders were ported (C)

- Five of the six programs went through the same loop: a porter agent writes the WGSL term for term and proves it compiles with `port-test.js`; an independent reviewer then compares every constant, operator and `select()` argument order against the GLSL and fixes real discrepancies. Point and line came back `faithful`; facet came back `fixed` (three `pow(negative, 2.0)` calls became squares, which are undefined in WGSL on some backends). Sky and eye were ported by the author. Hide has no pixels.
- The line and facet porters also replayed the original GLSL in WebGL2 (SwiftShader) on synthetic data and compared with the WGSL render; the facet replay matched to within 1/255 after the one known flat-varying change (item G7). Their harness scripts live in the session scratch, not in this folder.
- Depth bias: every `gl_Position.z -= k * w` became `z -= (k / 2) * w` (WebGPU depth is 0 to 1, GL's is -1 to 1): eye 0.004 to 0.002, point 0.003 to 0.0015, line 0.002 to 0.001.
- Points: WebGPU has no point sprites. The body draws four vertices per point with a `corner` attribute; the vertex shader widens by `corner * (s / viewport.zw) * w` where the GLSL set `gl_PointSize = s`, and the fragment shader rebuilds `gl_PointCoord` from the corner.

## 3. What was checked, and against what (C: Chrome for Testing 153.0.8010.12, SwiftShader adapter, correctness only, no timings)

Instrument: `compare-views.sh` (this folder). The same `gobbler3.x3d` and the same Viewpoint at 640 x 360 in this port (Babylon 9.32.0, WebGPU, stubbed swap chain, `requestAnimationFrame` slowed to 600 ms) and in X_ITE 16.5.1 (WebGL 2, full Chromium because the headless shell crashes on this scene). PSNR over pixels where either frame has a channel above 14 of 255.

| view | PSNR | mean RGB, this port | mean RGB, X_ITE |
|---|---|---|---|
| Wide | 16.19 dB | 58.2 42.9 34.0 | 56.6 40.3 30.5 |
| Colossus | 16.05 dB | 37.0 28.2 23.2 | 40.3 30.3 24.5 |
| Eye | 16.53 dB | 152.2 108.4 65.1 | 142.1 94.3 59.1 |
| Inside | 15.50 dB | 49.0 37.3 27.8 | 53.6 36.8 25.5 |
| Flywheel | 14.60 dB | 39.1 35.4 31.7 | 42.4 39.6 35.6 |
| Crown | 19.66 dB | 34.6 29.8 25.9 | 31.9 27.0 23.7 |

How to read it: these are low on purpose of the scene, not evidence of a wrong picture. The scene is animated on wall-clock timers (bird sway 32 s, four light paths 17 to 37 s, twinkle, blink) and the two renderers are captured at different instants after load, so the head, the lights and the stars are in different phases (L). Side by side, the head, lattice, ribbons, stars, flywheel rings, sky glow and eye match in structure and colour in all six views (L, by eye); the means are within about 10 of 255 except Eye (about 14). Mean brightness was the useful signal: with the unported line program the Wide mean was 63.8 against X_ITE's 56.2, after the fixes it is 58.2.

Page-level pass (the built page, `page-shot.js`): the page's own viewpoint chips, explorer list and card, loops list and tour ran with zero page errors; clicking an entity flew the Probe viewpoint and moved the pick marker; clicking the head fired Touch, the Dissolve timer, the Phase interpolator, the BooleanSequencer window and the ember system (112 and 633 live particles in two runs, with slowed frames); with the Intro active the Touch sensor was disabled through BooleanFilter, as the scene intends. The single-file build loaded 121 entities and 10 loops from its inlined graph.

## 4. Gap log (for later receipts; nothing here is hidden on the page: fallbacks are listed on screen, click the chip)

| id | gap | grade | effect |
|---|---|---|---|
| G1 | Points are quads, not GL sprites: sizes above the driver's point-size cap are drawn full size here. X_ITE on SwiftShader draws the big hub stars smaller | L | hub stars look larger and bloomier than in the X_ITE frames |
| G2 | No depth writes for the blended shapes; order comes from Babylon's distance sort, fed the scene's own `bboxCenter` values (X_ITE sorts by the same centres) | L | overlaps between head lattice, flesh and stars can order differently |
| G3 | PointLights (5) are ignored: they reach only the Material fallbacks, the shaders carry their own studio | C (read from the scene) | none unless a shader misses its hash |
| G4 | Time phases differ between any two captures (section 3); no frame-locked comparison exists yet | C | PSNR is not a parity figure; a `?t=` hold and an X_ITE clock pin would fix it |
| G5 | Embers: CPU simulation, one quad mesh, VolumeEmitter only; speed, lifetime and colour ramp follow the node, direction jitter and physics models are not built; `enabled = false` hides all particles at once | L | ember count and spread differ from X_ITE's |
| G6 | Picking hits facets only (the TouchSensor's group); ribbons are zero-area quads and points are quads | C | clicking a lone star does nothing (the page's explorer is how stars are picked) |
| G7 | Flat varyings: WebGPU takes the first vertex of a triangle, GL the last. The body rotates each triangle so its last corner leads (same winding) | C (facet replay) | burn timing of a facet is the same as GL's |
| G8 | Sky dither uses the fragment position, whose origin is top-left here and bottom-left in GL | L | the noise pattern is mirrored, same amplitude |
| G9 | Derivative flavour (`dpdx`, `dpdy`) differs from ANGLE at barycentric creases | C (facet porter, about 2.6% of lit pixels at one phase) | a thin rim differs |
| G10 | `Transform center/scaleOrientation` decomposed to TRS (shear dropped), as in the brain port | C | none in this scene |
| G11 | Only the public candidate (121 entities) was run; the deep build (2,476 stars, 292 KB scene) was not | C | the same node census, untested at that size |
| G12 | Nothing was run on a real GPU, so no timings and no pow/derivative behaviour on drivers other than SwiftShader | C | G0 consent is given for the Timing button; the button is on the page, off until pressed |
| G13 | The page's frame readout counts requestAnimationFrame callbacks (it reads `getCurrentTime`), not scene time | L | the number is the display's refresh at best |

## 5. Lessons (add to the playbook)

1. A `*/` inside a `/* */` comment in an inline script (a path like `runs/x-*/README`) ends the comment and kills the whole script with only "Unexpected token". Check inline scripts with `node --check`.
2. Babylon reports WGSL compile errors as console **warnings** ("WebGPU uncaptured error ... Error while parsing WGSL: line:col"), not errors. The harness must listen to both.
3. A page that is already a quad renderer needs no geometry job: this scene draws its ribbons as IndexedFaceSet quads, with the far endpoint in a 3D texture coordinate and a corner code in the normal. The port is attribute plumbing plus a term-for-term shader.
4. `gl_PointSize` ports as a quad expansion; derive the offset once (`s / viewport.zw * w`) and put it in the brief for every points program.
5. `pow(x, 2.0)` with a possibly negative `x` is undefined in WGSL; write the square. `smoothstep` with reversed edges is rejected for constants: use a helper.
6. `select(falseValue, trueValue, cond)`: argument order is the usual source of silent mistakes; reviewers should check each one.
7. Draw order matters for blended glow: the scene's `bboxCenter` is deliberate. Feed it to `mesh.setBoundingInfo` so Babylon's distance sort sees what X_ITE's does.
8. A slowed `requestAnimationFrame` (600 ms) makes time-dependent code misbehave: clamp `dt` as a parameter (`opts.maxDt`), not as a constant, or the embers age six times too slowly in the harness.
9. A custom element is a clean way to keep a page's own code unmodified: define `<x3d-canvas>` in the bundle, expose `.browser`, and make the SAI browser await the body's start.
10. Parallel porting works when each agent owns one file and one command (`port-test.js only=<name>`), and an independent reviewer re-derives the diff: six parallel agents (three porters, three independent reviewers), one real fix found by review.

## 6. Reproduce

```sh
# scratch folder served over http on :8124 with: babylon.js (babylonjs@9.32.0), vendor/x_ite (x_ite@16.5.1 dist), scenes/gobbler3.x3d,
# src -> x3d.webgpu/demo/src/brain, shared -> .../shared, gob -> .../gobbler, and this folder's compare-xite.html, grab.js, xshot.js, metrics.py
export NODE_PATH=$(npm root -g)
sh compare-views.sh http://localhost:8124 out
node ../../x3d.webgpu/demo/src/gobbler/port-test.js only=eye files=wgsl-sky,wgsl-eye png=out/eye.png
python3 -I ../../x3d.webgpu/demo/src/build-gobbler.py --page <gobbler-v3/build-public-candidate> --out gobbler.html --local-babylon babylon.js
node page-shot.js out/page.png 8000 "" http://localhost:8124/gobbler.html
```

Not in this repository: the built page, the scene and the screenshots (the scene's public candidate names two outside maintainers and waits for its owner's "publish").
