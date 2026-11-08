/* Dynasty Loom on Babylon WebGPU: the body additions (concatenated after demiurge/body-dm.js, same bundle scope; nothing before it is edited).
     - a Shape whose ComposedShader DEF is one of the six family programs draws through its WGSL port (wgsl-dl.js), keyed by DEF with the look constants read from the scene's GLSL
     - IndexedTriangleSet with FloatVertexAttribute (aTan, aInfo, aAux) and Color: the fibre ribbons are built on the CPU by the generator, one attribute set per vertex
     - Appearance.alphaMode: OPAQUE draws without blending and writes depth, BLEND blends and does not; blended shapes keep document order (alphaIndex) */

const _dlMaterialsFor = Body.prototype.materialsFor, _dlMakeMesh = Body.prototype.makeMesh, _dlSetWorld = Body.prototype.setWorld, _dlFrame = Body.prototype.frame, _dlChanged = Body.prototype.changed, _dlClear = Body.prototype.clearWorld;

Object.assign(Body.prototype, {
  // the page hides the hypersphere's canvas while the tapestry (X_ITE) is shown; X_ITE pauses a hidden browser, so does this
  frame() { if (this.canvas && !this.canvas.getClientRects().length) return; return _dlFrame.call(this); },
  setWorld(world, baseUrl, resolve) { this._dlOrder = 0; return _dlSetWorld.call(this, world, baseUrl, resolve); },
  clearWorld() { this._dlOrder = 0; return _dlClear.call(this); },
  materialsFor(shape, g, app) {
    const cs = app && app.f.shaders.find((s) => s.type === 'ComposedShader');
    if (cs && DL_BY_DEF[cs.def]) {
      if (g.type !== 'IndexedTriangleSet') { this.note('ComposedShader ' + cs.def + ' on <' + g.type + '>: the port is written for IndexedTriangleSet; drawn with its Material'); }
      else {
        const frag = cs.f.parts.filter((p) => p.type === 'ShaderPart' && String(p.f.type).toUpperCase() === 'FRAGMENT').map(shaderSource)[0] || '';
        const port = dlPortFor(cs, frag);
        return [{ kind: 'gob', dl: true, name: 'dl-' + port.prog, port, cs, alpha: app.f.alphaMode, noPick: true, app, deps: [cs, app, app.f.material].filter(Boolean) }];
      }
    }
    const specs = _dlMaterialsFor.call(this, shape, g, app), um = app && app.f.material;
    // a textured UnlitMaterial (the portrait plates): its transparency is the plate's fade, driven by interpolators; the brain body draws the texture at full opacity
    if (specs && um && um.type === 'UnlitMaterial') for (const sp of specs) if (sp.kind === 'unlit') { sp.mat = um; sp.deps = [...(sp.deps || []), um]; }
    return specs;
  },
  /* Appearance.blendMode: the page asks for X_ITE's BlendMode (ONE, ONE) on the glow layers when its component answers; Babylon's own blend constants carry the same equations */
  dlBlend(app) {
    const bm = app && app.f.blendMode; if (!bm) return BABYLON.Engine.ALPHA_COMBINE;
    const sc = bm.f.sourceColorFactor, dc = bm.f.destinationColorFactor;
    if (sc === 'ONE' && dc === 'ONE') return BABYLON.Engine.ALPHA_ONEONE;
    if (sc === 'SRC_ALPHA' && dc === 'ONE') return BABYLON.Engine.ALPHA_ADD;
    if (!(sc === 'SRC_ALPHA' && dc === 'ONE_MINUS_SRC_ALPHA')) this.note('BlendMode ' + sc + ', ' + dc + ' has no Babylon constant here: drawn as the default blend');
    return BABYLON.Engine.ALPHA_COMBINE;
  },
  changed(node, field) {
    if (node.type === 'Appearance' && field === 'blendMode') {
      for (const m of this.meshesOf.get(node.id) || []) if (m.material && m.material.alphaMode !== undefined && m._dlBlend) m.material.alphaMode = this.dlBlend(node);
      return;
    }
    if (node.type === 'UnlitMaterial') {
      for (const m of this.meshesOf.get(node.id) || []) if (m.material && m.material.setFloat && field === 'transparency') m.material.setFloat('opacity', 1 - node.f.transparency);
      return;
    }
    return _dlChanged.call(this, node, field);
  },
  makeMesh(shape, g, spec, passIndex) {
    if (!spec.dl) {
      const m = _dlMakeMesh.call(this, shape, g, spec, passIndex);
      if (m && spec.kind === 'unlit' && spec.mat && m.material && m.material.setFloat) m.material.setFloat('opacity', 1 - spec.mat.f.transparency);
      return m;
    }
    const f = g.f, P = f.coord && f.coord.f.point, port = spec.port, s = this.scene, name = (shape.def || 'dl' + shape.id) + '-' + spec.name + passIndex;
    if (!P || !f.index.length) return null;
    const idx = Uint32Array.from(f.index); if (f.ccw === false) for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    const mesh = new BABYLON.Mesh(name, s);
    const vd = new BABYLON.VertexData(); vd.positions = P; vd.indices = idx; vd.applyToMesh(mesh, false);
    const nv = P.length / 3, byName = new Map((f.attrib || []).map((a) => [a.f.name, a]));
    for (const a of port.attrs) {
      if (a === 'position') continue;
      if (a === 'normal') { const N = f.normal && f.normal.f.vector; if (N && N.length === P.length) mesh.setVerticesData('normal', N, false, 3); else this.note(spec.name + ': no per-vertex normals on ' + (shape.def || 'a shape')); }
      else if (a === 'color') {
        const C = f.color && f.color.f.color, k = f.color && f.color.type === 'ColorRGBA' ? 4 : 3, out = new Float32Array(nv * 4);
        for (let i = 0; i < nv; i++) { out[i * 4] = C ? C[i * k] : 1; out[i * 4 + 1] = C ? C[i * k + 1] : 1; out[i * 4 + 2] = C ? C[i * k + 2] : 1; out[i * 4 + 3] = C && k === 4 ? C[i * 4 + 3] : 1; }
        mesh.setVerticesData('color', out, false, 4);
      } else {
        const at = byName.get(a);
        if (at) mesh.setVerticesData(a, at.f.value, false, at.f.numComponents);
        else this.note(spec.name + ' needs vertex attribute ' + a + ' that ' + (shape.def || 'the shape') + ' does not carry');
      }
    }
    mesh.alwaysSelectAsActiveMesh = true;
    const m = mesh.material = gobMakeMaterial(s, spec.name, port, name + '-mat');
    (this.gobMats ||= new Set()).add(m); this._gobVpW = -1;
    // AUTO is X_ITE's own choice: these two programs write alpha 1, so they are opaque shapes that write depth (the seed's core must hide the seed's glow behind it)
    const opaque = spec.alpha === 'OPAQUE' || (spec.alpha === 'AUTO' && (port.prog === 'seedcore' || port.prog === 'ring'));
    if (opaque) { m.alphaMode = BABYLON.Engine.ALPHA_DISABLE; m.needAlphaBlending = () => false; m.disableDepthWrite = false; }
    else { m.alphaMode = this.dlBlend(spec.app); m.disableDepthWrite = true; mesh._dlBlend = true; }
    mesh.renderingGroupId = port.prog === 'sky' ? 0 : 1; mesh.alphaIndex = opaque ? 0 : ++this._dlOrder;
    this.refreshShader(m, spec.cs);
    return mesh;
  },
});
