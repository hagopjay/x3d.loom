/* Geospatial for the three.js bridge: GeoLocation and GeoTransform (a group with a matrix from R.bridge.geo, in doubles), GeoOrigin and GeoCoordinate (the points are read through R.bridge.geo.view),
   GeoLOD (two levels, decided every frame on the distance of `center` to the eye) and GeoViewpoint (pose from R.bridge.geo, near 0.125 and far 1e9 as in X_ITE) and the page's viewpoint list
   (ViewpointGroup). The geographic maths is the Babylon bridge's (x3d.webgpu/bridge/src/nodes/Geo*.js): only the drawing half is written again here. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, G = BR.geo, GV = (v) => v && v.type === 'GeoViewpoint';
  /* the matrix of a GeoLocation / GeoTransform: the row-vector 4x4 of BR.geo has the same 16 numbers as a column-major three.js matrix (translation at 12..14); elements stay JavaScript doubles, so
     the world matrix of a node at 6e6 m keeps its digits until three.js hands the modelView matrix (made on the CPU in doubles, camera included) to the GPU */
  const place = (n, r) => { r ||= null; if (!r || !r.tn) return; r.tn.matrixAutoUpdate = false; r.tn.matrix.fromArray(G.matrixOf(n)); r.tn.matrixWorldNeedsUpdate = true; };
  const placeNode = (body, n) => place(n, body.rec.get(n.id));
  for (const t of ['GeoLocation', 'GeoTransform']) {
    T3.build[t] = (body, n, parent, chain) => { const r = body.buildGroup(n, parent, chain); place(n, r); return r; };
    T3.changed[t] = (body, n, field) => {
      const r = body.rec.get(n.id); if (!r || !r.tn) return;
      if (field === 'visible') r.tn.visible = n.f.visible !== false;
      else if (t === 'GeoLocation' ? field === 'geoCoords' : ['translation', 'rotation', 'scale', 'scaleOrientation', 'geoCenter'].includes(field)) place(n, r);
    };
  }
  /* a GeoCoordinate seen as a plain Coordinate (local metres): the geometry code reads f.coord, so the node that holds a GeoCoordinate is handed a stand-in with the converted coordinate in its place */
  T3.geo = {
    sub(g) {
      const c = g && g.f && g.f.coord;
      return c && c.type === 'GeoCoordinate' && !g.__src ? Object.create(g, { f: { value: Object.assign({}, g.f, { coord: G.view(c) }) } }) : g;
    },
    /* GeoViewpoint pose: position and centerOfRotation in local metres, orientation = the frame at `position` (east, up, south) composed with the field orientation inside that frame */
    pose(body, vp) {
      const f = vp.f, par = (body.vpParent && body.vpParent.get(vp)) || null;
      let pos = G.local(vp, f.position), center = G.local(vp, f.centerOfRotation);
      const m = G.locationMatrix(vp, f.position), E = new THREE.Vector3(m[0], m[1], m[2]), U = new THREE.Vector3(m[4], m[5], m[6]), S = new THREE.Vector3(m[8], m[9], m[10]);
      const fq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(E, U, S));
      let q = R.quat.mul([fq.x, fq.y, fq.z, fq.w], R.quat.fromAxisAngle(f.orientation, f.orientation[3]));
      if (par && par !== body.root) {
        par.updateWorldMatrix(true, false); const M = par.matrixWorld, P = new THREE.Vector3(...pos).applyMatrix4(M), C = new THREE.Vector3(...center).applyMatrix4(M);
        const sc = new THREE.Vector3(), rq = new THREE.Quaternion(), tr = new THREE.Vector3(); M.decompose(tr, rq, sc);
        pos = [P.x, P.y, P.z]; center = [C.x, C.y, C.z]; q = R.quat.mul([rq.x, rq.y, rq.z, rq.w], q);
      }
      const fov = f.fieldOfView > 0 && f.fieldOfView < Math.PI ? f.fieldOfView : Math.PI / 4;
      return { pos, q: R.quat.norm(q), center, fov, geo: { near: f.nearDistance > 0 ? f.nearDistance : 0.125, far: f.farDistance > 0 ? f.farDistance : 1e9 } };
    },
  };
  T3.build.GeoViewpoint = (body, n, parent) => {
    const r = { node: n, parent, tn: parent }; body.rec.set(n.id, r);
    (body.viewpoints ||= []).includes(n) || body.viewpoints.push(n); (body.vpParent ||= new Map()).set(n, parent);
    return r;
  };
  T3.changed.GeoViewpoint = (body, n, field) => {
    if (n !== body.bound || !['position', 'orientation', 'centerOfRotation', 'fieldOfView', 'nearDistance', 'farDistance'].includes(field)) return;
    body.pose = body.vpPose(n); body.tr = null; body.applyCamera();
  };
  T3.changed.GeoCoordinate = (body, n) => body.geometryChanged(n);
  /* a GeoOrigin change moves everything that holds it */
  T3.changed.GeoOrigin = (body, n, field) => {
    if (field !== 'geoCoords' && field !== 'geoSystem' && field !== 'rotateYUp') return;
    for (const u of G.users(body.world, n)) {
      u._geoCtx = null; u.version = (u.version || 0) + 1;
      if (u.type === 'GeoCoordinate') body.geometryChanged(u);
      else if (u.type === 'GeoElevationGrid') body.regeo(u);
      else if (u.type === 'GeoLocation' || u.type === 'GeoTransform') placeNode(body, u);
      else if (u.type === 'GeoViewpoint') body.viewpointChanged(u, 'position');
    }
  };

  /* GeoLOD: same rules as the Babylon node (nodes/GeoLOD.js), drawn into three.js groups */
  T3.build.GeoLOD = (body, n, parent, chain) => {
    const tn = new THREE.Group(); tn.name = n.def || 'GeoLOD'; parent.add(tn);
    const r = { node: n, tn, kids: [], chain: [n, ...chain], lv: -1, rootTN: new THREE.Group(), kidTN: [], root: { st: 'idle', nodes: [] }, kid: [0, 1, 2, 3].map(() => ({ st: 'idle', nodes: [] })), kidsDone: false };
    r.rootTN.name = 'root'; tn.add(r.rootTN);
    for (let i = 0; i < 4; i++) { const t = new THREE.Group(); t.name = 'child' + (i + 1); t.visible = false; tn.add(t); r.kidTN.push(t); }
    body.rec.set(n.id, r); n._r = r; n._ok = null;
    for (const c of n.f.rootNode) r.kids.push(body.build(c, r.rootTN, r.chain));
    if (n.f.visible === false) tn.visible = false;
    BR.live('geolod').add(n);
    const alive = () => body.rec.get(n.id) === r;
    if (n.f.rootUrl.length) {
      r.root.st = 'loading';
      BR.loadWorld(n, n.f.rootUrl[0]).then((w) => { if (!alive()) return; r.root.st = 'complete'; r.root.nodes = w.children.slice(); if (!n.f.rootNode.length) for (const c of r.root.nodes) r.kids.push(body.build(c, r.rootTN, r.chain)); BR.geoLodChildren(n); })
        .catch(() => { if (!alive()) return; r.root.st = 'failed'; BR.geoLodChildren(n); });
    } else r.root.st = 'complete';
    return r;
  };
  T3.changed.GeoLOD = (body, n, field) => { const r = n._r; if (r && body.rec.get(n.id) === r && field === 'visible') r.tn.visible = n.f.visible !== false; };
  BR.geoLodShow = (r) => { const on = r.lv === 1 && r.kidsDone; r.rootTN.visible = !on; r.kidTN.forEach((t) => { t.visible = on; }); };
  const spec = BR.specs.get('GeoLOD');
  if (spec) spec.tick = (n, now) => {
    const body = BR.body, r = n._r; if (!body || !r || body.rec.get(n.id) !== r || !body.cam) return;
    const f = n.f, l = G.local(n, f.center); r.tn.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(l[0], l[1], l[2]).applyMatrix4(r.tn.matrixWorld), cp = new THREE.Vector3(); body.cam.updateWorldMatrix(true, false); body.cam.getWorldPosition(cp);
    const lv = p.distanceTo(cp) < Math.fround(f.range) ? 1 : 0;
    if (lv === r.lv) return;
    r.lv = lv; BR.fire(n, 'level_changed', lv);
    if (lv === 0) { r.kidsDone = false; BR.geoLodShow(r); BR.geoLodChildren(n); return; }
    for (let i = 0; i < 4; i++) {
      const k = r.kid[i], u = f['child' + (i + 1) + 'Url'];
      if (k.st !== 'idle') continue;
      if (!u.length) { k.st = 'complete'; continue; }
      k.st = 'loading';
      BR.loadWorld(n, u[0]).then((w) => { if (body.rec.get(n.id) !== r) return; k.nodes = w.children.slice(); for (const c of k.nodes) r.kids.push(body.build(c, r.kidTN[i], r.chain)); k.st = 'complete'; BR.geoLodKids(n); })
        .catch(() => { if (body.rec.get(n.id) !== r) return; k.st = 'failed'; BR.geoLodKids(n); });
    }
    BR.geoLodKids(n);
  };

  /* ViewpointGroup: the page's list. The proximity box of a group is in the frame of the node it sits under (g._ptn, a three.js Object3D here) */
  T3.build.ViewpointGroup = (body, n, parent) => { n._ptn = parent; return null; };
  BR.viewpoints = (world, viewer) => {
    const out = [], seen = new Set(), inside = (g) => {
      if (g.f.size.every((v) => v === 0)) return true;
      let v = viewer; if (v && g._ptn && g._ptn.matrixWorld) { g._ptn.updateWorldMatrix(true, false); const p = new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(g._ptn.matrixWorld.clone().invert()); v = [p.x, p.y, p.z]; }
      return v && [0, 1, 2].every((i) => Math.abs(v[i] - g.f.center[i]) <= g.f.size[i] / 2);
    };
    const walk = (list, path) => {
      for (const c of list || []) {
        if (!c || seen.has(c)) continue; seen.add(c);
        if (c.type === 'Viewpoint' || c.type === 'OrthoViewpoint') { if (c.f.description) out.push({ node: c, path: [...path, c.f.description], text: [...path, c.f.description].join(' » ') }); }
        else if (c.type === 'ViewpointGroup') { if (c.f.displayed !== false && inside(c)) walk(c.f.children, c.f.description ? [...path, c.f.description] : path); }
        else if (c.f && c.f.children) walk(c.f.children, path);
      }
    };
    walk(world.children, []);
    return out;
  };
  /* GeoProximitySensor: the viewer's position, orientation and centre of rotation in the frame of the group it sits in (nodes/GeoProximitySensor.js, with three.js matrices) */
  T3.build.GeoProximitySensor = (body, n, parent) => { n._tn = parent; return null; };
  const ps = BR.specs.get('GeoProximitySensor');
  if (ps) ps.tick = (n, now) => {
    const body = BR.body, f = n.f; if (!body || !n._tn || !body.pose) return;
    const P = body.pose; n._tn.updateWorldMatrix(true, false); const M = n._tn.matrixWorld, inv = M.clone().invert();
    const loc = (a) => { const p = new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(inv); return [p.x, p.y, p.z]; };
    const sz = f.size, off = sz[0] === 0 && sz[1] === 0 && sz[2] === 0, always = sz[0] === -1 && sz[1] === -1 && sz[2] === -1;
    let inside = false, pos = null, ori = null, cor = null;
    if (f.enabled !== false && !off && T3.live(body, n)) {
      pos = loc(P.pos); cor = loc(P.center);
      const sc = new THREE.Vector3(), q = new THREE.Quaternion(), t = new THREE.Vector3(); M.decompose(t, q, sc);
      ori = BR.q.toRot(BR.q.mul(BR.q.inv([q.x, q.y, q.z, q.w]), P.q));
      const c = f.center, h = sz.map((x) => x / 2);
      inside = always || (pos[0] >= c[0] - h[0] && pos[0] <= c[0] + h[0] && pos[1] >= c[1] - h[1] && pos[1] <= c[1] + h[1] && pos[2] >= c[2] - h[2] && pos[2] <= c[2] + h[2]);
    }
    const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
    const out = (all) => {
      if (all || !same(n._pos, pos)) { BR.fire(n, 'geoCoord_changed', Array.from(G.geoOf(n, pos))); BR.fire(n, 'position_changed', pos); }
      if (all || !same(n._ori, ori)) BR.fire(n, 'orientation_changed', ori);
      if (all || !same(n._cor, cor)) BR.fire(n, 'centerOfRotation_changed', cor);
      n._pos = pos; n._ori = ori; n._cor = cor;
    };
    if (inside) {
      if (!f.isActive) { BR.fire(n, 'isActive', true); BR.fire(n, 'enterTime', now); out(true); } else out(false);
    } else if (f.isActive) {
      if (pos) out(false);
      BR.fire(n, 'isActive', false); BR.fire(n, 'exitTime', now); n._pos = n._ori = n._cor = null;
    }
  };
}
