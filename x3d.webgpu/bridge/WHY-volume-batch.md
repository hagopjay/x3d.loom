# Why these ten: volume rendering (tracker batch 43)

Nodes: VolumeData, IsoSurfaceVolumeData, SegmentedVolumeData, and the styles OpacityMapVolumeStyle, ShadedVolumeStyle, ToneMappedVolumeStyle, CartoonVolumeStyle, BoundaryEnhancementVolumeStyle, EdgeEnhancementVolumeStyle, SilhouetteEnhancementVolumeStyle.
Rig for every number: Chromium 153.0.8010.12 on SwiftShader (no real GPU), X_ITE 16.6.0 (WebGL2), Babylon 9.32.0 (WebGPU). Pictures are 320 x 240.

## 1. Why volumes next

Physics is paused by choice and Sound, HAnim and TextureProjector are done by the Castle thread. What is left is four groups: volume rendering (13 nodes), NURBS (13), geospatial (11) and DIS (6). Volume rendering comes first because the brain loom and the molecular viz both want to show a voxel dataset (a scan, an electron density) and nothing in the bridge could draw one except as a texture on a box. X_ITE supports all 13 nodes, so every number below could be checked against it.

## 2. How a volume is drawn, and what X_ITE actually does (read in source, then measured)

A volume is a 3D grid of voxels. To draw it you need something that decides, for each pixel, what colour the voxels along that line of sight add up to. The textbook way is a ray march. X_ITE does something else, and the bridge copies its arithmetic so the same pixel comes out the same:

- **X_ITE draws 400 flat quads, stacked like playing cards, always facing the viewer** (200 at LOW, 400 at MEDIUM, 600 at HIGH quality; MEDIUM is the default). The stack is as deep as the box's diagonal, so neighbouring slices are |dimensions| / 399 apart. Each quad runs a small shader that reads the voxel at that spot, and the quads are blended back to front with ordinary source-alpha blending.
- **There is no correction for slice spacing.** A ray that crosses 230 slices of alpha 0.02 gets 1 - 0.98^230 = 99 percent opaque, whatever the box looks like. So alpha means "per slice", and a volume drawn with 200 slices is thinner than one drawn with 600.
- **The bridge marches one ray per pixel through a box on exactly those planes** (the same depths, measured along the viewer's direction), adds up front to back with the same over operator, and stops when the pixel is 99.8 percent opaque. A ray therefore crosses the same samples and the same alpha adds up. This is why a 4-level ramp, a block, two layers and a cartoon band come out within 2 levels of X_ITE (see section 5).

## 3. The part that surprises people: the default style always runs first

Every X_ITE volume shader starts with a hidden OpacityMapVolumeStyle with the default transfer function, a 256 x 1 grey ramp. Its effect: **a voxel (r, g, b, a) becomes (r, r, r, r)**. Only the red channel counts, the voxel's own green, blue and alpha are thrown away. Consequences, all from the source and one measured:

- a red RGBA voxel (255, 0, 0, 255) is drawn white, a green or blue one is drawn transparent;
- a voxel whose red is 0 is transparent (a sample under 1/255 alpha is dropped), which is why an empty margin is invisible;
- a volume with no voxels at all, or whose file has not arrived yet, is a **white 1 x 1 x 1 volume that fills the box** (measured: a second VolumeData with no voxels draws a white box);
- a user OpacityMapVolumeStyle then reads the table at (r, g) of that already-mapped colour, which is (r, r): **the diagonal of a 2D table**, not the "intensity against gradient" the specification describes. With a 4-colour table the four voxel greys 0, 85, 170, 255 pick the four colours (measured: red, green, blue, white), and the table's own alpha decides, so a voxel of 0 is drawn red instead of being transparent;
- the 4 x 1 table is read nearest below 16 texels and repeats at the edge unless repeatS and repeatT are false. The fixture says so, because the repeat would otherwise wrap the value 1.0 onto the first texel.

## 4. How the styles combine, and their traps

After the default, the volume node adds its own piece, then the style text:

- **IsoSurfaceVolumeData** is not a surface in the geometric sense. A sample is drawn if its value is above the surface value, as an **opaque flat grey of the surface value** (not the voxel's own value: 200 draws as 128, because the surface value was 0.5), and the nearest wins. With values 0.3 and 0.7 the core (230) draws 179 and the ring (128) draws 77. `contourStepSize` with one surface value is broken in X_ITE (it tests only the lowest contour), so the bridge keeps the field and does not copy the bug.
- **SegmentedVolumeData** picks one style per segment by the red channel of a second volume of ids. A segment with no style keeps the plain voxel colour; a disabled one is transparent (measured: red, red, green, white; disabled leaves the background).
- **Shaded**: lighting is OFF by default, so the default Shaded style is a plain grey shell that shows no shading at all. With a Material and lighting off the colour is the Material's diffuse colour (measured 204 for diffuse 0.8), with lighting on the headlight gives 204 face on and 144 at 45 degrees (204 x 0.7071), and with the headlight off and no other light the result is black (measured).
- **ToneMapped**: facing the light is the COOL colour (the opposite of the classic warm-to-cool Gooch reading). Measured: face on, blue; at 45 degrees (37, 37, 218).
- **Cartoon**: the angle is measured against the direction from the eye to the sample (not the other way), so the faces turned to the eye are dropped and the far side of a solid shows. The colour is an HSV mix that goes the short way round the hue circle: red to blue goes through purple, (150, 0, 255) at the middle band of three, and both engines agree on it.
- **Boundary, Edge, Silhouette**: Boundary does not use a gradient magnitude at all, only the difference between a voxel and the next one along the third axis, red channel only. Edge and Silhouette drop every sample with no gradient, so a flat volume vanishes completely whatever the settings. All three only scale alpha (Edge changes colour).

The normal that Shaded, ToneMapped, Cartoon, Edge and Silhouette use is minus the gradient of the red channel, taken one voxel either side. A volume with no empty margin has no gradient at its border and draws nothing.

## 5. What was measured, and where the engines differ on purpose

All ten fixtures pass in both engines. Differences kept honestly:

- **X_ITE blends 8 bit per slice and the bridge blends in float.** A faint stack of four layers (72, 72, 8, 8) comes out 10 in the bridge and 24 in X_ITE; the Edge stack with the style off 14 and 28; the Boundary defaults 40 and 78. The 8 bit blend stalls once a slice's alpha times the pixel is under half a level, so X_ITE is lighter. The bridge result is the more accurate one and is the one that looks better (no banding), which fits the aim of quality over X_ITE match; those three checks therefore use each engine's own value.
- **X_ITE does not take a new transfer function picture** after load: writing a PixelTexture image used as a transfer function changes nothing there (measured; toggling enabled does not help), the bridge does.
- `visible` is honoured by X_ITE (it hides the volume), as in the spec, and by the bridge.

## 6. Gaps (logged)

Not applied: fog and clip planes; per-pixel cutting by opaque shapes that pierce a volume (the box is depth tested as a whole); attenuation, radius and spot cones of lights (only the headlight and up to three more lights act); `shadows` and `phaseFunction` (X_ITE ignores them too); `contourStepSize`; an ImageTexture as a 2D transfer function (only PixelTexture is read; the 3D kinds are); non-uniform scale of a volume node. The plane count is 400 (MEDIUM). Anisotropic `dimensions` tilt X_ITE's normals differently from the bridge's (the bridge divides the gradient by the dimensions; the tests use cubes). BlendedVolumeStyle, ComposedVolumeStyle and ProjectionVolumeStyle are the next batch.

## 7. A bridge bug these tests found

The test runner could not set a colour field with an alpha (SFColorRGBA): the value went through unconverted in X_ITE and the style silently kept its old colours, which looked like an X_ITE bug until the conversion was added. The XSD also lacks `transferFunction` in the containerField list of the texture nodes, so the fixtures are checked against a copy of the schema that has it (the driver patch covers every list that names the texture containerFields).

## 8. What this unlocks

The brain loom and the molecular viz can show a voxel set directly, with a transfer function (colour by density), isosurfaces, segments (labelled regions) and lighting. Next: the three remaining volume nodes (Blended, Composed, Projection styles), then Geospatial.
