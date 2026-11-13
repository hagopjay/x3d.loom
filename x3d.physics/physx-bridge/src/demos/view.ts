// Viewpoints by eye and target: X3D cameras look down their local −Z with +Y up; this gives the orientation that points one at a target.
import { matToQuat, quatToAxisAngle } from '../bridge/math.ts';
import type { Quat, Vec3 } from '../bridge/model.ts';

export function lookAtQuat(from: Vec3, to: Vec3, up: Vec3 = [0, 1, 0]): Quat {
  const f = norm([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  const r = norm(cross(f, up)), u = cross(r, f);
  // columns: camera x = r, camera y = u, camera z = −f (row-major 3×3)
  return matToQuat([r[0], u[0], -f[0], r[1], u[1], -f[1], r[2], u[2], -f[2]]);
}
export function lookAt(from: Vec3, to: Vec3): string { return quatToAxisAngle(lookAtQuat(from, to)).map((x) => +x.toFixed(5)).join(' '); }

/** A Viewpoint node (X3D text) at `from` looking at `to`, orbiting about `to`. */
export function viewpoint(def: string, description: string, from: Vec3, to: Vec3, fov = 0.7) {
  return `  <Viewpoint DEF="${def}" description="${description}" position="${from.map((x) => +x.toFixed(4)).join(' ')}" orientation="${lookAt(from, to)}" centerOfRotation="${to.join(' ')}" fieldOfView="${fov}"/>`;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
