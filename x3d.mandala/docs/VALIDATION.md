# Executed validation

Executed 17 November 2026 against the source in this package and the standalone HTML. These are bounded witnesses, not a repository-wide Loom acceptance or a proof about every browser, loudspeaker or display.

| Witness | Executed result | Retained evidence |
|---|---|---|
| Node unit and scene controls | **18 passed**, zero failures, Node 24.22.1 | `test/*.test.mjs` |
| Decimal construction controls | **5 passed**, Python 3.12.14 | `test/test_geometry.py` |
| Reproduction from the shipped builder | Five geometry data files and the generated JS module match the shipped bytes | [geometry-reproduction.json](geometry-reproduction.json) |
| Independent finite-segment arrangement | 69 vertices, 142 edges, 74 bounded cells; 43 active triangular chambers and 31 even-coverage voids; Euler consistent | [independent-arrangement.json](../data/independent-arrangement.json) |
| Independent negative controls | Synthetic crossing/triangle/nested cases; perturbed width breaks concurrency and active triangular shape even when 43 odd faces remain | [independent-controls.json](../data/independent-controls.json), reproduction report |
| Native browser and UI | Source and offline editions pass controls, native-coordinate audit, quality switch, pause, stillness, three exports, guide and 390px layout; zero page errors | [browser-validation.json](browser-validation.json) |
| Native Web Audio | **16 checks passed**; real analyser RMS about **0.00767**, three observed pluck voices within the cap of 12; phase continuity, mute, resume, tuning, level and disposal pass | [audio-browser-validation.json](audio-browser-validation.json) |
| X3D schema and semantics | Initial scene passes pinned X3D 4.0 checks; native browser snapshot passes its declared X3D 4.1 schema and semantic checks; malformed numeric data and unresolved USE are rejected | [native-validation.json](native-validation.json) |
| Standalone resource closure | Opens as `file://`; **zero HTTP(S) requests** in the UI and audio witnesses | Browser/audio reports; [packaging-adapter.json](packaging-adapter.json) |

The standalone SHA-256 for the executed audiovisual witnesses is:

```text
52c6caf22eb77074d8ae0d43f62c38fe2f4eaea752764283575c57d0560fd828
```

The initial high-detail X3D scene is 3,712,579 bytes. The authored scene declares X3D 4.0; X_ITE 16.8.0 serializes the live snapshot as X3D 4.1 with its standard fixed Web3D DOCTYPE. Each is validated against its own declared, pinned schema. The application budget for X3D validation is explicitly 8 MiB; it does not silently raise another application's input cap. Informational `unused-def` findings are expected because JavaScript accesses named nodes through the external browser interface.

## Precision boundaries

The 100-digit Decimal construction has a maximum concurrency residual around 1.69×10⁻⁸⁶ R. Its serialized binary64 data has about 6.10×10⁻¹⁷ R error against a 10⁻¹² R bound. Native `Coordinate` fields are binary32: the actual browser point-field audit measures about **1.835595×10⁻⁸ R**, below its separate **10⁻⁷ R** bound. The audit reads the native field after parsing; it does not merely check the source JSON.

The overlay and underlay reuse the same canonical coordinates. Their global similarity transforms preserve incidence; the browser witness confirms byte-identical canonical native points after animation, appearance changes and high/balanced scene replacement. The export adapter retains the scene’s required Shape level 5 because the pinned serializer emits level 4 despite using PointProperties. The normalized declaration changes no geometry and is covered by regression controls and native schema/semantic validation. The exported snapshot uses nine significant digits for single-precision fields to avoid additional serialization loss. It is independently checked after serialization.

These residuals are normalized geometric distances, not pixel errors. The ornamental circles are polygonal: high detail uses 320 chords, with relative radial sagitta about 4.82×10⁻⁵ of that ornament's radius. Lotus form, line ribbons, aura, filigree and palette are authored visual choices. No claimed 100-digit precision reaches the framebuffer.

## Browser and audio limits

The automated browser is Chromium 153.0.8010.0, locale `en-US`, with SwiftShader and headless Playwright. The source edition was served over loopback; the standalone was opened directly as a file. Both desktop (1440×960) and phone-width (390×844) layouts were inspected. The latter establishes layout behavior, not measured mobile-GPU performance. The balanced setting reduces ornamental tessellation and particles without changing canonical geometry.

The sound check samples the native Web Audio graph. Playwright mutes hardware output, so this establishes synthesis and scheduling behavior rather than human listening quality, acoustic sound pressure or perceptual audio/display latency. An enabled audio context is the shared master clock; while muted the phase-continuous transport uses the performance clock. Rendering can lag a scheduled audio event by a browser frame or more. No fixed hardware frame-rate promise is made.

## Reproduce

From `x3d.mandala/`:

```bash
node --test test/*.test.mjs
python3 -m unittest discover -s test -p 'test_*.py'
python3 tools/audit_independent.py --self-test
node tools/build.mjs
python3 tools/validate_x3d.py
```

Schema validation additionally requires `lxml` and `jsonschema`; the pinned validator implementation and local schemas are included. The artwork itself needs no Python package installation. Browser witnesses additionally require Playwright and a compatible Chromium installation:

```bash
python3 tools/check_browser.py
python3 tools/check_audio_browser.py
python3 tools/validate_x3d.py dist/Sri-Yantra-Resonance-Loom.x3d .work/browser-export.x3d
```

Pass `--chromium /absolute/path/to/chromium` when using a custom executable. The UI witness writes its current snapshot to `.work/browser-export.x3d`; it is identified in the report but excluded from the source patch and release. Appearance timestamps and phase make repeated snapshot hashes differ. Browser inspection screenshots are optional internal outputs and are not part of the release. See each tool's `--help` for alternate standalone paths and source-mode options. Rebuilding after source changes produces a new artifact identity and requires fresh relevant witnesses.

## Integration status

The patch targets `hagopjay/x3d.loom` base `a02a1a289b222900382e5106132d79f80a35dc28`. A clean-index patch-application check is recorded with the delivered patch. No remote branch or PR was published: GitHub access is disabled in this environment and no authenticated `gh` account is available. The patch, PR description and application are complete and reviewable locally.
