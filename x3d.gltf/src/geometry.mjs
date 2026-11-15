// World-space geometry of a glTF-Transform Document, and the metrics that tell you whether an optimiser moved it.
//
// Why triangle centroids: weld, reorder and the meshopt/Draco encoders permute vertices and triangles, so "vertex i before == vertex i after" does not hold,
// but a triangle that has not changed keeps its centroid. Matching every source centroid to its nearest output centroid (a grid lookup) gives a deviation
// that is independent of vertex order, and the same match carries the mean vertex normal and mean UV of the triangle for the shading checks.
// Skinning and morph targets are not applied: this is the rest pose. Animation is a separate gate (animation.mjs).

const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 4294967295 };   // componentType -> divisor of a normalized integer

export function readFloats(acc) {
  const arr = acc.getArray(), n = acc.getElementSize(), count = acc.getCount();
  const out = new Float64Array(count * n);
  if (acc.getNormalized() && NORM[acc.getComponentType()]) {
    const d = NORM[acc.getComponentType()], signed = acc.getComponentType() === 5120 || acc.getComponentType() === 5122;
    for (let i = 0; i < out.length; i++) out[i] = signed ? Math.max(arr[i] / d, -1) : arr[i] / d;
  } else for (let i = 0; i < out.length; i++) out[i] = arr[i];
  return out;
}

