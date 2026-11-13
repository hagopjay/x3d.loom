// An original crash-test dummy as a standard H-Anim 2.0 humanoid (LOA 1, BASIC skeleton with H-Anim's default joint centres), written
// both as X3D (HAnimHumanoid, HAnimJoint, HAnimSegment with rigid segment geometry) and as the bridge's HumanoidModel. The physics lives
// in H-Anim's own fields: segment mass, joint llimit/ulimit (per-axis, radians, in the humanoid frame) and stiffness. Pure: page and Node.
// Axes (H-Anim): +x is the figure's left, +y up, +z forward.
import { LOA1 } from './hanim-loa1.ts';
import { axisAngleToQuat, quatFromTo, quatToAxisAngle } from '../bridge/math.ts';
import type { HumanoidModel, LinkModel, Pose, Quat, ShapeModel, Vec3 } from '../bridge/model.ts';
import { cylinderPoints } from '../bridge/math.ts';

/** dummy: the crash-test dummy; cartoon: a bendy cartoon person; toon: the crash-test dummy's colours with the cartoon's eyes and body. */
export type Character = 'dummy' | 'cartoon' | 'toon';

type Prim = { kind: 'capsule'; a: Vec3; b: Vec3; r: number } | { kind: 'box'; c: Vec3; size: Vec3 } | { kind: 'sphere'; c: Vec3; r: number };
interface SegmentSpec { mass: number; prims: Prim[]; mat: string; ll: number[]; ul: number[]; stiffness?: Vec3 }

const C = Object.fromEntries(LOA1.map((r) => [r.joint, r.center])) as Record<string, Vec3>;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const LOCK = [0, 0, 0];

/**
 * Per joint: the segment it carries, its mass (kg; 78 kg in total, after Winter's anthropometric fractions), its shapes, and its limits
 * (x: flex and extend in the sagittal plane, y: twist about the vertical, z: sideways; equal lower and upper values lock an axis).
 */
function specs(): Record<string, SegmentSpec> {
  const side = (s: 1 | -1) => {
    const p = s > 0 ? 'l' : 'r';
    const ankle = C[`${p}_talocrural`], toe = C[`${p}_metatarsophalangeal_2`];
    return {
      [`${p}_hip`]: { mass: 7.5, mat: 'dummy', prims: [{ kind: 'capsule', a: C[`${p}_hip`], b: C[`${p}_knee`], r: 0.072 }], ll: [-1.8, -0.6, s > 0 ? -0.3 : -1.0], ul: [0.5, 0.6, s > 0 ? 1.0 : 0.3] },
      [`${p}_knee`]: { mass: 3.5, mat: 'dummy', prims: [{ kind: 'capsule', a: C[`${p}_knee`], b: ankle, r: 0.055 }], ll: [0, 0, 0], ul: [2.4, 0, 0] },
      [`${p}_talocrural`]: { mass: 1.0, mat: 'dummyDark', prims: [{ kind: 'box', c: [ankle[0], 0.036, (ankle[2] - 0.035 + toe[2]) / 2], size: [0.09, 0.072, toe[2] - ankle[2] + 0.035] }], ll: [-0.6, -0.2, -0.3], ul: [0.8, 0.2, 0.3] },
      [`${p}_metatarsophalangeal_2`]: { mass: 0.15, mat: 'dummyDark', prims: [{ kind: 'box', c: [toe[0], 0.018, toe[2] + 0.03], size: [0.09, 0.036, 0.058] }], ll: [-0.5, 0, 0], ul: [0.8, 0, 0] },
      [`${p}_shoulder`]: { mass: 2.1, mat: 'dummy', prims: [{ kind: 'capsule', a: C[`${p}_shoulder`], b: C[`${p}_elbow`], r: 0.05 }], ll: [-2.6, -1.4, s > 0 ? -0.4 : -2.6], ul: [0.9, 1.4, s > 0 ? 2.6 : 0.4] },
      [`${p}_elbow`]: { mass: 1.3, mat: 'dummy', prims: [{ kind: 'capsule', a: C[`${p}_elbow`], b: C[`${p}_radiocarpal`], r: 0.042 }], ll: [-2.6, 0, 0], ul: [0, 0, 0] },
      [`${p}_radiocarpal`]: { mass: 0.45, mat: 'dummyDark', prims: [{ kind: 'box', c: add(C[`${p}_radiocarpal`], [0, -0.09, 0]), size: [0.04, 0.17, 0.09] }], ll: [-1.2, 0, -0.4], ul: [1.2, 0, 0.4] },
    } as Record<string, SegmentSpec>;
  };
  return {
    humanoid_root: { mass: 2, mat: 'dummy', prims: [], ll: [0, 0, 0], ul: [0, 0, 0] }, // X3D's default limits: the root has no inbound joint // the sacrum: no shape of its own (the thighs pass close by)
    sacroiliac: { mass: 10, mat: 'dummy', prims: [{ kind: 'box', c: [0, 0.95, -0.005], size: [0.3, 0.15, 0.2] }], ll: LOCK, ul: LOCK },
    vl5: { mass: 30, mat: 'dummy', prims: [{ kind: 'box', c: [0, 1.27, -0.04], size: [0.3, 0.42, 0.21] }], ll: [-0.4, -0.6, -0.5], ul: [0.9, 0.6, 0.5] },
    skullbase: { mass: 5.5, mat: 'dummy', prims: [{ kind: 'capsule', a: add(C.skullbase, [0, 0.0, 0]), b: add(C.skullbase, [0, 0.03, 0]), r: 0.045 }, { kind: 'sphere', c: add(C.skullbase, [0, 0.13, 0.02]), r: 0.11 }], ll: [-0.7, -1.2, -0.6], ul: [0.8, 1.2, 0.6] },
    ...side(1), ...side(-1),
  };
}

