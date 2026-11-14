# Bridge batch 35

Reader knows **191/260** X3D 4.0 node types after this batch (119 bridged in this work so far, 72 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha f0bc711b3d9e", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| Layer | Layering | ok | pass 59/59 | pass 59/59 | PASS | viewport of a Layer is a clip rectangle of the layer's camera, compared with X_ITE in the Viewport fixture, not here; a pick sensor sees only the shapes of its own layer (X_ITE gives every layer a pickable group of its own); the world counts as layer 0; a layer's pointer events: the top drawn layer that has a hit wins whatever its depth; compared on the LayerSet fixture |
| Viewport | Layering | ok | pass 65/65 | pass 65/65 | PASS | the layer's viewport (clip rectangle) and a Viewport node in the world are compared with X_ITE 16.6.0 as pictures (silhouette iou 1.0, mean difference 1.3 to 1.6 of 255 on Chromium 153.0.8010.12 SwiftShader / Babylon 9.32.0; bound iou 0.97, mad 4): in a layer the rectangle is the layer's own projection, in the world the projection of the whole canvas is squeezed into the rectangle (both as X_ITE does); a Viewport in the world is drawn by a camera of its own over the world, with the depth cleared between the two; X_ITE keeps one depth buffer, so a world object in front of the Viewport's content is not hidden behind it here (not compared); a pointer outside the rectangle does not reach the layer or the Viewport's children (compared with TouchSensors); XSD finding: x3d-4.0.xsd (x3d_mcp) takes a Viewport as the viewport of a layer, not as a child of Scene or a group; the world-level fixture is checked against the XSD plus one line (xsdAllow, the receipt names it) |
| Layout | Layout | ok | pass 122/122 | pass 122/122 | PASS | three pictures (settings of all six fields) agree with X_ITE 16.6.0: silhouette iou 1.0, mean difference 1.2 of 255 on Chromium 153.0.8010.12 SwiftShader / Babylon 9.32.0; a Layout inside a LayoutGroup that sits in the perspective world uses the near plane of the camera as the viewport size (as X_ITE does), so only the orthographic layer is probed; the offset and size units of PIXEL count CSS pixels of the canvas; no device pixel ratio is read (X_ITE divides by its ContentScale) |
| LayoutLayer | Layout | ok | pass 66/66 | pass 66/66 | PASS | pickable and objectType gate a pick sensor in the layer, pointerEvents gates a TouchSensor in it, addChildren / removeChildren change what it draws (all compared with X_ITE 16.6.0); two pictures of the layer's viewport (left and right half) agree with X_ITE 16.6.0: silhouette iou 1.0, mean difference 1.5 of 255 on Chromium 153.0.8010.12 SwiftShader / Babylon 9.32.0; a LayoutLayer without a Layout shows its children as they are; a Layout is probed in the Layout fixture |
| ScreenGroup | Layout | ok | pass 75/75 | pass 75/75 | PASS | three pictures agree with X_ITE 16.6.0 on place and size (bounding boxes within 1 px; silhouette iou 0.93, mean difference 1.7 of 255 on Chromium 153.0.8010.12 SwiftShader / Babylon 9.32.0); X_ITE's picture has an anti-aliased ring of about one pixel that the body's does not, which is what the iou below 1 measures (bound iou 0.9); the pixel size comes from the depth of the group's origin only, as in X_ITE: the nearer face of a deep child looks a little larger; no snapping to whole pixels (X_ITE does not snap for ScreenGroup either); the device content scale is taken as 1 (X_ITE multiplies by its ContentScale) |

Visual comparison (320 x 240 picture of each engine, same scene and camera; ours = Babylon render target, X_ITE = page screenshot; CPU only, SwiftShader / llvmpipe, no real GPU). iou = overlap of the drawn silhouettes, mad = mean absolute RGB difference over the picture (0 to 255), fg = mean colour of the drawn pixels:

| node | shot | iou | mad | psnr dB | fg ours | fg X_ITE | picture (ours left, X_ITE right) |
|---|---|---|---|---|---|---|---|
| Viewport | lay_bottom | 1 | 1.29 | 35.26 | [0, 0, 255] | [0, 0, 254] | receipts/shots/Viewport.lay_bottom.png |
| Viewport | wv_left | 1 | 1.53 | 42.86 | [0, 255, 0] | [0, 255, 0] | receipts/shots/Viewport.wv_left.png |
| Viewport | wv_right | 1 | 1.53 | 42.86 | [0, 255, 0] | [0, 255, 0] | receipts/shots/Viewport.wv_right.png |
| Viewport | wv_quad | 1 | 1.6 | 42.67 | [0, 255, 0] | [0, 255, 0] | receipts/shots/Viewport.wv_quad.png |
| Layout | v2 | 1 | 1.25 | 43.74 | [0, 0, 255] | [0, 0, 255] | receipts/shots/Layout.v2.png |
| Layout | v3 | 1 | 1.25 | 43.74 | [0, 0, 255] | [0, 0, 255] | receipts/shots/Layout.v3.png |
| Layout | v1 | 1 | 1.18 | 43.99 | [0, 0, 255] | [0, 0, 255] | receipts/shots/Layout.v1.png |
| LayoutLayer | half_left | 1 | 1.53 | 42.87 | [0, 0, 255] | [0, 0, 255] | receipts/shots/LayoutLayer.half_left.png |
| LayoutLayer | half_right | 1 | 1.53 | 42.87 | [0, 0, 255] | [0, 0, 255] | receipts/shots/LayoutLayer.half_right.png |
| ScreenGroup | v1 | 0.93 | 1.69 | 37.12 | [0, 0, 255] | [0, 0, 244] | receipts/shots/ScreenGroup.v1.png |
| ScreenGroup | v2 | 0.93 | 1.69 | 37.12 | [0, 0, 255] | [0, 0, 244] | receipts/shots/ScreenGroup.v2.png |
| ScreenGroup | v3 | 0.93 | 1.67 | 38.21 | [0, 0, 255] | [0, 0, 243] | receipts/shots/ScreenGroup.v3.png |
