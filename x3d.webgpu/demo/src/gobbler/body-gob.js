/* Gobbler 3 additions to the Babylon body (concatenated after brain/body.js and brain/body-cam.js, same bundle scope).
   Nothing in brain/ is edited: methods are wrapped or added here.
     - ComposedShaders found in GOB_BY_HASH draw through their WGSL port; a miss falls back to the Material and says so (loom law 40)
     - PointSet becomes one camera-facing quad per point (WebGPU has no point sprites); IndexedFaceSet ribbons and facets keep per-corner attributes,
       including 3D texture coordinates and RGBA colours
     - ParticleSystem (SPRITE) with a VolumeEmitter: a CPU simulation drawn as one dynamic quad mesh
     - the first Viewpoint is bound at load (as X_ITE does) and a bind fires bindTime so the ROUTEs from it run */

const GOB_PICKABLE = new Set(['facet']);        // the TouchSensor sits on the head: facets pick, ribbons (zero-area quads), points and the sky do not

/* a PointSet whose shader has no port is drawn as small plain dots, and the page says so */
gobRegister('plainpoint', {
  key: 'none', kind: 'points', attrs: ['position', 'color', 'corner'], uniforms: {},
  notes: 'fallback for a PointSet whose ComposedShader has no WGSL port: 3 px dots in the point colour',
  vs: `
attribute position: vec3f;
attribute color: vec4f;
attribute corner: vec2f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform viewport: vec4f;
varying vColor: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  var cp = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  let s = 3.0 * uniforms.viewport.w / 640.0;
  cp = vec4f(cp.xy + vertexInputs.corner * (s / uniforms.viewport.zw) * cp.w, cp.z, cp.w);
  vertexOutputs.vColor = vertexInputs.color.rgb;
  vertexOutputs.position = cp;
}`,
  fs: `
varying vColor: vec3f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs { fragmentOutputs.color = vec4f(fragmentInputs.vColor, 1.0); }`,
});

/* an unlit Shape whose faces carry RGBA colours (the flywheel discs): colour * the UnlitMaterial emissive, alpha from the colour and the material transparency */
gobRegister('vcolor', {
  key: 'none', kind: 'mesh', attrs: ['position', 'color'], uniforms: { tint: 'vec3f', opacity: 'f32' },
  notes: 'fallback and built-in for an IndexedFaceSet with ColorRGBA and no ComposedShader',
  vs: `
attribute position: vec3f;
attribute color: vec4f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vColor: vec4f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.vColor = vertexInputs.color;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position, 1.0);
}`,
  fs: `
uniform tint: vec3f;
uniform opacity: f32;
varying vColor: vec4f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs { fragmentOutputs.color = vec4f(fragmentInputs.vColor.rgb * uniforms.tint, fragmentInputs.vColor.a * uniforms.opacity); }`,
});

const EMBER_VS = `
attribute position: vec3f;
attribute color: vec4f;
attribute uv: vec2f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vColor: vec4f;
varying vUV: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.vColor = vertexInputs.color;
  vertexOutputs.vUV = vertexInputs.uv;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position, 1.0);
}`;
const EMBER_FS = `
var tex0Sampler: sampler;
var tex0: texture_2d<f32>;
varying vColor: vec4f;
varying vUV: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let t = textureSample(tex0, tex0Sampler, fragmentInputs.vUV);
  fragmentOutputs.color = vec4f(fragmentInputs.vColor.rgb * t.rgb, fragmentInputs.vColor.a * t.a);
}`;

function gobRand(seedRef) { // small deterministic generator: the embers look the same every run
  let s = seedRef.s = (Math.imul(seedRef.s, 1664525) + 1013904223) >>> 0; return s / 4294967296;
}

const _gobBuild = Body.prototype.build, _gobMaterialsFor = Body.prototype.materialsFor, _gobMakeMesh = Body.prototype.makeMesh,
  _gobClear = Body.prototype.clearWorld, _gobSetWorld = Body.prototype.setWorld, _gobFrame = Body.prototype.frame, _gobBind = Body.prototype.bindViewpoint, _gobChanged = Body.prototype.changed;

