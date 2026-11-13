// Web Worker: owns the PhysX WASM instance and the world; steps on request and returns state as transferable buffers.
import PhysX from 'physx-js-webidl';
import { PhysXContext, PhysXWorld } from './world.ts';
import { BODY_STRIDE } from './model.ts';
import type { FromWorker, ToWorker } from './protocol.ts';

const post = (m: FromWorker, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);
let world: PhysXWorld | null = null;
const t0 = performance.now();
const ctxP = PhysX().then((P: unknown) => { const ctx = new PhysXContext(P); post({ t: 'ready', version: ctx.version, loadMs: performance.now() - t0 }); return ctx; });

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    const ctx = await ctxP;
    if (m.t === 'build') {
      const b0 = performance.now();
      world?.release();
      world = new PhysXWorld(ctx, m.model, m.opts);
      post({ t: 'built', id: m.id, notes: world.notes, bodyCount: world.bodyCount, jointCount: world.joints.length, buildMs: performance.now() - b0, bounceThreshold: world.bounceThreshold });
    } else if (m.t === 'step') {
      if (!world) throw new Error('step before build');
      for (const tp of m.teleports) world.setBodyState(tp.index, tp.p, tp.q, tp.v, tp.w);
      for (const k of m.targets) world.setKinematicTarget(k.index, k.p, k.q);
      for (const k of m.paths) world.setKinematicPath(k.index, k.p, k.q);
      for (const c of m.sets) {
        if (c.kind === 'joint') world.setJointField(c.index, c.field, c.value as number);
        else if (c.kind === 'jointRemove') world.removeJoint(c.index);
        else if (c.kind === 'gravity') world.setGravity(c.index, c.value as [number, number, number]);
        else if (c.kind === 'shape') world.setShapeEnabled(c.index, !!c.value);
        else if (c.kind === 'stiffness') world.setLinkStiffness(c.index, c.value as [number, number, number]);
        else if (c.kind === 'impulse') world.applyImpulse(c.index, c.value as [number, number, number]);
        else world.setBodyLoad(c.index, c.field === 'forces' ? 'force' : 'torque', c.value as [number, number, number]);
      }
      const hashes: number[] = [];
      const s0 = performance.now();
      world.step(m.n, m.hash ? hashes : undefined);
      const physicsMs = performance.now() - s0;
      const state = world.readState(new Float64Array(world.bodyCount * BODY_STRIDE));
      const joints = world.readJoints();
      const { current, events, dropped } = world.takeContacts();
      post({ t: 'state', id: m.id, stepCount: world.stepCount, time: world.time, state, joints, contacts: current, events, contactsDropped: dropped, hashes, physicsMs, n: m.n },
        [state.buffer, joints.buffer, current.buffer, events.buffer]);
    }
  } catch (err) {
    post({ t: 'error', id: m.id, message: String((err as Error)?.stack ?? err) });
  }
};
