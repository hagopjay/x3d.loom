/* HAnimHumanoid (HAnim level 1): the humanoid root. With HAnimJoint, HAnimSegment and HAnimSite (their specs are in the files beside this one) and HAnimDisplacer / HAnimMotion it is the skinned
   character of ISO 19774. The reader knew these four before the bridge (demiurge: a Transform whose skeleton and skin are drawn in their rest pose); this file adds the missing fields and the skin.
   Babylon side: the joints are TransformNodes under the humanoid's own (segments and sites ride them); the skin is real Babylon skinning: one Skeleton whose Bone i is `joints[i]` (its matrix is the
   joint's transform chain in the humanoid's frame, set every frame; the inverse bind matrix is jointBindingPositions/Rotations/Scales as X_ITE 16.6.0 applies them), skinCoordIndex/skinCoordWeight
   turned into per vertex MatricesIndices/Weights (up to 8 influences), a bone with the identity matrix that takes the weight a vertex does not give to joints (X_ITE: skin = v + sum w (J v - v)), and
   the displacers as MorphTargets (weight = influence). The skin is every Shape of the humanoid whose geometry coord is the humanoid's skinCoord (X_ITE's rule). See bridge/knowledge/HANIM-FINDINGS.md. */
{
const H = (BR.hanim ||= {});
const V3 = () => BABYLON.Vector3, MX = () => BABYLON.Matrix;

// X3D Transform fields to a Babylon (row vector) matrix: T * C * R * SR * S * -SR * -C
H.xform = (f) => {
  const M = BABYLON.Matrix, tr = (v) => M.Translation(v[0], v[1], v[2]), rq = (q) => { const m = new M(); new BABYLON.Quaternion(...R.quat.fromAxisAngle(q, q[3])).toRotationMatrix(m); return m; };
  const c = f.center || [0, 0, 0], sr = f.scaleOrientation || [0, 0, 1, 0], S = f.scale || [1, 1, 1], rot = f.rotation || [0, 0, 1, 0], T = f.translation || [0, 0, 0];
  let out = M.Identity();
  for (const p of [tr([-c[0], -c[1], -c[2]]), rq([sr[0], sr[1], sr[2], -sr[3]]), M.Scaling(S[0], S[1], S[2]), rq(sr), rq(rot), tr(c), tr(T)]) out = out.multiply(p);
  return out;
};
// the binding matrix of the joint at index i of `joints` (jointBindingPositions / Rotations / Scales), applied first, as X_ITE does: matrix = Compose(scale, rotation, translation)
H.bind = (hum, i) => {
  const t = hum.f.jointBindingPositions[i], r = hum.f.jointBindingRotations[i], s = hum.f.jointBindingScales[i];
  return BABYLON.Matrix.Compose(new (V3())(...(s || [1, 1, 1])), new BABYLON.Quaternion(...R.quat.fromAxisAngle(r || [0, 0, 1, 0], (r || [0, 0, 1, 0])[3])), new (V3())(...(t || [0, 0, 0])));
};
H.jointParents = (hum) => {      // joint -> parent joint over the skeleton tree
  const parent = new Map();
  const walk = (n, p) => {
    if (!n || parent.has(n)) return;
    if (n.type === 'HAnimJoint') { parent.set(n, p); for (const c of n.f.children) walk(c, n); }
    else if (n.type === 'HAnimSegment' || n.type === 'HAnimSite') for (const c of n.f.children) walk(c, p);
  };
  for (const s of hum.f.skeleton) walk(s, null);
  return parent;
};
H.abs = (j, parents, cache) => {      // the joint's matrix in the humanoid's frame
  if (cache.has(j)) return cache.get(j);
  const p = parents.get(j), m = H.xform(j.f).multiply(p ? H.abs(p, parents, cache) : BABYLON.Matrix.Identity());
  cache.set(j, m); return m;
};
// the coord index of every vertex of the mesh the body made for a geometry node (the same walk geometryData does), or null when the geometry is not one this can follow
H.cornerCoords = (g) => {
  if (g.type === 'IndexedTriangleSet') return { n: g.f.coord.f.point.length / 3, of: (k) => k };
  if (g.type !== 'IndexedFaceSet') return null;
  const ci = g.f.coordIndex, out = []; let face = 0;
  for (let i = 0; i <= ci.length; i++) { if (i === ci.length || ci[i] < 0) { if (face >= 3) for (let k = i - face; k < i; k++) out.push(ci[k]); face = 0; } else face++; }
  return { n: out.length, of: (k) => out[k], list: out };
};

H.skinMeshes = (body, hum, coordNode) => {      // [{ shape record, mesh, geometry node }] for the shapes under hum whose geometry coord is coordNode
  const out = [];
  for (const r of body.rec.values()) {
    if (!r.node || r.node.type !== 'Shape' || !r.meshes || !r.chain.includes(hum)) continue;
    const g = r.node.f.geometry; if (!g || !g.f || g.f.coord !== coordNode) continue;
    for (const mesh of r.meshes) out.push({ r, mesh, g });
  }
  return out;
};

H.unbind = (body, hum) => {
  const st = hum._hs; if (!st) return;
  for (const m of st.meshes || []) { if (m.isDisposed && m.isDisposed()) continue; m.skeleton = null; m.morphTargetManager = null; }
  if (st.skeleton) { try { st.skeleton.dispose(); } catch (e) { /* gone */ } }
  for (const mgr of st.managers || []) { try { mgr.dispose(); } catch (e) { /* gone */ } }
  hum._hs = null;
};

/* build the skeleton, weights and morph targets for a humanoid whose body record exists; safe to call again after any change of the fields it reads */
H.bindSkin = (body, hum) => {
  H.unbind(body, hum);
  const coord = hum.f.skinCoord; if (!coord || !coord.f || !coord.f.point) return;
  const pts = coord.f.point, nC = pts.length / 3, scene = body.scene;
  const parents = H.jointParents(hum);
  const listed = []; hum.f.joints.forEach((j, i) => { if (j && j.type === 'HAnimJoint') listed.push({ j, i }); });
  const sk = new BABYLON.Skeleton('hanim-' + (hum.f.name || hum.def || hum.id), 'hanim' + hum.id, scene);
  const st = (hum._hs = { skeleton: sk, listed, parents, bones: [], meshes: [], managers: [], disp: new Map(), rest: null });
  for (const { j, i } of listed) {
    const bind = H.bind(hum, i), absBind = BABYLON.Matrix.Invert(bind);
    st.bones.push(new BABYLON.Bone(String(j.f.name || j.def || 'joint' + i), sk, null, H.abs(j, parents, new Map()), null, absBind));
  }
  st.rest = new BABYLON.Bone('hanim-rest', sk, null, BABYLON.Matrix.Identity(), null, BABYLON.Matrix.Identity());
  const restIdx = st.bones.length;
  // influences per coord index: joint-centric skinCoordIndex / skinCoordWeight to vertex-centric (bone, weight)
  const infl = Array.from({ length: nC }, () => []);
  listed.forEach(({ j }, bi) => { const ix = j.f.skinCoordIndex, w = j.f.skinCoordWeight; for (let k = 0; k < ix.length; k++) { const wt = w[k]; if (!wt) continue; if (ix[k] >= 0 && ix[k] < nC) infl[ix[k]].push([bi, wt]); } });
  let trimmed = 0;
  for (const meshInfo of H.skinMeshes(body, hum, coord)) {
    const { mesh, g } = meshInfo, cc = H.cornerCoords(g); if (!cc) { body.note('HAnimHumanoid: skin geometry <' + g.type + '> is not skinned'); continue; }
    const nv = cc.n, idx = new Float32Array(nv * 4), wts = new Float32Array(nv * 4), idx2 = new Float32Array(nv * 4), wts2 = new Float32Array(nv * 4);
    let need8 = false;
    for (let v = 0; v < nv; v++) {
      const c = cc.of(v), list = (infl[c] || []).slice(), sum = list.reduce((a, b) => a + b[1], 0);
      if (Math.abs(1 - sum) > 1e-6) list.push([restIdx, 1 - sum]);      // X_ITE: skin = v + sum w (J v - v): the weight not given to joints stays on the rest position
      if (list.length > 8) { list.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); list.length = 8; trimmed++; }
      if (!list.length) list.push([restIdx, 1]);
      for (let k = 0; k < list.length; k++) { const o = v * 4 + (k % 4); if (k < 4) { idx[o] = list[k][0]; wts[o] = list[k][1]; } else { idx2[o] = list[k][0]; wts2[o] = list[k][1]; need8 = true; } }
    }
    const geo = mesh.geometry; if (!geo) continue;
    geo.setVerticesData(BABYLON.VertexBuffer.MatricesIndicesKind, idx, false, 4);
    geo.setVerticesData(BABYLON.VertexBuffer.MatricesWeightsKind, wts, false, 4);
    if (need8) { geo.setVerticesData(BABYLON.VertexBuffer.MatricesIndicesExtraKind, idx2, false, 4); geo.setVerticesData(BABYLON.VertexBuffer.MatricesWeightsExtraKind, wts2, false, 4); }
    mesh.numBoneInfluencers = need8 ? 8 : 4; mesh.skeleton = sk; mesh.alwaysSelectAsActiveMesh = true;      // the rest pose bounds would cull a bent skin
    st.meshes.push(mesh); (st.info ||= []).push(meshInfo);
  }
  if (trimmed) body.note('HAnimHumanoid: ' + trimmed + ' skin vertices have more than 8 joint influences; the 8 largest are kept (X_ITE 16.6.0 has no limit)');
  H.bindMorphs(body, hum, coord, st.info || []);
  H.update(hum);
};

