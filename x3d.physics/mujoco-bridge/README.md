# X3D ↔ MuJoCo · Authoring Proto-Bridge

**Experimental bridge 0.1** built around the contact-arm workbench. It gives X3D an active role in physical authoring, command input, named inspection, and portable experiment records. It uses **X_ITE 16.7.0** for standard X3D rendering and **MuJoCo 3.17.0 WebAssembly** for actual dynamics.

This is a working scaffold with a deliberately bounded `contact-arm/1` authoring profile. It is not a general scene converter, native X3D physics implementation, or lossless round-trip system.

## Start

**Extract the ZIP first.** Python 3 is the only launcher requirement; the app and engine are prebuilt.

- Windows: double-click `START-Windows.cmd`, or run `py -3 start.py`.
- Windows with WSL: `bash START-WSL.sh`, then open the printed localhost address in your Windows browser.
- Linux/macOS: `python3 start.py`.

The server binds only to loopback. It tries port 8000 and chooses a free port if needed. Ctrl+C stops it. Use the HTTP launcher: the app loads the included local X_ITE runtime, stylesheet and component assets, so copying or opening only `dist/index.html` is not the supported startup path. A modern browser with WebGL2 support is required for X_ITE. No API key, account or external simulation service is needed.

The full original learning workbench is available through **Original workbench** in the header (`?workspace=1`).

## First useful loop

1. Select **Run physics**. MuJoCo drives the arm; X3D receives its body poses. The tip changes color with physical touch force, and a contact marker shows the measured contact location.
2. Move the shoulder/elbow sliders. These are bridge commands to a torque controller, not direct body teleports.
3. In the X3D view, drag the **cyan sphere** to command a reachable end position. The adapter uses the elbow-positive inverse-kinematics branch; unreachable and out-of-range targets are rejected.
4. Drag the **orange obstacle**. Physics pauses while the visual edit is staged. Releasing sends a validated physical recipe edit; successful compilation resets the arm to home and leaves it paused. Run again.
5. Select **Measure 5 s**, then **Pin baseline**. Change a target, link mass or obstacle location and measure again. The independent trial preserves the live state, samples every physics tick and exports its own source and settings. Baseline summaries can refer to different physical configurations—inspect those records before interpreting differences.
6. Export **X3D scene** or **Experiment package**. The scene contains standard X3D geometry, pointer/drag behavior, physical annotations and stable binding IDs. The package adds MJCF, the manifest, observations, command acknowledgements and the available measured trial.

**X3D source** lets you edit physical annotations directly. Refresh the source, change the `UpperMass`, `LowerMass`, `UpperLength`, `LowerLength` or `JointTargets` MetadataDouble value, then select **Import authored X3D**. You can also edit `ObstacleHandle.translation` in its local authoring plane, and `ObstacleGeometry.radius`. Accepted fields regenerate the canonical scene and physical model; arbitrary presentation edits are outside the import contract and a warning reports this normalization.

## What the X3D side gains in this prototype

- **Authorable physical assets:** lengths and link masses are ordinary standard X3D metadata, not opaque values buried exclusively in JavaScript.
- **Real input/output:** PlaneSensor/ROUTE behavior supplies goals and authored obstacle edits; named transforms and metadata receive physical results.
- **Named inspection:** logical IDs connect X3D DEF names to MuJoCo bodies, geometry and sensors. Numeric engine IDs are resolved afresh after recompilation.
- **Portable `.x3d` scenes:** exported snapshots and drag interactions remain inspectable in compatible X3D tools without custom node types. External dynamics requires the bridge host.
- **An explicit integration seam:** protocol, recipe schemas, coordinate conversion, command acknowledgements, ownership rules and loss reports are separated from the React interface.
- **Evidence-bearing assets:** scenes travel with native physical source, unit/axis conventions, recipes, observations and declared limitations.

The application profile name `contact-arm/1` is **not an ISO X3D profile**. The emitted scene uses X3D 4.0 `Interactive`. No native RigidBodyPhysics conformance is claimed. A TouchSensor in this scene is a pointer sensor; the physical touch reading arrives separately from MuJoCo.

## Physical and timing contract

- MuJoCo owns dynamic poses and physical observations. X3D owns presentation and authoring intent.
- This mechanism has two horizontal hinge joints, controlled with local joint PD feedback and compiled actuator limits. Link collision is disabled; only the spherical tip participates in the contact experiment.
- `upperMass` and `lowerMass` specify link-geometry masses. The lower body also contains a fixed 0.07 kg tip. Decorative joint geometry has zero mass in the bridge profile. MuJoCo computes inertia from the physical geometry.
- Model edits reset to the home keyframe and pause. Target commands preserve physical state. The current controller is an illustrative local policy, not a general manipulation solution.
- The bridge uses metres, kilograms, seconds and radians. MuJoCo coordinates map to X3D as `(x,y,z) → (x,z,-y)`. World orientations use a proper change of basis and quaternion-to-axis-angle conversion. Independent body transforms avoid double-parenting errors.
- A frame is a display observation, not necessarily a unique physics tick. Display sampling can repeat simulation time while paused. Measured trials sample every physics timestep.
- Trials and observations are analysis records, not full restart checkpoints. There is no deterministic checkpoint replay, arbitrary external asset importer or remote transport.

