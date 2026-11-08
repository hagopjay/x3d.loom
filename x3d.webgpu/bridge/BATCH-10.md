# Bridge batch 10

Reader knows **125/260** X3D 4.0 node types after this batch (50 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha ffe12499d3dc", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| Polyline2D | Geometry2D | ok | pass 2/2 | pass 2/2 | PASS | lines are not pickable: the segment count is compared between the engines (X_ITE vertex pairs via its private getVertices); colour and width are not compared |
| Polypoint2D | Geometry2D | ok | pass 2/2 | pass 2/2 | PASS | points cannot be picked: the point count is compared between the engines; WebGPU draws each point one pixel, X_ITE draws them with its point size; colour is not compared |
| StaticGroup | Grouping | ok | pass 11/11 | pass 10/10 | PASS | compared by pointer-over probes on the box and sphere inside it (the sensor sits outside, as the node forbids sensors inside); X_ITE's merging of static children is not observable |
| TextureCoordinateGenerator | Texturing | ok | pass 14/14 | pass 12/12 | PASS | X_ITE is compared on loading and drawing the shapes; the generated texture coordinates are not observable there, so they are checked against the formula in our body only; the camera is taken as the identity: SPHERE and the CAMERASPACE modes use the object-space normal or position; NOISE and reflection modes are not made |
| MultiTexture | Texturing | ok | pass 10/10 | pass 8/8 | PASS | X_ITE is compared on loading and drawing the shapes; the combined colour is checked in our body only (red x green = black for MODULATE, red + green = yellow for ADD); function, source, color and alpha are read and not used; modes other than REPLACE, MODULATE, MODULATE2X, MODULATE4X and ADD are drawn as MODULATE; the combine is made once on a 256 x 256 canvas: it does not follow the lighting or the vertex colour |
