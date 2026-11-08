/* The Library of PolyXandria hall on Babylon: what the hall needs that the earlier ports did not.  Loaded after odyssey-ext.js and hall/reader-ext-hl.js, before sai.js.

   The Hall (library_v1_8_extras.x3d) has no shader at all: 88 PhysicalMaterials, 37 UnlitMaterials, 8 directional, 5 spot and 4 point lights, two real suns that cross it on a 299.52 s clock,
   and 187 ROUTEs. It is the first port that stands wholly on X3D 4.0's standard nodes. Six things were missing from the body, each one an X3D rule rather than a taste:
     1. MultiTextureCoordinate and the `...TextureMapping` fields (X3D 4.0): the lunette patches carry two texture-coordinate channels and a material says which map reads which. Babylon has the
        same idea (a second UV set and a per-texture coordinatesIndex), so the mapping is carried as written instead of merged.
     2. PointSet with PointProperties: WebGPU has no point size, so each point is one camera-facing quad whose size follows the node's own attenuation (scale / (a + b d + c d^2), clamped).
     3. BlendMode (X_ITE's extension, used by the glass and the sun patches): (SRC_ALPHA, ONE) is Babylon's ADD, (ONE, ONE) its ONEONE; anything else draws as the default blend and says so.
     4. Geometry animated by CoordinateInterpolator and CoordinateInterpolator2D: the vertex buffers are updated in place (the shapes are not rebuilt), 27 geometries a frame.
     5. Two suns with shadows: a cascaded shadow generator per DirectionalLight that asks for shadows (shadows="true", shadowIntensity 1), switched off while the sun is dark.
     6. ProximitySensor (the sun's glow follows the eye) and Collision (a Group).
   The look layer (HL.on) only ADDS to the file and can be switched to "As authored": bloom for the suns and lamps, a light vignette and grain.  Nothing here asserts a light, a colour or a camera
   the X3D does not carry (Loom law 40). */
