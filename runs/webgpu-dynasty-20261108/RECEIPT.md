# Dynasty Loom hypersphere on Babylon WebGPU: receipt

Date 2026-11-08. Port #8 (Gobbler Demiurge was #7). Scope: the Dynasty Loom v5 page (private artifact build) with its hypersphere view drawn by Babylon.js 9.32.0 in WebGPU mode through our own X3D reader and SAI shim; the page's own scripts run unchanged. The tapestry (Loom) view stays on X_ITE 16.5.1 (G1), so the built page is a hybrid. Without WebGPU both views use X_ITE as before. The original page is untouched; the Babylon page is a build into a new folder (`x3d.webgpu/demo/src/build-dynasty.py`), bundle tag `1d8afc5d1e5c`.
Grades: C measured or seen here, L reasoned, S suspected. Rig: Chrome for Testing 153.0.8010.12, SwiftShader, correctness only, 960x540, `?ui=none&tier=balanced`. Standing rule from the owner: not pixel perfect, log the gaps (GAPS.md, G1 to G14).

## What was built (C)
| piece | note |
|---|---|
| `dynasty/wgsl-dl.js` | six WGSL programs keyed by ComposedShader DEF (sky, ring, seed core, seed and bead glow, fibre, shell); the look constants are read from the scene's own GLSL so one body serves both looks |
| `dynasty/body-dl.js` | custom meshes for the IndexedTriangleSet programs, FloatVertexAttribute buffers, BlendMode and alphaMode mapping, textured-Unlit transparency, hidden-canvas skip, analytic depth write |
| `dynasty/reader-ext-dl.js` | `alphaMode`, Viewpoint `navigationInfo` |
| `dynasty/boot-dl.js` | `x3d-babylon` element, adapter probe (`__dlProbe`, `__dlWebGPU`), `getImportedNode` |
| `build-dynasty.py` | refuses an unported DEF, patches the page's `canvas()` and `ensure()`, writes `babylon/bundle.js` |

## Checks against X_ITE 16.5.1 (C)
`compare-museum.jpg`: rows alternate X_ITE and Babylon, eight shots (Host, Inside, S02_Present, Crown, S05_Present, House_london, Colossus, Wide), museum look, idle orbit off, 10 s settle on the X_ITE side.

| shot | PSNR dB |
|---|---|
| Host | 37.8 |
| Crown | 34.4 |
| Wide | 35.3 |
| House_london | 32.0 |
| Inside | 31.9 |
| S02_Present | 30.7 |
| Colossus | 30.3 |
| S05_Present | 29.0 |

Mean RGB differs by 0.7 to 1.1 levels (Babylon slightly brighter) on every shot. The poses were not compared numerically (the pose lines in the capture logs are cut off), so a pose mismatch is not ruled out for the lowest shots; the images were checked by eye.
Documentary night look (`compare-night.jpg`): Host 36.9, S02_Present 29.8; Crown 18.8 and Wide 22.1 are probably pose drift on the X_ITE side (S). Selection of a person (`dynastyNav.select`): 39.4. Lens on: 36.3.

## Visitor play test (C): `play-result.json`
Hypersphere ready on `X3D-BABYLON`; flight to stop 3; select and clear; lens on and off; tour moved from stop 3 to 4; quality tiers fast and ultra; family Habsburg; night look; switch to the X_ITE tapestry and back. Page errors: none. Two console 404s (X_ITE's line-type files), also on the original page.

## Open
Tapestry on Babylon (G1: PROTO, Text with TTF, second engine instance), real-GPU pass and Timing (G13), logarithmic depth (G2), pointer taps and hover not driven (G11).
