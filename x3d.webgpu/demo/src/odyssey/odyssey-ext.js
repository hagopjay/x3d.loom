/* A Material Odyssey on Babylon: what the film needs that the earlier ports did not.  Loaded after drift-ext.js and before sai.js.

   The file is a lit set: 35 PBR materials (base colour, metallic-roughness and normal maps), 60 lights, one Viewpoint driven by interpolators.
   Four things were missing from the body and are added here, each one an X3D rule rather than a taste:
     1. Lighting scope.  59 of the 60 lights have global="false": 19775-1 17.2.1 lights a shape only when the light is a sibling of it (or sits above it in the same group).
        Babylon lights every mesh unless told otherwise, and caps a material at 8 lights, so the scope IS the light budget: light.includedOnlyMeshes = the shapes under the light's parent.
        A shape in the hall sees its own group's 3 to 5 lights, not all 60.
     2. Light units.  intensity is candela and radius a hard range, the glTF punctual model that X_ITE's PhysicalMaterial uses: light.falloffType = FALLOFF_GLTF, range = radius,
        spot cone = 2 x cutOffAngle with an inner cone of 2 x beamWidth.
     3. metallicRoughnessTexture (glTF packing: roughness in green, metalness in blue), data textures read as linear, normal maps in the glTF (+Y) convention.
     4. Directional lights that sit in a group take the group's rotation (they are parented to it).
   The look layer (OD.on) only ADDS to the file and can be switched to "As authored": reflections from a generated gold-hall environment, bloom, grain, vignette, a little air.
   Nothing here asserts a light, a colour or a camera the X3D does not carry (Loom law 40). */
