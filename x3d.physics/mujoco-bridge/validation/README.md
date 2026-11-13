# Proto-Bridge 0.1 verification

The node suites use Node 24+. Run `npm ci`, `npm test`, then `npm run build`.

| Record | Checks | Scope |
| --- | --- | --- |
| runtime-results.json | 34 | Original real-MuJoCo engine and challenge regressions |
| workbench-results.json | 14 | Real controllers, measured trials, state preservation and exports |
| ui-dom-results.json | 9 | Original workbench React DOM integration; canvas/download substitutions |
| bridge-results.json | 19 | New bridge protocol, coordinates, physical compilation, scene/package round-trip and X_ITE field-port adapter |
| bridge-ui-results.json | 8 | New React authoring interactions with real MuJoCo and a substituted X_ITE port |
| x3d-schema-results.json | 2 | Standalone and packaged scenes validated against official X3D 4.0 XML Schema |
| build-results.json | separate | Strict TypeScript + production build, loopback serving and vendor asset checks |

**84 Node checks and 2 XML Schema checks** pass. The separate schema command is `python3 scripts/verify-x3d-schema.py`, requiring Python lxml. Local copies of the official schemas and UOM make these checks independent of network access after installation. The schema checker validates the generated sample and its package, not arbitrary user scenes or native RigidBodyPhysics semantics.

The bridge tests execute actual MuJoCo WASM. X_ITE adapter calls are tested against a small substituted browser/field port; this verifies contract wiring, callbacks and field names without establishing actual rendering. The React bridge suite also substitutes the X_ITE canvas port and captures download activation. It exercises React StrictMode startup, target commands, authored physical edits, source annotation import, rejection recovery, trials, baseline exports and drag-to-recompile behavior.

The official UOM check verifies emitted node and field vocabulary. The official XML Schema check additionally verifies grammar/composition. Neither establishes renderer behavior or real-world physical validity. A successful compile plus a five-second trajectory does not validate all masses, inertia assumptions or arbitrary edited configurations.

## Real browser / WebGL status

Not verified in this environment. The previous cloud-browser attempt could not reach workspace files. No new browser-rendering pass is claimed. Records under `historical/` describe earlier workbench releases and do not establish this bridge's behavior.

## Desktop checks still required

1. Launch via the included HTTP server and verify the actual X_ITE workshop view.
2. Orbit, zoom and switch workshop/plan viewpoints; inspect both links by clicking.
3. Run physics, drag the cyan goal, observe actual arm movement and contact coloring.
4. Drag the orange obstacle, release to compile, verify reset/pause and changed contact.
5. Export .x3d and an experiment ZIP; reimport the supported annotations.
6. Check targets produced by dragging, invalid targets, field callbacks and model rebinds in the browser console.
7. Measure two variants, pin a baseline and inspect both JSON records.
8. Test narrow layout, keyboard access and Windows/WSL startup on actual target systems.

Use of the original workbench remains available under `?workspace=1`. Its controller and lesson caveats remain applicable.
