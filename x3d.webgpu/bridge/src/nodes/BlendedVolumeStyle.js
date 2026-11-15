/* BlendedVolumeStyle (VolumeRendering level 3): BlendedVolumeStyle combines rendering of two voxel data sets into one by blending voxel values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BlendedVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    renderStyle: ['SFNode', IO, null],
    voxels: ['SFNode', IO, null],
    weightConstant1: ['SFFloat', IO, 0.5],
    weightConstant2: ['SFFloat', IO, 0.5],
    weightFunction1: ['SFString', IO, "CONSTANT"],
    weightFunction2: ['SFString', IO, "CONSTANT"],
    weightTransferFunction1: ['SFNode', IO, null],
    weightTransferFunction2: ['SFNode', IO, null],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: a sample becomes clamp(c * w1 + b * w2, 0, 1) over all four channels (alpha too), c = what the chain holds now (the default ramp's (r, r, r, r) for a lone Blended) and b the second
   volume at the same normalised position, sent through the default ramp (so only its red channel counts) and then through the nested renderStyle (which sees the SECOND volume as its voxels). The weights:
   CONSTANT the constant, ALPHA1 / ONE_MINUS_ALPHA1 the alpha of the first (the primary) volume and ALPHA2 / ONE_MINUS_ALPHA2 the alpha of the second (the schema's names), ALPHA0 and ONE_MINUS_ALPHA0 as
   aliases of the first (the names X_ITE really implements); TABLE reads weightTransferFunctionN at (alpha of the first, alpha of the second), its first channel. Any other word is CONSTANT. Without
   voxels (or enabled false) the node is a pass-through and its renderStyle is ignored.
   Deliberate differences: X_ITE's ALPHA1 and ONE_MINUS_ALPHA1 produce a shader that does not compile (a stray space), so the whole volume vanishes, and ALPHA2 is silently CONSTANT; two Blended nodes in
   one volume are a GLSL redefinition there and draw nothing. The bridge honours the schema names and any number of Blended nodes. */
(BR.volr ||= { styles: {} }).styles.BlendedVolumeStyle = (n, C) => {
  const f = n.f; if (f.enabled === false || !f.voxels || !BR.volr.is3D(f.voxels)) return null;
  const id = C.id, v2 = C.tex('v2_' + id, f.voxels, 3), vx = 'vox_' + id;
  const nest = f.renderStyle && BR.volr.composable.has(f.renderStyle.type) && BR.volr.styles[f.renderStyle.type] ? C.sub(f.renderStyle, { vox: vx, vol: v2 }) : null;
  const wf = (k) => {
    const fn = String(f['weightFunction' + k]), con = C.fl(f['weightConstant' + k]);
    switch (fn) {
      case 'ALPHA0': case 'ALPHA1': return 'c.a';
      case 'ONE_MINUS_ALPHA0': case 'ONE_MINUS_ALPHA1': return '(1.0 - c.a)';
      case 'ALPHA2': return 'b.a';
      case 'ONE_MINUS_ALPHA2': return '(1.0 - b.a)';
      case 'TABLE': { const t = f['weightTransferFunction' + k]; if (t && t.type === 'PixelTexture') { const s = C.tex('wt' + k + '_' + id, t, 2); return `textureSampleLevel(${s}, ${s}Sampler, vec2f(c.a, b.a), 0.0).r`; } return con; }
      default: return con;
    }
  };
  return { name: 'st_' + id, lights: !!(nest && nest.lights), fn: `fn ${vx}(tc: vec3f) -> vec4f { return textureSampleLevel(${v2}, ${v2}Sampler, tc, 0.0); }
fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  var b = defMap(${vx}(tc));
  ${nest ? `b = ${nest.name}(b, tc, vp);` : ''}
  let w1 = ${wf(1)};
  let w2 = ${wf(2)};
  return clamp(c * w1 + b * w2, vec4f(0.0), vec4f(1.0));
}` };
};
