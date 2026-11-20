// The FAILURE record: a run that is not `pass` says WHY (which floor it missed), WHERE (image region) and under WHICH rule.
// A receipt-to-rule engine groups failures by (engine, failure_class, subject feature); a fail with reason null gives it nothing.
//
//   reason          one sentence: the metric(s) that missed and the floor they missed
//   misses          [{metric, value, floor, level}] against the thresholds the receipt carries
//   locus           image-space: bbox of pixels whose largest channel delta exceeds 16 (0..1, origin top-left), the 3 worst
//                   tiles of an 8x8 grid, and where the differing pixels sit (silhouette = only one picture drew there)
//   failure_class   measured, closed list: silhouette | tone-shift | local-shading | broad-shading | engine-error
//   rule_id         a rule of formats/gltf/SPEC.md section 7 that already explains this failure, or null
//   rule_status     explained | unexplained   (unexplained failures are the mining input)
//   subject_features  what the file uses: validator issue codes and extensions (the group-by key on the subject side)
//
// LIMITS, stated: the locus is a picture region, not a glTF node (that needs an id pass per engine, not built). The class
// cut-offs are v0 hand-set values (grade: Suspected). A class describes the difference, it does not prove a cause.
import { rgbOf, BG } from './score.mjs';

export const FAILURE_SCHEMA = 'loom.failure/1';
export const CLASS_CUTS = { basis: 'v0, set by hand on 20 Nov 2026 (grade: Suspected)', silhouette_iou_max: 0.97, silhouette_share_min: 0.5, tone_bias_ratio_min: 0.8, local_top6_share_min: 0.5 };
const GRID = 8;
const r3 = (x) => +x.toFixed(3);

export function misses(score, thresholds) {
  const out = [];
  for (const level of ['pass', 'warn']) {
    const t = thresholds[level];
    if (score.ssim < t.ssim_min) out.push({ metric: 'ssim', value: score.ssim, floor: t.ssim_min, level });
    if (typeof score.psnr_fg_db === 'number' && score.psnr_fg_db < t.psnr_fg_db_min) out.push({ metric: 'psnr_fg_db', value: score.psnr_fg_db, floor: t.psnr_fg_db_min, level });
  }
  return out;
}
export function reasonText(status, miss) {
  const level = status === 'fail' ? 'warn' : 'pass';
  const m = miss.filter((x) => x.level === level);
  return `${status}: ` + m.map((x) => `${x.metric} ${x.value} is under the ${level} floor ${x.floor}`).join('; ');
}