/* displacers as morph targets: one target per displacer and mesh, dense (rest positions + the displacements of the displacer's coordIndex entries), influence = weight */
H.morphFor = (body, st, mesh, g, displacers) => {
  const cc = H.cornerCoords(g); if (!cc || !displacers.length) return;
  const geo = mesh.geometry, base = geo && geo.getVerticesData(BABYLON.VertexBuffer.PositionKind); if (!base) return;
  const mgr = new BABYLON.MorphTargetManager(body.scene); st.managers.push(mgr);
  for (const d of displacers) {
    const pos = Float32Array.from(base), ci = d.f.coordIndex, dp = d.f.displacements; let any = false;
    for (let v = 0; v < cc.n; v++) { const c = cc.of(v); for (let k = 0; k < ci.length; k++) if (ci[k] === c && dp[k]) { pos[v * 3] += dp[k][0]; pos[v * 3 + 1] += dp[k][1]; pos[v * 3 + 2] += dp[k][2]; any = true; } }
    if (!any) continue;
    const t = new BABYLON.MorphTarget('hanim-disp-' + (d.f.name || d.def || d.id), d.f.weight, body.scene); t.setPositions(pos); mgr.addTarget(t);
    (st.disp.get(d) || st.disp.set(d, []).get(d)).push(t);
  }
  if (mgr.numTargets) mesh.morphTargetManager = mgr; else { mgr.dispose(); st.managers.pop(); }
};
H.bindMorphs = (body, hum, coord, info) => {
  const st = hum._hs, byJoint = [];
  for (const { j } of st.listed) for (const d of j.f.displacers || []) if (d && d.type === 'HAnimDisplacer') byJoint.push(d);
  for (const { mesh, g } of info) H.morphFor(body, st, mesh, g, byJoint);
};
// a segment's displacers move the vertices of the coord it names, in the segment's own frame, on the shapes inside the segment
H.bindSegment = (body, seg) => {
  H.unbindSegment(seg);
  const coord = seg.f.coord, ds = (seg.f.displacers || []).filter((d) => d && d.type === 'HAnimDisplacer'); if (!coord || !ds.length) return;
  const st = (seg._hs = { managers: [], disp: new Map(), meshes: [] });
  for (const r of body.rec.values()) {
    if (!r.node || r.node.type !== 'Shape' || !r.meshes || !r.chain.includes(seg)) continue;
    const g = r.node.f.geometry; if (!g || !g.f || g.f.coord !== coord) continue;
    for (const mesh of r.meshes) { H.morphFor(body, st, mesh, g, ds); st.meshes.push(mesh); }
  }
};
H.unbindSegment = (seg) => {
  const st = seg._hs; if (!st) return;
  for (const m of st.meshes) if (!(m.isDisposed && m.isDisposed())) m.morphTargetManager = null;
  for (const mgr of st.managers) { try { mgr.dispose(); } catch (e) { /* gone */ } }
  seg._hs = null;
};

