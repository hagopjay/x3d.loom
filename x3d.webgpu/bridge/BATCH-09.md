# Bridge batch 9

Reader knows **120/260** X3D 4.0 node types after this batch (45 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 6db173a7cba8", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| LineSet | Rendering | ok | pass 3/3 | pass 2/2 | PASS | lines are not pickable, so there is no hit probe: the segment count is compared between the engines (X_ITE vertex pairs via its internal getVertices, which is a private API), and our body is checked to have built one line mesh; colour and line width are not compared; normal, fogCoord and attrib are read and ignored |
| TriangleSet2D | Geometry2D | ok | pass 18/18 | pass 17/17 | PASS | compared by pointer-over probes in both engines and the triangle count; the clockwise second triangle is turned to face +z in ours, X_ITE draws it two-sided |
| Arc2D | Geometry2D | ok | pass 4/4 | pass 4/4 | PASS | lines are not pickable, so there is no hit probe: the segment count is compared between the engines (X_ITE vertex pairs via its internal getVertices, which is a private API), and our body is checked to have built one line mesh; colour and line width are not compared |
| ArcClose2D | Geometry2D | ok | pass 15/15 | pass 15/15 | PASS | compared by pointer-over probes in both engines and the triangle count; texture mapping and lighting are not compared |
| Circle2D | Geometry2D | ok | pass 4/4 | pass 3/3 | PASS | lines are not pickable, so there is no hit probe: the segment count is compared between the engines (X_ITE vertex pairs via its internal getVertices, which is a private API), and our body is checked to have built one line mesh; colour and line width are not compared |
