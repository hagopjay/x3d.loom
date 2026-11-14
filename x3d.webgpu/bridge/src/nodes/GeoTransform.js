/* GeoTransform (Geospatial level 2): GeoTransform is a Grouping node that can contain most nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoTransform', {
  component: 'Geospatial', level: 2,
  container: 'children',
  defs: {
    addChildren: ['MFNode', IN, []],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', IO, []],
    geoCenter: ['SFVec3d', IO, [0, 0, 0]],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    metadata: ['SFNode', IO, null],
    removeChildren: ['MFNode', IN, []],
    rotation: ['SFRotation', IO, [0, 0, 1, 0]],
    scale: ['SFVec3f', IO, [1, 1, 1]],
    scaleOrientation: ['SFRotation', IO, [0, 0, 1, 0]],
    translation: ['SFVec3f', IO, [0, 0, 0]],
    visible: ['SFBool', IO, true],
  },
  /* A Transform conjugated by the local frame at geoCenter: matrix = L^-1 * M * L (X_ITE 16.6.0), L = the placement at geoCenter, M = translation, rotation, scale and scaleOrientation about
     the frame's origin. With no field set the matrix is the identity, so the children stay where the file puts them; translation is along the local axes (east, up, south) at geoCenter, and
     rotation and scale pivot on the geoCenter point. A scale under a scaleOrientation that is not uniform is a shear, which a TransformNode cannot keep (dropped, noted). */
  build(body, n, parent, chain) { const r = body.buildGroup(n, parent, chain); BR.geo.place(body, n, r); return r; },
  changed(body, n, field) {
    const r = body.rec.get(n.id); if (!r || !r.tn) return;
    if (['translation', 'rotation', 'scale', 'scaleOrientation', 'geoCenter'].includes(field)) BR.geo.place(body, n, r); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
  },
});
