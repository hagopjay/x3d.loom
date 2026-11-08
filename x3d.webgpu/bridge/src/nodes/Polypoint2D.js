/* Polypoint2D (Geometry2D level 1): Polypoint2D is a geometry node that defines a set of 2D points in X-Y plane.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Polypoint2D', {
  component: 'Geometry2D', level: 1,
  container: 'geometry',
  defs: {
    metadata: ['SFNode', IO, null],
    point: ['MFVec2f', IO, []],
  },
  // X3DGeometryNode: a point at each (x y) in the z=0 plane, drawn with the Material's emissive colour. WebGPU draws every point one pixel (no point size): gap.
  points(g) {
    const V = g.f.point || [], F = V.length && typeof V[0] === 'object' ? V.flat() : V;
    return BR.pt3(Float32Array.from(F));
  },
  changed(body, n, field) { if (field === 'point') body.regeo(n); },
});
