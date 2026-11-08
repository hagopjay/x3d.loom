# Gobbler demiurge on Babylon WebGPU: receipt

Date 2026-11-08. Port #7 (Material Odyssey was #6). Scope: draw the Gobbler demiurge page (`hagopjay/x3d.onto`, folder `gobbler-demiurge/`, scene `gobbler4-bird.x3d` sha256 `888a7934...8d1c` from `make v4-data demiurge-data`) with Babylon.js 9.32.0 in WebGPU mode, the page's own `boot.js`, `sound.js`, the v4 hover layer and the Deep `common.js` unchanged. The X_ITE page is untouched; the Babylon page is a build into a new folder (`src/build-demiurge.py`).
Grades: C measured or seen here, L reasoned, S suspected.

## What was built (C)
| piece | note |
|---|---|
| `src/demiurge/reader-ext-dm.js` | LOD, HAnimHumanoid / Joint / Segment / Site, ProximitySensor, Inline; TimeSensor pause and start-at-activation |
| `src/demiurge/body-dm.js` | LOD distance switch, HAnim as transforms, ProximitySensor (box test, camera pose out), Inline fetch and adopt, TriangleStripSet, per-face colour programs, vec4 and MFFloat uniforms, camera planes from the Viewpoint, reversed float depth |
| `src/demiurge/wgsl-dm.js` | four WGSL programs: Sun, Glow, Air (atmosphere), Weave (the Armenian knot's thread); the other six GLSL programs of the scene (sky, eye, facet, line, point, hide) hash-match the Gobbler 3 ports |
| `src/demiurge/boot-dm.js` | `<x3d-canvas>` and the browser object for the page's code; activeViewpoint |
| `src/build-demiurge.py` | refuses a scene with an unported program (10 distinct programs, 105 ComposedShaders, all ported); `--flat` writes the private-host copy |
Scene census (C): 411 Shapes, 105 ComposedShaders, 108 + 108 HAnimJoints (tenders and villagers), 43 Billboards, 38 LODs, 173 IndexedLineSets, 12 TriangleStripSets, 5 Inlines (Earth, clouds, Moon, village, villagers), 3 ProximitySensors, 1 ParticleSystem.

## Checks (C: Chrome for Testing 153.0.8010.12, SwiftShader, correctness only)
`compare-sheet.jpg`: X_ITE 16.5.1 | Babylon, the eight ladder views (face, ribcage, heart, Earth, village from orbit, plaza, villager, feather), `?ui=none&seed=0`, 960x540. The bird, the Sun (granulated), the ribcage beads, the Mashtots letters, the knot, Earth with clouds and Moon, the village with its fountain jets, the villagers and the feathers all draw. `metrics.txt` has PSNR and mean RGB per view; read them with G3 to G5 (timers differ, X_ITE's village frame is black in this rig, the Babylon frame is brighter).
`demiurge-play.js` (`play-result.json`): the keys 2 to 8 and 1 flew the whole zoom ladder; the three zone sensors entered and left where they should (Earth at stop 2, the village at stop 3, the fan at stops 2 and 8); the camera near plane went 0.3, 0.011, 0.0015, 7.5e-5, 2.5e-5 and back to 0.3; the tour ran; the UI key cycled; page errors: none. Not exercised: sound, hover clicks (G6, G7).
`--flat` copy (27 files, 4.7 MB) served from a local folder: boots and draws the plaza (the `.x3d` files go up as text/plain, scene and graph as base64 gzip).

## Open
Skinning of the HAnim figures (G1), real-GPU pass and Timing (G12), the leak sweep before any public copy (G13).
