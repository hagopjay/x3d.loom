// H-Anim humanoids as ragdolls. Reading: HAnimHumanoid.skeleton walked depth first; each HAnimJoint with its HAnimSegment becomes a
// link (centre, llimit/ulimit/limitOrientation/stiffness; mass, centerOfMass, momentsOfInertia; the segment's Box/Sphere/Cylinder/Cone
// and mesh children, through their Transforms, as collision shapes). Writing: each frame, every HAnimJoint.rotation is the child link's
// orientation relative to its parent's, and HAnimHumanoid.translation/rotation carry the root link, so X_ITE's own H-Anim moves the figure.
import { axisAngleToQuat, conePoints, cylinderPoints, quatConj, quatMul, quatRotate, quatToAxisAngle } from './math.ts';
import { BODY_STRIDE } from './model.ts';
import type { GeomModel, HumanoidModel, LinkModel, Pose, Quat, ShapeModel, Vec3 } from './model.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAINode = any;

const v3 = (f: SAINode): Vec3 => [f.x, f.y, f.z];
const rot = (f: SAINode): Quat => axisAngleToQuat(f.x, f.y, f.z, f.angle);
const nums = (f: SAINode): number[] => Array.from({ length: f?.length ?? 0 }, (_, i) => Number(f[i]));
const tn = (n: SAINode): string => (n ? n.getNodeTypeName() : '');
const compose = (a: Pose, b: Pose): Pose => { const p = quatRotate(a.q, b.p); return { p: [a.p[0] + p[0], a.p[1] + p[1], a.p[2] + p[2]], q: quatMul(a.q, b.q) }; };

function geometry(geo: SAINode, sides: number, hint: string): GeomModel | null {
  switch (tn(geo)) {
    case 'Box': { const s = v3(geo.size); return { kind: 'box', half: [s[0] / 2, s[1] / 2, s[2] / 2] }; }
    case 'Sphere': return { kind: 'sphere', radius: geo.radius };
    case 'Cylinder': return { kind: 'convex', points: cylinderPoints(geo.radius, geo.height, sides), from: `Cylinder (${sides}-sided hull)` };
    case 'Cone': return { kind: 'convex', points: conePoints(geo.bottomRadius, geo.height, sides), from: `Cone (${sides}-sided hull)` };
    case 'IndexedFaceSet': {
      const pts = geo.coord?.point; if (!pts) return null;
      const points: number[] = []; for (let i = 0; i < pts.length; i++) points.push(pts[i].x, pts[i].y, pts[i].z);
      return { kind: 'convex', points, from: `IndexedFaceSet ${hint} (convex hull: links are dynamic)` };
    }
    default: return null;
  }
}

/** A segment's shapes in the humanoid frame: Shapes under its children, through Transforms (translation and rotation; scale ignored). */
function segmentShapes(seg: SAINode, name: string, sides: number, notes: string[]): ShapeModel[] {
  const out: ShapeModel[] = [];
  const visit = (n: SAINode, pose: Pose) => {
    const t = tn(n);
    if (t === 'Shape') { const g = geometry(n.geometry, sides, name); if (g) out.push({ def: `${name}_${out.length}`, local: pose, geom: g, enabled: true }); return; }
    if (t === 'Transform') {
      const s = v3(n.scale); if (s.some((x) => Math.abs(x - 1) > 1e-6)) notes.push(`${name}: a Transform scale was ignored`);
      const c = v3(n.center), r = rot(n.rotation), tr = v3(n.translation);
      // T · C · R · (−C): translation + c − R·c, rotation R
      const rc = quatRotate(r, c);
      pose = compose(pose, { p: [tr[0] + c[0] - rc[0], tr[1] + c[1] - rc[1], tr[2] + c[2] - rc[2]], q: r });
    }
    if (t === 'Transform' || t === 'Group' || t === 'HAnimSegment') { const ch = n.children; for (let i = 0; i < ch.length; i++) visit(ch[i], pose); }
  };
  visit(seg, { p: [0, 0, 0], q: [0, 0, 0, 1] });
  return out;
}

/**
 * How an axis of an HAnimJoint moves, from its limits. X3D 4.0 defaults both llimit and ulimit to 0 0 0, so equal limits (the default
 * included) mean no limit on that axis; a range narrower than 0.01 rad locks it; otherwise it is limited. (Interpretation, see SPEC-RAGDOLL.)
 */
export type AxisKind = 'free' | 'locked' | 'limited';
export function axisKinds(lo: number[], hi: number[]): AxisKind[] {
  return [0, 1, 2].map((k) => (lo.length <= k || hi.length <= k || lo[k] === hi[k] ? 'free' : Math.abs(hi[k] - lo[k]) < 0.01 ? 'locked' : 'limited'));
}

