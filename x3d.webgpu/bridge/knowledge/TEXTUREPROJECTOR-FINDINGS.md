# TextureProjector and TextureProjectorParallel on the Babylon bridge: findings

Scope: the TextureProjection component (level 2), bridged in the batch after HAnim (receipts: BATCH-39.md and receipts/TextureProjector*.json).
Reference engine: X_ITE 16.6.0 (`assets/components/TextureProjectionComponent.js` and the shader chunk `Texture2.glsl` read; behaviour measured by driving it).
Rig for every number: Chromium 153.0.8010.12 (Chrome for Testing), headless, SwiftShader (CPU only; WebGL2 for X_ITE, WebGPU through SwiftShader/Dawn for Babylon), Babylon.js 9.32.0, X_ITE 16.6.0, no GPU. Grades: Confirmed (measured on the rig), Likely (read from source), Suspected.

## What X_ITE does (Confirmed by pictures and pixel values, 15 to 17 states per node)

1. A projector is not a light. It multiplies the DIFFUSE colour of every lit shape inside its volume by `mix(1, texel.rgb * color, texel.a * intensity)`; the specular and emissive terms of a lit Material are not touched, and there is no shadow and no occlusion (a shape behind another one is tinted as well). An unlit shape (no Material, UnlitMaterial) is tinted whole.
2. Only faces that look towards the projector: `dot(N, location - vertex) >= 0`, with N flipped for a back face. For an unlit shape X_ITE still tints a thin visible side strip that turns away (measured on an unlit slab, 'back' picture), the bridge does not.
3. The matrix is `inverse(R * T(location) * parentWorld) * P * bias` (row vectors), R is the rotation from +Z to `-direction`, straightened to `upVector` (Rotation4.straighten: the local X axis is turned to Z x up). The picture is read nearest-texel; its first row is the bottom (X3D), also for an ImageTexture.
4. Perspective: the field of view is the SHORT side of the picture (a 2 x 1 picture at 0.6 rad is twice as wide as high). Parallel: `fieldOfView` is the box (minX minY maxX maxY) and is widened to the picture's aspect ratio, never squeezed.
5. Distances. `nearDistance`/`farDistance` below 0 mean default (near 0.125, far 100000) and the depth is clamped to 0..1 so nothing is cut by depth. Given, the depth is clamped to -1..2 and a point outside the volume is cut. Trap: with default distances a point BEHIND a perspective projector is not cut, it lands inside 0..1 after the divide by a negative w and gets a mirrored copy of the picture (the 'away' picture; the same state with the parallel projector is a plain flip). The bridge computes the same numbers and so draws the same thing.
6. `global = FALSE` projects only on the shapes below the parent group. aspectRatio is the picture's width / height, set when the picture is known (output only).
7. Trap: a 4.0 file that does not write `upVector` gets `0 0 1` in X_ITE 16.6.0 (a legacy rule for version 4.0 and below), where X3DUOM 4.0 says `0 1 0`. The bridge uses the UOM value; write upVector in scenes that tilt a projector.
8. Up to four projectors at a time (maxTextures). The first four that are on.

## Babylon side

- Babylon's `SpotLight.projectionTexture` adds light; X_ITE multiplies the diffuse colour, so a light would be wrong on a dark face and would not tint a lit one the same way. The bridge adds a `MaterialPluginBase` (priority 190, WGSL only) to every StandardMaterial and PBRMaterial of a world that has a projector: WGSL in `CUSTOM_FRAGMENT_DEFINITIONS` (the function that maps world position + normal to texture coordinates, exactly X_ITE's few lines) and a tint of `diffuseColor` at `CUSTOM_FRAGMENT_UPDATE_DIFFUSE` (Standard; of `baseColor` when `disableLighting` is set, the unlit look), of `surfaceAlbedo` at `CUSTOM_FRAGMENT_BEFORE_LIGHTS` (PBR). The matrices are computed once per frame from the parent TransformNode's world matrix, the uniforms go through the material's UBO (`getUniforms().ubo`), the pictures as `projTex0..3` (declared in WGSL, listed in `getSamplers`).
- Trap found: the plugin base class has no working `isEnabled`; with no `_enable(true)` in the constructor the plugin is never activated and the custom code is silently left out (no error). The bridge activates the plugin once and switches the code with its own defines (`X3D_PROJ_1..4`, `X3D_PROJ_UNLIT`).
- Trap: `textureSample` needs uniform control flow in WGSL; the picture is read with `textureLoad` at `floor(uv * size)`, which is also the nearest-texel look of X_ITE.
- Trap: a Babylon material plugin is shared by all meshes of the material, per mesh uniforms are not rebound between meshes with the same material; the scope of `global = FALSE` is therefore decided per material from `getBindedMeshes()` (the body makes one material per shape, so this is exact there).
- Trap: `scene.onNewMaterialAddedObservable` fires from the material constructor before the subclass is built; the bridge attaches the plugin in a per frame pass that runs before the draw.

## Numbers (rig above)

Pictures 320 x 240, wall + box + unlit slab, compared with X_ITE: mean absolute difference 0.0 to 3.55 of 255 (perspective, 16 states; the largest is the tilted one, edge texels) and 0.0 to 3.42 (parallel, 17 states); silhouette iou 0.69 to 1.0 and 0.87 to 1.0 (the unlit slab and the lit wall differ in tone between the engines, so iou is only a rough guide here); sampled pixels at texel centres agree within 6 of 255 (most exactly) in 16 states of each node: base, tilted, rolled by upVector, colour and intensity, off/on, moved with the parent, field of view, near, far, both given, behind the wall (no tint), mirror, 2 x 1 picture (aspectRatio 2), ImageTexture 3 x 2 (aspectRatio 1.5), two projectors, global FALSE. The receipt has the per state values.

## What remains

- A textured UnlitMaterial and any other shape drawn by a ShaderMaterial (points, lines, volumes) is not tinted. X_ITE tints them.
- PhysicalMaterial: the tint code is attached and compiles, no picture compare: PhysicalMaterial draws black in the body on this rig with or without a projector (Suspected: needs an environment; not in this lane).
- A WebGL engine draws the scene without the projection (WGSL only).
- TextureProperties filters and mip levels of the projected picture are not applied.
- Shadows: stored, nothing is shadowed (X_ITE does not either).
