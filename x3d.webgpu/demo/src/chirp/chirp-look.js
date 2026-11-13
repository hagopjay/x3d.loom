/* Chirp-specific body changes. Loaded after drift-ext.js (dynamic geometry) and before sai.js.
   Orbit trails: the study's two IndexedLineSets are redrawn every frame (a new polyline of the last orbit), so the body draws each as a thin
   emissive tube when the look is on, and as the brain port's ribbon when it is off. */
(function () {
  const B_ = Body.prototype;
  const GLOW = 1.35;   // HDR emissive gain: the look layer's bloom turns this into a glow; with the look off it is clamped by the tone mapper
  const _ribbon = B_.makeRibbon;   // the brain port's screen-space ribbon: "As authored" (X_ITE draws these lines one pixel wide)
  B_.makeRibbon = function (shape, g, spec, name) {
    if (!(window.__chirpLook && window.__chirpLook.on)) return _ribbon.call(this, shape, g, spec, name);
    const f = g.f, P = f.coord && f.coord.f.point, ci = f.coordIndex;
    if (!P || !ci) return null;
    const path = [];
    for (let i = 0; i < ci.length && ci[i] >= 0; i++) { const a = ci[i]; path.push(new BABYLON.Vector3(P[a * 3], P[a * 3 + 1], P[a * 3 + 2])); }
    if (path.length < 2) return null;
    const mesh = BABYLON.MeshBuilder.CreateTube(name, { path, radius: (this.opts.trailRadius || 0.0028), tessellation: 6, cap: BABYLON.Mesh.NO_CAP, updatable: false }, this.scene);
    const m = new BABYLON.StandardMaterial('trail-' + shape.id, this.scene);
    const e = (spec.mat && spec.mat.f.emissiveColor) || [1, 1, 1];
    m.disableLighting = true; m.diffuseColor.set(0, 0, 0); m.specularColor.set(0, 0, 0);
    m.emissiveColor.set(e[0] * GLOW, e[1] * GLOW, e[2] * GLOW);
    mesh.material = m; mesh.isPickable = false; mesh.metadata = { trail: true };
    return mesh;
  };
})();

