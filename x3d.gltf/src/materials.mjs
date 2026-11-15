// Material gate: the look-defining numbers of each material, compared after both files go through the same writer.
// Texture indices are replaced by a marker (dedup renumbers them, KTX2 changes the image), everything else must match exactly.
import { splitGlb } from './measure.mjs';
import { stable } from './geometry.mjs';

function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) {
      if (k === 'name' || k === 'extras') continue;
      o[k] = k === 'index' && Number.isInteger(v[k]) ? 'T' : scrub(v[k]);
    }
    return o;
  }
  return v;
}

// Run the bytes through the lane's own reader and writer so that both sides are normalised by the same code (default-valued fields dropped alike).
export async function materialTable(bytes, io) {
  const doc = await io.readBinary(new Uint8Array(bytes));
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression' || e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
  const { json } = splitGlb(await io.writeBinary(doc));
  const rows = (json.materials || []).map((m) => ({ key: `${m.name || ''}|${stable(m.extras || {})}`, look: stable(scrub(m)) }));
  rows.sort((a, b) => (a.key + a.look < b.key + b.look ? -1 : 1));
  return rows;
}

export function compareMaterials(a, b) {
  const used = new Array(b.length).fill(false);
  let same = 0; const differing = [];
  for (const r of a) {
    let j = b.findIndex((x, i) => !used[i] && x.key === r.key && x.look === r.look);
    if (j >= 0) { used[j] = true; same++; continue; }
    j = b.findIndex((x, i) => !used[i] && x.key === r.key);
    if (j >= 0) { used[j] = true; differing.push(r.key); } else differing.push(r.key + ' (missing)');
  }
  return { source: a.length, output: b.length, identical: same, differing };
}