const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {   // column-major a * b
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function compose(t, q, s) {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0, (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0, (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
}
function cofactor3(m) {   // normal matrix up to a positive scale: cofactors of the upper 3x3 (= det * inverse transpose), sign-corrected for mirrored transforms
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g), sg = det < 0 ? -1 : 1;
  return [sg * (e * i - f * h), sg * (f * g - d * i), sg * (d * h - e * g), sg * (c * h - b * i), sg * (a * i - c * g), sg * (b * g - a * h), sg * (b * f - c * e), sg * (c * d - a * f), sg * (a * e - b * d)];   // row-major 3x3 of cofactors
}

// Per-node key that survives optimisation: name plus extras. Duplicates get an ordinal, so the key is stable for a given traversal order.
export function nodeKey(node) {
  const ex = node.getExtras();
  if (ex && ex.x3d_wrapper_of && node.getParentNode()) return nodeKey(node.getParentNode());   // a helper node an optimiser inserted: it IS its parent for identity purposes
  return `${node.getName()}|${stable(ex)}`;
}
export function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

export function collectGeometry(doc) {
  const R = doc.getRoot();
  const scene = R.getDefaultScene() || R.listScenes()[0];
  const cent = [], areas = [], nrm = [], uvs = [], pts = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const perNode = new Map(); const ord = new Map();
  let hasNormals = false, hasUV = false, triangles = 0, degenerate = 0;
  const grow = (b, x, y, z) => { if (x < b.min[0]) b.min[0] = x; if (y < b.min[1]) b.min[1] = y; if (z < b.min[2]) b.min[2] = z; if (x > b.max[0]) b.max[0] = x; if (y > b.max[1]) b.max[1] = y; if (z > b.max[2]) b.max[2] = z; };
  const global = { min, max };
  if (!scene) return finish();
  const meshCache = new Map();
  const prep = (mesh) => {
    if (meshCache.has(mesh)) return meshCache.get(mesh);
    const prims = mesh.listPrimitives().map((p) => {
      const pos = p.getAttribute('POSITION'); if (!pos) return null;
      const nA = p.getAttribute('NORMAL'), uA = p.getAttribute('TEXCOORD_0'), idx = p.getIndices();
      return { mode: p.getMode(), pos: readFloats(pos), nor: nA ? readFloats(nA) : null, uv: uA ? readFloats(uA) : null, idx: idx ? idx.getArray() : null, count: pos.getCount() };
    }).filter(Boolean);
    meshCache.set(mesh, prims); return prims;
  };
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const k0 = nodeKey(node), n = (ord.get(k0) || 0) + 1; ord.set(k0, n);
    const key = n === 1 ? k0 : `${k0}#${n}`;
    const nb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], triangles: 0 };
    const W = node.getWorldMatrix();
    const inst = node.getExtension('EXT_mesh_gpu_instancing');
    let mats = [W];
    if (inst) {
      const T = inst.getAttribute('TRANSLATION'), Q = inst.getAttribute('ROTATION'), S = inst.getAttribute('SCALE');
      const cnt = (T || Q || S).getCount(), tt = T && readFloats(T), qq = Q && readFloats(Q), ss = S && readFloats(S);
      mats = [];
      for (let i = 0; i < cnt; i++) mats.push(mul(W, compose(tt ? [tt[3 * i], tt[3 * i + 1], tt[3 * i + 2]] : [0, 0, 0], qq ? [qq[4 * i], qq[4 * i + 1], qq[4 * i + 2], qq[4 * i + 3]] : [0, 0, 0, 1], ss ? [ss[3 * i], ss[3 * i + 1], ss[3 * i + 2]] : [1, 1, 1])));
    }
    for (const M of mats) {
      const C = cofactor3(M);
      for (const pr of prep(mesh)) {
        const P = pr.pos, wp = new Float64Array(pr.count * 3), wn = pr.nor ? new Float64Array(pr.count * 3) : null;
        for (let i = 0; i < pr.count; i++) {
          const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
          const X = M[0] * x + M[4] * y + M[8] * z + M[12], Y = M[1] * x + M[5] * y + M[9] * z + M[13], Z = M[2] * x + M[6] * y + M[10] * z + M[14];
          wp[3 * i] = X; wp[3 * i + 1] = Y; wp[3 * i + 2] = Z; grow(global, X, Y, Z); grow(nb, X, Y, Z);
          if (wn) { const a = pr.nor[3 * i], b = pr.nor[3 * i + 1], c = pr.nor[3 * i + 2]; let u = C[0] * a + C[1] * b + C[2] * c, v = C[3] * a + C[4] * b + C[5] * c, w = C[6] * a + C[7] * b + C[8] * c; const l = Math.hypot(u, v, w) || 1; wn[3 * i] = u / l; wn[3 * i + 1] = v / l; wn[3 * i + 2] = w / l; }
        }
        if (pr.mode === 0) { for (let i = 0; i < pr.count; i++) pts.push(wp[3 * i], wp[3 * i + 1], wp[3 * i + 2]); continue; }
        if (pr.mode < 4) continue;   // lines: counted in the inventory, not sampled here
        const idx = pr.idx, n3 = idx ? idx.length : pr.count;
        const tri = (a, b, c) => {
          const ax = wp[3 * a], ay = wp[3 * a + 1], az = wp[3 * a + 2], bx = wp[3 * b], by = wp[3 * b + 1], bz = wp[3 * b + 2], cx = wp[3 * c], cy = wp[3 * c + 1], cz = wp[3 * c + 2];
          const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
          const cxp = uy * vz - uz * vy, cyp = uz * vx - ux * vz, czp = ux * vy - uy * vx, area = 0.5 * Math.hypot(cxp, cyp, czp);
          triangles++; nb.triangles++; if (area === 0) degenerate++;
          cent.push((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3); areas.push(area);
          if (wn) { hasNormals = true; let u = wn[3 * a] + wn[3 * b] + wn[3 * c], v = wn[3 * a + 1] + wn[3 * b + 1] + wn[3 * c + 1], w = wn[3 * a + 2] + wn[3 * b + 2] + wn[3 * c + 2]; const l = Math.hypot(u, v, w) || 1; nrm.push(u / l, v / l, w / l); } else nrm.push(0, 0, 0);
          if (pr.uv) { hasUV = true; uvs.push((pr.uv[2 * a] + pr.uv[2 * b] + pr.uv[2 * c]) / 3, (pr.uv[2 * a + 1] + pr.uv[2 * b + 1] + pr.uv[2 * c + 1]) / 3); } else uvs.push(0, 0);
        };
        const I = (i) => idx ? idx[i] : i;
        if (pr.mode === 4) for (let i = 0; i + 2 < n3; i += 3) tri(I(i), I(i + 1), I(i + 2));
        else if (pr.mode === 5) for (let i = 0; i + 2 < n3; i++) i % 2 ? tri(I(i + 1), I(i), I(i + 2)) : tri(I(i), I(i + 1), I(i + 2));
        else if (pr.mode === 6) for (let i = 1; i + 1 < n3; i++) tri(I(0), I(i), I(i + 1));
      }
    }
    const prev = perNode.get(key); if (!prev) perNode.set(key, nb);
  });
  return finish();

  function finish() {
    const diag = Number.isFinite(min[0]) ? Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) : 0;
    // zero-area triangles (the poles of a UV sphere, collapsed quads) have no surface to match; Draco drops them on encode. Count them, do not match them.
    const eps = 1e-12 * diag * diag, keep = [];
    for (let i = 0; i < areas.length; i++) if (areas[i] > eps) keep.push(i);
    const pick = (src, w) => { const o = new Float64Array(keep.length * w); keep.forEach((k, i) => { for (let q = 0; q < w; q++) o[w * i + q] = src[w * k + q]; }); return o; };
    const area = areas.reduce((a, b) => a + b, 0);
    return { triangles, solidTriangles: keep.length, degenerate: triangles - keep.length, area, bounds: { min, max }, diagonal: diag, centroids: pick(cent, 3), areas: pick(areas, 1), normals: hasNormals ? pick(nrm, 3) : null,
      uvs: hasUV ? pick(uvs, 2) : null, points: Float64Array.from(pts), perNode };
  }
}

