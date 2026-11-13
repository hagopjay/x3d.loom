// Synthesise the Marble Machine's impact sounds (no recorded or third-party samples): modal synthesis, written as 16-bit mono WAV.
// Each sound is a sum of damped sinusoids (modes) plus, for knocks, a short filtered noise burst. Also measures each file's
// strongest spectral peak, so the tuning of the bell and the bar is checked by numbers, not by ear.
// usage: node tools/make-sounds.ts   (writes public/sounds/*.wav and evidence/sounds.json; evidence/p4-sounds.json is the phase-4 record)
import { mkdirSync, writeFileSync } from 'node:fs';

const SR = 44100;
interface Mode { f: number; a: number; t60: number }
interface Spec { name: string; dur: number; modes: Mode[]; noise?: { a: number; t60: number; cutoff: number }; fundamental?: number; note?: number }
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

const SOUNDS: Spec[] = [
  { name: 'knock-wood', dur: 0.25, modes: [{ f: 190, a: 0.5, t60: 0.06 }, { f: 410, a: 0.35, t60: 0.05 }, { f: 860, a: 0.2, t60: 0.03 }, { f: 1650, a: 0.1, t60: 0.02 }], noise: { a: 0.35, t60: 0.012, cutoff: 3000 } },
  { name: 'clink-glass', dur: 0.4, modes: [{ f: 3950, a: 0.5, t60: 0.15 }, { f: 6100, a: 0.35, t60: 0.1 }, { f: 8700, a: 0.2, t60: 0.06 }], noise: { a: 0.1, t60: 0.004, cutoff: 8000 } },
  { name: 'ting-brass', dur: 1.2, modes: [{ f: 1870, a: 0.5, t60: 0.9 }, { f: 2940, a: 0.3, t60: 0.6 }, { f: 4710, a: 0.2, t60: 0.4 }, { f: 6420, a: 0.1, t60: 0.25 }], noise: { a: 0.08, t60: 0.004, cutoff: 6000 } },
  { name: 'clack-steel', dur: 0.5, modes: [{ f: 1230, a: 0.45, t60: 0.25 }, { f: 2870, a: 0.3, t60: 0.18 }, { f: 4480, a: 0.15, t60: 0.1 }], noise: { a: 0.2, t60: 0.006, cutoff: 5000 } },
  // a handbell: hum (½), prime (1), minor third (1.2), fifth (1.5), nominal (2), upper partials; tuned to MIDI 84 (C6)
  { name: 'bell-c6', note: 84, fundamental: midi(84), dur: 2.5, modes: [0.5, 1, 1.2, 1.5, 2, 2.5, 3, 4.2].map((r, i) => ({ f: midi(84) * r, a: [0.25, 0.6, 0.3, 0.2, 0.35, 0.12, 0.1, 0.06][i], t60: [2.4, 1.8, 1.2, 1.0, 1.1, 0.6, 0.5, 0.3][i] })), noise: { a: 0.05, t60: 0.003, cutoff: 7000 } },
  // a xylophone bar: partials near 1, 3.93 and 9.2 (a tuned bar), tuned to MIDI 72 (C5)
  { name: 'bar-c5', note: 72, fundamental: midi(72), dur: 1.0, modes: [1, 3.93, 9.2].map((r, i) => ({ f: midi(72) * r, a: [0.7, 0.25, 0.08][i], t60: [0.7, 0.18, 0.06][i] })), noise: { a: 0.15, t60: 0.004, cutoff: 4000 } },
  // demos (src/demos): a music-box comb tooth (a clamped steel tine: cantilever partials 1, 6.27, 17.55), tuned to MIDI 84 (C6)
  { name: 'tine-c6', note: 84, fundamental: midi(84), dur: 1.8, modes: [1, 6.27, 17.55].map((r, i) => ({ f: midi(84) * r, a: [0.75, 0.18, 0.05][i], t60: [1.7, 0.35, 0.08][i] })), noise: { a: 0.04, t60: 0.002, cutoff: 9000 } },
  // a plastic domino striking another: short and bright
  { name: 'clack-domino', dur: 0.18, modes: [{ f: 1260, a: 0.45, t60: 0.05 }, { f: 2650, a: 0.3, t60: 0.04 }, { f: 4120, a: 0.15, t60: 0.025 }], noise: { a: 0.3, t60: 0.006, cutoff: 6000 } },
  // a heavy stone block landing: low, dull, mostly noise
  { name: 'thud-stone', dur: 0.4, modes: [{ f: 85, a: 0.5, t60: 0.16 }, { f: 160, a: 0.35, t60: 0.1 }, { f: 340, a: 0.2, t60: 0.06 }, { f: 720, a: 0.1, t60: 0.03 }], noise: { a: 0.5, t60: 0.03, cutoff: 1500 } },
  // a small glass bead ticking off a steel pin
  { name: 'tick-bead', dur: 0.08, modes: [{ f: 3300, a: 0.4, t60: 0.03 }, { f: 5200, a: 0.25, t60: 0.02 }, { f: 7900, a: 0.12, t60: 0.012 }], noise: { a: 0.15, t60: 0.002, cutoff: 9000 } },
];

