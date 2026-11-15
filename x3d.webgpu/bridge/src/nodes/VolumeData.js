/* VolumeData (VolumeRendering level 1): VolumeData displays a simple non-segmented voxel dataset with a single RenderStyle node.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written.

   This file also holds the shared volume renderer BR.volr that IsoSurfaceVolumeData and SegmentedVolumeData (and every volume style) use. The way it matches X_ITE 16.6.0:
   X_ITE draws 400 view aligned slices (TextureQuality MEDIUM) spaced |dimensions| / 399 apart, back to front with plain source-alpha blending, no opacity correction, and runs a per-sample
   colour function in front of it (a default OpacityMap first, then the style). The bridge marches a ray through a box on exactly those planes (front to back, the same over operator), so a ray
   crosses the same number of samples and the same alpha adds up. The style text is generated WGSL with every field written in as a number, so a changed field makes a new shader (X_ITE does the
   same: any style field change clears its shader cache). */
const V = (BR.volr ||= { styles: {} });
const fl = (x) => { x = Number(x); if (!isFinite(x)) x = 0; const s = String(x); return /[.eE]/.test(s) ? s : s + '.0'; };
V.fl = fl;
V.v3 = (a) => `vec3f(${fl(a[0])}, ${fl(a[1])}, ${fl(a[2])})`;
V.v4 = (a) => `vec4f(${fl(a[0])}, ${fl(a[1])}, ${fl(a[2])}, ${fl(a.length > 3 ? a[3] : 1)})`;
V.idOf = (n) => String(n.id).replace(/\W/g, '_');
V.is3D = (t) => !!t && (t.type === 'PixelTexture3D' || t.type === 'ComposedTexture3D' || t.type === 'ImageTexture3D');
V.PLANES = 400;                                              // TextureQuality MEDIUM, the X_ITE default (LOW 200, HIGH 600)
V.frontIsOutside = true;                                     // frontFacing is true for the faces that look at a camera outside the box
V.honourVisible = true;

/* ---- shared WGSL ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const LIGHTS = `
uniform l0: vec4f;
uniform l1: vec4f;
uniform l2: vec4f;
uniform l3: vec4f;
uniform c0: vec3f;
uniform c1: vec3f;
uniform c2: vec3f;
uniform c3: vec3f;
fn lightAt(i: u32) -> vec4f { if (i == 0u) { return uniforms.l0; } if (i == 1u) { return uniforms.l1; } if (i == 2u) { return uniforms.l2; } return uniforms.l3; }
fn lightCol(i: u32) -> vec3f { if (i == 0u) { return uniforms.c0; } if (i == 1u) { return uniforms.c1; } if (i == 2u) { return uniforms.c2; } return uniforms.c3; }
`;
V.normalFn = (id, sn, vx = 'vox', vl = 'vol') => `fn nrm_${id}(tc: vec3f) -> vec4f {
  var n: vec3f;
  ${sn ? `n = textureSampleLevel(${sn}, ${sn}Sampler, tc, 0.0).xyz * 2.0 - vec3f(1.0);` : `let o = vec3f(1.0) / vec3f(textureDimensions(${vl}, 0));
  n = vec3f(${vx}(tc - vec3f(o.x, 0.0, 0.0)).r - ${vx}(tc + vec3f(o.x, 0.0, 0.0)).r, ${vx}(tc - vec3f(0.0, o.y, 0.0)).r - ${vx}(tc + vec3f(0.0, o.y, 0.0)).r, ${vx}(tc - vec3f(0.0, 0.0, o.z)).r - ${vx}(tc + vec3f(0.0, 0.0, o.z)).r);`}
  let l = length(n);
  if (l == 0.0) { return vec4f(0.0); }
  return vec4f(normalize((uniforms.worldView * vec4f(n / uniforms.dims, 0.0)).xyz), l);
}`;
const VS = `
attribute position: vec3f;
uniform worldViewProjection: mat4x4f;
varying vL: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.position = uniforms.worldViewProjection * vec4f(vertexInputs.position, 1.0);
  vertexOutputs.vL = vertexInputs.position;
}`;

/* the styles of a volume node: VolumeData has one (SFNode), IsoSurfaceVolumeData and SegmentedVolumeData a list (MFNode); a node whose type has no generator is ignored (X3DCast failing) */
V.composable = new Set(['OpacityMapVolumeStyle', 'BoundaryEnhancementVolumeStyle', 'CartoonVolumeStyle', 'EdgeEnhancementVolumeStyle', 'ShadedVolumeStyle', 'SilhouetteEnhancementVolumeStyle', 'ToneMappedVolumeStyle', 'BlendedVolumeStyle', 'ComposedVolumeStyle']);   // X3DComposableVolumeRenderStyleNode: the only styles a list (Isosurface, Segmented), a Composed and a Blended take; ProjectionVolumeStyle is a plain X3DVolumeRenderStyleNode, so only VolumeData.renderStyle takes it
V.styleNodes = (n) => { const r = n.f.renderStyle, ok = n.type === 'VolumeData' ? (s) => V.styles[s.type] : (s) => V.styles[s.type] && V.composable.has(s.type); return (Array.isArray(r) ? r : r ? [r] : []).filter((s) => s && ok(s)); };

