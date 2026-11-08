# Bridge batch 5

Reader knows **100/260** X3D 4.0 node types after this batch (25 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 9cede4e8c072", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| PositionChaser2D | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state only (virtual time here, real time in X_ITE); curves not compared numerically |
| PositionDamper2D | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state only (virtual time here, real time in X_ITE); curves not compared numerically |
| CoordinateChaser | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state only; a list that changes length mid-chase restarts at the new length with the new tail at 0 (not compared with X_ITE) |
| CoordinateDamper | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state only; a list that changes length mid-chase restarts at the new length with the new tail at 0 (not compared with X_ITE) |
| TexCoordChaser2D | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state only (virtual time here, real time in X_ITE); curves not compared numerically |
