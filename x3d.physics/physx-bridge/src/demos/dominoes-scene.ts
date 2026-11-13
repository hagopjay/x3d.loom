// Draw-a-domino run as X3D: strokes drawn on the table become rows of dominoes (one RigidBody each); a push tips the first one.
// Also the measurement: each domino's fall time (tilt past 20°) gives the toppling wave's speed, compared in the units of the
// dimensional analysis (v/√(gH) against gap/H) with published measurements of real dominoes. Pure: used by the page and in Node.
import { axisAngleToQuat, quatMul, quatRotate } from '../bridge/math.ts';
import type { Quat, Vec3 } from '../bridge/model.ts';
import type { IRBody, MachineIR, SceneMeta } from '../machine/index.ts';
import { viewpoint } from './view.ts';

/** Domino size as in Larham's measurements (height, width, thickness), so the comparison is like for like. Mass of a plastic domino. */
export const H = 0.0516, W = 0.0255, T = 0.0079, MASS = 0.008;
export const TABLE = 1.4;
export const GAP = { min: 0.1, max: 0.85, step: 0.05, initial: 0.45 }; // gap / H
export const MAX_DOMINOES = 450;

/**
 * Larham, "DEMONic Dominoes: Measuring the Speed of the Domino Effect from Sound Recordings" (arXiv:1302.3311, 2013), table 1:
 * vertical dominoes 51.6 × 25.5 × 7.9 mm, d = gap between neighbours. Read from the paper, not measured here.
 */
export const LARHAM: [number, number][] = [[0.04, 1.07], [0.14, 1.33], [0.23, 1.53], [0.33, 1.51], [0.43, 1.47], [0.53, 1.5], [0.62, 1.4], [0.72, 1.33], [0.82, 1.23]];

export interface Stroke { path: [number, number][]; gap: number }
export interface DominoRun { format: 'x3d-physx-dominoes/1'; name: string; strokes: Stroke[]; friction?: number }
export const FRICTION = { min: 0, max: 0.8, step: 0.05, initial: 0.2 };
export interface Domino { x: number; z: number; yaw: number; stroke: number; i: number }

