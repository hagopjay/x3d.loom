# Why these eight: the nodes the Library hall port never got fixtures for (tracker batch 48)

Nodes: Collision, CoordinateInterpolator, CoordinateInterpolator2D, Disk2D, Extrusion, MultiTextureCoordinate, PointProperties, Rectangle2D.
Rig for every number: Chromium 153.0.8010.12 on SwiftShader (no real GPU), X_ITE 16.6.0 (WebGL2), Babylon 9.32.0 (WebGPU). Pictures are 320 x 240.

## 1. Why these eight

The Library hall port drew these nodes earlier, so the tracker marked them `claimed` and the driver skipped them. The hall port is finished and merged, which means nobody was going to give them a fixture, and a node without a fixture has no receipt: nothing says the bridge reads it the way X_ITE does. This batch gives each one an XSD-valid fixture and a test that runs in both engines.

## 2. The finding that mattered: the hall reader deleted three nodes while parsing

Disk2D, Rectangle2D and Extrusion were never nodes in the hall reader. At parse time it converted each one into an IndexedFaceSet, so by the time the bridge looked, the original fields (innerRadius, size, crossSection, spine) were gone and a SAI read of `innerRadius` returned nothing. The fix is an ownership rule: when the bridge has a spec with a `geometry` hook for a node type, the node stays a real node and the hall maths is called through `R.hallGeom` to produce the triangles (`BR.hallFaces`). The hall maths is reused unchanged, so the pictures stay the same (silhouette overlap with X_ITE 0.93 to 0.98) and the fields are alive again, which is what makes events and `changed` work.

## 3. Smaller truths the tests pinned down

- **PointProperties defaults.** The hall reader defaulted pointSizeMinValue to 0. The standard and X_ITE say 1 (scale 1, min 1, max 1, attenuation 1 0 0), so a point is one pixel unless the author says otherwise. A picture compare was dropped for this node: ours drew 12 point quads where X_ITE drew 3 on this rig, so the fixture asserts the vertex count and the field defaults instead.
- **Collision.** Its children were not drawn in the bridge at all (the hall body was not in the bundle). X_ITE also never fires isActive or collideTime unless navigation collision is on, so the fixture checks the children and `enabled`, and not events.
- **CoordinateInterpolator2D produced zeros.** `toSAI('MFVec2f')` walked a flat typed array as if it were pairs. It now reads two numbers at a time, which fixed every 2D interpolator output, not only this node.
- **MultiTextureCoordinate.** PixelTexture stages inside a MultiTexture were skipped, and the face body ignored the per-channel coordinates. Each stage now has its own matrix (TextureTransform composed with an affine fit of channel i from channel 0). Where the channels are not related by an affine map the fit is a least-squares approximation, and that is logged as a gap.

## 4. Numbers

Steps ours / X_ITE: Collision 29/29, CoordinateInterpolator 20/20, CoordinateInterpolator2D 20/20, PointProperties 22/22, Extrusion 45/45, Rectangle2D 31/31, Disk2D 39/39, MultiTextureCoordinate 13/12 (the extra step is ours-only). Smoke gate PASS.

## 5. What the adversarial review found (24 claims, 23 held up under two skeptics each)

The fixtures and the 144-picture sweep were green, so the review looked for what they cannot see: a node used in a place no fixture puts it, and a change that arrives by event. Fixed in this batch:

- **A picking geometry of Disk2D, Rectangle2D or Extrusion** read as nothing because the picker asked for a `coord` and these nodes are no longer converted (the ownership change of section 2 had a second consequence). The picker now accepts any node the body can read geometry from.
- **ROUTEs into set_crossSection, set_spine, set_scale, set_orientation** were refused: the hall table had the four fields as initialize-only, and a `set_X` only maps to an input-output field. They are input-output now.
- **An interpolator output read before any event threw** (default null for a list type); the default is an empty list. `fromSAI('MFVec2f')` had the same half-fix as `toSAI` and gets the typed-array branch.
- **A PointSet with PointProperties and no Coordinate threw while building**, aborting the whole scene. It draws nothing now. The points path also ignored a PointSet's Color; each point takes its own colour now, replacing the emissive colour as the standard says, and a change of the Coordinate, the Color, the PointProperties or the Material builds the points again.
- **MultiTexture:** a stage that cannot be drawn (an empty PixelTexture, no url) shifted every later stage's mode and channel by one; it keeps its place. A channel whose coordinates all collapse to one point made a singular matrix; the stage is now that one texel, as X_ITE samples it.
- **MultiTextureCoordinate on a geometry the bridge builds (QuadSet and the like)** read no coordinates; channel 0 is used.
- **Collision.children set at run time** did nothing; it rebuilds the group like Group and Anchor do. A texture coordinate that an interpolator moves redraws the geometry (the stock body only watched Color, Coordinate and Normal).
- **A NurbsCurve's Coordinate moved at run time** redrew the curve but not a surface swept or swung along it.

Logged as gaps, not fixed: a contour that crosses itself or another contour (parity inside a grid cell can be wrong; the standard asks for contours that do not cross), `trimmingContour.push(...)` through the SAI proxy, a TextureCoordinateGenerator with a camera-space mode inside a MultiTextureCoordinate (computed once), a PixelTexture stage repainted by a change of its image, and a scene with a 3D-texture Appearance replacing the texture coordinates of a Rectangle2D with zeros (one of two skeptics saw it).
