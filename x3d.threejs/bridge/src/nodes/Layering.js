/* Layering and Layout for the three.js bridge (Layering level 1, Layout levels 1 and 2). The same rules as the Babylon bridge (x3d.webgpu/bridge/src/nodes/LayerSet.js, Viewport.js, LayoutGroup.js),
   drawn in passes. A LayerSet draws layer 0 (the world: everything outside it) and layers 1, 2, ... (the nodes of `layers`) one over the other, in the order of `order`; each layer is a pass through
   a camera of its own (its first Viewpoint, else one at 0 0 10; a LayoutLayer looks through an orthographic one, the canvas 2 units high) into the rectangle of its Viewport's clipBoundary, with the
   depth buffer cleared in that rectangle first. Objects belong to a layer by their `layers` bit (layer k: bit k; a world Viewport: bit 20 and up); lights belong to every layer. A Viewport node in
   the world is a pass of its own through the world's camera (with the canvas aspect: X_ITE squeezes the picture into the rectangle) over the world there. The layout engine is X_ITE 16.6.0's
   Layout.push, as the Babylon bridge has it. Drawn by Body.renderAll (body-three.js) from this.passes, which `update` rebuilds every frame. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, WV0 = 20;   // THREE is used only inside functions: the bundle also loads in node for the tooling tests
  const clamp = (v, d) => Math.min(1, Math.max(0, v ?? d));
  /* clipBoundary left right bottom top -> [x, y, width, height] as fractions of the canvas, y from the bottom */
  const rectOf = (vpn) => {
    const cb = vpn && vpn.type === 'Viewport' ? vpn.f.clipBoundary || [] : [], l = clamp(cb[0], 0), r = clamp(cb[1], 1), b = clamp(cb[2], 0), t = clamp(cb[3], 1);
    return [l, b, Math.max(r - l, 1e-6), Math.max(t - b, 1e-6)];
  };
  const L = T3.layers = {
    mk(body) { const o = { camP: new THREE.PerspectiveCamera(45, 1, 0.5, 4000), camO: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1e4) }; body.scene.add(o.camP, o.camO); return o; },   // in the scene: the headlight is a child of the camera that draws
    free(it) { if (it) { if (it.camP) it.camP.removeFromParent(); if (it.camO) it.camO.removeFromParent(); } },
    clear(body) { if (body.layerSet) for (const it of body.layerSet.items) L.free(it); if (body.wvps) for (const it of body.wvps.items) L.free(it); body.layerSet = null; body.wvps = null; body.passes = null; body.layoutRecs = null; },   // the world is replaced: its layers, viewports, passes and layouts go with it
    drop(body) { const st = body.layerSet; if (!st) return; for (const it of st.items) L.free(it); for (const it of st.items) if (it) for (const k of it.kids) body.disposeRec(k); body.disposeObj(st.tn); body.clips = (body.clips || []).filter((cl) => cl.parent && cl.parent.parent); body.clipDirty = true; body.refreshAmbient(); body.layerSet = null; body.passes = null; },
    /* ---- LayerSet ---- */
    make(body, set, parent, chain) {
      if (chain.length) { body.note('LayerSet: only a LayerSet at the root of the scene is used (X_ITE 16.6.0 ignores one inside a group), this one is not drawn'); return null; }
      L.drop(body);
      const tn = new THREE.Group(); tn.name = set.def || 'LayerSet'; parent.add(tn);
      const st = body.layerSet = { set, parent, chain, tn, items: [] };
      (set.f.layers || []).forEach((layer, i) => {
        if (!layer || (layer.type !== 'Layer' && layer.type !== 'LayoutLayer')) { st.items.push(null); return; }
        const bit = i + 1; if (bit >= WV0) { body.note('LayerSet: more than 19 layers, layer ' + bit + ' is not drawn'); st.items.push(null); return; }
        const lt = new THREE.Group(); lt.name = layer.def || 'Layer' + bit; lt.userData.layerBit = bit; lt.userData.layerNode = layer; tn.add(lt);
        const saved = body.viewpoints; body.viewpoints = [];   // a Viewpoint of the layer belongs to the layer, not to the world
        const isLay = layer.type === 'LayoutLayer', host = isLay ? new THREE.Group() : lt; if (isLay) { host.name = lt.name + '-layout'; lt.add(host); }   // a LayoutLayer lays its children out with its Layout
        const ch2 = [layer, ...chain], kids = (layer.f.children || []).map((c) => body.build(c, host, ch2));
        if (isLay) L.layout.add(body, { n: layer, tn: host, chain: ch2 });
        const vps = body.viewpoints; body.viewpoints = saved;
        st.items.push({ layer, lt, host, kids, vps, bit, isLay, ...L.mk(body) });
      });
      const r = { node: set, tn, kids: [], chain: [set, ...chain] }; body.rec.set(set.id, r); return r;
    },
    remake(body) { const st = body.layerSet; if (st) L.make(body, st.set, st.parent, st.chain); },   // make drops the old pass set and its record is replaced
    layerChanged(body, n, field) {
      const st = body.layerSet; if (!st || !st.items.some((it) => it && it.layer === n)) return;
      if (field === 'children' || field === 'layout') L.remake(body);   // visible and viewport are read every frame
    },
    /* ---- world Viewports ---- */
    addViewport(body, n, tn) {
      const st = (body.wvps ||= { items: [] }), live = (o) => { for (let p = o; p; p = p.parent) if (p === body.root) return true; return false; };
      for (const it of st.items) if (!live(it.tn)) L.free(it);
      st.items = st.items.filter((it) => live(it.tn) && it.tn !== tn);   // one entry for each use of the node (a USE'd Viewport has one object per use)
      const used = new Set(st.items.map((it) => it.bit)); let bit = WV0; while (used.has(bit) && bit < 32) bit++;
      if (bit >= 31) { body.note('Viewport: more than 11 Viewports in the world, this one is not drawn separately'); return; }
      tn.userData.layerBit = bit; st.items.push({ node: n, tn, bit, ...L.mk(body) });
    },
    /* ---- every frame: cameras, bits, rectangles, layouts ---- */
    update(body) {
      const live = (o) => { for (let p = o; p; p = p.parent) if (p === body.root) return true; return false; };
      if (body.layerSet && !live(body.layerSet.tn)) L.drop(body);   // the LayerSet was taken out of the world
      if (body.wvps) { for (const it of body.wvps.items) if (!live(it.tn)) L.free(it); body.wvps.items = body.wvps.items.filter((it) => live(it.tn)); }
      const st = body.layerSet, wv = body.wvps && body.wvps.items;
      if (!st && !(wv && wv.length)) { body.passes = null; L.layout.frame(body); return; }
      const W = body.canvas.clientWidth || 1, H = body.canvas.clientHeight || 1, mask = (root, bit) => root.traverse((o) => { const m = o.isLight ? 0xffffffff : 1 << bit; if (o.layers.mask !== m) o.layers.mask = m; });
      const worldCam = (it) => { const c = body.poseCamera(body.pose, it.camP, it.camO, W / H); c.layers.set(it.bit); c.userData.vp = rectOf(it.node); it.cam = c; };   // the world's pose, the canvas aspect: the picture is squeezed into the rectangle
      if (wv) { const depth = (o) => { let d = 0; for (let p = o.parent; p; p = p.parent) d++; return d; }; for (const it of [...wv].sort((a, b) => depth(a.tn) - depth(b.tn))) mask(it.tn, it.bit); for (const it of wv) worldCam(it); }   // an outer Viewport is masked first: the one inside it keeps its own bit
      if (st) for (const it of st.items) {
        if (!it) continue; mask(it.lt, it.bit);
        const vp = it.vps[0], p = vp ? body.vpPose(vp) : it.isLay ? { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: 0.7854, ortho: { f: [-1, -1, 1, 1], near: 0.1, far: 1e4, scale: 1 } } : { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: Math.PI / 4 };
        const r = rectOf(it.layer.f.viewport), c = body.poseCamera(p, it.camP, it.camO, (W * r[2]) / (H * r[3]));   // the layer's projection is made for the rectangle's own aspect
        c.layers.set(it.bit); c.userData.vp = r; it.cam = c; it.vp = r;
      }
      body.cam.layers.set(0);
      const passes = [];
      for (const idx of (st ? st.set.f.order : null) || [0]) {
        if (idx === 0) { passes.push({ cam: body.cam, vp: [0, 0, 1, 1], bit: 0 }); if (wv) for (const it of wv) if (it.node.f.visible !== false) passes.push({ cam: it.cam, vp: it.cam.userData.vp, bit: it.bit, wvp: it }); }
        else { const it = st && st.items[idx - 1]; if (it && it.layer.f.visible !== false) passes.push({ cam: it.cam, vp: it.vp, bit: it.bit, layer: it }); }
      }
      body.passes = passes;
      L.layout.frame(body);
    },
  };
  /* ---- the nodes ---- */
  T3.build.LayerSet = (body, n, parent, chain) => L.make(body, n, parent, chain);
  T3.changed.LayerSet = (body, n, field) => { if (field === 'layers') L.remake(body); };
  T3.changed.Layer = T3.changed.LayoutLayer = (body, n, field) => L.layerChanged(body, n, field);
  T3.build.Layout = T3.build.ScreenFontStyle = () => null;   // fields only: a LayoutGroup or LayoutLayer reads its Layout every frame
  T3.build.Viewport = (body, n, parent, chain) => {
    const r = body.buildGroup(n, parent, chain);
    if (r && !chain.some((c) => c.type === 'Layer' || c.type === 'LayoutLayer')) L.addViewport(body, n, r.tn);   // the viewport of a Layer is read by the layer (rectOf); in the world it is a pass of its own
    return r;
  };
  T3.changed.Viewport = (body, n, field) => {
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'visible') r.tn.visible = n.f.visible !== false;
  };
  /* ---- the layout engine: X_ITE 16.6.0 Layout.push ---- */
  L.layout = {
    add(body, rec) { rec.tn.userData.layoutRec = rec; (body.layoutRecs ||= []).push(rec); },
    camOf(body, tn) { for (let p = tn; p; p = p.parent) { const bit = p.userData && p.userData.layerBit, st = body.layerSet; if (bit && st) { const it = st.items.find((x) => x && x.bit === bit); if (it && it.cam) return it.cam; } if (bit && body.wvps) { const it = body.wvps.items.find((x) => x.tn === p); if (it && it.cam) return it.cam; } } return body.cam; },
    frame(body) {
      const recs = body.layoutRecs; if (!recs) return;
      const live = (body.layoutRecs = recs.filter((r) => { for (let p = r.tn; p; p = p.parent) if (p === body.root) return true; return false; }));
      const depth = (o) => { let d = 0; for (let p = o.parent; p; p = p.parent) d++; return d; };
      for (const r of live) r.depth = depth(r.tn);
      live.sort((a, b) => a.depth - b.depth);
      body.scene.updateMatrixWorld(true);
      for (const r of live) { L.layout.place(body, r); r.tn.updateMatrixWorld(true); }
    },
    view(cam) { cam.updateMatrixWorld(true); return cam.matrixWorldInverse.copy(cam.matrixWorld).invert(); },
    /* the node is put in view space like X_ITE does it: the view-space position and rotation of its parent stay, the translation and scale are put on top: M2 = T(ct) R T(tr) S, local = parent^-1 view^-1 M2 */
    set(tn, V, par, sc, tr) {
      const MV = new THREE.Matrix4().multiplyMatrices(V, par), cs = new THREE.Vector3(), cq = new THREE.Quaternion(), ct = new THREE.Vector3(); MV.decompose(ct, cq, cs);
      const M2 = new THREE.Matrix4().makeTranslation(ct.x, ct.y, ct.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(cq)).multiply(new THREE.Matrix4().makeTranslation(tr[0], tr[1], tr[2])).multiply(new THREE.Matrix4().makeScale(sc[0], sc[1], sc[2]));
      tn.matrixAutoUpdate = false; tn.matrix.copy(par.clone().invert().multiply(V.clone().invert()).multiply(M2)); tn.matrixWorldNeedsUpdate = true;
    },
    sizeOf(body, cam) {   // the canvas's pixels behind this camera, and the viewport in metres: the orthographic extent, or the near plane for a perspective camera
      const vp = cam.userData.vp || [0, 0, 1, 1], wpx = (body.canvas.clientWidth || 1) * vp[2], hpx = (body.canvas.clientHeight || 1) * vp[3];
      let mw, mh;
      if (cam.isOrthographicCamera) { mw = cam.right - cam.left; mh = cam.top - cam.bottom; }
      else { const size = (cam.near || 0.1) * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 2, ratio = wpx / hpx; if (ratio > 1) { mw = size * ratio; mh = size; } else { mw = size; mh = size / ratio; } }
      return { wpx, hpx, mw, mh };
    },
    placeScreen(body, r) {   // ScreenGroup: one unit = one pixel, the rotation of the group's place in the world, the origin where it is
      const tn = r.tn, cam = L.layout.camOf(body, tn), { wpx, hpx } = L.layout.sizeOf(body, cam), V = L.layout.view(cam);
      if (tn.parent) tn.parent.updateWorldMatrix(true, false);
      const par = tn.parent ? tn.parent.matrixWorld.clone() : new THREE.Matrix4(), MV = new THREE.Matrix4().multiplyMatrices(V, par), cs = new THREE.Vector3(), cq = new THREE.Quaternion(), ct = new THREE.Vector3(); MV.decompose(ct, cq, cs);
      let s;
      if (cam.isOrthographicCamera) s = (cam.top - cam.bottom) / hpx;
      else { const fv = THREE.MathUtils.degToRad(cam.fov), fm = hpx <= wpx ? fv : 2 * Math.atan(Math.tan(fv / 2) * wpx / hpx); s = Math.abs(ct.z) * Math.tan(fm / 2) * 2 / Math.min(wpx, hpx); }
      const M2 = new THREE.Matrix4().makeTranslation(ct.x, ct.y, ct.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(cq)).multiply(new THREE.Matrix4().makeScale(s, s, s));
      tn.matrixAutoUpdate = false; tn.matrix.copy(par.clone().invert().multiply(V.clone().invert()).multiply(M2)); tn.matrixWorldNeedsUpdate = true;
    },
    place(body, r) {
      if (r.screen) return L.layout.placeScreen(body, r);
      const tn = r.tn, ln = r.n.f.layout, F = 1, P = 2, W = 0, N = 0, S = 3;
      if (!ln || ln.type !== 'Layout') { tn.matrixAutoUpdate = false; tn.matrix.identity(); tn.matrixWorldNeedsUpdate = true; r.rect = null; return; }
      const parents = [];   // the Layout nodes around this one, outermost first; prect = the rectangle of the innermost
      let prect = null;
      for (let p = tn.parent; p; p = p.parent) { const pr = p.userData && p.userData.layoutRec; if (pr && pr.n.f.layout && pr.n.f.layout.type === 'Layout') { parents.unshift(pr.n.f.layout); if (!prect) prect = pr.rect; } }
      const cam = L.layout.camOf(body, tn), { wpx, hpx, mw, mh } = L.layout.sizeOf(body, cam);
      const pr = prect || [0, 0, mw, mh], index = parents.length - 1, px = mw / wpx, py = mh / hpx;
      const str = (v) => (Array.isArray(v) ? v : []), pick = (v, k) => (k === 0 ? v[0] : v.length > 1 ? v[1] : v[0]);
      const unit = (node, key, k, i) => {   // FRACTION / PIXEL / WORLD -> the unit of the layout around it
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
      const smx = sm(0), smy = sm(1), V = L.layout.view(cam);
      if (tn.parent) tn.parent.updateWorldMatrix(true, false);
      const par = tn.parent ? tn.parent.matrixWorld.clone() : new THREE.Matrix4(), MV = new THREE.Matrix4().multiplyMatrices(V, par), cs = new THREE.Vector3(), cq = new THREE.Quaternion(), ct = new THREE.Vector3(); MV.decompose(ct, cq, cs);
      const sc = [1, 1, 1];
      if (smx === N) sc[0] = cs.x; else if (smx === F) sc[0] = rect[2]; else if (smx === P) sc[0] = mw / wpx;
      if (smy === N) sc[1] = cs.y; else if (smy === F) sc[1] = rect[3]; else if (smy === P) sc[1] = mh / hpx;
      if (smx === S) {
        if (smy === S) { if (rect[2] > rect[3]) { sc[0] = rect[2]; sc[1] = sc[0]; } else { sc[1] = rect[3]; sc[0] = sc[1]; } } else sc[0] = sc[1];
      } else if (smy === S) sc[1] = sc[0];
      tr[0] += off[0]; tr[1] += off[1]; rect[0] = tr[0]; rect[1] = tr[1]; r.rect = rect;
      L.layout.set(tn, V, par, sc, tr);
    },
  };
  T3.build.LayoutGroup = (body, n, parent, chain) => { const r = body.buildGroup(n, parent, chain); L.layout.add(body, { n, tn: r.tn, chain: r.chain }); return r; };
  T3.build.ScreenGroup = (body, n, parent, chain) => { const r = body.buildGroup(n, parent, chain); L.layout.add(body, { n, tn: r.tn, chain: r.chain, screen: true }); return r; };
  T3.changed.LayoutGroup = T3.changed.ScreenGroup = (body, n, field) => { const r = body.rec.get(n.id); if (r && field === 'visible') r.tn.visible = n.f.visible !== false; };
}