Object.assign(Body.prototype, {
  build(n, parent, chain) {
    if (n && n.type === 'ParticleSystem') return this.buildEmbers(n, parent, chain);
    // event nodes live in the reader; PointLights only reach the fallback Materials (the ported programs carry their own studio), so they are not a gap
    if (n && (n.type === 'BooleanFilter' || n.type === 'BooleanSequencer' || n.type === 'PointLight')) return null;
    return _gobBuild.call(this, n, parent, chain);
  },
  clearWorld() { this.gobMats = new Set(); for (const e of this.embers || []) { try { e.mesh.dispose(false, true); } catch (x) { /* gone */ } } this.embers = []; return _gobClear.call(this); },
  setWorld(world, baseUrl, resolve) {
    this.gobMats = new Set(); this.embers = [];
    _gobSetWorld.call(this, world, baseUrl, resolve);
    // X_ITE binds the first Viewpoint when a world loads; the bind fires bindTime, which starts the assembly through its ROUTEs
    if (!this.bound && this.viewpoints && this.viewpoints.length) this.bindViewpoint(this.viewpoints[0], true);
  },
  bindViewpoint(vp, on) {
    _gobBind.call(this, vp, on);
    if (on) R.events.emit(vp, 'bindTime', vp.f.bindTime);
  },
  changed(node, field) {
    if (node.type === 'ParticleSystem') return;           // fields are read each frame
    return _gobChanged.call(this, node, field);
  },

  /* ---------------------------------------------------------- shader programs */
  materialsFor(shape, g, app) {
    const cs = app && app.f.shaders.find((s) => s.type === 'ComposedShader');
    if (cs) {
      const key = this.shaderKey(cs), name = GOB_BY_HASH[key];
      if (name) {
        const port = GOB_PORTS[name];
        if (port.kind === 'hidden') return null;
        if (port.kind === 'points' ? g.type === 'PointSet' : (g.type === 'IndexedFaceSet' || g.type === 'Sphere')) {
          return [{ kind: 'gob', name, port, cs, noPick: !GOB_PICKABLE.has(name), deps: [cs, app.f.material].filter(Boolean) }];
        }
        this.note('ComposedShader ' + (cs.def || '') + ' (' + name + ') on <' + g.type + '> is not a combination the port was written for: drawn with its Material');
      }
    }
    if (g.type === 'IndexedFaceSet' && !cs && g.f.color && g.f.color.type === 'ColorRGBA') {
      const mat = app && app.f.material, e = mat && mat.f.emissiveColor ? mat.f.emissiveColor : [1, 1, 1];
      return [{ kind: 'gob', name: 'vcolor', port: GOB_PORTS.vcolor, cs: null, noPick: true, tint: e, opacity: 1 - (mat && mat.f.transparency || 0), deps: [mat].filter(Boolean) }];
    }
    if (g.type === 'PointSet') {
      this.note('PointSet' + (cs ? ' with ComposedShader ' + (cs.def || '') + ' (no WGSL port, hash ' + this.shaderKey(cs) + ')' : '') + ': drawn as plain dots');
      return [{ kind: 'gob', name: 'plainpoint', port: GOB_PORTS.plainpoint, cs: null, noPick: true, deps: [] }];
    }
    return _gobMaterialsFor.call(this, shape, g, app);
  },
  makeMesh(shape, g, spec, passIndex) {
    if (spec.kind === 'gob') return this.makeGobMesh(shape, g, spec, passIndex);
    return _gobMakeMesh.call(this, shape, g, spec, passIndex);
  },
  makeGobMesh(shape, g, spec, passIndex) {
    const port = spec.port, s = this.scene, name = (shape.def || 'gob' + shape.id) + '-' + spec.name + passIndex;
    let mesh;
    if (g.type === 'Sphere') mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: g.f.radius * 2, segments: 48 }, s);
    else {
      const d = port.kind === 'points' ? this.gobPoints(g) : this.gobFaces(g);
      if (!d) return null;
      mesh = new BABYLON.Mesh(name, s);
      const vd = new BABYLON.VertexData(); vd.positions = d.position; vd.indices = d.indices; vd.applyToMesh(mesh, false);   // position first: Babylon drops a custom attribute that comes first
      const SIZE = { normal: 3, color: 4, tc0: 3, corner: 2 };
      for (const a of port.attrs) { if (a === 'position') continue; if (!d[a]) { this.note('port ' + spec.name + ' needs attribute ' + a + ' that <' + g.type + '> does not carry'); continue; } mesh.setVerticesData(a, d[a], false, SIZE[a]); }
    }
    mesh.alwaysSelectAsActiveMesh = true;                  // the vertex shaders move points and ribbon ends far outside the static bounds
    const m = mesh.material = gobMakeMaterial(s, spec.name, port, name + '-mat');
    if (spec.name === 'sky') { m.alphaMode = BABYLON.Engine.ALPHA_DISABLE; m.needAlphaBlending = () => false; m.disableDepthWrite = true; mesh.renderingGroupId = 0; mesh.alphaIndex = 0; }
    else { mesh.renderingGroupId = 1; mesh.alphaIndex = 0; }
    (this.gobMats ||= new Set()).add(m); this._gobVpW = -1;
    if (spec.cs) this.refreshShader(m, spec.cs);
    if (spec.tint) { m.setVector3('tint', new BABYLON.Vector3(spec.tint[0], spec.tint[1], spec.tint[2])); m.setFloat('opacity', spec.opacity); }
    // the scene gives some Shapes a bboxCenter on purpose: X_ITE sorts blended shapes by it, so Babylon's distance sort should see the same centre
    const bc = shape.f.bboxCenter, bs = shape.f.bboxSize;
    if (bs && bs[0] >= 0) { const h = [bs[0] / 2, bs[1] / 2, bs[2] / 2]; mesh.setBoundingInfo(new BABYLON.BoundingInfo(new BABYLON.Vector3(bc[0] - h[0], bc[1] - h[1], bc[2] - h[2]), new BABYLON.Vector3(bc[0] + h[0], bc[1] + h[1], bc[2] + h[2]))); }
    return mesh;
  },

  /* IndexedFaceSet to per-corner attributes (positions, normals, RGBA colours, 3D texture coordinates), fan-triangulated */
  gobFaces(g) {
    const f = g.f, ci = f.coordIndex, P = f.coord && f.coord.f.point;
    if (!P || !ci.length) return null;
    const NV = f.normal && f.normal.f.vector, NI = f.normalIndex && f.normalIndex.length ? f.normalIndex : ci, npv = f.normalPerVertex !== false;
    const C = f.color && f.color.f.color, cstride = f.color && f.color.type === 'ColorRGBA' ? 4 : 3, CI = f.colorIndex && f.colorIndex.length ? f.colorIndex : ci, cpv = f.colorPerVertex !== false;
    const TCn = f.texCoord, TC = TCn && TCn.f.point, tstride = TCn && TCn.type === 'TextureCoordinate3D' ? 3 : 2, TI = f.texCoordIndex && f.texCoordIndex.length ? f.texCoordIndex : ci;
    const n = ci.length, pos = [], nrm = [], col = [], tc = [], idx = [];
    const get = (A, i, k) => A[i * k], at = (A, i, k, j) => (A[i * k + j] === undefined ? 0 : A[i * k + j]);
    let face = [], fi = 0;
    const flush = () => {
      if (face.length >= 3) {
        const a = face[0].v, b = face[1].v, c = face[2].v;
        const ux = at(P, b, 3, 0) - at(P, a, 3, 0), uy = at(P, b, 3, 1) - at(P, a, 3, 1), uz = at(P, b, 3, 2) - at(P, a, 3, 2);
        const vx = at(P, c, 3, 0) - at(P, a, 3, 0), vy = at(P, c, 3, 1) - at(P, a, 3, 1), vz = at(P, c, 3, 2) - at(P, a, 3, 2);
        let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
        const base = pos.length / 3;
        for (const c0 of face) {
          pos.push(at(P, c0.v, 3, 0), at(P, c0.v, 3, 1), at(P, c0.v, 3, 2));
          if (NV) { const ni = npv ? NI[c0.k] : (f.normalIndex && f.normalIndex.length ? f.normalIndex[fi] : fi); nrm.push(at(NV, ni, 3, 0), at(NV, ni, 3, 1), at(NV, ni, 3, 2)); }
          else nrm.push(fx, fy, fz);
          if (C) { const cI = cpv ? CI[c0.k] : (f.colorIndex && f.colorIndex.length ? f.colorIndex[fi] : fi); col.push(at(C, cI, cstride, 0), at(C, cI, cstride, 1), at(C, cI, cstride, 2), cstride === 4 ? at(C, cI, cstride, 3) : 1); }
          else col.push(1, 1, 1, 1);
          if (TC) { const t = TI[c0.k]; tc.push(at(TC, t, tstride, 0), at(TC, t, tstride, 1), tstride === 3 ? at(TC, t, tstride, 2) : 0); }
          else tc.push(0, 0, 0);
        }
        for (let i = 1; i + 1 < face.length; i++) idx.push(base + i + 1, base, base + i);   // same winding; WebGPU's flat provoking vertex is the first, GL's the last, so the last corner leads
      }
      face = []; fi++;
    };
    for (let k = 0; k < n; k++) { if (ci[k] < 0) flush(); else face.push({ v: ci[k], k }); }
    if (face.length) flush();
    return { position: Float32Array.from(pos), normal: Float32Array.from(nrm), color: Float32Array.from(col), tc0: Float32Array.from(tc), indices: Uint32Array.from(idx) };
  },
  /* PointSet to four vertices per point, each with the point position and RGBA colour and a corner in {-1,1}^2 */
  gobPoints(g) {
    const f = g.f, P = f.coord && f.coord.f.point; if (!P || !P.length) return null;
    const np = Math.floor(P.length / 3), C = f.color && f.color.f.color, cs = f.color && f.color.type === 'ColorRGBA' ? 4 : 3;
    const pos = new Float32Array(np * 12), col = new Float32Array(np * 16), cor = new Float32Array(np * 8), idx = new Uint32Array(np * 6);
    const K = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < np; i++) {
      for (let c = 0; c < 4; c++) {
        const o = i * 4 + c;
        pos[o * 3] = P[i * 3]; pos[o * 3 + 1] = P[i * 3 + 1]; pos[o * 3 + 2] = P[i * 3 + 2];
        col[o * 4] = C ? C[i * cs] : 1; col[o * 4 + 1] = C ? C[i * cs + 1] : 1; col[o * 4 + 2] = C ? C[i * cs + 2] : 1; col[o * 4 + 3] = C && cs === 4 ? C[i * cs + 3] : 1;
        cor[o * 2] = K[c * 2]; cor[o * 2 + 1] = K[c * 2 + 1];
      }
      const b = i * 4; idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
    }
    return { position: pos, color: col, corner: cor, indices: idx };
  },

  /* ---------------------------------------------------------------- embers */
  buildEmbers(n, parent, chain) {
    const f = n.f, s = this.scene, r = { node: n, tn: null, kids: [], chain: [n, ...chain] };
    this.rec.set(n.id, r);
    const max = Math.max(1, Math.min(20000, f.maxParticles | 0));
    const px = f.appearance && f.appearance.f.texture;           // PixelTexture: width height components then one 0xIIAA... value per pixel
    let tex = null;
    if (px && px.type === 'PixelTexture' && px.f.image.length > 3) {
      const [w, h, comp] = px.f.image, data = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        const v = px.f.image[3 + i] >>> 0; let I = 255, A = 255;
        if (comp === 1) I = v & 255; else if (comp === 2) { I = (v >> 8) & 255; A = v & 255; }
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = I; data[i * 4 + 3] = comp === 2 || comp === 4 ? A : 255;
      }
      tex = BABYLON.RawTexture.CreateRGBATexture(data, w, h, s, false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
      tex.wrapU = tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE; tex.hasAlpha = true;
    }
    const mesh = new BABYLON.Mesh('embers-' + (n.def || n.id), s);
    const vd = new BABYLON.VertexData();
    vd.positions = new Float32Array(max * 12); vd.indices = (() => { const a = new Uint32Array(max * 6); for (let i = 0; i < max; i++) a.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); return a; })();
    vd.applyToMesh(mesh, true);
    mesh.setVerticesData('color', new Float32Array(max * 16), true, 4);
    const uv = new Float32Array(max * 8); for (let i = 0; i < max; i++) uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    mesh.setVerticesData('uv', uv, false, 2);
    mesh.alwaysSelectAsActiveMesh = true; mesh.isPickable = false; mesh.renderingGroupId = 1; mesh.alphaIndex = 0;
    BABYLON.ShaderStore.ShadersStoreWGSL['gob-embersVertexShader'] = EMBER_VS; BABYLON.ShaderStore.ShadersStoreWGSL['gob-embersFragmentShader'] = EMBER_FS;
    const m = new BABYLON.ShaderMaterial('embers-mat', s, { vertex: 'gob-embers', fragment: 'gob-embers' },
      { attributes: ['position', 'color', 'uv'], uniforms: ['worldView', 'projection'], samplers: ['tex0'], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: true });
    m.alphaMode = BABYLON.Engine.ALPHA_COMBINE; m.backFaceCulling = false; m.disableDepthWrite = true;
    if (tex) m.setTexture('tex0', tex);
    mesh.material = m; mesh.parent = parent;
    r.tn = parent;
    // the emitter: random points on the triangles of the VolumeEmitter's own coordinates
    const em = f.emitter, tris = []; let area = 0;
    if (em && em.type === 'VolumeEmitter' && em.f.coord && em.f.coordIndex.length) {
      const P = em.f.coord.f.point, ci = em.f.coordIndex; let face = [];
      const flush = () => { for (let i = 1; i + 1 < face.length; i++) { const a = face[0], b = face[i], c = face[i + 1];
        const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
        const ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); area += ar; tris.push({ a, b, c, cum: area }); } face = []; };
      for (const k of ci) { if (k < 0) flush(); else face.push(k); } if (face.length) flush();
    } else this.note('ParticleSystem ' + (n.def || '') + ': only VolumeEmitter is built; no particles drawn');
    const st = { node: n, mesh, max, tris, area, P: em && em.f.coord ? em.f.coord.f.point : null, seed: { s: 12345 }, alive: new Array(max).fill(null).map(() => ({ age: 1, life: 0, p: [0, 0, 0], v: [0, 0, 0], a: 0 })), acc: 0, last: 0 };
    (this.embers ||= []).push(st);
    return r;
  },
  stepEmbers(now) {
    for (const e of this.embers || []) {
      const f = e.node.f, mesh = e.mesh; if (mesh.isDisposed()) continue;
      const dt = e.last ? Math.min(this.opts.maxDt || 0.25, Math.max(0, now - e.last)) : 0; e.last = now;
      const on = f.enabled !== false, emitter = f.emitter, life = Math.max(0.05, f.particleLifetime), lv = f.lifetimeVariation;
      if (on && f.createParticles && e.tris.length && emitter) {
        e.acc += dt * e.max / life;
        const dir = emitter.f.direction, dl = Math.hypot(dir[0], dir[1], dir[2]) || 1, sp = emitter.f.speed, vr = emitter.f.variation;
        while (e.acc >= 1) {
          e.acc -= 1;
          const q = e.alive.find((x) => x.age >= x.life); if (!q) break;
          const pick = gobRand(e.seed) * e.area; let t = e.tris.find((x) => x.cum >= pick) || e.tris[e.tris.length - 1];
          let u = gobRand(e.seed), v = gobRand(e.seed); if (u + v > 1) { u = 1 - u; v = 1 - v; }
          const P = e.P, A = t.a * 3, B = t.b * 3, Cc = t.c * 3;
          q.p = [0, 1, 2].map((k) => P[A + k] + u * (P[B + k] - P[A + k]) + v * (P[Cc + k] - P[A + k]));
          const k2 = sp * (1 + vr * (gobRand(e.seed) * 2 - 1));
          q.v = [dir[0] / dl * k2, dir[1] / dl * k2, dir[2] / dl * k2];
          q.age = 0; q.life = life * (1 + lv * (gobRand(e.seed) * 2 - 1));
        }
      }
      const cam = this.scene.activeCamera; if (!cam) continue;
      const W = mesh.parent ? mesh.parent.computeWorldMatrix(true) : BABYLON.Matrix.Identity(), inv = W.clone().invert();
      const right = BABYLON.Vector3.TransformNormal(cam.getDirection(BABYLON.Vector3.Right()), inv).normalize(), up = BABYLON.Vector3.TransformNormal(cam.getDirection(BABYLON.Vector3.Up()), inv).normalize();
      const sz = f.particleSize, hw = sz[0] / 2, hh = sz[1] / 2;
      const key = f.colorKey, ramp = f.color && f.color.f.color, rs = f.color && f.color.type === 'ColorRGBA' ? 4 : 3;
      const pos = new Float32Array(e.max * 12), col = new Float32Array(e.max * 16);
      for (let i = 0; i < e.max; i++) {
        const q = e.alive[i]; if (q.age >= q.life) continue;
        q.age += dt; if (q.age >= q.life || !on) { q.age = q.life; continue; }
        for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
        const a = q.age / q.life; let c = [1, 1, 1, 1];
        if (ramp && key.length) {
          let j = 0; while (j < key.length - 1 && a > key[j + 1]) j++; const j2 = Math.min(j + 1, key.length - 1), span = key[j2] - key[j], s = span > 0 ? Math.min(1, Math.max(0, (a - key[j]) / span)) : 0;
          c = [0, 1, 2, 3].map((k) => { const x0 = ramp[j * rs + k] ?? 1, x1 = ramp[j2 * rs + k] ?? 1; return k === 3 && rs === 3 ? 1 : x0 + (x1 - x0) * s; });
        }
        const o = i * 12, oc = i * 16, p = q.p;
        const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let k = 0; k < 4; k++) {
          pos[o + k * 3] = p[0] + (right.x * cs[k][0] * hw + up.x * cs[k][1] * hh); pos[o + k * 3 + 1] = p[1] + (right.y * cs[k][0] * hw + up.y * cs[k][1] * hh); pos[o + k * 3 + 2] = p[2] + (right.z * cs[k][0] * hw + up.z * cs[k][1] * hh);
          col[oc + k * 4] = c[0]; col[oc + k * 4 + 1] = c[1]; col[oc + k * 4 + 2] = c[2]; col[oc + k * 4 + 3] = c[3];
        }
      }
      mesh.updateVerticesData('position', pos); mesh.updateVerticesData('color', col);
    }
  },

  frame() {
    const now = (performance.timeOrigin + performance.now()) / 1000;
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    if (this._gobVpW !== w || this._gobVpH !== h) { this._gobVpW = w; this._gobVpH = h; for (const m of this.gobMats || []) { try { m.setVector4('viewport', new BABYLON.Vector4(0, 0, w, h)); } catch (e) { /* disposed */ } } }
    this.stepEmbers(now);
    return _gobFrame.call(this);
  },
});
