// The physics music box as X3D: a pinned drum turned by a TimeSensor + OrientationInterpolator (kinematic in PhysX) lifts one hammer
// per note; when a peg slips past a hammer's foot the hammer falls under gravity onto its tuned bar, and the impact plays the note.
// Pegs are CollidableShapes on the drum; every grid cell has one, switched with CollidableShape.enabled (live, no reload) and
// shown with a Switch. Pure: imported by the page and by the Node tuner (tools/musicbox-sim.ts).
import { axisAngleToQuat } from '../bridge/math.ts';
import type { Quat, Vec3 } from '../bridge/model.ts';
import type { IRBody, IRClock, IRJoint, IRShape, MachineIR, SceneMeta } from '../machine/index.ts';
import { viewpoint } from './view.ts';

export const STEPS = 16;
/** C major over an octave and a third (C5 to E6): any tune in C fits, and the bars stay few enough to read. */
export const NOTES = [72, 74, 76, 77, 79, 81, 83, 84, 86, 88];
export const NOTE_NAMES = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6'];

export interface MusicBox {
  format: 'x3d-physx-musicbox/1';
  name: string;
  /** Beats per minute; one grid step is an eighth note. */
  tempo: number;
  /** One string per note (low to high), STEPS characters each: 'x' = peg. */
  grid: string[];
}

// geometry (metres): drum axis along X at height Y0; hammers pivot behind the drum (−z) and strike bars in front (+z)
export const R = 0.045, Y0 = 0.12, PITCH = 0.028;
/** Square-edged pins: the foot rides up the leading corner and drops off the trailing edge at once, so strikes are even at any tempo. */
const PEG: Vec3 = [0.006, 0.007, 0.005], PEG_AT = R + 0.0025;
/** Where the hammer feet ride: the drum's front-upper quadrant (angle from +y toward +z); the surface there moves upward. */
export const FOOT_ANGLE = (35 * Math.PI) / 180;
const FOOT_R = 0.003, FOOT_GAP = 0.0015;
const PIVOT: [number, number] = [0.184, -0.04]; // (y, z)
const HEAD_Z = 0.095, HEAD_R = 0.006, ARM = 0.004;
const HAMMER_MASS = 0.012;
export const TEMPO = { min: 60, max: 200, step: 10 };

export const noteX = (i: number) => (i - (NOTES.length - 1) / 2) * PITCH;
/** Seconds per drum revolution. */
export const cycle = (tempo: number) => (STEPS * 60) / tempo / 2;
/** Peg angle on the drum (drum frame, from +y toward +z) for grid column s: column s reaches the feet at s/STEPS of a turn. */
export const pegAngle = (s: number) => FOOT_ANGLE + (2 * Math.PI * (s + 0.5)) / STEPS;

const q0: Quat = [0, 0, 0, 1];
const aboutX = (a: number): Quat => axisAngleToQuat(1, 0, 0, a);
const aboutZ = (a: number): Quat => axisAngleToQuat(0, 0, 1, a);

export function emptyBox(): MusicBox { return { format: 'x3d-physx-musicbox/1', name: 'Music box', tempo: 120, grid: NOTES.map(() => '.'.repeat(STEPS)) }; }

/** Melodies as one note index per step (-1 rest), and chords as lists. */
function fromSteps(name: string, tempo: number, steps: (number | number[])[]): MusicBox {
  const g = NOTES.map(() => Array(STEPS).fill('.'));
  steps.forEach((n, s) => { for (const k of Array.isArray(n) ? n : [n]) if (k >= 0) g[k][s] = 'x'; });
  return { format: 'x3d-physx-musicbox/1', name, tempo, grid: g.map((r) => r.join('')) };
}
// traditional and public-domain melodies (in C, one eighth-note step each)
export const PRESETS: Record<string, () => MusicBox> = {
  twinkle: () => fromSteps('Twinkle, twinkle', 110, [[0, 7], 0, 4, 4, [5, 9], 5, 4, -1, [3, 8], 3, 2, 2, [1, 6], 1, 0, -1]),
  ode: () => fromSteps('Ode to Joy', 120, [[2, 7], 2, 3, 4, [4, 9], 3, 2, 1, [0, 7], 0, 1, 2, [2, 9], -1, 1, 1]),
  arpeggio: () => fromSteps('Arpeggios', 150, [0, 2, 4, 7, 9, 7, 4, 2, 1, 3, 5, 8, 5, 3, 1, [0, 4, 7]]),
  random: () => {
    let seed = Math.floor(Math.random() * 2 ** 31);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const penta = [0, 1, 2, 4, 5, 7, 8, 9]; // C D E G A C D E: no wrong notes
    const steps = Array.from({ length: STEPS }, (_, s) => (rnd() < (s % 4 === 0 ? 0.95 : 0.6) ? [penta[Math.floor(rnd() * penta.length)], ...(s % 8 === 0 ? [0] : [])] : -1));
    return fromSteps('Pentatonic dice', 130, steps);
  },
};

