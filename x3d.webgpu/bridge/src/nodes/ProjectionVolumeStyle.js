/* ProjectionVolumeStyle (VolumeRendering level 2): ProjectionVolumeStyle uses voxel data to directly generate output color.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ProjectionVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    intensityThreshold: ['SFFloat', IO, 0],
    metadata: ['SFNode', IO, null],
    type: ['SFString', IO, "MAX"],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0 does not cast a ray: each of the 400 slice fragments of a pixel runs its own 16 step march of 0.0884 along the slice normal (towards the viewer, in volume axes), starting 0.7071 behind
   the point tc + n * dot(tc - 0.5, n) (the slice's own offset along n is doubled, a sign slip), skipping steps outside the unit cube, and returns a grey P (MAX: the largest raw red value, with
   intensityThreshold the first local maximum at or above it; MIN: the smallest, starting from 1.0; AVERAGE: the sum over the steps / 16, always 16) with the alpha the default ramp gave THIS slice's
   voxel. The slices then blend as usual. Any other type word is MAX. The bridge runs the same march per slice sample, so it reproduces the arithmetic and its quirks (front slices are darker in AVERAGE;
   MIN with no hit is white); the slice normal is the view direction for cubes, not divided by dimensions (as in X_ITE). */
(BR.volr ||= { styles: {} }).styles.ProjectionVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const id = C.id, type = n.f.type === 'MIN' || n.f.type === 'AVERAGE' ? n.f.type : 'MAX', thr = C.fl(n.f.intensityThreshold);
  const body = type === 'AVERAGE' ? 'p = p + inten;'
    : `if (inten < ${thr}) { continue; }
    if (first && ${thr} > 0.0) { break; }
    ${type === 'MAX' ? 'if (inten <= p) { first = true; continue; }' : 'if (inten >= p) { first = true; continue; }'}
    p = inten;`;
  return { name: 'st_' + id, fn: `fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  var p = ${type === 'MIN' ? '1.0' : '0.0'};
  let nn = uniforms.viewTex;
  let start = tc + nn * dot(tc - vec3f(0.5), nn) - nn * 0.7071067811865476;
  let stp = nn * (1.4142135623730951 / 16.0);
  var first = false;
  for (var i = 0; i < 16; i = i + 1) {
    let ray = start + stp * f32(i);
    if (any(abs(ray - vec3f(0.5)) > vec3f(0.5))) { continue; }
    let inten = vox(ray).r;
    ${body}
  }
  ${type === 'AVERAGE' ? 'p = p / 16.0;' : ''}
  return vec4f(vec3f(p), c.a);
}` };
};
