# Bridge batch 4

Reader knows **95/260** X3D 4.0 node types after this batch (20 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 0dfe446168ec", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| PositionDamper | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state and bounds only (virtual time here, real time in X_ITE); curves not compared numerically |
| OrientationChaser | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state and bounds only (virtual time here, real time in X_ITE); curves not compared numerically |
| OrientationDamper | Followers | ok | pass 7/7 | pass 7/7 | PASS | end state and bounds only (virtual time here, real time in X_ITE); curves not compared numerically |
| ColorChaser | Followers | ok | pass 7/7 | pass 7/7 | PASS | hue path between start and destination not pinned against X_ITE (end state only) |
| ColorDamper | Followers | ok | pass 7/7 | FAIL step 6: N.isActive fired 0 times ([]), expected 1 | PASS | X_ITE 16.6.0 keeps isActive true after a hue-seam path (observed 7.3 s); ours stops. Intermediate colours not pinned |
