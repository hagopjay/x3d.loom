import type { ControlSettings } from './controllers';
import loadMujoco from "@mujoco/mujoco";
// vite-plugin-singlefile inlines this as a data: URL; we fetch it and hand the
// bytes to Emscripten via `wasmBinary`, so no separate .wasm file is needed.
import wasmUrl from "@mujoco/mujoco/mujoco.wasm?url";

export type EngineStatus = "loading" | "ready" | "error";
export type LogKind = "info" | "ok" | "warn" | "error";
export interface LogLine {
  t: number;
  kind: LogKind;
  text: string;
}

export interface SeriesDef {
  id: string;
  label: string;
  group: string;
  color: string;
  read: (e: MuJoCoEngine) => number;
}

export interface SimSummary {
  seconds: number;
  steps: number;
  maxSpeed: number;
  contactsEver: number;
  minZ: number;
  maxZ: number;
  qmin: number[];
  qmax: number[];
  finalQpos: number[];
  finalTime: number;
}

const PALETTE = [
  "#38bdf8", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#fb7185",
  "#34d399", "#f97316", "#22d3ee", "#e879f9", "#facc15", "#818cf8",
];

/** Reverse-lookup an Embind enum object ({ mjFOO: {value: n} }) to a short label. */
export function enumLabel(enumObj: any, value: number): string {
  if (!enumObj) return String(value);
  for (const k of Object.keys(enumObj)) {
    const v = (enumObj as any)[k];
    if (v && typeof v === "object" && typeof v.value === "number" && v.value === value) {
      return k.replace(/^mj[A-Z]+_/, "");
    }
  }
  return String(value);
}

export class MuJoCoEngine {
  mujoco: any = null;
  model: any = null;
  data: any = null;
  status: EngineStatus = "loading";
  errorMsg: string | null = null;
  version = "";
  xml = "";
  running = true;
  speed = 1;
  controller: ((e: MuJoCoEngine) => void) | null = null;
  controlRecord: ControlSettings | null = null;
  droppedSeconds = 0;
  series: SeriesDef[] = [];
  telemetry: { t: number; v: number[] }[] = [];
  logs: LogLine[] = [];
  private listeners: Record<string, Array<(...args: any[]) => void>> = {};
  private initPromise: Promise<void> | null = null;
  private accumulator = 0;

  on(evt: string, cb: (...args: any[]) => void): () => void {
    (this.listeners[evt] ??= []).push(cb);
    return () => {
      this.listeners[evt] = (this.listeners[evt] ?? []).filter((f) => f !== cb);
    };
  }

  private emit(evt: string, ...args: any[]): void {
    for (const f of this.listeners[evt] ?? []) {
      try {
        f(...args);
      } catch {
        /* listener errors must never break the sim */
      }
    }
  }

  log(kind: LogKind, text: string): void {
    this.logs.push({ t: performance.now(), kind, text });
    if (this.logs.length > 300) this.logs.splice(0, this.logs.length - 300);
    this.emit("log");
  }

