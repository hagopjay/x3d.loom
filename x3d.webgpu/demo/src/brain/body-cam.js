/* camera (X3D Viewpoint, EXAMINE navigation), pointer sensors, frame loop: the second half of Body */
Object.assign(Body.prototype, {
  /* ----------------------------------------------------------- camera pose */
  vpPose(vp) {
    const f = vp.f, par = (this.vpParent && this.vpParent.get(vp)) || null;
    let pos = f.position.slice(), q = R.quat.fromAxisAngle(f.orientation, f.orientation[3]), center = f.centerOfRotation.slice();
    if (par && par.computeWorldMatrix) {
      const M = par.computeWorldMatrix(true);
      const P = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(...pos), M), C = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(...center), M);
      const sc = new BABYLON.Vector3(), rq = new BABYLON.Quaternion(), tr = new BABYLON.Vector3(); M.decompose(sc, rq, tr);
      pos = [P.x, P.y, P.z]; center = [C.x, C.y, C.z]; q = R.quat.mul([rq.x, rq.y, rq.z, rq.w], q);
    }
    return { pos, q: R.quat.norm(q), center, fov: f.fieldOfView };
  },
  applyCamera() {
    const c = this.cam, p = this.pose;
    const fwd = R.quat.rotate(p.q, [0, 0, -1]), up = R.quat.rotate(p.q, [0, 1, 0]);
    c.position.set(p.pos[0], p.pos[1], p.pos[2]);
    c.upVector = new BABYLON.Vector3(up[0], up[1], up[2]);
    c.setTarget(new BABYLON.Vector3(p.pos[0] + fwd[0], p.pos[1] + fwd[1], p.pos[2] + fwd[2]));
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1, aspect = w / h;
    // X3D fieldOfView is the angle across the SMALLER side of the view
    c.fov = aspect >= 1 ? p.fov : 2 * Math.atan(Math.tan(p.fov / 2) / aspect);
    c.fovMode = BABYLON.Camera.FOVMODE_VERTICAL_FIXED;
    const d = Math.hypot(p.pos[0] - p.center[0], p.pos[1] - p.center[1], p.pos[2] - p.center[2]);
    c.minZ = Math.max(0.3, Math.min(2, d * 0.004)); c.maxZ = Math.max(2000, d * 12);
  },
  bindViewpoint(vp, on) {
    if (!on) { vp.f.isBound = false; return; }
    const prev = this.bound; if (prev && prev !== vp) { prev.f.isBound = false; R.events.emit(prev, 'isBound', false); }
    this.bound = vp; vp.f.isBound = true; R.events.emit(vp, 'isBound', true);
    vp.f.bindTime = (performance.timeOrigin + performance.now()) / 1000;
    const nav = this.world && this.world.nodes.find((n) => n.type === 'NavigationInfo');
    const tt = nav ? String(nav.f.transitionType[0] || 'LINEAR').toUpperCase() : 'LINEAR', dur = nav ? Math.max(nav.f.transitionTime || 1, 0.05) : 1;
    const to = this.vpPose(vp);
    if (!prev || tt === 'TELEPORT' || !this.started) { this.pose = to; this.tr = null; this.started = true; this.applyCamera(); return; }
    this.tr = { from: { pos: this.pose.pos.slice(), q: this.pose.q.slice(), center: this.pose.center.slice(), fov: this.pose.fov }, to, t0: performance.now(), dur: dur * 1000 };
  },
  viewpointChanged(vp, field) {
    if (vp !== this.bound) return;
    const to = this.vpPose(vp);
    if (field === 'fieldOfView') { if (this.tr) this.tr.to.fov = to.fov; else { this.pose.fov = to.fov; this.applyCamera(); } }
    else if (['position', 'orientation', 'centerOfRotation'].includes(field)) { this.pose = to; this.tr = null; this.applyCamera(); }
  },
  stepTransition() {
    const t = this.tr; if (!t) return;
    let s = (performance.now() - t.t0) / t.dur;
    if (s >= 1) { this.pose = { pos: t.to.pos.slice(), q: t.to.q.slice(), center: t.to.center.slice(), fov: t.to.fov }; this.tr = null; this.applyCamera(); return; }
    const e = s * s * (3 - 2 * s), L = (a, b) => a + (b - a) * e;
    this.pose = {
      pos: [0, 1, 2].map((i) => L(t.from.pos[i], t.to.pos[i])), center: [0, 1, 2].map((i) => L(t.from.center[i], t.to.center[i])),
      q: R.quat.slerp(t.from.q, t.to.q, e), fov: L(t.from.fov, t.to.fov),
    };
    this.applyCamera();
  },
  userMoved() { if (this.tr) { this.pose.fov = this.tr.to.fov; this.tr = null; } },
  userPosition() { const p = this.pose.pos; return { x: p[0], y: p[1], z: p[2] }; },

  /* --------------------------------------------------------------- input */
  setupInput() {
    const cv = this.canvas, st = this.ptr = { down: false, x: 0, y: 0, sx: 0, sy: 0, t0: 0, moved: 0, button: 0, pts: new Map(), pinch: 0, shift: false, over: null };
    cv.style.touchAction = 'none';
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); st.pts.set(e.pointerId, [e.clientX, e.clientY]);
      st.down = true; st.x = st.sx = e.clientX; st.y = st.sy = e.clientY; st.t0 = performance.now(); st.moved = 0; st.button = e.button; st.shift = e.shiftKey;
      if (st.pts.size === 2) { const [a, b] = [...st.pts.values()]; st.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
      this.userMoved();
    });
    cv.addEventListener('pointermove', (e) => {
      st.cx = e.clientX; st.cy = e.clientY;
      if (st.pts.has(e.pointerId)) st.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (st.down && st.pts.size === 2) {
        const [a, b] = [...st.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (st.pinch > 0) this.zoom(st.pinch / d); st.pinch = d; st.moved += 10; return;
      }
      if (st.down) {
        const dx = e.clientX - st.x, dy = e.clientY - st.y; st.x = e.clientX; st.y = e.clientY; st.moved += Math.abs(dx) + Math.abs(dy);
        if (st.button === 2 || st.shift || st.button === 1) this.pan(dx, dy); else this.orbit(dx, dy);
        this.userMoved();
      }
      this.queuePick(e.clientX, e.clientY);
    });
    const up = (e) => {
      st.pts.delete(e.pointerId);
      if (!st.down) return;
      if (st.pts.size === 0) {
        st.down = false;
        if (st.moved < 6 && performance.now() - st.t0 < 600 && e.type === 'pointerup') this.click(e.clientX, e.clientY);
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { this.setOver([], null); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.userMoved(); this.zoom(Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 240) * 0.0012)); }, { passive: false });
  },
  orbit(dx, dy) {
    const p = this.pose, k = 0.0065;
    const up = R.quat.rotate(p.q, [0, 1, 0]), right = R.quat.rotate(p.q, [1, 0, 0]);
    const dq = R.quat.norm(R.quat.mul(R.quat.fromAxisAngle(right, -dy * k), R.quat.fromAxisAngle(up, -dx * k)));
    const rel = R.v3.sub(p.pos, p.center), r2 = R.quat.rotate(dq, rel);
    p.pos = R.v3.add(p.center, r2); p.q = R.quat.norm(R.quat.mul(dq, p.q));
    this.applyCamera();
  },
  pan(dx, dy) {
    const p = this.pose, d = Math.max(R.v3.len(R.v3.sub(p.pos, p.center)), 1), s = d * 0.0016 * Math.tan(p.fov / 2) * 2 / 0.9;
    const up = R.quat.rotate(p.q, [0, 1, 0]), right = R.quat.rotate(p.q, [1, 0, 0]);
    const t = R.v3.add(R.v3.scale(right, -dx * s), R.v3.scale(up, dy * s));
    p.pos = R.v3.add(p.pos, t); p.center = R.v3.add(p.center, t); this.applyCamera();
  },
  zoom(f) {
    const p = this.pose, rel = R.v3.sub(p.pos, p.center), d = R.v3.len(rel);
    if (d < 1e-3) { p.fov = R.clamp(p.fov * f, 0.1, 2.4); this.applyCamera(); return; }
    const nd = R.clamp(d * f, 3, 2500); p.pos = R.v3.add(p.center, R.v3.scale(rel, nd / d)); this.applyCamera();
  },

  /* --------------------------------------------------------- pointer sensors */
  queuePick(x, y) {
    this.pickAt = [x, y];
    if (this.pickQueued) return; this.pickQueued = true;
    requestAnimationFrame(() => { this.pickQueued = false; if (this.pickAt) this.doPick(...this.pickAt); });
  },
  pickMesh(x, y) {
    const r = this.canvas.getBoundingClientRect(), sx = this.engine.getRenderWidth() / r.width, sy = this.engine.getRenderHeight() / r.height;
    return this.scene.pick((x - r.left) * sx, (y - r.top) * sy, (m) => m.isPickable && m.isEnabled() && m.isVisible && m.metadata && m.metadata.pick);
  },
  sensorsFor(mesh) {
    const chain = (mesh.metadata && mesh.metadata.chain) || [];
    for (const g of chain) {
      const ts = (g.f.children || []).filter((c) => c.type === 'TouchSensor' && c.f.enabled);
      if (ts.length) return ts.map((t) => ({ node: t, group: g }));
    }
    return [];
  },
  doPick(x, y) {
    if (this.ptr.down) return;
    const hit = this.pickMesh(x, y);
    if (!hit || !hit.hit) { this.setOver([], null); return; }
    const sens = this.sensorsFor(hit.pickedMesh);
    this.lastHit = hit;
    this.setOver(sens, hit);
  },
  localPoint(group, world) {
    const r = this.rec.get(group.id), M = r && r.tn ? r.tn.computeWorldMatrix(true) : BABYLON.Matrix.Identity();
    const inv = M.clone().invert();
    const p = BABYLON.Vector3.TransformCoordinates(world, inv);
    return [p.x, p.y, p.z];
  },
  setOver(sens, hit) {
    const old = this.ptr.over || [], now = sens.map((s) => s.node);
    for (const n of old) if (!now.includes(n)) { R.hooks.fire(n, 'isOver', false); }
    for (const s of sens) {
      if (!old.includes(s.node)) R.hooks.fire(s.node, 'isOver', true);
      if (hit) R.hooks.fire(s.node, 'hitPoint_changed', this.localPoint(s.group, hit.pickedPoint));
    }
    this.ptr.over = now;
    this.canvas.classList.toggle('is-over-sensor', now.length > 0);
  },
  click(x, y) {
    const hit = this.pickMesh(x, y); if (!hit || !hit.hit) return;
    const sens = this.sensorsFor(hit.pickedMesh), now = (performance.timeOrigin + performance.now()) / 1000;
    for (const s of sens) {
      R.hooks.fire(s.node, 'hitPoint_changed', this.localPoint(s.group, hit.pickedPoint));
      R.hooks.fire(s.node, 'isActive', true); R.hooks.fire(s.node, 'isActive', false); R.hooks.fire(s.node, 'touchTime', now);
    }
  },

  /* ---------------------------------------------------------------- frame */
  frame() {
    const now = (performance.timeOrigin + performance.now()) / 1000;
    if (this.world) {
      R.events.begin(now);
      for (const n of this.timeSensors || []) R.tickTimeSensor(n, now);
      R.events.drain();
      this.stepTransition();
      const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
      for (const m of this.ribbons || []) { if (m.isDisposed && m.isDisposed()) continue; try { m.setVector2('viewport', new BABYLON.Vector2(w, h)); m.setFloat('widthPx', (m._lw || 1) * (w / (this.canvas.clientWidth || w))); } catch (e) { /* not ready */ } }
      this.updateClip();
      this.updateBillboards();
    }
    this.scene.render();
    this.stats.frames++;
    this.frameTimes.push(performance.now()); if (this.frameTimes.length > 30) this.frameTimes.shift();
    if (this.frameWaiters && this.frameWaiters.length) { const w = this.frameWaiters; this.frameWaiters = []; w.forEach((f) => f()); }
    if (this.opts.onFrame) this.opts.onFrame(this);
  },
  fps() { const t = this.frameTimes; return t.length > 2 ? 1000 * (t.length - 1) / (t[t.length - 1] - t[0]) : 0; },
  updateBillboards() {
    // 19775-1 Billboard: with axisOfRotation 0 0 0 the node's +Z points at the eye and its +Y follows the viewer's up; with an axis it turns about that axis only
    const list = this.billboards; if (!list || !list.length) return;
    const cam = this.scene.activeCamera; if (!cam) return;
    const V = BABYLON.Vector3, T = this._bb || (this._bb = { inv: new BABYLON.Matrix(), m: new BABYLON.Matrix() });
    const eye = cam.globalPosition, up = cam.getDirection(V.Up());
    for (let i = list.length - 1; i >= 0; i--) {
      const tn = list[i].tn;
      if (tn.isDisposed()) { list.splice(i, 1); continue; }
      if (!tn.isEnabled(true)) continue;
      const pw = tn.parent ? tn.parent.computeWorldMatrix(true) : BABYLON.Matrix.IdentityReadOnly;
      pw.invertToRef(T.inv);
      const d = V.TransformCoordinates(eye, T.inv);
      if (d.lengthSquared() < 1e-12) continue;
      d.normalize();
      const ax = list[i].node.f.axisOfRotation;
      if (!ax[0] && !ax[1] && !ax[2]) {
        const u = V.TransformNormal(up, T.inv).normalize();
        let x = V.Cross(u, d);
        if (x.lengthSquared() < 1e-10) x = V.Cross(V.Right(), d);
        x.normalize();
        const y = V.Cross(d, x);
        BABYLON.Matrix.FromValuesToRef(x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, d.x, d.y, d.z, 0, 0, 0, 0, 1, T.m);
        tn.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(T.m);
      } else {
        const a = new V(ax[0], ax[1], ax[2]).normalize();
        const p = d.subtract(a.scale(V.Dot(a, d)));
        if (p.lengthSquared() < 1e-10) { tn.rotationQuaternion = BABYLON.Quaternion.Identity(); continue; }
        p.normalize();
        const ang = Math.atan2(V.Dot(V.Cross(new V(0, 0, 1), p), a), p.z);
        tn.rotationQuaternion = new BABYLON.Quaternion(...R.quat.fromAxisAngle([a.x, a.y, a.z], ang));
      }
    }
  },
  updateClip() {
    // 19775-1 ClipPlane: it clips the shapes in its own Group. The half space where a x + b y + c z + d is below zero is clipped; Babylon clips where the plane value is above zero.
    const list = this.clipMeshes || [];
    for (const it of list) {
      const m = it.mesh, mat = m.material; if (!mat || m.isDisposed()) continue;
      const n = it.clip, on = !!n.f.enabled;
      if (!on) { if (mat.clipPlane) mat.clipPlane = null; continue; }
      const p = n.f.plane, gr = this.rec.get(it.group.id), pr = gr && gr.tn ? gr.tn.computeWorldMatrix(true) : BABYLON.Matrix.Identity();
      const pl = BABYLON.Plane.FromPositionAndNormal(BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(-p[3] * p[0], -p[3] * p[1], -p[3] * p[2]), pr),
        BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(-p[0], -p[1], -p[2]), pr));
      mat.clipPlane = pl;
    }
  },
});