// the ragdoll's cartoon sounds: not modal; each is its own generator (sweeps, a spring, formant-synthesised grunts)
const CARTOON: { name: string; dur: number; gen: (t: number, i: number) => number; note?: number }[] = [];
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

function synth(s: Spec): Float32Array {
  const n = Math.round(s.dur * SR), out = new Float32Array(n);
  for (const m of s.modes) { const k = Math.log(1000) / m.t60; for (let i = 0; i < n; i++) { const t = i / SR; out[i] += m.a * Math.exp(-k * t) * Math.sin(2 * Math.PI * m.f * t); } }
  if (s.noise) { // one-pole low-passed noise burst (the strike)
    const k = Math.log(1000) / s.noise.t60, alpha = 1 - Math.exp((-2 * Math.PI * s.noise.cutoff) / SR); let y = 0;
    for (let i = 0; i < n; i++) { y += alpha * (rnd() - y); out[i] += s.noise.a * y * Math.exp((-k * i) / SR); }
  }
  const attack = Math.round(0.001 * SR); for (let i = 0; i < attack; i++) out[i] *= i / attack; // 1 ms attack: no click
  const fade = Math.round(0.02 * SR); for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < n; i++) out[i] *= 0.89 / peak; // −1 dBFS
  return out;
}

function wav(x: Float32Array): Buffer {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + 2 * i);
  return b;
}

/** Strongest spectral peak in [lo, hi] Hz: a Goertzel scan on a 1 Hz grid, refined by parabolic interpolation (over the first 0.5 s). */
function peak(x: Float32Array, lo: number, hi: number) {
  const N = Math.min(x.length, Math.round(0.5 * SR));
  const power = (f: number) => { const w = (2 * Math.PI * f) / SR, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 0; i < N; i++) { const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); const s0 = x[i] * win + c * s1 - s2; s2 = s1; s1 = s0; } return s1 * s1 + s2 * s2 - c * s1 * s2; };
  let best = lo, bp = -1; for (let f = lo; f <= hi; f += 1) { const p = power(f); if (p > bp) { bp = p; best = f; } }
  const [a, b, c] = [power(best - 1), bp, power(best + 1)], d = (a - c) / (2 * (a - 2 * b + c) || 1);
  return best + d;
}

