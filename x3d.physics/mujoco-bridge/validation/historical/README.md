# MuJoCo Observatory

A recovered browser experiment workbench built on **MuJoCo 3.17.0 WebAssembly**, React, and Three.js. It combines a repaired real-engine prototype with a documented collection of teaching assets extracted from a second prototype.

Start with [RECOVERY_REPORT.html](RECOVERY_REPORT.html) for the assessment, measured fixes, salvage decisions, and next integration choices.

## Run the prebuilt application

The package includes a self-contained production build at `dist/index.html`. **Open that file directly in a compatible browser** for the fastest start; the separate `MuJoCo-Observatory.html` download is the same build. Direct opening was verified in Chromium with external networking blocked.

If your browser restricts local-file behavior, serve it from the project directory:

```sh
python3 -m http.server 8000 --directory dist
```

Open **http://localhost:8000** in a modern desktop browser with WebGL support. On Windows with WSL, run the command inside WSL and open that address in the Windows browser. Stop the server with Ctrl+C.

This static server does not implement a Python simulation backend. The application runs its physics in the browser. The built HTML embeds the application and WASM bytes; localhost is the fallback launch path. Windows/WSL behavior was not tested in this environment.

## Develop and verify

Use **Node.js 24 or newer**. The included verification loader uses Node's TypeScript support. Install the exact locked dependency set, verify the engine, and start Vite:

```sh
npm ci
npm run verify
npm run dev
```

Open the local address printed by Vite. To type-check and create a fresh production build:

```sh
npm run build
```

`build` runs TypeScript checking before Vite. The output replaces `dist/index.html`. Additional useful commands:

```sh
npm run typecheck
npm run preview
node --import ./scripts/register-loader.mjs ./scripts/check-cartpole-controller.mjs
```

Dependency installation needs network access. There is no account, API key, or external simulation service to configure.

## First experiment

1. In **Workspace**, select the ball-drop preset and inspect its MJCF.
2. Pause and reset. **Step** advances exactly one model timestep.
3. Open the inspector's State and Sensors tabs. Free joints show seven position values and six velocity values, with quaternion order and units labeled.
4. Compare height, velocity, contact count, and energy in Telemetry. Select signals individually when their numerical scales differ.
5. Change one source parameter, select **Apply**, and repeat from the same initial state.
6. Record a hypothesis and observation in **Experiment note**. Export the current CSV or observation packet.

The **Field guide** contains four protocols: contact evidence, disturbed cartpole recovery, interpreting the double-pendulum exercise, and separating display frames from physics steps.

## Source, live settings, and exports

The editor can contain a draft that differs from the running model. **Apply** invokes the real MuJoCo compiler. A compilation error keeps the last valid model available. The interface displays whether unapplied changes exist.

- **Import MJCF** places a self-contained XML file under 2 MB in the editor; Apply compiles it.
- **MJCF download** exports the editor text, including any unapplied draft.
- **Options (live)** changes the current model's options. These edits do not rewrite XML. Recompiling restores source settings. Contact `o_*` overrides require the override flag; the inspector exposes that switch.
- **Observation JSON** captures the compiled source XML, effective editable options, engine version, counts, state arrays, named world body poses, sensor metadata, the experiment note, and the current telemetry buffer.
- **Telemetry CSV** exports the current buffer with simulation timestamps. Samples are taken at display updates, with duplicate simulation times suppressed; this is not a uniformly sampled per-physics-step control trace.

The observation schema is `mujoco-observatory/observation-v1`. It is an observation and analysis packet, **not a complete integration-state checkpoint**. No checkpoint import, complete deterministic replay, or control-event recording is implemented. External mesh/texture files are not embedded in the packet.

Draft and note persistence use browser storage when available. Export files when you want a portable record. Browser storage availability and contents depend on the browser profile and origin.

## What was repaired

