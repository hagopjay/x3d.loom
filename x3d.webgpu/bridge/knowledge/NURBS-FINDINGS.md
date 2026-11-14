# NURBS on the Babylon bridge: findings

Scope: Contour2D, ContourPolyline2D, NurbsCurve, NurbsCurve2D, NurbsOrientationInterpolator, NurbsPatchSurface, NurbsPositionInterpolator, NurbsSet, NurbsSurfaceInterpolator, NurbsSwungSurface (X3D 4.0 NURBS component), bridged in batch 44 (`BATCH-44.md` has the per-node receipts, `WHY-nurbs-batch.md` explains each group). Not done: NurbsSweptSurface, NurbsTextureCoordinate, NurbsTrimmedSurface.
Reference engine: X_ITE 16.6.0 (NURBS part of the 16.6.0 source read; behaviour measured through the SAI and its private `getVertices` / `tessellate`). Rig for every number below unless a line says otherwise:
Chromium 153.0.8010.12 (Chrome for Testing), headless, SwiftShader (CPU only; WebGL2 for X_ITE, WebGPU through SwiftShader/Dawn for Babylon), Babylon.js 9.32.0, Playwright 1.62.1, container with no GPU.
Grades: Confirmed [C] (measured on that rig or read in the exact file), Likely [L] (reasoned, or read from memory of a source), Suspected [S] (a guess).
Standing rule: no pixel perfection; numbers are compared as bounds written in the test, pictures as silhouette and mean colour.

## What was built

| piece | where | what it is |
|---|---|---|
| shared maths | `src/nurbs.js` (`BR.nurbs`) | knot validity and fallbacks, span search (Piegl-Tiller A2.1), basis derivatives (A2.3), rational curve and surface evaluation, analytic surface normal, the tessellation rule, swung-surface extrusion, `redrawUsers` |
| kit change | `src/kit.js`, `src/body-br.js` | `spec.refs`: node fields a node's geometry depends on (a curve's `controlPoint` Coordinate); the geometry cache version and both `geometryChanged` wrappers read them |
| bundle | `tools/bundle.js` | `src/nurbs.js` goes in right after `kit.js` |
| driver fix | `tools/driver.py` (`xsd_patched`) | `xsdAllow` with more than one node added only the first (after the first insert the anchor text no longer matched); now all are inserted in one replace |

## The tessellation rule (copied from X_ITE on purpose) [C]

Per direction: `t > 0` is `t` segments, `t < 0` is `-t * dimension`, `t == 0` is `2 * dimension` (dimension = number of control points in that direction). NurbsSet multiplies by `tessellationScale` and floors, minimum one cell. A scale of 0 or below leaves X_ITE with 0 segments (NaN vertices); we keep one cell.
Closed (periodic) curves and surfaces extend the knot vector periodically and the control points by `order - 1`; if the end points do not meet, X_ITE and this bridge both still build the periodic extension.
An illegal knot vector (wrong length, decreasing, or no open/closed structure) falls back to a uniform pinned vector in both engines.

## X_ITE 16.6.0 behaviours (and traps)

| # | what | evidence | grade |
|---|---|---|---|
| 1 | Weights are not applied as homogeneous coordinates: a weighted quarter circle has radius up to 1.24 where a rational B-spline has 1.00; a weighted quarter cylinder surface reaches 1.24 | `NurbsCurve`, `NurbsCurve2D`, `NurbsPatchSurface` weight cases | C |
| 2 | The three interpolators ignore weights: the midpoint of the weighted quarter circle is the unweighted B-spline point (0.75, 0.75, 0), not (0.7071, 0.7071, 0) | `NurbsPositionInterpolator`, `NurbsSurfaceInterpolator`, `NurbsOrientationInterpolator` weight cases | C |
| 3 | An interpolator whose curve is invalid (order 4 with three control points) throws `TypeError: reading domain of undefined` when `set_fraction` reaches it, and the page stops answering | steps run `only:'ours'` | C |
| 4 | Patch normals are the average of face normals inside an 85 degree crease; faceted at low tessellation | largest component difference to our analytic normal 0.21 (12 x 12 cells), 0.28 (8 x 8) | C |
| 5 | A closed (periodic) surface leaves a seam in the normals; its own source has "TODO: handle uClosed" | read in source, measured seam | C |
| 6 | Extrusion frame: Y axis is the bisector of the two unit vectors at an interior spine point (the standard text, from memory of 19775-1, reads as the chord spine[i+1] - spine[i-1]) | octagon trajectory (even spacing) 1.2e-7 apart; 2.2-unit vase (uneven spacing) up to 0.017 apart | C on the number, L on the spec text |
| 7 | `normal_changed` of the surface interpolator is the unnormalised cross product dS/du x dS/dv | directions agree to 1e-5 | C |
| 8 | NurbsSet `tessellationScale <= 0` gives 0 segments (NaN vertices) | getVertices read | C |
| 9 | The solid FALSE back face is lit in X_ITE; the Babylon body draws a counter-clockwise face seen from behind black (also for an IndexedFaceSet with solid FALSE: 9312 against 19012 drawn pixels in a two-quad fixture). Not a NURBS bug | existing body gap, affects patch and swung fixtures, kept off screen | C, cause S |

