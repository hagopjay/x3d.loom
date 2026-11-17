# ŚRĪ · Resonance Loom

A native X3D mandala and harmonic instrument built around a measured, concentric Sri Yantra. Nine canonical triangles form **43 odd-coverage triangular chambers**. Their coordinates remain fixed while light, color, ornament and complete layers respond to one musical transport.

This is a separate application under `x3d.mandala/`. It translates the supplied Babylon mandala design into native X3D geometry, an auditable mathematical construction and optional Web Audio. It does not run a Babylon or Three scene behind an X3D export.

## Open the instrument

The downloadable release ZIP includes `dist/Sri-Yantra-Resonance-Loom.html`: a standalone HTML containing the application, pinned X_ITE runtime, required assets and field guide. Generated `dist/` files are excluded from the source patch; in a source checkout, first run `node tools/build.mjs` to create them. Open it in a modern browser with WebGL 2. Audio starts only after **Awaken sound**. If local-file restrictions prevent it from opening, serve the application instead.

From this directory:

```bash
python3 serve.py --open
```

Open **http://127.0.0.1:8844/**. The server binds to loopback only; leave its terminal open. Windows can use `run.bat`; WSL/Linux/macOS can use `bash run.sh`. Python 3.10+ is sufficient and no Python packages are required. Choose another port with `python3 serve.py --port 8850 --open`.

The source edition uses the vendored runtime and local files. The standalone is roughly 2.2 MB. The build prints exact current byte counts. No npm install, CDN account, backend, microphone or live peer network is needed for normal use.

## Play, listen and inspect

| Control | Behavior |
|---|---|
| **Studio** | Palettes, tempo, pulse depth, oscillator coherence, layer presence, inclination, listening level and detail |
| **Space** / **Resonance** | Add a shared-phase visual and musical accent |
| **P** / transport button | Pause or resume the shared audiovisual transport |
| **M** / **Sound** | Enable or mute optional sound |
| **H** / **Immersive** | Hide or restore the interface |
| **Escape** | Close the studio; modal dialogs retain normal browser Escape handling |
| **Geometry witness** | Inspect numerical bounds, chamber counts and the actual native point-field audit |
| **Stillness mode** | Hold layer motion while retaining gentle color and optional sound |
| **Desktop detail** | Change ornamental sampling; canonical triangle coordinates remain the same |

Keyboard shortcuts leave text inputs and selectors to their normal editing behavior. Stillness starts from the operating-system reduced-motion preference. Backgrounding pauses the transport; resume explicitly when returning. Pausing and muting have different meanings: muting leaves the visual transport running.

Start with both Sri Yantra layers, reduce the underlay presence, then compare **Overlay only**, **Underlay only** and **Mandala only**. Increase coherence to gather the synthetic phases; change tempo while listening for a continuous musical phase. The 108 Hz option is a musical tuning choice associated with A=432 Hz, with no therapeutic claim.

## What “precise” means here

The construction selects one member of the concurrent Huet/Chiodo family. Concentricity is imposed by matching the central triangle's incenter to the outer circumcircle center; three additional fixed parameters select the local member. There is no claim of a unique historical or universal “perfect” shape.

| Representation or check | Recorded value or declared acceptance bound |
|---|---|
| Construction arithmetic | 100-digit Python Decimal; maximum concurrency residual about 1.69×10⁻⁸⁶ R |
| Exported binary64 coordinates | Maximum concurrency residual about 6.10×10⁻¹⁷ R; constraint bound **10⁻¹² R** |
| Binary32-quantized coordinates / native point-field bound | Quantization residual about **1.84×10⁻⁸ R**; separate acceptance bound **10⁻⁷ R** |
| Complete finite-segment arrangement | 69 vertices, 142 edges, one component and 74 bounded cells |
| Active chambers | **43 odd-coverage triangular cells**, grouped 1 / 8 / 10 / 10 / 14 from center outward |
| Other bounded cells | **31 even-coverage voids**, including 10 triangles and 21 quadrilaterals |

R is the outer circumradius, normalized to 1. The full arrangement has 53 triangular cells; counting all triangles would misdescribe the conventional 43 active chambers. A near-fake can preserve a face count while breaking triangular shape or concurrency, so independent topology and incidence controls are both necessary.

