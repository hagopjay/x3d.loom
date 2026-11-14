# Why these ten: curves, patches and swung surfaces (tracker batch 44)

Nodes: Contour2D, ContourPolyline2D, NurbsCurve, NurbsCurve2D, NurbsOrientationInterpolator, NurbsPatchSurface, NurbsPositionInterpolator, NurbsSet, NurbsSurfaceInterpolator, NurbsSwungSurface.
Left for a later batch (on purpose): NurbsSweptSurface, NurbsTextureCoordinate, NurbsTrimmedSurface. See section 7.
Rig for every number below: Chromium 153.0.8010.12 (Chrome for Testing), headless, SwiftShader (CPU raster only), X_ITE 16.6.0 (WebGL2), Babylon 9.32.0 (WebGPU), Playwright 1.62.1. No real-GPU timing exists in this file.
Grades: Confirmed [C] = measured on that rig or read in the exact file; Likely [L] = reasoned or read from memory of a source; Suspected [S] = a guess.

## 1. What NURBS is, in the five sentences you need

A NURBS curve is a smooth path steered by **control points**: the path is pulled toward them but usually does not pass through them (only the two ends, with the default knots). Three numbers shape it. **order** is how stiff it is (order 2 is straight segments, order 3 is a quadratic curve, order 4 a cubic). The **knot vector** says where along the parameter the control points take over from one another, and a **weight** per point lets it be pulled harder: weights are what make an exact circle possible, which plain polynomials cannot do. A **surface** is the same thing in two directions (u and v) with a grid of control points, and the browser turns it into triangles by choosing a **tessellation**: how many cells to cut each direction into. The standard fixes the maths; it leaves the cutting to the browser, so the *tessellation rules* are where X_ITE and a bridge can differ and where we copied X_ITE on purpose.

## 2. Why one shared library (src/nurbs.js)

Ten nodes, one piece of maths. Curve nodes, interpolators, the patch and the swung surface all need the same four things: validate the knot vector, find the span a parameter falls in, evaluate basis functions and their derivatives, and cut a tessellation count out of the field value. Writing that ten times would give ten sets of bugs. `BR.nurbs` holds it once (Piegl and Tiller, algorithms A2.1 span search and A2.3 basis derivatives), and every node reads it. [C] Unit checks in node: quarter-circle radius error 2e-16, rational derivative error 7.6e-10, an unweighted midpoint (0.9375, 0.4375) equal to X_ITE's.

One small kit change was needed: a node's data can now depend on a field of *another* node (the curve's `controlPoint` is a Coordinate node whose points move). `spec.refs` names those fields, so the cached geometry is dropped when a referenced node changes (`src/body-br.js`, both `geometryChanged` wrappers). Without it, an event that moves a control point left the old curve on screen.

## 3. Group A: the 2D control curves (NurbsCurve2D, ContourPolyline2D, Contour2D)

**What they are.** Nothing you can see. A NurbsCurve2D is a curve in the flat (u, v) plane of a surface; a ContourPolyline2D is the same idea with straight segments; a Contour2D is a list of them chained into one closed loop that says "cut a hole here". They only mean something when a trimmed surface (later batch) or a swung/swept surface reads them.

**Why they are tested the odd way.** There is nothing to draw, so the test compares the *point list the node hands to its users*: X_ITE's `tessellate(type)` against ours. `type` is how a 2D point becomes a 3D one: 0 = (x, y, 0), 1 = (x, 0, y), 2 = (x, y, 0) for a swept surface path. [C] 36/36 steps for NurbsCurve2D, 14/14 for ContourPolyline2D, 22/22 for Contour2D, in both engines.

**What differs from X_ITE.** Weights (see section 8): X_ITE 16.6.0 does not apply them as a rational curve needs, so a weighted quarter circle has radius 1.24 in X_ITE where the exact value is 1.00. We follow the standard (radius 1 to 1e-5) and only check the weighted case in our engine. [C]

## 4. Group B: the curve you can see (NurbsCurve)

