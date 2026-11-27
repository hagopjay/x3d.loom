/* VolumeRendering for the three.js body: VolumeData, IsoSurfaceVolumeData, SegmentedVolumeData and the ten styles (Opacity, Boundary, Edge, Silhouette, ToneMapped, Cartoon, Shaded, Projection, Blended, Composed).
   A port of x3d.webgpu/bridge/src/nodes/VolumeData.js (the ray march) and of the style files, WGSL to GLSL ES 3.00. What it keeps: the field tables and the reader hooks (shared, already in the bundle),
   the planes (400 view-facing slices, |dimensions| / 399 apart, no spacing correction), the hidden default OpacityMap (a voxel becomes (r, r, r, r)), the front to back over operator and the stop at 99.8 percent.
   What is here: the shader text builders (the Babylon ones return WGSL), a THREE.ShaderMaterial on a THREE.BoxGeometry, the Data3DTexture upload through the shared BR.vol.data, the lights in view space.
   BR.volr.build / drop / rebuild are replaced here (the shared V.touch and V.changed call V.rebuild, so a style that changes rebuilds the volume as in the Babylon body). */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, V = BR.volr, fl = V.fl, g3 = (a) => `vec3(${fl(a[0])}, ${fl(a[1])}, ${fl(a[2])})`;
  const S = (T3.volStyles = {});   // the GLSL generators: S[type](node, C) -> { name, fn, lib?, lights? } (null when the style draws nothing)

  /* ---- shared GLSL --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
  const LIGHTS = `uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uL2; uniform vec4 uL3; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
vec4 lightAt(int i) { if (i == 0) return uL0; if (i == 1) return uL1; if (i == 2) return uL2; return uL3; }
vec3 lightCol(int i) { if (i == 0) return uC0; if (i == 1) return uC1; if (i == 2) return uC2; return uC3; }`;
  const normalFn = (id, sn, vx, vl) => `vec4 nrm_${id}(vec3 tc) {
  vec3 n;
  ${sn ? `n = textureLod(${sn}, tc, 0.0).xyz * 2.0 - vec3(1.0);` : `vec3 o = vec3(1.0) / vec3(textureSize(${vl}, 0));
  n = vec3(${vx}(tc - vec3(o.x, 0.0, 0.0)).r - ${vx}(tc + vec3(o.x, 0.0, 0.0)).r, ${vx}(tc - vec3(0.0, o.y, 0.0)).r - ${vx}(tc + vec3(0.0, o.y, 0.0)).r, ${vx}(tc - vec3(0.0, 0.0, o.z)).r - ${vx}(tc + vec3(0.0, 0.0, o.z)).r);`}
  float l = length(n);
  if (l == 0.0) return vec4(0.0);
  return vec4(normalize((worldView * vec4(n / dims, 0.0)).xyz), l);
}`;
  const HSV = `
vec3 rgb2hsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b)); float d = mx - mn; float h = 0.0;
  if (d != 0.0) {
    if (mx == c.r) h = (c.g - c.b) / d; else if (mx == c.g) h = 2.0 + (c.b - c.r) / d; else h = 4.0 + (c.r - c.g) / d;
    h = h * 1.0471975511965976; if (h < 0.0) h = h + 6.283185307179586;
  }
  float s = 0.0; if (mx != 0.0) s = d / mx;
  return vec3(h, s, mx);
}
vec3 hsv2rgb(vec3 c) {
  float s = clamp(c.y, 0.0, 1.0); float v = clamp(c.z, 0.0, 1.0);
  if (s == 0.0) return vec3(v);
  float h6 = c.x * 3.0 / 3.141592653589793; float i = floor(h6); float f = h6 - i;
  float p = v * (1.0 - s); float q = v * (1.0 - s * f); float t = v * (1.0 - s * (1.0 - f));
  int k = int(i) % 6;
  if (k == 0) return vec3(v, t, p); if (k == 1) return vec3(q, v, p); if (k == 2) return vec3(p, v, t); if (k == 3) return vec3(p, q, v); if (k == 4) return vec3(t, p, v);
  return vec3(v, p, q);
}
vec3 mixHsv(vec3 a, vec3 b, float t) {
  float ha = a.x; float hb = b.x;
  if (a.y == 0.0) ha = hb; if (b.y == 0.0) hb = ha;
  float range = abs(hb - ha); float h = 0.0;
  if (range <= 3.141592653589793) h = mix(ha, hb, t);
  else {
    float st = (6.283185307179586 - range) * t;
    if (ha < hb) h = ha - st; else h = ha + st;
    if (h < 0.0) h = h + 6.283185307179586; if (h > 6.283185307179586) h = h - 6.283185307179586;
  }
  return vec3(h, mix(a.y, b.y, t), mix(a.z, b.z, t));
}`;
  const snTex = (n, C) => (n.f.surfaceNormals && V.is3D(n.f.surfaceNormals) ? C.tex('sn_' + C.id, n.f.surfaceNormals, 3) : null);

  /* ---- the styles (the arithmetic of the Babylon files, X_ITE 16.6.0) ------------------------------------------------------------------------------------------------------------------------- */
  S.OpacityMapVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null;
    const tf = n.f.transferFunction; let b = 'return defMap(c);';
    if (tf && (tf.type === 'PixelTexture' || V.is3D(tf))) { const d3 = V.is3D(tf), s = C.tex('tf_' + C.id, tf, d3 ? 3 : 2); b = `return textureLod(${s}, c.${d3 ? 'rgb' : 'rg'}, 0.0);`; }
    return { name: 'st_' + C.id, fn: `vec4 st_${C.id}(vec4 c, vec3 tc, vec3 vp) { ${b} }` };
  };
  S.BoundaryEnhancementVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null; const id = C.id;
    return { name: 'st_' + id, fn: `vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  float o = 1.0 / float(textureSize(${C.vol}, 0).z);
  float f = abs(${C.vox}(tc).r - ${C.vox}(tc + vec3(0.0, 0.0, o)).r);
  return vec4(c.rgb, c.a * (${fl(n.f.retainedOpacity)} + ${fl(n.f.boundaryOpacity)} * pow(f, ${fl(n.f.opacityFactor)})));
}` };
  };
  S.EdgeEnhancementVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null; const id = C.id, sn = snTex(n, C);
    return { name: 'st_' + id, fn: `${C.normalFn(id, sn)}
vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  vec4 sn = nrm_${id}(tc);
  if (sn.w == 0.0) return vec4(0.0);
  float ang = abs(dot(sn.xyz, normalize(vp)));
  if (ang >= cos(${fl(n.f.gradientThreshold)})) return c;
  return vec4(mix(${g3(n.f.edgeColor || [0, 0, 0])}, c.rgb, ang), c.a);
}` };
  };
  S.SilhouetteEnhancementVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null; const id = C.id, sn = snTex(n, C);
    return { name: 'st_' + id, fn: `${C.normalFn(id, sn)}
vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  vec4 sn = nrm_${id}(tc);
  if (sn.w == 0.0) return vec4(0.0);
  return vec4(c.rgb, c.a * (${fl(n.f.silhouetteRetainedOpacity)} + ${fl(n.f.silhouetteBoundaryOpacity)} * pow(max(1.0 - abs(dot(sn.xyz, normalize(vp))), 0.0), ${fl(n.f.silhouetteSharpness)})));
}` };
  };
  S.ToneMappedVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null; const id = C.id, sn = snTex(n, C);
    return { name: 'st_' + id, lights: true, fn: `${C.normalFn(id, sn)}
vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  vec4 sn = nrm_${id}(tc);
  if (sn.w == 0.0) return vec4(0.0);
  vec3 tone = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 Lt = lightAt(i);
    if (Lt.w < 0.5) continue;
    vec3 L = Lt.xyz;
    if (Lt.w > 1.5) L = normalize(Lt.xyz - vp);
    tone = tone + mix(${g3(n.f.warmColor || [1, 1, 0])}, ${g3(n.f.coolColor || [0, 0, 1])}, dot(L, sn.xyz) * 0.5 + 0.5);
  }
  return vec4(tone, c.a);
}` };
  };
  S.CartoonVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null; const id = C.id, sn = snTex(n, C), steps = Math.max(1, Math.min(64, n.f.colorSteps | 0));
    return { name: 'st_' + id, lib: [HSV], fn: `${C.normalFn(id, sn)}
vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  vec4 sn = nrm_${id}(tc);
  if (sn.w == 0.0) return vec4(0.0);
  float steps = ${fl(steps)};
  float stp = 1.5707963267948966 / steps;
  float cosT = min(dot(sn.xyz, normalize(vp)), 1.0);
  if (cosT < 0.0) return vec4(0.0);
  float mk = 1.0;
  if (steps > 1.0) mk = steps / (steps - 1.0);
  float k = min(floor(acos(cosT) / stp) * mk, steps);
  return vec4(hsv2rgb(mixHsv(rgb2hsv(${g3(n.f.orthogonalColor || [1, 1, 1])}), rgb2hsv(${g3(n.f.parallelColor || [0, 0, 0])}), cos(k * stp))), c.a);
}` };
  };
  S.ShadedVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null;
    const id = C.id, m = n.f.material, mf = m ? m.f : null, g = (k, d) => (mf && mf[k] !== undefined ? mf[k] : d);
    const df = g('diffuseColor', [0.8, 0.8, 0.8]), sp = g('specularColor', [0, 0, 0]), em = g('emissiveColor', [0, 0, 0]), shin = g('shininess', 0.2), tr = g('transparency', 0), sn = snTex(n, C);
    let b;
    if (!n.f.lighting) b = m ? `return vec4(${g3(df)}, c0.a * ${fl(1 - tr)});` : 'return c0;';
    else b = `vec4 col = vec4(0.0);
  vec3 df = ${m ? g3(df) : 'c0.rgb'};
  col.a = ${m ? `c0.a * ${fl(1 - tr)}` : 'c0.a'};
  vec3 N = sn.xyz;
  vec3 V = normalize(-vp);
  for (int i = 0; i < 4; i++) {
    vec4 Lt = lightAt(i);
    if (Lt.w < 0.5) continue;
    vec3 L = Lt.xyz;
    if (Lt.w > 1.5) L = normalize(Lt.xyz - vp);
    vec3 H = normalize(L + V);
    vec3 dif = df * max(dot(N, L), 0.0);
    float sf = 1.0;
    ${shin > 0 ? `sf = pow(max(dot(N, H), 0.0), ${fl(shin * 128)});` : ''}
    col = vec4(col.rgb + lightCol(i) * (dif + ${g3(sp)} * sf) + ${g3(em)}, col.a);
  }
  return col;`;
    return { name: 'st_' + id, lights: !!n.f.lighting, fn: `${C.normalFn(id, sn)}\nvec4 st_${id}(vec4 c0, vec3 tc, vec3 vp) {\n  vec4 sn = nrm_${id}(tc);\n  if (sn.w == 0.0) return vec4(0.0);\n  ${b}\n}` };
  };
  S.ProjectionVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null;
    const id = C.id, type = n.f.type === 'MIN' || n.f.type === 'AVERAGE' ? n.f.type : 'MAX', thr = fl(n.f.intensityThreshold);
    const body = type === 'AVERAGE' ? 'p = p + inten;' : `if (inten < ${thr}) continue;
    if (first && ${thr} > 0.0) break;
    ${type === 'MAX' ? 'if (inten <= p) { first = true; continue; }' : 'if (inten >= p) { first = true; continue; }'}
    p = inten;`;
    return { name: 'st_' + id, fn: `vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  float p = ${type === 'MIN' ? '1.0' : '0.0'};
  vec3 nn = viewTex;
  vec3 start = tc + nn * dot(tc - vec3(0.5), nn) - nn * 0.7071067811865476;
  vec3 stp = nn * (1.4142135623730951 / 16.0);
  bool first = false;
  for (int i = 0; i < 16; i++) {
    vec3 ray = start + stp * float(i);
    if (any(greaterThan(abs(ray - vec3(0.5)), vec3(0.5)))) continue;
    float inten = vox(ray).r;
    ${body}
  }
  ${type === 'AVERAGE' ? 'p = p / 16.0;' : ''}
  return vec4(vec3(p), c.a);
}` };
  };
  S.BlendedVolumeStyle = (n, C) => {
    const f = n.f; if (f.enabled === false || !f.voxels || !V.is3D(f.voxels)) return null;
    const id = C.id, v2 = C.tex('v2_' + id, f.voxels, 3), vx = 'vox_' + id;
    const nest = f.renderStyle && V.composable.has(f.renderStyle.type) && S[f.renderStyle.type] ? C.sub(f.renderStyle, { vox: vx, vol: v2 }) : null;
    const wf = (k) => {
      const fn = String(f['weightFunction' + k]), con = fl(f['weightConstant' + k]);
      switch (fn) {
        case 'ALPHA0': case 'ALPHA1': return 'c.a';
        case 'ONE_MINUS_ALPHA0': case 'ONE_MINUS_ALPHA1': return '(1.0 - c.a)';
        case 'ALPHA2': return 'b.a';
        case 'ONE_MINUS_ALPHA2': return '(1.0 - b.a)';
        case 'TABLE': { const t = f['weightTransferFunction' + k]; if (t && t.type === 'PixelTexture') { const s = C.tex('wt' + k + '_' + id, t, 2); return `textureLod(${s}, vec2(c.a, b.a), 0.0).r`; } return con; }
        default: return con;
      }
    };
    return { name: 'st_' + id, lights: !!(nest && nest.lights), lib: [`vec4 ${vx}(vec3 tc) { return textureLod(${v2}, tc, 0.0); }`], fn: `vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  vec4 b = defMap(${vx}(tc));
  ${nest ? `b = ${nest.name}(b, tc, vp);` : ''}
  float w1 = ${wf(1)};
  float w2 = ${wf(2)};
  return clamp(c * w1 + b * w2, vec4(0.0), vec4(1.0));
}` };
  };
  S.ComposedVolumeStyle = (n, C) => {
    if (n.f.enabled === false) return null;
    const kids = (Array.isArray(n.f.renderStyle) ? n.f.renderStyle : n.f.renderStyle ? [n.f.renderStyle] : []).map((k) => C.sub(k)).filter(Boolean);
    if (!kids.length) return null; const id = C.id;
    return { name: 'st_' + id, lights: kids.some((k) => k.lights), fn: `vec4 st_${id}(vec4 c, vec3 tc, vec3 vp) {
  vec4 x = c;
${kids.map((k) => `  x = ${k.name}(x, tc, vp);`).join('\n')}
  return x;
}` };
  };

  /* the styles of a volume node: VolumeData has one (SFNode), IsoSurface and Segmented a list; only the composable ones go in a list (ProjectionVolumeStyle is VolumeData only) */
  const styleNodes = (n) => { const r = n.f.renderStyle, ok = n.type === 'VolumeData' ? (s) => S[s.type] : (s) => S[s.type] && V.composable.has(s.type); return (Array.isArray(r) ? r : r ? [r] : []).filter((s) => s && ok(s)); };

  /* ---- the shader: { fs, texs, lights } for a volume node ------------------------------------------------------------------------------------------------------------------------------------ */
  const VS = `out vec3 vL;
void main() { vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const compile = (n) => {
    const texs = [], libs = new Set(), fns = [], seen = new Set(); let lights = false;
    const C = (node, o = {}) => {
      const vx = o.vox || 'vox', vl = o.vol || 'vol';
      return {
        id: V.idOf(node), vox: vx, vol: vl, normalFn: (id, sn) => normalFn(id, sn, vx, vl),
        tex(name, tn, dim) { if (!seen.has(name)) { seen.add(name); texs.push({ name, node: tn, dim }); } return name; },
        sub(child, o2) {
          if (!child || !S[child.type] || !V.composable.has(child.type)) return null;
          const d = S[child.type](child, C(child, o2 || o)); if (!d) return null;
          (d.lib || []).forEach((l) => libs.add(l)); fns.push(d.fn); lights = lights || !!d.lights; return d;
        },
      };
    };
    const descs = styleNodes(n).map((s) => { const d = S[s.type](s, C(s)); if (!d) return null; (d.lib || []).forEach((l) => libs.add(l)); fns.push(d.fn); lights = lights || !!d.lights; return d; });
    const call = (k, col) => (descs[k] ? `${col} = ${descs[k].name}(${col}, tc, vp);` : '');
    const f = n.f, type = n.type; let sample;
    if (type === 'IsoSurfaceVolumeData') {
      const sv = (f.surfaceValues || []).map(Number), tol = Number(f.surfaceTolerance) || 0, gr = f.gradients && V.is3D(f.gradients) ? C(n).tex('grads', f.gradients, 3) : null;
      const gradTest = tol > 0 ? (gr ? `if (length(textureLod(${gr}, tc, 0.0).xyz * 2.0 - vec3(1.0)) < ${fl(tol)}) continue;` : `{ vec3 o = vec3(1.0) / vec3(textureSize(vol, 0));
        vec3 gn = vec3(vox(tc - vec3(o.x, 0.0, 0.0)).r - vox(tc + vec3(o.x, 0.0, 0.0)).r, vox(tc - vec3(0.0, o.y, 0.0)).r - vox(tc + vec3(0.0, o.y, 0.0)).r, vox(tc - vec3(0.0, 0.0, o.z)).r - vox(tc + vec3(0.0, 0.0, o.z)).r);
        if (length(gn) < ${fl(tol)}) continue; }`) : '';
      let chain = ''; const nS = descs.length;
      for (let i = sv.length - 1; i >= 0; i--) chain += `${i === sv.length - 1 ? '' : ' else '}if (inten > ${fl(sv[i])}) { c = vec4(${fl(sv[i])}, ${fl(sv[i])}, ${fl(sv[i])}, 1.0); ${nS ? call(Math.min(i, nS - 1), 'c') : ''} }`;
      sample = `${gradTest}\n    float inten = c.r;\n    ${sv.length ? chain + ' else { continue; }' : 'if (inten > 2.0) { c = vec4(0.0); } else { continue; }'}`;
    } else if (type === 'SegmentedVolumeData') {
      const ids = f.segmentIdentifiers && V.is3D(f.segmentIdentifiers) ? C(n).tex('segids', f.segmentIdentifiers, 3) : null, en = f.segmentEnabled || [], nS = descs.length;
      let sw = '';
      for (let i = 0; i < nS; i++) sw += `${i ? ' else ' : ''}if (seg == ${i}) { ${i < en.length && en[i] === false ? 'skip = true;' : call(i, 'c')} }`;
      sample = `int seg = 0; bool skip = false;\n    ${ids ? `seg = int(round(textureLod(${ids}, tc, 0.0).r * 255.0));` : ''}\n    ${sw}\n    if (skip) continue;`;
    } else sample = call(0, 'c');
    const decl = texs.map((t) => `uniform ${t.dim === 3 ? 'sampler3D' : 'sampler2D'} ${t.name};`).join('\n');
    const fs = `precision highp float; precision highp sampler3D; precision highp sampler2D;