(function () {
  const B_ = Body.prototype, Q = new URLSearchParams(location.search);
  const OD = window.__odysseyLook = {
    on: Q.get('look') !== '0', lightScale: Q.has('lightScale') ? +Q.get('lightScale') : 1, envBase: Q.has('env') ? +Q.get('env') : 1, shadowLights: Q.get('shadows') === '0' ? 0 : 3,
    bloom: Q.has('bloom') ? +Q.get('bloom') : 0.32, grain: Q.has('grain') ? +Q.get('grain') : 7, dust: Q.get('dust') !== '0',
  };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const SCOPED = /^(SpotLight|PointLight|DirectionalLight)$/;

  /* ---------------------------------------------------------------- 1. lighting scope */
  /* A node placed twice with USE is two placements: <SpotLight USE="Rim"/> lights the group it is placed in as well as the group that holds the original. Each placement gets its own
     Babylon light, remembered with the transform node of the group it sits in; the shapes that light reaches are that group's descendants. */
  const _build = B_.build;
  B_.build = function (n, parent, chain) {
    if (n && n.type === 'DirectionalLight') {   // the body keeps one directional light per node; the film places two of them twice
      (this.dirPlacements ||= []).push({ n, tn: parent });
      return null;
    }
    return _build.call(this, n, parent, chain);
  };
  B_.meshesUnder = function (tn) { return tn.getChildMeshes(false).filter((m) => !(m.metadata && m.metadata.text)); };
  B_.applyLightScopes = function () {
    this.scopeStats = { scoped: 0, global: 0, empty: 0, perMeshMax: 0 };
    const count = new Map();
    for (const l of this.scene.lights) {
      if (!l.node) continue;
      if (l.node.f.global !== false || !l._scopeTN) { this.scopeStats.global++; continue; }
      const meshes = this.meshesUnder(l._scopeTN);
      if (!meshes.length) { l._scopeEmpty = true; l.setEnabled(false); this.scopeStats.empty++; continue; }   // an empty includedOnlyMeshes would mean "everything"
      l.includedOnlyMeshes = meshes; this.scopeStats.scoped++;
      for (const m of meshes) count.set(m, (count.get(m) || 0) + 1);
    }
    // the most lights any one mesh answers to (global lights reach every mesh): this has to stay under the material cap of 8
    const globals = this.scene.lights.filter((l) => l.node && !l.includedOnlyMeshes.length && !l._scopeEmpty).length;
    for (const v of count.values()) this.scopeStats.perMeshMax = Math.max(this.scopeStats.perMeshMax, v + globals);
  };
  const _buildLights = B_.buildLights;
  B_.buildLights = function () {
    _buildLights.call(this);
    for (const p of this.dirPlacements || []) {
      const l = new BABYLON.DirectionalLight(p.n.def || 'dir', new BABYLON.Vector3(0, -1, 0), this.scene);
      l.node = p.n; this.lights.push(l); this.refreshLight(l);
      if (p.n.f.global === false) { l._scopeTN = p.tn; l.parent = p.tn; }   // 4. the group's rotation turns the light
    }
    this.dirPlacements = [];
    this.applyLightScopes();
  };

  /* ---------------------------------------------------------------- 2. light units: glTF punctual lights */
  const _buildSpot = B_.buildSpot, _buildPoint = B_.buildPoint;
  const placed = function (body, n, l, parent) { l.falloffType = BABYLON.Light.FALLOFF_GLTF; l._scopeTN = parent; (body.lightsOf ||= new Map()).set(n, (body.lightsOf.get(n) || []).concat(l)); body.refreshPointish(l); };
  B_.buildSpot = function (n, parent, chain) { const r = _buildSpot.call(this, n, parent, chain); placed(this, n, r.light, parent); return r; };
  B_.buildPoint = function (n, parent, chain) { const r = _buildPoint.call(this, n, parent, chain); placed(this, n, r.light, parent); return r; };
  B_.refreshPointish = function (l) {
    const f = l.node.f, c = f.color;
    l.diffuse = new BABYLON.Color3(c[0], c[1], c[2]); l.specular = new BABYLON.Color3(c[0], c[1], c[2]);
    l.intensity = f.intensity * OD.lightScale;
    l.range = f.radius > 0 ? f.radius : Number.MAX_VALUE;
    l.position.set(f.location[0], f.location[1], f.location[2]);
    if (l instanceof BABYLON.SpotLight) {
      l.direction.set(f.direction[0], f.direction[1], f.direction[2]);
      l.angle = Math.min(Math.PI - 0.02, Math.max(0.02, f.cutOffAngle * 2));
      l.innerAngle = Math.min(l.angle, Math.max(0, f.beamWidth * 2));
    }
    l.setEnabled(f.on !== false && !l._scopeEmpty);
  };
  /* the interpolators move 56 intensities a frame: that path must not rebuild colours */
  const _changed = B_.changed;
  B_.changed = function (node, field) {
    if (node.type === 'SpotLight' || node.type === 'PointLight') {
      for (const l of (this.lightsOf && this.lightsOf.get(node)) || []) { if (field === 'intensity') l.intensity = node.f.intensity * OD.lightScale; else this.refreshPointish(l); }
      return;
    }
    if (node.type === 'DirectionalLight') { for (const l of this.lights) if (l.node === node) this.refreshLight(l); return; }
    return _changed.call(this, node, field);
  };

  /* ---------------------------------------------------------------- 3. materials */
  const _makeMaterial = B_.makeMaterial;
  B_.makeMaterial = function (shape, g, spec, mesh) {
    const m = _makeMaterial.call(this, shape, g, spec, mesh);
    if (spec.kind !== 'pbr' || !(m instanceof BABYLON.PBRMaterial)) return m;
    const f = spec.mat.f, app = shape.f.appearance;
    this._curTT = app && app.f.textureTransform;            // the Appearance's TextureTransform moves every map the material carries
    try {
      const mr = f.metallicRoughnessTexture && this.tex(f.metallicRoughnessTexture);
      if (mr) {
        mr.gammaSpace = false;                               // data, not colour
        m.metallicTexture = mr; m.useRoughnessFromMetallicTextureGreen = true; m.useMetallnessFromMetallicTextureBlue = true; m.useRoughnessFromMetallicTextureAlpha = false;
        m.metallic = f.metallic; m.roughness = f.roughness;  // glTF factors multiply the map
      }
      if (m.bumpTexture) m.bumpTexture.gammaSpace = false;
      for (const t of [m.albedoTexture, m.bumpTexture, m.metallicTexture]) if (t) t.anisotropicFilteringLevel = 8;
    } finally { this._curTT = null; }
    m.enableSpecularAntiAliasing = true;                     // normal maps this fine shimmer without it (seen on the hex carpet at low resolution)
    m.environmentIntensity = 1;                              // the scene's generated environment (look on) or none (As authored: scene.environmentTexture is cleared)
    m.metallicF0Factor = 1;
    return m;
  };
  const _refreshPBR = B_.refreshPBR;
  B_.refreshPBR = function (m, mat) {
    _refreshPBR.call(this, m, mat);
    if (m.metallicTexture) { m.metallic = mat.f.metallic; m.roughness = mat.f.roughness; }
  };

  /* UnlitMaterial with an emissiveTexture: X3D 4.0 (and glTF) multiply the texture by the colour, and the film animates that colour (the corridor's slit-scan walls are black until
     their colour rises). Babylon's StandardMaterial ADDS an emissive texture to its emissive colour, so a texture at colour 0 would still glow and one at pink would flood pink.
     With lighting off StandardMaterial computes (emissiveColor + ambient) x the diffuse texture's colour (diffuseColor drops out with the lights): the texture moves to the diffuse slot, the colour stays in emissiveColor. */
  const _refreshUnlit = B_.refreshUnlit;
  B_.refreshUnlit = function (m, mat, g) {
    if (m.emissiveTexture && !m._odyTex) { m._odyTex = m.emissiveTexture; m.emissiveTexture = null; m.diffuseTexture = m._odyTex; m.useAlphaFromDiffuseTexture = false; m.zOffset = 4; m.zOffsetUnits = 8; }   // the file lays glow panels coplanar with lit floors (white room); X_ITE shows the floor, so the panel sits just behind it
    _refreshUnlit.call(this, m, mat, g);
  };

  /* Box, Sphere, Cylinder and Cone come from MeshBuilder, whose winding already suits Babylon in a right-handed scene; the body's counter-clockwise flag is for imported
     IndexedFaceSets and would turn a primitive inside out (the shelf's spheres drew hollow, dark in the middle and lit at the rim). */
  const _makeMesh = B_.makeMesh;
  B_.makeMesh = function (shape, g, spec, pass) {
    const mesh = _makeMesh.call(this, shape, g, spec, pass);
    if (mesh && mesh.material && /^(Box|Sphere|Cylinder|Cone)$/.test(g.type)) mesh.material.sideOrientation = null;
    return mesh;
  };

  /* ---------------------------------------------------------------- the first Viewpoint is bound at load (19775-1 23.3.4) */
  const _setWorld = B_.setWorld;
  B_.setWorld = function (world, baseUrl, resolve) {
    this.lightsOf = new Map(); this.dirPlacements = [];
    _setWorld.call(this, world, baseUrl, resolve);
    if (!this.bound) { const vp = world.nodes.find((n) => n.type === 'Viewpoint'); if (vp) this.bindViewpoint(vp, true); }
    this.lightRef = filmLightReference(world);
    if (!OD.installed) {
      OD.installed = true;
      try { this.installOdysseyLook(); } catch (e) { console.error(e); this.note('The look layer failed to start (' + (e && e.message) + '): drawing As authored'); OD.on = false; OD.failed = String(e && e.message || e); }
    }
    this.installShadows();
  };

  /* the film's own light level: the sum of intensity x luminance over the lights, sampled once a second along the interpolators; its 85th percentile is the reference
     the reflections follow (the same rule the three.js engine on this page uses, so the two engines agree about how much the room is lit) */
  function filmLightReference(world) {
    const lights = new Map();
    for (const r of world.routes) if (r.toField === 'intensity' && r.from.type === 'ScalarInterpolator' && SCOPED.test(r.to.type)) lights.set(r.to, r.from);
    for (const n of world.nodes) if (SCOPED.test(n.type) && !lights.has(n)) lights.set(n, null);
    const at = (ip, fr) => {
      const k = ip.f.key, v = ip.f.keyValue, N = Math.min(k.length, v.length); if (!N) return 0;
      if (fr <= k[0]) return v[0]; if (fr >= k[N - 1]) return v[N - 1];
      let i = 0; while (i < N - 1 && fr >= k[i + 1]) i++;
      const s = (fr - k[i]) / Math.max(1e-9, k[i + 1] - k[i]); return v[i] + (v[i + 1] - v[i]) * s;
    };
    const L = []; for (let t = 0; t < 138; t++) { let a = 0; for (const [n, ip] of lights) a += (ip ? at(ip, t / 138) : n.f.intensity) * lum(n.f.color); L.push(a); }
    L.sort((a, b) => a - b);
    return Math.max(1e-3, L[Math.floor(L.length * 0.85)] || 1);
  }

  /* ---------------------------------------------------------------- shadows: the key lights that carry the drama cast, the rest do not */
  const SHADOW_PRIORITY = ['Key', 'DaisPool', 'Oculus', 'EdgeL', 'EdgeR', 'Rim'];
  B_.installShadows = function () {
    OD.shadowGens = [];
    if (!OD.shadowLights) return;
    for (const def of SHADOW_PRIORITY) {
      if (OD.shadowGens.length >= OD.shadowLights) break;
      const l = this.scene.lights.find((x) => x.node && x.node.def === def && x instanceof BABYLON.SpotLight);
      if (!l || !l.includedOnlyMeshes || !l.includedOnlyMeshes.length) continue;
      const sg = new BABYLON.ShadowGenerator(1024, l);
      sg.usePercentageCloserFiltering = true; sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
      sg.bias = 0.0006; sg.normalBias = 0.02; sg.setDarkness(0);
      l.shadowMinZ = 0.3; l.shadowMaxZ = Math.min(l.range, 90);
      for (const m of l.includedOnlyMeshes) { if (m.metadata && m.metadata.shape && m.metadata.shape.f.castShadow === false) continue; sg.addShadowCaster(m); m.receiveShadows = true; }
      l._shadowGen = sg; OD.shadowGens.push(sg);
    }
  };

  /* ---------------------------------------------------------------- the look: reflections, bloom, grain, vignette, air */
  /* a gold hall as a cube map: warm floor, amber horizon, black ceiling with long soft boxes; 8-bit sRGB canvases carry linear value / 6, the scene scales it back up */
  const HDR = 6;
  function goldHallCube(scene, engine, done) {
    const S = 128, order = ['right', 'top', 'back', 'left', 'bottom', 'front'];
    const dirOf = (face, u, v) => { const x = 2 * u - 1, y = 1 - 2 * v; switch (face) { case 'front': return [x, y, -1]; case 'back': return [-x, y, 1]; case 'left': return [-1, y, -x]; case 'right': return [1, y, x]; case 'top': return [x, 1, y]; default: return [x, -1, -y]; } };
    const enc = (v) => { v = Math.min(1, Math.max(0, v / HDR)); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
    const col = (d) => {
      const l = Math.hypot(d[0], d[1], d[2]), x = d[0] / l, y = d[1] / l, z = d[2] / l;
      let r, g, b;
      if (y >= 0) { const t = Math.pow(y, 0.6); r = 0.34 * (1 - t) + 0.02 * t; g = 0.22 * (1 - t) + 0.016 * t; b = 0.12 * (1 - t) + 0.02 * t; }
      else { const t = Math.pow(-y, 0.5); r = 0.34 * (1 - t) + 0.10 * t; g = 0.22 * (1 - t) + 0.07 * t; b = 0.12 * (1 - t) + 0.045 * t; }
      // two long soft boxes high overhead (cream), one warm window low on one side
      const box = (cx, cz, hw, hl, k, c) => { const ax = Math.abs(x - cx), az = Math.abs(z - cz); if (y > 0.55 && ax < hw && az < hl) { const e = Math.min(1, (hw - ax) / 0.08, (hl - az) / 0.08); r += c[0] * k * e; g += c[1] * k * e; b += c[2] * k * e; } };
      box(-0.38, 0, 0.16, 0.95, 5, [1, 0.92, 0.78]); box(0.38, 0, 0.16, 0.95, 5, [1, 0.92, 0.78]);
      if (x > 0.7 && y > -0.1 && y < 0.5 && Math.abs(z) < 0.55) { r += 3.2; g += 2.3; b += 1.2; }
      return [r, g, b];
    };
    const urls = order.map((face) => {
      const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const v = col(dirOf(face, (i + 0.5) / S, (j + 0.5) / S)), o = (j * S + i) * 4;
        im.data[o] = enc(v[0]) * 255; im.data[o + 1] = enc(v[1]) * 255; im.data[o + 2] = enc(v[2]) * 255; im.data[o + 3] = 255;
      }
      g.putImageData(im, 0, 0); return c.toDataURL('image/png');
    });
    const cube = new BABYLON.CubeTexture('', scene, null, false, urls, null, null, BABYLON.Constants.TEXTUREFORMAT_RGBA, false, '.png');
    cube.gammaSpace = true;
    const noDiffuse = () => { try { cube.sphericalPolynomial = null; cube.irradianceTexture = null; } catch (e) { /* not set */ } };   // reflections only: the room is lit by the file's lights, not by this sky
    cube.onLoadObservable.addOnce(() => { noDiffuse(); try { new BABYLON.HDRFiltering(engine).prefilter(cube).then(() => { noDiffuse(); done && done(cube); }).catch(() => done && done(cube)); } catch (e) { done && done(cube); } });
    return cube;
  }

  B_.installOdysseyLook = function () {
    const scene = this.scene, cam = scene.activeCamera, body = this;
    OD.body = this;
    const env = OD.env = goldHallCube(scene, this.engine);
    const pipe = OD.pipe = new BABYLON.DefaultRenderingPipeline('odysseyHDR', true, scene, [cam]);
    pipe.samples = 4;
    pipe.bloomEnabled = true; pipe.bloomThreshold = 0.9; pipe.bloomWeight = OD.bloom; pipe.bloomKernel = 64; pipe.bloomScale = 0.5;
    pipe.grainEnabled = true; pipe.grain.intensity = OD.grain; pipe.grain.animated = true;
    const ip = pipe.imageProcessing;
    ip.toneMappingEnabled = true; ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL; ip.exposure = 1;
    ip.vignetteEnabled = true; ip.vignetteWeight = 1.7; ip.vignetteStretch = 0.25; ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
    // air: slow dust turning in the lens' neighbourhood; additive, small, faint
    const tex = new BABYLON.DynamicTexture('dust-dot', 64, scene, true); const g = tex.getContext(); const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,240,215,1)'); grad.addColorStop(0.35, 'rgba(255,225,185,0.35)'); grad.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64); tex.update();
    const em = new BABYLON.Vector3(0, 0, 0), ps = OD.dustPs = new BABYLON.ParticleSystem('dust', 1400, scene);
    ps.particleTexture = tex; ps.emitter = em; ps.createBoxEmitter(new BABYLON.Vector3(0.03, 0.02, 0.03), new BABYLON.Vector3(-0.03, -0.01, -0.03), new BABYLON.Vector3(-9, -5, -9), new BABYLON.Vector3(9, 6, 9));
    ps.minLifeTime = 7; ps.maxLifeTime = 12; ps.emitRate = 150; ps.minSize = 0.012; ps.maxSize = 0.04; ps.color1 = new BABYLON.Color4(1, 0.93, 0.8, 0.45); ps.color2 = new BABYLON.Color4(1, 0.85, 0.6, 0.25); ps.colorDead = new BABYLON.Color4(1, 0.85, 0.6, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD; ps.updateSpeed = 0.012; ps.preWarmCycles = 120; ps.preWarmStepOffset = 4; ps.renderingGroupId = 1; ps.disposeOnStop = false; ps.start();
    OD.dustAnchor = em;
    OD.apply = (on) => {
      OD.on = on;
      scene.environmentTexture = on ? env : null;
      pipe.bloomEnabled = on; pipe.grainEnabled = on; ip.vignetteEnabled = on;
      pipe.imageProcessingEnabled = true;
      if (OD.dust) { if (on) ps.start(); else ps.stop(); }
      ps.isVisible = on;
      for (const sg of OD.shadowGens || []) sg.getShadowMap().refreshRate = on ? 1 : 0;
      for (const sg of OD.shadowGens || []) { sg.setDarkness(on ? 0 : 1); }   // As authored: no shadows (the file asks for none)
      scene.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_TextureDirtyFlag);
    };
    OD.apply(OD.on);
  };

  /* per frame: the reflections follow the film's light, the air follows the lens */
  const _frame = B_.frame;
  B_.frame = function () {
    if (OD.installed && OD.on && this.world) {
      let level = 0; for (const l of this.scene.lights) if (l.node && l.node.f.intensity > 0 && !l._scopeEmpty) level += l.node.f.intensity * lum(l.node.f.color);
      const k = Math.min(1.3, Math.max(0.35, Math.sqrt(level / (this.lightRef || 1))));
      this.scene.environmentIntensity = OD.envBase * HDR * 0.3 * k;
      if (OD.dustAnchor && this.scene.activeCamera) OD.dustAnchor.copyFrom(this.scene.activeCamera.position);
    }
    return _frame.call(this);
  };

  /* counts for the page's About panel and the receipt */
  B_.odysseyInfo = function () {
    const s = this.scene;
    return { babylon: BABYLON.Engine.Version, meshes: s.meshes.length, lights: s.lights.length, materials: s.materials.length, textures: s.textures.length, active: s.getActiveMeshes().length,
      scope: this.scopeStats, look: OD.on, lightRef: this.lightRef, shadowLights: (OD.shadowGens || []).length };
  };
})();
