/* BoundaryEnhancementVolumeStyle (VolumeRendering level 2): BoundaryEnhancementVolumeStyle provides boundary enhancement for the volume rendering style.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BoundaryEnhancementVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    boundaryOpacity: ['SFFloat', IO, 0.9],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    opacityFactor: ['SFFloat', IO, 2],
    retainedOpacity: ['SFFloat', IO, 0.2],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: not a gradient magnitude: f = |voxel(r) - voxel(r + one voxel)| along the third texture axis of the red channel only, alpha times (retainedOpacity + boundaryOpacity f^opacityFactor),
   colour untouched. A constant volume stays visible at retainedOpacity times its alpha. */
(BR.volr ||= { styles: {} }).styles.BoundaryEnhancementVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const id = C.id;
  return { name: 'st_' + id, fn: `fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  let o = 1.0 / f32(textureDimensions(${C.vol}, 0).z);
  let f = abs(${C.vox}(tc).r - ${C.vox}(tc + vec3f(0.0, 0.0, o)).r);
  return vec4f(c.rgb, c.a * (${C.fl(n.f.retainedOpacity)} + ${C.fl(n.f.boundaryOpacity)} * pow(f, ${C.fl(n.f.opacityFactor)})));
}` };
};
