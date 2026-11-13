# Bridge batch 18

Reader knows **165/260** X3D 4.0 node types after this batch (90 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 8a58c9552467", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| Viewport | Layering | ok | pass 23/23 | pass 23/23 | PASS | a Viewport used as a grouping node of the world builds its children but does not clip them (Babylon has one viewport per camera; the world's camera is shared); the layer's picture is squeezed into the clip rectangle, not cut out of the full picture: the same as X_ITE's viewport, which also changes the aspect |
| Layout | Layout | ok | pass 119/119 | pass 119/119 | PASS | a Layout inside a LayoutGroup that sits in the perspective world uses the near plane of the camera as the viewport size (like X_ITE); only the orthographic layer is probed here; the offset and size units of PIXEL count CSS pixels of the canvas; no device pixel ratio is read |
| LayoutGroup | Layout | ok | pass 65/65 | pass 65/65 | PASS | viewport of a LayoutGroup is held: the world camera is shared with the rest of the scene; a LayoutGroup in the perspective world uses the near plane of the camera as the viewport size, so its layout is microscopic there, as in X_ITE; only the orthographic layer is probed; XSD finding: x3d-4.0.xsd (x3d_mcp) lists LayoutGroup only in the pick-target content model, in no child content model, so NO scene can hold a LayoutGroup and still validate; the fixture is checked against the XSD plus one line (receipt names it) |
| LayoutLayer | Layout | ok | pass 31/31 | pass 31/31 | PASS | pickable, objectType and pointerEvents are held: picking does not respect layers; a LayoutLayer without a Layout shows its children as they are, a Layout is probed in the Layout fixture |
| ScreenFontStyle | Layout | ok | pass 27/27 | pass 27/27 | PASS | the node is not drawn: the Text font path of the body reads FontStyle only, and a screen font size in pixels (pointSize) is not applied; a ScreenFontStyle changes the text size with the content scale of the screen in X_ITE; none of this is reproduced |