  init(): Promise<void> {
    // React StrictMode may repeat the mount effect while WASM is still loading.
    // A model must never be paired with data from a second module instance.
    this.initPromise ??= this.initialize();
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      this.log("info", "fetching MuJoCo WASM binary…");
      const res = await fetch(wasmUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} while fetching the .wasm module`);
      const buf = await res.arrayBuffer();
      this.log("info", `wasm ${(buf.byteLength / 1048576).toFixed(1)} MB — instantiating…`);
      this.mujoco = await loadMujoco({ wasmBinary: buf });
      this.version = String(this.mujoco.mj_versionString());
      this.status = "ready";
      this.log("ok", `MuJoCo ${this.version} ready (official DeepMind WASM bindings, single-threaded)`);
    } catch (e: any) {
      this.status = "error";
      this.errorMsg = e?.message ?? String(e);
      this.log("error", `WASM init failed: ${this.errorMsg}`);
    }
    this.emit("status");
  }

  get ready(): boolean {
    return this.status === "ready" && !!this.model && !!this.data;
  }

  get OBJ(): any {
    return this.mujoco?.mjtObj ?? {};
  }

  objId(type: number, name: string): number {
    try {
      return this.mujoco.mj_name2id(this.model, type, name) as number;
    } catch {
      return -1;
    }
  }

  nameOf(type: number, id: number): string {
    try {
      return (this.mujoco.mj_id2name(this.model, type, id) as string) || `#${id}`;
    } catch {
      return `#${id}`;
    }
  }

  /** Cheap client-side well-formedness check so we can report line numbers. */
  validateXml(xml: string): void {
    if (typeof DOMParser === "undefined") return; // non-DOM env: let the compiler report errors
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) {
      const msg = (err.textContent ?? "XML well-formedness error").trim().split("\n")[0];
      throw new Error(`XML parse error — ${msg}`);
    }
    const root = doc.documentElement;
    if (!root || root.tagName !== "mujoco") {
      throw new Error(`MJCF root element must be <mujoco> (found <${root?.tagName ?? "nothing"}>)`);
    }
  }

  loadXML(xml: string): void {
    if (!this.mujoco) throw new Error("engine not initialized yet");
    this.validateXml(xml);
    let model: any = null;
    let data: any = null;
    try {
      model = this.mujoco.MjModel.from_xml_string(xml);
      if (!model) throw new Error("compiler returned a null model");
      data = new this.mujoco.MjData(model);
      this.mujoco.mj_resetData(model, data);
      this.mujoco.mj_forward(model, data);
    } catch (e: any) {
      data?.delete?.();
      model?.delete?.();
      throw new Error("MJCF compile error: " + (e?.message ?? String(e)));
    }
    const previousModel = this.model;
    const previousData = this.data;
    this.model = model;
    this.data = data;
    try {
      this.buildSeries();
    } catch (e) {
      this.model = previousModel;
      this.data = previousData;
      data.delete();
      model.delete();
      throw e;
    }
    previousData?.delete?.();
    previousModel?.delete?.();
    this.xml = xml;
    this.telemetry = [];
    this.controller = null;
    this.controlRecord = null;
    this.droppedSeconds = 0;
    this.accumulator = 0;
    this.emit("model");
    const m = model;
    this.log(
      "ok",
      `compiled OK — nbody=${m.nbody} njnt=${m.njnt} ngeom=${m.ngeom} nu=${m.nu} nsensor=${m.nsensor} nkey=${m.nkey} nq=${m.nq} nv=${m.nv} timestep=${m.opt.timestep}`,
    );
  }

  private disposeModel(): void {
    try {
      this.data?.delete?.();
    } catch {
      /* noop */
    }
    try {
      this.model?.delete?.();
    } catch {
      /* noop */
    }
    this.data = null;
    this.model = null;
  }

  /** Release this instance's allocations; the initialized WASM module may be shared. */
  dispose(): void {
    this.disposeModel();
    this.controller = null;
    this.controlRecord = null;
    this.droppedSeconds = 0;
    this.accumulator = 0;
    this.telemetry = [];
    this.series = [];
    this.listeners = {};
  }

  /** Independent state for a challenge or experiment, using the current compiled source. */
  fork(): MuJoCoEngine {
    if (!this.ready) throw new Error("no model loaded");
    const copy = new MuJoCoEngine();
    copy.mujoco = this.mujoco;
    copy.status = "ready";
    copy.version = this.version;
    copy.initPromise = Promise.resolve();
    copy.running = false;
    try {
      copy.loadXML(this.xml);
      // Preserve live inspector settings, which have not rewritten the MJCF source.
      for (const [key, value] of Object.entries(this.optionsEditable())) {
        if (Array.isArray(value)) copy.setOptVec(key, value);
        else copy.setOptNum(key, value);
      }
      this.mujoco.mj_forward(copy.model, copy.data);
      return copy;
    } catch (error) {
      copy.dispose();
      throw error;
    }
  }

  reset(key = -1): void {
    if (!this.ready) return;
    if (key >= 0 && key < (this.model.nkey as number)) {
      this.mujoco.mj_resetDataKeyframe(this.model, this.data, key);
      this.log("info", `reset to keyframe "${this.nameOf(this.OBJ.mjOBJ_KEY.value, key)}"`);
    } else {
      this.mujoco.mj_resetData(this.model, this.data);
      this.log("info", "reset to qpos0 (mj_resetData)");
    }
    this.mujoco.mj_forward(this.model, this.data);
    this.telemetry = [];
    this.accumulator = 0;
    this.droppedSeconds = 0;
    this.emit("reset");
  }

  step(n = 1): void {
    if (!this.ready) return;
    if (!Number.isFinite(n) || n < 1) return;
    for (let i = 0; i < Math.floor(n); i++) {
      if (this.controller) {
        try {
          this.controller(this);
        } catch (e: any) {
          this.controller = null;
          this.log("error", `controller threw and was detached: ${e?.message ?? String(e)}`);
        }
      }
      this.mujoco.mj_step(this.model, this.data);
    }
    // mj_step integrates qpos after evaluating position-dependent quantities.
    // Refresh them so the displayed geometry/sensors refer to the current state.
    this.mujoco.mj_forward(this.model, this.data);
  }

  /** Advance the sim by ~frameDt*speed of simulated time. Returns steps taken. */
  advance(frameDt: number): number {
    if (!this.ready || !this.running) {
      this.accumulator = 0;
      return 0;
    }
    const dt = this.model.opt.timestep as number;
    if (!Number.isFinite(dt) || dt <= 0) throw new Error("timestep must be positive");
    if (!Number.isFinite(frameDt) || frameDt <= 0 || !Number.isFinite(this.speed) || this.speed <= 0) return 0;
    // Bound catch-up after a background tab; retain fractional steps across frames.
    this.droppedSeconds += Math.max(0, frameDt - 0.05) * this.speed;
    this.accumulator += Math.min(frameDt, 0.05) * this.speed;
    const available = Math.floor((this.accumulator + dt * 1e-9) / dt);
    const n = Math.min(600, available);
    if (n > 0) this.step(n);
    this.accumulator = Math.max(0, this.accumulator - n * dt);
    if (available > 600) {
      const remainder = this.accumulator % dt;
      this.droppedSeconds += this.accumulator - remainder;
      this.accumulator = remainder;
    }
    return n;
  }

  sampleTelemetry(): void {
    if (!this.ready || this.series.length === 0) return;
    const time = this.data.time as number;
    if (this.telemetry.length && this.telemetry[this.telemetry.length - 1].t === time) return;
    // MuJoCo leaves these disabled by default; compute before presenting a trace.
    this.mujoco.mj_energyPos(this.model, this.data);
    this.mujoco.mj_energyVel(this.model, this.data);
    const v = new Array<number>(this.series.length);
    for (let i = 0; i < this.series.length; i++) {
      try {
        v[i] = this.series[i].read(this);
      } catch {
        v[i] = NaN;
      }
    }
    this.telemetry.push({ t: time, v });
    if (this.telemetry.length > 2600) this.telemetry.splice(0, this.telemetry.length - 2000);
  }

  /**
   * Headless fast-forward used by challenges: runs `seconds` of physics as fast
   * as possible, optionally with a controller, tracking a generic summary.
   */
  simulate(
    seconds: number,
    controller?: (e: MuJoCoEngine) => void,
    onStep?: (e: MuJoCoEngine) => void,
  ): SimSummary {
    if (!this.ready) throw new Error("no model loaded");
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("simulation duration must be positive");
    const prev = this.controller;
    const dt = this.model.opt.timestep as number;
    if (!Number.isFinite(dt) || dt <= 0) throw new Error("timestep must be positive");
    const n = Math.ceil(seconds / dt);
    if (n > 400000) throw new Error("simulation exceeds the 400,000-step interactive limit; increase timestep or shorten duration");
    if (controller) this.controller = controller;
    const nq = this.model.nq as number;
    const qmin = new Array<number>(nq).fill(Infinity);
    const qmax = new Array<number>(nq).fill(-Infinity);
    const s: SimSummary = {
      seconds,
      steps: 0,
      maxSpeed: 0,
      contactsEver: 0,
      minZ: Infinity,
      maxZ: -Infinity,
      qmin,
      qmax,
      finalQpos: [],
      finalTime: 0,
    };
    try {
      for (let i = 0; i < n; i++) {
        this.step(1);
        // Fetch current views after stepping, including after WASM memory growth.
        const qv = this.data.qvel as ArrayLike<number>;
        const qp = this.data.qpos as ArrayLike<number>;
        const xp = this.data.xpos as ArrayLike<number>;
        s.steps++;
        let sp = 0;
        for (let k = 0; k < qv.length; k++) {
          const a = Math.abs(qv[k]);
          if (a > sp) sp = a;
        }
        if (sp > s.maxSpeed) s.maxSpeed = sp;
        if ((this.data.ncon as number) > s.contactsEver) s.contactsEver = this.data.ncon as number;
        if ((this.model.nbody as number) > 1) {
          const z = xp[3 * 1 + 2];
          if (z < s.minZ) s.minZ = z;
          if (z > s.maxZ) s.maxZ = z;
        }
        for (let k = 0; k < nq; k++) {
          const q = qp[k];
          if (q < qmin[k]) qmin[k] = q;
          if (q > qmax[k]) qmax[k] = q;
        }
        onStep?.(this);
      }
      s.finalQpos = Array.from(this.data.qpos as ArrayLike<number>);
      s.finalTime = this.data.time as number;
      return s;
    } finally {
      this.controller = prev;
    }
  }

  private buildSeries(): void {
    const m = this.model;
    const mj = this.mujoco;
    const s: SeriesDef[] = [];
    let ci = 0;
    const add = (id: string, label: string, group: string, read: (e: MuJoCoEngine) => number) => {
      s.push({ id, label, group, color: PALETTE[ci++ % PALETTE.length], read });
    };
    const G = mj.mjtJoint;
    for (let j = 0; j < (m.njnt as number) && s.length < 40; j++) {
      const type = m.jnt_type[j] as number;
      const qa = m.jnt_qposadr[j] as number;
      const da = m.jnt_dofadr[j] as number;
      const nm = this.nameOf(mj.mjtObj.mjOBJ_JOINT.value, j);
      if (type === G.mjJNT_FREE.value) {
        add(`qpos:${nm}:z`, `${nm}.z`, "qpos", (e) => (e.data.qpos as any)[qa + 2]);
        add(`qvel:${nm}:vz`, `${nm}.vz`, "qvel", (e) => (e.data.qvel as any)[da + 2]);
      } else {
        add(`qpos:${nm}`, `qpos ${nm}`, "qpos", (e) => (e.data.qpos as any)[qa]);
        add(`qvel:${nm}`, `qvel ${nm}`, "qvel", (e) => (e.data.qvel as any)[da]);
      }
    }
    for (let i = 0; i < (m.nu as number) && s.length < 48; i++) {
      const nm = this.nameOf(mj.mjtObj.mjOBJ_ACTUATOR.value, i);
      add(`ctrl:${nm}`, `ctrl ${nm}`, "control", (e) => Number(e.data.ctrl[i]));
      add(`force:${nm}`, `force ${nm}`, "actuator", (e) => (e.data.actuator_force as any)[i]);
    }
    for (let i = 0; i < (m.nsensor as number) && s.length < 56; i++) {
      const nm = this.nameOf(mj.mjtObj.mjOBJ_SENSOR.value, i);
      const adr = m.sensor_adr[i] as number;
      const dim = (m.sensor_dim ? (m.sensor_dim[i] as number) : 1) as number;
      for (let k = 0; k < Math.min(dim, 3); k++) {
        add(`sens:${nm}[${k}]`, `${nm}${dim > 1 ? `[${k}]` : ""}`, "sensor", (e) => (e.data.sensordata as any)[adr + k]);
      }
    }
    add("ncon", "contacts", "state", (e) => e.data.ncon as number);
    add("niter", "solver iters", "state", (e) => {
      try {
        const sn = e.data.solver_niter;
        return typeof sn === "number" ? sn : (sn as any)[0] ?? 0;
      } catch {
        return 0;
      }
    });
    add("energy", "energy", "state", (e) => {
      const en = e.data.energy as any;
      return (en[0] ?? 0) + (en[1] ?? 0);
    });
    this.series = s;
  }

  // ---------- introspection ----------

  listBodies() {
    const m = this.model;
    const mj = this.mujoco;
    const out: any[] = [];
    for (let i = 0; i < (m.nbody as number); i++) {
      out.push({
        id: i,
        name: this.nameOf(mj.mjtObj.mjOBJ_BODY.value, i),
        parentName: this.nameOf(mj.mjtObj.mjOBJ_BODY.value, m.body_parentid[i] as number),
        mass: m.body_mass[i] as number,
        pos: Array.from(m.body_pos.slice(i * 3, i * 3 + 3) as any) as number[],
      });
    }
    return out;
  }

  listJoints() {
    const m = this.model;
    const mj = this.mujoco;
    const out: any[] = [];
    for (let j = 0; j < (m.njnt as number); j++) {
      const t = m.jnt_type[j] as number;
      out.push({
        id: j,
        name: this.nameOf(mj.mjtObj.mjOBJ_JOINT.value, j),
        type: enumLabel(mj.mjtJoint, t),
        axis: Array.from(m.jnt_axis.slice(j * 3, j * 3 + 3) as any) as number[],
        range: Array.from(m.jnt_range.slice(j * 2, j * 2 + 2) as any) as number[],
        limited: !!m.jnt_limited[j],
        qposadr: m.jnt_qposadr[j] as number,
        dofadr: m.jnt_dofadr[j] as number,
        body: this.nameOf(mj.mjtObj.mjOBJ_BODY.value, m.body_jntadr ? (m.jnt_bodyid ? m.jnt_bodyid[j] : 0) : 0),
      });
    }
    return out;
  }

  listGeoms() {
    const m = this.model;
    const mj = this.mujoco;
    const out: any[] = [];
    for (let i = 0; i < (m.ngeom as number); i++) {
      out.push({
        id: i,
        name: this.nameOf(mj.mjtObj.mjOBJ_GEOM.value, i),
        type: enumLabel(mj.mjtGeom, m.geom_type[i] as number),
        size: Array.from(m.geom_size.slice(i * 3, i * 3 + 3) as any) as number[],
        rgba: Array.from(m.geom_rgba.slice(i * 4, i * 4 + 4) as any) as number[],
        contype: m.geom_contype[i] as number,
        conaffinity: m.geom_conaffinity[i] as number,
        group: m.geom_group[i] as number,
        body: this.nameOf(mj.mjtObj.mjOBJ_BODY.value, m.geom_bodyid[i] as number),
      });
    }
    return out;
  }

  listActuators() {
    const m = this.model;
    const mj = this.mujoco;
    const out: any[] = [];
    for (let i = 0; i < (m.nu as number); i++) {
      const trnType = m.actuator_trntype[i] as number;
      const trnid = m.actuator_trnid[i * 2] as number;
      const jointName =
        trnType === (mj.mjtTrn?.mjTRN_JOINT?.value ?? 0)
          ? this.nameOf(mj.mjtObj.mjOBJ_JOINT.value, trnid)
          : `#${trnid}`;
      out.push({
        id: i,
        name: this.nameOf(mj.mjtObj.mjOBJ_ACTUATOR.value, i),
        trnType: enumLabel(mj.mjtTrn, trnType),
        jointName,
        gear: Array.from(m.actuator_gear.slice(i * 6, i * 6 + 3) as any) as number[],
        ctrllimited: !!m.actuator_ctrllimited[i],
        ctrlrange: Array.from(m.actuator_ctrlrange.slice(i * 2, i * 2 + 2) as any) as number[],
        forcelimited: !!m.actuator_forcelimited[i],
        forcerange: Array.from(m.actuator_forcerange.slice(i * 2, i * 2 + 2) as any) as number[],
      });
    }
    return out;
  }

  listSensors() {
    const m = this.model;
    const mj = this.mujoco;
    const out: any[] = [];
    for (let i = 0; i < (m.nsensor as number); i++) {
      out.push({
        id: i,
        name: this.nameOf(mj.mjtObj.mjOBJ_SENSOR.value, i),
        type: enumLabel(mj.mjtSensor, m.sensor_type[i] as number),
        dim: (m.sensor_dim ? (m.sensor_dim[i] as number) : 1) as number,
        adr: m.sensor_adr[i] as number,
        cutoff: m.sensor_cutoff[i] as number,
      });
    }
    return out;
  }

  listKeyframes() {
    const m = this.model;
    const mj = this.mujoco;
    const out: any[] = [];
    for (let i = 0; i < (m.nkey as number); i++) {
      out.push({ id: i, name: this.nameOf(mj.mjtObj.mjOBJ_KEY.value, i), time: m.key_time[i] as number });
    }
    return out;
  }

  optionsEditable() {
    const o = this.model.opt;
    return {
      timestep: o.timestep as number,
      iterations: o.iterations as number,
      ls_iterations: o.ls_iterations as number,
      tolerance: o.tolerance as number,
      ls_tolerance: o.ls_tolerance as number,
      noslip_iterations: o.noslip_iterations as number,
      impratio: o.impratio as number,
      density: o.density as number,
      viscosity: o.viscosity as number,
      o_margin: o.o_margin as number,
      enableflags: o.enableflags as number,
      disableflags: o.disableflags as number,
      integrator: o.integrator as number,
      solver: o.solver as number,
      cone: o.cone as number,
      jacobian: o.jacobian as number,
      gravity: Array.from(o.gravity.slice(0, 3) as any) as number[],
      wind: Array.from(o.wind.slice(0, 3) as any) as number[],
      o_solref: Array.from(o.o_solref.slice(0, 2) as any) as number[],
      o_solimp: Array.from(o.o_solimp.slice(0, 5) as any) as number[],
    };
  }

  setOptNum(key: string, v: number): void {
    if (!this.ready || !Number.isFinite(v)) return;
    if (key === "timestep" && v <= 0) return;
    if (["iterations", "ls_iterations", "noslip_iterations"].includes(key) && (v < 0 || !Number.isInteger(v))) return;
    (this.model.opt as any)[key] = v;
    if (key === "timestep") this.accumulator = 0;
  }

  setOptVec(key: string, arr: number[]): void {
    if (!this.ready) return;
    const a = (this.model.opt as any)[key];
    if (!a) return;
    for (let i = 0; i < arr.length && i < a.length; i++) if (Number.isFinite(arr[i])) a[i] = arr[i];
  }

  enumOptions(enumName: string): { label: string; value: number }[] {
    const obj = this.mujoco?.[enumName];
    if (!obj) return [];
    // Embind enum constructors also expose enumerable cache/metadata keys.
    // Only enum instances with a numeric value belong in an option selector.
    return Object.keys(obj).flatMap((key) => {
      const item = (obj as any)[key];
      return item && typeof item.value === "number" ? [{ label: key, value: item.value as number }] : [];
    });
  }

  warnings(): string[] {
    try {
      // In @mujoco/mujoco 3.17, this vector is a member owned by MjData.
      // Deleting it separately double-frees memory when data is destroyed.
      // Its get(i) return values are independent copies and DO require deletion.
      const w = this.data.warning;
      const n = w && w.size ? (w.size() as number) : 0;
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        const st = w.get(i);
        try {
          const c = st?.number ?? 0;
          if (c > 0) out.push(`${enumLabel(this.mujoco.mjtWarning, i)} ×${c}`);
        } finally {
          st?.delete?.();
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}
