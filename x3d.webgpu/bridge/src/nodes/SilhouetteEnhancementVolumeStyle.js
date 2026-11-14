/* SilhouetteEnhancementVolumeStyle (VolumeRendering level 2): SilhouetteEnhancementVolumeStyle specifies that volumetric data is rendered with silhouette enhancement.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SilhouetteEnhancementVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    silhouetteBoundaryOpacity: ['SFFloat', IO, 0],
    silhouetteRetainedOpacity: ['SFFloat', IO, 1],
    silhouetteSharpness: ['SFFloat', IO, 0.5],
    surfaceNormals: ['SFNode', IO, null],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: alpha times (silhouetteRetainedOpacity + silhouetteBoundaryOpacity (1 - |N dot normalize(eye to sample)|)^silhouetteSharpness), colour untouched; a sample with no gradient is
   dropped, so a constant volume vanishes whatever the parameters. */
(BR.volr ||= { styles: {} }).styles.SilhouetteEnhancementVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const id = C.id, sn = n.f.surfaceNormals && BR.volr.is3D(n.f.surfaceNormals) ? C.tex('sn_' + id, n.f.surfaceNormals, 3) : null;
  return { name: 'st_' + id, fn: `${C.normalFn(id, sn)}
fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  let sn = nrm_${id}(tc);
  if (sn.w == 0.0) { return vec4f(0.0); }
  return vec4f(c.rgb, c.a * (${C.fl(n.f.silhouetteRetainedOpacity)} + ${C.fl(n.f.silhouetteBoundaryOpacity)} * pow(max(1.0 - abs(dot(sn.xyz, normalize(vp))), 0.0), ${C.fl(n.f.silhouetteSharpness)})));
}` };
};
