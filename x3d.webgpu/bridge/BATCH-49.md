# Bridge batch 49

Reader knows **260/260** X3D 4.0 node types after this batch (192 bridged in this work so far, 68 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 690d46955217", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| NurbsTextureCoordinate | NURBS | ok | pass 23/23 | pass 23/23 | PASS | X_ITE 16.6.0 samples the texture surface with haveWeights false, so the weight field of a NurbsTextureCoordinate does nothing (the texture coordinates are the plain B-spline of the control points); the standard calls it rational; the bridge does what X_ITE does and the fixture asserts X_ITE's numbers; the tessellation of the texture surface is the surface's own (one grid): a texture surface is sampled at the same fractions of its own domain as the patch |
| NurbsSweptSurface | NURBS | ok | pass 16/16 | pass 16/16 | PASS | the frame at an interior spine point: this node (like the swung surface and the Library hall Extrusion) takes the Y axis along the chord spine[i+1] - spine[i-1]; X_ITE 16.6.0 takes the bisector of the two unit vectors; they agree for an evenly spaced spine and differ slightly (compared at 0.02) for a bent one; solid FALSE seen from behind: X_ITE 16.6.0 lights the back face, the Babylon body draws it black (the same gap as the patch and the swung surface); the two sided surface here is seen from the front; no scale, orientation or caps (an Extrusion's, not this node's); texture coordinates run 0..1 along the cross-section (s) and the trajectory (t) |
| NurbsTrimmedSurface | NURBS | ok | pass 26/26 | pass 26/26 | PASS | the trimmed surface is compared by the area and the bounding box of the triangles that are kept (the two engines cut the grid into different triangles at the contour, so triangle corners are not compared); the picture is compared by silhouette and mean colour; a contour that crosses itself, or two contours that cross each other, is cut by parity in both engines but the bridge was only tested with contours that do not cross; the new corners take position, normal and texture coordinate from the grid triangle they fall in, as X_ITE does, so the cut edge is a polyline of the contour lying on the grid's flat triangles |

Visual comparison (320 x 240 picture of each engine, same scene and camera; ours = Babylon render target, X_ITE = page screenshot; CPU only, SwiftShader / llvmpipe, no real GPU). iou = overlap of the drawn silhouettes, mad = mean absolute RGB difference over the picture (0 to 255), fg = mean colour of the drawn pixels:

| node | shot | iou | mad | psnr dB | fg ours | fg X_ITE | picture (ours left, X_ITE right) |
|---|---|---|---|---|---|---|---|
| NurbsTextureCoordinate | main | 0.99 | 1.76 | 37.59 | [134, 121, 76] | [133, 120, 75] | receipts/shots/NurbsTextureCoordinate.main.png |
| NurbsSweptSurface | main | 0.96 | 1.97 | 36.48 | [137, 110, 76] | [135, 108, 75] | receipts/shots/NurbsSweptSurface.main.png |
| NurbsTrimmedSurface | main | 0.96 | 1.75 | 37.41 | [118, 135, 96] | [114, 131, 93] | receipts/shots/NurbsTrimmedSurface.main.png |
