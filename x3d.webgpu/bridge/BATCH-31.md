# Bridge batch 31

Reader knows **186/260** X3D 4.0 node types after this batch (114 bridged in this work so far, 72 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 96dc51493fc5", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| MultiTexture | Texturing | ok | pass 11/11 | pass 9/9 | PASS | compared with X_ITE 16.6.0 in the picture (silhouette 0.97, mean abs diff 1.6 of 255 on SwiftShader) for MODULATE (red x green = black) and ADD (red + green = yellow); function, source, color and alpha are read and not used; modes other than REPLACE, MODULATE, MODULATE2X, MODULATE4X and ADD are drawn as MODULATE; the combine is made once on a 256 x 256 canvas: it does not follow the lighting or the vertex colour; a small image is magnified with hard texels like X_ITE |
| MultiTextureTransform | Texturing | ok | pass 12/12 | pass 8/8 | PASS | compared with X_ITE 16.6.0 in the picture (silhouette 0.97, mean abs diff 3.2 of 255 on SwiftShader): the shifted box swaps the halves in both; only MultiTexture stages are moved; a plain TextureTransform on a single texture is applied by the Material path (bridged), not by the unlit one; edits to the transform after the build are not followed |
| DirectionalLight | Lighting | ok | pass 13/13 | pass 9/9 | PASS | ambientIntensity is not used (no ambient term in the Babylon light); shadows are not made; global FALSE lights the meshes below the parent group; meshes added later are picked up when the mesh count changes (checked in our body, X_ITE draws the same picture) |
| PointLight | Lighting | ok | pass 21/21 | pass 14/14 | PASS | attenuation is a Babylon range cut at 1/32 of the polynomial (a0 1 0 0 means no fall-off), not X_ITE's per pixel polynomial; global=FALSE scope uses includedOnlyMeshes of the parent group; compared in our body only; ambientIntensity is not used; radius is a hard edge in X3D: Babylon has only a smooth range, so the range stays open and a mesh wholly beyond the radius is left out of the light (per mesh); a mesh that straddles the edge, like a big wall, is lit whole where X_ITE cuts a disc; checked by the colour of the spheres beyond it in both engines |
| SpotLight | Lighting | ok | pass 17/17 | pass 13/13 | PASS | the cone is a projection texture over tan(angle) (a Babylon SpotLight with its own exponent 0), full inside beamWidth and a linear ramp in the angle down to cutOffAngle as 19775-1 gives it; X_ITE and ours agree on the picture; two lights of the same angles share no texture (each light makes its own 256 x 256 table); attenuation and radius as on PointLight; a spot with cutOffAngle above about 88 degrees is held at 88 (a projection texture needs a cone under 180 degrees); Babylon only marks the projection of a SpotLight for update when the light's own position or direction changes, not when a parent Transform moves it: the bridge sets the (internal) dirty flag every frame; this is Likely stable on 9.32.0 but not a public API |

Visual comparison (320 x 240 picture of each engine, same scene and camera; ours = Babylon render target, X_ITE = page screenshot; CPU only, SwiftShader / llvmpipe, no real GPU). iou = overlap of the drawn silhouettes, mad = mean absolute RGB difference over the picture (0 to 255), fg = mean colour of the drawn pixels:

| node | shot | iou | mad | psnr dB | fg ours | fg X_ITE | picture (ours left, X_ITE right) |
|---|---|---|---|---|---|---|---|
| MultiTexture | main | 0.97 | 1.63 | 34.52 | [255, 255, 0] | [247, 247, 0] | receipts/shots/MultiTexture.main.png |
| MultiTextureTransform | main | 0.97 | 3.23 | 22.02 | [128, 0, 128] | [120, 0, 127] | receipts/shots/MultiTextureTransform.main.png |
| DirectionalLight | main | 0.99 | 1.6 | 38.86 | [125, 112, 101] | [124, 111, 100] | receipts/shots/DirectionalLight.main.png |
| DirectionalLight | turned | 0.99 | 1.56 | 37.57 | [89, 101, 86] | [87, 99, 84] | receipts/shots/DirectionalLight.turned.png |
| DirectionalLight | off | 0.99 | 1.4 | 42.02 | [36, 120, 36] | [36, 118, 36] | receipts/shots/DirectionalLight.off.png |
| PointLight | main | 0.96 | 1.27 | 29.57 | [154, 138, 92] | [150, 134, 89] | receipts/shots/PointLight.main.png |
| SpotLight | main | 1 | 0.04 | 61.79 | [186, 186, 186] | [186, 186, 186] | receipts/shots/SpotLight.main.png |
| SpotLight | moved | 1 | 0.04 | 62.47 | [192, 192, 192] | [193, 193, 193] | receipts/shots/SpotLight.moved.png |
| SpotLight | turned | 1 | 0.06 | 60.64 | [169, 169, 169] | [169, 169, 169] | receipts/shots/SpotLight.turned.png |
| SpotLight | up | 1 | 0 | 99 | [0, 0, 0] | [0, 0, 0] | receipts/shots/SpotLight.up.png |