(function () {
  const B_ = Body.prototype, Q = new URLSearchParams(location.search);
  const HL = window.__hallLook = {
    on: Q.get('look') !== '0', shadows: Q.get('shadows') !== '0', shadowSize: +(Q.get('sm') || 2048), cascades: +(Q.get('cascades') || 1), bloom: Q.has('bloom') ? +Q.get('bloom') : 0.28, grain: Q.has('grain') ? +Q.get('grain') : 4,
    lightScale: Q.has('ls') ? +Q.get('ls') : 1, installed: false,
  };
  const OD = window.__odysseyLook;                          // odyssey-ext's switches are read by its own frame hook; keep them quiet for the hall
  if (OD) { OD.on = false; OD.shadowLights = 0; OD.dust = false; }

  /* ---------------------------------------------------------------- Collision, ProximitySensor */
  const _build = B_.build;
  B_.build = function (n, parent, chain) {
    if (n && n.type === 'Collision') return this.buildGroup(n, parent, chain);                       // a Group (the hall asks for no collision; the viewer has none)
    if (n && n.type === 'ProximitySensor') { (this.prox ||= []).push({ node: n, parentTN: parent, inside: false }); return null; }
    if (n && (n.type === 'CoordinateInterpolator' || n.type === 'CoordinateInterpolator2D' || n.type === 'IntegerSequencer')) return null;   // routed by the event engine, nothing to draw
    return _build.call(this, n, parent, chain);
  };
  B_.stepProximity = function (now, eye) {
    if (!this.prox || !this.prox.length) return;
    R.events.begin(now);
    const q = this.pose.q, ang = 2 * Math.acos(Math.max(-1, Math.min(1, q[3]))), sn = Math.sqrt(Math.max(1e-12, 1 - q[3] * q[3]));
    const ori = sn < 1e-6 ? [0, 0, 1, 0] : [q[0] / sn, q[1] / sn, q[2] / sn, ang];
    for (const s of this.prox) {
      const n = s.node; if (n.f.enabled === false) continue;
      const M = s.parentTN && s.parentTN.computeWorldMatrix ? s.parentTN.computeWorldMatrix(true) : BABYLON.Matrix.Identity();
      const pl = BABYLON.Vector3.TransformCoordinates(eye, M.clone().invert()), c = n.f.center, h = n.f.size;
      const inside = h[0] > 0 && h[1] > 0 && h[2] > 0 && Math.abs(pl.x - c[0]) <= h[0] / 2 && Math.abs(pl.y - c[1]) <= h[1] / 2 && Math.abs(pl.z - c[2]) <= h[2] / 2;
      if (inside !== s.inside) {
        s.inside = inside; n.f.isActive = inside; n.f[inside ? 'enterTime' : 'exitTime'] = now;
        R.events.emit(n, 'isActive', inside); R.events.emit(n, inside ? 'enterTime' : 'exitTime', now);
      }
      if (inside) {
        n.f.position_changed = [pl.x, pl.y, pl.z]; n.f.orientation_changed = ori;
        R.events.emit(n, 'position_changed', n.f.position_changed); R.events.emit(n, 'orientation_changed', ori);
      }
    }
    R.events.drain();
  };

  /* ---------------------------------------------------------------- geometry: two channels, in-place updates */
  const _geometryData = B_.geometryData;
  B_.geometryData = function (g) {
    const tc = g.f && g.f.texCoord;
    if (!tc || tc.type !== 'MultiTextureCoordinate') return _geometryData.call(this, g);
    const kids = tc.f.texCoord || [];
    g.f.texCoord = kids[0] || null;                                                                   // channel 0 goes through the existing expansion (crease normals, per-corner uv)
    let d; try { d = _geometryData.call(this, g); } finally { g.f.texCoord = tc; }
    const second = kids[1];
    if (second && d.pos && g.type === 'IndexedFaceSet') {
      const ver = (second.version || 0) + ':' + (d.uvver || '');
      if (d.uv2ver !== ver || !d.uv2) {
        const f = g.f, ci = f.coordIndex, TC = second.f.point, TI = f.texCoordIndex && f.texCoordIndex.length ? f.texCoordIndex : ci, uv2 = [];
        let cur = [];
        const flush = () => { if (cur.length >= 3) for (const k of cur) uv2.push(TC[TI[k] * 2], TC[TI[k] * 2 + 1]); cur = []; };
        for (let i = 0; i < ci.length; i++) { if (ci[i] < 0) flush(); else cur.push(i); }
        flush();
        d.uv2 = Float32Array.from(uv2); d.uv2ver = ver;
      }
    }
    return d;
  };
  /* drift-ext's babylonGeometry with updatable buffers and the second channel */
  B_.babylonGeometry = function (g, wantColor) {
    const d = this.geometryData(g);
    const key = g.id + (wantColor ? 'c' : 'n'), c = this.geoCache.get(key), vkey = d.ver + '|' + (d.uv2ver || '');
    if (c && c.ver === vkey) return c.geo;
    if (c) c.geo.dispose();
    const vd = new BABYLON.VertexData();
    vd.positions = d.pos; vd.indices = d.idx;
    vd.normals = d.nrm || (() => { const n = new Float32Array(d.pos.length); BABYLON.VertexData.ComputeNormals(d.pos, d.idx, n, { useRightHandedSystem: true }); return n; })();
    if (d.uv) vd.uvs = d.uv;
    if (d.uv2) vd.uvs2 = d.uv2;
    if (d.col || wantColor) {
      const nv = d.pos.length / 3, rgba = new Float32Array(nv * 4);
      for (let i = 0; i < nv; i++) { rgba[i * 4] = d.col ? d.col[i * 3] : 1; rgba[i * 4 + 1] = d.col ? d.col[i * 3 + 1] : 1; rgba[i * 4 + 2] = d.col ? d.col[i * 3 + 2] : 1; rgba[i * 4 + 3] = d.colA ? d.colA[i] : 1; }
      vd.colors = rgba;
    }
    const geo = new BABYLON.Geometry('geo-' + key, this.scene, undefined, true);
    vd.applyToGeometry(geo, true);                         // updatable: CoordinateInterpolator writes the vertices every frame
    this.geoCache.set(key, { ver: vkey, geo });
    return geo;
  };
  /* the geometries a Coordinate / TextureCoordinate / Color / Normal node feeds (a Multi's children included) */
  B_.hlGeoUsers = function () {
    if (this._hlUsers && this._hlUsersWorld === this.world) return this._hlUsers;
    const m = new Map(), add = (k, g) => { if (!k) return; let l = m.get(k); if (!l) m.set(k, l = []); l.push(g); };
    for (const x of this.world.nodes) {
      if (x.type !== 'IndexedFaceSet' && x.type !== 'IndexedTriangleSet') continue;
      add(x.f.coord, x); add(x.f.normal, x); add(x.f.color, x); add(x.f.texCoord, x);
      if (x.f.texCoord && x.f.texCoord.type === 'MultiTextureCoordinate') for (const k of x.f.texCoord.f.texCoord) add(k, x);
    }
    this._hlUsersWorld = this.world; return (this._hlUsers = m);
  };
  const _changed = B_.changed;
  B_.changed = function (node, field) {
    const t = node.type;
    if (t === 'Coordinate' || t === 'TextureCoordinate') { const users = this.hlGeoUsers().get(node); if (users) { const s = (this._hlDirty ||= new Set()); users.forEach((g) => s.add(g)); } return; }
    if (t === 'Collision' || t === 'PointProperties') return;
    if (t === 'UnlitMaterial' || t === 'PhysicalMaterial' || t === 'Material') {
      _changed.call(this, node, field);
      for (const m of this.meshesOf.get(node.id) || []) { if (m._hlPoints) this.hlPointUniforms(m.material, m._hlSpec); else if (m.material && m.material._hlBlend) this.hlApplyBlend(m.material); }
      return;
    }
    return _changed.call(this, node, field);
  };
  B_.hlFlushGeometry = function () {
    const dirty = this._hlDirty; if (!dirty || !dirty.size) return;
    this._hlDirty = new Set();
    for (const g of dirty) {
      const d = this.geometryData(g);
      for (const suffix of ['n', 'c']) {
        const c = this.geoCache.get(g.id + suffix); if (!c) continue;
        const geo = c.geo;
        geo.updateVerticesData('position', d.pos, true);
        geo.updateVerticesData('normal', d.nrm || (() => { const n = new Float32Array(d.pos.length); BABYLON.VertexData.ComputeNormals(d.pos, d.idx, n, { useRightHandedSystem: true }); return n; })());
        if (d.uv) geo.updateVerticesData('uv', d.uv);
        if (d.uv2) geo.updateVerticesData('uv2', d.uv2);
        c.ver = d.ver + '|' + (d.uv2ver || '');
      }
    }
  };

  /* ---------------------------------------------------------------- materials: texture mapping, BlendMode */
  const _makeMaterial = B_.makeMaterial;
  B_.makeMaterial = function (shape, g, spec, mesh) {
    if (spec.kind === 'hlpoints') return this.hlPointMaterial(shape, g, spec, mesh);
    const m = _makeMaterial.call(this, shape, g, spec, mesh);
    if (!m) return m;
    const tcNode = g.f && g.f.texCoord, kids = tcNode && tcNode.type === 'MultiTextureCoordinate' ? tcNode.f.texCoord : null;
    if (kids && kids.length > 1 && spec.kind === 'pbr' && m instanceof BABYLON.PBRMaterial) {
      const f = spec.mat.f, idx = (name) => { const i = kids.findIndex((k) => k.f.mapping && k.f.mapping === name); return i < 0 ? 0 : i; };
      if (m.albedoTexture) m.albedoTexture.coordinatesIndex = idx(f.baseTextureMapping);
      if (m.emissiveTexture) m.emissiveTexture.coordinatesIndex = idx(f.emissiveTextureMapping);
      if (m.bumpTexture) m.bumpTexture.coordinatesIndex = idx(f.normalTextureMapping);
      if (m.metallicTexture) m.metallicTexture.coordinatesIndex = idx(f.metallicRoughnessTextureMapping);
      if (m.ambientTexture) m.ambientTexture.coordinatesIndex = idx(f.occlusionTextureMapping);
    }
    const app = shape.f.appearance, bm = app && app.f.blendMode;
    if (bm && m instanceof BABYLON.Material) { m._hlBlend = bm; this.hlApplyBlend(m); (this.meshesOf.get(bm.id) || (this.meshesOf.set(bm.id, []), this.meshesOf.get(bm.id))).push(mesh); }
    return m;
  };
  B_.hlApplyBlend = function (m) {
    const b = m._hlBlend.f, s = b.sourceColorFactor, d = b.destinationColorFactor, E = BABYLON.Engine;
    let mode = E.ALPHA_COMBINE;
    if (s === 'SRC_ALPHA' && d === 'ONE') mode = E.ALPHA_ADD;
    else if (s === 'ONE' && d === 'ONE') mode = E.ALPHA_ONEONE;
    else if (!(s === 'SRC_ALPHA' && d === 'ONE_MINUS_SRC_ALPHA')) this.note('BlendMode (' + s + ', ' + d + ') is drawn as the default blend');
    m.alphaMode = mode; m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; m.disableDepthWrite = true;
  };
  const _refreshPBR = B_.refreshPBR;
  B_.refreshPBR = function (m, mat) { _refreshPBR.call(this, m, mat); if (m._hlBlend) this.hlApplyBlend(m); };
  const _refreshUnlit = B_.refreshUnlit;
  /* An UnlitMaterial's emissiveTexture alpha is the surface's coverage (X_ITE blends by it): the sky's horizon glow, the sun shafts, the halos and the lamp
     sprites are PNGs whose alpha is the whole shape. The odyssey colour-times-texture move reads the texture in the diffuse slot with its alpha off, so a shaft drew as an opaque
     amber slab. A PNG gets hasAlpha and alpha-from-diffuse here, sorted and with depth writes off; a JPEG has none and stays opaque. */
  B_.refreshUnlit = function (m, mat, g) {
    _refreshUnlit.call(this, m, mat, g);
    const t = m.diffuseTexture;
    if (t && /\.png(\?|$)/i.test(t.name || t.url || '')) {
      t.hasAlpha = true; m.useAlphaFromDiffuseTexture = true;
      m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; m.disableDepthWrite = true;
    }
    if (m._hlBlend) this.hlApplyBlend(m);
  };

  /* ---------------------------------------------------------------- PointSet with PointProperties */
  const PT_VS = `
attribute position: vec3f;
attribute color: vec4f;
attribute corner: vec2f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform viewSize: vec2f;
uniform pp: vec4f;
uniform att: vec3f;
varying vColor: vec4f;
varying vUV: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let mv = uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  let d = length(mv.xyz);
  let size = clamp(uniforms.pp.x / max(1e-6, uniforms.att.x + uniforms.att.y * d + uniforms.att.z * d * d), uniforms.pp.y, uniforms.pp.z);
  var cp = uniforms.projection * mv;
  cp.x = cp.x + vertexInputs.corner.x * (size / uniforms.viewSize.x) * cp.w;
  cp.y = cp.y + vertexInputs.corner.y * (size / uniforms.viewSize.y) * cp.w;
  vertexOutputs.vColor = vertexInputs.color;
  vertexOutputs.vUV = vec2f(vertexInputs.corner.x, -vertexInputs.corner.y) * 0.5 + 0.5;
  vertexOutputs.position = cp;
}`;
  const PT_FS = `
var tex0Sampler: sampler;
var tex0: texture_2d<f32>;
uniform tint: vec4f;
varying vColor: vec4f;
varying vUV: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let t = textureSample(tex0, tex0Sampler, fragmentInputs.vUV);
  fragmentOutputs.color = vec4f(fragmentInputs.vColor.rgb * uniforms.tint.rgb * t.rgb, fragmentInputs.vColor.a * uniforms.tint.a * t.a);
}`;
  const _materialsFor = B_.materialsFor;
  B_.materialsFor = function (shape, g, app) {
    if (g.type === 'PointSet') {
      const mat = app && app.f.material, tex = app && app.f.texture, pp = app && app.f.pointProperties;
      return [{ kind: 'hlpoints', mat, tex, pp, deps: [mat, tex, pp].filter(Boolean) }];
    }
    return _materialsFor.call(this, shape, g, app);
  };
  const _makeMesh = B_.makeMesh;
  B_.makeMesh = function (shape, g, spec, pass) {
    if (g.type !== 'PointSet') return _makeMesh.call(this, shape, g, spec, pass);
    const f = g.f, P = f.coord && f.coord.f.point; if (!P || !P.length) return null;
    const np = Math.floor(P.length / 3), C = f.color && f.color.f.color, cs = f.color && f.color.type === 'ColorRGBA' ? 4 : 3;
    const pos = new Float32Array(np * 12), col = new Float32Array(np * 16), cor = new Float32Array(np * 8), idx = new Uint32Array(np * 6), K = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < np; i++) {
      for (let c = 0; c < 4; c++) {
        const o = i * 4 + c;
        pos[o * 3] = P[i * 3]; pos[o * 3 + 1] = P[i * 3 + 1]; pos[o * 3 + 2] = P[i * 3 + 2];
        col[o * 4] = C ? C[i * cs] : 1; col[o * 4 + 1] = C ? C[i * cs + 1] : 1; col[o * 4 + 2] = C ? C[i * cs + 2] : 1; col[o * 4 + 3] = C && cs === 4 ? C[i * cs + 3] : 1;
        cor[o * 2] = K[c * 2]; cor[o * 2 + 1] = K[c * 2 + 1];
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const mesh = new BABYLON.Mesh((shape.def || 'points') + '-pts', this.scene);
    const vd = new BABYLON.VertexData(); vd.positions = pos; vd.indices = idx; vd.applyToMesh(mesh, false);
    mesh.setVerticesData('color', col, false, 4); mesh.setVerticesData('corner', cor, false, 2);
    mesh.material = this.makeMaterial(shape, g, spec, mesh);
    mesh.isPickable = false; mesh.renderingGroupId = 1; mesh.alphaIndex = 1; mesh._hlPoints = true; mesh._hlSpec = spec; mesh.metadata = { points: true };
    (this.hlPointMats ||= []).push(mesh.material);
    return mesh;
  };
  B_.hlPointMaterial = function (shape, g, spec) {
    BABYLON.ShaderStore.ShadersStoreWGSL['hlpointsVertexShader'] = PT_VS; BABYLON.ShaderStore.ShadersStoreWGSL['hlpointsFragmentShader'] = PT_FS;
    const m = new BABYLON.ShaderMaterial('points-' + (shape.def || shape.id), this.scene, { vertex: 'hlpoints', fragment: 'hlpoints' },
      { attributes: ['position', 'color', 'corner'], uniforms: ['worldView', 'projection', 'viewSize', 'pp', 'att', 'tint'], samplers: ['tex0'], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: true });
    m.alphaMode = BABYLON.Engine.ALPHA_COMBINE; m.backFaceCulling = false; m.disableDepthWrite = true;
    const t = this.tex(spec.tex);
    if (t) { t.wrapU = t.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE; m.setTexture('tex0', t); }
    else { if (!this._hlWhite) this._hlWhite = BABYLON.RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, this.scene, false, false, BABYLON.Texture.NEAREST_SAMPLINGMODE); m.setTexture('tex0', this._hlWhite); }
    m._hlSpec = spec; this.hlPointUniforms(m, spec);
    return m;
  };
  B_.hlPointUniforms = function (m, spec) {
    const pp = spec.pp ? spec.pp.f : { pointSizeScaleFactor: 1, pointSizeMinValue: 1, pointSizeMaxValue: 1, attenuation: [1, 0, 0] };
    const em = spec.mat ? spec.mat.f.emissiveColor : [1, 1, 1], tr = spec.mat ? spec.mat.f.transparency : 0;
    m.setVector4('pp', new BABYLON.Vector4(pp.pointSizeScaleFactor, pp.pointSizeMinValue, pp.pointSizeMaxValue, 0));
    m.setVector3('att', new BABYLON.Vector3(pp.attenuation[0], pp.attenuation[1], pp.attenuation[2]));
    m.setVector4('tint', new BABYLON.Vector4(em[0], em[1], em[2], 1 - tr));
  };

  /* ---------------------------------------------------------------- the suns: one cascaded shadow generator each */
  const _buildLights = B_.buildLights;
  B_.buildLights = function () {
    _buildLights.call(this);
    for (const sg of this.hlSun || []) { try { sg.dispose(); } catch (e) { /* gone with the scene */ } }
    this.hlSun = [];
    if (!HL.shadows) return;
    // WebGPU gives a vertex shader 16 varying locations and every shadow map spends two of them (light-space position, depth metric), a cascade each.
    // Five shadow lights (two suns, three lamps) at one map each is ten locations and fits; one cascaded sun (?cascades=2) pushes a mesh lit by all five to 16 and the pipeline is refused, so the default is one map per light.
    const suns = this.scene.lights.filter((l) => l instanceof BABYLON.DirectionalLight && l.node && l.node.f.shadows && !l._scopeEmpty)
      .sort((a, b) => (b.node.f.global ? 1 : 0) - (a.node.f.global ? 1 : 0) || b.node.f.intensity - a.node.f.intensity);
    let cascaded = false;
    for (const l of suns) {
      const csm = !cascaded && l.node.f.global && HL.cascades > 1; cascaded = cascaded || csm;
      const sg = csm ? new BABYLON.CascadedShadowGenerator(HL.shadowSize, l) : new BABYLON.ShadowGenerator(l.node.f.global ? HL.shadowSize : 1024, l);
      if (csm) { sg.numCascades = HL.cascades; sg.lambda = 0.85; sg.stabilizeCascades = true; sg.depthClamp = true; sg.autoCalcDepthBounds = false; sg.cascadeBlendPercentage = 0.08; sg.shadowMaxZ = 220; sg.normalBias = 0.02; }
      else { sg.normalBias = 0.02; }
      sg.usePercentageCloserFiltering = true; sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
      sg.bias = 0.0025; sg.setDarkness(Math.max(0, 1 - l.node.f.shadowIntensity));
      for (const m of this.scene.meshes) {
        if (!m.metadata || !m.metadata.shape || m.metadata.text || m.metadata.points) continue;
        m.receiveShadows = true;
        if (m.metadata.shape.f.castShadow !== false && !(m.material && m.material._hlBlend)) sg.addShadowCaster(m);
      }
      sg._light = l; this.hlSun.push(sg);
    }
  };

  /* ---------------------------------------------------------------- the look: bloom, vignette, grain (all additions, all off in "As authored") */
  B_.installOdysseyLook = function () {
    const scene = this.scene, cam = scene.activeCamera;
    HL.body = this;
    const pipe = HL.pipe = new BABYLON.DefaultRenderingPipeline('hallHDR', true, scene, [cam]);
    pipe.samples = 4;
    pipe.bloomEnabled = true; pipe.bloomThreshold = 0.92; pipe.bloomWeight = HL.bloom; pipe.bloomKernel = 56; pipe.bloomScale = 0.5;
    pipe.grainEnabled = true; pipe.grain.intensity = HL.grain; pipe.grain.animated = true;
    const ip = pipe.imageProcessing;
    ip.toneMappingEnabled = true; ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL; ip.exposure = 1;
    ip.vignetteEnabled = true; ip.vignetteWeight = 1.2; ip.vignetteStretch = 0.2; ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
    HL.apply = (on) => { HL.on = on; pipe.bloomEnabled = on; pipe.grainEnabled = on; ip.vignetteEnabled = on; pipe.imageProcessingEnabled = true; };
    HL.apply(HL.on); HL.installed = true;
  };

  /* ---------------------------------------------------------------- per frame */
  const _frame = B_.frame;
  B_.frame = function () {
    if (this.canvas.getClientRects().length === 0) return;                  // a hidden canvas draws nothing (X_ITE pauses a hidden browser too)
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    for (const m of this.hlPointMats || []) { if (m.isDisposed && m.isDisposed()) continue; try { m.setVector2('viewSize', new BABYLON.Vector2(w, h)); } catch (e) { /* not ready */ } }
    this.hlFlushGeometry();
    for (const sg of this.hlSun || []) { const l = sg._light, live = l.isEnabled() && l.intensity > 0.002; sg.getShadowMap().refreshRate = live ? 1 : 0; }
    if (this.world && this.scene.activeCamera) this.stepProximity((performance.timeOrigin + performance.now()) / 1000, this.scene.activeCamera.globalPosition);
    return _frame.call(this);
  };

  /* counts for the page's About panel and the receipt */
  B_.hallInfo = function () {
    const s = this.scene;
    return { babylon: BABYLON.Engine.Version, meshes: s.meshes.length, lights: s.lights.length, materials: s.materials.length, textures: s.textures.length, active: s.getActiveMeshes().length,
      scope: this.scopeStats, suns: (this.hlSun || []).length, look: HL.on, notes: [...this.notes] };
  };
})();
