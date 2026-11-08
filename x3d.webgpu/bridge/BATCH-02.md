# Bridge batch 2

Reader knows **85/260** X3D 4.0 node types after this batch (10 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha bf14a18e44af", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| NormalInterpolator | Interpolation | ok | pass 10/10 | pass 10/10 | PASS |  |
| SplinePositionInterpolator | Interpolation | ok | pass 30/30 | pass 30/30 | PASS |  |
| SplinePositionInterpolator2D | Interpolation | ok | pass 22/22 | pass 22/22 | PASS |  |
| SplineScalarInterpolator | Interpolation | ok | pass 30/30 | pass 30/30 | PASS |  |
| SquadOrientationInterpolator | Interpolation | ok | pass 16/16 | pass 16/16 | PASS |  |
