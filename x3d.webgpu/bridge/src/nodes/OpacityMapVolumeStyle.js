/* OpacityMapVolumeStyle (VolumeRendering level 1): OpacityMapVolumeStyle specifies that volumetric data is rendered using opacity mapped to a transfer function texture.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('OpacityMapVolumeStyle', {
  component: 'VolumeRendering', level: 1,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    transferFunction: ['SFNode', IO, null],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* The transfer function is looked up at (r, g) (2D) or (r, g, b) (3D) of the colour the default OpacityMap already made, which is (r, r, r, r) of the voxel: the diagonal of the table, as X_ITE does (not
   intensity against gradient as the specification says). With no transfer function the style maps the colour through the default ramp a second time. */
(BR.volr ||= { styles: {} }).styles.OpacityMapVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const tf = n.f.transferFunction, id = C.id; let b = 'return defMap(c);';
  if (tf && (tf.type === 'PixelTexture' || BR.volr.is3D(tf))) { const d3 = BR.volr.is3D(tf), s = C.tex('tf_' + id, tf, d3 ? 3 : 2); b = `return textureSampleLevel(${s}, ${s}Sampler, c.${d3 ? 'rgb' : 'rg'}, 0.0);`; }
  return { name: 'st_' + id, fn: `fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f { ${b} }` };
};
