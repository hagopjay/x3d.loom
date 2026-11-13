// Joint outputs and CollisionSensor outputs (Contact nodes) -> X3D events.
// SAI refuses assignments to outputOnly fields (measured: Chromium, Firefox, WebKit); the field object's setValue() emits them
// and ROUTEs fire (probes/outputs.html). The bridge acts as the engine, so it writes them that way.
import { CONTACT_STRIDE } from './model.ts';
import type { JointModel, SurfaceModel } from './model.ts';
import { JOINT_OUTPUTS, JOINT_STRIDE } from './joints.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;

/**
 * Emit an outputOnly event. X_ITE 16.7: sfnode.getField(name).setValue(v) works and ROUTEs fire (measured), but X_ITE warns that getField
 * is deprecated; if a later X_ITE removes it, fall back to the wrapped node's field (how X_ITE's own engine writes outputs).
 */
export function emit(node: SAI, field: string, value: unknown) {
  if (typeof node.getField === 'function') { node.getField(field).setValue(value); return; }
  const inner = node.getValue?.();
  if (inner && ('_' + field) in inner) { inner['_' + field] = value; return; }
  throw new Error(`cannot emit ${field}: neither SAI getField nor X_ITE internals available`);
}

export class JointWriter {
  private readonly X3D: SAI;
  private readonly nodes: SAI[];
  private readonly plans: [string, number, number][][];
  private last: Float64Array | null = null;
  constructor(X3D: SAI, nodes: SAI[], models: JointModel[]) {
    this.X3D = X3D; this.nodes = nodes;
    this.plans = models.map((m) => {
      const all = JOINT_OUTPUTS[m.type] ?? [];
      const want = new Set(m.forceOutput);
      if (want.has('NONE') && want.size === 1) return [];
      // X_ITE also accepts the alias angleRate for hinge rates; X3D names are used here.
      return want.has('ALL') ? all : all.filter(([name]) => want.has(name));
    });
  }
  apply(out: Float64Array) {
    for (let k = 0; k < this.nodes.length; k++) {
      const o = k * JOINT_STRIDE;
      for (const [name, slot, n] of this.plans[k]) {
        if (this.last && changedNot(this.last, out, o + slot, n)) continue;
        emit(this.nodes[k], name, n === 1 ? out[o + slot] : new this.X3D.SFVec3f(out[o + slot], out[o + slot + 1], out[o + slot + 2]));
      }
    }
    this.last = out;
  }
}
const changedNot = (a: Float64Array, b: Float64Array, o: number, n: number) => { for (let i = 0; i < n; i++) if (a[o + i] !== b[o + i]) return false; return true; };

interface SensorInfo { node: SAI; shapes: Set<number>; enabled: boolean; surface: SurfaceModel | null; colliderNode: SAI }

export class SensorWriter {
  private readonly X3D: SAI;
  private readonly scene: SAI;
  private readonly sensors: SensorInfo[];
  private readonly bodies: SAI[];
  private readonly shapes: SAI[];
  private readonly pool: SAI[] = [];
  private readonly poolKeys: string[] = [];
  private readonly poolCollider: unknown[] = [];
  private readonly active: boolean[];
  /** Contacts with separation above this are speculative (not touching) and are not reported. */
  static readonly TOUCH = 5e-4;
  cap: number;
  written = 0;
  constructor(X3D: SAI, scene: SAI, sensors: SensorInfo[], bodies: SAI[], shapes: SAI[], cap = 16) {
    this.X3D = X3D; this.scene = scene; this.sensors = sensors; this.bodies = bodies; this.shapes = shapes; this.cap = cap;
    this.active = sensors.map(() => false);
  }

  private contactNode(i: number, colliderNode: SAI): SAI {
    let c = this.pool[i];
    if (!c) {
      c = this.pool[i] = this.scene.createNode('Contact');
      this.poolKeys[i] = '';
    }
    if (colliderNode && this.poolCollider[i] !== colliderNode) {
      // surface parameters are copied from the CollisionCollection, as X_ITE does
      for (const f of ['appliedParameters', 'bounce', 'minBounceSpeed', 'frictionCoefficients', 'surfaceSpeed', 'softnessConstantForceMix', 'softnessErrorCorrection']) c[f] = colliderNode[f];
      c.slipCoefficients = colliderNode.slipFactors;
      this.poolCollider[i] = colliderNode;
    }
    return c;
  }

  apply(contacts: Float32Array) {
    const X3D = this.X3D;
    this.sensors.forEach((s, si) => {
      if (!s.enabled) return;
      const picked: number[] = [];
      for (let o = 0; o < contacts.length && picked.length < this.cap; o += CONTACT_STRIDE) {
        if (contacts[o + 10] < -SensorWriter.TOUCH) continue; // depth = -separation
        if (s.shapes.has(contacts[o + 2]) || s.shapes.has(contacts[o + 3])) picked.push(o);
      }
      const isActive = picked.length > 0;
      if (isActive) {
        const nodes: SAI[] = [];
        const inter = new Set<number>();
        picked.forEach((o, k) => {
          const c = this.contactNode(k + si * this.cap, s.colliderNode);
          c.position = new X3D.SFVec3f(contacts[o + 4], contacts[o + 5], contacts[o + 6]);
          c.contactNormal = new X3D.SFVec3f(contacts[o + 7], contacts[o + 8], contacts[o + 9]);
          c.depth = Math.max(0, contacts[o + 10]);
          const s1 = contacts[o + 2], s2 = contacts[o + 3];
          const keyStr = `${s1}:${s2}`;
          if (this.poolKeys[k + si * this.cap] !== keyStr) {
            const b1 = this.bodies[contacts[o]] ?? null, b2 = this.bodies[contacts[o + 1]] ?? null;
            c.body1 = b1; c.body2 = b2; c.geometry1 = this.shapes[s1] ?? null; c.geometry2 = this.shapes[s2] ?? null;
            this.poolKeys[k + si * this.cap] = keyStr;
          }
          if (s.shapes.has(s1)) inter.add(s1);
          if (s.shapes.has(s2)) inter.add(s2);
          nodes.push(c);
        });
        emit(s.node, 'contacts', new X3D.MFNode(...nodes));
        emit(s.node, 'intersections', new X3D.MFNode(...[...inter].map((i) => this.shapes[i])));
        this.written += nodes.length;
      }
      if (isActive !== this.active[si]) { emit(s.node, 'isActive', isActive); this.active[si] = isActive; }
    });
  }
}
