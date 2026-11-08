# X3D 4.0 to Babylon bridge: tracker, driver, kit

Goal (owner's ask, 8 Nov 2026): walk every X3D 4.0 node type, in value order, and bring each one into the Babylon bodies' reader with a fixture and a test, with a status after every 5 nodes. Standing rule: not pixel perfect, good valid Babylon engineering, gaps logged (a `gap` status and a line in the node's receipt).

| file | what |
|---|---|
| `NODES.json`, `NODES.md` | the 260 concrete nodes of X3DUOM 4.0 with component, level, rank, status, batch; `NODES.md` is generated |
| `BATCH-NN.md` | the status text of each closed batch (totals, rig, per-node verdict) |
| `tools/driver.py` | `init`, `status`, `next`, `scaffold`, `check`, `batch --close` (see its docstring) |
| `tools/run-tests.js` | runs `fixtures/NODE.test.json` against `fixtures/NODE.x3d` in our reader+SAI (headless) and in X_ITE, through the SAI both speak |
| `tools/smoke.js` | loads a fixture into the real Babylon WebGPU body (SwiftShader) for a few seconds; the batch regression gate |
| `tools/census.js` | which node types the reader parts define (the baseline) |
| `src/kit.js` | `BR.node(name, spec)`: field table, `receive`, `tick`, `init`, `build`, `geometry`, `changed`; wraps `parseX3D`, `receive`, `events.drain` once |
| `src/body-br.js` | the Babylon side of the kit: bridge nodes without a `build` stay silent, others build through their spec |
| `src/nodes/NODE.js` | one file per node; the field table is generated from the UOM (`driver.py scaffold`), the behaviour is hand written |
| `receipts/NODE.json` | the last check of each node: XSD verdict, both engines' results, versions |

## The loop
`driver.py next` -> `driver.py scaffold NODE...` -> write behaviour, fixture and test spec -> `driver.py batch -n 5 --close`. The batch checks the next five nodes that have a module, runs the regression gate (a ROUTE chain through every bridged event node, in both engines and inside the Babylon body), marks the passing ones `bridged` and writes `BATCH-NN.md`. A node fails the batch if its fixture does not validate (`xmllint` against `x3d-4.0.xsd` from x3d_mcp), if our reader disagrees with the spec, or if the gate fails. X_ITE is the oracle: a spec that X_ITE fails is re-read against the standard before it is trusted; a documented disagreement goes in `xiteDisagrees`.

## Putting the kit in a page
Concatenate after the reader and its extensions and before the body: `kit.js`, then `src/nodes/*.js` (or just the ones the page needs), then (after `body-cam.js`) `body-br.js`. Nothing in the older reader files changes; a type the kit does not own takes the stock path. The page builders (`demo/src/build-*.py`) do not include the kit yet; a port adds those parts to its `PARTS` when it wants the nodes.

## Rig and limits (batch 1)
Chromium 153.0.8010.12 (Chrome for Testing), SwiftShader, headless; X_ITE 16.6.0; Babylon 9.32.0. Correctness only: no real-GPU timing exists and none is claimed. Event nodes are Babylon-independent, so their tests do not draw; the smoke run proves they load in the full bundle, not that anything is drawn.

## Coordination
The Library hall port owns Collision, CoordinateInterpolator, CoordinateInterpolator2D, Disk2D, Extrusion, MultiTextureCoordinate, PointProperties, Rectangle2D (`hall/reader-ext-hl.js`, branch claude/project-thread-dim2xp); they are `claimed` in the tracker. `run-tests.js` and `smoke.js` include `hall/reader-ext-hl.js` once it exists.

## Findings so far
- `manifold/manifold-reader-ext.js` and `brain/sai.js` both wrap `events.emit` to run `addFieldCallback` listeners; a bundle with both fires every output callback twice (seen in the first test run, 5 of 5 nodes). No current build combines them. Not fixed here (older file).
- ROUTE `fromField` for an `outputOnly` field must be the plain name (`triggerValue`), the `_changed` alias exists only for `inputOutput` fields; both engines drop the route otherwise (a fixture mistake caught by the chain test).
