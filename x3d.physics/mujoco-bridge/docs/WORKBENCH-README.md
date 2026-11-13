# MuJoCo Observatory · Control & Contact Lab

**Release 0.2.0 — a local browser workbench using actual MuJoCo 3.17.0 WebAssembly.**

Three core experiments combine real physics, human controls, named observations, repeatable measured runs and baseline comparisons. No account or API key is required. The production HTML embeds the engine and app; running it does not require npm or an internet connection.

## Start here

Extract the entire ZIP first. Recommended startup:

- **Windows:** double-click `START-Windows.cmd` (requires Python 3), or run `py -3 start.py`.
- **Windows with WSL:** run `bash START-WSL.sh`, then open the printed localhost URL in your Windows browser.
- **macOS/Linux:** run `python3 start.py`.

The launcher serves `dist/` on loopback only. If port 8000 is occupied, it selects a free port and prints the URL. Ctrl+C stops the server. It uses Python's standard library and installs nothing. The server is static; physics runs in your browser, not in Python.

You can also try opening `dist/index.html` directly. If local-file restrictions prevent startup, use the launcher. A separate `MuJoCo-Control-Contact-Lab.html` download contains the same application. Use a recent Chrome, Edge, Firefox or Safari with WebGL support; actual compatibility with each browser and Windows/WSL has not been verified for this release.

## A useful first session

1. Start with **Reach & contact**. Feedback is enabled for the bundled arm. Select **Restart experiment** to begin at the home keyframe. Drag to orbit, right-drag to pan, and wheel to zoom. **Fit** restores framing; top/front/side offer repeatable views.
2. The cyan marker is the commanded tip location. The orange sphere is a fixed obstacle. Move the shoulder or elbow target. Contact can prevent exact tracking.
3. Select **Measure 5 s**. The workspace pauses while an independent simulation runs, sampling every physics timestep. The live pose is preserved. Trials yield in chunks so cancellation and progress can update.
4. **Pin as baseline**, change a target or edit the obstacle's MJCF and Apply, then measure again. Select `tip_touch`, a joint angle, or a control/force signal in the saved-run chart. Amber is the pinned run; cyan is the current measured run. A baseline survives Apply and navigation until cleared or the page reloads.
5. Export **Trial JSON** for both runs and their metadata, or **Trial CSV** for the current run's full sampled series. Download before leaving or reloading if you want to keep the result.

The arm is a simplified horizontal mechanism with collision enabled at its tip. It is an explanatory contact experiment, not a complete robot or a general manipulation policy.

## The three labs

| Lab | Controls | Measurement |
| --- | --- | --- |
| Reach & contact | Joint PD feedback, two angle targets, or manual motor commands | Joint tracking, tip touch, contact count, saturation |
| Recover balance | Local cartpole feedback, zero-input/manual mode, +0.08 rad disturbance | Full trajectory and final error from a documented tilt |
| Read the rebound | Passive ball drop, contact parameters in MJCF | Height, velocity, contact, energy |

Eight presets are included. The three labs are the main product path; pendulum, double pendulum, spider, hopper and humanoid are additional learning examples. Articulated-body presets do not ship with trained locomotion policies. Seven isolated challenge checks cover contact, rebound, local balancing, the arm, motion, crawling and an intentionally unsolved solver exercise.

**Commands / Ctrl+K** finds models, pages and transport actions. Learn contains the recovered active course and a five-question experimental reasoning check. The historical curriculum is retained under `salvage/` for provenance, not presented as fully reviewed course material.

## Physics and records

- **Apply & run** compiles MJCF in MuJoCo. Invalid XML preserves the last working simulation. Editor drafts and running source are visibly distinguished.
- **Step** pauses and advances one model timestep. **Reset** resets state; it retains the selected live controller. **Restart experiment** uses the arm home keyframe or qpos0, adds the documented cartpole disturbance when applicable, and plays.
- **Feedback** is supplied only for the bundled cartpole and contact arm. Cartpole feedback is empirical local regulation around upright, not swing-up. The arm uses per-joint PD control. Input is clamped to compiled actuator limits. Recipes and settings are exported.
- **Options (live)** changes compiled options without rewriting XML. Applying source restores its settings. Editable options are copied into independent trials and challenge checks.
- The viewport shows average physics CPU time per display frame, render **CPU submission** time, FPS, simulation/wall-time ratio, omitted catch-up time and WebGL draw/resource counts. Render CPU time is not GPU timing. Fast/Balanced/High control pixel density and shadows.
- The fixed-step scheduler carries fractions between frames. Catch-up is bounded to avoid long stalls. Dropped simulated time is reported; real-time performance depends on hardware and model complexity.

