// Writer: PhysX state -> X3D output fields (RigidBody pose and velocities). Standard ROUTEs then move the Transforms.
import { BODY_STRIDE } from './model.ts';
import { quatToAxisAngle } from './math.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAINode = any;

export class Writer {
  private last: Float64Array | null = null;
  private readonly aa = [0, 0, 1, 0];
  writes = 0;
  private readonly X3D: SAINode;
  private readonly bodies: SAINode[];
  private readonly movable: boolean[];
  constructor(X3D: SAINode, bodies: SAINode[], movable: boolean[]) { this.X3D = X3D; this.bodies = bodies; this.movable = movable; }

  /** Write every movable body whose state changed since the last write. */
  apply(state: Float64Array) {
    const X3D = this.X3D;
    for (let i = 0; i < this.bodies.length; i++) {
      if (!this.movable[i]) continue;
      const o = i * BODY_STRIDE;
      if (this.last && unchanged(this.last, state, o)) continue;
      const b = this.bodies[i];
      b.position = new X3D.SFVec3f(state[o], state[o + 1], state[o + 2]);
      quatToAxisAngle(state.subarray(o + 3, o + 7), this.aa);
      b.orientation = new X3D.SFRotation(this.aa[0], this.aa[1], this.aa[2], this.aa[3]);
      b.linearVelocity = new X3D.SFVec3f(state[o + 7], state[o + 8], state[o + 9]);
      b.angularVelocity = new X3D.SFVec3f(state[o + 10], state[o + 11], state[o + 12]);
      this.writes++;
    }
    this.last = state;
  }
  reset() { this.last = null; }
}

function unchanged(a: Float64Array, b: Float64Array, o: number) {
  for (let k = 0; k < BODY_STRIDE; k++) if (a[o + k] !== b[o + k]) return false;
  return true;
}
