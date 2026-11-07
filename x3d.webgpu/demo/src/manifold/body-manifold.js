/* ManifoldBody: Babylon WebGPU body for the Manifold of Emotion (SCAFFOLD: untested). Extends the brain body (Body, body-cam.js): init, camera, event loop, Viewpoint binding are reused.
   Overrides how a Shape with one of the seven known ComposedShaders is drawn. Needs manifold-wgsl.js (MF_PRELUDE, MF_PORTS, MF_BY_HASH) and manifold-reader-ext.js. */

class ManifoldBody extends Body {
  constructor(canvas, opts) { super(canvas, opts); this.mfMaterials = []; this.gridLimit = (opts && opts.grid) || 0; }

  async init() {
    await super.init();
    this.setTone('none');                                   // the scene applies its own display() per fragment (ToneMapping NONE in app.js)
    this.scene.clearColor = new BABYLON.Color4(0.008, 0.013, 0.025, 1);
    this.scene.setRenderingAutoClearDepthStencil(0, true);
    return this;
  }

  materialsFor(shape, g, app) {
    const cs = app && app.f.shaders.find((s) => s.type === 'ComposedShader');
    const port = cs && MF_BY_HASH[this.shaderKey(cs)];
    if (port && MF_PORTS[port].vs) return [{ kind: 'mf', port, cs, deps: [cs] }];
    if (cs) this.note('ComposedShader ' + (cs.def || '') + (port ? ' port ' + port + ' is not written yet' : ' has no WGSL port (hash ' + this.shaderKey(cs) + ')') + ': this layer is not drawn');
    return null;                                            // law 40: the page shows the note; nothing is silently substituted
  }

  makeMesh(shape, g, spec, i) {
    if (spec.kind !== 'mf') return super.makeMesh(shape, g, spec, i);
    const name = (shape.def || 'shape') + '-mf-' + spec.port;
    let vd;
    if (g.type === 'ElevationGrid') vd = this.gridData(g);
    else if (g.type === 'TriangleSet' || g.type === 'IndexedTriangleSet') vd = this.triangleData(g);
    else if (g.type === 'PointSet') vd = this.spriteData(g);
    else { this.note('manifold: geometry <' + g.type + '> not handled'); return null; }
    const mesh = new BABYLON.Mesh(name, this.scene);
    vd.applyToMesh(mesh, true);
    mesh.alwaysSelectAsActiveMesh = true;                   // the shaders move vertices far outside the rest bounding box
    mesh.material = this.mfMaterial(spec, mesh);
    mesh.alphaIndex = { sky: 0, surface: 1, veil: 2, flow: 3, fiber: 4, node: 5, mote: 6 }[spec.port];
    if (spec.port === 'sky') mesh.renderingGroupId = 0, mesh.material.disableDepthWrite = true;
    this.spriteSetup = this.spriteSetup || {};
    return mesh;
  }

  /* ElevationGrid -> positions (x, height, z), two triangles per cell; ?grid=N tests with a coarser grid (never used for PSNR rows) */
  gridData(g) {
    const f = g.f, nx = f.xDimension, nz = f.zDimension, pos = new Float32Array(nx * nz * 3), idx = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pos[k] = i * f.xSpacing; pos[k + 1] = f.height[j * nx + i]; pos[k + 2] = j * f.zSpacing; }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    const vd = new BABYLON.VertexData(); vd.positions = pos; vd.indices = idx;   // TODO(port): winding vs Babylon's right-handed flip; check gl_FrontFacing equivalent
    return vd;
  }
  /* TriangleSet / IndexedTriangleSet with FloatVertexAttribute (aPath, aRibbon, aFiber): attributes become Babylon custom vertex buffers */
  triangleData(g) {
    const P = g.f.coord.f.point, vd = new BABYLON.VertexData();
    vd.positions = P; vd.indices = g.type === 'IndexedTriangleSet' ? Uint32Array.from(g.f.index) : Uint32Array.from({ length: P.length / 3 }, (_, i) => i);
    vd.custom = {};  // TODO(port): for (const a of g.f.attrib) vd.custom[a.f.name] = { data: a.f.value, size: a.f.numComponents }; applied as VertexBuffer in makeMesh
    return vd;
  }
  /* PointSet -> one quad per point: attributes `position` (the point), `corner` (-1/-1, 1/-1, -1/1, 1/1), colour from Color; the vertex shader sizes it in pixels */
  spriteData(g) {
    const P = g.f.coord.f.point, C = g.f.color && g.f.color.f.color, n = P.length / 3;
    const pos = new Float32Array(n * 12), corner = new Float32Array(n * 8), col = new Float32Array(n * 16), idx = new Uint32Array(n * 6);
    const cs = [-1, -1, 1, -1, -1, 1, 1, 1];
    for (let p = 0; p < n; p++) {
      for (let v = 0; v < 4; v++) {
        const o = p * 4 + v; pos.set([P[p * 3], P[p * 3 + 1], P[p * 3 + 2]], o * 3); corner.set([cs[v * 2], cs[v * 2 + 1]], o * 2);
        col.set(C ? [C[p * 3], C[p * 3 + 1], C[p * 3 + 2], 1] : [1, 1, 1, 1], o * 4);
      }
      idx.set([p * 4, p * 4 + 1, p * 4 + 2, p * 4 + 2, p * 4 + 1, p * 4 + 3], p * 6);
    }
    const vd = new BABYLON.VertexData(); vd.positions = pos; vd.colors = col; vd.indices = idx; vd.custom = { corner: { data: corner, size: 2 } };
    return vd;
  }

  /* one ShaderMaterial per Shape: WGSL from MF_PORTS (prelude + port), every u* field of the ComposedShader pushed on change (refreshShader, extended) */
  mfMaterial(spec, mesh) {
    const P = MF_PORTS[spec.port], tag = 'mf-' + spec.port;
    BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'VertexShader'] = MF_PRELUDE + P.vs;
    BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'FragmentShader'] = MF_PRELUDE + P.fs;
    const uniforms = ['worldView', 'projection', ...Object.keys(spec.cs.fdefs).filter((k) => /^u[A-Z]/.test(k))];
    const m = new BABYLON.ShaderMaterial('mf-' + spec.cs.def, this.scene, { vertex: tag, fragment: tag }, { attributes: P.attrs, uniforms, shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: spec.port !== 'surface' && spec.port !== 'sky' });
    m.backFaceCulling = false;
    // TODO(port): alpha mode per layer: the light layers write (g / max g, max g) for STANDARD alpha blending (lightOut), so alphaMode = ALPHA_COMBINE; surface and sky are opaque
    this.refreshShader(m, spec.cs);
    this.mfMaterials.push(m);
    return m;
  }
  // TODO(port): extend refreshShader for MFVec4f (setArray4 or seven setVector4), SFVec2f (setVector2), SFVec4f; add uEye from the bound Viewpoint if the page does not push it (it does: app.js pushUniforms)
}