### Two different exports

**Observation JSON** captures the current live state, applied XML, controller configuration and recipe, options, named world body poses, sensor metadata, experiment note and a rolling display-frame telemetry buffer. **Telemetry CSV** exports that rolling buffer. Sampling follows display updates and suppresses duplicate timestamps.

**Trial JSON** contains the current run and optional baseline. Every run includes applied XML, engine version, effective editable options, controller recipe/settings, reset keyframe, initial position/velocity, disturbance, timestep, duration and a sample at every physics tick. **Trial CSV** exports the current trial, including the initial sample.

A trial always starts from its documented reset, **not the arbitrary live pose**. The arm starts from `home`, cartpole from qpos0 plus +0.08 rad, and other models from qpos0. The duration is five seconds rounded upward to a whole physics step. A 25,000-step cap rejects overly expensive interactive trials. Baseline overlay requires matching engine version, timestep, sample count and signal layout; inspect recorded model, controller and start metadata when interpreting differences.

These are analysis records. Neither format is a full MuJoCo integration-state checkpoint; there is no checkpoint importer or deterministic replay implementation. Controller events during free interaction are not recorded as a replay trace.

Browser storage remembers the editor draft and experiment note when available. Measured runs and pinned baselines remain in memory until reload. Export them for persistence.

## Develop and verify

Use Node.js **24+**:

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm test` runs the real-engine suite, workbench extension suite and DOM component integration checks. `build` first runs strict TypeScript checking and then generates a single HTML file with Vite. Dependency versions are locked. Installation needs network access; the prebuilt app does not.

**Fresh verification on 5 November 2026: 34 core engine checks, 14 workbench checks and 9 DOM integration checks passed.** Eight presets and five extracted starter models compiled and stepped. Six challenge starters met their goals; the solver exercise deliberately starts unsolved and its completed fixture passed. Tests include real contact-arm force readings, repeatable full trajectories, unobstructed target tracking, ±0.08 rad cartpole recovery, cancellation, isolation, limits, incompatible-controller rejection and exports. DOM checks exercise startup, measurement, navigation, baselines, invalid-editor recovery, exports and commands with real WASM; canvas, dialog mechanics and download activation are substituted. See `validation/runtime-results.json` `validation/workbench-results.json` and `validation/ui-dom-results.json`.

**Browser verification is incomplete for this release.** The cloud verification browser could not open local build files; its localhost endpoint did not reach this workspace's server. The older recovery's browser results are retained under `validation/historical/` and do not establish current UI or WebGL behavior. Startup scripts, browser layouts, camera interaction and downloads need a real desktop browser smoke check. TypeScript/build and headless physics results are separate evidence.

## Limits

Self-contained MJCF imports are limited to 2 MB. No arbitrary external asset-directory import, include resolver, RL trainer, Python simulation backend, X3D/X_ITE adapter or Defold bridge is included. Rendering covers common primitives and a compiled mesh subset; unsupported geometry uses visible pink placeholders and a warning. Native rendering parity is not claimed. Simulation runs on the main thread; measured trials yield, while challenge checks remain synchronous and can briefly pause interaction.

## Package map

- `dist/index.html`: prebuilt application.
- `start.py`, `START-Windows.cmd`, `START-WSL.sh`: local launchers.
- `src/`: editable React/Three.js/MuJoCo workbench.
- `src/mujoco/controllers.ts`, `trials.ts`: live control contracts and measured experiments.
- `scripts/`: reproducible real-WASM verification.
- `validation/`: current results and scope; `historical/` contains earlier evidence.
- `salvage/`: extracted XML, original teaching material and provenance ledgers.
- `RELEASE_NOTES.html`: compact handoff and integration decisions.
- `RECOVERY_REPORT.html`: historical recovery assessment; its tests refer to release 0.1.

Original source provenance is retained. The workbench is part of the X3D-MuJoCo bridge and licensed under Apache-2.0 (`LICENSE`, `NOTICE`). Dependencies retain their package licenses; see `THIRD_PARTY_NOTICES.txt`.