/* the shader: { fs, texs, lights } for a volume node. The node type picks the part that decides what a sample becomes. */
V.compile = (n) => {
  const texs = [], libs = new Set(), fns = [], seen = new Set();
  let lights = false;
  /* the context a style generator gets. vox / vol name the voxel sampler and its texture (a Blended style hands its nested style the second volume), sub(node) makes the descriptor of a child style
     (Composed, Blended) with the same collections, so its function, libraries and lights land in the one shader. */
  const C = (node, o = {}) => {
    const vx = o.vox || 'vox', vl = o.vol || 'vol';
    return {
      id: V.idOf(node), fl, v3: V.v3, v4: V.v4, vox: vx, vol: vl, normalFn: (id, sn) => V.normalFn(id, sn, vx, vl),
      tex(name, tn, dim) { if (!seen.has(name)) { seen.add(name); texs.push({ name, node: tn, dim }); } return name; },
      sub(child) {
        if (!child || !V.styles[child.type] || !V.composable.has(child.type)) return null;
        const d = V.styles[child.type](child, C(child, o)); if (!d) return null;
        (d.lib || []).forEach((l) => libs.add(l)); fns.push(d.fn); lights = lights || !!d.lights; return d;
      },
    };
  };
  const descs = V.styleNodes(n).map((s) => { const d = V.styles[s.type](s, C(s)); if (!d) return null; (d.lib || []).forEach((l) => libs.add(l)); fns.push(d.fn); lights = lights || !!d.lights; return d; });
  const call = (k, col) => (descs[k] ? `${col} = ${descs[k].name}(${col}, tc, vp);` : '');
  const f = n.f, type = n.type; let sample;
  if (type === 'IsoSurfaceVolumeData') {
    const sv = (f.surfaceValues || []).map(Number), tol = Number(f.surfaceTolerance) || 0, gr = f.gradients && V.is3D(f.gradients) ? C(n).tex('grads', f.gradients, 3) : null;
    const gradTest = tol > 0 ? (gr ? `if (length(textureSampleLevel(${gr}, ${gr}Sampler, tc, 0.0).xyz * 2.0 - vec3f(1.0)) < ${fl(tol)}) { continue; }` : `{ let o = vec3f(1.0) / vec3f(textureDimensions(vol, 0));
        let gn = vec3f(vox(tc - vec3f(o.x, 0.0, 0.0)).r - vox(tc + vec3f(o.x, 0.0, 0.0)).r, vox(tc - vec3f(0.0, o.y, 0.0)).r - vox(tc + vec3f(0.0, o.y, 0.0)).r, vox(tc - vec3f(0.0, 0.0, o.z)).r - vox(tc + vec3f(0.0, 0.0, o.z)).r);
        if (length(gn) < ${fl(tol)}) { continue; } }`) : '';
    let chain = ''; const nS = descs.length;
    for (let i = sv.length - 1; i >= 0; i--) chain += `${i === sv.length - 1 ? '' : ' else '}if (inten > ${fl(sv[i])}) { c = vec4f(${fl(sv[i])}, ${fl(sv[i])}, ${fl(sv[i])}, 1.0); ${nS ? call(Math.min(i, nS - 1), 'c') : ''} }`;
    sample = `${gradTest}\n    let inten = c.r;\n    ${sv.length ? chain + ' else { continue; }' : 'if (inten > 2.0) { c = vec4f(0.0); } else { continue; }'}`;
  } else if (type === 'SegmentedVolumeData') {
    const ids = f.segmentIdentifiers && V.is3D(f.segmentIdentifiers) ? C(n).tex('segids', f.segmentIdentifiers, 3) : null, en = f.segmentEnabled || [], nS = descs.length;
    let sw = '';
    if (nS) { sw = `switch (seg) {\n`; for (let i = 0; i < nS; i++) sw += `      case ${i}: { ${i < en.length && en[i] === false ? 'skip = true;' : call(i, 'c')} }\n`; sw += '      default: {}\n    }'; }
    sample = `var seg = 0; var skip = false;\n    ${ids ? `seg = i32(round(textureSampleLevel(${ids}, ${ids}Sampler, tc, 0.0).r * 255.0));` : ''}\n    ${sw}\n    if (skip) { continue; }`;
  } else sample = call(0, 'c');
  const decl = texs.map((t) => (t.dim === 3 ? `var ${t.name}Sampler: sampler;\nvar ${t.name}: texture_3d<f32>;` : `var ${t.name}Sampler: sampler;\nvar ${t.name}: texture_2d<f32>;`)).join('\n');
  const fo = V.frontIsOutside ? 'true' : 'false';
  const fs = `
var volSampler: sampler;
var vol: texture_3d<f32>;
${decl}
uniform camLocal: vec3f;
uniform fwdLocal: vec3f;
uniform viewTex: vec3f;
uniform dims: vec3f;
uniform worldView: mat4x4f;
uniform inside: f32;
${lights ? LIGHTS : ''}
varying vL: vec3f;
fn vox(tc: vec3f) -> vec4f { return textureSampleLevel(vol, volSampler, tc, 0.0); }
fn defMap(c: vec4f) -> vec4f { let g = clamp(c.r * 256.0 - 0.5, 0.0, 255.0) / 255.0; return vec4f(g, g, g, g); }
${[...libs].join('\n')}
${fns.join('\n')}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let ro = uniforms.camLocal;
  let dims = uniforms.dims;
  let rd = normalize(fragmentInputs.vL - ro);
  if (uniforms.inside > 0.5) { if (fragmentInputs.frontFacing == ${fo}) { discard; } } else { if (fragmentInputs.frontFacing != ${fo}) { discard; } }
  let hf = dims * 0.5;
  let rdS = select(rd, vec3f(1e-9), abs(rd) < vec3f(1e-9));
  let iv = vec3f(1.0) / rdS;
  let ta = (-hf - ro) * iv;
  let tb = (hf - ro) * iv;
  let tmn = min(ta, tb);
  let tmx = max(ta, tb);
  let tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
  let tfar = min(min(tmx.x, tmx.y), tmx.z);
  if (tn >= tfar) { discard; }
  let L = length(dims);
  let dl = L / ${fl(V.PLANES - 1)};
  let fw = uniforms.fwdLocal;
  let c0 = dot(ro, fw);
  let cs = max(dot(rd, fw), 1e-4);
  var j = max(ceil((c0 + tn * cs + 0.5 * L) / dl - 1e-4), 0.0);
  var acc = vec4f(0.0);
  loop {
    if (j > ${fl(V.PLANES - 1)}) { break; }
    let t = (-0.5 * L + j * dl - c0) / cs;
    j = j + 1.0;
    if (t > tfar) { break; }
    if (t < tn) { continue; }
    let p = ro + t * rd;
    let tc = p / dims + vec3f(0.5);
    let vp = (uniforms.worldView * vec4f(p, 1.0)).xyz;
    var c = defMap(vox(tc));
    ${sample}
    if (c.a < 1.0 / 255.0) { continue; }
    acc = vec4f(acc.rgb + (1.0 - acc.a) * c.a * c.rgb, acc.a + (1.0 - acc.a) * c.a);
    if (acc.a > 0.998) { break; }
  }
  if (acc.a <= 0.0) { discard; }
  fragmentOutputs.color = acc;
}`;
  return { fs, texs, lights };
};