// the joint matrices of every bone, every frame (cheap: one product chain per joint)
H.update = (hum) => {
  const st = hum._hs; if (!st) return;
  const cache = new Map();
  st.listed.forEach(({ j }, i) => st.bones[i].updateMatrix(H.abs(j, st.parents, cache), false, true));
};
// numbers for the tests: the bone matrices (flat, Babylon row vector layout) and the skinned position of every coord index
H.probe = (body, def) => {
  const hum = body.world.nodes.find((n) => n.def === def && n.type === 'HAnimHumanoid'); if (!hum || !hum._hs) return null;
  const st = hum._hs; st.skeleton.prepare(true);
  const mats = Array.from(st.skeleton.getTransformMatrices(st.meshes[0]) || []);
  const bones = st.listed.map((_, i) => mats.slice(i * 16, i * 16 + 16));
  // the skinned position of every coord index by the vertex shader's own formula on the mesh's buffers (Babylon's CPU skinning, mesh.getPositionData, skips weights <= 0, and a vertex whose joints weigh more than 1 gets a negative weight on the rest bone)
  const pos = {};
  for (const { mesh, g } of st.info || []) {
    const cc = H.cornerCoords(g), geo = mesh.geometry; if (!cc || !geo) continue;
    const K = BABYLON.VertexBuffer, P = geo.getVerticesData(K.PositionKind), I = geo.getVerticesData(K.MatricesIndicesKind), W = geo.getVerticesData(K.MatricesWeightsKind);
    const I2 = geo.getVerticesData(K.MatricesIndicesExtraKind), W2 = geo.getVerticesData(K.MatricesWeightsExtraKind), mgr = mesh.morphTargetManager;
    for (let v = 0; v < cc.n; v++) {
      const c = cc.of(v); if (pos[c]) continue;
      let p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
      if (mgr) for (let t = 0; t < mgr.numTargets; t++) { const tg = mgr.getTarget(t), tp = tg.getPositions(); for (let a = 0; a < 3; a++) p[a] += (tp[v * 3 + a] - P[v * 3 + a]) * tg.influence; }
      const m = new Array(16).fill(0), add = (bi, w) => { for (let k = 0; k < 16; k++) m[k] += mats[bi * 16 + k] * w; };
      for (let k = 0; k < 4; k++) { add(I[v * 4 + k], W[v * 4 + k]); if (I2) add(I2[v * 4 + k], W2[v * 4 + k]); }
      pos[c] = [p[0] * m[0] + p[1] * m[4] + p[2] * m[8] + m[12], p[0] * m[1] + p[1] * m[5] + p[2] * m[9] + m[13], p[0] * m[2] + p[1] * m[6] + p[2] * m[10] + m[14]];
    }
  }
  return { bones, rest: mats.slice(st.listed.length * 16, st.listed.length * 16 + 16), coords: Object.keys(pos).map(Number).sort((a, b) => a - b).map((c) => pos[c]) };
};

