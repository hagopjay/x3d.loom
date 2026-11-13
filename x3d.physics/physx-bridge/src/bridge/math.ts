// Small rotation and tensor helpers (no dependencies).
import type { Quat, Vec3 } from './model.ts';

/** X3D axis-angle (x, y, z, angle) -> unit quaternion (x, y, z, w). A zero axis gives the identity. */
export function axisAngleToQuat(x: number, y: number, z: number, a: number): Quat {
  const n = Math.hypot(x, y, z);
  if (n < 1e-12 || a === 0) return [0, 0, 0, 1];
  const s = Math.sin(a / 2) / n;
  return [x * s, y * s, z * s, Math.cos(a / 2)];
}

/** Unit quaternion -> X3D axis-angle; identity gives (0, 0, 1, 0), the X3D default. */
export function quatToAxisAngle(q: ArrayLike<number>, out: number[] = [0, 0, 1, 0]): number[] {
  let [x, y, z, w] = [q[0], q[1], q[2], q[3]];
  const n = Math.hypot(x, y, z, w) || 1;
  x /= n; y /= n; z /= n; w /= n;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.hypot(x, y, z);
  if (s < 1e-12) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return out; }
  out[0] = x / s; out[1] = y / s; out[2] = z / s; out[3] = 2 * Math.atan2(s, w);
  return out;
}

export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  // t = 2 * cross(q.xyz, v); v' = v + w t + cross(q.xyz, t)
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

export function quatConj(q: Quat): Quat { return [-q[0], -q[1], -q[2], q[3]]; }

/** Shortest-arc rotation taking unit vector a onto unit vector b. */
export function quatFromTo(a: Vec3, b: Vec3): Quat {
  const na = Math.hypot(...a) || 1, nb = Math.hypot(...b) || 1;
  const u: Vec3 = [a[0] / na, a[1] / na, a[2] / na], v: Vec3 = [b[0] / nb, b[1] / nb, b[2] / nb];
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  if (d < -1 + 1e-9) { // opposite: any perpendicular axis
    const p: Vec3 = Math.abs(u[0]) < 0.9 ? [0, -u[2], u[1]] : [-u[2], 0, u[0]];
    const n = Math.hypot(...p);
    return [p[0] / n, p[1] / n, p[2] / n, 0];
  }
  const c: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const q: Quat = [c[0], c[1], c[2], 1 + d];
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Rotation matrix (row-major 3x3) -> quaternion. */
export function matToQuat(m: number[]): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m;
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/**
 * Diagonalise a symmetric 3x3 inertia tensor (row-major) with cyclic Jacobi rotations.
 * Returns the principal moments and the rotation (quaternion) from the principal frame to the body frame,
 * as PhysX wants them (setMassSpaceInertiaTensor + the rotation part of setCMassLocalPose).
 */
export function diagonaliseInertia(I: number[]): { moments: Vec3; frame: Quat } {
  const a = [[I[0], (I[1] + I[3]) / 2, (I[2] + I[6]) / 2], [(I[1] + I[3]) / 2, I[4], (I[5] + I[7]) / 2], [(I[2] + I[6]) / 2, (I[5] + I[7]) / 2, I[8]]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-15) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { // A <- A J
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) { // A <- J^T A
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) { // V <- V J
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  // Columns of v are the principal axes; make it a proper rotation.
  const det = v[0][0] * (v[1][1] * v[2][2] - v[1][2] * v[2][1]) - v[0][1] * (v[1][0] * v[2][2] - v[1][2] * v[2][0]) + v[0][2] * (v[1][0] * v[2][1] - v[1][1] * v[2][0]);
  if (det < 0) for (let k = 0; k < 3; k++) v[k][2] = -v[k][2];
  return { moments: [a[0][0], a[1][1], a[2][2]], frame: matToQuat([v[0][0], v[0][1], v[0][2], v[1][0], v[1][1], v[1][2], v[2][0], v[2][1], v[2][2]]) };
}

/** Points of an N-sided prism (X3D Cylinder, Y axis) or pyramid (X3D Cone) for a convex hull. */
export function cylinderPoints(radius: number, height: number, n: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push(radius * Math.cos(a), -height / 2, radius * Math.sin(a), radius * Math.cos(a), height / 2, radius * Math.sin(a));
  }
  return pts;
}
export function conePoints(bottomRadius: number, height: number, n: number): number[] {
  const pts: number[] = [0, height / 2, 0];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; pts.push(bottomRadius * Math.cos(a), -height / 2, bottomRadius * Math.sin(a)); }
  return pts;
}
