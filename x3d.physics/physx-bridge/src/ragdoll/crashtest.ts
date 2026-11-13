// Crash-test mode: an impact heat map painted on the figure, and a head score.
//
// Heat map: every body segment carries a virtual accelerometer, as a real crash-test dummy does. Between two state samples the page
// reads the segment's velocity change, |Δv| / Δt in g, and keeps the peak. Each segment has its own PhysicalMaterial (buildHumanoid's
// `heat` option), and the page paints `baseColor` and `emissiveColor` from that peak: one hue family, light to dark, warm yellow to
// deep red. It is a peak, not a sum, as crash-test reports are. A scored hit (from the Ouch-o-meter) also flashes the segment briefly.
//
// Why not the contact impulse? In an articulation, one contact can stop the whole body: the impulse on a thigh can carry all 78 kg of
// momentum. Divided by the thigh's 7.5 kg, that read 141 m/s (measured). The segment's own velocity change is what it actually felt.
//
// Head score: an HIC-style number (head injury criterion) from the skull's samples. HIC over a window [t1, t2] is
// (t2 - t1) · (mean acceleration / g)^2.5, with windows at most 36 ms wide. The page sees velocity, not acceleration, and only at the rate
// state arrives (frame rate). So the mean acceleration over a window is taken as |v(t2) - v(t1)| / (t2 - t1), which is a lower bound.
// When two samples are further apart than 36 ms, some 36 ms window inside them has at least their mean acceleration, so that pair still
// counts, with a 36 ms window. The result is a rough, low reading, good for comparing crashes against each other but not for a real
// injury verdict. It is logged as such.
import { BODY_STRIDE } from '../bridge/model.ts';
import type { Vec3 } from '../bridge/model.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;

/** The heat scale, by peak g, like a thermal camera: untouched segments go cool grey (so a yellow dummy's own colour is not mistaken
 *  for heat), brightening to yellow, then one warm ramp, light to dark: orange, red. Nothing at the cool end but grey. */
export const COLD: Vec3 = [0.74, 0.77, 0.82];
// Stops from measured peaks (Chromium, frame-sampled): a stairs launch 50-70 g, a wrecking-ball hit up to about 200 g, a 26 m/s cannon
// landing about 470 g. Light hands and feet pass 15 g just snapping against their joint limits, so the ramp starts at 10 g.
export const HEAT_STOPS: [number, Vec3][] = [[30, [1, 0.86, 0.22]], [80, [1, 0.45, 0.08]], [200, [0.82, 0.06, 0.05]]];
const START = 10, HOT = HEAT_STOPS[HEAT_STOPS.length - 1][0];
export const HIC_WINDOW = 0.036;
/** The launch itself (a cannon takes the body to 26 m/s in one step) is not a crash: the first 0.12 s after a reset only primes the samples. */
export const ARMING = 0.12;

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The colour for a peak g, starting from the segment's own colour. */
export function heatColor(base: Vec3, g: number): Vec3 {
  const S = HEAT_STOPS;
  if (g <= START) return base;
  if (g < S[0][0]) return mix(base, S[0][1], (g - START) / (S[0][0] - START));
  for (let k = 1; k < S.length; k++) if (g < S[k][0]) return mix(S[k - 1][1], S[k][1], (g - S[k - 1][0]) / (S[k][0] - S[k - 1][0]));
  return S[S.length - 1][1];
}

/** A cartoon reading of the head score. */
export function headWord(hic: number): string {
  return hic < 100 ? 'fine' : hic < 400 ? 'sees stars' : hic < 1000 ? 'sees planets' : 'sees whole galaxies';
}

/** HIC (a lower bound) from velocity samples: the worst window no wider than `win` seconds. */
export function hicFromVelocities(samples: { t: number; v: Vec3 }[], win = HIC_WINDOW): number {
  let best = 0;
  for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
    const dt = samples[j].t - samples[i].t; if (dt <= 1e-6) continue;
    if (dt > win && j > i + 1) break; // only the next sample may be further away than a window
    const a = Math.hypot(samples[j].v[0] - samples[i].v[0], samples[j].v[1] - samples[i].v[1], samples[j].v[2] - samples[i].v[2]) / dt / 9.81;
    best = Math.max(best, Math.min(dt, win) * a ** 2.5);
  }
  return best;
}

