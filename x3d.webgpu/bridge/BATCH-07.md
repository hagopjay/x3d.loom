# Bridge batch 7

Reader knows **110/260** X3D 4.0 node types after this batch (35 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 8e11fd9a11ec", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| TransformSensor | EnvironmentalSensor | ok | pass 23/23 | pass 23/23 | PASS | the sensor frame is its parent's; a parent that itself moves is followed through the world matrix, tested only with the root; a target that is a Shape uses its group's matrix; the official x3d-4.0.xsd cannot express TransformSensor.targetObject (containerField is limited to children, proxy, rootNode, shape, skin), so the fixture leaves it out and the test sets it through the SAI |
| KeySensor | KeyDeviceSensor | ok | pass 30/30 | pass 30/30 | PASS | Alt/Control flags follow the Shift path but were only tested with Shift; key repeat while a key is held fires keyPress again, as in the browser |
| StringSensor | KeyDeviceSensor | ok | pass 27/27 | pass 27/27 | PASS | IME and dead-key composition are not handled (the browser reports one key at a time) |
| LoadSensor | Networking | ok | pass 18/18 | pass 16/16 | PASS | a change of children after load does not restart the count (X_ITE restarts); Inline, audio and movie children are fetched, not decoded: loaded means the url answered; only the first working url of a child is used; X_ITE 16.6.0 hands the world over only after every resource has loaded, so the in-flight timeOut state (aborted, not yet loaded) can only be checked in our reader; the end state is compared |
| Anchor | Networking | ok | pass 18/18 | pass 18/18 | PASS | only #Viewpoint urls are followed in the test; other urls go to body.opts.onAnchor, a page without one gets a note and stays; javascript: urls are refused on purpose; addChildren and removeChildren are accepted and not acted on; autoRefresh is not implemented; target= in parameter is passed to onAnchor, not acted on; the stock body does not report isBound for the first Viewpoint at load (X_ITE does), so the test binds V1 first |
