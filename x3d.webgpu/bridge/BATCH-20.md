# Bridge batch 20

Reader knows **175/260** X3D 4.0 node types after this batch (100 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha d4e15ecfee7a", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| ShaderProgram | Shaders | ok | pass 19/19 | pass 19/19 | PASS | no shader language runs: the program is a holder; the 4.0 UOM lists a sourceCode field that X_ITE 16.6.0 does not have and the XSD cannot write; it is not offered |
| ImageCubeMapTexture | CubeMapTexturing | ok | pass 16/16 | pass 16/16 | PASS | the Material is added to the reflection, not multiplied with it; the reflection is of the world (it does not turn with the camera as CAMERASPACEREFLECTIONVECTOR does in X_ITE); flat face colours cannot show if the face images are turned like X_ITE's; a 2:1 panorama is converted but its orientation is not compared; KTX2 and DDS are not read |
| GeneratedCubeMapTexture | CubeMapTexturing | ok | pass 22/22 | pass 22/22 | PASS | the faces of the cube are not turned like X_ITE's (flat colours cannot show it); the picture is taken from the origin of the ball in world space, not in the camera space of X_ITE's cube; the probe renders meshes as they are: it does not draw the Background spheres of other layers |
| ComposedTexture3D | Texturing3D | ok | pass 9/9 | pass 9/9 | PASS | the volume is not sampled in 3D, only the first slice is drawn (see PixelTexture3D); XSD finding: x3d-4.0.xsd writes the texture field of a ComposedTexture3D as an xs:sequence of ImageTexture, PixelTexture, MovieTexture, ProtoInstance repeated, not an xs:choice, so the slices must come in fours in that order and two ImageTextures do not validate; the fixture is checked against the XSD with that sequence made a choice (the receipt says so); the image field of a PixelTexture3D takes decimal numbers only in the XSD (no 0x hex) |
| PixelTexture3D | Texturing3D | ok | pass 16/16 | pass 16/16 | PASS | the volume is not sampled in 3D: the Texturing3D coordinate nodes (TextureCoordinate3D, TextureCoordinate4D, TextureTransform3D, TextureTransformMatrix3D) come in later batches and only the first slice is drawn; repeatR, repeatS and repeatT are read for S and T only |