- Fixed-step accumulator removes refresh-rate-dependent simulation speed.
- Pause, slow motion, and one-step controls have tested semantics.
- Explicit energy calculation produces the expected 2 J for the known 1 kg / 2 m/s fixture.
- Failed compilation preserves the last working model.
- Challenge checks run in independent simulations and reject mismatched models.
- The cartpole challenge starts with a real disturbance; locally tuned feedback recovers from tested ±0.08 rad starts.
- Ball checks identify the ball–floor pair. The spider predicate includes body height and orientation.
- Model-local mesh caches and WASM handle cleanup follow observed ownership behavior.
- Derived poses, continuous hinge angles, full joint coordinates, keyframe labels, and RGBA preview alpha are corrected.
- Targeted course/reference statements were corrected, including sensor cutoff/noise and contact-override semantics.

This is a recovery build. It does not claim complete physical validation of every model, a fully reviewed course, or general robustness of the bundled controllers.

## Verification evidence

The included results in `validation/` record **32 passing checks and zero failures** using the actual MuJoCo WASM module under Node. Seven bundled presets and five extracted MJCF starters compiled and ran a **0.1-second smoke simulation** with finite state. Challenge trajectories have separate, longer durations.

Five of six challenge starters meet their goals. The solver-tuning starter intentionally remains unsolved; a separately completed fixture passes. An unmet learning goal is different from a runtime error.

The inherited timing fixture advanced 1.20 simulated seconds at 30/60 Hz and 1.44 seconds at 144 Hz for one wall-clock second. The recovered fixture advances 1.00 second at all three rates. The control comparison holds bundled MJCF and acceptance thresholds fixed while testing inherited and tuned feedback from perturbed starts.

See [validation/README.md](validation/README.md) and its JSON records for measured values, reproduction commands, and test boundaries. Browser/WebGL checks are separate: `validation/browser-results.json` records **12 passing checks**, no unhandled page or console errors, and direct-file operation with zero external network requests. All seven presets rendered, the extracted arm imported, exports contained real state, checks preserved workspace state, and desktop/narrow layouts avoided document overflow. The browser test environment was Chromium 134 on Linux with software WebGL.

## Package map

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Prebuilt browser application |
| `RECOVERY_REPORT.html` | Standalone recovery assessment and integration vision |
| `src/mujoco/engine.ts` | Actual WASM compilation, stepping, introspection, telemetry, and isolated trials |
| `src/mujoco/viewer.ts` | Three.js view of compiled model geometry and engine poses |
| `src/data/` | Active presets, lessons, reference, and challenge definitions |
| `src/components/ExperimentDeck.tsx` | Four experiment protocols |
| `src/utils/experiment.ts` | Observation JSON and telemetry CSV exports |
| `scripts/` | Real-engine verification and controller comparison |
| `validation/` | Measured results and scope notes |
| `salvage/models/` | Five extracted MJCF starters, separate from active presets |
| `salvage/model-provenance.json` | Original XML, exact corrections, caveats, parameters, and hashes |
| `salvage/historical-curriculum.json` | Eleven historical lessons with review metadata |
| `salvage/historical-quiz.json` | Five historical quiz questions with review metadata |
| `salvage/INVENTORY.md` | Detailed salvage assessment and source references |

## Current limits and next integration

The importer supports self-contained XML; it does not upload or resolve an arbitrary directory of external meshes, textures, includes, and plugins. The viewer supports common primitives and a compiled mesh subset. It does not reproduce the full native MuJoCo rendering feature set; unsupported geometry can appear as a placeholder.

Simulation and challenge checks run on the main thread. Long checks can briefly block the interface. Real-time catch-up is deliberately bounded. A worker-based execution path is a future enhancement.

The package includes hand-coded example controllers and learning checks. It contains **no reinforcement-learning trainer**, Python backend, X3D/X_ITE adapter, or Defold integration. A proposed next phase is an observable experiment workbench: preserve MJCF/MuJoCo as the physical authority, add a Python/WSL validation bridge, and connect optional visual or game-engine consumers through explicit named state and coordinate contracts.

The historical curriculum and quiz are preserved for review; they are not loaded as an authoritative course. The extracted XML starters retain caveats documented in their provenance file, including sensor naming/site coverage and arm keyframe considerations.

## Provenance and rights

The two uploaded archives were assessed separately. Original emitted XML and archive hashes are retained in the salvage records and recovery report. This recovery does not assign a new blanket license to uploaded source. Dependencies retain their respective package licenses and notices.
