// X3D <-> PhysX bridge, main thread: loads a standard scene into X_ITE with X_ITE's own engine switched off,
// reads it, builds it in the PhysX worker, runs the fixed-step clock and writes results back as X3D events.
import { readScene, takeOverEngine } from './reader.ts';
import { SceneClocks } from './clocks.ts';
import type { LossReport, ReadResult } from './reader.ts';
import { Writer } from './writer.ts';
import { JointWriter, SensorWriter } from './outputs.ts';
import { LIVE_JOINT_FIELDS } from './joints.ts';
import type { SetField } from './protocol.ts';
import { BODY_STRIDE } from './model.ts';
import type { Quat, SceneModel, Vec3 } from './model.ts';
import type { FromWorker, ToWorker } from './protocol.ts';
import type { WorldOptions } from './world.ts';
import { axisAngleToQuat, quatRotate } from './math.ts';
import { HumanoidWriter } from './hanim.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;

export interface BridgeStats {
  physxVersion: string; wasmLoadMs: number; buildMs: number;
  stepCount: number; simTime: number; lastPhysicsMs: number; physicsMsPerStep: number; stepsPerSecond: number; frames: number; contactsLastFrame: number; contactsDropped: number; newContacts: number;
  /** X_ITE createX3DFromString calls that stalled and were retried. */
  createStalls: number;
  /** Times the scene's clocks were paused for physics to catch up. */
  clockHolds: number;
}

export interface StateEvent { stepCount: number; time: number; state: Float64Array; joints: Float64Array; contacts: Float32Array; events: Float32Array; hashes: number[] }

/** A recorded run: every step message sent to PhysX and the state hash after every step (SPEC section 6, record and replay). */
export interface RunLog {
  format: 'x3d-physx-run/1';
  source: string;
  fixedStep: number;
  physx: string;
  recordedIn: string;
  /** Free-form context from the page (the machine description, so a replay can rebuild the same scene). */
  context?: unknown;
  /** The exact engine-neutral model the run started from (the X3D text rounds numbers, so a replay elsewhere must not re-derive it). */
  model: SceneModel;
  /** World options the run used (contact reporting changes PhysX's work, so a replay must match them). */
  world: WorldOptions;
  messages: Omit<Extract<ToWorker, { t: 'step' }>, 't' | 'id' | 'hash'>[];
  /** FNV-1a 32-bit hash of every dynamic body's float32 state after every step, in order. */
  hashes: number[];
}
export interface ReplayResult { steps: number; mismatches: number; firstMismatch: number; ms: number }

export interface BridgeOptions {
  fixedStep?: number;
  maxStepsPerFrame?: number;
  world?: WorldOptions;
  /** Record a state hash after every step. */
  hash?: boolean;
  /** Contact nodes per CollisionSensor per frame (default 16). */
  contactCap?: number;
  /**
   * The scene's running TimeSensors start with physics and pause with it (see clocks.ts): ROUTE-driven (kinematic) parts then move
   * on the same clock as the bodies they carry. Default false (plain X3D semantics).
   */
  clocksFollowPhysics?: boolean;
}

export class X3DPhysXBridge {
  readonly X3D: SAI;
  readonly browser: SAI;
  readonly h: number;
  private readonly worker: Worker;
  private readonly opts: BridgeOptions;
  private read: ReadResult | null = null;
  private writer: Writer | null = null;
  private jointWriter: JointWriter | null = null;
  private sensorWriter: SensorWriter | null = null;
  private humanoidWriter: HumanoidWriter | null = null;
  private sets: SetField[] = [];
  readonly clocks = new SceneClocks();
  private nextId = 1;
  private pending = new Map<number, (m: FromWorker) => void>();
  private inFlight = false;
  private acc = 0;
  private lastT = 0;
  private raf = 0;
  private targets = new Map<number, { index: number; p: Vec3; q: Quat }>();
  /** X3D trajectories of kinematic bodies: wall time (s) and pose of every ROUTE event, sampled per physics step (see send). */
  private kinSamples = new Map<number, { t: number[]; p: Vec3[]; q: Quat[] }>();
  /** wall time (s) = simWallOffset + physics time, while running. */
  private simWallOffset = 0;
  private simSent = 0;
  private teleports: Extract<ToWorker, { t: 'step' }>['teleports'] = [];
  private listeners: ((e: StateEvent) => void)[] = [];
  private stepWindow: { t: number; steps: number }[] = [];
  running = false;
  /** True while a recorded run is being replayed. */
  replaying = false;
  speed = 1;
  readonly ready: Promise<{ version: string; loadMs: number }>;
  stats: BridgeStats = { physxVersion: '', wasmLoadMs: 0, buildMs: 0, stepCount: 0, simTime: 0, lastPhysicsMs: 0, physicsMsPerStep: 0, stepsPerSecond: 0, frames: 0, contactsLastFrame: 0, contactsDropped: 0, newContacts: 0, createStalls: 0, clockHolds: 0 };
  lastState: Float64Array | null = null;
  lastJoints: Float64Array | null = null;
  private recording: RunLog | null = null;

