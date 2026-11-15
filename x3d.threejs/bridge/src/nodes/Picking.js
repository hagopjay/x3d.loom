/* Picking (level 1) for the three.js bridge: PickableGroup, PointPickSensor, LinePickSensor, PrimitivePickSensor, VolumePickSensor. The rules, the shape descriptions and the tests (oriented boxes, GJK,
   segment against triangle) are the shared ones in x3d.webgpu/bridge/src/kit.js (BR.pick.describe, obbHit, gjk, segTri); what is Babylon there is the part that reaches a mesh, its matrix and its vertex
   buffers, and that is written here against three.js. The ticks of the five specs are replaced (BR.specs.get(X).tick) so the shared file stays as it is. X_ITE 16.6.0 rules: a sensor looks at the Shapes
   named in its pickTarget (or under a node named there) that lie under a PickableGroup (pickable true, objectType not NONE, and matching the sensor's objectType and matchCriterion); the picking geometry
   lives in the frame of the sensor's parent; BOUNDS intersects the boxes, GEOMETRY the geometry itself; CLOSEST and ANY report one geometry, ALL and ALL_SORTED all of them. A Layer is a PickableGroup of its
   own (its pickable and objectType) and a sensor in a Layer sees the Shapes of that Layer only; the world is not a Layer. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, K = BR.pick;
  const attached = (o, root) => { for (let x = o; x; x = x.parent) { if (x.visible === false) return false; if (x === root) return true; } return false; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const xf = (p, M) => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(M); return [v.x, v.y, v.z]; };   // the point through the matrix
  const xd = (p, M) => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix3(new THREE.Matrix3().setFromMatrix4(M)); return [v.x, v.y, v.z]; };   // the vector, no translation, not normalised
  const flat = (a) => { const o = []; for (let i = 0; i + 2 < a.length; i += 3) o.push([a[i], a[i + 1], a[i + 2]]); return o; };
  const boundsOf = (verts) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const p of verts) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; } return { mn, mx }; };
  const obb = (b, M) => { const c = [(b.mn[0] + b.mx[0]) / 2, (b.mn[1] + b.mx[1]) / 2, (b.mn[2] + b.mx[2]) / 2], h = [(b.mx[0] - b.mn[0]) / 2, (b.mx[1] - b.mn[1]) / 2, (b.mx[2] - b.mn[2]) / 2]; return { c: xf(c, M), u: [xd([h[0], 0, 0], M), xd([0, h[1], 0], M), xd([0, 0, h[2]], M)] }; };
  const types = (a) => (Array.isArray(a) ? a : []).filter((x) => typeof x === 'string');
  const matches = (sensor, groupTypes) => {
    const st = types(sensor.f.objectType); if (!st.length || st.includes('ALL')) return true;
    let hit = 0; for (const t of st) if (groupTypes.includes(t)) hit++;
    switch (sensor.f.matchCriterion) { case 'MATCH_EVERY': return hit === st.length; case 'MATCH_ONLY_ONE': return hit === 1; default: return hit > 0; }
  };
  const layerOf = (sensor) => { for (let p = sensor._tn; p; p = p.parent) if (p.userData && p.userData.layerNode) return p.userData.layerNode; return null; };
  const targetsOf = (body, sensor) => {
    const out = [], want = new Set((sensor.f.pickTarget || []).filter(Boolean)); if (!want.size || !body.world) return out;
    const walk = (n, st) => {
      if (!n || n.f.visible === false) return;
      if (n.type === 'PickableGroup') {
        if (n.f.pickable === false) return; const gt = types(n.f.objectType); if (gt.includes('NONE')) return;
        if (!(gt.includes('ALL') || !gt.length) && !matches(sensor, gt)) return; st = { pickable: true, hier: st.hier };
      }
      const hier = st.hier.concat([n]);
      if (n.type === 'Shape') {
        if (!st.pickable || !n.f.geometry || !hier.some((x) => want.has(x))) return;
        const r = body.rec.get(n.id), m = r && r.meshes && r.meshes[0]; if (!m || !attached(m, body.root)) return;
        out.push({ shape: n, geometry: n.f.geometry, mesh: m }); return;
      }
      if (n.type === 'Switch') { const k = n.f.children[n.f.whichChoice]; if (k) walk(k, { pickable: st.pickable, hier }); return; }
      for (const k of n.f.children || []) walk(k, { pickable: st.pickable, hier });
    };
    const lay = layerOf(sensor);
    if (lay) { const gt = types(lay.f.objectType); if (lay.f.pickable !== false && !gt.includes('NONE') && ((gt.includes('ALL') || !gt.length) || matches(sensor, gt))) for (const n of lay.f.children || []) walk(n, { pickable: true, hier: [] }); return out; }
    for (const n of body.world.children) walk(n, { pickable: false, hier: [] });
    return out;
  };
  const meshBounds = (m) => { const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; return { mn: [b.min.x, b.min.y, b.min.z], mx: [b.max.x, b.max.y, b.max.z] }; };
  const meshVerts = (m) => { const a = m.geometry.attributes.position; return a ? flat(a.array) : []; };
  const indicesOf = (g) => { if (g.index) return g.index.array; const n = g.attributes.position.count, o = new Uint32Array(n); for (let i = 0; i < n; i++) o[i] = i; return o; };
  const evaluate = (n, kind) => {
    const body = BR.body, f = n.f, none = { geometries: [], points: [], normals: [], texCoords: [] }; if (!body || !n._tn || !body.world) return null;
    const ot = types(f.objectType); if (!f.enabled || ot.includes('NONE')) return none;
    const pg = f.pickingGeometry; if (!pg) return none;
    if (kind === 'line' && !(pg.type === 'IndexedLineSet' || pg.type === 'LineSet')) return null;
    if (kind === 'point' && pg.type !== 'PointSet') return null;
    if (kind === 'primitive' && !['Box', 'Cone', 'Cylinder', 'Sphere'].includes(pg.type)) return null;
    const desc = n._desc && n._descFor === pg ? n._desc : (n._desc = K.describe(pg, body), n._descFor = pg, n._desc); if (!desc || !desc.verts || !desc.verts.length) return none;
    body.scene.updateMatrixWorld(true); n._tn.updateWorldMatrix(true, false);
    const M = n._tn.matrixWorld.clone(), pb = obb(boundsOf(desc.verts), M), geo = f.intersectionType === 'GEOMETRY', hits = [];
    for (const t of targetsOf(body, n)) {
      t.mesh.updateWorldMatrix(true, false); const W = t.mesh.matrixWorld.clone(), tb = obb(meshBounds(t.mesh), W); if (!K.obbHit(pb, tb)) continue;
      const rec = { t, dist: Math.hypot(...sub(pb.c, tb.c)), points: [], normals: [], texCoords: [] };
      if (geo) {
        if (kind === 'line') {
          const inv = W.clone().invert(), g = t.mesh.geometry, pos = g.attributes.position.array, idx = indicesOf(g), nrm = g.attributes.normal && g.attributes.normal.array, uv = g.attributes.uv && g.attributes.uv.array;
          const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
          for (const [s0, s1] of desc.segs) {
            const p = xf(xf(s0, M), inv), q = xf(xf(s1, M), inv);
            for (let k = 0; k + 2 < idx.length; k += 3) {
              const i = idx[k], j = idx[k + 1], l = idx[k + 2], h = K.segTri(p, q, P(i), P(j), P(l)); if (!h) continue;
              rec.points.push([0, 1, 2].map((x) => h.w * P(i)[x] + h.u * P(j)[x] + h.v * P(l)[x]));
              const N = (q2) => [nrm[q2 * 3], nrm[q2 * 3 + 1], nrm[q2 * 3 + 2]];
              rec.normals.push(nrm ? [0, 1, 2].map((x) => h.w * N(i)[x] + h.u * N(j)[x] + h.v * N(l)[x]) : BR.geo.norm(cross(sub(P(j), P(i)), sub(P(l), P(i)))));
              rec.texCoords.push(uv ? [h.w * uv[i * 2] + h.u * uv[j * 2] + h.v * uv[l * 2], h.w * uv[i * 2 + 1] + h.u * uv[j * 2 + 1] + h.v * uv[l * 2 + 1], 0] : [0, 0, 0]);
            }
          }
          if (!rec.points.length) continue;
        } else {
          const tv = meshVerts(t.mesh).map((p) => xf(p, W));
          if (kind === 'point') { for (const p of desc.points) if (K.gjk([xf(p, M)], tv)) rec.points.push(p); if (!rec.points.length) continue; }
          else if (!K.gjk(desc.verts.map((p) => xf(p, M)), tv)) continue;
        }
      }
      hits.push(rec);
    }
    const order = f.sortOrder || 'CLOSEST'; if (order === 'CLOSEST' || order === 'ALL_SORTED') hits.sort((a, b) => a.dist - b.dist);
    const chosen = order === 'CLOSEST' || order === 'ANY' ? hits.slice(0, 1) : hits;
    return { geometries: chosen.map((h) => h.t.geometry), points: chosen.flatMap((h) => h.points), normals: chosen.flatMap((h) => h.normals), texCoords: chosen.flatMap((h) => h.texCoords) };
  };
  const same = (a, b) => a.length === b.length && a.every((x, i) => (Array.isArray(x) ? x.length === b[i].length && x.every((y, k) => Math.abs(y - b[i][k]) < 1e-7) : x === b[i]));
  const tick = (n, kind) => {
    const r = evaluate(n, kind); if (!r) return; const f = n.f, act = r.geometries.length > 0;
    if (act !== !!f.isActive) BR.fire(n, 'isActive', act);
    if (!same(r.geometries, f.pickedGeometry || [])) BR.fire(n, 'pickedGeometry', r.geometries);
    if (f.pickedPoint !== undefined && n.f.intersectionType === 'GEOMETRY' || kind === 'line' || kind === 'point') {
      if ('pickedPoint' in f && !same(r.points, f.pickedPoint || [])) BR.fire(n, 'pickedPoint', r.points);
      if ('pickedNormal' in f && !same(r.normals, f.pickedNormal || [])) BR.fire(n, 'pickedNormal', r.normals);
      if ('pickedTextureCoordinate' in f && !same(r.texCoords, f.pickedTextureCoordinate || [])) BR.fire(n, 'pickedTextureCoordinate', r.texCoords);
    }
  };
  T3.pick = { evaluate, tick };
  for (const [type, kind] of [['PointPickSensor', 'point'], ['LinePickSensor', 'line'], ['PrimitivePickSensor', 'primitive'], ['VolumePickSensor', 'volume']]) {
    T3.build[type] = (body, n, parent) => { n._tn = parent; return null; };
    const spec = BR.specs.get(type); if (spec) spec.tick = (n) => tick(n, kind);
  }
  T3.build.PickableGroup = (body, n, parent, chain) => { const r = body.buildGroup(n, parent, chain); if (n.f.visible === false) r.tn.visible = false; return r; };
  T3.changed.PickableGroup = (body, n, field) => { const r = body.rec.get(n.id); if (r && field === 'visible') r.tn.visible = n.f.visible !== false; };
}
