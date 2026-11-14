/* ToneMappedVolumeStyle (VolumeRendering level 2): ToneMappedVolumeStyle specifies that volumetric data is rendered with Gooch shading model of two-toned warm/cool coloring.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ToneMappedVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    coolColor: ['SFColorRGBA', IO, [0, 0, 1, 0]],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    surfaceNormals: ['SFNode', IO, null],
    warmColor: ['SFColorRGBA', IO, [1, 1, 0, 0]],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: tone = sum over the lights of mix(warmColor, coolColor, N dot L * 0.5 + 0.5), the voxel alpha kept (the colours' own alpha is not used). A surface facing the light takes the COOL colour
   (the opposite of the classic Gooch reading); with no lights the colour is black. A sample with no gradient is dropped. */
(BR.volr ||= { styles: {} }).styles.ToneMappedVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const id = C.id, sn = n.f.surfaceNormals && BR.volr.is3D(n.f.surfaceNormals) ? C.tex('sn_' + id, n.f.surfaceNormals, 3) : null;
  return { name: 'st_' + id, lights: true, fn: `${C.normalFn(id, sn)}
fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  let sn = nrm_${id}(tc);
  if (sn.w == 0.0) { return vec4f(0.0); }
  var tone = vec3f(0.0);
  for (var i = 0u; i < 4u; i++) {
    let Lt = lightAt(i);
    if (Lt.w < 0.5) { continue; }
    var L = Lt.xyz;
    if (Lt.w > 1.5) { L = normalize(Lt.xyz - vp); }
    tone = tone + mix(${C.v3(n.f.warmColor || [1, 1, 0])}, ${C.v3(n.f.coolColor || [0, 0, 1])}, dot(L, sn.xyz) * 0.5 + 0.5);
  }
  return vec4f(tone, c.a);
}` };
};