H.buildGroup = (body, n, parent, chain, transform) => {      // joint, segment, site: a TransformNode, children built
  const tn = new BABYLON.TransformNode(n.def || n.type, body.scene); tn.parent = parent;
  const r = { node: n, tn, kids: [], chain: [n, ...chain] };
  body.rec.set(n.id, r);
  if (transform) body.applyTransform(n, tn);
  for (const c of n.f.children) r.kids.push(body.build(c, tn, r.chain));
  if (n.f.visible === false) tn.setEnabled(false);
  return r;
};
H.groupChanged = (body, n, field, transform) => {
  const r = body.rec.get(n.id); if (!r || !r.tn) return;
  if (field === 'children') { body.rebuildGroup(n); if (n.type === 'HAnimSegment') H.bindSegment(body, n); H.rebindAll(body); }
  else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
  else if (transform && ['translation', 'rotation', 'scale', 'center', 'scaleOrientation'].includes(field)) body.applyTransform(n, r.tn);
};
H.rebindAll = (body) => { for (const r of body.rec.values()) if (r.node && r.node.type === 'HAnimHumanoid' && r.hum) H.bindSkin(body, r.node); };

const EXT = {
  description: ['SFString', IO, ''], addChildren: ['MFNode', IN, []], removeChildren: ['MFNode', IN, []],
  bboxCenter: ['SFVec3f', INIT, [0, 0, 0]], bboxSize: ['SFVec3f', INIT, [-1, -1, -1]], bboxDisplay: ['SFBool', IO, false],
};
H.EXT = EXT;