interface Seg { link: number; segment: string; mat: SAI; base: Vec3; peak: number; flash: number; v: Vec3 | null }

export class CrashTest {
  on = true;
  hic = 0;
  private readonly segs = new Map<number, Seg>();
  private readonly head: number;
  private hist: { t: number; v: Vec3 }[] = [];
  private lastT = -1;
  private t0 = -1;

  /** `links` as the reader gives them (index, joint, segment); materials are `${prefix}HeatMat_${joint}`. */
  constructor(scene: SAI, prefix: string, links: { index: number; joint: string; segment: string }[]) {
    for (const l of links) {
      let mat: SAI = null;
      try { mat = scene.getNamedNode(`${prefix}HeatMat_${l.joint}`); } catch { /* the root has no shape of its own */ }
      if (!mat) continue;
      const c = mat.baseColor;
      this.segs.set(l.index, { link: l.index, segment: l.segment, mat, base: [c.r, c.g, c.b], peak: 0, flash: 0, v: null });
    }
    this.head = links.find((l) => l.segment === 'skull')?.index ?? -1;
  }

  reset() {
    this.hic = 0; this.hist = []; this.lastT = -1; this.t0 = -1;
    for (const s of this.segs.values()) { s.peak = 0; s.flash = 0; s.v = null; this.paint(s); }
  }

  /** The head's peak, in g. */
  get headG() { return this.segs.get(this.head)?.peak ?? 0; }

  /** A scored hit on a link: a flash, in proportion to its size. */
  hit(link: number, dv: number) {
    const s = this.segs.get(link); if (!s) return;
    s.flash = Math.max(s.flash, Math.min(1, dv / 4));
  }

  /** Every physics batch: each segment's accelerometer, and the head's sample for the HIC. */
  sample(state: ArrayLike<number>, t: number) {
    if (t <= this.lastT) { if (t < this.lastT) this.reset(); return; } // a reload or a replay started over
    const dt = this.lastT < 0 ? 0 : t - this.lastT;
    this.lastT = t;
    if (this.t0 < 0) this.t0 = t;
    const arming = t - this.t0 < ARMING;
    for (const s of this.segs.values()) {
      const o = s.link * BODY_STRIDE, v: Vec3 = [state[o + 7], state[o + 8], state[o + 9]];
      if (!v.every(Number.isFinite)) continue;
      if (s.v && dt > 0 && !arming) {
        const g = Math.hypot(v[0] - s.v[0], v[1] - s.v[1], v[2] - s.v[2]) / dt / 9.81;
        if (g > s.peak) { s.peak = g; this.paint(s); }
      }
      s.v = v;
    }
    const h = this.segs.get(this.head);
    if (h?.v && !arming) {
      this.hist.push({ t, v: h.v });
      while (this.hist.length > 2 && t - this.hist[1].t > HIC_WINDOW) this.hist.shift();
      this.hic = Math.max(this.hic, hicFromVelocities(this.hist));
    }
  }

  /** Every frame: fade the flashes. */
  tick(dt: number) {
    for (const s of this.segs.values()) if (s.flash > 0) { s.flash = Math.max(0, s.flash - dt * 2.5); this.paint(s); }
  }

  show(on: boolean) { this.on = on; for (const s of this.segs.values()) this.paint(s); }

  /** Peak g per segment, worst first (for the panel). */
  worst(n = 3) { return [...this.segs.values()].filter((s) => s.peak > 0).sort((a, b) => b.peak - a.peak).slice(0, n).map((s) => ({ segment: s.segment, g: s.peak })); }

  private paint(s: Seg) {
    try {
      const X3D = (globalThis as SAI).X3D; // the browser's X_ITE global (this module also loads in Node, for the HIC maths)
      const c = this.on ? heatColor(COLD, s.peak) : s.base, hot = this.on ? Math.min(1, s.peak / HOT) : 0, f = this.on ? s.flash : 0;
      s.mat.baseColor = new X3D.SFColor(...c);
      s.mat.emissiveColor = new X3D.SFColor(Math.min(1, 0.35 * hot + 0.7 * f), Math.min(1, 0.04 * hot + 0.45 * f), 0.1 * f);
    } catch { /* the scene is gone */ }
  }
}
