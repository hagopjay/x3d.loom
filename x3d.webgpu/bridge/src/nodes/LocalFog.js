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
      body.scene.onBeforeRenderObservable.add(() => BR.fog.frame(body));
    }
    if (F.world !== body.world) { F.world = body.world; F.by.clear(); F.mode = -1; body.scene.fogMode = BABYLON.Scene.FOGMODE_NONE; }
    return F;
  },
  add(body, n, tn) { const F = BR.fog.reg(body), l = F.by.get(tn) || []; l.push(n); F.by.set(tn, l); },
  live: (n) => n.f.enabled !== false && n.f.visibilityRange > 0,
  /* the fog of a mesh: the nearest group above it that holds an active LocalFog (the first active one when a group holds several) */
  scope(F, m) { for (let p = m.parent; p; p = p.parent) { const l = F.by.get(p); if (l) { const f = l.find(BR.fog.live); if (f) return f; } } return null; },
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
    const act = [...F.by.values()].flat().filter(BR.fog.live);
    const want = !act.length ? S.FOGMODE_NONE : { EXPONENTIAL: S.FOGMODE_EXP, EXPONENTIAL2: S.FOGMODE_EXP2 }[String(act[0].f.fogType || 'LINEAR').toUpperCase()] || S.FOGMODE_LINEAR;
    let changed = false;
    if (sc.fogMode !== want) { sc.fogMode = want; changed = true; }
    if (want === S.FOGMODE_NONE) return;
    for (const m of sc.meshes) {
      if (m.metadata && m.metadata.background) continue;
      const f = BR.fog.scope(F, m); if (F.of.get(m) !== (f || null)) { F.of.set(m, f || null); m.applyFog = !!f; changed = true; }
      if (!m.__fogHook) { m.__fogHook = true; m.onBeforeRenderObservable.add(() => { const g = F.of.get(m); if (g) BR.fog.params(sc, g); }); }
    }
    if (changed) sc.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_MiscDirtyFlag);
  },
};
