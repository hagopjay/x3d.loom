# Bridge batch 36

Reader knows **193/260** X3D 4.0 node types after this batch (125 bridged in this work so far, 68 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha fd1d5dc2ef78", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| HAnimDisplacer | HAnim | ok | pass 37/37 | pass 37/37 | PASS | a vertex weighted over several joints is displaced before skinning (Babylon MorphTarget, the glTF order); X_ITE 16.6.0 adds joint rotation * (displacement * weight) after skinning with the rotation of the displacer's joint alone: identical (<= 1e-7 on the rig) for a vertex that follows the displacer's joint alone and at the rest pose, 0.053 (weight 0.5) to 0.106 (weight 1) world units apart on the half J0 / half J1 ring of this fixture for a 0.3 unit displacement in the 45 degree pose; a displacer on a segment moves the segment's own vertices in the segment's frame; X_ITE 16.6.0 rotates the displacement by the segment's matrix in the humanoid's frame and the shape's own transform rotates it again, so a bent segment collapses to a sliver there (see the bent shot); the bridge draws the intended rectangle |
| HAnimHumanoid | HAnim | ok | pass 17/17 | pass 17/17 | PASS | skinNormal, skinBindingCoords and skinBindingNormals are stored; neither engine uses them (X_ITE 16.6.0 reads skinCoord only): the skin normals follow the bone matrices in the shader (X_ITE blends the inverse transpose per joint, the same for rotations, different under non-uniform joint scale); only IndexedFaceSet and IndexedTriangleSet skin shapes are skinned (a vertex's coordinate index is known); a vertex with more than 8 joint influences keeps the 8 largest, X_ITE has no limit; the viewpoints, joints, segments and sites lists are references (not drawn twice) |
| HAnimJoint | HAnim | ok | pass 36/36 | pass 36/36 | PASS | llimit, ulimit, limitOrientation and stiffness are stored and routed but limit nothing: neither engine solves joint limits (X_ITE 16.6.0 does not either) |
| HAnimSegment | HAnim | ok | pass 21/21 | pass 21/21 | PASS | mass, centerOfMass and momentsOfInertia are stored and routed, no engine uses them (physics belongs to the RigidBodyPhysics group) |
| HAnimSite | HAnim | ok | pass 16/16 | pass 16/16 | PASS | a Viewpoint inside a site of the humanoid's viewpoints list is not bound from the site in the bridge (the site is a Transform; HAnim viewpoints are not navigation viewpoints) |
| HAnimMotion | HAnim | ok | pass 104/104 | pass 104/104 | PASS |  |

Visual comparison (320 x 240 picture of each engine, same scene and camera; ours = Babylon render target, X_ITE = page screenshot; CPU only, SwiftShader / llvmpipe, no real GPU). iou = overlap of the drawn silhouettes, mad = mean absolute RGB difference over the picture (0 to 255), fg = mean colour of the drawn pixels:

| node | shot | iou | mad | psnr dB | fg ours | fg X_ITE | picture (ours left, X_ITE right) |
|---|---|---|---|---|---|---|---|
| HAnimDisplacer | rest | 0.97 | 1.71 | 37.71 | [94, 184, 97] | [91, 178, 94] | receipts/shots/HAnimDisplacer.rest.png |
| HAnimDisplacer | bent | 0.84 | 2.71 | 25.51 | [95, 183, 97] | [80, 189, 98] | receipts/shots/HAnimDisplacer.bent.png |
| HAnimDisplacer | weights | 0.8 | 3.12 | 24.23 | [95, 184, 96] | [80, 190, 97] | receipts/shots/HAnimDisplacer.weights.png |
| HAnimDisplacer | lists | 0.74 | 3.76 | 22.78 | [95, 184, 96] | [80, 190, 97] | receipts/shots/HAnimDisplacer.lists.png |
| HAnimHumanoid | rest | 0.93 | 1.7 | 39.04 | [76, 203, 103] | [72, 192, 98] | receipts/shots/HAnimHumanoid.rest.png |
| HAnimHumanoid | bent | 0.97 | 1.71 | 37.79 | [76, 203, 103] | [74, 197, 100] | receipts/shots/HAnimHumanoid.bent.png |
| HAnimHumanoid | moved | 0.97 | 2.59 | 32.61 | [60, 159, 80] | [65, 174, 88] | receipts/shots/HAnimHumanoid.moved.png |
| HAnimJoint | end | 0.96 | 1.76 | 36.88 | [69, 179, 92] | [67, 174, 89] | receipts/shots/HAnimJoint.end.png |
| HAnimJoint | f1 | 0.96 | 1.8 | 34.71 | [76, 202, 103] | [73, 195, 100] | receipts/shots/HAnimJoint.f1.png |
| HAnimJoint | cs | 0.93 | 1.94 | 31.26 | [76, 201, 104] | [73, 196, 100] | receipts/shots/HAnimJoint.cs.png |
| HAnimJoint | w | 0.91 | 2.05 | 30.23 | [78, 196, 102] | [73, 194, 99] | receipts/shots/HAnimJoint.w.png |
| HAnimJoint | idx | 0.9 | 2.11 | 29.82 | [80, 193, 101] | [74, 191, 98] | receipts/shots/HAnimJoint.idx.png |
| HAnimJoint | hidden | 0.94 | 1.86 | 33.38 | [76, 204, 102] | [73, 195, 98] | receipts/shots/HAnimJoint.hidden.png |
| HAnimSegment | rest | 0.93 | 1.71 | 38.41 | [93, 196, 95] | [88, 185, 90] | receipts/shots/HAnimSegment.rest.png |
| HAnimSegment | bent | 0.97 | 1.73 | 37.19 | [94, 195, 94] | [91, 189, 92] | receipts/shots/HAnimSegment.bent.png |
| HAnimSegment | hidden | 0.97 | 1.73 | 37.36 | [86, 204, 97] | [83, 198, 95] | receipts/shots/HAnimSegment.hidden.png |
| HAnimSegment | added | 0.97 | 1.73 | 37.19 | [94, 195, 94] | [91, 189, 92] | receipts/shots/HAnimSegment.added.png |
| HAnimSegment | removed | 0.97 | 1.73 | 37.19 | [94, 195, 94] | [91, 189, 92] | receipts/shots/HAnimSegment.removed.png |
| HAnimSite | rest | 0.92 | 1.73 | 37.59 | [80, 204, 100] | [76, 193, 94] | receipts/shots/HAnimSite.rest.png |
| HAnimSite | bent | 0.97 | 1.74 | 36.67 | [80, 204, 100] | [78, 198, 97] | receipts/shots/HAnimSite.bent.png |
| HAnimSite | moved | 0.94 | 1.84 | 33.41 | [82, 202, 101] | [79, 192, 99] | receipts/shots/HAnimSite.moved.png |
| HAnimSite | hidden | 0.95 | 1.81 | 33.95 | [76, 201, 104] | [73, 192, 103] | receipts/shots/HAnimSite.hidden.png |
