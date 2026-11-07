/* ManifoldBody: Babylon WebGPU body for the Manifold of Emotion. Extends the brain body (Body, body-cam.js): camera, event loop and Viewpoint binding are reused.
   The scene's seven ComposedShaders are drawn by their WGSL ports (manifold-wgsl.js); everything around them is Babylon's own machinery:
   DefaultRenderingPipeline (4x MSAA, HDR, bloom, vignette, grain, chromatic aberration), hardware scaling for the quality tiers, onBeforeRender for uniform and
   vertex-buffer updates, EngineInstrumentation for the opt-in timing panel. The page's own app.js runs unchanged through the SAI shim. */

class ManifoldBody extends Body {
  constructor(canvas, opts) {
    super(canvas, opts);
    this.mf = { mats: new Map(), dirtyShaders: new Set(), dirtyGeo: new Set(), geoOf: new Map(), gridIdx: new Map(), pipeline: null, look: { on: true, glow: 0.65, grain: true }, notes: [] };
  }

  /* adapters are tried as in PR #14: plain first (it is the one that works on a machine whose hints are blocklisted), then the hints */
  async pickAdapter() {
    const tries = [{}, { powerPreference: 'high-performance' }, { powerPreference: 'low-power' }, { forceFallbackAdapter: true }];
    for (const o of tries) {
      const a = await navigator.gpu.requestAdapter(o).catch(() => null);
      if (a) return { adapter: a, hint: o };
    }
    return null;
  }