## Import boundary

The curated importer accepts only its script-free standard-node subset and embedded bridge contract. It checks duplicate DEFs and physical ranges, and rejects DTD/entity declarations and executable/external-resource attributes. It never runs imported scene code. This is a narrow reader for this profile, not a universal X3D sanitizer or standards validator.

Package import verifies agreement between manifest, X3D physical annotations and generated MJCF. It operates in memory, checks member sizes and does not extract filesystem paths. Compressed imports are limited to 2 MB. Import resets physical state to home; saved body poses and sensor values are observations only. Baselines remain in memory until reload; download both trial records to keep them.

## Develop and extend

Node.js 24+:

```sh
npm ci
npm test
npm run build
npm run dev
```

`build` copies the pinned X_ITE runtime/assets/license notices into `public/vendor/x_ite`, type-checks the app and builds `dist/`. The ZIP includes those assets in `dist/`; generated `public/vendor/` need not be stored twice. All simulation still runs in the browser. The Python launcher only serves static files.

| Path | Responsibility |
| --- | --- |
| `src/bridge/contract.ts` | Protocol, physical profile, ownership, bindings, parameter guards |
| `src/bridge/math.ts` | Coordinate basis and kinematics |
| `src/bridge/model.ts` | Curated recipe → MJCF compilation input |
| `src/bridge/scene.ts` | Canonical standard X3D output and bounded annotation reader |
| `src/bridge/session.ts` | Real MuJoCo session, command validation/acknowledgement, observations |
| `src/bridge/xiteAdapter.ts` | Documented X_ITE field setters and pointer/drag callbacks |
| `src/bridge/package.ts` | X3D + MJCF + records experiment ZIP I/O |
| `src/BridgeApp.tsx` | Authoring, selection, diagnostics and experiment UI |
| `docs/BRIDGE-CONTRACT.md` | Detailed semantics and extension seams |
| `docs/bridge-*.schema.json` | JSON Schema contract scaffolding; register the recipe schema by its `$id` |
| `samples/` | Standard X3D, MJCF, manifest and a consistent experiment package |
| `validation/` | Fresh test results and explicit test boundaries |

Add another physical profile by defining its parameter schema, compiler, visual scene, identity mappings and tests. Preserve arbitrary X3D presentation subtrees through a separate tested path. Add multi-scene/PROTO-aware identities before claiming broad ecosystem interoperability. Native RigidBodyPhysics compatibility and HAnim retargeting are separate extension projects.

## Verification and limits

The current suites cover the original real-engine workbench, the new bridge contract, coordinate mathematics, physical compilation, state preservation, idempotent/stale commands, physical sensor feedback, bounded scene/package round-trips and React interactions. The adapter tests use a **substituted external-browser port**. React integration tests use real MuJoCo with a **substituted X_ITE canvas/field port and captured downloads**. Those are not GPU or browser-rendering tests.

The official Web3D X3D 4.0 Unified Object Model is included for node/field vocabulary checks. The included optional `python3 scripts/verify-x3d-schema.py` check uses Python lxml and local copies of the official X3D 4.0 schemas. Grammar validation is separate from runtime simulation and does not establish physics conformance.

**Real browser/WebGL verification remains incomplete in this environment.** The prior cloud browser could not reach local build files. Do not interpret adapter-port tests or the older recovery's browser records as evidence of this release's rendered appearance. Windows/WSL launchers are supplied but have not been executed on Windows. See `validation/README.md` for exact current results and remaining smoke checks.

Original workbench documents and historical verification describe earlier versions. This bridge is a separate deliverable and leaves the original uploaded workbench unchanged.

## References and notices

- X_ITE external browser API: https://create3000.github.io/x_ite/accessing-the-external-browser/
- X_ITE browser services: https://create3000.github.io/x_ite/reference/browser-services/
- X_ITE field callbacks and objects: https://create3000.github.io/x_ite/reference/field-services-and-objects/
- X3D 4.0 specification: https://www.web3d.org/x3d4
- Official UOM source: https://www.web3d.org/specifications/X3dUnifiedObjectModel-4.0.xml
- MuJoCo 3.17 documentation: https://mujoco.readthedocs.io/en/3.17.0/

## License

Licensed under the Apache License, Version 2.0 (`LICENSE`); see `NOTICE`. Source provenance is preserved in `PROVENANCE.json` and `salvage/`. Bundled dependencies keep their own licences: `THIRD_PARTY_NOTICES.txt` (generated by `npm run notices`, checked by `npm test`), and X_ITE with its assets under `dist/vendor/x_ite/`. The licence review is in `LICENSE-REVIEW.md`.