mkdirSync('public/sounds', { recursive: true });
const report: Record<string, unknown>[] = [];
/** Two-pole resonator (a formant): band-pass at f with bandwidth bw, sample by sample. */
function resonator(f: number, bw: number) {
  const r = Math.exp((-Math.PI * bw) / SR), c = 2 * r * Math.cos((2 * Math.PI * f) / SR); let y1 = 0, y2 = 0;
  return { step(x: number, fNow = f) { const cc = 2 * r * Math.cos((2 * Math.PI * fNow) / SR); const y = (1 - r) * x + (fNow === f ? c : cc) * y1 - r * r * y2; y2 = y1; y1 = y; return y; } };
}
/** A grunt: a glottal pulse train (f0 gliding f0a -> f0b) through three formants gliding from vowel A to vowel B, with an envelope. */
function grunt(dur: number, f0a: number, f0b: number, A: number[], B: number[], breath: number) {
  const n = Math.round(dur * SR), out = new Float32Array(n), F = [0, 1, 2].map((k) => resonator(A[k], [90, 110, 160][k]));
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, f0 = f0a + (f0b - f0a) * u;
    phase += f0 / SR; if (phase >= 1) phase -= 1;
    const pulse = phase < 0.4 ? Math.sin((Math.PI * phase) / 0.4) ** 2 : 0; // a rounded glottal pulse
    const src = pulse - 0.25 + breath * rnd();
    let y = 0; for (let k = 0; k < 3; k++) y += [1, 0.6, 0.3][k] * F[k].step(src, A[k] + (B[k] - A[k]) * u);
    const env = Math.min(1, u / 0.06) * Math.min(1, (1 - u) / 0.35);
    out[i] = y * env;
  }
  return out;
}
function finish(out: Float32Array) {
  const fade = Math.round(0.01 * SR); for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < out.length; i++) out[i] *= 0.89 / (peak || 1);
  return out;
}
function tone(dur: number, f: (u: number) => number, env: (u: number) => number, harm = [1, 0.3]) {
  const n = Math.round(dur * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const u = i / n; ph += f(u) / SR; let y = 0; harm.forEach((a, h) => { y += a * Math.sin(2 * Math.PI * (h + 1) * ph); }); out[i] = y * env(u); }
  return out;
}
const RAGDOLL: { name: string; make: () => Float32Array; note?: number; what: string }[] = [
  { name: 'boing', what: 'a spring: 180 Hz with a decaying 15 Hz wobble and a pitch drop', make: () => tone(0.7, (u) => 180 * (1 + 0.35 * Math.exp(-5 * u) * Math.sin(2 * Math.PI * 15 * u * 0.7)) * (1 + 0.5 * Math.exp(-8 * u)), (u) => Math.min(1, u * 60) * Math.exp(-4 * u), [1, 0.5, 0.2]) },
  { name: 'bonk', what: 'a hollow wood block (modes 700, 1650, 2900 Hz)', make: () => synth({ name: 'bonk', dur: 0.3, modes: [{ f: 700, a: 0.6, t60: 0.14 }, { f: 1650, a: 0.3, t60: 0.08 }, { f: 2900, a: 0.15, t60: 0.05 }], noise: { a: 0.25, t60: 0.008, cutoff: 5000 } }) },
  { name: 'thud-body', what: 'a soft heavy body (70 and 140 Hz, low-passed noise)', make: () => synth({ name: 'thud-body', dur: 0.35, modes: [{ f: 70, a: 0.6, t60: 0.15 }, { f: 140, a: 0.35, t60: 0.1 }, { f: 260, a: 0.15, t60: 0.05 }], noise: { a: 0.6, t60: 0.04, cutoff: 800 } }) },
  { name: 'whistle-down', what: 'a slide whistle falling from 1800 to 320 Hz with vibrato', make: () => tone(1.3, (u) => (1800 * Math.pow(320 / 1800, u)) * (1 + 0.012 * Math.sin(2 * Math.PI * 6 * u * 1.3)), (u) => Math.min(1, u * 30) * Math.min(1, (1 - u) * 8), [1, 0.15]) },
  { name: 'power-down', what: 'a motor winding down: 900 to 60 Hz, buzzy', make: () => tone(0.9, (u) => 900 * Math.pow(60 / 900, u ** 0.7), (u) => Math.min(1, u * 40) * (1 - u), [1, 0.5, 0.33, 0.25]) },
  { name: 'power-up', what: 'a motor whirring up: 120 to 1100 Hz, with a blip', make: () => tone(0.55, (u) => 120 * Math.pow(1100 / 120, u ** 1.5), (u) => Math.min(1, u * 20) * Math.min(1, (1 - u) * 6), [1, 0.4, 0.2]) },
  { name: 'boom', what: 'a cartoon explosion: a 60 -> 30 Hz thump and a long low-passed noise roar', make: () => { const n = Math.round(1.6 * SR), out = new Float32Array(n); let y = 0, ph = 0; for (let i = 0; i < n; i++) { const u = i / n; y += 0.02 * (rnd() - y); ph += (60 - 30 * u) / SR; out[i] = (3 * y * Math.exp(-3.5 * u) + 0.8 * Math.sin(2 * Math.PI * ph) * Math.exp(-5 * u)) * Math.min(1, i / (0.004 * SR)); } return out; } },
  // grunts, formant-synthesised (robotic by design); f0 near MIDI 48 (C3, 130.8 Hz) so a page can pitch them per character
  { name: 'oof', note: 48, what: 'grunt "oof": /u/ (F1 300, F2 870, F3 2240), f0 140 -> 100 Hz, breathy tail', make: () => grunt(0.32, 140, 100, [320, 900, 2240], [300, 840, 2200], 0.35) },
  { name: 'ow', note: 48, what: 'grunt "ow": /a/ -> /u/ (F1 730 -> 320, F2 1090 -> 870), f0 170 -> 120 Hz', make: () => grunt(0.42, 170, 120, [730, 1090, 2440], [320, 870, 2240], 0.12) },
  { name: 'ugh', note: 48, what: 'grunt "ugh": /ʌ/ (F1 640, F2 1190, F3 2390), f0 110 -> 90 Hz, creaky', make: () => grunt(0.3, 110, 90, [640, 1190, 2390], [600, 1150, 2350], 0.2) },
];

for (const s of SOUNDS) {
  const x = synth(s);
  writeFileSync(`public/sounds/${s.name}.wav`, wav(x));
  const strongest = peak(x, 60, 10000);
  const r: Record<string, unknown> = { name: s.name, seconds: s.dur, bytes: 44 + 2 * x.length, strongestPeakHz: +strongest.toFixed(1) };
  if (s.fundamental) { const f = peak(x, s.fundamental * 0.95, s.fundamental * 1.05); Object.assign(r, { note: s.note, targetHz: +s.fundamental.toFixed(2), measuredHz: +f.toFixed(2), centsOff: +(1200 * Math.log2(f / s.fundamental)).toFixed(2) }); }
  report.push(r);
}
for (const r of RAGDOLL) {
  const x = finish(r.make());
  writeFileSync(`public/sounds/${r.name}.wav`, wav(x));
  const strongest = peak(x, 50, 6000);
  report.push({ name: r.name, seconds: +(x.length / SR).toFixed(2), bytes: 44 + 2 * x.length, strongestPeakHz: +strongest.toFixed(1), what: r.what, ...(r.note ? { note: r.note } : {}) });
}
void CARTOON;
writeFileSync('evidence/sounds.json', JSON.stringify({ sampleRate: SR, method: 'modal synthesis (sums of damped sinusoids) + low-passed noise strike; peaks measured by Goertzel scan with Hann window', sounds: report }, null, 1));
console.table(report);
