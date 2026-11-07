/* Babylon WebGPU body for the X3D reader: draws what the reader holds, runs the event loop, owns the camera and the pointer sensors.
   Pinned Babylon build is loaded by the page (see build-brain.py); this file only needs the global BABYLON. */

const B_UNIFORM_SCALE_NOTE = 'shaders read x3d_NormalMatrix as the upper 3x3 of the model-view matrix: exact for uniform scale (every Transform in these scenes is).';

class Body {
  constructor(canvas, opts) {
    this.canvas = canvas; this.opts = opts || {};
    this.rec = new Map();            // raw node id -> { tn, kids, meshes, ... }
    this.meshesOf = new Map();       // raw node id (material, shader, texture, geometry...) -> [mesh]
    this.texCache = new Map(); this.geoCache = new Map();
    this.sensors = new Map();        // raw TouchSensor id -> { node, group }
    this.notes = new Set(); this.frameTimes = [];
    this.pose = { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: 0.7854 };
    this.tr = null; this.bound = null; this.vpStack = [];
    this.look = { wired: false };
    this.stats = { frames: 0 };
  }

  async init() {
    const gpu = navigator.gpu && (await navigator.gpu.requestAdapter().catch(() => null));
    if (!gpu) throw new Error('WebGPU is not available in this browser, or the adapter was refused.');
    const e = this.engine = new BABYLON.WebGPUEngine(this.canvas, { antialias: true, adaptToDeviceRatio: true, powerPreference: 'high-performance', stencil: false });
    await e.initAsync();
    this.adapterInfo = gpu.info ? { vendor: gpu.info.vendor, architecture: gpu.info.architecture, description: gpu.info.description } : {};
    const s = this.scene = new BABYLON.Scene(e);
    s.useRightHandedSystem = true;
    s.clearColor = new BABYLON.Color4(0.003, 0.005, 0.012, 1);
    s.skipPointerMovePicking = true; s.autoClear = true;
    const ic = s.imageProcessingConfiguration;
    this.setTone(this.opts.tone === undefined ? 'neutral' : this.opts.tone);
    ic.exposure = this.opts.exposure || 1; ic.contrast = 1;
    const c = this.cam = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, 0, 10), s);
    c.minZ = 0.5; c.maxZ = 4000; c.inputs.clear();
    this.lights = [];
    this.setupInput();
    new ResizeObserver(() => { e.resize(); this.applyCamera(); }).observe(this.canvas);
    e.runRenderLoop(() => this.frame());
    return this;
  }

  /* tone mapping reaches the PBR and Standard materials only (their shaders apply it); the ported ComposedShaders write their values as authored, as X_ITE's do */
  setTone(kind) {
    const ic = this.scene.imageProcessingConfiguration, C = BABYLON.ImageProcessingConfiguration;
    ic.toneMappingEnabled = kind && kind !== 'none';
    if (kind === 'neutral') ic.toneMappingType = C.TONEMAPPING_KHR_PBR_NEUTRAL; else if (kind === 'aces') ic.toneMappingType = C.TONEMAPPING_ACES; else if (kind === 'standard') ic.toneMappingType = C.TONEMAPPING_STANDARD;
    this.tone = kind;
  }

  /* ----------------------------------------------------------------- world */
  setWorld(world, baseUrl, resolve) {
    this.clearWorld();
    this.world = world; this.baseUrl = baseUrl; this.resolve = resolve || ((u) => u);
    this.root = new BABYLON.TransformNode('x3d-root', this.scene);
    for (const n of world.children) this.build(n, this.root, []);
    for (const n of world.nodes) if (n.type === 'Viewpoint' && !n._seen) { /* vp nodes are built through build() */ }
    this.buildLights();
    this.applyBackground();
    this.applyClip();
  }
  clearWorld() {
    if (!this.root) return;
    this.scene.meshes.slice().forEach((m) => m.dispose(false, false));
    this.scene.transformNodes.slice().forEach((t) => t.dispose());
    this.scene.materials.slice().forEach((m) => m.dispose(true, true));
    this.scene.lights.slice().forEach((l) => l.dispose());
    this.scene.geometries.slice().forEach((g) => g.dispose());
    this.rec.clear(); this.meshesOf.clear(); this.geoCache.clear(); this.sensors.clear(); this.lights = []; this.vpStack = []; this.bound = null;
    if (this.env) { this.env.dispose(); this.env = null; }
    this.root = null;
  }
  note(msg) { if (!this.notes.has(msg)) { this.notes.add(msg); if (this.opts.onNote) this.opts.onNote(msg); } }

  /* dispatcher: Group-like nodes make a TransformNode, Shapes make meshes, the rest set scene state */
  build(n, parent, chain) {
    if (!n) return null;
    switch (n.type) {
      case 'Group': case 'Switch': case 'Transform': case 'Billboard': return this.buildGroup(n, parent, chain);
      case 'Shape': return this.buildShape(n, parent, chain);
      case 'Viewpoint': { const r = { node: n, parent, tn: parent }; this.rec.set(n.id, r); (this.viewpoints ||= []).includes(n) || this.viewpoints.push(n); this.vpParent ||= new Map(); this.vpParent.set(n, parent); return r; }
      case 'TouchSensor': this.sensors.set(n.id, { node: n, group: chain[0] || null, parentTN: parent }); return null;
      case 'ClipPlane': this.clipNodes = (this.clipNodes || []).filter((x) => x !== n).concat(n); this.clipParent = parent; return null;
      case 'DirectionalLight': case 'EnvironmentLight': this.lightNodes = (this.lightNodes || []).filter((x) => x !== n).concat(n); return null;
      case 'Sound': this.soundNode = n; return null;
      case 'NavigationInfo': case 'Background': case 'Fog': case 'WorldInfo': case 'TimeSensor': case 'ScalarInterpolator': case 'PositionInterpolator': case 'OrientationInterpolator': case 'ColorInterpolator': return null; // scene state or event nodes: the reader runs them
      default: this.note('skipped <' + n.type + '>'); return null;
    }
  }
  buildGroup(n, parent, chain) {
    const tn = new BABYLON.TransformNode(n.def || n.type, this.scene);
    tn.parent = parent;
    const r = { node: n, tn, kids: [], chain: [n, ...chain] };
    this.rec.set(n.id, r);
    if (n.type === 'Transform') this.applyTransform(n, tn);
    if (n.type === 'Billboard') (this.billboards ||= []).push(r); // turned toward the eye every frame by updateBillboards (Babylon's own billboard mode points +Z the wrong way in a right-handed scene)
    const host = tn;
    for (const c of n.f.children) { const cr = this.build(c, host, r.chain); r.kids.push(cr); }
    if (n.type === 'Switch') this.applySwitch(n);
    if (n.f.visible === false) tn.setEnabled(false);
    return r;
  }
  applyTransform(n, tn) {
    const f = n.f, T = f.translation, S = f.scale, c = f.center, sr = f.scaleOrientation, rot = f.rotation;
    const simple = !c[0] && !c[1] && !c[2] && !sr[3];
    if (simple) {
      tn.position.set(T[0], T[1], T[2]);
      tn.rotationQuaternion = new BABYLON.Quaternion(...R.quat.fromAxisAngle(rot, rot[3]));
      tn.scaling.set(S[0], S[1], S[2]);
      return;
    }
    // general case: T * C * R * SR * S * -SR * -C as one matrix; a non-uniform scale under SR becomes a shear, which a TransformNode keeps as a matrix
    const M = BABYLON.Matrix;
    const tr = (v) => M.Translation(v[0], v[1], v[2]);
    const rq = (q) => { const m = new M(); new BABYLON.Quaternion(...R.quat.fromAxisAngle(q, q[3])).toRotationMatrix(m); return m; };
    // BABYLON multiplies row-vector style (v * M), so compose in the opposite order
    const parts = [tr([-c[0], -c[1], -c[2]]), rq([sr[0], sr[1], sr[2], -sr[3]]), M.Scaling(S[0], S[1], S[2]), rq(sr), rq(rot), tr(c), tr(T)];
    let out = M.Identity(); for (const p of parts) out = out.multiply(p);
    out.decompose(tn.scaling, tn.rotationQuaternion = new BABYLON.Quaternion(), tn.position);
    this.note('Transform with center or scaleOrientation decomposed to TRS (shear dropped)');
  }
  applySwitch(n) {
    const r = this.rec.get(n.id); if (!r) return;
    r.kids.forEach((k, i) => { const on = i === n.f.whichChoice; if (k && k.tn) k.tn.setEnabled(on); });
  }

  /* ---------------------------------------------------------------- shapes */
  buildShape(n, parent, chain) {
    const f = n.f, g = f.geometry, app = f.appearance;
    const r = { node: n, meshes: [], chain: [n, ...chain] };
    this.rec.set(n.id, r);
    if (!g) return r;
    const tn = new BABYLON.TransformNode('shape-' + (n.def || n.id), this.scene); tn.parent = parent; r.tn = tn;
    const mats = this.materialsFor(n, g, app);
    if (!mats) return r;
    for (const [i, spec] of mats.entries()) {
      const mesh = this.makeMesh(n, g, spec, i);
      if (!mesh) continue;
      mesh.parent = tn; mesh.metadata = { shape: n, chain: r.chain, pick: f.pointerEvents !== false && !spec.noPick };
      mesh.isPickable = mesh.metadata.pick;
      r.meshes.push(mesh);
      const cg = r.chain.find((gr) => gr.f.children && gr.f.children.some((c) => c.type === 'ClipPlane'));
      if (cg) (this.clipMeshes ||= []).push({ mesh, clip: cg.f.children.find((c) => c.type === 'ClipPlane'), group: cg });
      for (const dep of spec.deps || []) { const l = this.meshesOf.get(dep.id) || []; l.push(mesh); this.meshesOf.set(dep.id, l); }
    }
    if (f.visible === false) tn.setEnabled(false);
    return r;
  }

  /* what material (or two, for glass: back faces then front faces) a Shape gets */
  materialsFor(shape, g, app) {
    const mat = app && app.f.material;
    const cs = app && app.f.shaders.find((s) => s.type === 'ComposedShader');
    if (g.type === 'Text') return [{ kind: 'text', mat, deps: [g, mat].filter(Boolean) }];
    if (g.type === 'IndexedLineSet') {
      const lp = app && app.f.lineProperties;
      return [{ kind: 'ribbon', mat, lp, deps: [mat, lp, g].filter(Boolean) }];
    }
    if (cs) {
      const key = this.shaderKey(cs);
      const port = WGSL_BY_HASH[key];
      if (port) return [{ kind: 'glass', port, cs, back: true, deps: [cs] }, { kind: 'glass', port, cs, back: false, deps: [cs] }];
      this.note('ComposedShader ' + (cs.def || '') + ' has no WGSL port (hash ' + key + '): drawn with its Material');
    }
    if (mat && mat.type === 'PhysicalMaterial') return [{ kind: 'pbr', mat, tex: mat.f.baseTexture, deps: [mat, mat.f.baseTexture].filter(Boolean) }];
    if (mat && mat.type === 'Material') return [{ kind: 'phong', mat, deps: [mat] }];
    const tex = app && app.f.texture;
    return [{ kind: 'unlit', tex, deps: [tex].filter(Boolean) }];
  }
  shaderKey(cs) {
    if (cs._key) return cs._key;
    const src = { VERTEX: '', FRAGMENT: '' };
    for (const part of cs.f.parts) if (part.type === 'ShaderPart') src[String(part.f.type || 'VERTEX').toUpperCase()] = shaderSource(part);
    return (cs._key = fnv1a(normSrc(src.VERTEX)) + '-' + fnv1a(normSrc(src.FRAGMENT)));
  }

  /* ------------------------------------------------------------- geometry */
  geometryData(g) {
    const f = g.f, ver = [g, f.coord, f.normal, f.color, f.texCoord].map((x) => (x ? x.version || 0 : -1)).join('.');
    const hit = this.geoCache.get(g.id);
    if (hit && hit.ver === ver) return hit;
    const out = { ver, pos: null, nrm: null, col: null, uv: null, idx: null };
    const P = f.coord && f.coord.f.point;
    if (g.type === 'IndexedTriangleSet') {
      out.pos = P; out.idx = Uint32Array.from(f.index);
      out.nrm = f.normal && f.normal.f.vector.length === P.length ? f.normal.f.vector : null;
      out.col = f.color ? f.color.f.color : null; out.uv = f.texCoord ? f.texCoord.f.point : null;
      if (f.ccw === false) for (let i = 0; i < out.idx.length; i += 3) { const t = out.idx[i + 1]; out.idx[i + 1] = out.idx[i + 2]; out.idx[i + 2] = t; }
    } else if (g.type === 'IndexedFaceSet') {
      // expand per corner (texture coordinates and flat normals differ across a face); fan-triangulate
      const ci = f.coordIndex, pos = [], uv = [], nrm = [], col = [], idx = [];
      const TC = f.texCoord && f.texCoord.f.point, TI = f.texCoordIndex && f.texCoordIndex.length ? f.texCoordIndex : ci;
      const C = f.color && f.color.f.color, CI = f.colorIndex && f.colorIndex.length ? f.colorIndex : ci;
      let face = [];
      const flush = () => {
        if (face.length >= 3) {
          const a = face[0][0], b = face[1][0], c = face[2][0];
          const pa = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], pb = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], pc = [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]];
          const nn = R.v3.norm(R.v3.cross(R.v3.sub(pb, pa), R.v3.sub(pc, pa)));
          const base = pos.length / 3;
          for (const k of face.map((_, i) => i)) {
            const vi = face[k][0]; pos.push(P[vi * 3], P[vi * 3 + 1], P[vi * 3 + 2]); nrm.push(...(f.ccw === false ? nn.map((x) => -x) : nn));
            const ti = face[k][1]; if (TC) uv.push(TC[ti * 2], TC[ti * 2 + 1]);
            const cci = face[k][2]; if (C) col.push(C[cci * 3], C[cci * 3 + 1], C[cci * 3 + 2]);
          }
          for (let i = 1; i + 1 < face.length; i++) { if (f.ccw === false) idx.push(base, base + i + 1, base + i); else idx.push(base, base + i, base + i + 1); }
        }
        face = [];
      };
      for (let i = 0; i < ci.length; i++) { if (ci[i] < 0) flush(); else face.push([ci[i], TI[i], CI[i]]); }
      flush();
      out.pos = Float32Array.from(pos); out.nrm = Float32Array.from(nrm); out.idx = Uint32Array.from(idx);
      out.uv = TC ? Float32Array.from(uv) : null; out.col = C ? Float32Array.from(col) : null;
    }
    this.geoCache.set(g.id, out);
    return out;
  }
  /* geometry nodes of the same raw node share one Babylon.Geometry */
  babylonGeometry(g, wantColor) {
    const d = this.geometryData(g);
    const key = g.id + (wantColor ? 'c' : '');
    const c = this.geoCache.get(key);
    if (c && c.ver === d.ver) return c.geo;
    if (c) c.geo.dispose();
    const vd = new BABYLON.VertexData();
    vd.positions = d.pos; vd.indices = d.idx;
    vd.normals = d.nrm || (() => { const n = new Float32Array(d.pos.length); BABYLON.VertexData.ComputeNormals(d.pos, d.idx, n); return n; })();
    if (d.uv) vd.uvs = d.uv;
    if (d.col || wantColor) {
      const nv = d.pos.length / 3, rgba = new Float32Array(nv * 4);
      for (let i = 0; i < nv; i++) { rgba[i * 4] = d.col ? d.col[i * 3] : 1; rgba[i * 4 + 1] = d.col ? d.col[i * 3 + 1] : 1; rgba[i * 4 + 2] = d.col ? d.col[i * 3 + 2] : 1; rgba[i * 4 + 3] = 1; }
      vd.colors = rgba;
    }
    const geo = new BABYLON.Geometry('geo-' + key, this.scene, undefined, true);
    vd.applyToGeometry(geo, false);
    this.geoCache.set(key, { ver: d.ver, geo });
    return geo;
  }

  makeMesh(shape, g, spec, passIndex) {
    const s = this.scene;
    const name = (shape.def || 'shape') + '-' + spec.kind + passIndex;
    let mesh;
    if (g.type === 'Box') { const z = g.f.size; mesh = BABYLON.MeshBuilder.CreateBox(name, { width: z[0], height: z[1], depth: z[2] }, s); }
    else if (g.type === 'Cylinder') { mesh = BABYLON.MeshBuilder.CreateCylinder(name, { diameter: g.f.radius * 2, height: g.f.height, tessellation: 48 }, s); }
    else if (g.type === 'Sphere') { mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: g.f.radius * 2, segments: 32 }, s); }
    else if (g.type === 'Text') { return this.makeText(shape, g, spec, name); }
    else if (g.type === 'IndexedLineSet') { return this.makeRibbon(shape, g, spec, name); }
    else if (g.type === 'IndexedTriangleSet' || g.type === 'IndexedFaceSet') {
      mesh = new BABYLON.Mesh(name, s);
      this.babylonGeometry(g, spec.kind === 'glass').applyToMesh(mesh);
    } else { this.note('skipped geometry <' + g.type + '>'); return null; }
    mesh.material = this.makeMaterial(shape, g, spec, mesh);
    const m = mesh.material;
    // Babylon's alphaIndex defaults to the largest number, which would draw every sprite after the glass; X_ITE sorts blended shapes by distance, so sprites join the glass passes at 0
    if (spec.kind === 'glass') { mesh.alphaIndex = (spec.back ? 0 : 1) + (spec.port === 'aura' ? 2 : 0); mesh.renderingGroupId = 0; } else mesh.alphaIndex = 0;
    return mesh;
  }

  /* ------------------------------------------------------------- materials */
  tex(texNode) {
    if (!texNode || !texNode.f.url || !texNode.f.url.length) return null;
    const u = texNode.f.url[0];
    const hit = this.texCache.get(texNode.id); if (hit) return hit;
    const url = this.resolve(u, this.baseUrl);
    const t = new BABYLON.Texture(url, this.scene, false, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    t.hasAlpha = true;
    if (texNode.f.repeatS === false) t.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    if (texNode.f.repeatT === false) t.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    this.texCache.set(texNode.id, t);
    return t;
  }
  makeMaterial(shape, g, spec, mesh) {
    const s = this.scene;
    if (spec.kind === 'glass') return this.glassMaterial(spec);
    if (spec.kind === 'pbr') {
      const m = new BABYLON.PBRMaterial('pbr-' + spec.mat.def, s);
      m.backFaceCulling = g.f.solid === true; m.twoSidedLighting = this.opts.twoSided !== false;
      if (this.opts.ccw !== false) m.sideOrientation = BABYLON.Material.CounterClockWiseSideOrientation; // X3D wraps counter-clockwise faces front; this scene is right-handed
      m.albedoTexture = this.tex(spec.tex);
      m.useAlphaFromAlbedoTexture = false;
      m.reflectionTexture = this.env || null;
      m.environmentIntensity = 1;
      this.refreshPBR(m, spec.mat);
      return m;
    }
    if (spec.kind === 'phong') {
      const m = new BABYLON.StandardMaterial('std-' + (spec.mat.def || shape.id), s);
      m.backFaceCulling = false; m.specularColor.set(0, 0, 0);
      this.refreshPhong(m, spec.mat);
      return m;
    }
    const t = this.tex(spec.tex);
    if (!t) { const m0 = new BABYLON.StandardMaterial('plain-' + shape.id, s); m0.disableLighting = true; m0.emissiveColor.set(1, 1, 1); m0.backFaceCulling = false; return m0; }
    BABYLON.ShaderStore.ShadersStoreWGSL['unlitVertexShader'] = VERT_UNLIT; BABYLON.ShaderStore.ShadersStoreWGSL['unlitFragmentShader'] = FRAG_UNLIT;
    const m = new BABYLON.ShaderMaterial('unlit-' + shape.id, s, { vertex: 'unlit', fragment: 'unlit' },
      { attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'opacity'], samplers: ['tex0'], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: true });
    m.setTexture('tex0', t); m.setFloat('opacity', 1);
    m.alphaMode = BABYLON.Engine.ALPHA_COMBINE; m.backFaceCulling = false; m.disableDepthWrite = true;
    return m;
  }
  refreshPBR(m, mat) {
    const f = mat.f;
    m.albedoColor = new BABYLON.Color3(f.baseColor[0], f.baseColor[1], f.baseColor[2]); // PhysicalMaterial colours are linear (glTF model)
    m.metallic = f.metallic; m.roughness = f.roughness;
    m.emissiveColor = new BABYLON.Color3(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.alpha = 1 - f.transparency;
    if (m.alpha < 0.999) { m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; m.disableDepthWrite = true; }
    else { m.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE; m.disableDepthWrite = false; }
  }
  refreshPhong(m, mat) {
    const f = mat.f;
    m.diffuseColor.set(f.diffuseColor[0], f.diffuseColor[1], f.diffuseColor[2]);
    m.emissiveColor.set(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.alpha = 1 - f.transparency;
    if (m.alpha < 0.999) { m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; m.disableDepthWrite = true; }
  }
  glassMaterial(spec) {
    const P = WGSL_PORTS[spec.port], tag = 'port-' + spec.port;
    const sv = tag + 'VertexShader', sf = tag + 'FragmentShader';
    BABYLON.ShaderStore.ShadersStoreWGSL[sv] = P.vs; BABYLON.ShaderStore.ShadersStoreWGSL[sf] = P.fs;
    const m = new BABYLON.ShaderMaterial('glass-' + spec.cs.def + (spec.back ? '-back' : '-front'), this.scene, { vertex: tag, fragment: tag },
      { attributes: P.attrs, uniforms: ['worldView', 'projection', ...P.uniforms], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: true });
    m.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
    m.backFaceCulling = true; m.cullBackFaces = !spec.back;     // pass one draws the back faces (front faces culled), pass two the front faces
    m.disableDepthWrite = true; m.needDepthPrePass = false;
    m.setFloat('passMode', spec.back ? 0 : 1);
    this.refreshShader(m, spec.cs);
    spec.mat = m;
    return m;
  }
  refreshShader(m, cs) {
    for (const [name, def] of Object.entries(cs.fdefs)) {
      if (['language', 'parts', 'activate', 'isSelected', 'isValid'].includes(name)) continue;
      const v = cs.f[name], t = def[0];
      try {
        if (t === 'SFFloat' || t === 'SFTime' || t === 'SFDouble') m.setFloat(name, +v);
        else if (t === 'SFInt32') m.setFloat(name, +v);
        else if (t === 'SFBool') m.setFloat(name, v ? 1 : 0);
        else if (t === 'SFColor' || t === 'SFVec3f') m.setVector3(name, new BABYLON.Vector3(v[0], v[1], v[2]));
      } catch (e) { /* uniform not in this port */ }
    }
  }

  /* ------------------------------------------------------------- wide lines */
  makeRibbon(shape, g, spec, name) {
    const f = g.f, P = f.coord && f.coord.f.point, C = f.color && f.color.f.color, ci = f.coordIndex;
    if (!P) return null;
    // one quad per segment: 4 corners (end 0 / end 1 x side -1 / +1), attribute "other" = the far end
    const pos = [], oth = [], col = [], uv = [], idx = [];
    let line = [];
    const flush = () => {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i], b = line[i + 1], base = pos.length / 3;
        const pa = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], pb = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]];
        const ca = C ? [C[a * 3], C[a * 3 + 1], C[a * 3 + 2]] : [1, 1, 1], cb = C ? [C[b * 3], C[b * 3 + 1], C[b * 3 + 2]] : [1, 1, 1];
        for (const [p, o, c, side] of [[pa, pb, ca, -1], [pa, pb, ca, 1], [pb, pa, cb, -1], [pb, pa, cb, 1]]) { pos.push(...p); oth.push(...o); col.push(...c, 1); uv.push(0, side); }
        idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
      line = [];
    };
    for (let i = 0; i < ci.length; i++) { if (ci[i] < 0) flush(); else line.push(ci[i]); }
    flush();
    const mesh = new BABYLON.Mesh(name, this.scene);
    const vd = new BABYLON.VertexData(); vd.positions = pos; vd.indices = idx; vd.colors = col; vd.uvs = uv;
    vd.applyToMesh(mesh, false);
    mesh.setVerticesData('other', oth, false, 3);
    const tag = 'ribbon';
    BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'VertexShader'] = VERT_RIBBON; BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'FragmentShader'] = FRAG_RIBBON;
    const m = new BABYLON.ShaderMaterial('ribbon-' + shape.id, this.scene, { vertex: tag, fragment: tag },
      { attributes: ['position', 'other', 'color', 'uv'], uniforms: ['worldViewProjection', 'viewport', 'widthPx', 'tint', 'alpha'], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: true });
    m.alphaMode = BABYLON.Engine.ALPHA_COMBINE; m.backFaceCulling = false; m.disableDepthWrite = true;
    mesh.material = m; spec.mat2 = m; mesh.metadata = { ribbon: true };
    mesh.alphaIndex = 5;
    m._hasColor = !!C;
    this.refreshRibbon(m, spec);
    (this.ribbons ||= []).push(m);
    return mesh;
  }
  refreshRibbon(m, spec) {
    const tp = spec.mat ? spec.mat.f.transparency : 0, lw = spec.lp && spec.lp.f.applied ? (spec.lp.f.linewidthScaleFactor || 1) : 1;
    m.setFloat('alpha', 1 - tp); m.setFloat('widthPx', lw); m._lw = lw;
    this.setRibbonTint(m, spec.mat);
  }
  // a line set with no Color node is drawn in the Material's emissiveColor (19775-1 lighting of lines); with a Color node the per-vertex colours are used as they are
  setRibbonTint(m, mat) { const e = !m._hasColor && mat ? mat.f.emissiveColor : [1, 1, 1]; m.setVector3('tint', new BABYLON.Vector3(e[0], e[1], e[2])); }

  /* ------------------------------------------------------------------ text */
  makeText(shape, g, spec, name) {
    const f = g.f, lines = f.string.length ? f.string : [''];
    const fs = f.fontStyle ? f.fontStyle.f : { size: 1, justify: ['BEGIN'], family: ['SERIF'], spacing: 1, style: 'PLAIN' };
    const em = 56, fam = /SANS/i.test(String(fs.family[0])) ? 'Inter, Helvetica, Arial, sans-serif' : /TYPEWRITER/i.test(String(fs.family[0])) ? 'monospace' : 'Georgia, serif';
    const style = /BOLD/.test(fs.style) ? 'bold ' : '';
    const cv = document.createElement('canvas'), cx = cv.getContext('2d');
    cx.font = style + em + 'px ' + fam;
    const widths = lines.map((l) => cx.measureText(l).width), W = Math.max(8, Math.ceil(Math.max(...widths)) + 16), lh = Math.ceil(em * 1.25 * fs.spacing), H = lh * lines.length + 8;
    cv.width = W; cv.height = H;
    const c2 = cv.getContext('2d'); c2.font = style + em + 'px ' + fam; c2.fillStyle = '#fff'; c2.strokeStyle = '#fff'; c2.lineWidth = em * 0.035; c2.lineJoin = 'round'; c2.textBaseline = 'middle'; // a light stroke keeps small labels from fading when the texture is minified
    lines.forEach((l, i) => { const x = (W - widths[i]) / 2, y = 4 + lh * i + lh / 2; c2.strokeText(l, x, y); c2.fillText(l, x, y); });
    const dt = new BABYLON.DynamicTexture('txt-' + name, cv, this.scene, true); dt.hasAlpha = true; dt.anisotropicFilteringLevel = 8; dt.update(true);
    const sc = fs.size / em, w = W * sc, h = H * sc;
    const jm = String(fs.justify[0] || 'BEGIN').toUpperCase(), jm2 = String((fs.justify[1] || 'FIRST')).toUpperCase();
    const x0 = jm === 'MIDDLE' ? -w / 2 : jm === 'END' ? -w : 0, y0 = jm2 === 'MIDDLE' ? -h / 2 : jm2 === 'END' ? 0 : -h;
    const mesh = new BABYLON.Mesh(name, this.scene);
    const vd = new BABYLON.VertexData();
    vd.positions = [x0, y0, 0, x0 + w, y0, 0, x0 + w, y0 + h, 0, x0, y0 + h, 0]; vd.indices = [0, 1, 2, 0, 2, 3]; vd.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    vd.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    vd.applyToMesh(mesh, false);
    const m = new BABYLON.StandardMaterial('text-' + name, this.scene);
    m.disableLighting = true; m.backFaceCulling = false; m.diffuseTexture = dt; m.useAlphaFromDiffuseTexture = true; m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    m.diffuseColor.set(0, 0, 0); m.specularColor.set(0, 0, 0); m.disableDepthWrite = true; // unlit: the X3D emissiveColor is the colour, the glyph texture only shapes it
    const mat = spec.mat; if (mat) { const e = mat.f.emissiveColor; m.emissiveColor.set(e[0], e[1], e[2]); }
    mesh.material = m; mesh.alphaIndex = 6; mesh.metadata = { text: true };
    return mesh;
  }

  /* ------------------------------------------------------------ lights and look */
  buildLights() {
    this.lights.forEach((l) => l.dispose()); this.lights = [];
    for (const n of this.lightNodes || []) {
      if (n.type === 'DirectionalLight') {
        const l = new BABYLON.DirectionalLight(n.def || 'dir', new BABYLON.Vector3(0, -1, 0), this.scene);
        l.node = n; this.lights.push(l); this.refreshLight(l);
      } else if (n.type === 'EnvironmentLight') this.buildEnvironment(n);
    }
  }
  refreshLight(l) {
    const n = l.node, c = n.f.color;
    l.diffuse = new BABYLON.Color3(c[0], c[1], c[2]); l.specular = l.diffuse.clone();
    const d = n.f.direction, fl = this.opts.lightFlip || 'none';
    l.direction = fl === 'neg' ? new BABYLON.Vector3(-d[0], -d[1], -d[2]) : fl === 'z' ? new BABYLON.Vector3(d[0], d[1], -d[2]) : fl === 'x' ? new BABYLON.Vector3(-d[0], d[1], d[2]) : new BABYLON.Vector3(d[0], d[1], d[2]);
    l.intensity = n.f.intensity * (this.opts.lightScale ?? 1); l.setEnabled(n.f.on !== false);
  }
  buildEnvironment(n) {
    const t = n.f.specularTexture; if (!t) return;
    const faces = (this.opts.envOrder || 'right,top,front,left,bottom,back').split(',').map((s) => s + 'Texture'); // +x +y +z -x -y -z as Babylon orders them
    const urls = faces.map((k) => (t.f[k] ? this.resolve(t.f[k].f.url[0], this.baseUrl) : null));
    if (urls.some((u) => !u)) { this.note('EnvironmentLight needs all six faces'); return; }
    const cube = new BABYLON.CubeTexture('', this.scene, null, false, urls, null, (e) => this.note('cube map: ' + e), BABYLON.Constants.TEXTUREFORMAT_RGBA, false, '.png');
    cube.gammaSpace = true;
    const noDiffuse = () => { if (this.opts.envDiffuse === false) { try { cube.sphericalPolynomial = null; cube.irradianceTexture = null; } catch (e) { /* not set */ } } };
    cube.onLoadObservable.addOnce(() => { noDiffuse(); try { const hf = new BABYLON.HDRFiltering(this.engine); hf.prefilter(cube).then(noDiffuse).catch((e) => this.note('prefilter: ' + e)); } catch (e) { this.note('prefilter: ' + e); } });
    this.env = cube; this.envNode = n;
    this.scene.environmentTexture = cube; this.scene.environmentIntensity = n.f.intensity * (this.opts.envScale ?? 1);
  }
  applyBackground() {
    const bg = this.world.nodes.find((x) => x.type === 'Background'); if (!bg) return;
    const c = bg.f.skyColor[0] || [0, 0, 0];
    const last = bg.f.skyColor[bg.f.skyColor.length - 1] || c;
    // the sky is a three-stop vertical gradient the page keeps dark; its horizon colour fills the frame, which is the visible part at EXAMINE framing
    const g = bg.f.groundColor && bg.f.groundColor.length ? bg.f.groundColor[bg.f.groundColor.length - 1] : last;
    this.scene.clearColor = new BABYLON.Color4((last[0] + g[0]) / 2 * 0.6 + c[0] * 0.4, (last[1] + g[1]) / 2 * 0.6 + c[1] * 0.4, (last[2] + g[2]) / 2 * 0.6 + c[2] * 0.4, 1);
  }
  applyClip() {
    const n = (this.clipNodes || [])[0];
    this.clipActive = !!(n && n.f.enabled);
  }

  /* --------------------------------------------------------------- changes */
  changed(node, field) {
    const t = node.type;
    if (t === 'Switch' && field === 'whichChoice') this.applySwitch(node);
    else if (t === 'Transform') { const r = this.rec.get(node.id); if (r && r.tn) this.applyTransform(node, r.tn); }
    else if ((t === 'Group' || t === 'Switch' || t === 'Billboard' || t === 'Transform') && field === 'children') this.rebuildGroup(node);
    else if (t === 'Billboard' && field === 'axisOfRotation') { /* rare */ }
    else if (t === 'ComposedShader') { for (const m of this.meshesOf.get(node.id) || []) if (m.material && m.material.setFloat) this.refreshShader(m.material, node); }
    else if (t === 'PhysicalMaterial') { for (const m of this.meshesOf.get(node.id) || []) if (m.material instanceof BABYLON.PBRMaterial) this.refreshPBR(m.material, node); }
    else if (t === 'Material') { for (const m of this.meshesOf.get(node.id) || []) { if (m.material instanceof BABYLON.StandardMaterial) { if (m.metadata && m.metadata.text) { const e = node.f.emissiveColor; m.material.emissiveColor.set(e[0], e[1], e[2]); } else this.refreshPhong(m.material, node); } else if (m.metadata && m.metadata.ribbon) this.refreshRibbonFromMat(m, node); } }
    else if (t === 'LineProperties') { for (const m of this.meshesOf.get(node.id) || []) this.refreshRibbonFromLp(m, node); }
    else if (t === 'Color' || t === 'Coordinate' || t === 'Normal') this.geometryChanged(node);
    else if (t === 'DirectionalLight') { const l = this.lights.find((x) => x.node === node); if (l) this.refreshLight(l); }
    else if (t === 'EnvironmentLight') { if (field === 'intensity') this.scene.environmentIntensity = node.f.intensity * (this.opts.envScale ?? 1); }
    else if (t === 'Background') this.applyBackground();
    else if (t === 'ClipPlane') this.applyClip();
    else if (t === 'Viewpoint') this.viewpointChanged(node, field);
  }
  refreshRibbonFromMat(mesh, matNode) { mesh.material.setFloat('alpha', 1 - matNode.f.transparency); this.setRibbonTint(mesh.material, matNode); }
  refreshRibbonFromLp(mesh, lp) { const lw = lp.f.applied ? (lp.f.linewidthScaleFactor || 1) : 1; mesh.material.setFloat('widthPx', lw); mesh.material._lw = lw; }
  geometryChanged(n) {
    // Color or Coordinate inside a geometry: refresh every geometry that holds it
    for (const x of this.world.nodes) {
      if ((x.type === 'IndexedTriangleSet' || x.type === 'IndexedFaceSet' || x.type === 'IndexedLineSet') && (x.f.color === n || x.f.coord === n || x.f.normal === n)) {
        this.geoCache.delete(x.id);
        for (const key of [x.id, x.id + 'c']) { const c = this.geoCache.get(key); if (c) { c.geo.dispose(); this.geoCache.delete(key); } }
        for (const r of this.rec.values()) if (r.node && r.node.type === 'Shape' && r.node.f.geometry === x) { if (r.tn) { this.rebuildShapeIn(r); } }
      }
    }
  }
  rebuildShapeIn(r) {
    const shape = r.node, parent = r.tn.parent, enabled = r.tn.isEnabled(false);
    r.meshes.forEach((m) => m.dispose(false, true)); r.tn.dispose();
    const nr = this.buildShape(shape, parent, r.chain.slice(1));
    // keep the parent's record pointing at the new shape record
    for (const pr of this.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; }
    if (nr.tn) nr.tn.setEnabled(enabled);
  }
  rebuildGroup(node) {
    const r = this.rec.get(node.id); if (!r) return;
    for (const k of r.kids) this.disposeRec(k);
    r.kids = [];
    for (const c of node.f.children) r.kids.push(this.build(c, r.tn, r.chain));
    if (node.type === 'Switch') this.applySwitch(node);
  }
  disposeRec(k) {
    if (!k) return;
    if (k.kids) k.kids.forEach((x) => this.disposeRec(x));
    if (k.meshes) k.meshes.forEach((m) => m.dispose(false, true));
    if (k.tn && k.node && k.node.type !== 'Viewpoint') k.tn.dispose();
    if (k.node) this.rec.delete(k.node.id);
  }
  /* page-created nodes (cameras, sensors) enter through MFNode.push: sensors and viewpoints are scene state, groups are drawn */
  adopt(node, parentNode) {
    const pr = parentNode ? this.rec.get(parentNode.id) : null;
    const parentTN = pr ? pr.tn : this.root, chain = pr ? pr.chain : [];
    const cr = this.build(node, parentTN, chain);
    if (pr && pr.kids && cr) pr.kids.push(cr);
    return cr;
  }
}