  constructor(X3D: SAI, canvas: SAI, opts: BridgeOptions = {}) {
    this.X3D = X3D;
    this.browser = canvas.browser;
    this.opts = opts;
    this.h = opts.fixedStep ?? 1 / 240;
    this.worker = new Worker(new URL('./physx-worker.ts', import.meta.url), { type: 'module' });
    let resolveReady!: (v: { version: string; loadMs: number }) => void;
    this.ready = new Promise((r) => (resolveReady = r));
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.t === 'ready') { this.stats.physxVersion = m.version; this.stats.wasmLoadMs = m.loadMs; resolveReady({ version: m.version, loadMs: m.loadMs }); return; }
      if (m.t === 'error') console.error('[physx worker]', m.message);
      const cb = this.pending.get(m.id);
      if (cb) { this.pending.delete(m.id); cb(m); }
    };
  }

  private call<T extends FromWorker>(msg: ToWorker): Promise<T> {
    return new Promise((res, rej) => {
      this.pending.set(msg.id, (m) => (m.t === 'error' ? rej(new Error(m.message)) : res(m as T)));
      this.worker.postMessage(msg);
    });
  }

  get model() { return this.read?.model ?? null; }
  get report(): LossReport | null { return this.read?.report ?? null; }
  get bodyNodes(): SAI[] { return this.read?.bodyNodes ?? []; }
  get readResult() { return this.read; }
  get scene(): SAI { return this.browser.currentScene; }

  /** Load a standard X3D scene from a URL: create it off-screen, switch X_ITE's engine off, read it, show it, build it in PhysX. */
  async load(url: string) {
    this.pause();
    return this.show(await this.browser.createX3DFromURL(new this.X3D.MFString(url)), url);
  }

  /** The same from X3D text (the Marble Machine's generated scenes). */
  async loadString(xml: string, source: string) {
    this.pause();
    return this.show(await this.createFromString(xml), source);
  }

  /**
   * X_ITE's createX3DFromString occasionally never resolves in WebKit (measured: 1 to 2 stalls in 4 back-to-back loads of the 266 KB
   * Galton scene; with or without sound or downloads); calling it again works. So: a watchdog scaled to the text's size, three retries.
   */
  private async createFromString(xml: string) {
    const wait = 3000 + xml.length / 50; // ms: 3 s plus 1 s per 50 KB (normal parses: 0.7–2.5 s)
    for (let k = 0; k < 4; k++) {
      let timer = 0;
      const r = await Promise.race([this.browser.createX3DFromString(xml), new Promise((res) => { timer = window.setTimeout(() => res(null), wait); })]);
      clearTimeout(timer);
      if (r) return r;
      this.stats.createStalls++;
      console.warn(`[x3d-physx] createX3DFromString did not resolve in ${(wait / 1000).toFixed(0)} s; trying again (${k + 1})`);
    }
    throw new Error('createX3DFromString did not resolve after four attempts');
  }

  private async show(scene: SAI, source: string) {
    const authored = takeOverEngine(scene, this.X3D);
    this.read = readScene(scene, source, authored, { fixedStep: this.h });
    await this.browser.replaceWorld(scene);
    if (this.opts.clocksFollowPhysics) await this.clocks.hold(scene);
    for (const index of this.read.kinematic) this.watchKinematic(index);
    this.watchLiveInputs();
    await this.rebuild();
    return this.read;
  }

  /** (Re)build the PhysX world from the model read from the scene (or a given one, for a replay): this is also "reset". */
  async rebuild(model?: SceneModel) {
    if (!this.read) throw new Error('nothing loaded');
    await this.ready;
    const m = await this.call<Extract<FromWorker, { t: 'built' }>>({ t: 'build', id: this.nextId++, model: model ?? this.read.model, opts: this.worldOptions() });
    this.stats.buildMs = m.buildMs;
    this.read.report.notes = m.notes;
    const all: boolean[] = [];
    for (const c of this.read.model.collections) for (const b of c.bodies) all[b.index] = !b.fixed && b.enabled;
    this.writer = new Writer(this.X3D, this.read.bodyNodes, all);
    const joints = this.read.model.collections.flatMap((c) => c.joints).sort((a, b) => a.index - b.index);
    this.jointWriter = new JointWriter(this.X3D, this.read.jointNodes, joints);
    this.sensorWriter = new SensorWriter(this.X3D, this.scene, this.read.sensors.map((x) => ({
      node: x.node, shapes: x.shapes, enabled: x.enabled, surface: this.read!.model.collections[x.collection]?.surface ?? null, colliderNode: x.node.collider,
    })), this.read.bodyNodes, this.read.shapeNodes, this.opts.contactCap ?? 16);
    this.sets = [];
    this.acc = 0; this.stats.stepCount = 0; this.stats.simTime = 0; this.stats.newContacts = 0; this.simSent = 0; this.kinSamples.clear();
    this.targets.clear(); this.teleports = [];
    // write the initial state so a reset also resets the X3D side
    const links = (this.read.model.humanoids ?? []).reduce((n, h) => n + h.links.length, 0);
    const init = new Float64Array((this.read.bodyNodes.length + links) * BODY_STRIDE);
    for (const c of this.read.model.collections) for (const b of c.bodies) {
      const o = b.index * BODY_STRIDE;
      init.set(b.pose.p, o); init.set(b.pose.q, o + 3); init.set(b.linearVelocity, o + 7); init.set(b.angularVelocity, o + 10);
    }
    // ragdoll links start at their joint centres, placed by the humanoid's pose, axes along it
    for (const h of this.read.model.humanoids ?? []) for (const L of h.links) {
      const c = quatRotate(h.pose.q, L.center), o = L.index * BODY_STRIDE;
      init.set([h.pose.p[0] + c[0], h.pose.p[1] + c[1], h.pose.p[2] + c[2]], o); init.set(h.pose.q, o + 3);
    }
    this.humanoidWriter = this.read.humanoids.length ? new HumanoidWriter(this.X3D, this.read.humanoids) : null;
    this.writer.apply(init);
    this.humanoidWriter?.apply(init);
    this.lastState = init;
  }

  worldOptions(): WorldOptions {
    const o: WorldOptions = { contacts: this.read?.sensors.length ? 'all' : 'found', ...this.opts.world };
    // 'sensed': report only pairs touching a collidable some CollisionSensor watches
    if (o.contacts === 'sensed') o.reportShapes = [...new Set((this.read?.sensors ?? []).flatMap((x) => [...x.shapes]))].sort((a, b) => a - b);
    return o;
  }

  private watchKinematic(index: number) {
    const node = this.read!.bodyNodes[index];
    const update = () => {
      const p = node.position, r = node.orientation, t = performance.now() / 1000;
      const k = this.kinSamples.get(index) ?? { t: [], p: [], q: [] };
      if (k.t.length && t - k.t[k.t.length - 1] < 1e-4) { k.t.pop(); k.p.pop(); k.q.pop(); } // position and orientation in the same frame
      k.t.push(t); k.p.push([p.x, p.y, p.z]); k.q.push(axisAngleToQuat(r.x, r.y, r.z, r.angle));
      while (k.t.length > 2 && k.t[1] < t - 2) { k.t.shift(); k.p.shift(); k.q.shift(); } // keep about 2 s
      this.kinSamples.set(index, k);
    };
    node.addFieldCallback('x3d-physx-kin-p', 'position', update);
    node.addFieldCallback('x3d-physx-kin-o', 'orientation', update);
  }

  /** Forward runtime changes of live inputs (MotorJoint torques, hinge2 drives, slider force, RigidBody forces/torques) as set_field commands. */
  private watchLiveInputs() {
    const r = this.read!;
    r.jointNodes.forEach((node, index) => {
      for (const field of LIVE_JOINT_FIELDS[node.getNodeTypeName()] ?? [])
        node.addFieldCallback(`x3d-physx-${field}`, field, (v: number) => this.sets.push({ kind: 'joint', index, field, value: Number(v) }));
    });
    // RigidBodyCollection.joints: a joint removed at run time is released in PhysX (adding joints needs a reload: reported)
    const removed = new Set<number>();
    r.collectionNodes.forEach((coll, ci) => {
      coll.addFieldCallback('x3d-physx-joints', 'joints', (mf: SAI) => {
        // match by DEF name (SAI wrappers need not be the same objects), else by the wrapped node
        const id = (n: SAI) => n?.getNodeName?.() || n?.getValue?.() || n;
        const now = new Set<unknown>();
        for (let k = 0; k < mf.length; k++) now.add(id(mf[k]));
        r.jointNodes.forEach((j, index) => {
          if (!removed.has(index) && !now.has(id(j))) { removed.add(index); this.sets.push({ kind: 'jointRemove', index, field: 'joints', value: 0 }); }
        });
        if (mf.length > r.jointNodes.length - removed.size) console.warn('[x3d-physx] joints added at run time are not built until the scene is reloaded');
      });
      coll.addFieldCallback('x3d-physx-gravity', 'gravity', (g: SAI) => this.sets.push({ kind: 'gravity', index: ci, field: 'gravity', value: [g.x, g.y, g.z] }));
    });
    // HAnimJoint.stiffness (live): the drive towards the bind pose (stiff with fear at the top of the stairs, limp after the push)
    for (const h of r.humanoids) h.joints.forEach((j, k) => { if (k > 0) j.addFieldCallback('x3d-physx-stiffness', 'stiffness', (mf: SAI) => this.sets.push({ kind: 'stiffness', index: h.model.links[k].index, field: 'stiffness', value: [Number(mf[0] ?? 0), Number(mf[1] ?? 0), Number(mf[2] ?? 0)] })); });
    r.shapeNodes.forEach((node, index) => {
      node.addFieldCallback('x3d-physx-enabled', 'enabled', (on: boolean) => this.sets.push({ kind: 'shape', index, field: 'enabled', value: on ? 1 : 0 }));
    });
    r.bodyNodes.forEach((node, index) => {
      for (const field of ['forces', 'torques'])
        node.addFieldCallback(`x3d-physx-${field}`, field, (mf: SAI) => {
          const sum: Vec3 = [0, 0, 0];
          for (let k = 0; k < mf.length; k++) { sum[0] += mf[k].x; sum[1] += mf[k].y; sum[2] += mf[k].z; }
          this.sets.push({ kind: 'body', index, field, value: sum });
        });
    });
  }

  /** set_field from code (UI buttons): writes the X3D field, which the watchers forward to PhysX. */
  setField(def: string, field: string, value: unknown) { this.scene.getNamedNode(def)[field] = value; }

  /** Move a dynamic body (drop a marble, reset one body). Applied before the next step. */
  teleport(index: number, p: Vec3, q: Quat = [0, 0, 0, 1], v: Vec3 = [0, 0, 0], w: Vec3 = [0, 0, 0]) { this.teleports.push({ index, p, q, v, w }); }

  onState(fn: (e: StateEvent) => void) { this.listeners.push(fn); }

  /** A one-off impulse (N·s) on a body or a ragdoll link, applied before the next step (recorded with the run). */
  impulse(index: number, J: Vec3) { this.sets.push({ kind: 'impulse', index, field: 'impulse', value: J }); }

  run() {
    if (this.running) return;
    this.running = true;
    this.clocks.start();
    // Re-sync kinematic bodies to their X3D pose (they may have moved while physics was paused): teleport, no sweep.
    for (const index of this.read?.kinematic ?? []) {
      const node = this.read!.bodyNodes[index], p = node.position, r = node.orientation;
      this.targets.delete(index); this.kinSamples.delete(index);
      this.teleport(index, [p.x, p.y, p.z], axisAngleToQuat(r.x, r.y, r.z, r.angle));
    }
    this.simSent = this.stats.simTime;
    this.simWallOffset = performance.now() / 1000 - this.simSent;
    this.lastT = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (t - this.lastT) / 1000);
      this.lastT = t;
      // clocks follow physics: while physics is more than 0.1 s behind, the scene's TimeSensors are paused and wall time is not
      // added, so ROUTE-driven (kinematic) parts slow down with the simulation instead of jumping ahead of it
      if (!this.clocksHeld) this.acc += dt * this.speed;
      this.followClocks();
      this.pump();
      this.stats.frames++;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() { if (this.running && !this.clocksHeld) this.clocks.pause(); this.clocksHeld = false; this.running = false; cancelAnimationFrame(this.raf); }

  /** True while the scene's clocks wait for physics to catch up (see run). */
  private clocksHeld = false;
  private followClocks() {
    if (!this.opts.clocksFollowPhysics || !this.clocks.count) return;
    if (!this.clocksHeld && this.acc > 0.1) { this.clocks.pause(); this.clocksHeld = true; this.stats.clockHolds++; }
    else if (this.clocksHeld && this.acc < 0.03) {
      this.clocks.start(); this.clocksHeld = false;
      // the paused interval is excluded on both sides: X3D clocks did not advance, and physics' wall-time mapping moves on by it
      this.simWallOffset = performance.now() / 1000 - this.simSent;
    }
  }

  /** Advance exactly n steps (paused stepping, tests, replay). */
  async step(n: number) { return this.send(n); }

  /**
   * Fixed-step clock. Up to maxStepsPerFrame steps per frame; time beyond that is caught up over the next frames, and only a lag above
   * 0.5 s is dropped (no spiral of death). Dropping time on every long frame made a ROUTE-driven platform (whose X3D clock keeps wall
   * time) jump and throw what it carried (measured: 2 cm hops after Playwright screenshot stalls).
   */
  private pump() {
    if (this.inFlight) return;
    const max = this.opts.maxStepsPerFrame ?? 16;
    if (this.acc > 0.5) { const drop = this.acc - 0.5; this.acc = 0.5; this.simWallOffset += drop / Math.max(this.speed, 1e-6); }
    const n = Math.min(Math.floor(this.acc / this.h), max);
    if (n < 1) return;
    this.acc -= n * this.h;
    void this.send(n);
  }

  /** Kinematic paths: each kinematic body's X3D trajectory sampled at the wall time of each of the next n steps. */
  private kinematicPaths(n: number) {
    const out: { index: number; p: number[]; q: number[] }[] = [];
    for (const [index, k] of this.kinSamples) {
      if (!k.t.length) continue;
      const p: number[] = [], q: number[] = [];
      let j = 0;
      for (let s = 1; s <= n; s++) {
        const tw = this.simWallOffset + (this.simSent + s * this.h) / 1; // wall time of this step
        while (j + 1 < k.t.length && k.t[j + 1] <= tw) j++;
        const a = k.t[j] >= tw || j + 1 >= k.t.length ? 0 : (tw - k.t[j]) / (k.t[j + 1] - k.t[j]);
        const i1 = Math.min(j + 1, k.t.length - 1);
        const P0 = k.p[j], P1 = k.p[i1], Q0 = k.q[j], Q1 = k.q[i1];
        const sg = Q0[0] * Q1[0] + Q0[1] * Q1[1] + Q0[2] * Q1[2] + Q0[3] * Q1[3] < 0 ? -1 : 1;
        const qq = [0, 1, 2, 3].map((c) => Q0[c] * (1 - a) + sg * Q1[c] * a), qn = Math.hypot(...qq) || 1;
        p.push(...[0, 1, 2].map((c) => P0[c] * (1 - a) + P1[c] * a)); q.push(...qq.map((x) => x / qn));
      }
      out.push({ index, p, q });
    }
    return out;
  }

  private async send(n: number) {
    this.inFlight = true;
    const msg: ToWorker = { t: 'step', id: this.nextId++, n, hash: !!this.opts.hash || !!this.recording, targets: [...this.targets.values()], paths: this.running ? this.kinematicPaths(n) : [], teleports: this.teleports, sets: this.sets };
    const rec = this.recording;
    if (rec) rec.messages.push({ n: msg.n, targets: msg.targets, paths: msg.paths, teleports: msg.teleports, sets: msg.sets });
    this.simSent += n * this.h;
    this.targets.clear(); this.teleports = []; this.sets = [];
    try {
      const m = await this.call<Extract<FromWorker, { t: 'state' }>>(msg);
      if (rec) rec.hashes.push(...m.hashes);
      this.writer?.apply(m.state);
      this.humanoidWriter?.apply(m.state);
      this.jointWriter?.apply(m.joints);
      this.sensorWriter?.apply(m.contacts);
      this.lastState = m.state;
      this.lastJoints = m.joints;
      const now = performance.now();
      this.stepWindow.push({ t: now, steps: m.n });
      while (this.stepWindow.length && now - this.stepWindow[0].t > 1000) this.stepWindow.shift();
      Object.assign(this.stats, {
        stepCount: m.stepCount, simTime: m.time, lastPhysicsMs: m.physicsMs, physicsMsPerStep: m.physicsMs / m.n,
        stepsPerSecond: this.stepWindow.reduce((s, x) => s + x.steps, 0), contactsLastFrame: m.contacts.length / 13, contactsDropped: this.stats.contactsDropped + m.contactsDropped,
        newContacts: this.stats.newContacts + m.events.length / 13,
      });
      const ev: StateEvent = { stepCount: m.stepCount, time: m.time, state: m.state, joints: m.joints, contacts: m.contacts, events: m.events, hashes: m.hashes };
      for (const l of this.listeners) l(ev);
      return ev;
    } finally {
      this.inFlight = false;
    }
  }

  // ---------------------------------------------------------------- record and replay

  /** Reset to the authored initial state and record every step from there (inputs and state hashes). */
  async startRecording(context?: unknown) {
    this.pause();
    await this.rebuild();
    this.recording = { format: 'x3d-physx-run/1', source: this.read?.model.source ?? '', fixedStep: this.h, physx: this.stats.physxVersion, recordedIn: navigator.userAgent, context, model: structuredClone(this.read!.model), world: this.worldOptions(), messages: [], hashes: [] };
  }
  get isRecording() { return !!this.recording; }
  stopRecording(): RunLog | null { const r = this.recording; this.recording = null; return r; }

  /**
   * Re-simulate a recorded run from the authored initial state, sending the same step messages, and compare every step's state hash.
   * `realtime` paces it like the original; otherwise it runs as fast as the worker allows (X3D still shows each batch).
   */
  async replay(log: RunLog, o: { realtime?: boolean; speed?: number; events?: boolean; onProgress?: (step: number) => void } = {}): Promise<ReplayResult> {
    if (log.fixedStep !== this.h) throw new Error(`recorded with step ${log.fixedStep}, bridge uses ${this.h}`);
    this.pause();
    await this.rebuild(log.model);
    this.replaying = true;
    let k = 0, mismatches = 0, firstMismatch = -1;
    const t0 = performance.now();
    for (const m of log.messages) {
      const tStart = performance.now();
      this.inFlight = true;
      try {
        const r = await this.call<Extract<FromWorker, { t: 'state' }>>({ t: 'step', id: this.nextId++, hash: true, ...m });
        this.writer?.apply(r.state); this.humanoidWriter?.apply(r.state); this.jointWriter?.apply(r.joints); this.lastState = r.state;
        Object.assign(this.stats, { stepCount: r.stepCount, simTime: r.time });
        for (const hsh of r.hashes) { if (hsh !== log.hashes[k]) { mismatches++; if (firstMismatch < 0) firstMismatch = k; } k++; }
        // listeners hear the replay too (sound, pop-ups) when asked; pages can tell it is a replay from bridge.replaying
        if (o.events) for (const l of this.listeners) l({ stepCount: r.stepCount, time: r.time, state: r.state, joints: r.joints, contacts: r.contacts, events: r.events, hashes: r.hashes });
      } finally { this.inFlight = false; }
      o.onProgress?.(k);
      if (o.realtime) { const wait = (m.n * this.h * 1000) / (o.speed ?? 1) - (performance.now() - tStart); if (wait > 1) await new Promise((r) => setTimeout(r, wait)); }
    }
    this.replaying = false;
    return { steps: k, mismatches, firstMismatch, ms: performance.now() - t0 };
  }

  dispose() { this.pause(); this.worker.terminate(); }
}
