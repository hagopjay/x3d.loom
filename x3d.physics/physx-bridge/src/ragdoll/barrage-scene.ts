// The barrage: three trebuchets, three toon crash-test dummies, and a showpiece castle (curtain wall with a gate and crenellations,
// two corner towers and a keep, conical roofs with banners that topple). Each trebuchet throws a dummy-weight ball; at release the
// page puts a real ragdoll in its place with its velocity (an X3D joint cannot hold an H-Anim figure in the sling). Pure: page and Node.
import { axisAngleToQuat } from '../bridge/math.ts';
import type { Quat, SceneModel, Vec3 } from '../bridge/model.ts';
import type { IRBody, IRJoint, IRShape, MachineIR, SceneMeta } from '../machine/index.ts';
import { toModel } from '../machine/index.ts';
import { addTrebuchet, defaultTrebuchet } from '../demos/trebuchet-scene.ts';
import type { Trebuchet } from '../demos/trebuchet-scene.ts';
import { buildHumanoid, indexHumanoid } from './humanoid.ts';
import type { BuiltHumanoid } from './humanoid.ts';
import { viewpoint } from '../demos/view.ts';

export const LANES = [-6, 0, 6];
export const BLOCK: Vec3 = [1.2, 0.6, 0.6], BLOCK_MASS = 20; // a toy castle: real stones this size would be about 1 t
export interface Barrage { distance: number; counterweight: number; ball: number }
export const defaultBarrage = (): Barrage => ({ distance: 150, counterweight: 3000, ball: 60 });

const q0: Quat = [0, 0, 0, 1];
const yq = (a: number): Quat => axisAngleToQuat(0, 1, 0, a);

