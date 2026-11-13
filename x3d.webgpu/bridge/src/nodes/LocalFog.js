/* LocalFog (EnvironmentalEffects level 4): LocalFog simulates atmospheric effects by blending distant objects with fog color.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('LocalFog', {
  component: 'EnvironmentalEffects', level: 4,
  container: 'children',
  defs: {
    color: ['SFColor', IO, [1, 1, 1]],
    enabled: ['SFBool', IO, true],
    fogType: ['SFString', IO, "LINEAR"],
    metadata: ['SFNode', IO, null],
    visibilityRange: ['SFFloat', IO, 0],
  },
  /* LocalFog is a child node: it fogs the geometry of the group it sits in (its siblings and everything under them), nothing outside. visibilityRange is the distance at which an object
     is fully hidden (0 turns the fog off). Babylon's fog is scene wide, so the body keeps a small registry of LocalFog scopes and, once per frame, switches each mesh's applyFog on for the
     meshes inside a scope (re-evaluated every frame, so enabled, colour, range and type changes show at once), and just before a mesh is drawn loads that scope's colour and range into the scene's fog values (mesh.onBeforeRenderObservable). That works while the materials of
     two meshes with different fogs are not the same object, which holds here (one material per shape). Fog colour is blended after the material colour, as in X_ITE. */
  build(body, n, parent) { BR.fog.add(body, n, parent); return null; },
});

BR.fog = {
  reg(body) {                                   // one registry per world on screen, replaced when the world is
    let F = body._fog;
    if (!F) {
      F = body._fog = { world: null, by: new Map(), of: new WeakMap(), mode: -1 };
      body.scene.onBeforeRenderObservable.add(() => { BR.fog.frame(body); BR.fog.fcFrame(body); });
    }
    if (F.world !== body.world) { F.world = body.world; F.by.clear(); F.mode = -1; body.scene.fogMode = BABYLON.Scene.FOGMODE_NONE; }
    return F;
  },
  add(body, n, tn) { const F = BR.fog.reg(body), l = F.by.get(tn) || []; l.push(n); F.by.set(tn, l); },
  live: (n) => n.f.enabled !== false && n.f.visibilityRange > 0,
  /* the fog of a mesh: the nearest group above it that holds an active LocalFog (the first active one when a group holds several) */
  scope(F, m) { for (let p = m.parent; p; p = p.parent) { const l = F.by.get(p); if (l) { const f = l.find(BR.fog.live); if (f) return f; } } return BR.fog.world(F); },
  world: (F) => (F.world && F.world.nodes.find((x) => x.type === 'Fog' && x.f.isBound && BR.fog.live(x))) || null,   // the bound Fog of the world, when it is on
  /* Babylon's three fog laws for X3D's: LINEAR is the same law (0 to visibilityRange); EXPONENTIAL (exp(-d / (range - d)) in X3D) becomes Babylon's EXP and EXPONENTIAL2 its EXP2, both
     scaled to the same 37% (1/e) at half the range, which is a near match in the first half and softer at the end, where X3D's reaches full fog at the range */
  params(sc, n) {
    const r = n.f.visibilityRange, c = n.f.color, t = String(n.f.fogType || 'LINEAR').toUpperCase();
    sc.fogColor.set(c[0], c[1], c[2]);
    if (sc.fogMode === BABYLON.Scene.FOGMODE_LINEAR) { sc.fogStart = 0; sc.fogEnd = r; } else sc.fogDensity = 2 / r;
    return t;
  },
  frame(body) {
    const F = BR.fog.reg(body), sc = body.scene, S = BABYLON.Scene;
    const act = [...F.by.values()].flat().filter(BR.fog.live), wf = BR.fog.world(F); if (wf) act.push(wf);
    const want = !act.length ? S.FOGMODE_NONE : { EXPONENTIAL: S.FOGMODE_EXP, EXPONENTIAL2: S.FOGMODE_EXP2 }[String(act[0].f.fogType || 'LINEAR').toUpperCase()] || S.FOGMODE_LINEAR;
    let changed = false;
    if (sc.fogMode !== want) { sc.fogMode = want; changed = true; }
    if (want === S.FOGMODE_NONE) return;
    for (const m of sc.meshes) {
      if (m.metadata && (m.metadata.background || m.metadata.fogOverlay)) continue;
      if (F.fc && F.fc.has(m)) { m.applyFog = false; continue; }      // a mesh with a FogCoordinate is fogged by its overlay (below), not by the scene fog
      const f = BR.fog.scope(F, m); if (F.of.get(m) !== (f || null)) { F.of.set(m, f || null); m.applyFog = !!f; changed = true; }
      if (!m.__fogHook) { m.__fogHook = true; m.onBeforeRenderObservable.add(() => { const g = F.of.get(m); if (g) BR.fog.params(sc, g); }); }
    }
    if (changed) sc.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_MiscDirtyFlag);
  },
  /* FogCoordinate: the fog amount of a vertex comes from the node (depth 0 = clear, 1 = fully fogged) instead of from the distance. X_ITE blends colour = mix(fogColor, color, 1 - depth), and so does a
     second copy of the mesh drawn over the first, unlit, with vertex colour = the scope's fog colour and vertex alpha = depth. It is only on while a LocalFog or the Fog covers the mesh. */
  coord(body, shape, r) {
    const g = shape.f.geometry, fc = g && g.f && g.f.fogCoord; if (!fc || !r.meshes) return;
    const F = BR.fog.reg(body), over = [];
    F.fc ||= new Set(); F.list ||= [];
    for (const m of r.meshes) {
      if (!m.getTotalVertices || !m.getTotalVertices()) continue;
      const o = m.clone(m.name + '-fog', m.parent, true); o.makeGeometryUnique(); o.isPickable = false; o.metadata = { fogOverlay: true };
      const mat = new BABYLON.StandardMaterial('fogmat-' + shape.id, body.scene);
      mat.disableLighting = true; mat.emissiveColor.set(1, 1, 1); mat.diffuseColor.set(0, 0, 0); mat.specularColor.set(0, 0, 0); mat.backFaceCulling = m.material ? m.material.backFaceCulling : false;
      mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; mat.zOffset = -1; mat.fogEnabled = false;
      o.material = mat; o.useVertexColors = true; o.hasVertexAlpha = true; o.applyFog = false; o.setEnabled(false);
      m.applyFog = false; F.fc.add(m); over.push(o); F.list.push({ base: m, over: o, fc, key: '' });
    }
    r.hatch = (r.hatch || []).concat(over);
  },
  fcFrame(body) {
    const F = body._fog; if (!F || !F.list) return;
    F.list = F.list.filter((e) => !e.base.isDisposed() && !e.over.isDisposed() ? true : (F.fc.delete(e.base), !e.over.isDisposed() && e.over.dispose(false, true), false));
    for (const e of F.list) {
      const f = BR.fog.scope(F, e.base), on = !!f && e.base.isEnabled(); e.over.setEnabled(on); if (!on) continue;
      const d = e.fc.f.depth || [], c = f.f.color, key = c.join() + '|' + (e.fc.version || 0) + '|' + (body._fcN || 0) + '|' + d.length;
      if (key === e.key) continue; e.key = key;
      const nv = e.over.getTotalVertices(), rgba = new Float32Array(nv * 4);
      for (let i = 0; i < nv; i++) { rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = Math.min(1, Math.max(0, d[i] || 0)); }
      e.over.setVerticesData(BABYLON.VertexBuffer.ColorKind, rgba, true);
    }
  },
};