/* ---- textures: voxels (3D) and transfer functions (2D or 3D); X_ITE draws a white 1 x 1 x 1 volume when the voxels are missing or not loaded ------------------------------------------------- */
const white3 = (body) => new BABYLON.RawTexture3D(new Uint8Array([255, 255, 255, 255]), 1, 1, 1, BABYLON.Constants.TEXTUREFORMAT_RGBA, body.scene, false, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);
const smoothFor = (node, w, h) => !!node.f.textureProperties || Math.max(w, h) >= 16;      // X_ITE: no TextureProperties and max(width, height) < 16 is NEAREST
const wrapOf = (node, k) => (node.f[k] ? BABYLON.Texture.WRAP_ADDRESSMODE : BABYLON.Texture.CLAMP_ADDRESSMODE);
const sigOf = (node) => (node ? [node.f.image, node.f.url, node.f.texture, node.f.load] : []);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const give = (body, r, src, tex) => { const old = src.tex; src.tex = tex; r.mat.setTexture(src.name, tex); if (old && old !== tex) setTimeout(() => { try { old.dispose(); } catch (e) { /* gone */ } }, 100); };
const load = (body, r, src) => {
  const node = src.node, tick = (src.gen = (src.gen || 0) + 1); src.sig = sigOf(node);
  if (!node) { give(body, r, src, src.dim === 3 ? white3(body) : new BABYLON.RawTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, BABYLON.Constants.TEXTUREFORMAT_RGBA, body.scene, false, false, BABYLON.Texture.NEAREST_SAMPLINGMODE)); return; }
  if (src.dim === 3) {
    give(body, r, src, white3(body));
    BR.vol.data(body, node, (v) => {
      if (src.gen !== tick || r.dead) return;
      if (!v) return;
      const t = new BABYLON.RawTexture3D(v.rgba, v.w, v.h, v.d, BABYLON.Constants.TEXTUREFORMAT_RGBA, body.scene, false, false, smoothFor(node, v.w, v.h) ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.NEAREST_SAMPLINGMODE);
      t.wrapU = wrapOf(node, 'repeatS'); t.wrapV = wrapOf(node, 'repeatT'); t.wrapR = wrapOf(node, 'repeatR'); give(body, r, src, t);
    });
  } else {
    const px = node.type === 'PixelTexture' ? BR.tex3.decode(node) : null;       // other 2D pictures: gap (a white texel stands in)
    if (!px) { body.note && body.note('volume transfer function: only a PixelTexture is read as a 2D picture'); give(body, r, src, new BABYLON.RawTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, BABYLON.Constants.TEXTUREFORMAT_RGBA, body.scene, false, false, BABYLON.Texture.NEAREST_SAMPLINGMODE)); return; }
    const t = new BABYLON.RawTexture(new Uint8Array(px.data), px.w, px.h, BABYLON.Constants.TEXTUREFORMAT_RGBA, body.scene, false, false, smoothFor(node, px.w, px.h) ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.NEAREST_SAMPLINGMODE);
    t.wrapU = node.f.repeatS === false ? BABYLON.Texture.CLAMP_ADDRESSMODE : BABYLON.Texture.WRAP_ADDRESSMODE; t.wrapV = node.f.repeatT === false ? BABYLON.Texture.CLAMP_ADDRESSMODE : BABYLON.Texture.WRAP_ADDRESSMODE;
    give(body, r, src, t);
  }
};

