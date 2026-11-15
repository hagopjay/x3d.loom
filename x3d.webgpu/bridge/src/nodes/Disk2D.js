/* Disk2D (Geometry2D level 2): a filled or ring-shaped disc of outerRadius (innerRadius 0 = full) in the z=0 plane, normal +z, 96 segments (X_ITE 16.6.0 uses a polygon too).
   The fields come from the Library hall port (hall/reader-ext-hl.js), which also owns the vertex maths: this spec draws the node as a node (its fields stay readable and a change redraws it). */
BR.node('Disk2D', {
  component: 'Geometry2D', level: 2,
  container: 'geometry',
  geometry(g, body) { return BR.hallFaces(g, R.hallGeom.disk(g), body); },
  changed(body, n, field) { if (field === 'innerRadius' || field === 'outerRadius' || field === 'solid') body.regeo(n); },
});
