/* Rectangle2D (Geometry2D level 2): a rectangle of `size` centred on the origin in the z=0 plane, normal +z. Vertex maths: the Library hall port (hall/reader-ext-hl.js). */
BR.node('Rectangle2D', {
  component: 'Geometry2D', level: 2,
  container: 'geometry',
  geometry(g, body) { return BR.hallFaces(g, R.hallGeom.rect(g), body); },
  changed(body, n, field) { if (field === 'size' || field === 'solid') body.regeo(n); },
});
