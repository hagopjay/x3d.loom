// The SCORE witness: candidate picture vs reference picture, same size, same camera, same lighting contract.
//   psnr_db        RGB, whole frame (background included, so it flatters small objects)
//   psnr_fg_db     RGB, only pixels where EITHER picture differs from the clear colour #20242c (the object as either renderer drew it)
//   ssim           luma (BT.601 from the 8-bit sRGB values), 11x11 Gaussian window sigma 1.5, K1 0.01, K2 0.03, L 255 (Wang et al. 2004)
//   mean_abs       mean |delta| over R,G,B on 0-255, whole frame
//   over16         fraction of pixels whose largest channel delta exceeds 16
//   coverage_iou   intersection-over-union of the two foreground masks (silhouette agreement)
import sharp from 'sharp';

export const BG = [32, 36, 44];

export async function rgbOf(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function gaussKernel(size = 11, sigma = 1.5) {
  const k = []; const c = (size - 1) / 2; let s = 0;
  for (let i = 0; i < size; i++) { const v = Math.exp(-((i - c) ** 2) / (2 * sigma * sigma)); k.push(v); s += v; }
  return k.map((v) => v / s);
}
function blur(src, w, h, k) {
  const r = (k.length - 1) / 2; const tmp = new Float64Array(w * h); const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) { const xx = Math.min(w - 1, Math.max(0, x + i)); s += src[y * w + xx] * k[i + r]; } tmp[y * w + x] = s; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) { const yy = Math.min(h - 1, Math.max(0, y + i)); s += tmp[yy * w + x] * k[i + r]; } out[y * w + x] = s; }
  return out;
}
export function ssimLuma(a, b, w, h) {
  const n = w * h; const x = new Float64Array(n); const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = 0.299 * a[3 * i] + 0.587 * a[3 * i + 1] + 0.114 * a[3 * i + 2];
    y[i] = 0.299 * b[3 * i] + 0.587 * b[3 * i + 1] + 0.114 * b[3 * i + 2];
  }
  const k = gaussKernel(); const C1 = (0.01 * 255) ** 2; const C2 = (0.03 * 255) ** 2;
  const mx = blur(x, w, h, k), my = blur(y, w, h, k);
  const xx = blur(x.map((v) => v * v), w, h, k), yy = blur(y.map((v) => v * v), w, h, k);
  const xy = blur(x.map((v, i) => v * y[i]), w, h, k);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const vx = xx[i] - mx[i] ** 2, vy = yy[i] - my[i] ** 2, cxy = xy[i] - mx[i] * my[i];
    s += ((2 * mx[i] * my[i] + C1) * (2 * cxy + C2)) / ((mx[i] ** 2 + my[i] ** 2 + C1) * (vx + vy + C2));
  }
  return s / n;
}
const psnr = (mse) => (mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse));

/** table: optional 256-entry byte remap applied to the CANDIDATE's foreground pixels (the clear colour is left alone). */
export async function score(candidatePng, referencePng, table = null) {
  const A = await rgbOf(candidatePng), B = await rgbOf(referencePng);
  if (table) for (let i = 0; i < A.w * A.h; i++) {
    if (A.data[3 * i] === BG[0] && A.data[3 * i + 1] === BG[1] && A.data[3 * i + 2] === BG[2]) continue;
    for (let c = 0; c < 3; c++) A.data[3 * i + c] = table[A.data[3 * i + c]];
  }
  if (A.w !== B.w || A.h !== B.h) throw new Error(`size mismatch ${A.w}x${A.h} vs ${B.w}x${B.h}`);
  const n = A.w * A.h; let se = 0, seFg = 0, nFg = 0, abs = 0, over = 0, inter = 0, uni = 0;
  for (let i = 0; i < n; i++) {
    let d2 = 0, dmax = 0;
    const fa = A.data[3 * i] !== BG[0] || A.data[3 * i + 1] !== BG[1] || A.data[3 * i + 2] !== BG[2];
    const fb = B.data[3 * i] !== BG[0] || B.data[3 * i + 1] !== BG[1] || B.data[3 * i + 2] !== BG[2];
    for (let c = 0; c < 3; c++) { const d = A.data[3 * i + c] - B.data[3 * i + c]; d2 += d * d; abs += Math.abs(d); dmax = Math.max(dmax, Math.abs(d)); }
    se += d2; if (dmax > 16) over++;
    if (fa || fb) { seFg += d2; nFg++; uni++; if (fa && fb) inter++; }
  }
  const r = (x, p = 3) => (Number.isFinite(x) ? +x.toFixed(p) : x === Infinity ? 'inf' : null);
  return {
    psnr_db: r(psnr(se / (3 * n)), 2),
    psnr_fg_db: r(nFg ? psnr(seFg / (3 * nFg)) : Infinity, 2),
    ssim: r(ssimLuma(A.data, B.data, A.w, A.h), 4),
    mean_abs: r(abs / (3 * n), 3),
    over16: r(over / n, 4),
    coverage_iou: r(uni ? inter / uni : 1, 4),
    fg_pixels: nFg,
    size: [A.w, A.h],
  };
}
