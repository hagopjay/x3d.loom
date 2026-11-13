/* Electron Cloud: body changes and the look. Loaded after drift-ext.js and before sai.js.
   Page-side facts this file answers: the page makes Shapes with no geometry, puts them into a Switch, and gives each its mesh later (a Shape's geometry
   field changes); a TimeSensor drives an IntegerSequencer whose value reaches the page through addFieldCallback (reader.js and sai.js). */
(function () {
  const B_ = Body.prototype;
  const L = window.__cloudLook = { on: new URLSearchParams(location.search).get('look') !== '0' };

  /* a Shape that got its geometry after it was built: build its meshes in place (a Shape with no geometry has no transform node yet) */
  const _changed = B_.changed;
  B_.changed = function (node, field) {
    if (node.type === 'Shape' && field === 'geometry') {
      const r = this.rec.get(node.id); if (!r) return;
      if (r.tn) { this.rebuildShapeIn(r); return; }
      let pr = null; for (const x of this.rec.values()) if (x.kids && x.kids.includes(r)) { pr = x; break; }
      if (!pr) return;
      const nr = this.build(node, pr.tn, pr.chain); pr.kids[pr.kids.indexOf(r)] = nr;
      if (pr.node.type === 'Switch') this.applySwitch(pr.node);
      return;
    }
    return _changed.call(this, node, field);
  };

  const isSkin = (shape) => { const ap = shape && shape.f.appearance; return !!(ap && ap.def === 'Skin'); };
  const lookMaterial = (scene) => {
    // a lit, glossy, self-glowing shell: StandardMaterial multiplies (diffuse light + emissive) by the vertex colour, so the sign of the wave (orange +, blue -) tints both
    // the lit side and the glow; the emissive term is strongest at the silhouette (a rim), which blooms
    const s = new BABYLON.StandardMaterial('skin-look', scene);
    s.diffuseColor.set(0.8, 0.8, 0.8); s.specularColor.set(0.4, 0.4, 0.4); s.specularPower = 40; s.useVertexColors = true; s.backFaceCulling = false;
    s.emissiveColor.set(1, 1, 1);
    s.emissiveFresnelParameters = new BABYLON.FresnelParameters({ bias: 0.18, power: 2.4, leftColor: new BABYLON.Color3(1.0, 1.0, 1.0), rightColor: new BABYLON.Color3(0.3, 0.3, 0.3) });
    return s;
  };
  const putMaterial = function (mesh) {
    if (!mesh) return;
    if (!mesh._pbrMat) mesh._pbrMat = mesh.material;
    if (L.on) { mesh._lookMat = mesh._lookMat || (this._skinLook ||= lookMaterial(this.scene)); mesh.material = mesh._lookMat; mesh.useVertexColors = true; }
    else mesh.material = mesh._pbrMat;
  };
  const _mk = B_.makeMesh;
  B_.makeMesh = function (shape, g, spec, passIndex) {
    const m = _mk.call(this, shape, g, spec, passIndex);
    if (m && isSkin(shape) && L.on) putMaterial.call(this, m);
    return m;
  };
  B_.cloudSkins = function () { const o = []; for (const r of this.rec.values()) if (r.node && r.node.type === 'Shape' && isSkin(r.node) && r.meshes) for (const m of r.meshes) o.push(m); return o; };

  B_.installCloudLook = function () {
    const scene = this.scene, cam = scene.activeCamera;
    L.body = this;
    const pipe = new BABYLON.DefaultRenderingPipeline('cloudHDR', true, scene, [cam]);
    pipe.bloomEnabled = true; pipe.bloomThreshold = 0.4; pipe.bloomWeight = 1.0; pipe.bloomKernel = 72; pipe.bloomScale = 0.5; pipe.fxaaEnabled = true;
    pipe.imageProcessing.toneMappingEnabled = true; pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL; pipe.imageProcessing.exposure = 1.25;
    pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 1.6; pipe.imageProcessing.vignetteStretch = 0.3;
    L.pipe = pipe;
    // a soft sky/ground fill so the side facing away from the three key lights keeps its colour instead of going black (the shell's own ambient term had no effect on this
    // Babylon build, a fill light does); it is switched off with the look
    const fill = new BABYLON.HemisphericLight('cloudFill', new BABYLON.Vector3(0.25, 1, 0.15), scene);
    fill.diffuse.set(0.85, 0.92, 1); fill.groundColor.set(0.5, 0.35, 0.3); fill.specular.set(0, 0, 0); fill.intensity = 0.42;
    L.fill = fill;
    L.apply = (on) => {
      L.on = on; fill.setEnabled(on);
      pipe.bloomEnabled = on; pipe.imageProcessingEnabled = on;
      scene.imageProcessingConfiguration.toneMappingEnabled = !on;   // the pipeline tone maps once at the end when the look is on
      for (const m of this.cloudSkins()) putMaterial.call(this, m);
      for (const l of scene.lights) { if (l === fill) continue; if (l._i0 === undefined) l._i0 = l.intensity; l.intensity = on ? l._i0 * 0.55 : l._i0; }
    };
    L.apply(L.on);
  };

  const _setWorld = B_.setWorld;
  B_.setWorld = function (world, baseUrl, resolve) {
    _setWorld.call(this, world, baseUrl, resolve);
    if (!this.bound) { const vp = world.nodes.find((n) => n.type === 'Viewpoint'); if (vp) this.bindViewpoint(vp, true); }   // X3D binds the first Viewpoint at load
    if (L.installed) return;
    L.installed = true;
    try { this.installCloudLook(); } catch (e) { console.error(e); this.note('The look layer failed to start (' + (e && e.message) + '): drawing As authored'); L.on = false; L.failed = String(e && e.message || e); }
    const mk = () => {
      const st = document.getElementById('stage'); if (!st || document.getElementById('lookSwitch')) return;
      const b = document.createElement('button'); b.id = 'lookSwitch'; b.type = 'button';
      b.style.cssText = 'position:absolute;right:14px;top:12px;z-index:5;padding:6px 12px;border-radius:999px;border:1px solid #6d86b8;background:rgba(10,14,26,.72);color:#dbe6ff;font:12px system-ui,sans-serif;cursor:pointer';
      const upd = () => { b.textContent = L.on ? 'Look: cinematic (Babylon bloom + glow shell)' : 'Look: as authored'; b.setAttribute('aria-pressed', String(L.on)); };
      b.onclick = () => { if (L.apply) L.apply(!L.on); upd(); }; upd(); st.appendChild(b);
      const tag = document.createElement('div'); tag.id = 'bjsTag';
      tag.style.cssText = 'position:absolute;left:14px;bottom:56px;z-index:4;font:11px system-ui,sans-serif;color:#8fa3cc;opacity:.85';
      tag.textContent = 'Babylon ' + BABYLON.Engine.Version + ' WebGPU' + (L.failed ? ' · look failed, drawing as authored' : '');
      st.appendChild(tag);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
  };
})();
