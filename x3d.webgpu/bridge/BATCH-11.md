# Bridge batch 11

Reader knows **130/260** X3D 4.0 node types after this batch (55 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 9eb5457e1d2d", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| MultiTextureTransform | Texturing | ok | pass 11/11 | pass 7/7 | PASS | X_ITE is compared on loading and drawing the shapes; the shifted colours are checked in our body only (red|blue image shifted by half a tile swaps the halves); only MultiTexture stages are moved; a plain TextureTransform on a single texture is not applied by the stock body (TextureTransform stays 'base'); edits to the transform after the build are not followed |
| FillProperties | Shape | ok | pass 12/12 | pass 10/10 | PASS | a shape with filled=false and hatched=false is not drawn but still answers the pointer, as in X_ITE 16.6.0 (the 4.0 text does not say); compared by pointer-over probes (hidden fill is not hit, hatched and plain fills are) and, in our body only, the hatch overlay mesh; line pattern, thickness and screen-space scaling are not compared with X_ITE; hatchStyle 7 to 19 are drawn as style 6; the pattern follows the geometry's texture coordinates, a geometry without them shows no hatch |
| TwoSidedMaterial | Shape | ok | pass 9/9 | pass 7/7 | PASS | X_ITE is compared on loading and picking the shapes; which side shows which colour is checked in our body only (two passes, culled front and back); specular, shininess and ambient are read and not shown |
| MovieTexture | Texturing | ok | pass 18/18 | pass 18/18 | PASS | timing is compared through the fields only; the picture on the box is not compared with X_ITE; the clip is played muted (a page may not start sound by itself); gain and pitch are read and not used; a loop and a natural end are not exercised by the test |
| Script | Scripting | ok | pass 14/14 | pass 14/14 | PASS | scripts are OFF unless the page sets R.bridge.allowScripts = true (they run code that comes with the scene); the test pages set it; shutdown(), node-valued fields, directOutput, external script files and the less common methods of the classic vector classes are not provided |
