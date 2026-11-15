# Bridge batch 48

Reader knows **257/260** X3D 4.0 node types after this batch (189 bridged in this work so far, 68 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 02fd14a586b5", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| Collision | Navigation | ok | pass 29/29 | pass 29/29 | PASS | the group does nothing about collision: navigation never collides in the bridge, so isActive and collideTime never fire (X_ITE 16.6.0 fires them only when the navigation collides with the group); the proxy is held and not drawn |
| CoordinateInterpolator | Interpolation | ok | pass 20/20 | pass 20/20 | PASS |  |
| CoordinateInterpolator2D | Interpolation | ok | pass 20/20 | pass 20/20 | PASS |  |
| PointProperties | Shape | ok | pass 22/22 | pass 22/22 | PASS | WebGPU has no point size: a PointSet with PointProperties is drawn as camera-facing squares whose size is clamp(pointSizeScaleFactor / (a + b d + c d^2), min, max) pixels (d = distance from the eye); X_ITE draws its points through its own point shader and much dimmer on this CPU raster, so size is not compared in the picture |
| Extrusion | Geometry3D | ok | pass 45/45 | pass 45/45 | PASS | compared in the picture by silhouette and mean colour (SwiftShader CPU raster); creaseAngle smoothing, texture coordinates of the caps and degenerate frames (a spine that doubles back, collinear spine points) are not compared with X_ITE |
| Rectangle2D | Geometry2D | ok | pass 31/31 | pass 31/31 | PASS | the texture coordinates are the unit square; they are not compared with X_ITE |
| Disk2D | Geometry2D | ok | pass 39/39 | pass 39/39 | PASS | the circle is a 96 segment polygon (X_ITE 16.6.0 uses its own polygon): silhouettes agree to about a pixel in the picture, not vertex for vertex; the texture coordinates are planar (the disk mapped on the unit square); they are not compared with X_ITE |
| MultiTextureCoordinate | Texturing | ok | pass 13/13 | pass 12/12 | PASS | the picture is made once, in the first channel's coordinates; channel i is carried as the affine map that takes channel 0 to channel i (least squares over the vertices): exact for a quad or any planar mapping, the nearest affine map otherwise (noted on the page); the X3D 4.0 use of a MultiTextureCoordinate, where a material names a channel by its `mapping`, is the Library hall port's (hall/body-hl.js) and is not part of the bridge body |

Visual comparison (320 x 240 picture of each engine, same scene and camera; ours = Babylon render target, X_ITE = page screenshot; CPU only, SwiftShader / llvmpipe, no real GPU). iou = overlap of the drawn silhouettes, mad = mean absolute RGB difference over the picture (0 to 255), fg = mean colour of the drawn pixels:

| node | shot | iou | mad | psnr dB | fg ours | fg X_ITE | picture (ours left, X_ITE right) |
|---|---|---|---|---|---|---|---|
| Collision | main | 0.97 | 1.7 | 38.41 | [127, 114, 102] | [125, 112, 100] | receipts/shots/Collision.main.png |
| Extrusion | main | 0.93 | 3.48 | 25.64 | [127, 139, 114] | [124, 138, 110] | receipts/shots/Extrusion.main.png |
| Rectangle2D | main | 0.97 | 1.84 | 33.09 | [255, 255, 249] | [248, 248, 242] | receipts/shots/Rectangle2D.main.png |
| Disk2D | main | 0.98 | 2.08 | 29.48 | [255, 255, 255] | [249, 249, 249] | receipts/shots/Disk2D.main.png |
| MultiTextureCoordinate | main | 1 | 1.5 | 38.77 | [126, 126, 0] | [128, 128, 0] | receipts/shots/MultiTextureCoordinate.main.png |
