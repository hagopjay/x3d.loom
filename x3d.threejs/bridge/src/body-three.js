/* three.js body for the X3D reader: the drawing half the Babylon bridge keeps in demo/src/brain/body.js, body-cam.js and bridge/src/body-br.js.
   Concatenated by tools/bundle.js after the reader, the bridge kit and the node files, before demo/src/brain/sai.js; needs the global THREE (r187, WebGL2).
   The reader (parse, ROUTEs, SAI, events, sensors, interpolators, physics, audio) is shared untouched. What lives here is only what touches the engine.
   Contract with the SAI shim (sai.js): setWorld, changed, adopt, bindViewpoint, nextFrame (frameWaiters), fps, userPosition, timeSensors, canvas, engine.setHardwareScalingLevel.
   Choices, each with its reason:
   - THREE.ColorManagement is off and the output colour space is linear: X3D colours are authored numbers and X_ITE 16.6.0 writes them as they are, so the look is reproducible and the
     sRGB question stays one switch (opts.srgb) instead of a hidden default. Quality options (tone map, env light) sit on top of that, not in place of it.
   - Lights carry a factor PI: three.js (since r155) uses physical units, where a DirectionalLight of intensity 1 gives diffuse/PI. X3D wants diffuse * intensity * N.L.
   - Right-handed, Y up, counter-clockwise front faces: the same as three.js, so there is no winding flip and no handedness flag (Babylon needs both).
   - Transform keeps T C R SR S -SR -C as one matrix, so a shear survives (the Babylon body decomposes it to TRS and drops it). */
const THREE_PI = Math.PI;
/* The three.js side of a bridge node, registered from this tree (src/nodes/NODE.js) without touching the Babylon node files:
   R.bridge.three.build.NODE(body, n, parent, chain) -> record, R.bridge.three.geometry.NODE(g, body) -> THREE.BufferGeometry, R.bridge.three.changed.NODE(body, n, field) */
const T3 = (R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} });

/* Geo.geometryData: tools/bundle.js lifts it verbatim from demo/src/brain/body.js (renderer-neutral vertex data), so there is one copy of the triangulation rules */

class Body {
  constructor(canvas, opts) {
    this.canvas = canvas; this.opts = opts || {};
    this.rec = new Map(); this.geoCache = new Map(); this.texCache = new Map(); this.meshesOf = new Map();
    this.notes = new Set(); this.frameTimes = []; this.stats = { frames: 0 };
    this.pose = { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: 0.7854 };
    this.tr = null; this.bound = null; this.started = false; this.lights = []; this.look = { wired: false };
  }