A NurbsCurve is drawn as a line strip: the tessellated points joined. The standard leaves the count to the browser; X_ITE uses `tessellation > 0` as is, `< 0` as `-tessellation * dimension`, `0` as `2 * dimension`. We copied that rule so a model looks the same segment for segment. [C] Every point list (five curves in view, five off screen: open order 3, a cubic with explicit knots and a negative tessellation, a closed loop, a bent 3D curve, an order 2 polyline; plus a weighted quarter circle, too few points, default tessellation, illegal knots, an unclosable closed curve) agrees with X_ITE's `getVertices` in 32/32 steps in each engine.

Edge cases we decided, with a reason:
- **Illegal knot vector** (wrong length, decreasing, or not matching order): fall back to a uniform pinned vector, as X_ITE does. A scene author's typo then still shows a curve, not nothing.
- **Closed curve whose end points do not meet**: periodic extension, as X_ITE does.
- **Too few points** (fewer than the order): draw nothing and raise no error.
- Line width is one pixel in both engines (the body draws a thin ribbon). A gap, logged.

## 5. Group C: the interpolators (NurbsPositionInterpolator, NurbsOrientationInterpolator, NurbsSurfaceInterpolator)

These are the animation nodes: give a fraction, get a point (or a turn, or a point and a surface normal) on the curve or surface. Why they are in this batch: an animator needs "move this object along that curve" more often than the curve itself, and the standard builds the rotation from the curve's tangent, so they have to share the exact same curve code.

- **Position**: the value at the fraction, clamped to the ends (a fraction outside 0..1 gives the end point). [C] 55/55 steps ours, 52/52 X_ITE.
- **Orientation**: the rotation that carries +Z onto the curve's direction at that fraction. The direction comes from the *derivative* of the rational curve, `(A' - w'C) / w`. A turn and its opposite-signed axis are the same turn, so the test compares quaternions, not axis-angle. 51/51 ours, 48/48 X_ITE. [C]
- **Surface**: position and unit normal at (u, v). The normal is the cross product dS/du x dS/dv, normalised. X_ITE sends the cross product *unscaled* (same direction, different length); the directions agree to 1e-5 and the directions are what is compared. 52/52 ours, 51/51 X_ITE. [C]

Two decisions you may want to overrule:
1. **Zero derivative** (all control points equal, a stopped point): we send no event, X_ITE normalises a zero vector (undefined). An event with a NaN rotation would poison every later route. Likely the right call, Suspected that no scene depends on it.
2. **X_ITE throws on an invalid curve.** If an interpolator's curve is invalid (order 4 with three points) and a fraction arrives, X_ITE 16.6.0 raises TypeError ("domain of undefined") and the page stops answering. Those steps run in our engine only. A bridge that does not throw is the better citizen. [C]

## 6. Group D: the surfaces (NurbsPatchSurface, NurbsSet, NurbsSwungSurface)

**NurbsPatchSurface** is the real thing: a grid of control points, orders and knots in u and v, optional per-control-point texture coordinates, weights, and optional closing in either direction (a tube). [C] 35/35 steps in both engines: every triangle corner, uv and (for two patches) normal agrees with X_ITE's vertex arrays.
- **Normals: quality over match.** X_ITE averages *face* normals within an 85 degree crease, so a low tessellation looks faceted. A NURBS surface has an exact normal at every point, the cross product of the two derivatives, so we use that: smooth at any tessellation. Measured largest component difference from X_ITE 0.21 at 12 x 12 cells and 0.28 at 8 x 8; compared at 0.3. The standing rule is quality over X_ITE match, so this is a *measured, intended* difference, not a bug. [C]
- **A closed surface** leaves a seam in X_ITE's normals (its own source says "TODO: handle uClosed"). Positions, uv and triangles agree; ours shades smoothly across the seam. [C]
- **Tessellation counts**: the same rule as the curve, per direction, then multiplied by the set's scale (below). Floored, minimum one cell.

**NurbsSet** groups surfaces and scales their tessellation with one number, `tessellationScale`. It is a level-of-detail dial: a scale of 2 doubles the cells in each direction, 0.5 halves. A surface that leaves the set goes back to its own tessellation; one that joins takes the scale. [C] 47/47 ours, 46/46 X_ITE, counted as triangles per surface. The set itself draws nothing (the Shapes draw). Edge case: a scale of 0 or below leaves X_ITE with zero segments and NaN vertices; ours keeps one cell. X_ITE 16.6.0 uses the set's bbox for culling only; we keep `bboxSize` and friends as plain fields.