## Design choices (quality over X_ITE match)

- Surfaces use the **analytic normal** dS/du x dS/dv at every grid vertex; degenerate vertices (the pole of a cone) fall back to a face-normal average (`fillNormals`). Swung surface normals are smoothed over shared vertices (crease angle pi).
- Weights follow the standard (rational derivative `(A' - w'C) / w`); a weighted case is checked in our engine only, X_ITE only records its own measure.
- Interpolators clamp the fraction to the ends; the orientation interpolator sends no event for a zero derivative.
- NurbsSwungSurface: Y axis along the chord (Likely the standard); texture coordinates run 0..1 along the profile (s) and the trajectory (t) (same numbers as X_ITE); no scale, orientation or caps (the NURBS nodes have none).

## Numbers (steps passed in the test spec, ours / X_ITE; both engines run the same fixture)

NurbsCurve 32/32 and 32/32; NurbsCurve2D 36/36 and 36/36; ContourPolyline2D 14/14 and 14/14; Contour2D 22/22 and 22/22; NurbsPositionInterpolator 55/55 and 52/52; NurbsOrientationInterpolator 51/51 and 48/48; NurbsSurfaceInterpolator 52/52 and 51/51; NurbsPatchSurface 35/35 and 35/35; NurbsSet 47/47 and 46/46; NurbsSwungSurface 18/18 and 18/18. Unit checks of `BR.nurbs` in node: quarter-circle radius error 2e-16, rational derivative error 7.6e-10, unweighted midpoint (0.9375, 0.4375) equal to X_ITE. [C]
(X_ITE counts are lower where steps are `only:'ours'`: the weighted cases and the invalid-curve interpolator events.)

## Test-rig traps found in this batch

- A `Coordinate` without `containerField="controlPoint"` inside a NURBS curve or patch leaves X_ITE with no control points and no error. Fixture authors: always write `containerField="controlPoint"`.
- X_ITE hangs on `set_fraction` into an invalid interpolator curve (trap 3 above): such steps must be `only:'ours'`.
- The 4.0 XSD content model of **NurbsSet** is a `sequence` of NurbsPatchSurface, NurbsSweptSurface, NurbsSwungSurface, NurbsTrimmedSurface, ProtoInstance repeated, not a choice, so a set naming only patches does not validate; the spec uses `xsdChoice: ["NurbsSet"]` (the receipt says so). Finding for the upstream schema, not yet reported.
- The 4.0 XSD has no place for `Contour2D`, `NurbsCurve2D` and `ContourPolyline2D` in the scene child model (they are not children of any scene node); the specs use `xsdAllow`.
- `xsdAllow` with several nodes added only the first until the driver fix in this batch.

## Not covered

Real GPU timing; GeoCoordinate as a control-point source (NurbsCurve, NurbsPatchSurface read Coordinate and CoordinateDouble only); NurbsTextureCoordinate as `texCoord`; trimming; picking of NURBS lines (lines are not pickable in the body); the Extrusion Y-axis reading against the standard text (read from memory, not re-checked: confirm against ISO/IEC 19775-1 13.3.5 before relying on it).

**Why:** a later thread must not rediscover X_ITE's weight handling, the interpolator throw, or the XSD gaps. **How to apply:** start NurbsSweptSurface from `BR.nurbs.extrude`; start NurbsTrimmedSurface from `Contour2D`'s `contour(n)` and `BR.nurbsPatchOf`; name the rig for any number.