  async init() {
    THREE.ColorManagement.enabled = !!this.opts.srgb;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.outputColorSpace = this.opts.srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.engine = { setHardwareScalingLevel: (l) => { r.setPixelRatio((window.devicePixelRatio || 1) / l); this.fit(); }, getRenderWidth: () => r.domElement.width, getRenderHeight: () => r.domElement.height };
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0.003, 0.005, 0.012);
    this.cam = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
    this.scene.add(this.cam);
    this.headlight = new THREE.DirectionalLight(0xffffff, THREE_PI); this.headlight.position.set(0, 0, 1); this.headlight.target.position.set(0, 0, -1);
    this.cam.add(this.headlight, this.headlight.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0); this.scene.add(this.ambient);
    this.setTone(this.opts.tone === undefined ? 'none' : this.opts.tone);
    this.setupInput(); this.fit();
    new ResizeObserver(() => this.fit()).observe(this.canvas);
    const loop = () => { this.frame(); this._raf = requestAnimationFrame(loop); }; loop();
    this.adapterInfo = { renderer: r.getContext().getParameter(r.getContext().VERSION) };
    return this;
  }
  fit() { const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height; this.renderer.setSize(w, h, false); this.applyCamera(); }
  setTone(kind) {
    const T = THREE; this.renderer.toneMapping = kind === 'neutral' ? T.NeutralToneMapping : kind === 'aces' ? T.ACESFilmicToneMapping : kind === 'standard' ? T.ReinhardToneMapping : T.NoToneMapping;
    this.tone = kind;
  }
  note(msg) { if (!this.notes.has(msg)) { this.notes.add(msg); if (this.opts.onNote) this.opts.onNote(msg); } }

  /* ----------------------------------------------------------------- world */
  setWorld(world, baseUrl, resolve) {
    this.clearWorld();
    this.world = world; this.baseUrl = baseUrl; this.resolve = resolve || ((u) => u);
    this.root = new THREE.Group(); this.root.name = 'x3d-root'; this.scene.add(this.root);
    for (const n of world.children) this.build(n, this.root, []);
    this.buildLights(); this.applyBackground(); this.applyNavigation();
    const first = world.nodes.find((n) => n.type === 'Viewpoint');   // 19775-1 23.4.1: the first Viewpoint in the file is bound at load (the Babylon stock body does this in body-br.js)
    if (first) { this.started = false; this.bindViewpoint(first, true); }
  }
  clearWorld() {
    if (!this.root) return;
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
    this.scene.remove(this.root); this.lights.forEach((l) => { this.scene.remove(l); if (l.target) this.scene.remove(l.target); });
    this.rec.clear(); this.geoCache.clear(); this.lights = []; this.bound = null; this.viewpoints = []; this.root = null;
  }

  build(n, parent, chain) {
    if (!n) return null;
    switch (n.type) {
      case 'Group': case 'Switch': case 'Transform': return this.buildGroup(n, parent, chain);
      case 'Shape': return this.buildShape(n, parent, chain);
      case 'Viewpoint': { const r = { node: n, parent, tn: parent }; this.rec.set(n.id, r); (this.viewpoints ||= []).includes(n) || this.viewpoints.push(n); this.vpParent ||= new Map(); this.vpParent.set(n, parent); return r; }
      case 'DirectionalLight': this.lightNodes = (this.lightNodes || []).filter((x) => x !== n).concat(n); return null;
      case 'NavigationInfo': case 'Background': case 'WorldInfo': case 'TimeSensor': case 'ScalarInterpolator': case 'PositionInterpolator': case 'OrientationInterpolator': case 'ColorInterpolator': return null;
      default: { const fn = T3.build[n.type]; if (!fn) this.note('three.js body: skipped <' + n.type + '>'); else return fn(this, n, parent, chain); return null; }
    }
  }
  buildGroup(n, parent, chain) {
    const o = new THREE.Group(); o.name = n.def || n.type; parent.add(o);
    const r = { node: n, tn: o, kids: [], chain: [n, ...chain] }; this.rec.set(n.id, r);
    if (n.type === 'Transform') this.applyTransform(n, o);
    for (const c of n.f.children) r.kids.push(this.build(c, o, r.chain));
    if (n.type === 'Switch') this.applySwitch(n);
    if (n.f.visible === false) o.visible = false;
    return r;
  }
  /* X3D 4.0 Transform: P' = T C R SR S -SR -C P. three.js Matrix4 is column-major and multiplies on the left, so the product reads in the same order as the standard. */
  applyTransform(n, o) {
    const f = n.f, M = THREE.Matrix4, V = THREE.Vector3, Q = THREE.Quaternion;
    const t = (v) => new M().makeTranslation(v[0], v[1], v[2]), q = (a) => new M().makeRotationFromQuaternion(new Q(...R.quat.fromAxisAngle(a, a[3])));
    const sr = f.scaleOrientation, c = f.center, srInv = [sr[0], sr[1], sr[2], -sr[3]];
    const m = new M().multiplyMatrices(t(f.translation), t(c)).multiply(q(f.rotation)).multiply(q(sr)).multiply(new M().makeScale(f.scale[0], f.scale[1], f.scale[2])).multiply(q(srInv)).multiply(t([-c[0], -c[1], -c[2]]));
    o.matrixAutoUpdate = false; o.matrix.copy(m); o.matrixWorldNeedsUpdate = true;
  }
  applySwitch(n) { const r = this.rec.get(n.id); if (r) r.kids.forEach((k, i) => { if (k && k.tn) k.tn.visible = i === n.f.whichChoice; }); }

  /* ---------------------------------------------------------------- shapes */
  buildShape(n, parent, chain) {
    const f = n.f, g = f.geometry, app = f.appearance, r = { node: n, meshes: [], chain: [n, ...chain] }; this.rec.set(n.id, r);
    const o = new THREE.Group(); o.name = 'shape-' + (n.def || n.id); parent.add(o); r.tn = o;
    if (!g) return r;
    const geo = this.threeGeometry(g); if (!geo) return r;
    const mat = this.makeMaterial(n, g, app);
    const mesh = new THREE.Mesh(geo, mat); mesh.userData = { shape: n, chain: r.chain }; o.add(mesh); r.meshes.push(mesh);
    for (const dep of [app && app.f.material, app && app.f.texture, g]) if (dep) (this.meshesOf.get(dep.id) || this.meshesOf.set(dep.id, []).get(dep.id)).push(mesh);
    if (f.visible === false) o.visible = false;
    return r;
  }
  threeGeometry(g) {
    const f = g.f, T = THREE;
    switch (g.type) {
      case 'Box': return new T.BoxGeometry(f.size[0], f.size[1], f.size[2]);
      case 'Sphere': return new T.SphereGeometry(f.radius, 48, 32);
      case 'Cylinder': return new T.CylinderGeometry(f.radius, f.radius, f.height, 48, 1, false);
      case 'Cone': return new T.ConeGeometry(f.bottomRadius, f.height, 48, 1, f.bottom === false);
      case 'IndexedFaceSet': case 'IndexedTriangleSet': {
        const d = this.geometryData(g), geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(d.pos), 3)); geo.setIndex(new T.BufferAttribute(Uint32Array.from(d.idx), 1));
        if (d.nrm) geo.setAttribute('normal', new T.BufferAttribute(Float32Array.from(d.nrm), 3)); else geo.computeVertexNormals();
        if (d.uv) geo.setAttribute('uv', new T.BufferAttribute(Float32Array.from(d.uv), 2));
        if (d.col) geo.setAttribute('color', new T.BufferAttribute(Float32Array.from(d.col), 3));
        return geo;
      }
      default: { const fn = T3.geometry[g.type]; if (fn) return fn(g, this); this.note('three.js body: skipped geometry <' + g.type + '>'); return null; }
    }
  }
  geometryData(g) { return Geo.geometryData.call(this, g); }

  tex(node) {
    if (!node || !node.f.url || !node.f.url.length) return null;
    const hit = this.texCache.get(node.id); if (hit) return hit;
    const t = new THREE.TextureLoader().load(this.resolve(node.f.url[0], this.baseUrl), () => { this.dirty = true; });
    t.wrapS = node.f.repeatS === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = node.f.repeatT === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    this.texCache.set(node.id, t); return t;
  }
  /* Material -> MeshPhongMaterial (the Phong model X3D and X_ITE share); PhysicalMaterial -> MeshPhysicalMaterial (the glTF model, linear colours) */
  makeMaterial(shape, g, app) {
    const T = THREE, mat = app && app.f.material, texN = app && app.f.texture, side = g.f.solid === true ? T.FrontSide : T.DoubleSide;
    let m;
    if (mat && mat.type === 'PhysicalMaterial') { m = new T.MeshPhysicalMaterial({ side }); this.refreshPBR(m, mat); m.map = this.tex(mat.f.baseTexture); }
    else if (mat && mat.type === 'Material') { m = new T.MeshPhongMaterial({ side, specular: 0 }); this.refreshPhong(m, mat); m.map = this.tex(texN); }
    else { m = new T.MeshBasicMaterial({ side, color: 0xffffff }); m.map = this.tex(texN); }   // no Material: unlit, white, texture as is (19775-1 12.2.2)
    if (g.f.color || (g.f.colorPerVertex !== undefined && g.type.startsWith('Indexed') && g.f.color)) m.vertexColors = true;
    return m;
  }
  refreshPhong(m, mat) {
    const f = mat.f; m.color.setRGB(f.diffuseColor[0], f.diffuseColor[1], f.diffuseColor[2]); m.emissive.setRGB(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.specular.setRGB(f.specularColor[0], f.specularColor[1], f.specularColor[2]); m.shininess = Math.max(f.shininess * 128 * (this.opts.shininessScale || 4), 1e-3);   // X_ITE evaluates Phong with the reflection vector; Blinn-Phong (three.js) needs about 4x the exponent for the same highlight width
    m.opacity = 1 - f.transparency; m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent; m.needsUpdate = true;
  }
  refreshPBR(m, mat) {
    const f = mat.f; m.color.setRGB(f.baseColor[0], f.baseColor[1], f.baseColor[2]); m.metalness = f.metallic; m.roughness = f.roughness; m.emissive.setRGB(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.opacity = 1 - f.transparency; m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent;
  }

  /* ---------------------------------------------------------------- lights */
  applyNavigation() { const nav = this.world.nodes.find((n) => n.type === 'NavigationInfo'); this.headlight.visible = !nav || nav.f.headlight !== false; }
  buildLights() {
    this.lights.forEach((l) => { this.scene.remove(l); this.scene.remove(l.target); }); this.lights = [];
    for (const n of this.lightNodes || []) {
      const l = new THREE.DirectionalLight(0xffffff, THREE_PI); l.userData.node = n; this.scene.add(l, l.target); this.lights.push(l); this.refreshLight(l);
    }
    this.refreshAmbient();
  }
  refreshLight(l) {
    const n = l.userData.node, c = n.f.color, d = n.f.direction, par = this.parentOf(n);
    l.color.setRGB(c[0], c[1], c[2]); l.intensity = n.f.intensity * THREE_PI; l.visible = n.f.on !== false;
    const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    if (par) { par.updateWorldMatrix(true, false); dir.transformDirection(par.matrixWorld); }      // the light's direction is in the coordinate system of its parent (a Transform above it turns it)
    l.position.copy(dir).multiplyScalar(-50); l.target.position.set(0, 0, 0); l.target.updateMatrixWorld();
  }
  parentOf(n) { for (const r of this.rec.values()) if (r.kids && r.node.f.children && r.node.f.children.includes(n)) return r.tn; return this.root; }
  refreshAmbient() {   // Ia * ambientIntensity(light) * material ambientIntensity (default 0.2) * diffuse; the AmbientLight multiplies by the diffuse colour, the 0.2 is folded in (gap: per material value)
    let r = 0, g = 0, b = 0; for (const l of this.lights) { const n = l.userData.node; if (n.f.on === false) continue; r += n.f.ambientIntensity * n.f.color[0]; g += n.f.ambientIntensity * n.f.color[1]; b += n.f.ambientIntensity * n.f.color[2]; }
    this.ambient.color.setRGB(r, g, b); this.ambient.intensity = 0.2 * THREE_PI;
  }
  applyBackground() {
    const bg = this.world.nodes.find((x) => x.type === 'Background'); if (!bg) { this.scene.background = new THREE.Color(0, 0, 0); return; }
    const c = bg.f.skyColor[0] || [0, 0, 0], last = bg.f.skyColor[bg.f.skyColor.length - 1] || c, g = bg.f.groundColor && bg.f.groundColor.length ? bg.f.groundColor[bg.f.groundColor.length - 1] : last;
    this.scene.background = new THREE.Color((last[0] + g[0]) / 2 * 0.6 + c[0] * 0.4, (last[1] + g[1]) / 2 * 0.6 + c[1] * 0.4, (last[2] + g[2]) / 2 * 0.6 + c[2] * 0.4);   // same flat approximation as the Babylon body, so the two stay comparable
  }

  /* --------------------------------------------------------------- changes */
  changed(node, field) {
    const t = node.type;
    if (t === 'Switch' && field === 'whichChoice') this.applySwitch(node);
    else if (t === 'Transform' && field !== 'children') { const r = this.rec.get(node.id); if (r && r.tn) { this.applyTransform(node, r.tn); for (const l of this.lights) this.refreshLight(l); } }
    else if ((t === 'Group' || t === 'Switch' || t === 'Transform') && field === 'children') this.rebuildGroup(node);
    else if (t === 'Material') for (const m of this.meshesOf.get(node.id) || []) this.refreshPhong(m.material, node);
    else if (t === 'PhysicalMaterial') for (const m of this.meshesOf.get(node.id) || []) this.refreshPBR(m.material, node);
    else if (t === 'DirectionalLight') { const l = this.lights.find((x) => x.userData.node === node); if (l) { this.refreshLight(l); this.refreshAmbient(); } }
    else if (t === 'Background') this.applyBackground();
    else if (t === 'NavigationInfo') this.applyNavigation();
    else if (t === 'Viewpoint') this.viewpointChanged(node, field);
    else if (t === 'Coordinate' || t === 'Color' || t === 'Normal') this.geometryChanged(node);
    if (T3.changed[t]) T3.changed[t](this, node, field);
  }
  geometryChanged(n) {
    for (const r of [...this.rec.values()]) if (r.node && r.node.type === 'Shape' && r.node.f.geometry && ['coord', 'color', 'normal'].some((k) => r.node.f.geometry.f[k] === n)) {
      this.geoCache.delete(r.node.f.geometry.id); const parent = r.tn.parent, vis = r.tn.visible; this.disposeObj(r.tn); const nr = this.buildShape(r.node, parent, r.chain.slice(1));
      for (const pr of this.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; }
      nr.tn.visible = vis;
    }
  }
  disposeObj(o) { o.removeFromParent(); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
  rebuildGroup(node) {
    const r = this.rec.get(node.id); if (!r) return;
    for (const k of r.kids) this.disposeRec(k);
    r.kids = node.f.children.map((c) => this.build(c, r.tn, r.chain)); if (node.type === 'Switch') this.applySwitch(node);
  }
  disposeRec(k) { if (!k) return; (k.kids || []).forEach((x) => this.disposeRec(x)); if (k.tn && k.node && k.node.type !== 'Viewpoint') this.disposeObj(k.tn); if (k.node) this.rec.delete(k.node.id); }
  adopt(node, parentNode) {
    const pr = parentNode ? this.rec.get(parentNode.id) : null, cr = this.build(node, pr ? pr.tn : this.root, pr ? pr.chain : []);
    if (pr && pr.kids && cr) pr.kids.push(cr); return cr;
  }

  /* ---------------------------------------------------------------- camera */
  vpPose(vp) {
    const f = vp.f, par = (this.vpParent && this.vpParent.get(vp)) || null;
    let pos = f.position.slice(), q = R.quat.fromAxisAngle(f.orientation, f.orientation[3]), center = f.centerOfRotation.slice();
    if (par && par !== this.root) {
      par.updateWorldMatrix(true, false); const M = par.matrixWorld, P = new THREE.Vector3(...pos).applyMatrix4(M), C = new THREE.Vector3(...center).applyMatrix4(M);
      const sc = new THREE.Vector3(), rq = new THREE.Quaternion(), tr = new THREE.Vector3(); M.decompose(tr, rq, sc);
      pos = [P.x, P.y, P.z]; center = [C.x, C.y, C.z]; q = R.quat.mul([rq.x, rq.y, rq.z, rq.w], q);
    }
    return { pos, q: R.quat.norm(q), center, fov: f.fieldOfView };
  }
  applyCamera() {
    const c = this.cam, p = this.pose; c.position.set(p.pos[0], p.pos[1], p.pos[2]); c.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);   // a Viewpoint looks down -Z with +Y up, as a three.js camera does
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1, aspect = w / h;
    c.fov = THREE.MathUtils.radToDeg(aspect >= 1 ? p.fov : 2 * Math.atan(Math.tan(p.fov / 2) / aspect));   // X3D fieldOfView is the angle across the smaller side of the view
    c.aspect = aspect; const d = Math.hypot(p.pos[0] - p.center[0], p.pos[1] - p.center[1], p.pos[2] - p.center[2]);
    c.near = Math.max(0.3, Math.min(2, d * 0.004)); c.far = Math.max(2000, d * 12); c.updateProjectionMatrix();
  }
  bindViewpoint(vp, on) {
    if (!on) { vp.f.isBound = false; return; }
    const prev = this.bound; if (prev && prev !== vp) { prev.f.isBound = false; R.events.emit(prev, 'isBound', false); }
    this.bound = vp; vp.f.isBound = true; R.events.emit(vp, 'isBound', true); vp.f.bindTime = (performance.timeOrigin + performance.now()) / 1000;
    const nav = this.world && this.world.nodes.find((n) => n.type === 'NavigationInfo');
    const tt = nav ? String(nav.f.transitionType[0] || 'LINEAR').toUpperCase() : 'LINEAR', dur = nav ? Math.max(nav.f.transitionTime || 1, 0.05) : 1, to = this.vpPose(vp);
    if (!prev || tt === 'TELEPORT' || !this.started) { this.pose = to; this.tr = null; this.started = true; this.applyCamera(); return; }
    this.tr = { from: { pos: this.pose.pos.slice(), q: this.pose.q.slice(), center: this.pose.center.slice(), fov: this.pose.fov }, to, t0: performance.now(), dur: dur * 1000 };
  }
  viewpointChanged(vp, field) {
    if (vp !== this.bound) return; const to = this.vpPose(vp);
    if (field === 'fieldOfView') { if (this.tr) this.tr.to.fov = to.fov; else { this.pose.fov = to.fov; this.applyCamera(); } }
    else if (['position', 'orientation', 'centerOfRotation'].includes(field)) { this.pose = to; this.tr = null; this.applyCamera(); }
  }
  stepTransition() {
    const t = this.tr; if (!t) return; const s = (performance.now() - t.t0) / t.dur;
    if (s >= 1) { this.pose = { pos: t.to.pos.slice(), q: t.to.q.slice(), center: t.to.center.slice(), fov: t.to.fov }; this.tr = null; this.applyCamera(); return; }
    const e = s * s * (3 - 2 * s), L = (a, b) => a + (b - a) * e;
    this.pose = { pos: [0, 1, 2].map((i) => L(t.from.pos[i], t.to.pos[i])), center: [0, 1, 2].map((i) => L(t.from.center[i], t.to.center[i])), q: R.quat.slerp(t.from.q, t.to.q, e), fov: L(t.from.fov, t.to.fov) };
    this.applyCamera();
  }
  userPosition() { const p = this.pose.pos; return { x: p[0], y: p[1], z: p[2] }; }
  /* EXAMINE: drag orbits about the centre of rotation, the wheel dollies. Pointer sensors, picking and the other navigation types are not ported yet (NODES.md). */
  setupInput() {
    const cv = this.canvas; let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag = [e.clientX, e.clientY]; this.orbit(dx, dy); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
  }
  orbit(dx, dy) {
    this.tr = null; const p = this.pose, c = new THREE.Vector3(...p.center), off = new THREE.Vector3(...p.pos).sub(c), up = new THREE.Vector3(0, 1, 0);
    off.applyAxisAngle(up, -dx * 0.008); const right = new THREE.Vector3().crossVectors(up, off).normalize(); off.applyAxisAngle(right, -dy * 0.008);
    const pos = c.clone().add(off), m = new THREE.Matrix4().lookAt(pos, c, up), q = new THREE.Quaternion().setFromRotationMatrix(m);
    this.pose = { ...p, pos: [pos.x, pos.y, pos.z], q: [q.x, q.y, q.z, q.w] }; this.applyCamera();
  }
  zoom(f) { const p = this.pose; this.tr = null; this.pose = { ...p, pos: [0, 1, 2].map((i) => p.center[i] + (p.pos[i] - p.center[i]) * f) }; this.applyCamera(); }

  /* ------------------------------------------------------------ frame loop */
  frame() {
    const now = (performance.timeOrigin + performance.now()) / 1000;
    if (this.world) { R.events.begin(now); for (const n of this.timeSensors || []) R.tickTimeSensor(n, now); R.events.drain(); this.stepTransition(); }
    this.renderer.render(this.scene, this.cam); this.stats.frames++;
    this.frameTimes.push(performance.now()); if (this.frameTimes.length > 30) this.frameTimes.shift();
    if (this.frameWaiters && this.frameWaiters.length) { const w = this.frameWaiters; this.frameWaiters = []; w.forEach((f) => f()); }
    if (this.opts.onFrame) this.opts.onFrame(this);
  }
  fps() { const t = this.frameTimes; return t.length > 2 ? 1000 * (t.length - 1) / (t[t.length - 1] - t[0]) : 0; }
  shot() { this.renderer.render(this.scene, this.cam); return this.renderer.domElement.toDataURL('image/png'); }
}
