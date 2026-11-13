# Bridge batch 1

Reader knows **80/260** X3D 4.0 node types after this batch (5 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 6999f2dce4b4", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| BooleanToggle | EventUtilities | ok | pass 9/9 | pass 9/9 | PASS |  |
| BooleanTrigger | EventUtilities | ok | pass 4/4 | pass 4/4 | PASS |  |
| IntegerTrigger | EventUtilities | ok | pass 7/7 | pass 7/7 | PASS |  |
| TimeTrigger | EventUtilities | ok | pass 4/4 | pass 4/4 | PASS |  |
| PositionInterpolator2D | Interpolation | ok | pass 12/12 | pass 12/12 | PASS |  |