Native X3D point fields and rasterized pixels do not carry the 100-digit construction precision. Line width, perspective, quantization and display effects have their own limits. Read [GEOMETRY.md](docs/GEOMETRY.md) and [the certificate](data/geometry-certificate.json) for the selected equations, measurements and coordinate identity. Executed checks and environment limits belong in [VALIDATION.md](docs/VALIDATION.md).

## Geometry, synthesis and sound have separate owners

- **Canonical mathematics:** `tools/generate_yantra.py`, `tools/audit_independent.py`, `data/` and generated `src/yantra-data.js` own the selected geometry and independent face arrangement.
- **Native scene:** `src/scene.js` builds named X3D coordinates, ribbons, chamber fills, lotus rings, points, materials and transforms. Foreground and background share canonical geometry with `DEF/USE`; animation applies whole-figure similarity transforms without wobbling individual vertices.
- **Synthetic field:** `src/field.js` samples 64 authored phases and uses the magnitude of their mean complex unit vector for circular coherence. It does not observe people, networks or physiological states.
- **Transport and audio:** `src/audio.js` owns phase-preserving tempo changes, clock handover, pause, bounded scheduling and the Web Audio graph. When enabled, sound and visuals read the same transport; the audio clock leads. Late musical events are skipped rather than replayed in a backlog.
- **Interface and exports:** `src/app.js` connects controls and native field updates. The field guide explains the instrument; the attachment review documents what was retained and repaired.

## Take it apart

| Export | What it preserves |
|---|---|
| **X3D snapshot** | Native scene geometry and current appearance; no live Web Audio graph or cross-viewer promise of identical lighting |
| **Save score** | Authored settings, tempo, fundamental, level, transport position and canonical geometry hash; not a recording or resumable checkpoint |
| **Certificate** | Numerical construction measurements, declared bounds, chamber classification, sources and canonical coordinate hash |

`dist/Sri-Yantra-Resonance-Loom.x3d` is the high-detail initial scene generated by the build. The live button serializes the current native scene as X3D 4.1 in this pinned X_ITE version; the authored initial scene declares X3D 4.0. The export adapter preserves the required Shape level 5 declaration. Each receives its own declared-version schema and semantic check. Sound remains browser JavaScript; a static X3D export does not automatically carry this instrument into every X3D viewer.

## Rebuild and investigate

Run from `x3d.mandala/`. Node 22+ is recommended; the tools use only built-in Node modules.

```bash
node tools/build.mjs
node --test test/*.test.mjs
python3 -m unittest discover -s test -p 'test_*.py'
python3 tools/audit_independent.py --self-test
```

The build verifies the pinned runtime hashes before making the standalone HTML and initial X3D scene. An optional first argument chooses the HTML output path: `node tools/build.mjs /absolute/path/preview.html`.

Regenerate the mathematical construction into a separate directory so existing authoritative data is not silently overwritten:

```bash
python3 tools/generate_yantra.py --output generated
python3 tools/audit_independent.py generated/yantra.json --output generated/independent-arrangement.json
python3 tools/audit_independent.py generated/yantra.json --controls --output generated/independent-controls.json
```

Both Python tools use the standard library. Inspect regenerated coordinates, certificates and hashes before replacing `data/` or `src/yantra-data.js`. Node tests cover canonical/serialized geometry, quantization bounds, controls that must fail, circular coherence, native-scene animation boundaries and explicit audio-clock adapters. Adapter tests are not evidence of audible output or native browser rendering.

The runtime is pinned to **X_ITE 16.8.0** in [ORIGIN.json](vendor/x_ite/ORIGIN.json). The vendor bytes stay unchanged. The derived standalone adapts resource URLs and CSS integrity for embedded assets; [packaging-adapter.json](docs/packaging-adapter.json) records those bounded changes. Retain the runtime, distribution and font license notices when redistributing.

Read [the field guide](docs/FIELD-GUIDE.html), [the attachment review](docs/ATTACHMENT-REVIEW.md), [fold-back lessons](docs/FOLDBACK.md) and [the PR draft](docs/PULL-REQUEST.md). [APPLY-PATCH.md](docs/APPLY-PATCH.md) names the exact integration base and commands. This application does not issue a repository-wide Loom acceptance or certification.
