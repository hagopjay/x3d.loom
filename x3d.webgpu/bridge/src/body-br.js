/* Bridge kit, Babylon side. Concatenated after brain/body.js and body-cam.js (Body is a class in the bundle scope). A node the kit owns is built by its own spec.build;
   a node with no build is an event or data node the reader runs, and the body stays silent about it instead of noting "skipped". Types the kit does not own go to the stock build. */
{
  const _build = Body.prototype.build;
  Body.prototype.build = function (n, parent, chain) {
    const s = R.bridge.specs.get(n && n.type);
    if (s) return s.build ? s.build(this, n, parent, chain) : null;
    return _build.call(this, n, parent, chain);
  };
  const _changed = Body.prototype.changed;
  Body.prototype.changed = function (node, field) {
    const s = R.bridge.specs.get(node.type);
    if (s && s.changed) s.changed(this, node, field);
    return _changed.call(this, node, field);
  };
}

/* pointer drag sensors: a press on a Shape starts every drag sensor (a spec with dragStart) that is a child of the Shape's nearest group that has one; the ray is expressed in that group's
   frame as it was at the press. A press that starts a drag does not orbit the camera. */
{
  const _setWorld = Body.prototype.setWorld;
  const live = {}; R.bridge.live = (k) => (live[k] ||= new Set());     // nodes of one kind in the world on screen (key sensors), emptied when the world is replaced
  Body.prototype.setWorld = function (...a) { R.bridge.body = this; for (const s of Object.values(live)) s.clear(); return _setWorld.apply(this, a); };
  const _click = Body.prototype.click;
  Body.prototype.click = function (x, y) {          // a click under an Anchor follows it, the nearest Anchor wins
    _click.call(this, x, y);
    const hit = this.pickMesh(x, y); if (!hit || !hit.hit) return;
    for (const g of (hit.pickedMesh.metadata && hit.pickedMesh.metadata.chain) || []) if (g.type === 'Anchor') { if (g.f.load !== false) R.bridge.specs.get('Anchor').activate(this, g); break; }
  };
  const _init = Body.prototype.init;
  Body.prototype.init = async function (...a) { const r = await _init.apply(this, a); R.bridge.pointerInit(this); R.bridge.keyInit(this); return r; };
  /* key sensors: the canvas takes focus (tabindex), key down and up go to every enabled KeySensor and StringSensor of the world, losing focus lets go of held modifiers */
  R.bridge.keyInit = (body) => {
    const cv = body.canvas; if (cv.tabIndex < 0) cv.tabIndex = 0; cv.style.outline = 'none';
    const each = (fn, e) => { let used = false; for (const n of live.key || []) if (R.bridge.specs.get(n.type)[fn](n, e)) used = true; return used; };
    cv.addEventListener('keydown', (e) => { if (each('keydown', e)) e.preventDefault(); });
    cv.addEventListener('keyup', (e) => { if (each('keyup', e)) e.preventDefault(); });
    cv.addEventListener('blur', () => { for (const n of live.key || []) R.bridge.specs.get(n.type).release(n); });
  };
  R.bridge.pointerInit = (body) => {
    const cv = body.canvas, V = BABYLON.Vector3; let drag = null;
    const ray = (e, inv) => {
      const r = cv.getBoundingClientRect(), sx = body.engine.getRenderWidth() / r.width, sy = body.engine.getRenderHeight() / r.height;
      const pr = body.scene.createPickingRay((e.clientX - r.left) * sx, (e.clientY - r.top) * sy, BABYLON.Matrix.IdentityReadOnly, body.scene.activeCamera);
      const o = V.TransformCoordinates(pr.origin, inv), d = V.TransformNormal(pr.direction, inv);
      return { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z] };
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const hit = body.pickMesh(e.clientX, e.clientY); if (!hit || !hit.hit) return;
      for (const g of (hit.pickedMesh.metadata && hit.pickedMesh.metadata.chain) || []) {
        const sens = (g.f.children || []).filter((c) => { const s = R.bridge.specs.get(c.type); return s && s.dragStart && c.f.enabled !== false; });
        if (!sens.length) continue;
        const rec = body.rec.get(g.id), inv = (rec && rec.tn ? rec.tn.computeWorldMatrix(true) : BABYLON.Matrix.Identity()).clone().invert();
        const rl = ray(e, inv), hp = V.TransformCoordinates(hit.pickedPoint, inv);
        drag = { sens, inv }; cv.setPointerCapture(e.pointerId); e.stopImmediatePropagation();
        for (const s of sens) R.bridge.drag.start(s, { o: rl.o, d: rl.d, hit: [hp.x, hp.y, hp.z] });
        return;
      }
    }, true);
    cv.addEventListener('pointermove', (e) => { if (!drag) return; e.stopImmediatePropagation(); const rl = ray(e, drag.inv); for (const s of drag.sens) R.bridge.drag.move(s, { o: rl.o, d: rl.d }); }, true);
    const up = (e) => { if (!drag) return; e.stopImmediatePropagation(); const d = drag; drag = null; for (const s of d.sens) R.bridge.drag.end(s); };
    cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
  };
}