const n = (x: number) => { const r = +x.toPrecision(6); return Object.is(r, -0) ? '0' : String(r); };
const v = (a: ArrayLike<number>) => Array.from(a, n).join(' ');

export interface BuiltHumanoid { x3d: string; model: Omit<HumanoidModel, 'links'> & { links: Omit<LinkModel, 'index'>[] }; def: string; materials: string[] }

/** Build the humanoid at `pose` (its feet on y = 0 in its own frame). `prefix` makes DEF names unique per character. */
export function buildHumanoid(o: { def: string; character: Character; pose: Pose; prefix?: string; /** HAnimJoint stiffness on every joint (0 limp, 1 holds the pose) */ stiffness?: number; /** one material per segment (`${prefix}HeatMat_${joint}`) for the crash-test heat map */ heat?: boolean }): BuiltHumanoid {
  const S = specs(), pre = o.prefix ?? 'hanim_';
  const toonish = o.character === 'cartoon' || o.character === 'toon';
  if (toonish) { // the cartoon person (and the toon dummy): lighter (60 kg) and bendier (limits ×1.35, at most ±2.6 rad: wider sent the spherical joints to NaN, logged), with big eyes
    for (const k of Object.keys(S)) {
      const sp = S[k]; sp.mass *= 0.77;
      sp.ll = sp.ll.map((x, i) => (x === sp.ul[i] ? x : Math.max(-2.6, x * 1.35))); sp.ul = sp.ul.map((x, i) => (x === sp.ll[i] ? x : Math.min(2.6, x * 1.35)));
    }
    const head = add(C.skullbase, [0, 0.13, 0.02]);
    for (const sx of [1, -1]) S.skullbase.prims.push({ kind: 'sphere', c: add(head, [sx * 0.045, 0.03, 0.085]), r: 0.035 });
  }
  const links: Omit<LinkModel, 'index'>[] = [];
  const byJoint = new Map<string, number>();
  let shapeNo = 0;
  const segX3D = new Map<string, string>();
  const used = new Set<string>();
  const shared = (mat: string) => { if (used.has(mat)) return `<Appearance USE="${pre}Mat_${mat}"/>`; used.add(mat); return `<Appearance DEF="${pre}Mat_${mat}">${MATS[o.character][mat]}</Appearance>`; };
  let app = shared;
  for (const row of LOA1) {
    const sp = S[row.joint];
    if (o.heat) { // the segment's own body colour gets its own material; eyes, pupils and bolts stay shared
      const def = `${pre}Heat_${row.joint}`;
      let made = false;
      app = (mat: string) => {
        if (mat !== sp.mat) return shared(mat);
        if (made) return `<Appearance USE="${def}"/>`;
        made = true;
        return `<Appearance DEF="${def}">${MATS[o.character][mat].replace('<PhysicalMaterial', `<PhysicalMaterial DEF="${pre}HeatMat_${row.joint}"`)}</Appearance>`;
      };
    }
    const shapes: ShapeModel[] = [], vis: string[] = [];
    for (const p of sp.prims) {
      if (p.kind === 'box') {
        shapes.push({ def: `${pre}${row.segment}_${shapeNo++}`, local: { p: p.c, q: [0, 0, 0, 1] }, geom: { kind: 'box', half: [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2] }, enabled: true });
        vis.push(`<Transform translation="${v(p.c)}"><Shape>${app(sp.mat)}<Box size="${v(p.size)}"/></Shape></Transform>`);
      } else if (p.kind === 'sphere') {
        const mat = toonish && row.joint === 'skullbase' && p.r < 0.04 ? 'eye' : sp.mat;
        shapes.push({ def: `${pre}${row.segment}_${shapeNo++}`, local: { p: p.c, q: [0, 0, 0, 1] }, geom: { kind: 'sphere', radius: p.r }, enabled: true });
        vis.push(`<Transform translation="${v(p.c)}"><Shape>${app(mat)}<Sphere radius="${n(p.r)}"/></Shape></Transform>`);
      } else {
        const d: Vec3 = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]], h = Math.hypot(...d), c: Vec3 = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2];
        const q = quatFromTo([0, 1, 0], d), rot = quatToAxisAngle(q);
        // as the bridge reads it back from the X3D: a Cylinder (24-sided hull) and a Sphere at each end
        shapes.push({ def: `${pre}${row.segment}_${shapeNo++}`, local: { p: c, q }, geom: { kind: 'convex', points: cylinderPoints(p.r, h, 24), from: 'Cylinder (24-sided hull)' }, enabled: true });
        for (const e of [p.b, p.a]) shapes.push({ def: `${pre}${row.segment}_${shapeNo++}`, local: { p: e, q }, geom: { kind: 'sphere', radius: p.r }, enabled: true });
        vis.push(`<Transform translation="${v(c)}"${rot[3] ? ` rotation="${v(rot)}"` : ''}><Shape>${app(sp.mat)}<Cylinder radius="${n(p.r)}" height="${n(h)}"/></Shape><Transform translation="0 ${n(h / 2)} 0"><Shape>${app(sp.mat)}<Sphere radius="${n(p.r)}"/></Shape></Transform><Transform translation="0 ${n(-h / 2)} 0"><Shape>${app(sp.mat)}<Sphere radius="${n(p.r)}"/></Shape></Transform></Transform>`);
      }
    }
    // the cartoon's pupils (visual only, inside the eyes)
    if (toonish && row.joint === 'skullbase') for (const sx of [1, -1]) vis.push(`<Transform translation="${v(add(C.skullbase, [sx * 0.045, 0.16, 0.135]))}"><Shape>${app('pupil')}<Sphere radius="0.015"/></Shape></Transform>`);
    // a dark ball at each joint (the dummy's bolts); inside the limb's ends, so it changes nothing physically
    if (row.parent) {
      vis.push(`<Transform translation="${v(row.center)}"><Shape>${app('joint')}<Sphere radius="0.028"/></Shape></Transform>`);
      shapes.push({ def: `${pre}${row.segment}_${shapeNo++}`, local: { p: row.center, q: [0, 0, 0, 1] }, geom: { kind: 'sphere', radius: 0.028 }, enabled: true });
    }
    const com = centroid(sp.prims, row.center);
    // the spec's locked axes (equal limits) become a ±0.002 rad range: X3D reads equal limits as "no limit" (its default is 0 0 0)
    const ll = sp.ll.map((x, i) => (row.parent && x === sp.ul[i] ? x - 0.002 : x));
    const ul = sp.ul.map((x, i) => (row.parent && sp.ll[i] === x ? x + 0.002 : x));
    links.push({
      segment: row.segment, joint: row.joint, parent: row.parent ? byJoint.get(row.parent)! : -1, center: row.center,
      mass: sp.mass, centerOfMass: com, inertia: [0, 0, 0, 0, 0, 0, 0, 0, 0], inertiaIsDefault: true, shapes,
      limitOrientation: [0, 0, 0, 1], llimit: ll, ulimit: ul, stiffness: sp.stiffness ?? (row.parent && o.stiffness ? [o.stiffness, o.stiffness, o.stiffness] : [0, 0, 0]),
    });
    byJoint.set(row.joint, links.length - 1);
    segX3D.set(row.joint, `<HAnimSegment DEF="${pre}${row.segment}" name="${row.segment}" mass="${n(sp.mass)}" centerOfMass="${v(com)}">${vis.join('')}</HAnimSegment>`);
  }
  // the skeleton: joints nested by parent, each with its segment
  const kids = (j: string | null) => LOA1.filter((r) => r.parent === j);
  const joint = (r: (typeof LOA1)[number], cf: string): string => {
    const L = links[byJoint.get(r.joint)!];
    const lim = (L.llimit.length ? ` llimit="${v(L.llimit)}" ulimit="${v(L.ulimit)}"` : '') + (L.stiffness.some((x) => x !== 0) ? ` stiffness="${v(L.stiffness)}"` : '');
    return `<HAnimJoint DEF="${pre}${r.joint}" name="${r.joint}" center="${v(r.center)}"${lim}${cf ? ` containerField="${cf}"` : ''}>${segX3D.get(r.joint)}${kids(r.joint).map((k) => joint(k, '')).join('')}</HAnimJoint>`;
  };
  const root = kids(null)[0];
  const rot = quatToAxisAngle(o.pose.q);
  const x3d = `<HAnimHumanoid DEF="${o.def}" name="${o.def}" version="2.0" loa="1" skeletalConfiguration="BASIC" info='"authorName=x3d-physx-bridge" "humanoidVersion=1" "usageRestrictions=none"' translation="${v(o.pose.p)}"${rot[3] ? ` rotation="${v(rot)}"` : ''}>
   ${joint(root, 'skeleton')}
   ${LOA1.map((r) => `<HAnimJoint USE="${pre}${r.joint}" containerField="joints"/>`).join('')}
   ${LOA1.map((r) => `<HAnimSegment USE="${pre}${r.segment}" containerField="segments"/>`).join('')}
  </HAnimHumanoid>`;
  return { x3d, def: o.def, materials: [...used], model: { def: o.def, name: o.def, collection: -1, pose: o.pose, links, iterations: 24 } };
}