export interface HumanoidRead { model: HumanoidModel; node: SAINode; joints: SAINode[] }

/** Read every HAnimHumanoid; links get body indices from `firstBody`, shapes from `firstShape`. */
export function readHumanoids(humanoids: SAINode[], firstBody: number, firstShape: number, sides = 24): { read: HumanoidRead[]; notes: string[] } {
  const read: HumanoidRead[] = [], notes: string[] = [];
  let body = firstBody, shape = firstShape;
  for (const h of humanoids) {
    const links: LinkModel[] = [], joints: SAINode[] = [];
    const visitJoint = (j: SAINode, parent: number) => {
      let seg: SAINode = null; const kids: SAINode[] = [];
      for (let i = 0; i < j.children.length; i++) { const c = j.children[i]; if (tn(c) === 'HAnimSegment' && !seg) seg = c; else if (tn(c) === 'HAnimJoint') kids.push(c); }
      const segName = seg?.name || `${j.name}_segment`;
      const shapes = seg ? segmentShapes(seg, segName, sides, notes).map((s) => ({ ...s, index: shape++ })) : [];
      const inertia = seg ? nums(seg.momentsOfInertia) : [];
      const mass = seg && seg.mass > 0 ? seg.mass : 0.1;
      if (!seg || !(seg.mass > 0)) notes.push(`${j.name}: no segment mass; 0.1 kg used`);
      const ll = nums(j.llimit), ul = nums(j.ulimit), st = nums(j.stiffness);
      links.push({
        index: body++, segment: segName, joint: j.name, parent, center: v3(j.center), mass,
        centerOfMass: seg ? v3(seg.centerOfMass) : v3(j.center), inertia: inertia.length === 9 ? inertia : [0, 0, 0, 0, 0, 0, 0, 0, 0],
        inertiaIsDefault: !(inertia.length === 9 && inertia.some((x) => x !== 0)), shapes,
        limitOrientation: rot(j.limitOrientation), llimit: ll.length >= 3 && ul.length >= 3 ? ll.slice(0, 3) : [], ulimit: ll.length >= 3 && ul.length >= 3 ? ul.slice(0, 3) : [],
        stiffness: [st[0] ?? 0, st[1] ?? 0, st[2] ?? 0],
      });
      joints.push(j);
      const me = links.length - 1;
      for (const k of kids) visitJoint(k, me);
    };
    const sk = h.skeleton;
    for (let i = 0; i < sk.length; i++) if (tn(sk[i]) === 'HAnimJoint') visitJoint(sk[i], -1);
    if (v3(h.scale).some((x) => Math.abs(x - 1) > 1e-6)) notes.push(`${h.getNodeName()}: HAnimHumanoid.scale ignored`);
    read.push({ node: h, joints, model: { def: h.getNodeName() || h.name, name: h.name, collection: -1, pose: { p: v3(h.translation), q: rot(h.rotation) }, links, iterations: 24 } });
  }
  return { read, notes };
}

/** Writes ragdoll poses into the H-Anim nodes (only fields that changed). */
export class HumanoidWriter {
  private readonly X3D: SAINode;
  private readonly hs: HumanoidRead[];
  private readonly last = new Map<SAINode, string>();
  constructor(X3D: SAINode, hs: HumanoidRead[]) { this.X3D = X3D; this.hs = hs; }

  apply(state: Float64Array) {
    for (const h of this.hs) {
      const L = h.model.links, q = (i: number): Quat => { const o = L[i].index * BODY_STRIDE; return [state[o + 3], state[o + 4], state[o + 5], state[o + 6]]; };
      // the root link's pose is the humanoid's: rotation Q, translation P − Q·c (c: the root joint's centre)
      const ro = L[0].index * BODY_STRIDE, Q = q(0), P: Vec3 = [state[ro], state[ro + 1], state[ro + 2]], c = quatRotate(Q, L[0].center);
      this.set(h.node, 'translation', new this.X3D.SFVec3f(P[0] - c[0], P[1] - c[1], P[2] - c[2]));
      this.setRot(h.node, Q);
      for (let i = 1; i < L.length; i++) this.setRot(h.joints[i], quatMul(quatConj(q(L[i].parent)), q(i)));
    }
  }

  private setRot(node: SAINode, q: Quat) {
    const a = quatToAxisAngle(q);
    const k = `${a[0].toFixed(4)},${a[1].toFixed(4)},${a[2].toFixed(4)},${a[3].toFixed(4)}`;
    if (this.last.get(node) === k) return;
    this.last.set(node, k);
    node.rotation = new this.X3D.SFRotation(a[0], a[1], a[2], a[3]);
  }
  private set(node: SAINode, field: string, value: SAINode) { node[field] = value; }
}