BR.node('HAnimHumanoid', {
  component: 'HAnim', level: 1,
  extend: { HAnimHumanoid: {
    description: EXT.description, loa: ['SFInt32', IO, -1],
    bboxCenter: EXT.bboxCenter, bboxSize: EXT.bboxSize, bboxDisplay: EXT.bboxDisplay,
    jointBindingPositions: ['MFVec3f', IO, []], jointBindingRotations: ['MFRotation', IO, []], jointBindingScales: ['MFVec3f', IO, []],
    motions: ['MFNode', IO, []], motionsEnabled: ['MFBool', IO, []], skinBindingCoords: ['SFNode', IO, null], skinBindingNormals: ['SFNode', IO, null],
    displacers: ['MFNode', IO, []],
  } },
  build(body, n, parent, chain) {
    const tn = new BABYLON.TransformNode(n.def || 'HAnimHumanoid', body.scene); tn.parent = parent;
    const r = { node: n, tn, kids: [], chain: [n, ...chain], hum: true };
    body.rec.set(n.id, r);
    body.applyTransform(n, tn);
    for (const c of [...n.f.skeleton, ...n.f.skin]) r.kids.push(body.build(c, tn, r.chain));
    if (n.f.visible === false) tn.setEnabled(false);
    for (const x of body.world.nodes) if (x.type === 'HAnimSegment' && x.f.displacers.length && body.rec.get(x.id)) H.bindSegment(body, x);
    H.bindSkin(body, n);
    if (!body._hanimObs) {
      body._hanimObs = body.scene.onBeforeRenderObservable.add(() => { for (const rec of body.rec.values()) if (rec.hum && rec.node._hs) H.update(rec.node); });
    }
    tn.onDisposeObservable.add(() => H.unbind(body, n));
    return r;
  },
  changed(body, n, field) {
    const r = body.rec.get(n.id); if (!r || !r.tn) return;
    if (['translation', 'rotation', 'scale', 'center', 'scaleOrientation'].includes(field)) body.applyTransform(n, r.tn);
    else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
    else if (['skinCoord', 'joints', 'jointBindingPositions', 'jointBindingRotations', 'jointBindingScales', 'skinNormal', 'skin'].includes(field)) {
      if (field === 'skin') { for (const k of r.kids.slice(n.f.skeleton.length)) body.disposeRec(k); r.kids = r.kids.slice(0, n.f.skeleton.length); for (const c of n.f.skin) r.kids.push(body.build(c, r.tn, r.chain)); }
      H.bindSkin(body, n);
    }
  },
  dispose(n) { n._hs = null; },
});

}
