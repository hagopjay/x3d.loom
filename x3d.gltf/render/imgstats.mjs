// PNG decoding (sharp) and the image metrics used by compare.mjs, render.mjs and the tests.

import sharp from 'sharp';

export const BG_RGB = [0x20, 0x24, 0x2c];

/** Decodes a PNG (path or Buffer) to {data: Uint8Array RGB, width, height}. Alpha is dropped (composited on nothing). */
export async function decodeRgb(src) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Mean absolute delta (0-255, over R,G,B), PSNR (dB, Infinity when identical) and fraction of pixels with max-channel delta > threshold. */
export async function compareImages(a, b, { threshold = 16 } = {}) {
  const A = await decodeRgb(a);
  const B = await decodeRgb(b);
  if (A.width !== B.width || A.height !== B.height) {
    throw new Error(`size mismatch: ${A.width}x${A.height} vs ${B.width}x${B.height}`);
  }
  const n = A.width * A.height;
  let sumAbs = 0;
  let sumSq = 0;
  let over = 0;
  let maxDelta = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(A.data[i * 3 + c] - B.data[i * 3 + c]);
      sumAbs += d;
      sumSq += d * d;
      if (d > m) m = d;
    }
    if (m > threshold) over++;
    if (m > maxDelta) maxDelta = m;
  }
  const mse = sumSq / (n * 3);
  return {
    width: A.width,
    height: A.height,
    meanAbsDelta: sumAbs / (n * 3),
    psnrDb: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse),
    fractionOverThreshold: over / n,
    threshold,
    maxChannelDelta: maxDelta,
  };
}

/** Stats of one image against the flat background colour. */
export async function backgroundStats(src, bg = BG_RGB, { tolerance = 8 } = {}) {
  const A = await decodeRgb(src);
  const n = A.width * A.height;
  let sumAbs = 0;
  let nonBg = 0;
  const colours = new Set();
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(A.data[i * 3 + c] - bg[c]);
      sumAbs += d;
      if (d > m) m = d;
    }
    if (m > tolerance) nonBg++;
    if (colours.size <= 4096) colours.add((A.data[i * 3] << 16) | (A.data[i * 3 + 1] << 8) | A.data[i * 3 + 2]);
  }
  // corner pixel = what the engine's clear colour actually produced
  const corner = [A.data[0], A.data[1], A.data[2]];
  return {
    width: A.width,
    height: A.height,
    meanDeltaFromBackground: sumAbs / (n * 3),
    nonBackgroundFraction: nonBg / n,
    distinctColours: colours.size, // capped near 4096
    cornerPixel: corner,
  };
}
