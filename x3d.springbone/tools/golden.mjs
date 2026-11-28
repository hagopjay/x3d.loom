// A golden trace for other implementations (Python in x3d-blender-io, C# in x3d.unity_io): one scenario that uses
// every feature, its inputs frame by frame, and the solver's particle positions and hash at checkpoints.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const S = require('../src/springbone-core.js');
const I = [0, 0, 0, 1];
// a Y-shaped tree (trunk of 3, two branches of 3) plus a separate tail tree
const trees = [
  { joints: [{ parent: -1 }, { parent: 0 }, { parent: 1 }, { parent: 2 }, { parent: 3 }, { parent: 4 }, { parent: 2 }, { parent: 6 }, { parent: 7 }] },
  { joints: [{ parent: -1 }, { parent: 0 }, { parent: 1 }, { parent: 2, endOffset: [0, -0.05, 0.01] }] },
];
const pose0 = [
  [{ translation: [0, 0, 0], center: [0.01, 0, 0], rotation: S.qFromAxisAngle([1, 0, 0], 0.2) }, { translation: [0, -0.1, 0] }, { translation: [0, -0.1, 0], rotation: S.qFromAxisAngle([0, 0, 1], 0.1) },
   { translation: [0.05, -0.1, 0] }, { translation: [0, -0.1, 0] }, { translation: [0, -0.1, 0] }, { translation: [-0.05, -0.1, 0] }, { translation: [0, -0.1, 0] }, { translation: [0, -0.1, 0], scale: [1.1, 1.1, 1.1] }],
  [{ translation: [0.3, 0, 0] }, { translation: [0, -0.15, 0] }, { translation: [0, -0.15, 0] }, { translation: [0, -0.15, 0] }],
].map((t) => t.map((f) => Object.assign({ translation: [0, 0, 0], center: [0, 0, 0], rotation: I, scale: [1, 1, 1], scaleOrientation: I }, f)));
const params = {
  timeMode: 'VARIABLE', updateRate: 60, springModel: 'FORCE', damping: 0.06, elasticity: 0.05, stiffness: 0.15, inert: 0.3, friction: 0.4,
  radius: 0.02, angleLimit: 50, stretch: 0.1, endLength: 0.5, gravity: [0, -9.81, 0], forceUnits: 'M_PER_S2', gravityRestCompensation: true,
  force: [0.2, 0, 0], wind: [0, 0, 1.5], windTurbulence: 0.6, windFrequency: 0.8, seed: 3, branchMode: 'MEAN', weight: 0.9, resetDistance: 0.5,
  dampingCurve: [[0, 1], [1, 1.5]], elasticityCurve: [[0, 1], [0.5, 0.6], [1, 0.3]], stiffnessCurve: [[0, 1], [1, 0.2]], radiusCurve: [[0, 1], [1, 0.5]],
};
const colliders = [
  { shape: 'SPHERE', center: [0.02, -0.32, 0.05], radius: 0.06 },
  { shape: 'CAPSULE', center: [0, 0, 0], radius: 0.05, radius2: 0.02, height: 0.3, axis: [1, 0.2, 0], frame: true },
  { shape: 'PLANE', center: [0, -0.55, 0], direction: 'Y' },
  { shape: 'SPHERE', bound: 'INSIDE', center: [0.1, -0.2, 0], radius: 0.6 },
];
let seed = 9; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const frames = []; let t = 0;
for (let f = 0; f < 400; f++) {
  const dt = f ? (1 / 60) * (0.5 + rnd()) : 0; t += dt;
  const jump = f === 250 ? 1.0 : 0;   // a teleport past resetDistance
  const pw = { L: S.m3FromQuat(S.qFromAxisAngle([0, 1, 0], 0.6 * Math.sin(t))), t: [0.3 * Math.sin(2 * t) + jump, 0.05 * Math.cos(3 * t), 0] };
  const pose = pose0.map((tp, ti) => tp.map((fi, k) => (ti === 0 && k === 1 ? Object.assign({}, fi, { rotation: S.qFromAxisAngle([0, 0, 1], 0.3 * Math.sin(1.5 * t)) }) : fi)));
  frames.push({ dt, time: t, parentWorld: pw, rot1: pose[0][1].rotation, pose });
}
const ch = new S.SpringChain(trees, params);
const check = [];
let collidedCount = 0;
frames.forEach((fr, f) => {
  const capW = { L: fr.parentWorld.L, t: S.applyPoint(fr.parentWorld, [0, -0.25, -0.02]) };
  const cs = colliders.map((c) => (c.frame ? Object.assign({}, c, { world: capW }) : c));
  const out = ch.frame({ dt: fr.dt, time: fr.time, reference: fr.parentWorld, trees: [{ parentWorld: fr.parentWorld, pose: fr.pose[0] }, { parentWorld: fr.parentWorld, pose: fr.pose[1] }], colliders: cs });
  if (out.collided) collidedCount++;
  if (f % 25 === 24 || f === 399) check.push({ frame: f, hash: ch.stateHash(), positions: out.trees.map((o) => o.positions), rotations: out.trees.map((o) => o.rotations) });
});
// written compactly: the static pose once, and per frame only what moves (tree 0, joint 1 rotation; the parent frame)
const slim = frames.map((fr) => ({ dt: fr.dt, time: fr.time, parentWorld: fr.parentWorld, rot1: fr.rot1 }));
const golden = { schema: 'x3d.springbone-golden/1', core: S.VERSION, node: process.version, trees, params, colliders, pose0, capsuleFrameOffset: [0, -0.25, -0.02], frames: slim, check, collidedFrames: collidedCount, steps: ch.steps };
writeFileSync(process.argv[2] || 'results/golden.json', JSON.stringify(golden));
console.log('golden: frames', frames.length, 'checkpoints', check.length, 'collided frames', collidedCount, 'final hash', check[check.length - 1].hash);
