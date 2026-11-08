# Bridge batch 3

Reader knows **90/260** X3D 4.0 node types after this batch (15 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 515dd6dc7475", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| MetadataBoolean | Core | ok | pass 4/4 | pass 4/4 | PASS |  |
| MetadataFloat | Core | ok | pass 3/3 | pass 3/3 | PASS |  |
| ScalarChaser | Followers | ok | pass 17/17 | pass 17/17 | PASS |  |
| ScalarDamper | Followers | ok | pass 11/11 | pass 11/11 | PASS |  |
| PositionChaser | Followers | ok | pass 7/7 | pass 7/7 | PASS |  |