/** Light smoothing (a moving average over ±3 points) then even spacing along the arc: pitch = gap + thickness. */
export function layout(path: [number, number][], gap: number): { x: number; z: number; yaw: number }[] {
  if (path.length < 2) return [];
  const sm = path.map((_, i) => {
    let x = 0, z = 0, n = 0;
    for (let k = Math.max(0, i - 3); k <= Math.min(path.length - 1, i + 3); k++) { x += path[k][0]; z += path[k][1]; n++; }
    return [x / n, z / n] as [number, number];
  });
  sm[0] = path[0]; sm[sm.length - 1] = path[path.length - 1];
  const s = [0];
  for (let i = 1; i < sm.length; i++) s.push(s[i - 1] + Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]));
  const pitch = gap * H + T, total = s[s.length - 1], out: { x: number; z: number; yaw: number }[] = [];
  const at = (d: number): [number, number] => {
    let j = 1; while (j < s.length - 1 && s[j] < d) j++;
    const a = (d - s[j - 1]) / (s[j] - s[j - 1] || 1);
    return [sm[j - 1][0] + a * (sm[j][0] - sm[j - 1][0]), sm[j - 1][1] + a * (sm[j][1] - sm[j - 1][1])];
  };
  for (let d = 0; d <= total + 1e-9; d += pitch) {
    const p = at(d), a = at(Math.max(0, d - pitch / 2)), b = at(Math.min(total, d + pitch / 2));
    out.push({ x: p[0], z: p[1], yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
  }
  return out;
}

/** All dominoes: strokes laid out in order; a domino too close to an earlier one (a branch point, a crossing) is left out. */
export function dominoes(run: DominoRun): Domino[] {
  const out: Domino[] = [];
  run.strokes.forEach((st, k) => {
    let i = 0;
    for (const d of layout(st.path, st.gap)) {
      if (out.length >= MAX_DOMINOES) return;
      if (Math.abs(d.x) > TABLE / 2 - 0.03 || Math.abs(d.z) > TABLE / 2 - 0.03) continue;
      if (out.some((o) => Math.hypot(o.x - d.x, o.z - d.z) < 0.8 * T + 0.35 * W && (o.stroke !== k || Math.abs(o.i - i) > 1))) continue;
      out.push({ ...d, stroke: k, i: i++ });
    }
  });
  return out;
}

/** Colour bands of eight along each row, each row starting on its own colour. */
export const colorOf = (d: Domino) => (d.stroke + Math.floor(d.i / 8)) % 5;

const yawQ = (yaw: number): Quat => axisAngleToQuat(0, 1, 0, yaw);

/** Where each stroke starts: its first domino, unless that stroke begins at another stroke (a branch, which the wave reaches). */
export function starts(run: DominoRun, ds: Domino[]): number[] {
  const out: number[] = [];
  run.strokes.forEach((_, k) => {
    const first = ds.findIndex((d) => d.stroke === k);
    if (first < 0) return;
    const f = ds[first];
    const joined = ds.some((o) => o.stroke !== k && Math.hypot(o.x - f.x, o.z - f.z) < 2.5 * H);
    if (!joined) out.push(first);
  });
  return out;
}

/** The push: tilt a domino forward by `tilt` about its front bottom edge, turning at `rate` rad/s (pose and velocities). */
export function tip(d: Domino, tilt = 0.05, rate = 6): { p: Vec3; q: Quat; v: Vec3; w: Vec3 } {
  const q0 = yawQ(d.yaw), axisW = quatRotate(q0, [1, 0, 0]) as Vec3;
  const pivotL: Vec3 = [0, -H / 2, T / 2], c: Vec3 = [d.x, H / 2, d.z];
  const pivotW = quatRotate(q0, pivotL).map((v, k) => v + c[k]) as Vec3;
  const r = axisAngleToQuat(axisW[0], axisW[1], axisW[2], tilt);
  const arm = quatRotate(r, [c[0] - pivotW[0], c[1] - pivotW[1], c[2] - pivotW[2]]) as Vec3;
  const p: Vec3 = [pivotW[0] + arm[0], pivotW[1] + arm[1], pivotW[2] + arm[2]];
  const w: Vec3 = [axisW[0] * rate, axisW[1] * rate, axisW[2] * rate];
  const v: Vec3 = [w[1] * arm[2] - w[2] * arm[1], w[2] * arm[0] - w[0] * arm[2], w[0] * arm[1] - w[1] * arm[0]];
  return { p, q: quatMul(r, q0), v, w };
}

/** Tilt from the vertical (radians) of a body with quaternion q. */
export const tiltOf = (qx: number, qz: number) => Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (qx * qx + qz * qz))));
export const FALLEN = (20 * Math.PI) / 180;

/**
 * Wave speed along one stroke: least-squares slope of arc position against fall time, over the steady part (after the first five
 * dominoes, which the push accelerates, and before the last three). Null when too few fell.
 */
export function waveSpeed(times: (number | undefined)[], pitch: number): { v: number; n: number } | null {
  const pts: [number, number][] = [];
  times.forEach((t, i) => { if (t !== undefined && i >= 5 && i < times.length - 3) pts.push([t, i * pitch]); });
  if (pts.length < 6) return null;
  const n = pts.length, mt = pts.reduce((a, p) => a + p[0], 0) / n, ms = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0; for (const [t, s] of pts) { num += (t - mt) * (s - ms); den += (t - mt) ** 2; }
  return den > 0 ? { v: num / den, n } : null;
}

// ------------------------------------------------------------------ shapes to draw

const pts = (f: (u: number) => [number, number], n = 240): [number, number][] => Array.from({ length: n + 1 }, (_, k) => f(k / n));
export const PRESETS: Record<string, (gap: number) => DominoRun> = {
  line: (gap) => ({ format: 'x3d-physx-dominoes/1', name: 'Straight line', strokes: [{ path: pts((u) => [0, -0.55 + 1.1 * u], 40), gap }] }),
  spiral: (gap) => ({ format: 'x3d-physx-dominoes/1', name: 'Spiral', strokes: [{ path: pts((u) => { const a = 0.6 + u * 7 * Math.PI, r = 0.06 + 0.07 * (a / (2 * Math.PI)); return [r * Math.cos(a), r * Math.sin(a)]; }, 900), gap }] }),
  fork: (gap) => ({ format: 'x3d-physx-dominoes/1', name: 'Fork', strokes: [
    { path: pts((u) => [0, 0.55 - 0.5 * u], 40), gap },
    { path: pts((u) => [-0.3 * Math.sin((u * Math.PI) / 2), 0.05 - 0.55 * u], 80), gap },
    { path: pts((u) => [0.3 * Math.sin((u * Math.PI) / 2), 0.05 - 0.55 * u], 80), gap },
  ] }),
  heart: (gap) => {
    const heart = (u: number): [number, number] => { const a = Math.PI * u; return [0.022 * 16 * Math.sin(a) ** 3, -0.022 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) + 0.05]; };
    return { format: 'x3d-physx-dominoes/1', name: 'Heart', strokes: [
      { path: pts((u) => [0, 0.58 - 0.18 * u], 30), gap },
      { path: pts((u) => heart(u), 300), gap },
      { path: pts((u) => { const [x, z] = heart(u); return [-x, z]; }, 300), gap },
    ] };
  },
  wave: (gap) => ({ format: 'x3d-physx-dominoes/1', name: 'Sine wave', strokes: [{ path: pts((u) => [0.2 * Math.sin(u * 4 * Math.PI), -0.6 + 1.2 * u], 300), gap }] }),
};

