/* Gobbler demiurge additions to the Babylon body (concatenated after gobbler/body-gob.js, same bundle scope). Nothing in brain/ or gobbler/ is edited: methods are wrapped or added.
     - LOD (distance switch in the LOD's own frame), HAnimHumanoid / Joint / Segment / Site (transforms; the skin stays in its rest pose, see GAPS), Group `visible` changes
     - ProximitySensor: box test of the camera in the sensor's frame; isActive / enterTime / exitTime, and position_changed / orientation_changed while inside
     - Inline: fetched when load turns true, parsed by the SAI shim's createX3DFromString and adopted under the Inline's group
     - TriangleStripSet drawn through the gob programs (a strip becomes an indexed face set)
     - uniforms of the new programs: SFVec4f, and MFFloat as vec4f chunks named <field>0..7
     - a bound Viewpoint's nearDistance / farDistance set the camera planes, and the depth buffer is reversed float (the scene spans 1 m at 0.0004 units to the whole bird) */

const _dmBuild = Body.prototype.build, _dmChanged = Body.prototype.changed, _dmFrame = Body.prototype.frame, _dmClear = Body.prototype.clearWorld,
  _dmMaterialsFor = Body.prototype.materialsFor, _dmMakeMesh = Body.prototype.makeMesh, _dmRefresh = Body.prototype.refreshShader, _dmApplyCamera = Body.prototype.applyCamera,
  _dmSetWorld = Body.prototype.setWorld;
const DM_GROUPS = new Set(['LOD', 'HAnimJoint', 'HAnimSegment', 'HAnimSite', 'HAnimHumanoid']);
const dmAbs = (n, u) => new URL(u, n.base || location.href).href;

function dmStripToFaces(g) {
  if (g._ifs) return g._ifs;
  const f = g.f, ci = []; let s = 0;
  for (const c of f.stripCount) {
    for (let k = 0; k + 2 < c; k++) { if (k % 2 === 0) ci.push(s + k, s + k + 1, s + k + 2, -1); else ci.push(s + k + 1, s + k, s + k + 2, -1); }
    s += c;
  }
  return (g._ifs = { type: 'IndexedFaceSet', id: g.id, def: g.def, f: { coord: f.coord, normal: f.normal, color: f.color, texCoord: f.texCoord, coordIndex: Int32Array.from(ci), normalIndex: [], colorIndex: [], texCoordIndex: [],
    normalPerVertex: true, colorPerVertex: true, ccw: true, solid: false } });
}