// ---------- nearest-centroid matching on a static k-d tree ----------
// A uniform grid was tried first and abandoned: the 600k-triangle cathedral packs thousands of centroids into a few cells, so a grid lookup scanned them all.
// Implicit balanced tree: `order` holds point indices, the median of each [lo,hi) range is the node, the split axis cycles with depth.
function buildKd(c) {
  const n = c.length / 3, order = new Uint32Array(n); for (let i = 0; i < n; i++) order[i] = i;
  const axisOf = new Uint8Array(n);   // axis stored at the median slot of its range
  const stack = [[0, n, 0]];
  while (stack.length) {
    const [lo, hi, depth] = stack.pop(); if (hi - lo <= 1) continue;
    const axis = depth % 3, mid = (lo + hi) >> 1;
    select(order, c, axis, lo, hi - 1, mid); axisOf[mid] = axis;
    stack.push([lo, mid, depth + 1], [mid + 1, hi, depth + 1]);
  }
  return { order, axisOf, c, n };
}
function select(order, c, axis, l, r, k) {   // quickselect on c[3*order[i]+axis]
  while (l < r) {
    const pv = c[3 * order[(l + r) >> 1] + axis]; let i = l, j = r;
    while (i <= j) { while (c[3 * order[i] + axis] < pv) i++; while (c[3 * order[j] + axis] > pv) j--; if (i <= j) { const t = order[i]; order[i] = order[j]; order[j] = t; i++; j--; } }
    if (k <= j) r = j; else if (k >= i) l = i; else return;
  }
}
function nearestKd(kd, x, y, z) {
  const { order, axisOf, c } = kd; let best = -1, bd2 = Infinity;
  const stack = [0, kd.n];
  while (stack.length) {
    const hi = stack.pop(), lo = stack.pop(); if (hi <= lo) continue;
    const mid = (lo + hi) >> 1, idx = order[mid], px = c[3 * idx], py = c[3 * idx + 1], pz = c[3 * idx + 2];
    const d2 = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2; if (d2 < bd2) { bd2 = d2; best = idx; }
    if (hi - lo === 1) continue;
    const ax = axisOf[mid], diff = (ax === 0 ? x - px : ax === 1 ? y - py : z - pz);
    // visit the far side only if the splitting plane is closer than the best so far; the near side is pushed last so it pops first
    if (diff * diff < bd2) { diff < 0 ? stack.push(mid + 1, hi) : stack.push(lo, mid); }
    diff < 0 ? stack.push(lo, mid) : stack.push(mid + 1, hi);
  }
  return { j: best, d: Math.sqrt(bd2) };
}
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;

