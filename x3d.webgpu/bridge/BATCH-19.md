# Bridge batch 19

Reader knows **170/260** X3D 4.0 node types after this batch (95 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha b207d6a3cd63", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| ScreenGroup | Layout | ok | pass 72/72 | pass 72/72 | PASS | the pixel size comes from the depth of the group's origin only, as in X_ITE: the nearer face of a deep child looks a little larger; no snapping to whole pixels (X_ITE does not snap for ScreenGroup either); the device content scale is 1 |
| Matrix3VertexAttribute | Shaders | ok | pass 6/6 | pass 6/6 | PASS | the matrices are attributes for a shader program; the bridge has none (WGSL ports only), so nothing is drawn from them |
| Matrix4VertexAttribute | Shaders | ok | pass 6/6 | pass 6/6 | PASS | the matrices are attributes for a shader program; the bridge has none (WGSL ports only), so nothing is drawn from them |
| PackagedShader | Shaders | ok | pass 25/25 | pass 25/25 | PASS | no shader language runs: the node is only a holder (the WebGPU body runs WGSL ports of known GLSL parts); author-defined <field> declarations are not read for this node (the stock reader reads them for ComposedShader only) |
| ProgramShader | Shaders | ok | pass 11/11 | pass 11/11 | PASS | no shader language runs: the node is only a holder; ShaderProgram parts of programs are checked with the ShaderProgram node |
