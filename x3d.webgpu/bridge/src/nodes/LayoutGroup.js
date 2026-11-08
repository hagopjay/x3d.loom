/* LayoutGroup (Layout level 1): LayoutGroup is a Grouping node that can contain most nodes, whose children are related by a common layout within a parent layout.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('LayoutGroup', {
  component: 'Layout', level: 1,
  container: 'children',
  defs: {
    addChildren: ['MFNode', IN, []],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', IO, []],
    layout: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    removeChildren: ['MFNode', IN, []],
    viewport: ['SFNode', IO, null],
    visible: ['SFBool', IO, true],
  },
  /* The children hang under a node of their own that BR.layout moves and scales every frame so that they sit in the rectangle the Layout describes (see BR.layout below). Without a Layout the
     group changes nothing. viewport is held (gap: the camera is shared with the rest of the world). */
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { const r = body.buildGroup(n, parent, chain); BR.layout.add(body, { n, tn: r.tn, chain: r.chain }); return r; },
  changed(body, n, field) {
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'children') body.rebuildGroup(n); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
  },
});

/* The layout engine, the same arithmetic as X_ITE 16.6.0's Layout.push: a layout is a rectangle (x y width height, in metres of the viewport) inside the rectangle of the layout around it
   (the first one: the whole viewport). The size and offset units are FRACTION (of the parent rectangle), PIXEL, or WORLD (= the unit of the layout around it, FRACTION at the top); align puts the
   rectangle inside its parent; the scale is NONE (as is), FRACTION (the rectangle's size), PIXEL (one unit is one pixel) or STRETCH (fit the rectangle). The viewport in metres is the
   orthographic extent for an orthographic camera and the near plane for a perspective one. The group is positioned in view space like X_ITE does it: its view-space position and rotation stay,
   the translation and scale are put on top. Each frame, before drawing; parents come before their children. */
