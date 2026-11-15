// Camera framing shared by the render CLI and by other lanes.
//
//   boundsOfGlb(path)      -> { min:[x,y,z], max:[x,y,z] }   world-space AABB of the default scene
//   frameCamera(bounds, o) -> { position, target, up, fov, near, far }
//
// Framing rule (documented in render/README.md):
//   target    = centre of the AABB
//   fov       = 0.7854 rad (45 deg), vertical; square frames only, so horizontal fov is the same
//   direction = normalize(0.55, 0.35, 1) from the target towards the camera, up = (0, 1, 0)
//   distance  = the smallest d for which all 8 AABB corners lie inside the frustum, with every corner's
//               screen-space extent inflated by `margin` (default 1.1, i.e. ~10 percent border):
//                 d = max over corners of ( margin * max(|x|, |y|) / tan(fov/2) - z )
//               where (x, y, z) is the corner relative to the target in the camera basis (z along the view direction).
//   rule 'sphere' (opt-in): d = margin * R / sin(fov/2) with R = half the AABB diagonal. Never clips but wastes
//               pixels on flat / wide scenes, so it is not the default.
//   near/far  = 0.01 * distance, 100 * distance. Derived from the ORIGINAL file's bounds, so the optimised copy
//               renders with identical clip planes.
//
// The camera is right-handed, glTF convention (+Y up, camera looks down its own -Z).

import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const require = createRequire(import.meta.url);

export const DEFAULT_FOV = 0.7854;
export const DEFAULT_DIRECTION = [0.55, 0.35, 1];
export const DEFAULT_MARGIN = 1.1;

const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** frameCamera(bounds) -> camera object. bounds = {min, max}. */
export function frameCamera(bounds, opts = {}) {
  const fov = opts.fov ?? DEFAULT_FOV;
  const margin = opts.margin ?? DEFAULT_MARGIN;
  const dir = norm3(opts.direction ?? DEFAULT_DIRECTION);
  const { min, max } = bounds;
  if (![...min, ...max].every(Number.isFinite)) {
    throw new Error('frameCamera: bounds are not finite (empty scene?)');
  }
  const target = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  const half = [0, 1, 2].map((i) => (max[i] - min[i]) / 2);
  let radius = Math.hypot(half[0], half[1], half[2]);
  if (!(radius > 0)) radius = 1; // degenerate (single point): any distance is fine
  const up = [0, 1, 0];
  let distance;
  if ((opts.rule ?? 'box') === 'sphere') {
    distance = (margin * radius) / Math.sin(fov / 2);
  } else {
    const f = dir.map((c) => -c); // view direction
    const r = norm3(cross3(f, up)); // camera right
    const u = cross3(r, f); // camera up
    const t = Math.tan(fov / 2);
    distance = 0;
    for (let c = 0; c < 8; c++) {
      const p = [c & 1 ? half[0] : -half[0], c & 2 ? half[1] : -half[1], c & 4 ? half[2] : -half[2]];
      const x = dot3(p, r);
      const y = dot3(p, u);
      const z = dot3(p, f);
      distance = Math.max(distance, (margin * Math.max(Math.abs(x), Math.abs(y))) / t - z);
    }
    if (!(distance > 0)) distance = (margin * radius) / Math.sin(fov / 2);
  }
  const position = target.map((c, i) => c + dir[i] * distance);
  return {
    position: position.map(round6),
    target: target.map(round6),
    up: [0, 1, 0],
    fov,
    near: round6(0.01 * distance),
    far: round6(100 * distance),
  };
}

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const round6 = (x) => Math.round(x * 1e6) / 1e6;

let ioPromise = null;
async function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      const draco3d = require('draco3dgltf');
      const { MeshoptDecoder } = await import('meshoptimizer');
      await MeshoptDecoder.ready;
      const decoder = await draco3d.createDecoderModule();
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({ 'draco3d.decoder': decoder, 'meshopt.decoder': MeshoptDecoder });
    })();
  }
  return ioPromise;
}

/** Reads a glb (also draco / meshopt / quantized / KTX2 files) and returns the world-space AABB. */
export async function boundsOfGlb(path) {
  const io = await getIO();
  const doc = await io.read(path);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new Error(`boundsOfGlb: ${path} has no scene`);
  const b = getBounds(scene);
  expandForInstancing(scene, b);
  return { min: [...b.min], max: [...b.max] };
}

// getBounds() only sees the mesh at its node transform. Nodes with EXT_mesh_gpu_instancing draw the
// mesh many times, so grow the box with the 8 local-AABB corners of every instance (conservative).
function expandForInstancing(scene, bounds) {
  scene.traverse((node) => {
    const inst = node.getExtension('EXT_mesh_gpu_instancing');
    const mesh = node.getMesh();
    if (!inst || !mesh) return;
    const T = inst.getAttribute('TRANSLATION');
    const R = inst.getAttribute('ROTATION');
    const S = inst.getAttribute('SCALE');
    const count = (T || R || S)?.getCount() ?? 0;
    if (!count) return;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const pmin = pos.getMinNormalized([]);
      const pmax = pos.getMaxNormalized([]);
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], pmin[i]);
        hi[i] = Math.max(hi[i], pmax[i]);
      }
    }
    if (!lo.every(Number.isFinite)) return;
    const world = node.getWorldMatrix();
    const t = [0, 0, 0];
    const r = [0, 0, 0, 1];
    const s = [1, 1, 1];
    for (let k = 0; k < count; k++) {
      if (T) T.getElement(k, t);
      if (R) R.getElement(k, r);
      if (S) S.getElement(k, s);
      const m = composeTRS(t, r, s);
      for (let c = 0; c < 8; c++) {
        const p = [c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]];
        const q = mulPoint(world, mulPoint(m, p));
        for (let i = 0; i < 3; i++) {
          bounds.min[i] = Math.min(bounds.min[i], q[i]);
          bounds.max[i] = Math.max(bounds.max[i], q[i]);
        }
      }
    }
  });
}

// column-major 4x4 helpers (glTF convention)
function composeTRS(t, q, s) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function mulPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** Convenience: boundsOfGlb + frameCamera. */
export async function frameFromGlb(path, opts) {
  return frameCamera(await boundsOfGlb(path), opts);
}

/** Normalises a user supplied camera object (fills defaults, validates). */
export function normaliseCamera(c) {
  const need = (k) => {
    if (!Array.isArray(c[k]) || c[k].length !== 3 || !c[k].every(Number.isFinite)) {
      throw new Error(`camera.${k} must be [x,y,z]`);
    }
  };
  need('position');
  need('target');
  if (c.up !== undefined) need('up');
  const position = c.position;
  const target = c.target;
  const up = c.up ?? [0, 1, 0];
  const fov = c.fov ?? DEFAULT_FOV;
  if (!(fov > 0 && fov < Math.PI)) throw new Error('camera.fov must be radians in (0, pi)');
  const d = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]);
  if (!(d > 0)) throw new Error('camera.position equals camera.target');
  return {
    position,
    target,
    up,
    fov,
    near: c.near ?? round6(0.01 * d),
    far: c.far ?? round6(100 * d),
  };
}
