/* ShadedVolumeStyle (VolumeRendering level 3): All fields fully supported except shadows supported with at least Phong shading at level 3. All fields fully supported with at least Phong shading and Henyey-Gr
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ShadedVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    lighting: ['SFBool', IO, false],
    material: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    phaseFunction: ['SFString', INIT, "Henyey-Greenstein"],
    shadows: ['SFBool', IO, false],
    surfaceNormals: ['SFNode', IO, null],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: the normal is the negative gradient of the voxel red channel (one voxel on each side), lighting is OFF by default (the sample keeps its colour), and with lighting on the colour is
   diffuse (the voxel colour, or the Material's diffuseColor) times N dot L plus specular, summed over the lights, plus emissiveColor once per light. No lights means black. shadows and
   phaseFunction are read and not used (X_ITE does not use them either); attenuation, radius and spot cones are not applied (gap). */
(BR.volr ||= { styles: {} }).styles.ShadedVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const id = C.id, m = n.f.material, mf = m ? m.f : null, g = (k, d) => (mf && mf[k] !== undefined ? mf[k] : d);
  const df = g('diffuseColor', [0.8, 0.8, 0.8]), sp = g('specularColor', [0, 0, 0]), em = g('emissiveColor', [0, 0, 0]), shin = g('shininess', 0.2), tr = g('transparency', 0), amb = g('ambientIntensity', 0.2);
  const sn = n.f.surfaceNormals && BR.volr.is3D(n.f.surfaceNormals) ? C.tex('sn_' + id, n.f.surfaceNormals, 3) : null;
  let b;
  if (!n.f.lighting) b = m ? `return vec4f(${C.v3(df)}, c0.a * ${C.fl(1 - tr)});` : 'return c0;';
  else b = `var col = vec4f(0.0);
  var df = ${m ? C.v3(df) : 'c0.rgb'};
  col.a = ${m ? `c0.a * ${C.fl(1 - tr)}` : 'c0.a'};
  let N = sn.xyz;
  let V = normalize(-vp);
  for (var i = 0u; i < 4u; i++) {
    let Lt = lightAt(i);
    if (Lt.w < 0.5) { continue; }
    var L = Lt.xyz;
    if (Lt.w > 1.5) { L = normalize(Lt.xyz - vp); }
    let H = normalize(L + V);
    let dif = df * max(dot(N, L), 0.0);
    var sf = 1.0;
    ${shin > 0 ? `sf = pow(max(dot(N, H), 0.0), ${C.fl(shin * 128)});` : ''}
    col = vec4f(col.rgb + lightCol(i) * (dif + ${C.v3(sp)} * sf) + ${C.v3(em)}, col.a);
  }
  return col;`;
  return { name: 'st_' + id, lights: !!n.f.lighting, lib: [], fn: `${C.normalFn(id, sn)}\nfn st_${id}(c0: vec4f, tc: vec3f, vp: vec3f) -> vec4f {\n  let sn = nrm_${id}(tc);\n  if (sn.w == 0.0) { return vec4f(0.0); }\n  ${b}\n}` };
};
