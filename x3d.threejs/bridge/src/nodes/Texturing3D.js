/* Texturing3D for the three.js bridge: PixelTexture3D, ComposedTexture3D, ImageTexture3D on an Appearance, TextureTransform3D, TextureTransformMatrix3D, and the 3D / 4D texture coordinates. The voxels, the file
   readers (DDS, NRRD) and the transform matrix are the shared ones (BR.vol in x3d.webgpu/bridge/src/nodes/ImageTexture3D.js); here the volume is a THREE.Data3DTexture sampled by (s, t, r) / q from the 'uvw'
   attribute of the geometry in a ShaderMaterial: texel times diffuseColor shaded by the headlight and up to four directional or point lights (a spot light acts as a point light), plus emissiveColor, alpha from
   the voxel and the Material's transparency. Same rules as the Babylon body (body-br.js, Volume textures): no texture coordinates = the box of the geometry maps to the volume (longest side s, then t, then r, all
   over the longest side, 19775-1 18.2.2); 2D coordinates read the volume at r = 0; the default filter is FASTEST (nearest), as X_ITE 16.6.0 draws it; no Material = the texel alone. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, V = BR.vol;
  const VS = `in vec4 uvw; out vec3 vN; out vec3 vP; out vec4 vW;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalMatrix * normal; vW = uvw; gl_Position = projectionMatrix * mv; }`;
  const FS = `precision highp float; precision highp sampler3D;
uniform sampler3D vol; uniform mat4 texMat; uniform vec3 diffuse; uniform vec3 emissive; uniform float alpha; uniform float headlight; uniform float head;
uniform vec4 l0; uniform vec4 l1; uniform vec4 l2; uniform vec4 l3; uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
in vec3 vN; in vec3 vP; in vec4 vW; out vec4 outColor;
vec3 lightTerm(vec3 n, vec3 p, vec4 l, vec3 c) { if (l.w < 0.5) return vec3(0.0); vec3 L = l.w < 1.5 ? normalize(l.xyz) : normalize(l.xyz - p); return c * max(dot(n, L), 0.0); }
void main() {
  float q = abs(vW.w) > 1e-6 ? vW.w : 1.0;
  vec3 p = (texMat * vec4(vW.x / q, vW.y / q, vW.z / q, 1.0)).xyz;
  vec4 t = texture(vol, p);
  vec3 n = normalize(vN); vec3 nf = dot(n, -vP) >= 0.0 ? n : -n;   // the side that faces the viewer lights
  vec3 sum = vec3(abs(n.z) * head) + lightTerm(nf, vP, l0, c0) + lightTerm(nf, vP, l1, c1) + lightTerm(nf, vP, l2, c2) + lightTerm(nf, vP, l3, c3);
  vec3 lit = headlight > 0.5 ? sum : vec3(1.0);
  outColor = vec4(t.rgb * diffuse * lit + emissive, t.a * alpha);
}`;
  const mat4 = (a) => new THREE.Matrix4().fromArray(a);   // a row-vector 4 x 4 read column-major is the matrix the shader multiplies: the same layout the Babylon body hands its shader
  const anyVol = (body) => { if (body._volWorld !== body.world) { body._volWorld = body.world; body._volAny = !!body.world && body.world.nodes.some((x) => x.type === 'Appearance' && V.is3D(x.f.texture)); } return body._volAny; };
  const colorsOf = (m) => {
    const f = m ? m.f : null; return { dc: f ? f.diffuseColor || f.baseColor || f.unlitColor || [1, 1, 1] : [1, 1, 1], ec: f && f.emissiveColor && m.type !== 'PhysicalMaterial' ? f.emissiveColor : [0, 0, 0], tr: f ? f.transparency || 0 : 0 };
  };
  const upload = (body, node, e, v) => {
    const old = e.tex, tp = node.f.textureProperties, smooth = !!tp && /NICEST|AVG|LINEAR/i.test(String(tp.f.magnificationFilter || ''));   // 19775-1 18.4: the default filter is FASTEST (nearest)
    const t = new THREE.Data3DTexture(v ? v.rgba : new Uint8Array(4), v ? v.w : 1, v ? v.h : 1, v ? v.d : 1);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter; t.generateMipmaps = false; t.unpackAlignment = 1;
    t.wrapS = node.f.repeatS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapT = node.f.repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapR = node.f.repeatR ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    e.tex = t; e.ready = !!v; e.alpha = !!v && (() => { for (let i = 3; i < v.rgba.length; i += 4) if (v.rgba[i] < 255) return true; return false; })();
    for (const m of e.mats) { m.uniforms.vol.value = t; setBlend(m, e.alpha || m.userData.tr > 0); }
    if (old) setTimeout(() => old.dispose(), 100);
  };
  const setBlend = (m, on) => { m.transparent = on; m.depthWrite = !on; m.needsUpdate = true; };   // an opaque volume writes depth, so the far faces of a box do not paint over the near one
  const entryOf = (body, node, mat) => {
    const key = 'vol:' + node.id; let e = body.texCache.get(key);
    if (!e) { e = { tex: null, mats: new Set(), ready: false }; body.texCache.set(key, e); upload(body, node, e, null); V.data(body, node, (v) => { if (body.texCache.get(key) === e) upload(body, node, e, v); }); }
    e.mats.add(mat); mat.uniforms.vol.value = e.tex; return e;
  };
  V.reload = (body, node) => { const e = body.texCache.get('vol:' + node.id); if (e) V.data(body, node, (v) => upload(body, node, e, v)); };
  V.refreshTransform = (body, n) => { for (const r of body.rec.values()) { const a = r.node && r.node.type === 'Shape' && r.node.f.appearance; if (a && a.f.textureTransform === n && r.meshes) for (const m of r.meshes) if (m.material.userData.vol3) m.material.uniforms.texMat.value = mat4(V.matrix(n)); } };
  const lightsOf = (body, cam) => {
    const out = [], v = cam.matrixWorldInverse, p = new THREE.Vector3(), q = new THREE.Vector3();
    for (const l of (body.lights || [])) {
      if (!l.parent || l.visible === false || out.length >= 4) continue; const n = l.userData.node; if (n && n.f.on === false) continue;
      const k = l.intensity / Math.PI, c = [l.color.r * k, l.color.g * k, l.color.b * k]; l.getWorldPosition(p);
      if (l.isDirectionalLight) { l.target.getWorldPosition(q); const d = p.clone().sub(q).transformDirection(v); out.push({ v: [d.x, d.y, d.z, 1], c }); }
      else { p.applyMatrix4(v); out.push({ v: [p.x, p.y, p.z, 2], c }); }
    }
    return out;
  };
  T3.vol3 = {
    /* the (s, t, r, q) of every vertex of a geometry that has none of its own: three.js primitives have a uv, a geometry with a TextureCoordinate3D or 4D, or with none, is read in augment */
    geometry(body, g, geo) {
      if (geo.attributes.uvw || !anyVol(body)) return geo; const uv = geo.attributes.uv; if (!uv) return geo;
      const a = new Float32Array(uv.count * 4); for (let i = 0; i < uv.count; i++) a.set([uv.getX(i), uv.getY(i), 0, 1], i * 4); geo.setAttribute('uvw', new THREE.BufferAttribute(a, 4)); return geo;
    },
    augment(body, g, d) {
      if (!d || !d.pos || d.uvw) return d; const f = (g.__src || g).f || {}, T = f.texCoord, tcw = BR.tcWidth(T);
      if (!anyVol(body) && tcw === 2) return d;
      const n = d.pos.length / 3, uvw = new Float32Array(n * 4), uv = new Float32Array(n * 2);
      if (tcw > 2) {
        const P = T.f.point, src = g.__src || g; let ix = null;
        if (src.type === 'IndexedFaceSet') { ix = []; const ci = f.coordIndex, TI = f.texCoordIndex && f.texCoordIndex.length ? f.texCoordIndex : ci; let face = []; const fl = () => { if (face.length >= 3) ix.push(...face); face = []; }; for (let i = 0; i < ci.length; i++) { if (ci[i] < 0) fl(); else face.push(TI[i]); } fl(); }
        for (let i = 0; i < n; i++) { const k = (ix ? ix[i] : i) * tcw; uv[i * 2] = P[k]; uv[i * 2 + 1] = P[k + 1]; uvw.set([P[k], P[k + 1], P[k + 2], tcw > 3 ? P[k + 3] : 1], i * 4); }
      } else if (!T && !(d.uv && ['Box', 'Sphere', 'Cylinder', 'Cone'].includes((g.__src || g).type)) && !(g.__src && g.__src.type !== 'IndexedFaceSet' && BR.specs.get(g.__src.type))) {   // no texture coordinates: the box of the geometry
        const lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30]; for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], d.pos[i * 3 + k]); hi[k] = Math.max(hi[k], d.pos[i * 3 + k]); }
        const size = [0, 1, 2].map((k) => hi[k] - lo[k]), ord = [0, 1, 2].sort((a, b) => size[b] - size[a]), L = size[ord[0]] || 1;
        for (let i = 0; i < n; i++) { const c = [0, 1, 2].map((k) => (d.pos[i * 3 + k] - lo[k]) / L); uv[i * 2] = c[ord[0]]; uv[i * 2 + 1] = c[ord[1]]; uvw.set([c[ord[0]], c[ord[1]], c[ord[2]], 1], i * 4); }
      } else if (d.uv) { for (let i = 0; i < n; i++) uvw.set([d.uv[i * 2], d.uv[i * 2 + 1], 0, 1], i * 4); }
      if (tcw > 2 || !T) d.uv = uv;
      d.uvw = uvw; return d;
    },
    material(body, shape, g, app) {
      const mat = app.f.material && /^(Material|PhysicalMaterial|UnlitMaterial)$/.test(app.f.material.type) ? app.f.material : null, c = colorsOf(mat), tex = app.f.texture;
      const u = { vol: { value: null }, texMat: { value: mat4(V.matrix(app.f.textureTransform)) }, diffuse: { value: new THREE.Vector3(mat ? c.dc[0] : 1, mat ? c.dc[1] : 1, mat ? c.dc[2] : 1) }, emissive: { value: new THREE.Vector3(...c.ec) }, alpha: { value: 1 - c.tr },
        headlight: { value: mat && mat.type !== 'UnlitMaterial' ? 1 : 0 }, head: { value: 0 } };
      for (let i = 0; i < 4; i++) { u['l' + i] = { value: new THREE.Vector4() }; u['c' + i] = { value: new THREE.Vector3() }; }
      const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u, glslVersion: THREE.GLSL3, side: THREE.DoubleSide, toneMapped: false });
      m.userData.vol3 = { shape, mat, tex }; m.userData.tr = c.tr; m.userData.shaded = !!mat && mat.type !== 'UnlitMaterial';
      entryOf(body, tex, m); setBlend(m, c.tr > 0);
      return m;
    },
    /* every frame, before a volume mesh draws: the headlight and the lights, in the view space of the camera that draws */
    before(body, mesh, cam) {
      const m = mesh.material, u = m.uniforms; if (!m.userData.vol3 || !m.userData.shaded) return;
      u.head.value = body.headlight.visible ? 1 : 0; const ls = lightsOf(body, cam);
      for (let i = 0; i < 4; i++) { const l = ls[i]; if (l) { u['l' + i].value.set(...l.v); u['c' + i].value.set(...l.c); } else { u['l' + i].value.set(0, 0, 0, 0); u['c' + i].value.set(0, 0, 0); } }
    },
    changedMaterial(body, node) {
      for (const m of body.meshesOf.get(node.id) || []) { const mt = m.material; if (!mt.userData || !mt.userData.vol3) continue; const c = colorsOf(node), u = mt.uniforms;
        u.diffuse.value.set(c.dc[0], c.dc[1], c.dc[2]); u.emissive.value.set(...c.ec); u.alpha.value = 1 - c.tr; mt.userData.tr = c.tr; const e = body.texCache.get('vol:' + mt.userData.vol3.tex.id); setBlend(mt, (e && e.alpha) || c.tr > 0); }
    },
  };
  for (const t of ['PixelTexture3D', 'ComposedTexture3D', 'ImageTexture3D', 'TextureTransform3D', 'TextureTransformMatrix3D', 'TextureCoordinate4D']) { T3.build[t] = () => null; T3.changed[t] = (body, n, field) => { const sp = BR.specs.get(t); if (sp && sp.changed) sp.changed(body, n, field); }; }
}
