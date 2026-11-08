# Bridge batch 8

Reader knows **115/260** X3D 4.0 node types after this batch (40 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha c428dd61b9da", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| TriangleFanSet | Rendering | ok | pass 24/24 | pass 22/22 | PASS | compared by where the pointer is over the shape (a TouchSensor) in both engines, plus triangle count and normals in our body only; colour, texture and lighting are not compared with X_ITE |
| QuadSet | CADGeometry | ok | pass 19/19 | pass 16/16 | PASS | compared by where the pointer is over the shape (a TouchSensor) in both engines, plus triangle count and normals in our body only; colour, texture and lighting are not compared with X_ITE |
| IndexedQuadSet | CADGeometry | ok | pass 27/27 | pass 24/24 | PASS | compared by where the pointer is over the shape (a TouchSensor) in both engines, plus triangle count and normals in our body only; colour, texture and lighting are not compared with X_ITE |
| IndexedTriangleFanSet | Rendering | ok | pass 21/21 | pass 19/19 | PASS | compared by where the pointer is over the shape (a TouchSensor) in both engines, plus triangle count and normals in our body only; colour, texture and lighting are not compared with X_ITE |
| IndexedTriangleStripSet | Rendering | ok | pass 18/18 | pass 16/16 | PASS | compared by where the pointer is over the shape (a TouchSensor) in both engines, plus triangle count and normals in our body only; colour, texture and lighting are not compared with X_ITE |