export function sanitizeRun(v: unknown): DominoRun | string {
  const r = v as DominoRun;
  if (!r || r.format !== 'x3d-physx-dominoes/1' || !Array.isArray(r.strokes)) return 'not a domino run description';
  const strokes: Stroke[] = [];
  for (const s of r.strokes.slice(0, 60)) {
    if (!s || !Array.isArray(s.path)) return 'a stroke is malformed';
    const path = s.path.slice(0, 4000).filter((p) => Array.isArray(p) && p.length === 2 && p.every((x) => Number.isFinite(x) && Math.abs(x) < 2)) as [number, number][];
    strokes.push({ path, gap: Math.max(GAP.min, Math.min(GAP.max, Number(s.gap) || GAP.initial)) });
  }
  const friction = Math.max(FRICTION.min, Math.min(FRICTION.max, Number(r.friction ?? FRICTION.initial)));
  return { format: r.format, name: String(r.name ?? 'Dominoes').slice(0, 80), strokes, friction };
}

export function buildDominoes(run: DominoRun): { ir: MachineIR; meta: SceneMeta; ds: Domino[] } {
  const q0: Quat = [0, 0, 0, 1], ds = dominoes(run);
  const bodies: IRBody[] = [
    { def: 'Table', pose: { p: [0, -0.02, 0], q: q0 }, pieceLocal: { p: [0, -0.02, 0], q: q0 }, piece: -1, fixed: true, role: 'board', shapes: [{ def: 'TableTop', geom: { kind: 'box', size: [TABLE, 0.04, TABLE] }, local: { p: [0, 0, 0], q: q0 }, mat: 'felt' }] },
  ];
  ds.forEach((d, k) => {
    const pose = { p: [d.x, H / 2, d.z] as Vec3, q: yawQ(d.yaw) };
    bodies.push({ def: `D${k}`, pose, pieceLocal: pose, piece: -1, fixed: false, mass: MASS, role: 'domino', shapes: [{ def: `D${k}S`, geom: { kind: 'box', size: [W, H, T] }, local: { p: [0, 0, 0], q: q0 }, mat: `domino${colorOf(d)}` }] });
  });
  const ir: MachineIR = {
    bodies, joints: [], clocks: [], chimes: [],
    surface: { bounce: 0, minBounceSpeed: 0.1, friction: run.friction ?? FRICTION.initial },
    // standing dominoes sleep, so a long run costs little until the wave reaches it
    world: { autoDisable: true, disableLinearSpeed: 0.01, disableAngularSpeed: 0.05, disableTime: 0.25, iterations: 12 },
  };
  const meta: SceneMeta = {
    title: run.name,
    description: `A domino run: ${ds.length} dominoes (${(H * 1000).toFixed(1)} × ${(W * 1000).toFixed(1)} × ${(T * 1000).toFixed(1)} mm, ${MASS * 1000} g) in ${run.strokes.length} rows on a felt table. Standard X3D 4.0 RigidBodyPhysics.`,
    info: 'Units: metres, kilograms, seconds, radians. Y up. Push the first domino of each row to start.',
    generator: 'x3d-physx-bridge demos (src/demos/dominoes-scene.ts)',
    shareShapes: true,
    viewpoints: [
      viewpoint('Overview', 'The table', [0, 1.05, 0.95], [0, 0, 0.02]),
      viewpoint('Low', 'Low and close', [0.45, 0.16, 0.5], [0, 0.02, 0]),
      viewpoint('Above', 'From above', [0, 1.6, 0.001], [0, 0, 0]),
    ].join('\n'),
  };
  return { ir, meta, ds };
}
