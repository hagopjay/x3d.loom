/* PointLight, SpotLight (and DirectionalLight, see DirectionalLight.js) in the world (Lighting component). The reader knows them; the stock body skipped the first two ("skipped <PointLight>") and drew a DirectionalLight in world space only.
   Each is now a Babylon light under the TransformNode of its parent, so the Transform chain above moves and turns it:
     PointLight   location, color, intensity, radius (no light past it), attenuation (a0 a1 a2)
     SpotLight    the same plus direction, beamWidth (full intensity cone) and cutOffAngle (no light outside), both half angles as X3D gives them
   attenuation 1 0 0 (the default) is a light with no fall-off up to its radius. Otherwise the Babylon light range is set where 1 / (a0 + a1 d + a2 d^2) drops under 1/32, which is a close fit,
   not X_ITE's per pixel polynomial (logged as a difference). global = FALSE lights only the meshes below the parent group (BR.light.scope, run after each build). on = FALSE switches it off.
   ambientIntensity is not used. */
BR.light = {
  make(body, n, parent) {
    const f = n.f, sc = body.scene, name = (n.def || n.type) + '-light', V = BABYLON.Vector3;
    const l = n.type === 'SpotLight'
      ? new BABYLON.SpotLight(name, new V(...f.location), new V(...f.direction), Math.min(Math.PI, 2 * f.cutOffAngle), 1, sc)
      : n.type === 'DirectionalLight' ? new BABYLON.DirectionalLight(name, new V(...f.direction), sc) : new BABYLON.PointLight(name, new V(...f.location), sc);
    l.parent = parent; l.node = n; l._body = body; n._light = l; (body._x3dLights ||= []).push(l);
    sc.materials.forEach((m) => { if (m.maxSimultaneousLights !== undefined) m.maxSimultaneousLights = 8; });
    BR.light.refresh(l, n); return l;
  },
  refresh(l, n) {
    const f = n.f, c = f.color, a = f.attenuation || [1, 0, 0], R_ = f.radius > 0 ? f.radius : 1e4;
    l.diffuse = new BABYLON.Color3(c[0], c[1], c[2]); l.specular = l.diffuse.clone(); l.intensity = f.intensity * ((l._body && l._body.opts && l._body.opts.lightScale) ?? 1); l.setEnabled(f.on !== false);
    if (n.type === 'DirectionalLight') { l.direction.set(f.direction[0], f.direction[1], f.direction[2]); return; }
    l.position.set(f.location[0], f.location[1], f.location[2]);
    if (a[1] === 0 && a[2] === 0) l.range = 1e4; else { let d = 0.01; while (d < R_ && 1 / (a[0] + a[1] * d + a[2] * d * d) > 1 / 32) d *= 1.25; l.range = Math.min(R_, d); }
    if (n.type === 'SpotLight') {
      l.direction.set(f.direction[0], f.direction[1], f.direction[2]); l.angle = Math.min(Math.PI * 0.98, 2 * f.cutOffAngle); l.innerAngle = Math.min(l.angle, 2 * f.beamWidth); l.exponent = 0;
      BR.light.cone(l, f.beamWidth, Math.min(Math.PI * 0.49, f.cutOffAngle));
    }
  },
  /* SpotLight cone (19775-1 section 17.4.4): full intensity inside beamWidth, a linear ramp in the angle down to nothing at cutOffAngle. Babylon's own spot term is pow(cos, exponent) with a hard cut,
     which cannot hold a flat core and an edge that ends at zero, so the exponent is 0 and the shape is a projection texture (SpotLight.projectionTexture, a radial table over tan(angle)). */
  cone(l, beam, cut) {
    const key = beam.toFixed(4) + '/' + cut.toFixed(4); if (l._coneKey === key) return; l._coneKey = key;
    const N = 256, data = new Uint8Array(N * N * 4), tc = Math.tan(cut);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = Math.hypot((x + 0.5) / N * 2 - 1, (y + 0.5) / N * 2 - 1), th = Math.atan(r * tc);
      const v = r >= 1 ? 0 : th <= beam ? 255 : Math.round(255 * Math.max(0, (cut - th) / (cut - beam || 1e-6)));
      const k = (y * N + x) * 4; data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255;
    }
    const t = BABYLON.RawTexture.CreateRGBATexture(data, N, N, l.getScene(), false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
    t.wrapU = t.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE; if (l.projectionTexture) l.projectionTexture.dispose();
    l.projectionTexture = t; l.projectionTextureLightNear = 0.01; l.projectionTextureLightFar = 1e4;
  },
  /* radius: Babylon's range is a smooth fall-off, X3D's radius a hard edge. With no attenuation the range is left open (so the light is flat like X_ITE's) and the edge is made per mesh:
     a mesh whose bounding sphere lies wholly beyond the radius is left out of the light (excludedMeshes), once per frame and only when the set changes. A mesh that straddles the edge is lit whole. */
  cull(body) {
    if (body._lightCull) return; body._lightCull = body.scene.onBeforeRenderObservable.add(() => {
      if (body.scene.meshes.length !== body._lightMeshCount) BR.light.scope(body);   // children added or removed after load: the scope of a global FALSE light follows
      for (const l of body._x3dLights || []) {
        if (l.node.type === 'SpotLight') { const d = l.getShadowDirection(); l.projectionTextureUpDirection = Math.abs(d.y) < 0.99 ? new BABYLON.Vector3(0, 1, 0) : new BABYLON.Vector3(0, 0, 1); l._projectionTextureViewLightDirty = true; }   // follows a moving parent group
        const f = l.node.f, a = f.attenuation || [1, 0, 0]; if (!(f.radius > 0) || a[1] !== 0 || a[2] !== 0 || !l.isEnabled()) { if (l.excludedMeshes.length && l._cut) { l.excludedMeshes = []; l._cut = ''; } continue; }
        const p = l.getAbsolutePosition(), out = [];
        for (const m of body.scene.meshes) { if (!m.isEnabled() || !m.getBoundingInfo) continue; const s = m.getBoundingInfo().boundingSphere; if (BABYLON.Vector3.Distance(p, s.centerWorld) - s.radiusWorld > f.radius) out.push(m); }
        const key = out.map((m) => m.uniqueId).join(','); if (key !== l._cut) { l._cut = key; l.excludedMeshes = out; }
      }
    });
  },
  scope(body) {
    BR.light.cull(body);
    for (const l of body._x3dLights || []) l.includedOnlyMeshes = l.node.f.global === false && l.parent ? l.parent.getChildMeshes(false) : [];
    body._lightMeshCount = body.scene.meshes.length;
  },
};
BR.node('PointLight', {
  component: 'Lighting', level: 2,
  build(body, n, parent) { BR.light.make(body, n, parent); return null; },
  changed(body, n, field) { if (n._light) { BR.light.refresh(n._light, n); if (field === 'global') BR.light.scope(body); } },
});