/* ------------------------------------------------------------------ the look: HDR bloom, gravitational lensing, glowing trails. Off = "As authored" (law 39). */
window.__chirpLook = { on: new URLSearchParams(location.search).get('look') !== '0' };
/* the wave sheet: lit PBR as authored; with the look on, an unlit vertex-colour material whose colours carry HDR gain (see the in-place update) */
Body.prototype.chirpSheetMaterial = function () {
  const L = window.__chirpLook;
  for (const r of this.rec.values()) {
    if (!(r.node && r.node.type === 'Shape' && r.node.def === 'Ripple' && r.meshes && r.meshes[0])) continue;
    const m = r.meshes[0];
    if (!m._pbrMat) m._pbrMat = m.material;
    if (L.on) {
      if (!m._lookMat) { const s = new BABYLON.StandardMaterial('sheet-look', this.scene); s.disableLighting = true; s.diffuseColor.set(0, 0, 0); s.emissiveColor.set(1, 1, 1); s.specularColor.set(0, 0, 0); s.useVertexColors = true; s.backFaceCulling = false; m._lookMat = s; }
      m.material = m._lookMat; m.useVertexColors = true;
    } else m.material = m._pbrMat;
  }
};
const _mk = Body.prototype.makeMesh;
Body.prototype.makeMesh = function (shape, g, spec, passIndex) {
  const m = _mk.call(this, shape, g, spec, passIndex);
  if (m && shape.def === 'Ripple' && window.__chirpLook.on) { m._pbrMat = m.material; const s = new BABYLON.StandardMaterial('sheet-look', this.scene); s.disableLighting = true; s.diffuseColor.set(0, 0, 0); s.emissiveColor.set(1, 1, 1); s.specularColor.set(0, 0, 0); s.useVertexColors = true; s.backFaceCulling = false; m._lookMat = s; m.material = s; m.useVertexColors = true; const gc = shape.f.geometry && shape.f.geometry.f.color; if (gc) this.geometryChanged(gc); }
  return m;
};
Body.prototype.installChirpLook = function () {
  const scene = this.scene, cam = scene.activeCamera, L = window.__chirpLook;
  L.body = this;
  const SF = BABYLON.ShaderStore.ShadersStoreWGSL;
  SF['chirpLensFragmentShader'] = `
varying vUV: vec2f;
var textureSampler: texture_2d<f32>;
var textureSamplerSampler: sampler;
uniform holes: array<vec4f, 2>;   // x, y in uv, z = horizon radius in uv-height units, w = on
uniform aspect: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  var uv = fragmentInputs.vUV;
  var shade = 1.0;
  for (var i = 0; i < 2; i = i + 1) {
    let h = uniforms.holes[i];
    if (h.w > 0.5) {
      var d = uv - h.xy; d.x = d.x * uniforms.aspect;
      let r = max(length(d), 1e-5);
      // thin-lens deflection of a point mass: alpha = 4GM/(c^2 r) with the horizon radius rs = 2GM/c^2, so alpha = 2 rs / r; shown at a third of strength so the picture stays readable
      let rs = h.z;
      let a = min(0.6 * rs * rs / r, 0.18);
      var dir = d / r; dir.x = dir.x / uniforms.aspect;
      uv = uv - dir * a;
      shade = shade * smoothstep(rs * 0.92, rs * 1.25, r);
    }
  }
  let c = textureSample(textureSampler, textureSamplerSampler, uv);
  fragmentOutputs.color = vec4f(c.rgb * shade, c.a);
}`;
  const holes = [this.world.defs.get('Hole1'), this.world.defs.get('Hole2')];
  const rad = [this.world.defs.get('Hole1Sphere'), this.world.defs.get('Hole2Sphere')];
  const lens = new BABYLON.PostProcess('chirpLens', 'chirpLens', {
    uniforms: ['holes', 'aspect'], samplers: [], size: 1.0, camera: cam, engine: this.engine, samplingMode: BABYLON.Texture.BILINEAR_SAMPLINGMODE,
    shaderLanguage: BABYLON.ShaderLanguage.WGSL, textureType: BABYLON.Constants.TEXTURETYPE_HALF_FLOAT,
  });
  const vp = BABYLON.Vector3.Zero();
  lens.onApplyObservable.add((eff) => {
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    const arr = [];
    for (let i = 0; i < 2; i++) {
      const r = this.rec.get(holes[i] && holes[i].id), tn = r && r.tn;
      if (!tn) { arr.push(0, 0, 0, 0); continue; }
      const wp = tn.getAbsolutePosition(), dist = BABYLON.Vector3.Distance(wp, cam.position);
      const p = BABYLON.Vector3.Project(wp, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
      const radius = rad[i] ? rad[i].f.radius : 0.02;
      const fov = cam.fov || 0.7, pxPerUnit = (h / 2) / Math.tan(fov / 2) / dist;
      arr.push(p.x / w, p.y / h, radius * pxPerUnit / h, L.on ? 1 : 0);
    }
    eff.setArray4('holes', arr); eff.setFloat('aspect', w / h);
  });
  L.lens = lens;
  const pipe = new BABYLON.DefaultRenderingPipeline('chirpHDR', true, scene, [cam]);
  pipe.bloomEnabled = true; pipe.bloomThreshold = 0.9; pipe.bloomWeight = 1.1; pipe.bloomKernel = 64; pipe.bloomScale = 0.5;
  pipe.fxaaEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true; pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL; pipe.imageProcessing.exposure = 1.0;
  L.pipe = pipe;
  L.apply = (on) => {
    L.on = on;
    // look on: the materials write linear HDR, the pipeline blooms what is brighter than 1 and tone maps once at the end (same operator as As authored)
    // look off: the scene tone maps in the materials as the authored look does, no pipeline stage
    pipe.bloomEnabled = on; pipe.imageProcessingEnabled = on;
    scene.imageProcessingConfiguration.toneMappingEnabled = !on;
    for (const l of scene.lights) { if (l._i0 === undefined) l._i0 = l.intensity; l.intensity = on ? l._i0 * 0.6 : l._i0; }
    this.chirpSheetMaterial();
    // the sheet's colours get their gain on the next in-place update
    for (const n of this.world.nodes) if (n.type === 'Color' || (n.type === 'Coordinate' && n.def === 'RippleCoord')) this.geometryChanged(n);
    // trails switch between tube and ribbon: rebuild the two line sets
    for (const n of this.world.nodes) if (n.type === 'Coordinate' && /^Trail/.test(n.def || '')) this.geometryChanged(n);
  };
  L.apply(L.on);
};

const _setWorld = Body.prototype.setWorld;
Body.prototype.setWorld = function (world, baseUrl, resolve) {
  _setWorld.call(this, world, baseUrl, resolve);
  const L = window.__chirpLook;
  // X3D binds the first Viewpoint of a world when it loads; the body leaves that to the page, and Chirp's page only binds on a click
  if (!this.bound) { const vp = world.nodes.find((n) => n.type === 'Viewpoint'); if (vp) this.bindViewpoint(vp, true); }
  if (L.installed) return;
  L.installed = true;
  try { this.installChirpLook(); } catch (e) { console.error(e); this.note('The look layer failed to start (' + (e && e.message) + '): drawing As authored'); L.on = false; L.failed = String(e && e.message || e); }
  // the switch (law 39: a look may add, never assert; it can always be turned off)
  const mk = () => {
    const st = document.getElementById('stage'); if (!st || document.getElementById('lookSwitch')) return;
    const b = document.createElement('button'); b.id = 'lookSwitch'; b.type = 'button';
    b.style.cssText = 'position:absolute;right:14px;top:12px;z-index:5;padding:6px 12px;border-radius:999px;border:1px solid #6d86b8;background:rgba(10,14,26,.72);color:#dbe6ff;font:12px system-ui,sans-serif;cursor:pointer';
    const upd = () => { b.textContent = L.on ? 'Look: cinematic (Babylon bloom + lensing)' : 'Look: as authored'; b.setAttribute('aria-pressed', String(L.on)); };
    b.onclick = () => { L.apply(!L.on); upd(); }; upd(); st.appendChild(b);
    const tag = document.createElement('div'); tag.id = 'bjsTag';
    tag.style.cssText = 'position:absolute;left:14px;bottom:130px;z-index:4;font:11px system-ui,sans-serif;color:#8fa3cc;opacity:.85';
    tag.textContent = 'Babylon ' + BABYLON.Engine.Version + ' WebGPU' + (L.failed ? ' · look failed, drawing as authored' : '');
    st.appendChild(tag);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
};

/* The wave sheet changes all 21,120 vertices every frame. drift-ext rebuilds a changed mesh (dispose and build); for a triangle set whose vertex count did not change
   the buffers are updated in place instead: positions, recomputed normals, colours. Anything else falls through to drift-ext's rebuild. */
const MID_ = [Math.pow(0xc9 / 255, 2.2), Math.pow(0xd3 / 255, 2.2), Math.pow(0xe6 / 255, 2.2)];   // the study's calm-sheet colour, linear
const _frameBase = Body.prototype.frame;
Body.prototype.frame = function () {
  const dirty = this._dirtyGeo;
  if (dirty && dirty.size && this.world) {
    for (const x of this.world.nodes) {
      if (x.type !== 'IndexedTriangleSet') continue;
      const c = x.f.coord, k = x.f.color, nv = x.f.normal;
      if (!(dirty.has(x) || (c && dirty.has(c)) || (k && dirty.has(k)) || (nv && dirty.has(nv)))) continue;
      const P = c && c.f.point; if (!P || !P.length) continue;
      let m = null; for (const r of this.rec.values()) if (r.node && r.node.type === 'Shape' && r.node.f.geometry === x && r.meshes && r.meshes[0]) { m = r.meshes[0]; break; }
      if (!m || m.getTotalVertices() * 3 !== P.length || (x.f.index.length !== m.getTotalIndices()) || nv) continue;
      if (!m._chirpUpd) { m.setVerticesData('position', P, true); m.setVerticesData('normal', new Float32Array(P.length), true); if (k) m.setVerticesData('color', new Float32Array(P.length / 3 * 4), true); m._chirpUpd = { n: new Float32Array(P.length), rgba: k ? new Float32Array(P.length / 3 * 4) : null }; m._chirpIdx = Uint32Array.from(x.f.index); }
      const u = m._chirpUpd;
      BABYLON.VertexData.ComputeNormals(P, m._chirpIdx, u.n, { useRightHandedSystem: true });
      m.updateVerticesData('position', P); m.updateVerticesData('normal', u.n);
      if (k) {
        const C = k.f.color, n = P.length / 3, on = window.__chirpLook.on;
        for (let i = 0; i < n; i++) {
          let r = C[i * 3], g = C[i * 3 + 1], b = C[i * 3 + 2], gain = 1;
          // look on: the sheet is unlit and its colour is the glow. The study colours a point by how far it is from the calm-sheet grey (crest warm, trough cool),
          // so that distance sets the brightness: calm water stays dark, crests and troughs go well past 1 and bloom.
          if (on) { const d = Math.hypot(r - MID_[0], g - MID_[1], b - MID_[2]); gain = 0.08 + 4.2 * Math.min(1, d) ** 1.15; }
          u.rgba[i * 4] = r * gain; u.rgba[i * 4 + 1] = g * gain; u.rgba[i * 4 + 2] = b * gain; u.rgba[i * 4 + 3] = 1;
        }
        m.updateVerticesData('color', u.rgba);
      }
      m.refreshBoundingInfo();
      dirty.delete(x); if (c) dirty.delete(c); if (k) dirty.delete(k);
      (this.stats.inPlace = (this.stats.inPlace || 0) + 1);
    }
  }
  return _frameBase.call(this);
};