/** Volume-weighted centroid of a segment's shapes (its centerOfMass); the joint centre when it has none. */
function centroid(prims: Prim[], fallback: Vec3): Vec3 {
  let w = 0; const c: Vec3 = [0, 0, 0];
  for (const p of prims) {
    const [vol, at]: [number, Vec3] = p.kind === 'box' ? [p.size[0] * p.size[1] * p.size[2], p.c] : p.kind === 'sphere' ? [(4 / 3) * Math.PI * p.r ** 3, p.c]
      : [Math.PI * p.r * p.r * Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]) + (4 / 3) * Math.PI * p.r ** 3, [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2]];
    w += vol; for (let k = 0; k < 3; k++) c[k] += vol * at[k];
  }
  return w ? (c.map((x) => +(x / w).toFixed(5)) as Vec3) : fallback;
}

/** Give a built humanoid's links and shapes their global indices (after the scene's bodies and shapes). */
export function indexHumanoid(b: BuiltHumanoid, firstBody: number, firstShape: number): HumanoidModel {
  let s = firstShape;
  return { ...b.model, links: b.model.links.map((L, i) => ({ ...L, index: firstBody + i, shapes: L.shapes.map((sh) => ({ ...sh, index: s++ })) })) };
}

export const MATS: Record<Character, Record<string, string>> = {
  toon: {
    dummy: '<PhysicalMaterial baseColor="0.98 0.8 0.12" metallic="0" roughness="0.4"/>',
    dummyDark: '<PhysicalMaterial baseColor="0.1 0.1 0.11" metallic="0" roughness="0.5"/>',
    joint: '<PhysicalMaterial baseColor="0.08 0.08 0.09" metallic="0.6" roughness="0.4"/>',
    eye: '<PhysicalMaterial baseColor="1 1 1" metallic="0" roughness="0.3"/>',
    pupil: '<PhysicalMaterial baseColor="0.02 0.02 0.03" metallic="0" roughness="0.2"/>',
  },
  dummy: {
    dummy: '<PhysicalMaterial baseColor="0.96 0.76 0.14" metallic="0" roughness="0.45"/>',
    dummyDark: '<PhysicalMaterial baseColor="0.12 0.12 0.13" metallic="0" roughness="0.6"/>',
    joint: '<PhysicalMaterial baseColor="0.08 0.08 0.09" metallic="0.6" roughness="0.4"/>',
    eye: '<PhysicalMaterial baseColor="0.12 0.12 0.13" metallic="0" roughness="0.6"/>',
    pupil: '<PhysicalMaterial baseColor="0.12 0.12 0.13" metallic="0" roughness="0.6"/>',
  },
  cartoon: {
    dummy: '<PhysicalMaterial baseColor="0.98 0.62 0.5" metallic="0" roughness="0.7"/>',
    dummyDark: '<PhysicalMaterial baseColor="0.22 0.45 0.9" metallic="0" roughness="0.6"/>',
    joint: '<PhysicalMaterial baseColor="0.98 0.62 0.5" metallic="0" roughness="0.7"/>',
    eye: '<PhysicalMaterial baseColor="1 1 1" metallic="0" roughness="0.3"/>',
    pupil: '<PhysicalMaterial baseColor="0.02 0.02 0.03" metallic="0" roughness="0.2"/>',
  },
};

export const rotY = (a: number): Quat => axisAngleToQuat(0, 1, 0, a);