/* ---- the node -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
V.build = (body, n, parent, chain) => {
  const f = n.f, r = { node: n, chain: [n, ...chain], kids: [], vol: true }; body.rec.set(n.id, r);
  const tn = new BABYLON.TransformNode('vol-' + (n.def || n.id), body.scene); tn.parent = parent; r.tn = tn;
  const dims = (f.dimensions || [1, 1, 1]).map((x) => Math.max(Math.abs(x), 1e-6)), cp = V.compile(n); r.cp = cp;
  const key = 'vol' + (V.nextKey = (V.nextKey || 0) + 1), SS = BABYLON.ShaderStore.ShadersStoreWGSL;
  SS[key + 'VertexShader'] = VS; SS[key + 'FragmentShader'] = cp.fs;
  const mat = new BABYLON.ShaderMaterial('vol-' + n.id, body.scene, { vertex: key, fragment: key },
    { attributes: ['position'], uniforms: ['worldViewProjection', 'worldView', 'camLocal', 'fwdLocal', 'viewTex', 'dims', 'inside', 'l0', 'l1', 'l2', 'l3', 'c0', 'c1', 'c2', 'c3'], samplers: ['vol', ...cp.texs.map((t) => t.name)], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: true });
  mat.alphaMode = BABYLON.Constants.ALPHA_PREMULTIPLIED; mat.backFaceCulling = false; mat.disableDepthWrite = true; mat.needAlphaBlending = () => true; r.mat = mat;
  const mesh = BABYLON.MeshBuilder.CreateBox('volbox-' + n.id, { width: dims[0], height: dims[1], depth: dims[2] }, body.scene);
  mesh.parent = tn; mesh.material = mat; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; r.mesh = mesh;
  mat.setVector3('dims', new BABYLON.Vector3(dims[0], dims[1], dims[2]));
  if (V.honourVisible && f.visible === false) tn.setEnabled(false);
  const srcs = [{ name: 'vol', node: f.voxels, dim: 3 }, ...cp.texs.map((t) => ({ name: t.name, node: t.node, dim: t.dim }))]; r.srcs = srcs;
  srcs.forEach((s) => load(body, r, s));
  const sc = body.scene, lc = [0, 1, 2, 3].map(() => new BABYLON.Vector4(0, 0, 0, 0)), cc = [0, 1, 2, 3].map(() => new BABYLON.Vector3(0, 0, 0));
  const obs = sc.onBeforeRenderObservable.add(() => {
    const c = sc.activeCamera; if (!c || mesh.isDisposed()) return;
    for (const s of srcs) if (!same(s.sig, sigOf(s.node))) load(body, r, s);
    const iw = mesh.getWorldMatrix().clone().invert(), iv = c.getViewMatrix().clone().invert();
    const pw = c.globalPosition || c.position, cl = BABYLON.Vector3.TransformCoordinates(pw, iw), fwdW = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 0, -1), iv), fl2 = BABYLON.Vector3.TransformNormal(fwdW, iw).normalize();
    mat.setVector3('camLocal', cl); mat.setVector3('fwdLocal', fl2); mat.setVector3('viewTex', fl2.scale(-1));   // viewTex: the slice normal (towards the viewer) in volume axes, what X_ITE's ProjectionVolumeStyle marches along
    mat.setFloat('inside', Math.abs(cl.x) < dims[0] / 2 && Math.abs(cl.y) < dims[1] / 2 && Math.abs(cl.z) < dims[2] / 2 ? 1 : 0);
    if (cp.lights) {
      const V4 = c.getViewMatrix(), ni = body.world && body.world.nodes.find((x) => x.type === 'NavigationInfo'), list = [];
      if (!ni || ni.f.headlight !== false) list.push({ v: [0, 0, 1, 1], col: [1, 1, 1] });      // the headlight: a directional light along the view direction (L points at the viewer)
      for (const l of (body._x3dLights || []).filter((x) => x.isEnabled())) {
        if (list.length >= 4) break; const k = l.intensity, col = [l.diffuse.r * k, l.diffuse.g * k, l.diffuse.b * k];
        if (l.getClassName() === 'DirectionalLight') { const d = BABYLON.Vector3.TransformNormal(l.getShadowDirection().scale(-1), V4).normalize(); list.push({ v: [d.x, d.y, d.z, 1], col }); }
        else { const p = BABYLON.Vector3.TransformCoordinates(l.getAbsolutePosition(), V4); list.push({ v: [p.x, p.y, p.z, 2], col }); }
      }
      for (let i = 0; i < 4; i++) { const it = list[i]; if (it) { lc[i].set(it.v[0], it.v[1], it.v[2], it.v[3]); cc[i].set(it.col[0], it.col[1], it.col[2]); } else { lc[i].set(0, 0, 0, 0); cc[i].set(0, 0, 0); } mat.setVector4('l' + i, lc[i]); mat.setVector3('c' + i, cc[i]); }
    }
  });
  mesh.onDisposeObservable.add(() => { r.dead = true; sc.onBeforeRenderObservable.remove(obs); });
  return r;
};
V.drop = (body, r) => { r.dead = true; try { r.mesh.dispose(false, false); r.mat.dispose(true, true); r.tn.dispose(); } catch (e) { /* gone with the scene */ } for (const s of r.srcs || []) { try { s.tex && s.tex.dispose(); } catch (e) { /* gone */ } } };
V.rebuild = (body, n) => {
  const r = body.rec.get(n.id); if (!r || !r.vol) return;
  const parent = r.tn.parent, chain = r.chain.slice(1); V.drop(body, r);
  const nr = V.build(body, n, parent, chain);
  for (const pr of body.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; }
};
/* a style or a texture below a volume changed: every volume that has it in its chain draws again with a new shader */
V.touch = (body, node) => {
  for (const r of [...body.rec.values()]) {
    if (!r.vol) continue; const f = r.node.f;
    const used = [].concat(f.renderStyle || [], f.voxels || [], f.gradients || [], f.segmentIdentifiers || []);
    const deep = (x, d = 0) => x === node || (d < 8 && x && x.f && Object.values(x.f).some((v) => (Array.isArray(v) ? v : [v]).some((y) => y && typeof y === 'object' && y.f && deep(y, d + 1))));   // a texture under a Blended under a Composed is four levels down
    if (used.some(deep)) V.rebuild(body, r.node);
  }
};
V.changed = (body, n, field) => { if (field !== 'metadata' && field !== 'bboxCenter' && field !== 'bboxSize' && field !== 'bboxDisplay') V.rebuild(body, n); };

BR.node('VolumeData', {
  component: 'VolumeRendering', level: 1,
  container: 'children',
  defs: {
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    dimensions: ['SFVec3f', IO, [1, 1, 1]],
    metadata: ['SFNode', IO, null],
    renderStyle: ['SFNode', IO, null],
    visible: ['SFBool', IO, true],
    voxels: ['SFNode', IO, null],
  },
  build(body, n, parent, chain) { return BR.volr.build(body, n, parent, chain); },
  changed(body, n, field) { BR.volr.changed(body, n, field); },
});
