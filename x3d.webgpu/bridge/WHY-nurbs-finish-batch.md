# Why these three: the end of NURBS (tracker batch 49)

Nodes: NurbsTextureCoordinate, NurbsSweptSurface, NurbsTrimmedSurface.
Rig for every number: Chromium 153.0.8010.12 on SwiftShader (no real GPU), X_ITE 16.6.0 (WebGL2), Babylon 9.32.0 (WebGPU).

## 1. NurbsTextureCoordinate: weights do nothing in X_ITE

The standard describes the node as a rational surface in the (s, t) plane. X_ITE builds each control point as (x, y, 0, w), but its sampler is called with `haveWeights: false`, so the weight never divides anything and the texture coordinates are the plain B-spline of the points. A weighted fixture proves it: a centre weight of 3 leaves X_ITE's uv grid exactly regular (steps of 0.125). The bridge copies that and logs the difference to the standard as a gap. I first wrote the rational form from reading the source, and the test caught it in one run (0.114 against 0.125), which is the case for measuring and not only reading.

An invalid node (order below 2, too few points, wrong dimension) is ignored in both engines and the patch gets its default 0 to 1 coordinates.

## 2. NurbsSweptSurface is an Extrusion with the crease angle set to pi

The cross-section is a curve (NurbsCurve2D or a contour polyline), the trajectory is a NurbsCurve. Both are sampled, the section is carried along the trajectory frame by frame, and normals are smoothed everywhere (crease pi). Pointing the trajectory at something that is not a NurbsCurve, leaving out the section, or giving a one point trajectory draws nothing in both engines. Triangle counts match exactly (160 and 36 for the two shapes on screen); positions agree to 0.02, which is the gap between the chord frame and the bisector frame at a bend.

## 3. NurbsTrimmedSurface: odd winding decides what is kept

The patch is tessellated on its grid, then cut by the contours. A point is kept when an odd number of contours contain it, so a contour inside another one is a hole whichever way it runs, two identical squares cancel to nothing, a contour that swallows the whole domain keeps everything, and no contours means untrimmed. The two engines cut the grid into different triangles at the contour, so the fixture compares the area and the bounding box of what is kept (identical to three decimals on all eight cases) and the picture silhouette. Events change the tessellation and remove and add a contour again.

## 4. What is left

All 260 node types in the tracker now have a reader. Gaps that stay logged: NurbsTextureCoordinate weights (standard says rational, X_ITE and the bridge do not), contours that cross each other (cut by parity, untested), solid FALSE back faces (lit in X_ITE, black in the Babylon body).
