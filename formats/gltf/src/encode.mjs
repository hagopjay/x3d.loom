// How each renderer turns linear light into an 8-bit pixel, read from its shipped source (2026-11-20).
//   gamma-2.2       pow(c, 1/2.2): Khronos Sample Renderer 1.1.0 (tonemapping.glsl linearTosRGB, GAMMA=2.2),
//                   Babylon.js 9.32.0 (GammaEncodePowerApprox = 1/LinearEncodePowerApprox = 1/2.2),
//                   X_ITE 16.7.1 (linearToSRGB = pow(color, vec3(INV_GAMMA)), GAMMA 2.2)
//   srgb-piecewise  IEC 61966-2-1: three.js r187 (outputColorSpace SRGBColorSpace), Blender 5.3 Cycles (view transform Standard)
// glTF 2.0 does not define the display encode (Appendix B stops at linear radiance), so neither is "wrong". The Loom judges a
// candidate after re-encoding it into the reference's encode, and keeps the raw score next to it.
export const ENCODE = { khronos: 'gamma-2.2', babylon: 'gamma-2.2', xite: 'gamma-2.2', three: 'srgb-piecewise', cycles: 'srgb-piecewise', wgpu: 'unknown' };

const dec = { 'gamma-2.2': (v) => v ** 2.2, 'srgb-piecewise': (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) };
const enc = { 'gamma-2.2': (l) => l ** (1 / 2.2), 'srgb-piecewise': (l) => (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055) };

/** 256-entry byte table candidate-encode -> reference-encode (identity when they match). */
export function reencodeTable(from, to) {
  const t = new Uint8Array(256);
  for (let v = 0; v < 256; v++) t[v] = from === to || !dec[from] || !enc[to] ? v : Math.max(0, Math.min(255, Math.round(enc[to](dec[from](v / 255)) * 255)));
  return t;
}