/** Where the two pictures differ. table: the same candidate re-encode the score used. */
export async function locate(candidatePng, referencePng, table = null) {
  const A = await rgbOf(candidatePng), B = await rgbOf(referencePng);
  if (A.w !== B.w || A.h !== B.h) throw new Error(`size mismatch ${A.w}x${A.h} vs ${B.w}x${B.h}`);
  const { w, h } = A; const tiles = new Float64Array(GRID * GRID);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, over = 0, overEdge = 0, overBoth = 0, overBg = 0, total = 0, signed = 0, absL = 0, nBoth = 0;
  for (let i = 0; i < w * h; i++) {
    const fa = A.data[3 * i] !== BG[0] || A.data[3 * i + 1] !== BG[1] || A.data[3 * i + 2] !== BG[2];
    const fb = B.data[3 * i] !== BG[0] || B.data[3 * i + 1] !== BG[1] || B.data[3 * i + 2] !== BG[2];
    const a = [0, 1, 2].map((c) => (table && fa ? table[A.data[3 * i + c]] : A.data[3 * i + c]));
    let dmax = 0, d = 0;
    for (let c = 0; c < 3; c++) { const v = Math.abs(a[c] - B.data[3 * i + c]); dmax = Math.max(dmax, v); d += v; }
    const x = i % w, y = (i - x) / w;
    tiles[Math.min(GRID - 1, Math.floor((y * GRID) / h)) * GRID + Math.min(GRID - 1, Math.floor((x * GRID) / w))] += d; total += d;
    if (fa && fb) {
      const l = 0.299 * (a[0] - B.data[3 * i]) + 0.587 * (a[1] - B.data[3 * i + 1]) + 0.114 * (a[2] - B.data[3 * i + 2]);
      signed += l; absL += Math.abs(l); nBoth++;
    }
    if (dmax > 16) {
      over++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      if (fa && fb) overBoth++; else if (fa || fb) overEdge++; else overBg++;
    }
  }
  const ranked = [...tiles].map((v, k) => ({ col: k % GRID, row: Math.floor(k / GRID), share: total ? v / total : 0 })).sort((p, q) => q.share - p.share);
  return {
    space: 'image, origin top-left, 0..1', grid: GRID,
    bbox_over16: over ? [r3(x0 / w), r3(y0 / h), r3((x1 + 1) / w), r3((y1 + 1) / h)] : null,
    over16_pixels: over,
    over16_where: { silhouette: over ? r3(overEdge / over) : 0, interior: over ? r3(overBoth / over) : 0, background: over ? r3(overBg / over) : 0 },
    worst_tiles: ranked.slice(0, 3).map((t) => ({ col: t.col, row: t.row, share: r3(t.share) })),
    top6_tile_share: r3(ranked.slice(0, 6).reduce((s, t) => s + t.share, 0)),
    luma_bias: nBoth ? r3(signed / nBoth) : 0, luma_bias_ratio: absL ? r3(Math.abs(signed) / absL) : 0,
    direction: !nBoth || Math.abs(signed) / (absL || 1) < 0.2 ? 'mixed' : signed < 0 ? 'candidate darker' : 'candidate brighter',
  };
}

export function classify(score, locus) {
  if (score.coverage_iou < CLASS_CUTS.silhouette_iou_max || locus.over16_where.silhouette >= CLASS_CUTS.silhouette_share_min) return 'silhouette';
  if (locus.luma_bias_ratio >= CLASS_CUTS.tone_bias_ratio_min) return 'tone-shift';
  if (locus.top6_tile_share >= CLASS_CUTS.local_top6_share_min) return 'local-shading';
  return 'broad-shading';
}

/** The rule that already explains a failure, if one does. Order matters: the reference being suspect outranks the rest. */
export function ruleFor({ engineId, consensus, gateIssueCodes }) {
  if (consensus?.reference_suspect) return { rule_id: 'R-GLTF-8', why: 'the raster candidates agree with each other and fail the reference: the reference is the suspect' };
  if (engineId === 'cycles') return { rule_id: 'R-GLTF-4', why: 'a path tracer draws shadows and bounce light the raster reference does not: witness, not candidate' };
  if ((gateIssueCodes ?? []).includes('MESH_PRIMITIVE_GENERATED_TANGENT_SPACE')) return { rule_id: 'R-GLTF-7', why: 'the validator warned that tangents are generated; engines generate them differently' };
  return { rule_id: null, why: null };
}

/** The failure block for one scored run that is warn or fail. */
export async function failureOf({ row, candidatePng, referencePng, table, thresholds, consensus, gate }) {
  const sc = row.score.encode_matched;
  const miss = misses(sc, thresholds);
  const locus = await locate(candidatePng, referencePng, table);
  const rule = ruleFor({ engineId: row.engine.id, consensus, gateIssueCodes: (gate.issues ?? []).map((i) => i.code) });
  return {
    reason: reasonText(row.status, miss), misses: miss, failure_class: classify(sc, locus), locus,
    rule_id: rule.rule_id, rule_why: rule.why, rule_status: rule.rule_id ? 'explained' : 'unexplained',
    subject_features: { validator_codes: [...new Set((gate.issues ?? []).map((i) => i.code))].sort(), extensions_used: gate.extensions_used ?? [] },
    class_cuts: CLASS_CUTS,
  };
}
