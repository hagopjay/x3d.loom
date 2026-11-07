# KANSEI on Babylon WebGPU: receipt

Date 2026-11-07. Port #3 from the WebGPU port map (Pantheon splats #1, the brain #2). Scope: play the KANSEI drift game (`x3d.drift`) with Babylon.js 9.32.0 in WebGPU mode through our own X3D reader, the game's `engine/*.js` and `main.js` unchanged (two text edits in the build copy, see `x3d.webgpu/demo/README.md`). Spend $0. What was built, its traps and its limits are in [x3d.webgpu/demo/README.md](../../x3d.webgpu/demo/README.md#kansei-on-babylon-webgpu-the-drift-port).

Grades: **C** is measured here with the named instrument; **L** is reasoned from sources; **S** is suspected.

## Same simulation, then same picture? (C: headless Chromium 153.0.8010.12, SwiftShader adapter, correctness only, no timings)

Both pages replay the same committed tape to the same frame with `?tape=tapes/<id>.tape.json&frame=N&hud=0&cam=<cam>&noanim=1&live=0&cscale=1` at 640 x 360, with the game's own `?hud=0` and render scale 1. The sim hash is the game's `hashSim` (`kansei-engine/4`) read from `window.__ready` in each page; it is identical in both renderers for 6 of 6 views, so the two frames show the same car state on the same circuit and differ only in how they are drawn. The instruments: Babylon 9.32.0 WebGPU on the SwiftShader adapter (this port), and X_ITE 16.5.1 on software WebGL (`x_ite-16.5.1.tgz`, sha256 prefix `f93bc35f2eec515ec2e3`), the page the game was written for.

| view | tape, frame, camera | sim hash (both pages) | PSNR full | PSNR masked | mean RGB, Babylon | mean RGB, X_ITE |
|---|---|---|---|---|---|---|
| kp-1200 | kessel-pass-attack, 1200, chase | `c589c375c77c51e5` | 28.48 dB | 28.47 dB | 108.5 99.5 94.6 | 108.5 95.9 89.1 |
| kp-2600 | kessel-pass-attack, 2600, close | `090955f0d26bbb45` | 26.20 dB | 26.05 dB | 106.2 96.4 93.6 | 106.8 94.8 91.4 |
| no-1500 | neon-overpass-attack, 1500, chase | `3cc95b8d8fa3653f` | 32.83 dB | 32.46 dB | 39.6 38.4 53.0 | 38.7 37.6 52.1 |
| sr-1500 | salt-ring-attack, 1500, chase | `3df1ebfedc1ff8ec` | 26.94 dB | 26.91 dB | 142.8 134.9 131.3 | 143.1 133.1 126.3 |
| cf-1500 | cliffside-attack, 1500, chase | `36c4bc3e21f566b0` | 24.38 dB | 24.36 dB | 148.6 153.5 153.7 | 141.1 147.1 147.4 |
| pp-900 | practice-pad-attack, 900, chase | `2bab9e481c27d0ce` | 28.70 dB | 28.68 dB | 146.5 152.2 155.0 | 142.4 149.5 152.9 |

"Masked" is the brain port's convention: only the pixels where either frame has a channel above 14 of 255 (`compare.py`). Range 24.4 to 32.8 dB. [compare-sheet.jpg](compare-sheet.jpg) shows all six pairs (Babylon left, X_ITE right).

How to read it: 30 dB or more is the same picture with small shading and edge differences; the views in the 24 to 29 dB band show the same scene, the same car pose and the same light direction but differ in detail. Known differences, none tuned away to raise the number (the owner asked for some deviation to be allowed): the normal maps are drawn at 0.6 of their `normalScale` (scoring improved as the strength went toward 0, 26.40 dB at 0.0 against 25.61 dB at 1.0 on sr-1500, so 0.6 is a look compromise, not a fit); the tail-light emissive texture shows stripes; the far ridges are browner than X_ITE's paler grey (cf-1500 is the weakest view); the sky clouds are a little stronger. The light scale (`?ls=`, 2.2) was found by sweeping against region means of the road, car, sky and grass in X_ITE, so on that view (kp-1200) those four sit within a few of 255 of X_ITE; on the other views the mean RGB differs by up to about 8 of 255 (cf-1500).

