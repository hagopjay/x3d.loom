// Contact sound: impact events from the bridge -> X3D 4.0 SpatialSound voices (AudioClip sources synthesised by tools/make-sounds.ts).
// The sample follows the pair of materials, the loudness the impulse, the position the contact point, the pitch the chime's note.
import { CONTACT_STRIDE } from '../bridge/model.ts';
import type { MachineIR } from '../machine/index.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;

export const SAMPLES = ['knock-wood', 'clink-glass', 'ting-brass', 'clack-steel', 'bell-c6', 'bar-c5'];
/** Samples recorded at a MIDI note (the others are unpitched). */
export const BASE_NOTE: Record<string, number> = { 'bell-c6': 84, 'bar-c5': 72, 'tine-c6': 84, oof: 48, ow: 48, ugh: 48 };

/** One impact: body and shape indices of both sides. A page's `pick` maps it to a sample and a MIDI note (or null: silent). */
export interface ImpactPair { b1: number; b2: number; s1: number; s2: number; impulse: number }
export type PickSample = (e: ImpactPair) => { sample: string; note?: number } | null;
const sampleForMaterial = (mat: string) =>
  /^(wood|ivory|ebony|frame|pegboard)$/.test(mat) ? 'knock-wood' : mat === 'brass' ? 'ting-brass' : /^(steel|red|blue)$/.test(mat) ? 'clack-steel' : 'clink-glass';

export class ImpactSound {
  enabled = true;
  volume = 0.8;
  triggered = 0;
  skipped = 0;
  readonly nonFinite: unknown[] = [];
  private readonly X3D: SAI;
  private readonly voices: Map<string, { voice: SAI; clip: SAI }[]>;
  private readonly next = new Map<string, number>();
  private readonly shapeMat: string[] = [];
  private readonly bodyRole: (string | undefined)[];
  private readonly bodyNote: (number | undefined)[];
  private readonly bodyChimeKind: (string | undefined)[];

  private readonly pick: PickSample | null;
  private readonly loud: (impulse: number) => number;

  /**
   * `samples` must match the voices the scene was generated with (toX3D `sound`). Without `pick`, the Marble Machine's rules apply.
   * `impulseRange` maps impulses (N·s) to loudness over [quiet, loud] on a log scale (default 2e-5 to 2e-2: marbles).
   */
  constructor(X3D: SAI, scene: SAI, ir: MachineIR, voices: number, o: { samples?: string[]; pick?: PickSample; impulseRange?: [number, number] } = {}) {
    this.X3D = X3D;
    this.pick = o.pick ?? null;
    const [lo, hi] = o.impulseRange ?? [2e-5, 2e-2];
    this.loud = (i) => Math.max(0, Math.min(1, Math.log10(i / lo) / Math.log10(hi / lo))) ** 1.3;
    for (const b of ir.bodies) for (const s of b.shapes) this.shapeMat.push(s.mat);
    this.bodyRole = ir.bodies.map((b) => b.role);
    this.bodyNote = ir.bodies.map((b) => b.note);
    this.bodyChimeKind = ir.bodies.map((b) => (b.role === 'chime' ? (b.def.includes('Bell') ? 'bell-c6' : 'bar-c5') : undefined));
    this.voices = new Map((o.samples ?? SAMPLES).map((smp) => [smp, Array.from({ length: voices }, (_, k) => ({
      voice: scene.getNamedNode(`Voice_${smp.replace(/-/g, '_')}_${k}`), clip: scene.getNamedNode(`Clip_${smp.replace(/-/g, '_')}_${k}`),
    }))]));
  }

  /** Map an impulse (N·s) to 0..1 over three decades: 2e-5 (a tap) to 2e-2 (a hard hit). */
  static loudness(impulse: number) { return Math.max(0, Math.min(1, Math.log10(impulse / 2e-5) / 3)) ** 1.3; }

  handle(events: Float32Array, maxPerFrame = 10) {
    if (!this.enabled || !events.length) return;
    // loudest first
    const idx: number[] = [];
    for (let o = 0; o < events.length; o += CONTACT_STRIDE) idx.push(o);
    idx.sort((a, b) => events[b + 11] - events[a + 11]);
    const now = Date.now() / 1000;
    for (const o of idx.slice(0, maxPerFrame)) {
      const b1 = events[o], b2 = events[o + 1], s1 = events[o + 2], s2 = events[o + 3];
      // a chime rings with its own note; otherwise the sample follows the other material (marble on wood, brass, steel, glass)
      const chime = this.bodyChimeKind[b1] ? b1 : this.bodyChimeKind[b2] ? b2 : -1;
      let smp: string, note = 0;
      if (this.pick) {
        const r = this.pick({ b1, b2, s1, s2, impulse: events[o + 11] });
        if (!r) continue;
        smp = r.sample; note = r.note !== undefined && BASE_NOTE[smp] !== undefined ? r.note - BASE_NOTE[smp] : 0;
      } else if (chime >= 0) { smp = this.bodyChimeKind[chime]!; note = (this.bodyNote[chime] ?? BASE_NOTE[smp]) - BASE_NOTE[smp]; }
      else {
        const other = this.bodyRole[b1] === 'marble' ? s2 : s1;
        smp = sampleForMaterial(this.shapeMat[other] ?? 'wood');
      }
      const pool = this.voices.get(smp);
      if (!pool) continue;
      let v = -1;
      for (let k = 0; k < pool.length; k++) { const j = ((this.next.get(smp) ?? 0) + k) % pool.length; if (!pool[j].clip.isActive) { v = j; break; } }
      if (v < 0) { this.skipped++; continue; }
      this.next.set(smp, v + 1);
      const { voice, clip } = pool[v];
      const loc = [events[o + 4], events[o + 5], events[o + 6]], inten = this.volume * this.loud(events[o + 11]), pitch = 2 ** (note / 12);
      if (![...loc, inten, pitch].every(Number.isFinite)) { this.nonFinite.push({ smp, loc, inten, pitch, impulse: events[o + 11] }); continue; }
      voice.location = new this.X3D.SFVec3f(loc[0], loc[1], loc[2]);
      voice.intensity = inten;
      clip.pitch = pitch;
      clip.startTime = now;
      this.triggered++;
    }
  }
}

/** Browsers start audio only after a user gesture: remember every AudioContext X_ITE creates and resume them on the next gesture. */
export function resumeAudioOnGesture() {
  const W = window as unknown as { AudioContext: typeof AudioContext; __audioContexts?: AudioContext[] };
  const Orig = W.AudioContext;
  if (!Orig || W.__audioContexts) return;
  const list: AudioContext[] = (W.__audioContexts = []);
  W.AudioContext = class extends Orig { constructor(o?: AudioContextOptions) { super(o); list.push(this); } } as typeof AudioContext;
  const resume = () => { for (const c of list) if (c.state === 'suspended') void c.resume(); };
  addEventListener('pointerdown', resume, true); addEventListener('keydown', resume, true);
}