BR.layout = {
  add(body, rec) {
    rec.tn.metadata = { ...(rec.tn.metadata || {}), layoutRec: rec };
    (body._lay ||= []).push(rec); BR.layout.hook(body);
  },
  hook(body) { if (!body._layoutHook) { body._layoutHook = true; body.scene.onBeforeRenderObservable.add(() => BR.layout.frame(body)); } },
  camOf(body, tn) {                                    // the camera that looks at a node: the one of the layer it sits in, else the world's
    for (let p = tn; p; p = p.parent) {
      const bit = p.metadata && p.metadata.layerBit, st = body._layers;
      if (bit && st) { const it = st.items.find((x) => x && x.bit === bit); if (it) return it.cam; }
    }
    return body.cam;
  },
  frame(body) {
    const L = body._lay; if (!L) return;
    const id = body.scene.getFrameId(); if (body._layFrame === id) return; body._layFrame = id;
    const live = L.filter((r) => !r.tn.isDisposed()); body._lay = live;
    const depth = (tn) => { let d = 0; for (let p = tn.parent; p; p = p.parent) d++; return d; };
    for (const r of live) r.depth = depth(r.tn);
    live.sort((a, b) => a.depth - b.depth);
    for (const r of live) BR.layout.place(body, r);
  },
  placeScreen(body, r) {                               // ScreenGroup: one unit = one pixel, the rotation of the group's place in the world, the origin where it is
    const tn = r.tn, B = BABYLON, cam = BR.layout.camOf(body, tn), cw = body.canvas.clientWidth || 1, ch = body.canvas.clientHeight || 1, vp = cam.viewport, wpx = cw * vp.width, hpx = ch * vp.height;
    const par = tn.parent ? tn.parent.getWorldMatrix() : B.Matrix.Identity(), V = cam.getViewMatrix(true), MV = par.multiply(V);
    const cs = new B.Vector3(), cq = new B.Quaternion(), ct = new B.Vector3(); MV.decompose(cs, cq, ct);
    let s;
    if (cam.mode === B.Camera.ORTHOGRAPHIC_CAMERA) s = (cam.orthoTop - cam.orthoBottom) / hpx;
    else { const fm = hpx <= wpx ? cam.fov : 2 * Math.atan(Math.tan(cam.fov / 2) * wpx / hpx); s = Math.abs(ct.z) * Math.tan(fm / 2) * 2 / Math.min(wpx, hpx); }
    const rotM = new B.Matrix(); B.Matrix.FromQuaternionToRef(cq, rotM);
    const M2 = B.Matrix.Scaling(s, s, s).multiply(rotM).multiply(B.Matrix.Translation(ct.x, ct.y, ct.z)), loc = M2.multiply(V.clone().invert()).multiply(par.clone().invert());
    const s2 = new B.Vector3(), q2 = new B.Quaternion(), p2 = new B.Vector3(); loc.decompose(s2, q2, p2);
    tn.scaling.copyFrom(s2); tn.rotationQuaternion = q2; tn.position.copyFrom(p2);
  },
  place(body, r) {
    if (r.screen) return BR.layout.placeScreen(body, r);
    const tn = r.tn, ln = r.n.f.layout, B = BABYLON, F = 1, P = 2, W = 0, N = 0, S = 3;
    if (!ln || ln.type !== 'Layout') { tn.position.set(0, 0, 0); tn.rotationQuaternion = null; tn.rotation.set(0, 0, 0); tn.scaling.set(1, 1, 1); r.rect = null; return; }
    const parents = [];                                  // the Layout nodes around this one, outermost first; prect = the rectangle of the innermost
    let prect = null;
    for (let p = tn.parent; p; p = p.parent) { const pr = p.metadata && p.metadata.layoutRec; if (pr && pr.n.f.layout && pr.n.f.layout.type === 'Layout') { parents.unshift(pr.n.f.layout); if (!prect) prect = pr.rect; } }
    const cam = BR.layout.camOf(body, tn), cw = body.canvas.clientWidth || 1, ch = body.canvas.clientHeight || 1, vp = cam.viewport, wpx = cw * vp.width, hpx = ch * vp.height;
    let mw, mh;
    if (cam.mode === B.Camera.ORTHOGRAPHIC_CAMERA) { mw = cam.orthoRight - cam.orthoLeft; mh = cam.orthoTop - cam.orthoBottom; }
    else { const size = (cam.minZ || 0.1) * Math.tan(cam.fov / 2) * 2, ratio = wpx / hpx; if (ratio > 1) { mw = size * ratio; mh = size; } else { mw = size; mh = size / ratio; } }
    const pr = prect || [0, 0, mw, mh], index = parents.length - 1, px = mw / wpx, py = mh / hpx;
    const str = (v) => (Array.isArray(v) ? v : []), pick = (v, k) => (k === 0 ? v[0] : v.length > 1 ? v[1] : v[0]);
    const unit = (node, key, k, i) => {                  // FRACTION / PIXEL / WORLD -> inherit
      const s = pick(str(node.f[key]), k), u = s === 'FRACTION' ? F : s === 'PIXEL' ? P : W;
      return u === W ? (i >= 0 ? unit(parents[i], key, k, i - 1) : F) : u;
    };
    const num = (v, k) => (k === 0 ? v[0] ?? 0 : v[1] ?? v[0] ?? 0);
    const sizeX = num(str(ln.f.size), 0), sizeY = num(str(ln.f.size), 1), offX = num(str(ln.f.offset), 0), offY = num(str(ln.f.offset), 1);
    const rect = [0, 0, 0, 0], sux = unit(ln, 'sizeUnits', 0, index), suy = unit(ln, 'sizeUnits', 1, index);
    if (sux === F) rect[2] = sizeX * pr[2]; else if (sux === P) rect[2] = sizeX * px;
    if (suy === F) rect[3] = sizeY * pr[3]; else if (suy === P) rect[3] = sizeY * py;
    const al = str(ln.f.align), ax = al[0] === 'LEFT' ? -1 : al[0] === 'RIGHT' ? 1 : 0, ay = al[1] === 'BOTTOM' ? -1 : al[1] === 'TOP' ? 1 : 0;
    const tr = [0, 0, 0];
    if (ax) tr[0] = ax * (pr[2] - rect[2]) / 2; else if (sux === P && (Math.round(wpx) & 1)) tr[0] = -px / 2;
    if (ay) tr[1] = ay * (pr[3] - rect[3]) / 2; else if (sux === P && (Math.round(hpx) & 1)) tr[1] = -py / 2;
    const oux = unit(ln, 'offsetUnits', 0, index), ouy = unit(ln, 'offsetUnits', 1, index), off = [0, 0, 0];
    if (oux === F) off[0] = offX * pr[2]; else if (oux === P) off[0] = offX * mw / wpx;
    if (ouy === F) off[1] = offY * pr[3]; else if (ouy === P) off[1] = offY * mh / hpx;
    const sm = (k) => { const s = pick(str(ln.f.scaleMode), k), m = s === 'FRACTION' ? F : s === 'PIXEL' ? P : s === 'STRETCH' ? S : N; return !parents.length && m === N ? F : m; };
    const smx = sm(0), smy = sm(1);
    const par = tn.parent ? tn.parent.getWorldMatrix() : B.Matrix.Identity(), V = cam.getViewMatrix(true), MV = par.multiply(V);
    const cs = new B.Vector3(), cq = new B.Quaternion(), ct = new B.Vector3(); MV.decompose(cs, cq, ct);
    const sc = [1, 1, 1];
    if (smx === N) sc[0] = cs.x; else if (smx === F) sc[0] = rect[2]; else if (smx === P) sc[0] = mw / wpx;
    if (smy === N) sc[1] = cs.y; else if (smy === F) sc[1] = rect[3]; else if (smy === P) sc[1] = mh / hpx;
    if (smx === S) {
      if (smy === S) { if (rect[2] > rect[3]) { sc[0] = rect[2]; sc[1] = sc[0]; } else { sc[1] = rect[3]; sc[0] = sc[1]; } } else sc[0] = sc[1];
    } else if (smy === S) sc[1] = sc[0];
    tr[0] += off[0]; tr[1] += off[1]; rect[0] = tr[0]; rect[1] = tr[1]; r.rect = rect;
    const rotM = new B.Matrix(); B.Matrix.FromQuaternionToRef(cq, rotM);
    const M2 = B.Matrix.Scaling(sc[0], sc[1], sc[2]).multiply(B.Matrix.Translation(tr[0], tr[1], tr[2])).multiply(rotM).multiply(B.Matrix.Translation(ct.x, ct.y, ct.z));
    const loc = M2.multiply(V.clone().invert()).multiply(par.clone().invert());
    const s2 = new B.Vector3(), q2 = new B.Quaternion(), p2 = new B.Vector3(); loc.decompose(s2, q2, p2);
    tn.scaling.copyFrom(s2); tn.rotationQuaternion = q2; tn.position.copyFrom(p2);
  },
};
