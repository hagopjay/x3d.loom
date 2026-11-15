/* HAnim (HAnimHumanoid, HAnimJoint, HAnimSegment, HAnimSite, HAnimDisplacer; HAnimMotion is the shared event node, it moves the joints through their fields) for the three.js bridge, as X_ITE 16.6.0 draws it.
   The joints, segments and sites are Groups under the humanoid's own (a Group per node; a joint and a site have the Transform fields, a segment none); the skin is skinned on the CPU, exactly by X_ITE's formula:
       skin = v + sum over joints  w * ( J v - v )        J = (the joint's matrix in the humanoid's frame) * (its binding matrix, Compose(jointBindingScales, Rotations, Positions))
   the weight a vertex does not give to joints stays on the rest position; a joint's displacers add rotate(J, displacement) * weight after that, as X_ITE does (no morph target needed); normals follow the same
   blend. A segment's displacers move the vertices of its own shapes that use the segment's coord, in the segment's frame. The skin is every Shape of the humanoid whose geometry coord is the humanoid's skinCoord.
   The shared BR.hanim.probe (bone matrices and the skinned position of every coord index) is replaced by this body's. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, H = (T3.hanim = {});
  const ap = (m, x, y, z) => [x * m[0] + y * m[4] + z * m[8] + m[12], x * m[1] + y * m[5] + z * m[9] + m[13], x * m[2] + y * m[6] + z * m[10] + m[14]];   // m: three's elements, the row-vector reading is the same list
  const r3 = (m, x, y, z) => [x * m[0] + y * m[4] + z * m[8], x * m[1] + y * m[5] + z * m[9], x * m[2] + y * m[6] + z * m[10]];
  H.bindMat = (hum, i) => {
    const t = hum.f.jointBindingPositions[i] || [0, 0, 0], r = hum.f.jointBindingRotations[i] || [0, 0, 1, 0], s = hum.f.jointBindingScales[i] || [1, 1, 1];
    return new THREE.Matrix4().compose(new THREE.Vector3(...t), new THREE.Quaternion(...R.quat.fromAxisAngle(r, r[3])), new THREE.Vector3(...s));
  };
  // the coord index of every vertex of the mesh the body made for a geometry node (the walk geometryData does), or null
  H.cornerCoords = (g) => {
    if (g.type === 'IndexedTriangleSet') return { n: g.f.coord.f.point.length / 3, of: (k) => k };
    if (g.type !== 'IndexedFaceSet') return null;
    const ci = g.f.coordIndex, out = []; let face = 0;
    for (let i = 0; i <= ci.length; i++) { if (i === ci.length || ci[i] < 0) { if (face >= 3) for (let k = i - face; k < i; k++) out.push(ci[k]); face = 0; } else face++; }
    return { n: out.length, of: (k) => out[k] };
  };
  const group = (body, n, parent, chain, kids, transform) => {
    const o = new THREE.Group(); o.name = n.def || n.type; parent.add(o);
    const r = { node: n, tn: o, kids: [], chain: [n, ...chain] }; body.rec.set(n.id, r); o.userData.node = n;
    if (transform) body.applyTransform(n, o);
    for (const c of kids(n)) r.kids.push(body.build(c, o, r.chain));
    if (n.f.visible === false) o.visible = false;
    body._hanimDirty = true; return r;
  };
  const children = (n) => n.f.children;
  T3.build.HAnimJoint = T3.build.HAnimSite = (body, n, parent, chain) => group(body, n, parent, chain, children, true);
  T3.build.HAnimSegment = (body, n, parent, chain) => group(body, n, parent, chain, children, false);
  T3.build.HAnimHumanoid = (body, n, parent, chain) => { const r = group(body, n, parent, chain, (x) => [...x.f.skeleton, ...x.f.skin], true); r.hum = true; (body.hums ||= []).push(r); return r; };
  T3.build.HAnimDisplacer = T3.build.HAnimMotion = () => null;

  const restOf = (geo) => geo.userData.hanimRest || (geo.userData.hanimRest = { p: geo.attributes.position.array.slice(), n: geo.attributes.normal ? geo.attributes.normal.array.slice() : null });
  const undo = (rec) => { const geo = rec.geo, rs = geo.userData.hanimRest; if (!rs) return; geo.attributes.position.array.set(rs.p); geo.attributes.position.needsUpdate = true; if (rs.n && geo.attributes.normal) { geo.attributes.normal.array.set(rs.n); geo.attributes.normal.needsUpdate = true; } };
  const meshRec = (body, mesh, g, hr, segs, coordPts) => {   // one deforming mesh: the corner -> coord map, the rest copy, the displacements of the segment displacers
    const geo = mesh.geometry, cc = H.cornerCoords(g), pa = geo && geo.attributes.position;
    if (!cc || !pa || pa.count !== cc.n) { body.note('HAnim: skin geometry <' + g.type + '> is not skinned (its vertices are not the coord walk)'); return null; }
    const rs = restOf(geo);
    for (let v = 0; v < cc.n; v++) { const c = cc.of(v); if (Math.abs(rs.p[v * 3] - coordPts[c * 3]) > 1e-4 || Math.abs(rs.p[v * 3 + 1] - coordPts[c * 3 + 1]) > 1e-4 || Math.abs(rs.p[v * 3 + 2] - coordPts[c * 3 + 2]) > 1e-4) { body.note('HAnim: skin geometry <' + g.type + '> is not skinned (its vertex order differs from the coord walk)'); return null; } }
    const sd = [];
    for (const seg of segs) for (const d of seg.f.displacers || []) { if (!d || d.type !== 'HAnimDisplacer') continue; const ci = d.f.coordIndex, dp = d.f.displacements; for (let v = 0; v < cc.n; v++) { const c = cc.of(v); for (let k = 0; k < ci.length; k++) if (ci[k] === c && dp[k]) sd.push([v, dp[k], d]); } }
    mesh.frustumCulled = false; return { mesh, geo, cc, rs, hr, sd, key: null };
  };
  H.bindAll = (body) => {
    for (const rec of body._hrecs || []) undo(rec);
    const recs = body._hrecs = [], seen = new Set();
    for (const hr of body.hums || []) {
      if (hr.dead) continue; const hum = hr.node, st = hr.st = { listed: [], infl: null, jd: [], nC: 0, J: [], res: null, key: null };
      hum.f.joints.forEach((j, i) => { if (j && j.type === 'HAnimJoint') st.listed.push({ j, i }); });
      const coord = hum.f.skinCoord, pts = coord && coord.f && coord.f.point; if (!pts) continue;
      const nC = st.nC = pts.length / 3; st.pts = pts; st.infl = Array.from({ length: nC }, () => []);
      st.listed.forEach(({ j }, bi) => { const ix = j.f.skinCoordIndex, w = j.f.skinCoordWeight; for (let k = 0; k < ix.length; k++) { const wt = w[k]; if (wt && ix[k] >= 0 && ix[k] < nC) st.infl[ix[k]].push([bi, wt]); } for (const d of j.f.displacers || []) if (d && d.type === 'HAnimDisplacer') st.jd.push({ d, bi }); });
      for (const r of body.rec.values()) {
        if (!r.node || r.node.type !== 'Shape' || !r.meshes || !r.chain.includes(hum)) continue;
        const g = r.node.f.geometry; if (!g || !g.f || g.f.coord !== coord) continue;
        for (const mesh of r.meshes) { if (seen.has(mesh.geometry)) continue; const segs = r.chain.filter((x) => x.type === 'HAnimSegment' && x.f.coord === coord); const rec = meshRec(body, mesh, g, hr, segs, pts); if (rec) { recs.push(rec); seen.add(mesh.geometry); } }
      }
    }
    for (const x of body.world ? body.world.nodes : []) {   // a segment's displacers on shapes outside a humanoid skin
      if (x.type !== 'HAnimSegment' || !x.f.coord || !(x.f.displacers || []).length || !body.rec.get(x.id)) continue;
      for (const r of body.rec.values()) {
        if (!r.node || r.node.type !== 'Shape' || !r.meshes || !r.chain.includes(x)) continue;
        const g = r.node.f.geometry; if (!g || !g.f || g.f.coord !== x.f.coord) continue;
        for (const mesh of r.meshes) { if (seen.has(mesh.geometry)) continue; const rec = meshRec(body, mesh, g, null, [x], x.f.coord.f.point); if (rec) { recs.push(rec); seen.add(mesh.geometry); } }
      }
    }
  };
  H.skinCoords = (body, hr) => {   // J matrices and the skinned position of every coord index
    const st = hr.st; if (!st || !st.infl) return false;
    const inv = hr.tn.matrixWorld.clone().invert();
    st.J = st.listed.map(({ j, i }) => { const jr = body.rec.get(j.id); return (jr && jr.tn ? inv.clone().multiply(jr.tn.matrixWorld) : new THREE.Matrix4()).multiply(H.bindMat(hr.node, i)); });
    const key = st.J.map((m) => m.elements.join(',')).join('|') + '#' + st.jd.map((x) => x.d.f.weight + ':' + x.d.f.coordIndex.length).join(',');
    if (key === st.key && st.res) return false; st.key = key;
    const pts = st.pts, res = st.res = new Float32Array(st.nC * 3), E = st.J.map((m) => m.elements);
    for (let c = 0; c < st.nC; c++) {
      const x = pts[c * 3], y = pts[c * 3 + 1], z = pts[c * 3 + 2]; let ox = x, oy = y, oz = z;
      for (const [bi, w] of st.infl[c]) { const t = ap(E[bi], x, y, z); ox += (t[0] - x) * w; oy += (t[1] - y) * w; oz += (t[2] - z) * w; }
      res[c * 3] = ox; res[c * 3 + 1] = oy; res[c * 3 + 2] = oz;
    }
    for (const { d, bi } of st.jd) { const w = d.f.weight, ci = d.f.coordIndex, dp = d.f.displacements; if (!w) continue; for (let k = 0; k < ci.length; k++) { const c = ci[k]; if (c < 0 || c >= st.nC || !dp[k]) continue; const t = r3(E[bi], dp[k][0], dp[k][1], dp[k][2]); res[c * 3] += t[0] * w; res[c * 3 + 1] += t[1] * w; res[c * 3 + 2] += t[2] * w; } }
    return true;
  };
  H.update = (body) => {
    body.hums = (body.hums || []).filter((r) => !r.dead && r.tn.parent);
    if (body._hanimDirty) { body._hanimDirty = false; H.bindAll(body); for (const hr of body.hums) if (hr.st) hr.st.key = null; for (const rec of body._hrecs) rec.key = null; }
    const moved = new Map(); for (const hr of body.hums) if (hr.st) moved.set(hr, H.skinCoords(body, hr));
    for (const rec of body._hrecs || []) {
      const hr = rec.hr, st = hr && hr.st, sk = rec.sd.map((s) => s[2].f.weight).join(',');
      if (rec.key === sk && !(hr && moved.get(hr))) continue; rec.key = sk;
      const P = rec.geo.attributes.position.array, N = rec.geo.attributes.normal ? rec.geo.attributes.normal.array : null, rs = rec.rs, cc = rec.cc;
      for (let v = 0; v < cc.n; v++) {
        const c = cc.of(v);
        if (st && st.res) { P[v * 3] = st.res[c * 3]; P[v * 3 + 1] = st.res[c * 3 + 1]; P[v * 3 + 2] = st.res[c * 3 + 2]; } else { P[v * 3] = rs.p[v * 3]; P[v * 3 + 1] = rs.p[v * 3 + 1]; P[v * 3 + 2] = rs.p[v * 3 + 2]; }
        if (N && rs.n) {
          let nx = rs.n[v * 3], ny = rs.n[v * 3 + 1], nz = rs.n[v * 3 + 2];
          if (st && st.infl) { const x0 = nx, y0 = ny, z0 = nz; for (const [bi, w] of st.infl[c]) { const t = r3(st.J[bi].elements, x0, y0, z0); nx += (t[0] - x0) * w; ny += (t[1] - y0) * w; nz += (t[2] - z0) * w; } const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
          N[v * 3] = nx; N[v * 3 + 1] = ny; N[v * 3 + 2] = nz;
        }
      }
      for (const [v, dpv, d] of rec.sd) { const w = d.f.weight; if (!w) continue; P[v * 3] += dpv[0] * w; P[v * 3 + 1] += dpv[1] * w; P[v * 3 + 2] += dpv[2] * w; }
      rec.geo.attributes.position.needsUpdate = true; if (N) rec.geo.attributes.normal.needsUpdate = true;
    }
  };
  // the numbers for the tests: the bone matrices (flat, the row-vector layout X_ITE and the Babylon bridge use) and the skinned position of every coord index
  H.probe = (body, def) => {
    const hum = body.world.nodes.find((n) => n.def === def && n.type === 'HAnimHumanoid'), hr = hum && body.rec.get(hum.id); if (!hr || !hr.st || !hr.st.res) return null;
    const st = hr.st, coords = []; for (let c = 0; c < st.nC; c++) coords.push([st.res[c * 3], st.res[c * 3 + 1], st.res[c * 3 + 2]]);
    return { bones: st.J.map((m) => Array.from(m.elements)), coords };
  };
  BR.hanim.probe = H.probe;

  const dirty = (body) => { body._hanimDirty = true; };
  const TF = ['translation', 'rotation', 'scale', 'center', 'scaleOrientation'];
  const chg = (transform) => (body, n, field) => {
    const r = body.rec.get(n.id); if (!r || !r.tn) return;
    if (field === 'children') { body.rebuildGroup(n); dirty(body); }
    else if (field === 'visible') r.tn.visible = n.f.visible !== false;
    else if (transform && TF.includes(field)) body.applyTransform(n, r.tn);
    else if (['skinCoordIndex', 'skinCoordWeight', 'displacers', 'coord'].includes(field)) dirty(body);
  };
  T3.changed.HAnimJoint = T3.changed.HAnimSite = chg(true);
  T3.changed.HAnimSegment = chg(false);
  T3.changed.HAnimHumanoid = (body, n, field) => {
    const r = body.rec.get(n.id); if (!r || !r.tn) return;
    if (TF.includes(field)) body.applyTransform(n, r.tn);
    else if (field === 'visible') r.tn.visible = n.f.visible !== false;
    else if (field === 'skeleton' || field === 'skin') { for (const k of r.kids) body.disposeRec(k); r.kids = [...n.f.skeleton, ...n.f.skin].map((c) => body.build(c, r.tn, r.chain)); dirty(body); }
    else if (['skinCoord', 'joints', 'jointBindingPositions', 'jointBindingRotations', 'jointBindingScales', 'skinNormal'].includes(field)) dirty(body);
  };
  T3.changed.HAnimDisplacer = (body, n, field) => { if (field === 'coordIndex' || field === 'displacements') dirty(body); };   // the weight is read live
}
