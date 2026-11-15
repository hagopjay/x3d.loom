/* Extrusion (Geometry3D level 4): crossSection swept along spine with scale and orientation per spine point, optional caps and creaseAngle (19775-1 13.3.5).
   Vertex maths: the Library hall port (hall/reader-ext-hl.js); this spec draws the node as a node, so its fields stay readable and a change redraws it. */
BR.node('Extrusion', {
  component: 'Geometry3D', level: 4,
  container: 'geometry',
  geometry(g, body) { return BR.hallFaces(g, R.hallGeom.extrusion(g), body); },
  changed(body, n, field) { if (/^(beginCap|endCap|ccw|convex|creaseAngle|crossSection|orientation|scale|solid|spine)$/.test(field)) body.regeo(n); },
});
