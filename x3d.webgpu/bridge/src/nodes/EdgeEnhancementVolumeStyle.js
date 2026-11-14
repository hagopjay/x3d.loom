/* EdgeEnhancementVolumeStyle (VolumeRendering level 2): EdgeEnhancementVolumeStyle specifies edge enhancement for the volume rendering style.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('EdgeEnhancementVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    edgeColor: ['SFColorRGBA', IO, [0, 0, 0, 1]],
    enabled: ['SFBool', IO, true],
    gradientThreshold: ['SFFloat', IO, 0.4],
    metadata: ['SFNode', IO, null],
    surfaceNormals: ['SFNode', IO, null],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: angle = |N dot normalize(eye to sample)|; at or above cos(gradientThreshold) the colour stays, below it the colour mixes from edgeColor (weight 1 - angle on the edge colour, angle on the
   voxel colour) with alpha kept (edgeColor's alpha is not used). A sample with no gradient is dropped, so a constant volume vanishes. */
(BR.volr ||= { styles: {} }).styles.EdgeEnhancementVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const id = C.id, sn = n.f.surfaceNormals && BR.volr.is3D(n.f.surfaceNormals) ? C.tex('sn_' + id, n.f.surfaceNormals, 3) : null;
  return { name: 'st_' + id, fn: `${C.normalFn(id, sn)}
fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  let sn = nrm_${id}(tc);
  if (sn.w == 0.0) { return vec4f(0.0); }
  let ang = abs(dot(sn.xyz, normalize(vp)));
  if (ang >= cos(${C.fl(n.f.gradientThreshold)})) { return c; }
  return vec4f(mix(${C.v3(n.f.edgeColor || [0, 0, 0])}, c.rgb, ang), c.a);
}` };
};