## Played, not only replayed (C: same Chromium, SwiftShader, 1280 x 720, real-time page with the HUD on)

Page state read through the game's `window.KANSEI` hook; the console and `KANSEI.state().errors` were empty throughout.

- The title and garage screens drew (neon sign, turntable, pillars, the car); state `title`, audio context `none` until a key press, as in the original.
- `KANSEI.start({mode:'attack', track:'kessel-pass', car:'ronin'})` started a session (`screen: play`, phase `play`, `sha_ok: true`, audio context `running`, music `kessel-pass`).
- Holding W for 36 frames: 105 km/h, gear 3, 5457 rpm, tick 1416 (11.8 s of sim). Then A + Space + Shift: slip angle -14.5 degrees, `drifting: true`, 7536 rpm; the frame shows the boost flame, a smoke haze behind the car and tyre marks on the road, so the Babylon **ParticleSystem with a mesh emitter draws on this adapter** (C, one drift) and the road-mark decals work.
- A second session on `neon-overpass` with the `banshee` started and drew (`screen: play`, no errors). The wet-surface option was passed (`surface: "wet"`); no rain was visible in that start frame, which was not investigated (the rain particles are not claimed).

## The Timing button (C: node test with a stub DOM, and the real page on a software adapter)

`test-timing.js` drives `drift-timing.js` with synthetic frame timestamps: 60 Hz with three 60 ms frames over a 10 s window gives p50 16.7, p95 16.7, p99 16.7, max 60 ms, 3 frames over 33 ms, 592 frames; a SwiftShader adapter is flagged "do not count"; a hidden tab is flagged not valid; a page with 1.2 s frames is flagged "too few frames"; `?timing=0` removes the button; a missing Battery API gives `battery: null`. On the real page under SwiftShader the button produced the JSON block with `gpu_is_software: true` (vendor google, architecture swiftshader, fallback adapter) and 1200 ms intervals, i.e. the "numbers do not count" case. **No timing from any real GPU exists yet**; the owner runs it on his own machines. A figure from the harness is a harness figure.

## Harness notes

- Scratch layout the scripts expect, served over http at `http://localhost:8124`: `babylon.js` (a copy of `babylonjs@9.32.0/babylon.js`, sha384 `1XDybi1454WehNQaPHwhcTlpJ6oDdq/L4KKyDu7JiWPOBUzoBC0yEcuKDzHpdXyo`, the same value as the build's SRI), `drift` (the output of `build-drift.py --babylon /babylon.js`), `xite` (the game with X_ITE 16.5.1 in `vendor/x_ite`, the original `index.html`).
- `session-babylon.js` keeps one page open (stubbed swap chain, `requestAnimationFrame` slowed to 1.2 s) and serves command files; `run.sh` sends one command; `babylon-views.sh` and `xite-batch.sh` render the six views in `views.txt`; `compare.py` and `region.py` score them. The session waits for `window.__ready` (tape pages) or `window.KANSEI.ready` (the title and play pages).
- Headless cannot present a WebGPU swap chain here, and software frames take seconds, so the harness is slow: under a minute per Babylon view. A first X_ITE run of pp-900 timed out under CPU contention and was re-run alone.
- Frame times from this setup mean nothing and none are quoted. G0 (timing on the owner's own machine) is now open by his own word, and the Timing button is how he takes the number; this folder holds no timing from a real GPU.

## Not in this repository

The built page (the game plus `bundle.js`, about 14 MB with levels, cars, textures and tapes) is not committed: build it with `python3 -I x3d.webgpu/demo/src/build-drift.py --game x3d.drift --out OUT`. It carries no vendor, project or private strings (swept: the only matches for the sweep words were the graphics term "vertex").
