// Reader: X3D RigidBodyPhysics nodes, read through X_ITE's SAI -> engine-neutral SceneModel + the per-scene loss report.
import { CONTRACT } from './model.ts';
import { readHumanoids } from './hanim.ts';
import type { HumanoidRead } from './hanim.ts';
import type { BodyModel, CollectionModel, GeomModel, JointModel, JointType, MassDensityModel, Pose, Quat, SceneModel, ShapeModel, SurfaceModel, Vec3 } from './model.ts';
import { axisAngleToQuat, conePoints, cylinderPoints, quatMul, quatRotate } from './math.ts';
import { MAPPING } from './mapping.ts';
import type { Status } from './mapping.ts';
import UOM from './uom-rigidbody-4.0.json' with { type: 'json' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAINode = any;

export interface LossField { status: Status; how: string; authored: boolean; value?: string }
export interface LossNode { node: string; def: string; fields: Record<string, LossField> }
export interface LossReport {
  contract: string;
  source: string;
  engine: string;
  nodes: LossNode[];
  /** Build-time notes from the PhysX world (approximations decided per object). */
  notes: { def: string; node: string; field: string; status: string; how: string }[];
  /** Fields the author set (non-default) whose meaning is lost: the honest short list. */
  lostAuthored: { node: string; def: string; field: string; how: string }[];
  summary: Record<string, number>;
}

export interface ReadResult {
  model: SceneModel;
  report: LossReport;
  /** SAI nodes by body index (the writer's targets). */
  bodyNodes: SAINode[];
  /** Body indices driven by ROUTEs (kinematic), with their SAI nodes. */
  kinematic: number[];
  /** CollisionSensor SAI nodes, the collection they observe, the shapes their collider covers, and their authored enabled. */
  sensors: { node: SAINode; collection: number; shapes: Set<number>; enabled: boolean; def: string }[];
  /** Joint SAI nodes by global joint index, with their authored forceOutput. */
  jointNodes: SAINode[];
  /** SAI nodes of the collections (to switch X_ITE's own engine off). */
  collectionNodes: SAINode[];
  /** Collidable SAI nodes by global shape order (for Contact.geometry1/2). */
  shapeNodes: SAINode[];
  /** H-Anim humanoids read as ragdolls (their links follow the bodies in the body index space). */
  humanoids: HumanoidRead[];
}

const JOINTS: JointType[] = ['BallJoint', 'SingleAxisHingeJoint', 'DoubleAxisHingeJoint', 'SliderJoint', 'UniversalJoint', 'MotorJoint'];
const uom = UOM as Record<string, Record<string, { access: string; type: string; default: string | null }>>;

const typeName = (n: SAINode): string => (n ? n.getNodeTypeName() : '');
const defName = (n: SAINode): string => (n ? n.getNodeName() || '' : '');
/** X_ITE hands out SFNode wrappers; identity is the wrapped node. */
const key = (n: SAINode): unknown => (n && typeof n.getValue === 'function' ? n.getValue() : n);

const v3 = (f: SAINode): Vec3 => [f.x, f.y, f.z];
const rot = (f: SAINode): Quat => axisAngleToQuat(f.x, f.y, f.z, f.angle);
const strings = (f: SAINode): string[] => Array.from({ length: f.length }, (_, i) => String(f[i]));

/** Generic field value -> list of numbers or strings, for default comparison and the report. */
function flat(f: SAINode): (number | string | boolean)[] | null {
  if (f === null || f === undefined) return null;
  if (typeof f === 'number' || typeof f === 'boolean' || typeof f === 'string') return [f];
  if (typeof f.getNodeTypeName === 'function') return null; // SFNode
  if ('angle' in f) return [f.x, f.y, f.z, f.angle];
  if ('z' in f) return [f.x, f.y, f.z];
  if ('y' in f && 'x' in f) return [f.x, f.y];
  if (typeof f.length === 'number') {
    const out: (number | string | boolean)[] = [];
    for (let i = 0; i < f.length; i++) { const e = f[i]; const fe = typeof e === 'object' && e !== null ? flat(e) : [e]; if (fe === null) return null; out.push(...fe); }
    return out;
  }
  return null;
}
function parseDefault(d: string | null): (number | string | boolean)[] {
  if (d === null || d === '' || d === 'NULL') return [];
  if (d.includes('"')) return [...d.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return d.trim().split(/[\s,]+/).map((t) => (t === 'true' ? true : t === 'false' ? false : Number.isNaN(Number(t)) ? t : Number(t)));
}
function isDefault(value: (number | string | boolean)[] | null, def: string | null): boolean {
  if (value === null) return true;
  const d = parseDefault(def);
  if (value.length !== d.length) return false;
  return value.every((x, i) => (typeof x === 'number' && typeof d[i] === 'number' ? Math.abs(x - (d[i] as number)) < 1e-6 : x === d[i]));
}

/** Walk every node reachable from the root nodes (children, and any SFNode/MFNode field). */
function walk(scene: SAINode, visit: (n: SAINode) => void) {
  const seen = new Set<unknown>();
  const stack: SAINode[] = [];
  for (let i = 0; i < scene.rootNodes.length; i++) stack.push(scene.rootNodes[i]);
  while (stack.length) {
    const n = stack.pop();
    if (!n || seen.has(key(n))) continue;
    seen.add(key(n));
    visit(n);
    for (const fd of n.getFieldDefinitions()) {
      // X3DConstants: initializeOnly 0b001, inputOnly 0b010, outputOnly 0b100, inputOutput 0b111. Only fields that hold a value are walked.
      // (Phase 1 skipped 1 = initializeOnly by mistake, which hid RigidBodyCollection.collider from the loss report.)
      if (fd.accessType === 0b010 || fd.accessType === 0b100) continue;
      let v: SAINode;
      try { v = n[fd.name]; } catch { continue; }
      if (!v || typeof v !== 'object') continue;
      if (typeof v.getNodeTypeName === 'function') stack.push(v);
      else if (fd.dataType !== undefined && typeof v.length === 'number' && v.length && typeof v[0]?.getNodeTypeName === 'function') for (let i = 0; i < v.length; i++) stack.push(v[i]);
    }
  }
}

function geometryOf(shapeNode: SAINode, defHint: string, sides: number): GeomModel | null {
  const geo = shapeNode?.geometry;
  if (!geo) return null;
  switch (typeName(geo)) {
    case 'Box': { const s = v3(geo.size); return { kind: 'box', half: [s[0] / 2, s[1] / 2, s[2] / 2] }; }
    case 'Sphere': return { kind: 'sphere', radius: geo.radius };
    case 'Cylinder': return { kind: 'convex', points: cylinderPoints(geo.radius, geo.height, sides), from: `Cylinder (${sides}-sided hull)` };
    case 'Cone': return { kind: 'convex', points: conePoints(geo.bottomRadius, geo.height, sides), from: `Cone (${sides}-sided hull)` };
    case 'IndexedFaceSet': case 'IndexedTriangleSet': case 'TriangleSet': {
      const pts = geo.coord?.point; if (!pts) return null;
      const points: number[] = [];
      for (let i = 0; i < pts.length; i++) points.push(pts[i].x, pts[i].y, pts[i].z);
      const indices: number[] = [];
      const t = typeName(geo);
      if (t === 'IndexedFaceSet') {
        let face: number[] = [];
        const ci = geo.coordIndex;
        const flush = () => { for (let k = 1; k + 1 < face.length; k++) indices.push(face[0], face[k], face[k + 1]); face = []; };
        for (let i = 0; i < ci.length; i++) { if (ci[i] < 0) flush(); else face.push(ci[i]); }
        flush();
      } else if (t === 'IndexedTriangleSet') { const ix = geo.index; for (let i = 0; i + 2 < ix.length; i += 3) indices.push(ix[i], ix[i + 1], ix[i + 2]); }
      else for (let i = 0; i + 2 < pts.length; i += 3) indices.push(i, i + 1, i + 2);
      return { kind: 'mesh', points, indices, from: `${t} ${defHint}` };
    }
    default: return null;
  }
}

/** All nodes of the given type names reachable from the scene's root nodes. */
export function findNodes(scene: SAINode, ...types: string[]): SAINode[] {
  const out: SAINode[] = [];
  walk(scene, (n) => { if (types.includes(typeName(n))) out.push(n); });
  return out;
}

/** What the author wrote in the fields the bridge switches off in X_ITE. */
export interface Authored { enabled: Map<unknown, boolean>; forceOutput: Map<unknown, string[]> }

/**
 * Switch X_ITE's own engine (ammo.js/Bullet) off before the scene is shown, keeping the authored values:
 * RigidBodyCollection.enabled (stops Bullet), CollisionSensor.enabled + a collider re-assignment (X_ITE re-checks enabled only then;
 * otherwise its sensor resets isActive every frame), joint forceOutput = NONE (otherwise X_ITE writes its own joint outputs on every body change).
 * Measured in Chromium, Firefox and WebKit (probes/enabled.html, probes/outputs.html).
 */
export function takeOverEngine(scene: SAINode, X3D: SAINode): Authored {
  const a: Authored = { enabled: new Map(), forceOutput: new Map() };
  walk(scene, (n) => {
    const t = typeName(n);
    if (t === 'RigidBodyCollection') { a.enabled.set(key(n), !!n.enabled); n.enabled = false; }
    else if (t === 'CollisionSensor') { a.enabled.set(key(n), !!n.enabled); n.enabled = false; n.collider = n.collider; }
    else if (JOINTS.includes(t as JointType)) { a.forceOutput.set(key(n), strings(n.forceOutput)); n.forceOutput = new X3D.MFString('NONE'); }
  });
  return a;
}

/** The phase-1 name: only switches the collections off (used for the plain-Bullet side, which keeps its sensors and joint outputs). */
export function disableCollections(scene: SAINode): Map<unknown, boolean> {
  const authored = new Map<unknown, boolean>();
  walk(scene, (n) => { if (typeName(n) === 'RigidBodyCollection') { authored.set(key(n), !!n.enabled); n.enabled = false; } });
  return authored;
}

export interface ReadOptions { hullSides?: number; fixedStep?: number }

/** Read a scene. The caller has already set every RigidBodyCollection.enabled = FALSE in X_ITE (the bridge does it before showing the scene). */
export function readScene(scene: SAINode, source: string, authored: Authored | Map<unknown, boolean>, opts: ReadOptions = {}): ReadResult {
  const auth: Authored = authored instanceof Map ? { enabled: authored, forceOutput: new Map() } : authored;
  const authoredEnabled = auth.enabled;
  const sides = opts.hullSides ?? 24;
  const collectionsSAI: SAINode[] = [], sensorsSAI: SAINode[] = [], all: SAINode[] = [];
  walk(scene, (n) => {
    const t = typeName(n);
    if (t in MAPPING) all.push(n);
    if (t === 'RigidBodyCollection') collectionsSAI.push(n);
    if (t === 'CollisionSensor') sensorsSAI.push(n);
  });

  // ROUTEs into a body's position/orientation make a fixed body kinematic.
  const routedBodies = new Set<unknown>();
  for (let i = 0; i < scene.routes.length; i++) {
    const r = scene.routes[i];
    if (/^(set_)?(position|orientation)$/.test(r.destinationField) && typeName(r.destinationNode) === 'RigidBody') routedBodies.add(key(r.destinationNode));
  }

  const bodyNodes: SAINode[] = [], kinematic: number[] = [], shapeNodes: SAINode[] = [], jointNodes: SAINode[] = [];
  /** For each collidable node key, the global indices of the shapes under it (a CollidableOffset covers its nested shapes). */
  const shapesUnder = new Map<unknown, number[]>();
  const bodyIndex = new Map<unknown, number>();
  let gen = 0;
  const nameOf = (n: SAINode, prefix: string) => defName(n) || `${prefix}#${gen++}`;

  const collections: CollectionModel[] = collectionsSAI.map((c) => {
    const col = c.collider;
    const surface: SurfaceModel | null = col ? {
      def: nameOf(col, 'CollisionCollection'), enabled: col.enabled, applied: strings(col.appliedParameters),
      frictionCoefficients: [col.frictionCoefficients.x, col.frictionCoefficients.y], bounce: col.bounce, minBounceSpeed: col.minBounceSpeed,
      surfaceSpeed: [col.surfaceSpeed.x, col.surfaceSpeed.y], slipFactors: [col.slipFactors.x, col.slipFactors.y],
      softnessConstantForceMix: col.softnessConstantForceMix, softnessErrorCorrection: col.softnessErrorCorrection,
      collidables: Array.from({ length: col.collidables.length }, (_, i) => defName(col.collidables[i])),
    } : null;
    const bodies: BodyModel[] = [];
    for (let i = 0; i < c.bodies.length; i++) {
      const b = c.bodies[i];
      if (typeName(b) !== 'RigidBody') continue;
      const index = bodyNodes.length;
      bodyNodes.push(b); bodyIndex.set(key(b), index);
      const shapes: ShapeModel[] = [];
      const addCollidable = (n: SAINode, local: Pose, top: boolean, chain: unknown[] = []) => {
        if (!n) return;
        chain = [...chain, key(n)];
        const t = typeName(n);
        // Top-level collidables follow the body (X_ITE links their translation/rotation to the body pose): zero offset.
        const here: Pose = top ? local : (() => {
          const q = rot(n.rotation), p = v3(n.translation);
          const pp = quatRotate(local.q, p);
          return { p: [local.p[0] + pp[0], local.p[1] + pp[1], local.p[2] + pp[2]], q: quatMul(local.q, q) };
        })();
        if (t === 'CollidableOffset') { if (n.enabled) addCollidable(n.collidable, here, false, chain); return; }
        if (t !== 'CollidableShape') return;
        const def = nameOf(n, 'CollidableShape');
        const g = geometryOf(n.shape, def, sides);
        if (!g) return;
        shapes.push({ index: shapeNodes.length, def, local: here, geom: g, enabled: n.enabled });
        for (const k of chain) { const l = shapesUnder.get(k) ?? []; l.push(shapeNodes.length); shapesUnder.set(k, l); }
        shapeNodes.push(n);
      };
      for (let k = 0; k < b.geometry.length; k++) addCollidable(b.geometry[k], { p: [0, 0, 0], q: [0, 0, 0, 1] }, true);
      const mdm = b.massDensityModel;
      let massDensityModel: MassDensityModel | null = null;
      if (mdm) {
        const t = typeName(mdm);
        if (t === 'Sphere') massDensityModel = { kind: 'sphere', radius: mdm.radius };
        else if (t === 'Box') massDensityModel = { kind: 'box', size: v3(mdm.size) };
        else if (t === 'Cone') massDensityModel = { kind: 'cone', bottomRadius: mdm.bottomRadius, height: mdm.height };
      }
      const inertia = Array.from({ length: 9 }, (_, k) => Number(b.inertia[k]));
      const fixed = !!b.fixed;
      const isKinematic = fixed && routedBodies.has(key(b));
      if (isKinematic) kinematic.push(index);
      const sum = (mf: SAINode): Vec3 => { const s: Vec3 = [0, 0, 0]; for (let k = 0; k < mf.length; k++) { s[0] += mf[k].x; s[1] += mf[k].y; s[2] += mf[k].z; } return s; };
      bodies.push({
        index, def: nameOf(b, 'RigidBody'), enabled: b.enabled, fixed, kinematic: isKinematic,
        mass: b.mass, centerOfMass: v3(b.centerOfMass), inertia, inertiaIsDefault: inertia.every((x, k) => Math.abs(x - (k % 4 === 0 ? 1 : 0)) < 1e-9), massDensityModel,
        pose: { p: v3(b.position), q: rot(b.orientation) }, linearVelocity: v3(b.linearVelocity), angularVelocity: v3(b.angularVelocity),
        autoDamp: b.autoDamp, linearDampingFactor: b.linearDampingFactor, angularDampingFactor: b.angularDampingFactor, useGlobalGravity: b.useGlobalGravity,
        force: sum(b.forces), torque: sum(b.torques), autoDisable: b.autoDisable, disableLinearSpeed: b.disableLinearSpeed, disableAngularSpeed: b.disableAngularSpeed, disableTime: b.disableTime,
        useFiniteRotation: b.useFiniteRotation, finiteRotationAxis: v3(b.finiteRotationAxis), shapes,
      });
    }
    const joints: JointModel[] = [];
    for (let i = 0; i < c.joints.length; i++) {
      const j = c.joints[i], t = typeName(j) as JointType;
      if (!JOINTS.includes(t)) continue;
      const fields: JointModel['fields'] = {};
      for (const [name, fd] of Object.entries(uom[t])) {
        if (fd.access === 'outputOnly' || ['DEF', 'USE', 'class', 'id', 'style', 'metadata', 'body1', 'body2', 'forceOutput'].includes(name)) continue;
        const v = flat(j[name]);
        if (v === null) continue;
        fields[name] = (v.length === 1 && typeof v[0] !== 'string' ? v[0] : v) as number | boolean | number[] | string[];
      }
      joints.push({ index: jointNodes.length, type: t, def: nameOf(j, t), body1: -1, body2: -1, forceOutput: auth.forceOutput.get(key(j)) ?? strings(j.forceOutput), fields, ...{ _b1: key(j.body1), _b2: key(j.body2) } } as JointModel);
      jointNodes.push(j);
    }
    return {
      def: nameOf(c, 'RigidBodyCollection'), enabled: authoredEnabled.get(key(c)) ?? true, gravity: v3(c.gravity), iterations: c.iterations, preferAccuracy: c.preferAccuracy,
      errorCorrection: c.errorCorrection, constantForceMix: c.constantForceMix, contactSurfaceThickness: c.contactSurfaceThickness, maxCorrectionSpeed: c.maxCorrectionSpeed,
      autoDisable: c.autoDisable, disableLinearSpeed: c.disableLinearSpeed, disableAngularSpeed: c.disableAngularSpeed, disableTime: c.disableTime,
      surface, bodies, joints, sensors: [],
    };
  });
  // Resolve joint bodies now that every body has an index.
  for (const c of collections) for (const j of c.joints) {
    const jj = j as JointModel & { _b1?: unknown; _b2?: unknown };
    j.body1 = jj._b1 ? bodyIndex.get(jj._b1) ?? -1 : -1;
    j.body2 = jj._b2 ? bodyIndex.get(jj._b2) ?? -1 : -1;
    delete jj._b1; delete jj._b2;
  }
  const sensors = sensorsSAI.map((s) => {
    const col = s.collider;
    const colKey = key(col);
    const ci = collectionsSAI.findIndex((c) => c.collider && key(c.collider) === colKey);
    const def = nameOf(s, 'CollisionSensor');
    if (ci >= 0) collections[ci].sensors.push(def);
    const shapes = new Set<number>();
    if (col) for (let i = 0; i < col.collidables.length; i++) for (const k of shapesUnder.get(key(col.collidables[i])) ?? []) shapes.add(k);
    return { node: s, collection: ci, shapes, enabled: authoredEnabled.get(key(s)) ?? true, def };
  });

  const model: SceneModel = { contract: CONTRACT, source, collections, fixedStep: opts.fixedStep ?? 1 / 240 };
  // H-Anim humanoids become ragdolls (articulations) next to the collections' bodies
  const hanim = readHumanoids(findNodes(scene, 'HAnimHumanoid'), bodyNodes.length, shapeNodes.length, opts.hullSides ?? 24);
  if (hanim.read.length) model.humanoids = hanim.read.map((h) => h.model);
  const report = lossReport(all, source, auth);
  for (const n of hanim.notes) report.notes.push({ def: n.split(':')[0], node: 'HAnimHumanoid', field: 'skeleton', status: 'approximated', how: n });
  return { model, report, bodyNodes, kinematic, sensors, collectionNodes: collectionsSAI, shapeNodes, jointNodes, humanoids: hanim.read };
}

function lossReport(nodes: SAINode[], source: string, auth: Authored): LossReport {
  const authoredEnabled = auth.enabled;
  const out: LossNode[] = [], lostAuthored: LossReport['lostAuthored'] = [];
  const summary: Record<string, number> = {};
  for (const n of nodes) {
    const t = typeName(n), def = defName(n) || `(${t})`;
    const fields: Record<string, LossField> = {};
    for (const [name, [status, how]] of Object.entries(MAPPING[t])) {
      const fd = uom[t][name];
      if (!fd || fd.access === 'inputOnly' || ['DEF', 'USE', 'metadata'].includes(name)) continue;
      let value: (number | string | boolean)[] | null = null;
      if (fd.access !== 'outputOnly') {
        try {
          value = name === 'enabled' && authoredEnabled.has(key(n)) ? [authoredEnabled.get(key(n))!]
            : name === 'forceOutput' && auth.forceOutput.has(key(n)) ? auth.forceOutput.get(key(n))! : flat(n[name]);
        } catch { value = null; }
      }
      let authored = fd.access !== 'outputOnly' && !isDefault(value, fd.default);
      if (fd.type === 'SFNode' || fd.type === 'MFNode') { // node fields: authored when set; reported by DEF names
        let v: SAINode = null;
        try { v = n[name]; } catch { /* not readable */ }
        const list = !v ? [] : fd.type === 'SFNode' ? [v] : Array.from({ length: v.length }, (_, i) => v[i]);
        authored = list.length > 0;
        value = list.map((x: SAINode) => defName(x) || typeName(x));
      }
      fields[name] = { status, how, authored, ...(authored && value ? { value: value.map((x) => (typeof x === 'number' ? +x.toPrecision(6) : x)).join(' ') } : {}) };
      summary[status] = (summary[status] ?? 0) + 1;
      if (authored && status === 'lost') lostAuthored.push({ node: t, def, field: name, how });
    }
    out.push({ node: t, def, fields });
  }
  return { contract: CONTRACT, source, engine: 'PhysX', nodes: out, notes: [], lostAuthored, summary };
}