export function sanitizeBox(v: unknown): MusicBox | string {
  const m = v as MusicBox;
  if (!m || m.format !== 'x3d-physx-musicbox/1') return 'not a music box description';
  if (!Array.isArray(m.grid) || m.grid.length !== NOTES.length || m.grid.some((r) => typeof r !== 'string' || r.length !== STEPS || /[^.x]/.test(r))) return 'the peg grid is malformed';
  const tempo = Math.round(Math.max(TEMPO.min, Math.min(TEMPO.max, Number(m.tempo) || 120)));
  return { format: m.format, name: String(m.name ?? 'Music box').slice(0, 80), tempo, grid: [...m.grid] };
}

export const pegDef = (note: number, s: number) => `Peg${note}_${s}`;

export function buildMusicBox(m: MusicBox, o: { allPegs?: boolean } = {}): { ir: MachineIR; meta: SceneMeta } {
  const bodies: IRBody[] = [], joints: IRJoint[] = [], clocks: IRClock[] = [];
  const body = (def: string, p: Vec3, shapes: IRShape[], x: Partial<IRBody> = {}) => bodies.push({ def, pose: { p, q: q0 }, pieceLocal: { p, q: q0 }, piece: -1, fixed: true, shapes, ...x });
  const box = (def: string, size: Vec3, p: Vec3, mat: string, q: Quat = q0): IRShape => ({ def, geom: { kind: 'box', size }, local: { p, q }, mat });
  const W = NOTES.length * PITCH + 0.04;

  // base and cheeks (static)
  body('Base', [0, 0.01, 0], [box('BaseS', [W + 0.08, 0.02, 0.32], [0, 0, 0], 'wood')], { role: 'board' });
  body('CheekL', [-W / 2 - 0.02, Y0 / 2 + 0.03, 0], [box('CheekLS', [0.012, Y0 + 0.04, 0.12], [0, 0, 0], 'frame')], { role: 'board' });
  body('CheekR', [W / 2 + 0.02, Y0 / 2 + 0.03, 0], [box('CheekRS', [0.012, Y0 + 0.04, 0.12], [0, 0, 0], 'frame')], { role: 'board' });
  // hammer pivot rod and rail posts
  body('PivotRod', [0, PIVOT[0], PIVOT[1]], [{ def: 'PivotRodS', geom: { kind: 'cylinder', r: 0.003, h: W + 0.03 }, local: { p: [0, 0, 0], q: aboutZ(Math.PI / 2) }, mat: 'steel' }], { role: 'board' });
  for (const sx of [-1, 1]) body(`Post${sx > 0 ? 'R' : 'L'}`, [sx * (W / 2 + 0.008), (PIVOT[0] + 0.02) / 2, PIVOT[1]], [box(`Post${sx > 0 ? 'R' : 'L'}S`, [0.01, PIVOT[0] + 0.0, 0.012], [0, 0, 0], 'frame')], { role: 'board' });

  // the drum: barrel + one peg per grid cell (enabled where the grid has one)
  const drumShapes: IRShape[] = [{ def: 'Barrel', geom: { kind: 'cylinder', r: R, h: NOTES.length * PITCH + 0.01 }, local: { p: [0, 0, 0], q: aboutZ(Math.PI / 2) }, mat: 'brass' }];
  NOTES.forEach((_, i) => {
    for (let s = 0; s < STEPS; s++) {
      const on = m.grid[i][s] === 'x';
      if (!on && !o.allPegs) continue;
      const a = pegAngle(s);
      drumShapes.push({ def: pegDef(i, s), geom: { kind: 'box', size: PEG }, local: { p: [noteX(i), PEG_AT * Math.cos(a), PEG_AT * Math.sin(a)], q: aboutX(a) }, mat: 'steel', enabled: on, switchable: !!o.allPegs });
    }
  });
  body('Drum', [0, Y0, 0], drumShapes, { role: 'drum' });
  const T = cycle(m.tempo), K = 8;
  clocks.push({ def: 'Crank', cycle: T, body: 'Drum', keys: Array.from({ length: K + 1 }, (_, k) => k / K), rotations: Array.from({ length: K + 1 }, (_, k) => aboutX((-2 * Math.PI * k) / K)) });

  // hammers: arm from the pivot to the head, a foot riding the drum, a brass head resting on the bar
  const footD = R + FOOT_GAP + FOOT_R, fy = Y0 + footD * Math.cos(FOOT_ANGLE), fz = footD * Math.sin(FOOT_ANGLE);
  const armY = PIVOT[0], armLen = HEAD_Z - PIVOT[1], armZ = (HEAD_Z + PIVOT[1]) / 2;
  const headY = armY - 0.006, barTop = headY - HEAD_R;
  NOTES.forEach((note, i) => {
    const x = noteX(i), def = `Hammer${i}`;
    // body frame at the arm's centre; shapes relative to it
    const c: Vec3 = [x, armY, armZ];
    bodies.push({
      def, pose: { p: c, q: q0 }, pieceLocal: { p: c, q: q0 }, piece: -1, fixed: false, mass: HAMMER_MASS, role: 'hammer',
      shapes: [
        box(`${def}Arm`, [ARM, ARM, armLen], [0, 0, 0], 'wood'),
        box(`${def}Strut`, [ARM, armY - fy, ARM], [0, (fy - armY) / 2, fz - armZ], 'wood'),
        { def: `${def}Foot`, geom: { kind: 'sphere', r: FOOT_R }, local: { p: [0, fy - armY, fz - armZ], q: q0 }, mat: 'ivory' },
        { def: `${def}Head`, geom: { kind: 'sphere', r: HEAD_R }, local: { p: [0, headY - armY, HEAD_Z - armZ], q: q0 }, mat: 'brass' },
      ],
    });
    joints.push({ type: 'SingleAxisHingeJoint', def: `${def}Hinge`, body1: def, body2: 'PivotRod', fields: { anchorPoint: [x, PIVOT[0], PIVOT[1]], axis: [1, 0, 0], minAngle: -0.1, maxAngle: 0.05, stopBounce: 0, stopErrorCorrection: 0.8 } }); // the check rail: hammers lift at most 0.1 rad
    // the bar: longer for lower notes (a glockenspiel's graduation), its striking point under the head
    const len = 0.11 - 0.005 * i;
    body(`Bar${i}`, [x, barTop - 0.003, HEAD_Z + len / 2 - 0.02], [box(`Bar${i}S`, [0.02, 0.006, len], [0, 0, 0], `bar${i % 5}`)], { role: 'chime', note });
  });
  // the bar stand: two felt-topped rails under the bars, on four legs
  const railY = barTop - 0.006 - 0.004;
  for (const [k, z] of [[0, HEAD_Z - 0.012], [1, HEAD_Z + 0.045]] as const) {
    body(`Rail${k}`, [0, railY, z], [box(`Rail${k}S`, [W, 0.008, 0.008], [0, 0, 0], 'felt')], { role: 'board' });
    for (const sx of [-1, 1]) body(`Leg${k}${sx > 0 ? 'R' : 'L'}`, [sx * (W / 2 - 0.004), (railY - 0.004 + 0.02) / 2, z], [box(`Leg${k}${sx > 0 ? 'R' : 'L'}S`, [0.008, railY - 0.004 - 0.02, 0.008], [0, 0, 0], 'frame')], { role: 'board' });
  }

  const ir: MachineIR = { bodies, joints, clocks, surface: { bounce: 0.1, minBounceSpeed: 0.05, friction: 0.3 }, chimes: [] };
  const meta: SceneMeta = {
    title: m.name,
    description: `A physics music box: a pinned drum (TimeSensor + OrientationInterpolator, kinematic) lifts ${NOTES.length} hammers on SingleAxisHingeJoints; each falls on its tuned bar. ${m.grid.join('').split('x').length - 1} pegs, ${m.tempo} BPM.`,
    info: 'Units: metres, kilograms, seconds, radians. Y up. Drum axis along X; hammers pivot behind it.',
    generator: 'x3d-physx-bridge demos (src/demos/musicbox-scene.ts)',
    viewpoints: [
      viewpoint('Front', 'Over the drum', [-0.27, 0.42, -0.48], [0, 0.13, 0.03]),
      viewpoint('Side', 'Side: the mechanism', [0.5, 0.19, 0.02], [0, 0.16, 0.02], 0.55),
      viewpoint('Top', 'Bars', [0.12, 0.4, 0.42], [0, 0.15, 0.05]),
    ].join('\n'),
  };
  return { ir, meta };
}
