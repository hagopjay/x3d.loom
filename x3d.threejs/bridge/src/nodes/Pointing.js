/* Pointer layer of the three.js bridge: navigation input (orbit, pan, pinch, wheel), picking with a THREE.Raycaster, TouchSensor, the drag sensors of the shared kit (PlaneSensor, SphereSensor,
   CylinderSensor: dragStart / dragMove / dragEnd get a ray in the frame of the sensor's group as it was at the press), Anchor clicks, KeySensor and StringSensor, VisibilitySensor and
   TransformSensor. The same rules as the Babylon bridge's body-br.js and body-cam.js, written against three.js.
   TouchSensor (19775-1 20.4.3, as X_ITE 16.6.0 does it): isOver on enter and leave of the sensor's shape, hitPoint_changed / hitNormal_changed / hitTexCoord_changed while over, isActive TRUE on a press
   over the shape, FALSE on the release, touchTime on a release that is still over the shape. A press on a drag sensor takes the pointer (the view does not move); a press on a TouchSensor does not. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const live = {}; R.bridge.live = (k) => (live[k] ||= new Set());
  const T3 = R.bridge.three, DRAG = (t) => { const s = R.bridge.specs.get(t); return !!(s && s.dragStart); }, TOUCH = (t) => t === 'TouchSensor' || t === 'GeoTouchSensor', SENS = (c) => c.f.enabled !== false && (TOUCH(c.type) || DRAG(c.type));
  for (const t of ['TouchSensor', 'GeoTouchSensor', 'PlaneSensor', 'SphereSensor', 'CylinderSensor']) T3.build[t] = (body, n) => { (live.ptr ||= new Set()).add(n); return null; };   // live.ptr: the world has a pointer sensor, so hover is worth a pick
  T3.build.KeySensor = T3.build.StringSensor = (body, n, parent) => { n._host = parent; (live.key ||= new Set()).add(n); return null; };
  /* a sensor is live while the group it sits in is attached to the page and shown (a Switch choice, a LOD level, a load FALSE Inline or a removed child turn it off) */
  const attached = (o, root) => { for (let x = o; x; x = x.parent) { if (x.visible === false) return false; if (x === root) return true; } return false; };
  T3.build.VisibilitySensor = T3.build.TransformSensor = (body, n, parent) => { n._tn = parent; return null; };
  T3.live = (body, n) => attached(n._tn || n._host, body.root);
  const P = T3.pointer = {
    reset() { for (const s of Object.values(live)) s.clear(); },
    /* ---- picking ---- */
    pick(body, x, y, only) {                            // only: the pass a held sensor was pressed in ({cam, vp, bit}): X_ITE keeps a press in its layer, so the pointer is followed through that pass alone, even off its rectangle
      // client pixel -> { mesh, point, normal, uv, cam, vp } in world space, or null. With layers or Viewports: the passes that are drawn from the top one down, each through its camera and its layer bit
      const r = body.canvas.getBoundingClientRect(); if (!body.root || !r.width || !r.height) return null;
      body.scene.updateMatrixWorld(true);
      const fx = (x - r.left) / r.width, fy = 1 - (y - r.top) / r.height, passes = body.passes;
      if (only) return P.pickThrough(body, fx, fy, only.cam, only.vp, only.bit, true);
      if (!passes) return P.pickThrough(body, fx, fy, body.cam, [0, 0, 1, 1], 0, false);
      for (let i = passes.length - 1; i >= 0; i--) {
        const ps = passes[i]; if (ps.layer && ps.layer.layer.f.pointerEvents === false) continue;   // a layer with pointerEvents FALSE is passed over
        const v = ps.vp; if (fx < v[0] || fx > v[0] + v[2] || fy < v[1] || fy > v[1] + v[3]) continue;   // outside the rectangle of the layer or Viewport
        const h = P.pickThrough(body, fx, fy, ps.cam, v, ps.bit, true); if (h) return h;   // the first layer that has a hit wins whatever its depth (X_ITE 16.6.0)
      }
      return null;
    },
    pickThrough(body, fx, fy, cam, v, bit, layered) {
      const rc = (body.raycaster ||= new THREE.Raycaster());
      rc.layers.set(bit); rc.setFromCamera(new THREE.Vector2(((fx - v[0]) / v[2]) * 2 - 1, ((fy - v[1]) / v[3]) * 2 - 1), cam); rc.near = cam.near; rc.far = cam.far;
      const list = []; body.root.traverse((o) => { if (!o.isMesh || !o.userData) return; const own = o.userData.shape ? o : (o.userData.hatchOf && o.userData.hatchOf.visible === false ? o.userData.hatchOf : null); if (!own) return; for (let p = o; p; p = p.parent) if (!p.visible) return; list.push(o); });   // a shape drawn as hatching only (filled FALSE) is touched through its hatch
      const hit = rc.intersectObjects(list, false).find((h) => { const m = h.object.material, cp = (m && m.clippingPlanes) || []; return cp.every((pl) => pl.distanceToPoint(h.point) >= 0); }); if (!hit) return null;   // a ClipPlane cuts what can be touched as it cuts what is drawn
      const nm = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld), n = hit.face ? hit.face.normal.clone().applyMatrix3(nm).normalize() : new THREE.Vector3(0, 0, 1);
      return { mesh: hit.object.userData.shape ? hit.object : hit.object.userData.hatchOf, point: hit.point.clone(), normal: n, uv: hit.uv ? [hit.uv.x, hit.uv.y] : [0, 0], cam, vp: v, bit };
    },
    /* the sensors of the nearest group around the shape that holds any enabled one */
    sensorsFor(mesh) {
      for (const g of (mesh.userData && mesh.userData.chain) || []) {
        const s = (g.f.children || []).filter(SENS); if (!s.length) continue;
        let obj = null; for (let p = mesh.parent; p && !obj; p = p.parent) if (p.userData && p.userData.node === g) obj = p;   // the object of THIS use of the group (a USE'd group has one record, many objects)
        return s.map((n) => ({ node: n, group: g, obj }));
      }
      return [];
    },
    frameOf(body, g, obj) { const o = obj || (body.rec.get(g.id) || {}).tn; if (o) { o.updateWorldMatrix(true, false); return o.matrixWorld.clone(); } return new THREE.Matrix4(); },
    local(M, p, dir) {
      const v = new THREE.Vector3(p.x, p.y, p.z);
      if (!dir) return v.applyMatrix4(M.clone().invert()).toArray();
      return v.applyMatrix3(new THREE.Matrix3().setFromMatrix4(M).transpose()).normalize().toArray();   // a normal goes back with the transpose of the forward matrix (the inverse of its inverse transpose): right under a non-uniform scale
    },
    over(body, sens, hit) {
      const st = body.ptr, old = st.over || [], now = sens.map((s) => s.node);
      for (const n of old) if (!now.includes(n)) R.hooks.fire(n, 'isOver', false);
      for (const s of sens) {
        if (!old.includes(s.node)) R.hooks.fire(s.node, 'isOver', true);
        if (hit && TOUCH(s.node.type)) P.hitEvents(body, s, hit);
      }
      st.over = now; body.canvas.classList.toggle('is-over-sensor', now.length > 0);
    },
    hitEvents(body, s, hit) {
      const M = P.frameOf(body, s.group, s.obj), pt = P.local(M, hit.point), nr = P.local(M, hit.normal, true);
      if (s.node.type === 'GeoTouchSensor') {   // texCoord, normal, point, then the geographic coordinate: the local hit point through the sensor's geoSystem and GeoOrigin, as X_ITE does (true only with no Transform above)
        R.hooks.fire(s.node, 'hitTexCoord_changed', hit.uv); R.hooks.fire(s.node, 'hitNormal_changed', nr); R.hooks.fire(s.node, 'hitPoint_changed', pt); R.hooks.fire(s.node, 'hitGeoCoord_changed', Array.from(R.bridge.geo.geoOf(s.node, pt))); return;
      }
      R.hooks.fire(s.node, 'hitPoint_changed', pt); R.hooks.fire(s.node, 'hitNormal_changed', nr); R.hooks.fire(s.node, 'hitTexCoord_changed', hit.uv);
    },
    /* a sensor that is disabled while it is over, pressed or dragged lets go at once */
    release(body, n) {
      const st = body.ptr; if (!st) return;
      if (st.over && st.over.includes(n)) { st.over = st.over.filter((x) => x !== n); R.hooks.fire(n, 'isOver', false); }
      if (st.touch && st.touch.some((s) => s.node === n)) { st.touch = st.touch.filter((s) => s.node !== n); if (!st.touch.length) st.touch = null; R.hooks.fire(n, 'isActive', false); }
      if (st.drag && st.drag.sens.some((s) => s.node === n)) { st.drag.sens = st.drag.sens.filter((s) => s.node !== n); R.bridge.drag.end(n); if (!st.drag.sens.length) st.drag = null; }
    },
    hover(body, x, y) { const st = body.ptr, h = P.pick(body, x, y, st && st.touch ? st.pass : null); P.over(body, h ? P.sensorsFor(h.mesh) : [], h); },
    /* ---- navigation ---- */
    pan(body, dx, dy) {
      const p = body.pose, d = Math.max(R.v3.len(R.v3.sub(p.pos, p.center)), 1), s = p.ortho ? (body.cam.top - body.cam.bottom) / (body.canvas.clientHeight || 1) : d * 0.0016 * Math.tan(p.fov / 2) * 2 / 0.9;   // an orthographic view: the height of the view in world units over its pixels
      const up = R.quat.rotate(p.q, [0, 1, 0]), right = R.quat.rotate(p.q, [1, 0, 0]), t = R.v3.add(R.v3.scale(right, -dx * s), R.v3.scale(up, dy * s));
      body.tr = null; body.pose = { ...p, pos: R.v3.add(p.pos, t), center: R.v3.add(p.center, t) }; body.applyCamera();
    },
    /* ---- the frame a drag sensor works in: rays, the screen projection and the camera, all in the sensor's group frame as it was at the press ---- */
    dragFrame(body, M, hit) {   // hit: the pick that started the drag: its camera and rectangle (a layer's), else the world's
      const inv = M.clone().invert(), cv = body.canvas, cam = (hit && hit.cam) || body.cam, vp = (hit && hit.vp) || [0, 0, 1, 1], V = THREE.Vector3;
      const ray = (x, y) => { const r = cv.getBoundingClientRect(), rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(((x / r.width - vp[0]) / vp[2]) * 2 - 1, (((1 - y / r.height) - vp[1]) / vp[3]) * 2 - 1), cam); const o = rc.ray.origin.clone().applyMatrix4(inv), d = rc.ray.direction.clone().transformDirection(inv); return { o: o.toArray(), d: d.toArray() }; };
      const scr = (p) => { const r = cv.getBoundingClientRect(), v = new V(p[0], p[1], p[2]).applyMatrix4(M).project(cam); return [(vp[0] + (v.x + 1) / 2 * vp[2]) * r.width, (1 - vp[1] - (v.y + 1) / 2 * vp[3]) * r.height]; };
      const eye = cam.getWorldPosition(new V()).applyMatrix4(inv), fw = new V(0, 0, -1).transformDirection(cam.matrixWorld).transformDirection(inv).normalize();
      return { ray, scr, cam: { pos: eye.toArray(), back: [-fw.x, -fw.y, -fw.z] } };
    },
    /* ---- input ---- */
    init(body) {
      const cv = body.canvas, st = body.ptr = { down: false, x: 0, y: 0, sx: 0, sy: 0, t0: 0, moved: 0, button: 0, pts: new Map(), pinch: 0, shift: false, over: null, drag: null, touch: null };
      cv.style.touchAction = 'none'; cv.addEventListener('contextmenu', (e) => e.preventDefault());
      const rel = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', (e) => {
        if (st.drag || st.touch) return;   // a second finger or button while a sensor is held is none of the sensor's business, and does not take it away
        cv.setPointerCapture(e.pointerId); st.pts.set(e.pointerId, [e.clientX, e.clientY]);
        st.down = true; st.x = st.sx = e.clientX; st.y = st.sy = e.clientY; st.t0 = performance.now(); st.moved = 0; st.button = e.button; st.shift = e.shiftKey; st.drag = null; st.touch = null; st.activeId = null;
        if (st.pts.size === 2) { const [a, b] = [...st.pts.values()]; st.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); st.moved = 99; return; }   // two fingers are a pinch, never a click
        if (e.button !== 0 || st.pts.size !== 1) return;
        const hit = P.pick(body, e.clientX, e.clientY); if (!hit) return; const sens = P.sensorsFor(hit.mesh); if (!sens.length) return;
        P.over(body, sens, hit); st.activeId = e.pointerId;   // isOver comes before isActive, as it does when the pointer has moved onto the shape first
        const drags = sens.filter((s) => DRAG(s.node.type)), touches = sens.filter((s) => TOUCH(s.node.type));
        if (touches.length) { st.touch = touches; st.pass = hit.cam ? { cam: hit.cam, vp: hit.vp, bit: hit.bit } : null; for (const s of touches) { P.hitEvents(body, s, hit); R.hooks.fire(s.node, 'isActive', true); } }
        if (drags.length) {
          const M = P.frameOf(body, drags[0].group, drags[0].obj), fr = P.dragFrame(body, M, hit), pt = rel(e), rl = fr.ray(pt[0], pt[1]), hp = P.local(M, hit.point);
          st.drag = { sens: drags, fr }; e.stopImmediatePropagation(); st.down = false;   // the view does not move
          for (const s of drags) R.bridge.drag.start(s.node, { o: rl.o, d: rl.d, hit: hp, pointer: pt, ray: fr.ray, scr: fr.scr, cam: fr.cam });
        }
      });
      cv.addEventListener('pointermove', (e) => {
        if (st.pts.has(e.pointerId)) st.pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (st.activeId != null && e.pointerId !== st.activeId) return;
        if (st.drag) { const pt = rel(e), rl = st.drag.fr.ray(pt[0], pt[1]); for (const s of st.drag.sens) R.bridge.drag.move(s.node, { o: rl.o, d: rl.d, pointer: pt, ray: st.drag.fr.ray, scr: st.drag.fr.scr, cam: st.drag.fr.cam }); return; }
        if (st.down && st.pts.size === 2 && !st.touch) { const [a, b] = [...st.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (st.pinch > 0) body.zoom(st.pinch / d); st.pinch = d; st.moved += 10; return; }
        if (st.down) { const dx = e.clientX - st.x, dy = e.clientY - st.y; st.x = e.clientX; st.y = e.clientY; st.moved += Math.abs(dx) + Math.abs(dy); if (st.button === 2 || st.button === 1 || st.shift) P.pan(body, dx, dy); else body.orbit(dx, dy); }
        if ((!st.down || st.touch) && live.ptr && live.ptr.size) {   // hover: once a frame, only when the world has a pointer sensor, and while a TouchSensor is held (isOver follows the pointer off the shape)
          st.pickAt = [e.clientX, e.clientY]; if (!st.queued) { st.queued = true; requestAnimationFrame(() => { st.queued = false; if (st.pickAt) P.hover(body, ...st.pickAt); }); }
        }
      });
      const up = (e) => {
        st.pts.delete(e.pointerId);
        if ((st.drag || st.touch) && st.activeId != null && e.pointerId !== st.activeId) return;   // another finger lifting does not end the sensor's press
        if (st.drag) { const d = st.drag; st.drag = null; e.stopImmediatePropagation(); for (const s of d.sens) R.bridge.drag.end(s.node); }
        if (st.touch) {
          const t = st.touch, now = (performance.timeOrigin + performance.now()) / 1000, hit = e.type === 'pointerup' ? P.pick(body, e.clientX, e.clientY, st.pass) : null, here = hit ? P.sensorsFor(hit.mesh).map((s) => s.node) : []; st.touch = null;
          for (const s of t) { R.hooks.fire(s.node, 'isActive', false); if (here.includes(s.node)) R.hooks.fire(s.node, 'touchTime', now); }
        }
        st.activeId = null; if (e.type === 'pointerup' && live.ptr && live.ptr.size) P.hover(body, e.clientX, e.clientY);   // the pointer is where it was let go: isOver is told
        if (!st.down) return;
        if (st.pts.size === 1) { const q = [...st.pts.values()][0]; st.x = q[0]; st.y = q[1]; st.pinch = 0; }   // one finger of a pinch is left: it orbits from where it is, not from where it was
        if (st.pts.size === 0) {
          st.down = false;
          if (st.moved < 6 && performance.now() - st.t0 < 600 && e.type === 'pointerup') { const h = P.pick(body, e.clientX, e.clientY); if (h && st.button === 0) { const ch = h.mesh.userData.chain || [], ia = ch.findIndex((g) => g.type === 'Anchor'), is = ch.findIndex((g) => (g.f.children || []).some(SENS)); if (ia >= 0 && !(is >= 0 && is < ia) && ch[ia].f.load !== false) R.bridge.specs.get('Anchor').activate(body, ch[ia]); } }   // the left button; a sensor nearer the shape than the Anchor keeps the click
        }
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { st.pickAt = null; if (!st.down) P.over(body, [], null); });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); body.zoom(Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 240) * 0.0012)); }, { passive: false });
      /* key sensors: the canvas takes focus, key down and up go to every enabled KeySensor and StringSensor of the world, losing focus lets go of held modifiers */
      if (cv.tabIndex < 0) cv.tabIndex = 0; cv.style.outline = 'none';
      const each = (fn, e) => { let used = false; for (const n of live.key || []) if (T3.live(body, n) && R.bridge.specs.get(n.type)[fn](n, e)) used = true; return used; };
      cv.addEventListener('keydown', (e) => { if (each('keydown', e)) e.preventDefault(); });
      cv.addEventListener('keyup', (e) => { if (each('keyup', e)) e.preventDefault(); });
      cv.addEventListener('blur', () => { for (const n of live.key || []) R.bridge.specs.get(n.type).release(n); });
    },
  };
  /* VisibilitySensor and TransformSensor: the shared specs' tick(n, now) reads the Babylon scene; the same rules written against three.js */
  const BR = R.bridge;
  BR.specs.get('VisibilitySensor').tick = (n, now) => {
    const body = BR.body, f = n.f; if (!body || !n._tn || !body.cam) return;
    const sz = f.size, on = f.enabled && T3.live(body, n) && (sz[0] > 0 || sz[1] > 0 || sz[2] > 0); let vis = false;
    if (on) {
      body.cam.updateMatrixWorld(true); n._tn.updateWorldMatrix(true, false); const c = f.center, box = new THREE.Box3();
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz2 of [-1, 1]) box.expandByPoint(new THREE.Vector3(c[0] + sx * sz[0] / 2, c[1] + sy * sz[1] / 2, c[2] + sz2 * sz[2] / 2).applyMatrix4(n._tn.matrixWorld));
      vis = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(body.cam.projectionMatrix, body.cam.matrixWorldInverse)).intersectsBox(box);
    }
    if (vis && !f.isActive) { f.isActive = true; events.emit(n, 'isActive', true); f.enterTime = now; events.emit(n, 'enterTime', now); }
    else if (!vis && f.isActive) { f.isActive = false; events.emit(n, 'isActive', false); f.exitTime = now; events.emit(n, 'exitTime', now); }
  };
  BR.specs.get('TransformSensor').tick = (n, now) => {
    const body = BR.body, f = n.f, t = f.targetObject; if (!body || !n._tn) return;
    const rec = t && body.rec.get(t.id), tn = rec && (rec.tn || (rec.meshes && rec.meshes[0] && rec.meshes[0].parent));
    const z = f.size[0] === 0 && f.size[1] === 0 && f.size[2] === 0, always = f.size[0] === -1 && f.size[1] === -1 && f.size[2] === -1;
    let inside = false, pos, rot;
    if (f.enabled && tn && !z && T3.live(body, n)) {
      tn.updateWorldMatrix(true, false); n._tn.updateWorldMatrix(true, false);
      const rel = new THREE.Matrix4().copy(n._tn.matrixWorld).invert().multiply(tn.matrixWorld), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
      rel.decompose(p, q, s); pos = p.toArray(); rot = BR.q.toRot([q.x, q.y, q.z, q.w]);
      const c = f.center, h = f.size.map((x) => x / 2);
      inside = always || (pos[0] >= c[0] - h[0] && pos[0] <= c[0] + h[0] && pos[1] >= c[1] - h[1] && pos[1] <= c[1] + h[1] && pos[2] >= c[2] - h[2] && pos[2] <= c[2] + h[2]);
    }
    const near = (a, b) => a && b && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
    if (inside) {
      if (!f.isActive) { BR.fire(n, 'isActive', true); BR.fire(n, 'enterTime', now); BR.fire(n, 'position_changed', pos); BR.fire(n, 'orientation_changed', rot); }
      else { if (!near(f.position_changed, pos)) BR.fire(n, 'position_changed', pos); if (!near(f.orientation_changed, rot)) BR.fire(n, 'orientation_changed', rot); }
    } else if (f.isActive) { BR.fire(n, 'isActive', false); BR.fire(n, 'exitTime', now); }
  };
}

R.bridge.three.changed.TouchSensor = R.bridge.three.changed.GeoTouchSensor = R.bridge.three.changed.PlaneSensor = R.bridge.three.changed.SphereSensor = R.bridge.three.changed.CylinderSensor = (body, n, field) => { if (field === 'enabled' && n.f.enabled === false) R.bridge.three.pointer.release(body, n); };
