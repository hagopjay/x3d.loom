/* TriangleSet and ElevationGrid for the three.js bridge, written as shared-bridge nodes (BR.node with a geometry() hook), so the same two definitions could serve any body.
   They are here, not in x3d.webgpu/, because the Babylon bridge draws them through its Manifold and Drift readers, which the three.js bundle does not load (and which turn an ElevationGrid into an
   IndexedTriangleSet at parse time, dropping creaseAngle). Both return the vertex data BR.compose builds: one corner per triangle vertex, so per-face colours and normals work. */
{
  /* X3D creaseAngle: a vertex shared by several faces gets the average normal of the faces that meet at it and whose normals are within creaseAngle of the face being shaded; with 0 every face is flat.
     tri = source vertex per corner, 3 per triangle. Returns one normal per corner (the order BR.compose emits). */
  const creaseNormals = (pos, tri, crease) => {
    const nt = tri.length / 3, tn = new Array(nt), at = new Map();
    for (let t = 0; t < nt; t++) {
      const a = t * 9, u = [pos[a + 3] - pos[a], pos[a + 4] - pos[a + 1], pos[a + 5] - pos[a + 2]], w = [pos[a + 6] - pos[a], pos[a + 7] - pos[a + 1], pos[a + 8] - pos[a + 2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]) || 1; tn[t] = [n[0] / l, n[1] / l, n[2] / l];
      for (let k = 0; k < 3; k++) { const v = tri[t * 3 + k]; (at.get(v) || at.set(v, []).get(v)).push(t); }
    }
    const out = new Float32Array(tri.length * 3), cosC = Math.cos(crease);
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
      const c = t * 3 + k, me = tn[t]; let x = 0, y = 0, z = 0;
      for (const o of at.get(tri[c])) { const n = tn[o]; if (o === t || me[0] * n[0] + me[1] * n[1] + me[2] * n[2] > cosC) { x += n[0]; y += n[1]; z += n[2]; } }
      const l = Math.hypot(x, y, z) || 1; out[c * 3] = x / l; out[c * 3 + 1] = y / l; out[c * 3 + 2] = z / l;
    }
    return out;
  };
  BR.creaseNormals = creaseNormals;

  const composed = { attrib: ['MFNode', IO, []], ccw: ['SFBool', INIT, true], color: ['SFNode', IO, null], colorPerVertex: ['SFBool', INIT, true], fogCoord: ['SFNode', IO, null],
    normal: ['SFNode', IO, null], normalPerVertex: ['SFBool', INIT, true], solid: ['SFBool', INIT, true], texCoord: ['SFNode', IO, null] };

  // every three coordinate vertices are a triangle (19775-1 31.4.9)
  BR.node('TriangleSet', {
    component: 'Rendering', level: 1, container: 'geometry',
    defs: { ...composed, coord: ['SFNode', IO, null] },
    geometry(g) {
      const nt = Math.floor(((g.f.coord && g.f.coord.f.point.length) || 0) / 9), tri = [], faceOf = [];
      for (let t = 0; t < nt; t++) { tri.push(t * 3, t * 3 + 1, t * 3 + 2); faceOf.push(t); }
      return BR.compose(g, tri, faceOf);
    },
    changed(body, n, field) { if (field === 'ccw' || field === 'colorPerVertex' || field === 'normalPerVertex') body.regeo(n); },
  });

  /* ElevationGrid (19775-1 13.3.5): xDimension x zDimension heights on a grid, x along the first axis and z along the second; the two triangles of a square are (a, c, d) and (a, d, b) (the diagonal runs from the first corner to the far one, as X_ITE cuts it: pixel-identical to X_ITE, the other diagonal differs by 2.7 grey levels), counter-clockwise
     seen from +Y. Default texture coordinates run from (0,0) at the first vertex to (1,1) at the last, s along +X and t along +Z. colorPerVertex false gives one colour per square (the colour index is the square number);
     with no normal the normals follow creaseAngle (default 0: flat). */
  BR.node('ElevationGrid', {
    component: 'Geometry3D', level: 3, container: 'geometry',
    defs: { ...composed, xDimension: ['SFInt32', INIT, 0], zDimension: ['SFInt32', INIT, 0], xSpacing: ['SFFloat', INIT, 1], zSpacing: ['SFFloat', INIT, 1], height: ['MFFloat', INIT, []],
      creaseAngle: ['SFFloat', INIT, 0], set_height: ['MFFloat', IN, []] },
    flat: { 'ElevationGrid.height': Float32Array },
    geometry(g) {
      const f = g.f, nx = f.xDimension | 0, nz = f.zDimension | 0; if (nx < 2 || nz < 2) return null;
      const P = new Float32Array(nx * nz * 3), UV = new Float32Array(nx * nz * 2), H = f.height || [];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; P[k * 3] = i * f.xSpacing; P[k * 3 + 1] = H[k] || 0; P[k * 3 + 2] = j * f.zSpacing; UV[k * 2] = i / (nx - 1); UV[k * 2 + 1] = j / (nz - 1); }
      const tri = [], faceOf = [];
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1, q = j * (nx - 1) + i; tri.push(a, c, d, a, d, b); faceOf.push(q, q); }
      const d = BR.compose({ f: { ...f, coord: { f: { point: P } }, texCoord: f.texCoord || { type: 'TextureCoordinate', f: { point: UV } }, normalPerVertex: f.normal ? f.normalPerVertex !== false : true } }, tri, faceOf);   // with a Normal node, normalPerVertex false indexes it by square (faceOf)
      if (!f.normal) d.nrm = creaseNormals(d.pos, tri, f.normalPerVertex === false ? 0 : Math.max(0, f.creaseAngle));   // BR.compose smooths over the shared source vertex, which is creaseAngle = pi; X3D's default (0) is flat faces
      if (f.ccw === false && d.nrm && !f.normal) for (let i = 0; i < d.nrm.length; i++) d.nrm[i] = -d.nrm[i];
      return d;
    },
    receive(n, field, v) { if (field === 'set_height') { n.f.height = v.slice ? v.slice() : v; n.version = (n.version || 0) + 1; events.emit(n, 'height', n.f.height); if (R.bridge.body) R.bridge.body.regeo(n); return true; } },   // the input event of 19775-1 13.3.5
    changed(body, n, field) { if (['xDimension', 'zDimension', 'xSpacing', 'zSpacing', 'height', 'creaseAngle', 'ccw', 'colorPerVertex', 'normalPerVertex'].includes(field)) body.regeo(n); },
  });

  /* TriangleStripSet: the reader defines the node (stripCount over the coordinate list, strips in order); the geometry is made here with the same compose() the indexed strip uses.
     Triangle k of a strip is (k, k+1, k+2), every odd one with its first two swapped so all keep one winding. */
  R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
  R.bridge.three.geometry.TriangleStripSet = (g, body) => {
    const tri = [], faceOf = []; let s0 = 0;
    (g.f.stripCount || []).forEach((n, i) => { for (let k = 0; k + 2 < n; k++) { const a = s0 + k; if (k % 2) tri.push(a + 1, a, a + 2); else tri.push(a, a + 1, a + 2); faceOf.push(faceOf.length); } s0 += n; });   // every triangle is a face: colorPerVertex / normalPerVertex false give one colour or normal per triangle (X_ITE counts face = corner / 3)
    return tri.length ? body.dataGeometry(BR.compose(g, tri, faceOf)) : null;
  };
  R.bridge.three.changed.TriangleStripSet = (body, n, field) => { if (['stripCount', 'ccw', 'colorPerVertex', 'normalPerVertex'].includes(field)) body.regeo(n); };

  /* IndexedFaceSet normals and colours that Body.geometryData (lifted verbatim from the Babylon body) leaves out: it makes flat face normals and per-corner colours only.
     Here, walking the faces in the same order it does (one run of coordIndex per face with 3 or more corners, corners emitted in order, a face of n corners becomes n - 2 fan triangles), the three.js body adds
       - a Normal node (normalPerVertex true: normalIndex or coordIndex per corner; false: normalIndex or the face number per face),
       - creaseAngle (no Normal, normalPerVertex true, creaseAngle > 0): a corner takes the average of the face normals, one per face and counted once, of the faces that share its coordIndex vertex and
         whose normals are within creaseAngle of its own face; with 0 or normalPerVertex false the flat normals stay,
       - colorPerVertex false: one colour per face (colorIndex per face, or the face number); ColorRGBA is read with stride 4 on this path only (geometryData reads the per-corner colours with stride 3, so a ColorRGBA IndexedFaceSet with colorPerVertex true is still wrong; alpha is not drawn).
     A lookup that falls outside its array falls back to the flat normal or the corner colour, never to NaN. Returns {nrm, col} (null where nothing changes). */
  BR.ifsExtras = (g, d) => {
    const f = g.f, ci = f.coordIndex || [], N = f.normal && f.normal.f.vector, C = f.color && f.color.f.color, cw = f.color && f.color.type === 'ColorRGBA' ? 4 : 3, out = { nrm: null, col: null };
    const faces = []; let cur = [], fi = 0, tri0 = 0;   // cur: [[corner position in coordIndex, coord vertex]...]
    for (let i = 0; i <= ci.length; i++) { if (i === ci.length || ci[i] < 0) { if (cur.length >= 3) { faces.push({ fi, corners: cur, tri: tri0 }); tri0 += cur.length - 2; } if (i < ci.length || cur.length) fi++; cur = []; } else cur.push([i, ci[i]]); }
    const nv = d.pos.length / 3, nrm = d.nrm ? Float32Array.from(d.nrm) : new Float32Array(nv * 3), perV = f.normalPerVertex !== false;
    const col = C && f.colorPerVertex === false ? (d.col ? Float32Array.from(d.col) : new Float32Array(nv * 3)) : null;
    if (N) {
      const NI = f.normalIndex && f.normalIndex.length ? f.normalIndex : null; let c = 0;
      for (const F of faces) for (const [pos, v] of F.corners) {
        const ix = perV ? (NI && NI[pos] !== undefined ? NI[pos] : v) : (NI && NI[F.fi] !== undefined ? NI[F.fi] : F.fi), k = ix * 3;
        if (k >= 0 && k + 2 < N.length) { nrm[c * 3] = N[k]; nrm[c * 3 + 1] = N[k + 1]; nrm[c * 3 + 2] = N[k + 2]; }   // out of range: the flat normal stays
        c++;
      }
      out.nrm = nrm;
    } else if (f.creaseAngle > 0 && perV) {
      const idx = d.idx, fn = new Array(faces.length), at = new Map();   // fn: unit normal of each face, from its first emitted triangle (the one geometryData's flat normal comes from)
      faces.forEach((F, q) => {
        const a = idx[F.tri * 3], b = idx[F.tri * 3 + 1], e = idx[F.tri * 3 + 2], u = [d.pos[b * 3] - d.pos[a * 3], d.pos[b * 3 + 1] - d.pos[a * 3 + 1], d.pos[b * 3 + 2] - d.pos[a * 3 + 2]], w = [d.pos[e * 3] - d.pos[a * 3], d.pos[e * 3 + 1] - d.pos[a * 3 + 1], d.pos[e * 3 + 2] - d.pos[a * 3 + 2]];
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]) || 1; fn[q] = [n[0] / l, n[1] / l, n[2] / l];
        for (const [, v] of F.corners) (at.get(v) || at.set(v, new Set()).get(v)).add(q);
      });
      const cosC = Math.cos(f.creaseAngle); let c = 0;
      faces.forEach((F, q) => { for (const [, v] of F.corners) {
        let x = 0, y = 0, z = 0; const me = fn[q];
        for (const o of at.get(v)) { const n = fn[o]; if (o === q || me[0] * n[0] + me[1] * n[1] + me[2] * n[2] > cosC) { x += n[0]; y += n[1]; z += n[2]; } }
        const l = Math.hypot(x, y, z) || 1; nrm[c * 3] = x / l; nrm[c * 3 + 1] = y / l; nrm[c * 3 + 2] = z / l; c++;
      } });
      out.nrm = nrm;
    }
    if (col) {
      const CI = f.colorIndex && f.colorIndex.length ? f.colorIndex : null; let c = 0;
      for (const F of faces) { const k = (CI && CI[F.fi] !== undefined ? CI[F.fi] : F.fi) * cw, ok = k >= 0 && k + 2 < C.length; for (let q = 0; q < F.corners.length; q++, c++) if (ok) { col[c * 3] = C[k]; col[c * 3 + 1] = C[k + 1]; col[c * 3 + 2] = C[k + 2]; } }
      out.col = col;
    }
    return out;
  };
}