**NurbsSwungSurface** (a profile curve swung round a trajectory curve; think a vase: a profile outline revolved along a ring) is built as an *extrusion*: take the 2D profile, take the 2D trajectory (as points in the xz plane), and run the standard Extrusion frame walk. We adapted the frame code of the Library hall's Extrusion bridge. 18/18 steps in both engines. [C]
- **The one real disagreement: the Y axis at an interior spine point.** The standard words the frame at spine point i as the Y axis along the *chord* spine[i+1] minus spine[i-1] (Likely: from memory of 19775-1, the text is not in the repository, so confirm against the PDF). X_ITE takes the *bisector* of the two unit direction vectors. They are identical for an evenly spaced spine (octagon trajectory: 1.2e-7 apart) and differ by up to 0.017 in a 2.2-unit vase whose spine points are unevenly spaced (compared at 0.02). We chose the chord and graded it Likely. [C] on the number, [L] on the spec reading.
- Normals are smoothed across every shared vertex (crease angle pi, as X_ITE sets it); pictures agree (mean colour within 10 of 255, picture difference about 3 of 255), not per vertex.
- `ccw FALSE` flips the winding; `solid FALSE` needs the back face lit (see section 8, the Babylon gap).

## 7. Why not the other three

| node | why it waited |
|---|---|
| NurbsSweptSurface | shares the extrusion code with the swung surface; it takes a cross-section curve and a trajectory in 3D. It is the next small step once the swung surface is reviewed. |
| NurbsTextureCoordinate | needs the surface's texture-coordinate contract (its own control grid, weights, knots). The patch supports plain per-control-point TextureCoordinate already and compares it. |
| NurbsTrimmedSurface | needs the trimming: cut the patch's (u, v) square by closed contours (Contour2D) and triangulate the part that is left. Real work (point-in-polygon on a tessellated grid, edge cases at the trim). The contour half is done in this batch; the cutting is not. |

## 8. The X_ITE behaviours and the gaps, in one table

| # | what | X_ITE 16.6.0 | this bridge | grade |
|---|---|---|---|---|
| 1 | Weights | not applied as homogeneous coordinates: a weighted quarter circle has radius 1.24; interpolators ignore weights (unweighted midpoint 0.75, 0.75, 0 where the exact point is 0.7071, 0.7071, 0) | rational; radius 1.00 to 1e-5 (curve), 1e-6 (interpolator) | C |
| 2 | Invalid curve at an interpolator | throws TypeError, page stops answering | no event, no throw | C |
| 3 | Zero derivative | normalises a zero vector | no event | S (no scene found that relies on it) |
| 4 | Surface normals | 85 degree crease average, faceted at low tessellation | analytic dS/du x dS/dv, smooth | C (0.21 / 0.28) |
| 5 | Closed surface seam | leaves a seam ("TODO: handle uClosed") | smooth across | C |
| 6 | Extrusion Y axis | bisector | chord | C on the number, L on the reading |
| 7 | NurbsSet scale 0 | 0 segments, NaN vertices | one cell | C |
| 8 | Interpolator normal length | unscaled cross product | unit | C (directions agree 1e-5) |
| 9 | solid FALSE seen from behind | both faces lit | draws black (a body gap that already exists: two-quad IndexedFaceSet fixture 9312 of 19012 pixels drawn) | C, Suspected cause |

Row 9 is not a NURBS bug: the Babylon body draws a counter-clockwise face seen from behind black. It also hit the HAnim and TextureProjector batches. The affected patch fixture keeps that case off screen and compares triangles only. Fixing the body is its own task.

## 9. What a reader should take from this

1. NURBS is *tessellation plus maths*. The maths is standard and exact; the tessellation rule is where engines differ, and for now we copy X_ITE's count so models agree segment for segment.
2. Where X_ITE's maths is *wrong* (weights) we follow the standard and say so; where it is merely *different* (normals, spine frame) we picked the better look and measured the difference.
3. Everything the page can ask (points, rotations, normals, triangle counts) is compared against X_ITE through its own API, with the bound written in the test and the rig named in the receipt.
4. What is *not* covered: real GPU timing; GeoCoordinate as a control-point source; NurbsTextureCoordinate; trimming; picking of curve lines.