Object.assign(Body.prototype, {
  build(n, parent, chain) {
    if (n && DM_GROUPS.has(n.type)) return this.buildDmGroup(n, parent, chain);
    if (n && n.type === 'ProximitySensor') { (this.prox ||= []).push({ node: n, parentTN: parent, inside: false }); return null; }
    if (n && n.type === 'Inline') return this.buildInline(n, parent, chain);
    return _dmBuild.call(this, n, parent, chain);
  },
  buildDmGroup(n, parent, chain) {
    const tn = new BABYLON.TransformNode(n.def || n.type, this.scene); tn.parent = parent;
    const r = { node: n, tn, kids: [], chain: [n, ...chain] };
    this.rec.set(n.id, r);
    if (n.type !== 'LOD' && n.type !== 'HAnimSegment') this.applyTransform(n, tn);
    const kids = n.type === 'HAnimHumanoid' ? [...n.f.skeleton, ...n.f.skin] : n.f.children;
    for (const c of kids) r.kids.push(this.build(c, tn, r.chain));
    if (n.type === 'LOD') { (this.lods ||= []).push(r); r.level = -1; }
    if (n.f.visible === false) tn.setEnabled(false);
    return r;
  },
  buildInline(n, parent, chain) {
    const tn = new BABYLON.TransformNode(n.def || 'Inline', this.scene); tn.parent = parent;
    const r = { node: n, tn, kids: [], chain: [n, ...chain], loaded: false };
    this.rec.set(n.id, r);
    if (n.f.load) this.loadInline(n, r);
    return r;
  },
  async loadInline(n, r) {
    if (r.loaded || r.loading || !n.f.url.length) return;
    r.loading = true;
    try {
      const url = dmAbs(n, n.f.url[0]);
      const res = await fetch(url); if (!res.ok) throw new Error(res.status + ' for ' + url);
      let u = new Uint8Array(await res.arrayBuffer());
      const text = u[0] === 0x1f && u[1] === 0x8b ? await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(u);
      const sc = await X3DSAI.B.createX3DFromString(text, url);
      if (!r.tn || r.tn.isDisposed()) return;
      const w = sc._world;
      for (const root of w.children) r.kids.push(this.build(root, r.tn, r.chain));
      r.loaded = true;
      (this.inlineLog ||= []).push({ url: n.f.url[0], nodes: w.nodes.length });
    } catch (e) { this.note('Inline ' + (n.def || '') + ' did not load: ' + e.message); }
    r.loading = false;
  },
  clearWorld() { this.lods = []; this.prox = []; return _dmClear.call(this); },
  setWorld(world, baseUrl, resolve) { this.lods = []; this.prox = []; return _dmSetWorld.call(this, world, baseUrl, resolve); },

  changed(node, field) {
    const t = node.type;
    if (t === 'HAnimJoint' || t === 'HAnimHumanoid' || t === 'HAnimSite') { const r = this.rec.get(node.id); if (r && r.tn && ['translation', 'rotation', 'scale', 'center', 'scaleOrientation'].includes(field)) this.applyTransform(node, r.tn); return; }
    if (t === 'Inline') { const r = this.rec.get(node.id); if (r && field === 'load' && node.f.load) this.loadInline(node, r); if (r && field === 'load' && !node.f.load && r.tn) r.tn.setEnabled(false); if (r && field === 'load' && node.f.load && r.tn) r.tn.setEnabled(true); return; }
    if (field === 'visible' && (t === 'Group' || t === 'Switch' || t === 'Transform' || t === 'Billboard' || DM_GROUPS.has(t))) { const r = this.rec.get(node.id); if (r && r.tn) r.tn.setEnabled(node.f.visible !== false); return; }
    if (t === 'ProximitySensor') return;
    if (t === 'Viewpoint' && (field === 'nearDistance' || field === 'farDistance')) { if (node === this.bound && this.pose) this.applyCamera(); return; }
    return _dmChanged.call(this, node, field);
  },

  /* ---------------------------------------------------- strips and the new programs' uniforms */
  materialsFor(shape, g, app) {
    if (g.type === 'TriangleStripSet') g = dmStripToFaces(g);
    // no Material and a Color (per face or per vertex): 19775-1 draws it unlit in that colour. The brain body would read no per-face colours, and the 36 letters of the ring came out black.
    const mat = app && app.f.material, cs = app && app.f.shaders.find((s) => s.type === 'ComposedShader');
    if (g.type === 'IndexedFaceSet' && !mat && !cs && g.f.color && g.f.color.type === 'Color')
      return [{ kind: 'gob', name: 'vcolor', port: GOB_PORTS.vcolor, cs: null, noPick: true, tint: [1, 1, 1], opacity: 1, opaque: true, deps: [] }];
    return _dmMaterialsFor.call(this, shape, g, app);
  },
  makeMesh(shape, g, spec, passIndex) {
    const m = _dmMakeMesh.call(this, shape, g.type === 'TriangleStripSet' ? dmStripToFaces(g) : g, spec, passIndex);
    if (m && spec.kind === 'gob' && spec.opaque) { m.material.alphaMode = BABYLON.Engine.ALPHA_DISABLE; m.material.disableDepthWrite = false; m.material.needAlphaBlending = () => false; }
    if (m && spec.kind === 'gob' && spec.name === 'sun') { m.material.alphaMode = BABYLON.Engine.ALPHA_DISABLE; m.material.disableDepthWrite = false; m.material.needAlphaBlending = () => false; }
    return m;
  },
  refreshShader(m, cs) {
    _dmRefresh.call(this, m, cs);
    for (const [name, def] of Object.entries(cs.fdefs)) {
      const v = cs.f[name], t = def[0];
      try {
        if (t === 'SFVec4f') m.setVector4(name, new BABYLON.Vector4(v[0], v[1], v[2], v[3]));
        else if (t === 'MFFloat') { for (let k = 0; k < 8; k++) m.setVector4(name + k, new BABYLON.Vector4(v[k * 4] || 0, v[k * 4 + 1] || 0, v[k * 4 + 2] || 0, v[k * 4 + 3] || 0)); }
      } catch (e) { /* not a uniform of this port */ }
    }
  },

  /* --------------------------------------------------------------- camera planes and depth */
  applyCamera() {
    _dmApplyCamera.call(this);
    const vp = this.bound, c = this.cam;
    if (vp && vp.f.nearDistance > 0) c.minZ = vp.f.nearDistance;
    if (vp && vp.f.farDistance > 0) c.maxZ = vp.f.farDistance;
  },

  /* --------------------------------------------------------------- per frame */
  frame() {
    const now = (performance.timeOrigin + performance.now()) / 1000, cam = this.scene.activeCamera;
    if (this.world && cam) {
      const eye = cam.globalPosition;
      for (const r of this.lods || []) {
        if (r.tn.isDisposed()) continue;
        const inv = r.tn.computeWorldMatrix(true).clone().invert(), p = BABYLON.Vector3.TransformCoordinates(eye, inv), c = r.node.f.center;
        const d = Math.hypot(p.x - c[0], p.y - c[1], p.z - c[2]), rg = r.node.f.range;
        let lv = 0; while (lv < rg.length && d >= rg[lv]) lv++;
        lv = Math.min(lv, r.kids.length - 1);
        if (lv !== r.level) { r.level = lv; r.kids.forEach((k, i) => { if (k && k.tn) k.tn.setEnabled(i === lv); }); }
      }
      if (this.prox && this.prox.length) {
        R.events.begin(now);
        const pose = this.pose, q = pose.q, ang = 2 * Math.acos(Math.max(-1, Math.min(1, q[3]))), sn = Math.sqrt(Math.max(1e-12, 1 - q[3] * q[3]));
        const ori = sn < 1e-6 ? [0, 0, 1, 0] : [q[0] / sn, q[1] / sn, q[2] / sn, ang];
        for (const s of this.prox) {
          const n = s.node; if (n.f.enabled === false) continue;
          const M = s.parentTN && s.parentTN.computeWorldMatrix ? s.parentTN.computeWorldMatrix(true) : BABYLON.Matrix.Identity();
          const pl = BABYLON.Vector3.TransformCoordinates(eye, M.clone().invert());
          const c = n.f.center, h = n.f.size, inside = h[0] > 0 && h[1] > 0 && h[2] > 0 && Math.abs(pl.x - c[0]) <= h[0] / 2 && Math.abs(pl.y - c[1]) <= h[1] / 2 && Math.abs(pl.z - c[2]) <= h[2] / 2;
          if (inside !== s.inside) {
            s.inside = inside; n.f.isActive = inside; n.f[inside ? 'enterTime' : 'exitTime'] = now;
            R.events.emit(n, 'isActive', inside); R.events.emit(n, inside ? 'enterTime' : 'exitTime', now);
          }
          if (inside) {
            n.f.position_changed = [pl.x, pl.y, pl.z]; n.f.orientation_changed = ori;
            R.events.emit(n, 'position_changed', n.f.position_changed); R.events.emit(n, 'orientation_changed', ori);
          }
        }
      }
    }
    return _dmFrame.call(this);
  },
});
