# LEARNINGS: Segment Sphere (x3d.demo `segment-sphere/v1`, Demo 78, 25 Nov 2026)

The AWS Segment Wheel (hagopjay/aws_SegmentWheel @ `cd88604`, 301 services, 19 categories) rebuilt as one X3D 4.0
scene with three shapes of the same rows (wheel, segment sphere, Hopf-fibred S³), morphed by one ecmascript Script.
Receipts: XSD 4.0 valid, 0 errors / 0 warnings / 34 info (x3d_mcp `4d433af`); MetadataSet round trip 301/301 (lxml);
X_ITE 16.7.1 in Chromium 158 + SwiftShader, 0 console errors, 0 black frames of 8. Grades: C = confirmed here.

## 1. Chart → sphere → S³ is one data contract, three embeddings (C)
Keep one row per item and one Script that maps each row three ways; never three scenes. What each shape must preserve:
- wheel: the source's own coordinates (radius, angle), extracted by asserts against the source page, not retyped;
- sphere: wedge angle → longitude, so a lune's area 2R²Δφ stays proportional to the wedge, i.e. to the count;
- S³: the sphere point is the base of a Hopf fiber, so every item keeps its place and gains a circle; linking number 1
  between any two fibers is a true, checkable statement (C(n,2) linked pairs).
A static fallback (the sphere state) is written into the file so non-ecmascript browsers still show data.

## 2. X_ITE Script performance (C, measured with the Script's own timer)
| change | rebuild in the Hopf view |
|---|---|
| straight top-level code, `new SFVec3f` per point | 69.6 ms |
| MF fields copied to plain arrays in `initialize()` | 52.7 ms |
| `MFVec3f.setValue(Float32Array)` (0.2 ms vs 7 ms for 14,448 points, page-side test) | ~60 ms (math dominated) |
| hot math moved into a `makeEngine()` closure (all names local) | **4.8 ms** |
Free names at Script top level resolve through the browser's field scope; a closure makes them plain locals.

## 3. Stereographic S³ without polygons (C)
Fibers near the projection pole run to infinity. Re-space the base latitudes away from it (35/70/105° instead of the
sphere's 40/90/140°) and compress radius with `RM·tanh(r/RM)`; a hard clamp draws flat polygons on the clamp sphere.
Use an isoclinic rotation (same angle in the (x1,x3) and (x2,x4) planes) for the 4D tumble: it maps fibers to fibers.

## 4. Small traps (C)
- X_ITE's SANS font draws † but not ◇ or ◦ (tofu boxes); spell those statuses out in 3D text.
- `MetadataSet@name` is an NMTOKEN: a category called "Developer Tools" is an x3d_mcp naming *error*; slug the name
  and carry the human label in a child `MetadataString name="label"`.
- A hand-guessed Viewpoint orientation left the sphere in a corner; compute it from eye/target with a look-at basis.
- Hopf "band" sheets built on a patch grid with as few as 3 columns drew as triangles; let the fibers carry the bands
  and fade the sheets out in S³.
