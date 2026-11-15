/* ComposedVolumeStyle (VolumeRendering level 3): ComposedVolumeStyle allows compositing multiple rendering styles into single rendering pass.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ComposedVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    renderStyle: ['MFNode', IO, []],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: a chain, not a sum. Every child in list order gets the colour the one before returned and replaces it (the first gets the default ramp's (r, r, r, r)), so the last style that ignores
   its input wins and the order matters. Only composable styles are kept: a ProjectionVolumeStyle child is dropped, a disabled child contributes nothing, an empty or disabled Composed is a
   pass-through. Composed inside Composed works. */
(BR.volr ||= { styles: {} }).styles.ComposedVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const kids = (Array.isArray(n.f.renderStyle) ? n.f.renderStyle : n.f.renderStyle ? [n.f.renderStyle] : []).map((k) => C.sub(k)).filter(Boolean);
  if (!kids.length) return null;
  const id = C.id;
  return { name: 'st_' + id, lights: kids.some((k) => k.lights), fn: `fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  var x = c;
${kids.map((k) => `  x = ${k.name}(x, tc, vp);`).join('\n')}
  return x;
}` };
};