  async init() {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
    const got = await this.pickAdapter();
    if (!got) throw new Error('WebGPU is available but the browser returned no adapter (requestAdapter: plain, high-performance, low-power and software all null).');
    this.adapter = got.adapter;
    const info = got.adapter.info || {};
    this.adapterInfo = { vendor: info.vendor, architecture: info.architecture, description: info.description, device: info.device, hint: JSON.stringify(got.hint), features: [...(got.adapter.features || [])].includes('timestamp-query') ? 'timestamp-query' : '' };
    const e = this.engine = new BABYLON.WebGPUEngine(this.canvas, { antialias: false, adaptToDeviceRatio: true, powerPreference: got.hint.powerPreference, forceFallbackAdapter: !!got.hint.forceFallbackAdapter, stencil: false });
    await e.initAsync();
    const s = this.scene = new BABYLON.Scene(e);
    s.useRightHandedSystem = true;
    s.clearColor = new BABYLON.Color4(0.008, 0.013, 0.025, 1);
    s.skipPointerMovePicking = true; s.autoClear = true; s.autoClearDepthAndStencil = true;
    this.setTone('none');                                       // the shaders output display-referred colour: Babylon must not tone map on top
    const c = this.cam = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, 0, 10), s);
    c.minZ = 0.5; c.maxZ = 4000; c.inputs.clear();
    this.lights = [];
    this.buildPipeline();
    s.onBeforeRenderObservable.add(() => this.flush());
    new ResizeObserver(() => { e.resize(); this.applyCamera(); }).observe(this.canvas);
    e.runRenderLoop(() => this.frame());
    return this;
  }
  setupInput() { /* the page (app.js) owns orbit, pan, zoom and click-to-perturb */ }

  /* ---------------------------------------------------------------- Babylon's own post chain, replacing the old 2D-canvas lens (law 39: switchable, "As authored" = off) */
  buildPipeline() {
    const p = new BABYLON.DefaultRenderingPipeline('mf-look', true, this.scene, [this.cam]);
    p.samples = 4; p.fxaaEnabled = false;
    p.bloomEnabled = true; p.bloomThreshold = 0.55; p.bloomWeight = 0.45; p.bloomKernel = 72; p.bloomScale = 0.6;
    p.imageProcessingEnabled = true;
    const ip = p.imageProcessing;
    ip.toneMappingEnabled = false; ip.exposure = 1; ip.contrast = 1;
    p.imageProcessing.vignetteEnabled = true; p.imageProcessing.vignetteWeight = 1.6; p.imageProcessing.vignetteStretch = 0.1; p.imageProcessing.vignetteCameraFov = 0.8;
    p.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
    p.grainEnabled = true; p.grain.intensity = 6; p.grain.animated = true;
    p.chromaticAberrationEnabled = true; p.chromaticAberration.aberrationAmount = 14; p.chromaticAberration.radialIntensity = 0.8;
    this.mf.pipeline = p;
    this.fixOutputSpace();
  }
  /* the pipeline's last pass converts linear to gamma by default; the shaders already output gamma-encoded, display-referred colour, so that conversion is switched off */
  fixOutputSpace() {
    const pp = (this.cam._postProcesses || []).find((x) => x && x.name === 'imageProcessing');
    if (pp && pp.fromLinearSpace) pp.fromLinearSpace = false;
  }
  /* the page's lens switch, glow slider and film switch drive the pipeline each frame */
  applyLook() {
    const p = this.mf.pipeline, L = this.mf.look; if (!p) return;
    const on = L.on;
    p.bloomEnabled = on; p.bloomWeight = 0.28 + 0.55 * L.glow;
    p.grainEnabled = on && L.grain; p.chromaticAberrationEnabled = on;
    p.imageProcessing.vignetteEnabled = on;
  }
  browserOption(k, v) { if (k === 'Multisampling' && this.mf.pipeline) this.mf.pipeline.samples = Math.max(1, Math.min(4, v | 0)); }

  /* ---------------------------------------------------------------- scene */
  setWorld(world, baseUrl, resolve) {
    super.setWorld(world, baseUrl, resolve);
    const vp = world.nodes.find((n) => n.type === 'Viewpoint');
    if (vp) R.receive(vp, 'set_bind', true);                    // X_ITE binds the first Viewpoint by itself
  }

  materialsFor(shape, g, app) {
    const cs = app && app.f.shaders.find((s) => s.type === 'ComposedShader');
    const port = cs && MF_BY_HASH[this.shaderKey(cs)];
    if (port) return [{ kind: 'mf', port, cs, deps: [cs, g, g.f.coord, g.f.color, ...(g.f.attrib || [])].filter(Boolean) }];
    if (cs) this.note('ComposedShader ' + (cs.def || '') + ' has no WGSL port (hash ' + this.shaderKey(cs) + '): this layer is not drawn');
    return null;                                                // law 40: say so, never substitute silently
  }

  makeMesh(shape, g, spec, i) {
    if (spec.kind !== 'mf') return super.makeMesh(shape, g, spec, i);
    const P = MF_PORTS[spec.port];
    const mesh = new BABYLON.Mesh((shape.def || 'shape') + '-' + spec.port, this.scene);
    this.mf.geoOf.set(mesh, { g, P });
    if (!this.fillMesh(mesh, g, P)) { mesh.dispose(); return null; }
    mesh.alwaysSelectAsActiveMesh = true;                       // the shaders move vertices far outside the rest bounding box
    mesh.isPickable = false;
    mesh.material = this.mfMaterial(spec, P);
    mesh.alphaIndex = P.order;
    return mesh;
  }

  /* ---------------------------------------------------------------- geometry: ElevationGrid, (Indexed)TriangleSet with vertex attributes, PointSet as sprite quads */
  fillMesh(mesh, g, P) {
    const VB = BABYLON.VertexBuffer, f = g.f;
    let pos, idx, nv, extra = [];   // custom kinds go on AFTER the position: a geometry born from an unknown kind drops its data
    if (g.type === 'ElevationGrid') {
      const nx = f.xDimension, nz = f.zDimension; nv = nx * nz;
      if (nx < 2 || nz < 2) return false;
      pos = new Float32Array(nv * 3);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pos[k] = i * f.xSpacing; pos[k + 1] = f.height && f.height.length ? f.height[j * nx + i] : 0; pos[k + 2] = j * f.zSpacing; }
      const key = nx + 'x' + nz; idx = this.mf.gridIdx.get(key);
      if (!idx) {
        idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let o = 0;
        for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
        this.mf.gridIdx.set(key, idx);
      }
    } else if (g.type === 'TriangleSet' || g.type === 'IndexedTriangleSet') {
      pos = f.coord && f.coord.f.point; if (!pos || pos.length < 9) return false;
      nv = pos.length / 3;
      if (g.type === 'IndexedTriangleSet' && f.index && f.index.length >= 3) idx = Uint32Array.from(f.index);
      else { idx = new Uint32Array(nv - (nv % 3)); for (let i = 0; i < idx.length; i++) idx[i] = i; }
      extra = (f.attrib || []).map((a) => [a.f.name, a.f.value, a.f.numComponents]);
    } else if (g.type === 'PointSet') {
      const Pt = f.coord && f.coord.f.point; if (!Pt || !Pt.length) return false;
      const n = Pt.length / 3, C = f.color && f.color.f.color; nv = n * 4;
      pos = new Float32Array(nv * 3); idx = new Uint32Array(n * 6);
      const corner = new Float32Array(nv * 2), col = new Float32Array(nv * 4), cs = [-1, -1, 1, -1, -1, 1, 1, 1];
      for (let p = 0; p < n; p++) {
        for (let v = 0; v < 4; v++) {
          const o = p * 4 + v;
          pos[o * 3] = Pt[p * 3]; pos[o * 3 + 1] = Pt[p * 3 + 1]; pos[o * 3 + 2] = Pt[p * 3 + 2];
          corner[o * 2] = cs[v * 2]; corner[o * 2 + 1] = cs[v * 2 + 1];
          col[o * 4] = C ? C[p * 3] : 1; col[o * 4 + 1] = C ? C[p * 3 + 1] : 1; col[o * 4 + 2] = C ? C[p * 3 + 2] : 1; col[o * 4 + 3] = 1;
        }
        idx.set([p * 4, p * 4 + 1, p * 4 + 2, p * 4 + 2, p * 4 + 1, p * 4 + 3], p * 6);
      }
      extra = [['corner', corner, 2], [VB.ColorKind, col, 4]];
    } else { this.note('manifold: geometry <' + g.type + '> is not handled'); return false; }
    mesh.setVerticesData(VB.PositionKind, pos, true, 3);
    for (const [k, d, n] of extra) mesh.setVerticesData(k, d, true, n);
    mesh.setIndices(idx, nv);
    return true;
  }

  /* ---------------------------------------------------------------- materials */
  mfMaterial(spec, P) {
    const hit = this.mf.mats.get(spec.cs.id); if (hit) return hit;
    const tag = 'mf' + spec.port, vs = MF_PRELUDE + P.vs, fs = MF_PRELUDE + P.fs;
    BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'VertexShader'] = vs; BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'FragmentShader'] = fs;
    const names = new Set(); for (const src of [vs, fs]) for (const m of src.matchAll(/\buniform\s+(\w+)\s*:/g)) names.add(m[1]);
    const m = new BABYLON.ShaderMaterial('mf-' + (spec.cs.def || spec.port), this.scene, { vertex: tag, fragment: tag },
      { attributes: P.attrs, uniforms: [...names], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: P.blend });
    m.backFaceCulling = false;                                  // ElevationGrid solid=false, ribbons and sprites are two-sided
    if (P.blend || spec.port === 'sky') m.disableDepthWrite = true;
    m._mf = { cs: spec.cs, names: [...names], port: spec.port };
    this.mf.mats.set(spec.cs.id, m);
    this.pushUniforms(m);
    return m;
  }
  pushUniforms(m) {
    const { cs, names } = m._mf, V4 = BABYLON.Vector4;
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    for (const name of names) {
      if (name === 'worldView' || name === 'projection') continue;
      if (name === 'uViewport') { m.setVector2(name, new BABYLON.Vector2(w, h)); continue; }
      const a = /^(uSources|uShape|uPulse|uAnchors)(\d)$/.exec(name);
      if (a) { const arr = cs.f[a[1]], i = +a[2] * 4; if (arr && arr.length > i + 3) m.setVector4(name, new V4(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])); continue; }
      const def = cs.fdefs[name]; if (!def) continue;
      const v = cs.f[name];
      try {
        if (def[0] === 'SFFloat' || def[0] === 'SFTime' || def[0] === 'SFDouble' || def[0] === 'SFInt32') m.setFloat(name, +v);
        else if (def[0] === 'SFVec3f' || def[0] === 'SFColor') m.setVector3(name, new BABYLON.Vector3(v[0], v[1], v[2]));
        else if (def[0] === 'SFVec2f') m.setVector2(name, new BABYLON.Vector2(v[0], v[1]));
      } catch (e) { /* uniform not in this port */ }
    }
  }

  /* ---------------------------------------------------------------- changes: batched, applied once per frame before the render */
  changed(node, field) {
    const t = node.type;
    if (t === 'ComposedShader') { this.mf.dirtyShaders.add(node); return; }
    if (t === 'Coordinate' || t === 'FloatVertexAttribute' || t === 'IndexedTriangleSet' || t === 'TriangleSet' || t === 'Color' || t === 'PointSet' || t === 'ElevationGrid') {
      for (const m of this.meshesOf.get(node.id) || []) this.mf.dirtyGeo.add(m);
      return;
    }
    super.changed(node, field);
  }
  flush() {
    const L = this.mf.look, lens = document.getElementById('lensToggle'), grain = document.getElementById('grain');
    if (lens) L.on = !!lens.checked; if (grain) L.grain = !!grain.checked;
    this.applyLook(); this.fixOutputSpace();
    for (const cs of this.mf.dirtyShaders) { const m = this.mf.mats.get(cs.id); if (m) this.pushUniforms(m); }
    this.mf.dirtyShaders.clear();
    for (const mesh of this.mf.dirtyGeo) { const rec = this.mf.geoOf.get(mesh); if (rec && !mesh.isDisposed()) this.fillMesh(mesh, rec.g, rec.P); }
    this.mf.dirtyGeo.clear();
    // render size can change with the quality tier or a resize: the sprite and ribbon shaders need it
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    if (w !== this.mf.w || h !== this.mf.h) { this.mf.w = w; this.mf.h = h; for (const m of this.mf.mats.values()) this.pushUniforms(m); }
  }
}
