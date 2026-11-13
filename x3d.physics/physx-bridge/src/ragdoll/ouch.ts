// The Ouch-o-meter: points from real impacts. Each impact event on a ragdoll link scores its impulse (N·s), times a factor for the body
// part (the head counts triple), times a combo multiplier for quick runs of hits; taps under 2 N·s are ignored. The pop-up word follows
// the speed change (impulse over the part's mass, at least 3 kg so light hands and toes do not inflate it). Pure: page and Node.
import { CONTACT_STRIDE } from '../bridge/model.ts';
import type { Vec3 } from '../bridge/model.ts';

export type Part = 'head' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet';
export const PARTS: Part[] = ['head', 'torso', 'arms', 'hands', 'legs', 'feet'];
export const partOf = (segment: string): Part =>
  segment === 'skull' ? 'head' : /upperarm|forearm/.test(segment) ? 'arms' : /carpal/.test(segment) ? 'hands' : /thigh|calf/.test(segment) ? 'legs' : /talus|phalanx/.test(segment) ? 'feet' : 'torso';
const FACTOR: Record<Part, number> = { head: 3, torso: 1, arms: 1.2, hands: 0.8, legs: 1.2, feet: 0.8 };

export const OUCH = { minImpulse: 2, comboWindow: 0.3, maxMultiplier: 3, relink: 0.2 };
/** Pop-up words by severity (speed change, m/s). */
export function wordFor(dv: number, part: Part, k: number): string {
  const pick = (w: string[]) => w[k % w.length];
  if (dv < 1.5) return pick(['tap', 'boop', 'tink']);
  if (dv < 3) return part === 'head' ? pick(['BONK!', 'CONK!']) : pick(['THUD!', 'BUMP!']);
  if (dv < 5) return part === 'head' ? pick(['DONK!', 'BONK!!']) : pick(['OOF!', 'WHAM!']);
  if (dv < 8) return pick(['CRUNCH!', 'KA-RUNCH!', 'SPLAT!']);
  return pick(['KA-BLAM!', 'KER-SPLAT!']);
}

export interface Hit { t: number; link: number; segment: string; part: Part; dv: number; points: number; combo: number; word: string; at: Vec3 }

export class OuchMeter {
  total = 0;
  best = 0;
  combo = 0;
  maxCombo = 0;
  hits = 0;
  readonly byPart: Record<Part, number> = { head: 0, torso: 0, arms: 0, hands: 0, legs: 0, feet: 0 };
  private lastHit = -1e9;
  private readonly lastByLink = new Map<number, number>();
  private readonly links: Map<number, { segment: string; mass: number }>;
  constructor(links: { index: number; segment: string; mass: number }[]) { this.links = new Map(links.map((l) => [l.index, { segment: l.segment, mass: l.mass }])); }

  reset() { this.total = 0; this.combo = 0; this.maxCombo = 0; this.hits = 0; this.lastHit = -1e9; this.lastByLink.clear(); for (const p of PARTS) this.byPart[p] = 0; }

  /** Score a batch of impact events (CONTACT_STRIDE floats each) at simulation time t. */
  feed(events: Float32Array, t: number): Hit[] {
    const out: Hit[] = [];
    for (let o = 0; o < events.length; o += CONTACT_STRIDE) {
      for (const b of [events[o], events[o + 1]]) {
        const L = this.links.get(b);
        if (!L) continue;
        const impulse = events[o + 11], dv = impulse / Math.max(L.mass, 3);
        if (impulse < OUCH.minImpulse || t - (this.lastByLink.get(b) ?? -1e9) < OUCH.relink) continue;
        this.lastByLink.set(b, t);
        this.combo = t - this.lastHit < OUCH.comboWindow ? this.combo + 1 : 1;
        this.lastHit = t;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const part = partOf(L.segment), mult = Math.min(OUCH.maxMultiplier, 1 + 0.25 * (this.combo - 1));
        const points = Math.round(impulse * FACTOR[part] * mult);
        this.total += points; this.byPart[part] += points; this.hits++;
        this.best = Math.max(this.best, this.total);
        out.push({ t, link: b, segment: L.segment, part, dv, points, combo: this.combo, word: wordFor(dv, part, this.hits), at: [events[o + 4], events[o + 5], events[o + 6]] });
      }
    }
    return out;
  }
}