// Compare a source geometry to an output geometry. All distances are reported absolute and as a fraction of the SOURCE scene diagonal.
export function compareGeometry(a, b) {
  const diag = a.diagonal || 1;
  const rel = (v) => v / diag;
  const out = {
    sourceTriangles: a.triangles, outputTriangles: b.triangles, triangleDelta: b.triangles - a.triangles, sourceSolid: a.solidTriangles, outputSolid: b.solidTriangles, solidDelta: b.solidTriangles - a.solidTriangles, degenerateDropped: a.degenerate - b.degenerate,
    areaRelDelta: a.area ? (b.area - a.area) / a.area : 0,
    boundsMaxCornerDelta: a.triangles ? Math.max(...[0, 1, 2].flatMap((k) => [Math.abs(a.bounds.min[k] - b.bounds.min[k]), Math.abs(a.bounds.max[k] - b.bounds.max[k])])) : 0,
    diagonal: a.diagonal,
  };
  out.boundsMaxCornerDeltaRel = rel(out.boundsMaxCornerDelta);
  const n = a.centroids.length / 3;
  if (n && b.centroids.length) {
    const kd = buildKd(b.centroids);
    const dev = new Float64Array(n), ang = a.normals && b.normals ? new Float64Array(n) : null, du = a.uvs && b.uvs ? new Float64Array(n) : null;
    let unmatched = 0, normalsDropped = 0;
    for (let i = 0; i < n; i++) {
      const { j, d } = nearestKd(kd, a.centroids[3 * i], a.centroids[3 * i + 1], a.centroids[3 * i + 2]);
      if (j < 0) { unmatched++; dev[i] = Infinity; continue; }
      dev[i] = d;
      if (ang) {
        const la = Math.hypot(a.normals[3 * i], a.normals[3 * i + 1], a.normals[3 * i + 2]), lb = Math.hypot(b.normals[3 * j], b.normals[3 * j + 1], b.normals[3 * j + 2]);
        if (la === 0) ang[i] = NaN;                       // the source triangle has no normals: nothing to compare
        else if (lb === 0) { ang[i] = NaN; normalsDropped++; }   // the output lost them (prune drops NORMAL for unlit materials)
        else { const dot = (a.normals[3 * i] * b.normals[3 * j] + a.normals[3 * i + 1] * b.normals[3 * j + 1] + a.normals[3 * i + 2] * b.normals[3 * j + 2]) / (la * lb); ang[i] = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI; }
      }
      if (du) du[i] = Math.hypot(a.uvs[2 * i] - b.uvs[2 * j], a.uvs[2 * i + 1] - b.uvs[2 * j + 1]);
    }
    const s = Array.from(dev).sort((x, y) => x - y);
    out.centroid = { matched: n - unmatched, unmatched, maxAbs: s[s.length - 1], maxRel: rel(s[s.length - 1]), p99Rel: rel(pct(s, 0.99)), meanRel: rel(s.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0) / n) };
    if (ang) { const t = Array.from(ang).filter((v) => !Number.isNaN(v)).sort((x, y) => x - y); out.normalDegrees = { compared: t.length, dropped: normalsDropped, max: t[t.length - 1] ?? 0, p99: pct(t, 0.99), mean: t.length ? t.reduce((x, y) => x + y, 0) / t.length : 0 }; }
    if (du) { const t = Array.from(du).sort((x, y) => x - y); out.uvDelta = { max: t[t.length - 1], p99: pct(t, 0.99) }; }
  } else out.centroid = null;
  // per-node boxes, only for node keys that exist once on both sides (identity-bearing nodes)
  let compared = 0, worst = 0, missing = 0;
  for (const [k, ba] of a.perNode) {
    const bb = b.perNode.get(k); if (!bb) { missing++; continue; }
    compared++;
    for (let t = 0; t < 3; t++) worst = Math.max(worst, Math.abs(ba.min[t] - bb.min[t]), Math.abs(ba.max[t] - bb.max[t]));
  }
  out.nodeBoxes = { compared, missingInOutput: missing, worstCornerRel: rel(worst) };
  return out;
}