uniform sampler3D vol;
${decl}
uniform vec3 camLocal; uniform vec3 fwdLocal; uniform vec3 viewTex; uniform vec3 dims; uniform mat4 worldView; uniform float inside;
${lights ? LIGHTS : ''}
in vec3 vL; out vec4 outColor;
vec4 vox(vec3 tc) { return textureLod(vol, tc, 0.0); }
vec4 defMap(vec4 c) { float g = clamp(c.r * 256.0 - 0.5, 0.0, 255.0) / 255.0; return vec4(g, g, g, g); }
${[...libs].join('\n')}
${fns.join('\n')}
void main() {
  vec3 ro = camLocal;
  vec3 rd = normalize(vL - ro);
  if (inside > 0.5) { if (gl_FrontFacing) discard; } else { if (!gl_FrontFacing) discard; }
  vec3 hf = dims * 0.5;
  vec3 rdS = mix(rd, vec3(1e-9), lessThan(abs(rd), vec3(1e-9)));
  vec3 iv = vec3(1.0) / rdS;
  vec3 ta = (-hf - ro) * iv;
  vec3 tb = (hf - ro) * iv;
  vec3 tmn = min(ta, tb);
  vec3 tmx = max(ta, tb);
  float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
  float tfar = min(min(tmx.x, tmx.y), tmx.z);
  if (tn >= tfar) discard;
  float L = length(dims);
  float dl = L / ${fl(V.PLANES - 1)};
  vec3 fw = fwdLocal;
  float cc = dot(ro, fw);
  float cs = max(dot(rd, fw), 1e-4);
  float j = max(ceil((cc + tn * cs + 0.5 * L) / dl - 1e-4), 0.0);
  vec4 acc = vec4(0.0);
  for (int it = 0; it < ${V.PLANES}; it++) {
    if (j > ${fl(V.PLANES - 1)}) break;
    float t = (-0.5 * L + j * dl - cc) / cs;
    j = j + 1.0;
    if (t > tfar) break;
    if (t < tn) continue;
    vec3 p = ro + t * rd;
    vec3 tc = p / dims + vec3(0.5);
    vec3 vp = (worldView * vec4(p, 1.0)).xyz;
    vec4 c = defMap(vox(tc));
    ${sample}
    if (c.a < 1.0 / 255.0) continue;
    acc = vec4(acc.rgb + (1.0 - acc.a) * c.a * c.rgb, acc.a + (1.0 - acc.a) * c.a);
    if (acc.a > 0.998) break;
  }
  if (acc.a <= 0.0) discard;
  outColor = acc;
}`;
    return { fs, texs, lights };
  };
  V.compileGLSL = compile;

  /* ---- textures: voxels (3D) and transfer functions (2D or 3D); a white 1 x 1 x 1 volume stands in while the voxels are missing or not loaded (X_ITE draws that) ------------------------------------------------ */
  const nearestOrLinear = (smooth) => (smooth ? THREE.LinearFilter : THREE.NearestFilter);
  const wrapOf = (node, k) => (node.f[k] ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping);
  const smoothFor = (node, w, h) => !!node.f.textureProperties || Math.max(w, h) >= 16;      // X_ITE: no TextureProperties and max(width, height) < 16 is NEAREST
  const tex3 = (rgba, w, h, d, smooth) => { const t = new THREE.Data3DTexture(rgba, w, h, d); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = nearestOrLinear(smooth); t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true; return t; };
  const tex2 = (rgba, w, h, smooth) => { const t = new THREE.DataTexture(rgba, w, h, THREE.RGBAFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = nearestOrLinear(smooth); t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true; return t; };
  const white3 = () => tex3(new Uint8Array([255, 255, 255, 255]), 1, 1, 1, false), white2 = () => tex2(new Uint8Array([255, 255, 255, 255]), 1, 1, false);
  const sigOf = (node) => (node ? [node.f.image, node.f.url, node.f.texture, node.f.load] : []);
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const give = (r, src, tex) => { const old = src.tex; src.tex = tex; r.mat.uniforms[src.name].value = tex; if (old && old !== tex) setTimeout(() => { try { old.dispose(); } catch (e) { /* gone */ } }, 100); };
  const load = (body, r, src) => {
    const node = src.node, tick = (src.gen = (src.gen || 0) + 1); src.sig = sigOf(node);
    if (!node) { give(r, src, src.dim === 3 ? white3() : white2()); return; }
    if (src.dim === 3) {
      give(r, src, white3());
      BR.vol.data(body, node, (v) => {
        if (src.gen !== tick || r.dead || !v) return;
        const t = tex3(v.rgba, v.w, v.h, v.d, smoothFor(node, v.w, v.h)); t.wrapS = wrapOf(node, 'repeatS'); t.wrapT = wrapOf(node, 'repeatT'); t.wrapR = wrapOf(node, 'repeatR'); give(r, src, t);
      });
    } else {
      const px = node.type === 'PixelTexture' ? BR.tex3.decode(node) : null;       // other 2D pictures: gap (a white texel stands in)
      if (!px) { body.note && body.note('volume transfer function: only a PixelTexture is read as a 2D picture'); give(r, src, white2()); return; }
      const t = tex2(new Uint8Array(px.data), px.w, px.h, smoothFor(node, px.w, px.h));
      t.wrapS = node.f.repeatS === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = node.f.repeatT === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; give(r, src, t);
    }
  };

  /* ---- lights in view space: the headlight (a directional light along the view direction) and up to three more --------------------------------------------------------------------------------------- */
  const lightsOf = (body, cam) => {
    const out = [], v = cam.matrixWorldInverse, p = new THREE.Vector3(), q = new THREE.Vector3();
    if (body.headlight && body.headlight.visible) out.push({ v: [0, 0, 1, 1], c: [1, 1, 1] });
    for (const l of (body.lights || [])) {
      if (!l.parent || l.visible === false || out.length >= 4) continue; const nd = l.userData.node; if (nd && nd.f.on === false) continue;
      const k = l.intensity / Math.PI, c = [l.color.r * k, l.color.g * k, l.color.b * k]; l.getWorldPosition(p);
      if (l.isDirectionalLight) { l.target.getWorldPosition(q); const d = p.clone().sub(q).transformDirection(v); out.push({ v: [d.x, d.y, d.z, 1], c }); }
      else { p.applyMatrix4(v); out.push({ v: [p.x, p.y, p.z, 2], c }); }
    }
    return out;
  };

  /* ---- the node ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
  V.build = (body, n, parent, chain) => {
    const f = n.f, r = { node: n, chain: [n, ...chain], kids: [], vol: true }; body.rec.set(n.id, r);
    const tn = new THREE.Group(); tn.name = 'vol-' + (n.def || n.id); tn.userData.node = n; parent.add(tn); r.tn = tn;
    const dims = (f.dimensions || [1, 1, 1]).map((x) => Math.max(Math.abs(x), 1e-6)), cp = compile(n); r.cp = cp;
    const u = { vol: { value: null }, camLocal: { value: new THREE.Vector3() }, fwdLocal: { value: new THREE.Vector3(0, 0, -1) }, viewTex: { value: new THREE.Vector3(0, 0, 1) }, dims: { value: new THREE.Vector3(...dims) }, worldView: { value: new THREE.Matrix4() }, inside: { value: 0 } };
    for (const t of cp.texs) u[t.name] = { value: null };
    if (cp.lights) for (let i = 0; i < 4; i++) { u['uL' + i] = { value: new THREE.Vector4() }; u['uC' + i] = { value: new THREE.Vector3() }; }
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: cp.fs, uniforms: u, glslVersion: THREE.GLSL3, side: THREE.DoubleSide, transparent: true, depthWrite: false, premultipliedAlpha: true, toneMapped: false });
    r.mat = mat;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(dims[0], dims[1], dims[2]), mat); mesh.frustumCulled = false; tn.add(mesh); r.mesh = mesh;
    if (V.honourVisible && f.visible === false) tn.visible = false;
    const srcs = [{ name: 'vol', node: f.voxels, dim: 3 }, ...cp.texs.map((t) => ({ name: t.name, node: t.node, dim: t.dim }))]; r.srcs = srcs;
    srcs.forEach((s) => load(body, r, s));
    mat.addEventListener('dispose', () => { r.dead = true; for (const s of srcs) { try { s.tex && s.tex.dispose(); } catch (e) { /* gone */ } } });
    const inv = new THREE.Matrix4(), pw = new THREE.Vector3(), fw = new THREE.Vector3();
    mesh.onBeforeRender = (rd, sc, cam) => {
      for (const s of srcs) if (!same(s.sig, sigOf(s.node))) load(body, r, s);
      mesh.updateWorldMatrix(true, false); inv.copy(mesh.matrixWorld).invert();
      pw.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(inv); u.camLocal.value.copy(pw);
      fw.set(0, 0, -1).transformDirection(cam.matrixWorld).transformDirection(inv); u.fwdLocal.value.copy(fw); u.viewTex.value.copy(fw).negate();   // viewTex: the slice normal (towards the viewer) in volume axes, what ProjectionVolumeStyle marches along
      u.inside.value = Math.abs(pw.x) < dims[0] / 2 && Math.abs(pw.y) < dims[1] / 2 && Math.abs(pw.z) < dims[2] / 2 ? 1 : 0;
      u.worldView.value.multiplyMatrices(cam.matrixWorldInverse, mesh.matrixWorld);
      if (cp.lights) {
        const ls = lightsOf(body, cam);
        for (let i = 0; i < 4; i++) { const l = ls[i]; if (l) { u['uL' + i].value.set(...l.v); u['uC' + i].value.set(...l.c); } else { u['uL' + i].value.set(0, 0, 0, 0); u['uC' + i].value.set(0, 0, 0); } }
      }
    };
    return r;
  };
  V.drop = (body, r) => { r.dead = true; try { r.tn.removeFromParent(); r.mesh.geometry.dispose(); r.mat.dispose(); } catch (e) { /* gone with the scene */ } body.rec.delete(r.node.id); };
  V.rebuild = (body, n) => {
    const r = body.rec.get(n.id); if (!r || !r.vol) return;
    const parent = r.tn.parent, chain = r.chain.slice(1); V.drop(body, r);
    const nr = V.build(body, n, parent, chain);
    for (const pr of body.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; }
  };
  for (const t of ['VolumeData', 'IsoSurfaceVolumeData', 'SegmentedVolumeData']) { T3.build[t] = (body, n, parent, chain) => V.build(body, n, parent, chain); T3.changed[t] = (body, n, field) => V.changed(body, n, field); }
  for (const t of Object.keys(S)) T3.changed[t] = (body, n) => V.touch(body, n);
}