export function buildBarrage(b: Barrage) {
  const bodies: IRBody[] = [], joints: IRJoint[] = [];
  const add = (x: Omit<IRBody, 'pieceLocal' | 'piece'>) => { bodies.push({ ...x, pieceLocal: x.pose, piece: -1 }); return bodies.length - 1; };
  const box = (def: string, size: Vec3, p: Vec3, mat: string, q: Quat = q0): IRShape => ({ def, geom: { kind: 'box', size }, local: { p, q }, mat });
  add({ def: 'Ground', pose: { p: [80, -0.5, 0], q: q0 }, fixed: true, role: 'board', shapes: [box('GroundS', [320, 1, 140], [0, 0, 0], 'grass')] });
  const t: Trebuchet = { ...defaultTrebuchet(), counterweight: b.counterweight, stone: b.ball, distance: b.distance };
  const tre = LANES.map((z, k) => addTrebuchet(bodies, joints, t, `T${k}`, z));

  // ---- the castle (front face at x = D)
  const D = b.distance, blocks: number[] = [], roofs: number[] = [];
  const stones = ['stone', 'stoneWarm', 'stoneDark'];
  const lay = (p: Vec3, alongZ: boolean, size: Vec3 = BLOCK, mat?: string) => {
    blocks.push(add({ def: `Blk${blocks.length}`, pose: { p, q: alongZ ? yq(Math.PI / 2) : q0 }, fixed: false, mass: (BLOCK_MASS * size[0]) / BLOCK[0], role: 'block', shapes: [box(`Blk${blocks.length}S`, size, [0, 0, 0], mat ?? stones[(blocks.length * 7) % 3])] }));
  };
  const y = (c: number) => BLOCK[1] / 2 + c * (BLOCK[1] + 0.0005);
  // curtain wall: 14 blocks long, 8 courses in running bond, a gate 2.4 m wide and 3 courses high, crenellations on top
  for (let c = 0; c < 8; c++) for (let k = 0; k < 14 - (c % 2); k++) {
    const z = (k + (c % 2) / 2) * BLOCK[0] - 7.8;
    if (Math.abs(z) < 1.3 && c < 5) continue;
    lay([D, y(c), z], true);
  }
  for (let k = 0; k < 14; k += 2) lay([D, y(8), k * BLOCK[0] - 7.8], true, BLOCK, 'stoneDark');
  // corner towers: square rings of 1.8 m stones (pinwheel), 11 courses, a conical roof with a banner
  const tower = (zc: number, courses: number, half: number) => {
    const L = 2 * half; const size: Vec3 = [L, BLOCK[1], BLOCK[2]];
    for (let c = 0; c < courses; c++) {
      const s = c % 2 ? 1 : -1;
      lay([D + 0.6 + half - BLOCK[2] / 2, y(c), zc + s * BLOCK[2] / 2], true, size);
      lay([D + 0.6 - half + BLOCK[2] / 2, y(c), zc - s * BLOCK[2] / 2], true, size);
      lay([D + 0.6 + s * BLOCK[2] / 2, y(c), zc - half + BLOCK[2] / 2], false, size);
      lay([D + 0.6 - s * BLOCK[2] / 2, y(c), zc + half - BLOCK[2] / 2], false, size);
    }
    roofs.push(add({ def: `Roof${roofs.length}`, pose: { p: [D + 0.6, y(courses - 1) + BLOCK[1] / 2 + 1.25, zc], q: q0 }, fixed: false, mass: 180, role: 'block', shapes: [
      { def: `Roof${roofs.length}S`, geom: { kind: 'cone', r: half + 0.45, h: 2.5 }, local: { p: [0, 0, 0], q: q0 }, mat: 'roof' },
      { def: `Pole${roofs.length}`, geom: { kind: 'cylinder', r: 0.04, h: 1.6 }, local: { p: [0, 2.0, 0], q: q0 }, mat: 'gold' },
      box(`Banner${roofs.length}`, [0.9, 0.55, 0.03], [0.46, 2.5, 0], 'banner'),
    ] }));
  };
  tower(-10.2, 11, 1.5); tower(10.2, 11, 1.5); // clear of the wall's ends (overlapping stones push each other apart: measured)
  // the keep behind the wall: a rectangular ring, 10 courses, a big roof with a banner
  const KX = D + 6, kz = 2.4, kx = 1.8;
  for (let c = 0; c < 10; c++) {
    for (let k = 0; k < 4; k++) for (const x of [KX - kx - 0.3, KX + kx + 0.3]) lay([x, y(c), (k + 0.5 - 2) * BLOCK[0] + (c % 2 ? 0.3 : -0.3)], true);
    for (const z of [-kz - 0.3, kz + 0.3]) for (let k = 0; k < 3; k++) lay([KX + (k - 1) * BLOCK[0], y(c), z], false);
  }
  roofs.push(add({ def: 'KeepRoof', pose: { p: [KX, y(9) + BLOCK[1] / 2 + 1.6, 0], q: q0 }, fixed: false, mass: 400, role: 'block', shapes: [
    { def: 'KeepRoofS', geom: { kind: 'cone', r: 3.3, h: 3.2 }, local: { p: [0, 0, 0], q: q0 }, mat: 'roof' },
    { def: 'KeepPole', geom: { kind: 'cylinder', r: 0.05, h: 2 }, local: { p: [0, 2.6, 0], q: q0 }, mat: 'gold' },
    box('KeepBanner', [1.3, 0.75, 0.03], [0.67, 3.2, 0], 'banner'),
  ] }));

  const ir: MachineIR = {
    bodies, joints, clocks: [], chimes: [],
    surface: { bounce: 0.05, minBounceSpeed: 0.5, friction: 0.65 },
    world: { autoDisable: true, disableLinearSpeed: 0.05, disableAngularSpeed: 0.05, disableTime: 0.6, iterations: 24 },
  };
  // three toon dummies, lying on their backs beside their trebuchets until their turn
  const dummies: BuiltHumanoid[] = LANES.map((z, k) => buildHumanoid({ def: `Toon${k}`, character: 'toon', prefix: `t${k}_`, pose: { p: [-7, 0.25, z + 3.2], q: axisAngleToQuat(1, 0, 0, -Math.PI / 2) }, heat: true }));
  const meta: SceneMeta = {
    title: 'Dummy barrage', description: `Three trebuchets throw toon crash-test dummies (H-Anim ragdolls) at a castle of ${blocks.length} stones ${D} m away.`,
    info: 'Units: metres, kilograms, seconds, radians. Y up; the trebuchets throw along +x.', generator: 'x3d-physx-bridge ragdoll (src/ragdoll/barrage-scene.ts)',
    components: '  <component name="HAnim" level="1"/>\n', shareShapes: true,
    viewpoints: [
      viewpoint('Battery', 'The trebuchets', [-22, 9, 26], [0, 4, 0], 0.85),
      viewpoint('Castle', 'The castle', [D - 20, 9, 24], [D + 2, 3.5, 0], 0.8),
      viewpoint('Field', 'The whole field', [D / 2, 30, 82], [D / 2, 3, 0], 0.8),
    ].join('\n'),
    extra: dummies.map((d) => `  ${d.x3d}`).join('\n'),
  };
  return { ir, meta, dummies, idx: { tre, blocks, roofs } };
}

/** The scene as the bridge reads it, for Node. */
export function barrageModel(b: Barrage): { model: SceneModel; idx: ReturnType<typeof buildBarrage>['idx'] } {
  const { ir, dummies, idx } = buildBarrage(b);
  const m = toModel(ir, 'barrage');
  let body = m.collections[0].bodies.length, shape = m.collections[0].bodies.reduce((n, x) => n + x.shapes.length, 0);
  m.humanoids = dummies.map((d) => { const h = indexHumanoid(d, body, shape); body += h.links.length; shape += h.links.reduce((n, l) => n + l.shapes.length, 0); return h; });
  return { model: m, idx };
}
