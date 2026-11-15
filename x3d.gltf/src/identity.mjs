// The X3D identity gate. The add-on tags what it imports (x3d_def, x3d_def_path, x3d_use, x3d_viewpoint_description, x3d_head_meta, ...) in glTF `extras`;
// that is the only thing that lets a glb be traced back to the X3D scene it came from (docs/learn chapter 11, H-GLT-5). An optimiser that merges or drops
// nodes, meshes or materials silently cuts the tether. This module snapshots every named or tagged property and diffs two snapshots as multisets.
import { stable } from './geometry.mjs';

const isEmpty = (o) => !o || (typeof o === 'object' && Object.keys(o).length === 0);

function propTokens(kind, p, tokens) {
  const name = p.getName(), extras = p.getExtras();
  if (!name && isEmpty(extras)) return;
  tokens.push(`${kind}|${name}|${stable(extras || {})}`);
}

export function snapshot(doc) {
  const R = doc.getRoot(), tokens = [];
  for (const n of R.listNodes()) {
    const ex = n.getExtras() || {}, inst = Array.isArray(ex.x3d_instances) ? ex.x3d_instances : null;
    if (ex.x3d_wrapper_of) continue;   // helper node inserted by an optimiser (quantize-identity.mjs): not an identity of its own
    if (inst) {   // a batch node made by instance-identity.mjs: its instances stand for the nodes that were folded into it
      for (const r of inst) if (r) tokens.push(`node|${r.n}|${stable(r.e || {})}`);
      const rest = { ...ex }; delete rest.x3d_instances;
      if (n.getName() || Object.keys(rest).length) tokens.push(`node|${n.getName()}|${stable(rest)}`);
      continue;
    }
    propTokens('node', n, tokens);
  }
  for (const m of R.listMeshes()) propTokens('mesh', m, tokens);
  for (const m of R.listMaterials()) propTokens('material', m, tokens);
  for (const s of R.listScenes()) propTokens('scene', s, tokens);
  for (const c of R.listCameras()) tokens.push(`camera|${c.getName()}|${stable(c.getExtras() || {})}|${c.getType()}|${c.getType() === 'perspective' ? [c.getYFov(), c.getZNear(), c.getZFar(), c.getAspectRatio()].join(',') : [c.getXMag(), c.getYMag(), c.getZNear(), c.getZFar()].join(',')}`);
  for (const n of R.listNodes()) { const l = n.getExtension('KHR_lights_punctual'); if (l) tokens.push(`light|${l.getName()}|${stable(l.getExtras() || {})}|${l.getType()}|${l.getColor().join(',')}|${l.getIntensity()}|${l.getRange()}`); }
  if (!isEmpty(R.getExtras())) tokens.push(`asset|${stable(R.getExtras())}`);
  const tagged = (kind) => tokens.filter((t) => t.startsWith(kind + '|') && /x3d_/.test(t)).length;
  // x3d_def_path claims a chain of DEF'd ancestors. Count how many claims still match the real hierarchy.
  let claims = 0, holds = 0;
  for (const n of R.listNodes()) {
    const raw = n.getExtras()?.x3d_def_path;   // the add-on writes a '/'-joined string ('A/B/C'); the fixtures write an array
    const path = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? raw.split('/') : null); if (!path || !path.length) continue;
    claims++;
    const chain = []; for (let p = n.getParentNode(); p; p = p.getParentNode()) { const d = p.getExtras()?.x3d_def; if (d) chain.unshift(d); }
    const own = n.getExtras()?.x3d_def; const want = own && path[path.length - 1] === own ? path.slice(0, -1) : path;
    if (want.every((d) => chain.includes(d))) holds++;
  }
  return { tokens, counts: { nodes: R.listNodes().length, taggedNodes: tagged('node'), taggedMeshes: tagged('mesh'), taggedMaterials: tagged('material'), cameras: R.listCameras().length }, defPathClaims: claims, defPathHolds: holds };
}

const multiset = (arr) => { const m = new Map(); for (const t of arr) m.set(t, (m.get(t) || 0) + 1); return m; };

// Which tokens of `a` are missing from `b` (lost), and which tokens of `b` are new (added)? Multiset arithmetic: two identical tokens need two on the other side.
export function diffIdentity(a, b) {
  const ma = multiset(a.tokens), mb = multiset(b.tokens), lost = [], added = [];
  let preserved = 0;
  for (const [t, n] of ma) { const k = mb.get(t) || 0; preserved += Math.min(n, k); for (let i = k; i < n; i++) lost.push(t); }
  for (const [t, n] of mb) { const k = ma.get(t) || 0; for (let i = k; i < n; i++) added.push(t); }
  return { sourceTokens: a.tokens.length, outputTokens: b.tokens.length, preserved, lost, added,
    taggedLost: lost.filter((t) => /x3d_/.test(t)).length, defPath: { sourceHolds: a.defPathHolds, sourceClaims: a.defPathClaims, outputHolds: b.defPathHolds, outputClaims: b.defPathClaims },
    exact: lost.length === 0 && added.length === 0 };
}

// Count of lost tokens grouped by kind: a short summary for tables.
export function lostByKind(lost) {
  const o = {}; for (const t of lost) { const k = t.split('|', 1)[0]; o[k] = (o[k] || 0) + 1; } return o;
}
