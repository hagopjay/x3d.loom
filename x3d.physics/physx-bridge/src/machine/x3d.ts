// MachineIR -> standard X3D 4.0 text. 'run': the physics scene (what the bridge loads and what Export writes);
// 'build': a physics-free blueprint in which every piece sits in its own frame next to a PlaneSensor (build mode drags pieces with it).
import { quatToAxisAngle } from '../bridge/math.ts';
import type { Pose, Vec3 } from '../bridge/model.ts';
import { directShape } from './ir.ts';
import type { IRBody, IRShape, MachineIR, VisualGeom } from './ir.ts';
import { GRID, MATERIALS } from './pieces.ts';
import type { Machine } from './pieces.ts';

const n = (x: number) => { const r = +x.toPrecision(6); return Object.is(r, -0) ? '0' : String(r); };
const vec = (v: ArrayLike<number>) => Array.from(v, n).join(' ');
const rotAttr = (q: Pose['q']) => { const a = quatToAxisAngle(q); return a[3] === 0 ? '' : ` rotation="${vec(a)}"`; };
const orientAttr = (q: Pose['q']) => { const a = quatToAxisAngle(q); return a[3] === 0 ? '' : ` orientation="${vec(a)}"`; };
const transAttr = (p: Vec3) => (p.every((x) => x === 0) ? '' : ` translation="${vec(p)}"`);
export const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
/** One MFString element: X3D escapes " and \ inside the quotes; the XML attribute (single-quoted) escapes the rest. */
const mfstring = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function geometry(g: VisualGeom): string {
  switch (g.kind) {
    case 'box': return `<Box size="${vec(g.size)}"/>`;
    case 'sphere': return `<Sphere radius="${n(g.r)}"/>`;
    case 'cylinder': return `<Cylinder radius="${n(g.r)}" height="${n(g.h)}"/>`;
    case 'cone': return `<Cone bottomRadius="${n(g.r)}" height="${n(g.h)}"/>`;
    case 'mesh': {
      const idx: number[] = [];
      for (let i = 0; i < g.indices.length; i += 3) idx.push(g.indices[i], g.indices[i + 1], g.indices[i + 2], -1);
      return `<IndexedFaceSet solid="false" creaseAngle="0.5" coordIndex="${idx.join(' ')}"><Coordinate point="${vec(g.points)}"/></IndexedFaceSet>`;
    }
  }
}

/** Pegboard holes: a 16×16 PixelTexture repeated once per 4 cm grid cell (shifted so holes sit on the snap points). */
function pegboard(w: number, h: number): { tex: string; xf: string } {
  const N = 16, px: string[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d = Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2);
    px.push(d < 2.6 ? '0x2a211a' : d < 3.4 ? '0x8a7556' : '0xc8ae86');
  }
  const cx = w / GRID, cy = h / GRID;
  return { tex: `<PixelTexture containerField="baseTexture" image="${N} ${N} 3 ${px.join(' ')}"/>`, xf: `<TextureTransform scale="${n(cx)} ${n(cy)}" translation="${n(0.5 / cx)} 0"/>` };
}

class Mats {
  private used = new Set<string>();
  appearance(m: string, size?: Vec3): string {
    if (this.used.has(m)) return `<Appearance USE="Mat_${m}"/>`;
    this.used.add(m);
    if (m === 'pegboard' && size) {
      const { tex, xf } = pegboard(size[0], size[1]);
      return `<Appearance DEF="Mat_${m}">${MATERIALS[m].replace('/>', `>${tex}</PhysicalMaterial>`)}${xf}</Appearance>`;
    }
    return `<Appearance DEF="Mat_${m}">${MATERIALS[m] ?? MATERIALS.steel}</Appearance>`;
  }
}

/** Box edges as lines (the Loom look's gold outlines), hidden in a Switch until the look is selected. */
function outline(g: VisualGeom): string {
  if (g.kind !== 'box') return '';
  const [x, y, z] = g.size.map((v) => v / 2);
  const pts = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]].flat();
  return `<Shape><Appearance USE="LoomLine"/><IndexedLineSet coordIndex="0 1 2 3 0 -1 4 5 6 7 4 -1 0 4 -1 1 5 -1 2 6 -1 3 7"><Coordinate point="${vec(pts)}"/></IndexedLineSet></Shape>`;
}

/** Shape sharing (SceneMeta.shareShapes): shape DEF -> the DEF of the first Shape with the same geometry and material (X3D DEF/USE). */
let SHARE: Map<string, string> | null = null;
const shapeRef = (s: IRShape) => SHARE?.get(s.def) ?? `${s.def}S`;

function visual(b: IRBody, mats: Mats, pose: Pose, indent: string, outlines = false): string {
  const kids = b.shapes.map((s: IRShape) => {
    const ref = shapeRef(s);
    let shape = ref === `${s.def}S` ? `<Shape DEF="${s.def}S">${mats.appearance(s.mat, s.geom.kind === 'box' ? s.geom.size : undefined)}${geometry(s.geom)}</Shape>` : `<Shape USE="${ref}"/>`;
    if (s.switchable) shape = `<Switch DEF="${s.def}V" whichChoice="${s.enabled === false ? -1 : 0}">${shape}</Switch>`;
    const o = outlines ? outline(s.geom) : '';
    const body = o ? `${shape}<Switch DEF="${s.def}O" whichChoice="-1">${o}</Switch>` : shape;
    const t = transAttr(s.local.p) + rotAttr(s.local.q);
    return t ? `<Transform${t}>${body}</Transform>` : (o ? `<Group>${body}</Group>` : shape);
  });
  return `${indent}<Transform DEF="${b.def}T"${transAttr(pose.p)}${rotAttr(pose.q)}>\n${kids.map((k) => `${indent} ${k}`).join('\n')}\n${indent}</Transform>`;
}

function collidables(b: IRBody): string {
  if (directShape(b)) {
    const s = b.shapes[0];
    return `<CollidableShape DEF="${s.def}" containerField="geometry"${s.enabled === false ? ' enabled="false"' : ''}><Shape USE="${shapeRef(s)}" containerField="shape"/></CollidableShape>`;
  }
  // offsets go on the inner collidable (X_ITE links a top-level collidable's translation to the body pose; SPEC section 5)
  return b.shapes.map((s) => `<CollidableOffset DEF="${s.def}Offset" containerField="geometry"><CollidableShape DEF="${s.def}" containerField="collidable"${s.enabled === false ? ' enabled="false"' : ''}${transAttr(s.local.p)}${rotAttr(s.local.q)}><Shape USE="${shapeRef(s)}" containerField="shape"/></CollidableShape></CollidableOffset>`).join('\n     ');
}
const collidableUse = (b: IRBody) => directShape(b) ? [`<CollidableShape USE="${b.shapes[0].def}" containerField="collidables"/>`] : b.shapes.map((s) => `<CollidableOffset USE="${s.def}Offset" containerField="collidables"/>`);
const chimeUse = (b: IRBody, s: IRShape) => directShape(b) ? `<CollidableShape USE="${s.def}" containerField="collidables"/>` : `<CollidableOffset USE="${s.def}Offset" containerField="collidables"/>`;

const fieldAttr = (v: number | boolean | number[]): string => (typeof v === 'boolean' ? String(v) : Array.isArray(v) ? vec(v) : n(v));

function head(title: string, description: string, build: boolean, extra = '', generator = 'x3d-physx-bridge Marble Machine (src/machine/x3d.ts)') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<X3D profile="Interchange" version="4.0">
 <head>
  <component name="Shape" level="2"/>
  <component name="Lighting" level="2"/>
  <component name="Texturing" level="2"/>
  <component name="Grouping" level="2"/>
${build ? '  <component name="PointingDeviceSensor" level="1"/>\n' : '  <component name="RigidBodyPhysics" level="2"/>\n'}  <component name="Navigation" level="2"/>
${extra}
  <meta name="title" content="${xmlEscape(title)}"/>
  <meta name="description" content="${xmlEscape(description)}"/>
  <meta name="generator" content="${xmlEscape(generator)}"/>
 </head>`;
}

const lights = (shadowMapSize?: number) => `  <DirectionalLight DEF="Key" direction="-0.3 -0.8 -0.6" intensity="2.2" shadows="true"${shadowMapSize ? ` shadowMapSize="${shadowMapSize}"` : ''}/>
  <DirectionalLight DEF="Fill" direction="0.1 -0.25 -1" intensity="1.6"/>
  <DirectionalLight DEF="Rim" direction="0.6 -0.2 -1" intensity="0.5"/>`;

/** Points per marble trail (the Loom look). */
export const TRAIL = 36;

/** What a scene other than the Marble Machine says about itself (the demos in src/demos). */
export interface SceneMeta {
  title: string;
  description: string;
  /** WorldInfo info line. */
  info: string;
  /** A MetadataString on the WorldInfo carrying the page's own description (JSON), so Import can read it back. */
  metaName?: string;
  metaValue?: unknown;
  /** Viewpoint nodes (X3D text). */
  viewpoints?: string;
  /** Extra X3D nodes appended to the scene (sensors, guides). */
  extra?: string;
  /** NavigationInfo type list, X3D MFString text (default "EXAMINE" "ANY"). */
  navigation?: string;
  generator?: string;
  /** Extra head components (X3D text). */
  components?: string;
  /** Share one Shape node (DEF/USE) among shapes with the same geometry and material: smaller files, faster loads (many beads, pins). */
  shareShapes?: boolean;
  /** The key light's shadow map (X_ITE's DirectionalLight.shadowMapSize; small scenes need more texels than the default 1024). */
  shadowMapSize?: number;
}

export interface X3DOptions {
  mode: 'run' | 'build' | 'ghost';
  /** The Marble Machine's description; other pages give `meta` instead. */
  machine?: Machine;
  meta?: SceneMeta;
  /** run mode: URL of the ghost scene to Inline for the race (its collection, marbles and clocks are IMPORTed). */
  ghostUrl?: string;
  /** run mode: a pool of SpatialSound + AudioClip voices per impact sample (the page triggers them from impact events). */
  sound?: { samples: string[]; voices: number; base: string };
}

/** The race's ghost: the same machine for X_ITE's own engine (Bullet), collection disabled until Run, only the marbles visible
 * (translucent), and the collection, marbles and clocks EXPORTed so the PhysX scene can IMPORT them through an Inline. */
function ghost(ir: MachineIR, o: X3DOptions): string {
  const L: string[] = [];
  L.push(head(`${o.machine?.name ?? o.meta?.title} (Bullet ghost)`, 'The race ghost: the same machine on X_ITE\'s built-in engine, marbles only visible.', false));
  L.push(' <Scene>');
  for (const b of ir.bodies) if (b.role === 'marble') {
    L.push(`  <Transform DEF="${b.def}T"${transAttr(b.pose.p)}><Shape><Appearance DEF="${b.def}Ghost"><Material diffuseColor="0.75 0.9 1" emissiveColor="0.25 0.35 0.45" transparency="0.55"/></Appearance><Sphere radius="${n((b.shapes[0].geom as { r: number }).r)}"/></Shape></Transform>`);
  }
  for (const c of ir.clocks) {
    L.push(`  <TimeSensor DEF="${c.def}" cycleInterval="${n(c.cycle)}" loop="true"/>`);
    L.push(`  <PositionInterpolator DEF="${c.def}Path" key="${vec(c.keys)}" keyValue="${(c.values ?? []).map(vec).join(' ')}"/>`);
  }
  const s = ir.surface;
  L.push(`  <RigidBodyCollection DEF="Machine" enabled="false" gravity="0 -9.81 0" iterations="10" preferAccuracy="true">`);
  for (const b of ir.bodies) {
    const attrs = `DEF="${b.def}Body" containerField="bodies" position="${vec(b.pose.p)}"${orientAttr(b.pose.q)}${b.fixed ? ' fixed="true"' : ` mass="${n(b.mass ?? 1)}"`}`;
    const shapes = b.shapes.map((sh) => {
      const cs = (dfn: string, cf: string, t: string) => `<CollidableShape DEF="${dfn}" containerField="${cf}" visible="false"${t}><Shape containerField="shape">${geometry(sh.geom)}</Shape></CollidableShape>`;
      return directShape(b) ? cs(sh.def, 'geometry', '') : `<CollidableOffset DEF="${sh.def}Offset" containerField="geometry" visible="false">${cs(sh.def, 'collidable', transAttr(sh.local.p) + rotAttr(sh.local.q))}</CollidableOffset>`;
    });
    L.push(`   <RigidBody ${attrs}>\n     ${shapes.join('\n     ')}\n   </RigidBody>`);
  }
  for (const j of ir.joints) {
    const f = Object.entries(j.fields).map(([k, v]) => ` ${k}="${fieldAttr(v)}"`).join('');
    L.push(`   <${j.type} DEF="${j.def}" containerField="joints"${f}>${j.body1 ? `<RigidBody USE="${j.body1}Body" containerField="body1"/>` : ''}${j.body2 ? `<RigidBody USE="${j.body2}Body" containerField="body2"/>` : ''}</${j.type}>`);
  }
  L.push(`   <CollisionCollection DEF="Surfaces" containerField="collider" appliedParameters='"BOUNCE" "FRICTION_COEFFICIENT-2"' bounce="${n(s.bounce)}" minBounceSpeed="${n(s.minBounceSpeed)}" frictionCoefficients="${n(s.friction)} ${n(s.friction)}">`);
  for (const b of ir.bodies) for (const u of collidableUse(b)) L.push(`    ${u}`);
  L.push('   </CollisionCollection>');
  L.push('  </RigidBodyCollection>');
  for (const c of ir.clocks) {
    L.push(`  <ROUTE fromNode="${c.def}" fromField="fraction_changed" toNode="${c.def}Path" toField="set_fraction"/>`);
    L.push(`  <ROUTE fromNode="${c.def}Path" fromField="value_changed" toNode="${c.body}Body" toField="set_position"/>`);
  }
  for (const b of ir.bodies) if (b.role === 'marble') L.push(`  <ROUTE fromNode="${b.def}Body" fromField="position" toNode="${b.def}T" toField="set_translation"/>`);
  L.push(`  <EXPORT localDEF="Machine" AS="GhostMachine"/>`);
  for (const b of ir.bodies) if (b.role === 'marble') L.push(`  <EXPORT localDEF="${b.def}Body" AS="Ghost${b.def}"/>`);
  ir.clocks.forEach((c, i) => L.push(`  <EXPORT localDEF="${c.def}" AS="GhostClock${i}"/>`));
  L.push(' </Scene>\n</X3D>\n');
  return L.join('\n');
}

export function toX3D(ir: MachineIR, o: X3DOptions): string {
  if (o.mode === 'ghost') return ghost(ir, o);
  const mats = new Mats();
  const L: string[] = [];
  const build = o.mode === 'build';
  const m = o.machine, meta: SceneMeta = o.meta ?? {
    title: m!.name, description: `${build ? 'Build view of a' : 'A'} marble machine with ${m!.pieces.length} pieces. Standard X3D 4.0 RigidBodyPhysics: runs on PhysX through the x3d-physx bridge and on X_ITE's built-in engine.`,
    info: 'Units: metres, kilograms, seconds, radians. Y up. A marble machine on a 4 cm pegboard.', metaName: 'X3dPhysxMachine', metaValue: m,
    viewpoints: `  <Viewpoint DEF="Front" description="Front" position="0 0.54 2.05" centerOfRotation="0 0.5 0" fieldOfView="0.7"/>` + (build ? '' : `\n  <Viewpoint DEF="Close" description="Close" position="-0.25 0.75 0.9" orientation="1 0 0 -0.12" centerOfRotation="-0.25 0.7 0" fieldOfView="0.7"/>`),
  };
  L.push(head(meta.title, meta.description, build, (o.ghostUrl ? '  <component name="Networking" level="2"/>\n' : '') + (o.sound ? '  <component name="Sound" level="2"/>\n' : '') + (meta.components ?? ''), meta.generator));
  L.push(' <Scene>');
  L.push(`  <WorldInfo title="${xmlEscape(meta.title)}" info='${mfstring(meta.info).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;')}'>`);
  if (meta.metaName) L.push(`   <MetadataString DEF="MachineDescription" containerField="metadata" name="${meta.metaName}" value='${xmlEscape(mfstring(JSON.stringify(meta.metaValue)))}'/>`);
  L.push('  </WorldInfo>');
  L.push(`  <NavigationInfo type='${build ? '"NONE"' : meta.navigation ?? '"EXAMINE" "ANY"'}' headlight="false"/>`);
  if (!build) L.push(`  <Background DEF="Sky" skyColor="0.05 0.06 0.08"/>`);
  if (meta.viewpoints) L.push(meta.viewpoints);
  L.push(lights(meta.shadowMapSize));

  if (build) {
    if (!m) throw new Error('build mode is the Marble Machine\'s');
    for (const b of ir.bodies.filter((x) => x.piece < 0 && x.def !== 'BoardGlass')) L.push(visual(b, mats, b.pose, '  '));
    const pieces = new Map<number, IRBody[]>();
    for (const b of ir.bodies) if (b.piece >= 0) pieces.set(b.piece, [...(pieces.get(b.piece) ?? []), b]);
    for (const p of m.pieces) {
      L.push(`  <Group DEF="Slot${p.id}">`);
      L.push(`   <PlaneSensor DEF="Drag${p.id}" description="drag ${p.type}" autoOffset="true" offset="${vec([p.gx * GRID, p.gy * GRID, 0])}"/>`);
      L.push(`   <Transform DEF="Piece${p.id}" translation="${vec([p.gx * GRID, p.gy * GRID, 0])}"${p.rot ? ` rotation="0 0 1 ${n((p.rot * Math.PI) / 180)}"` : ''}>`);
      for (const b of pieces.get(p.id) ?? []) L.push(visual(b, mats, b.pieceLocal, '    '));
      L.push('   </Transform>');
      L.push('  </Group>');
    }
    L.push(`  <Background skyColor="0.05 0.06 0.08"/>`);
    L.push(`  <Transform DEF="Selection" scale="0 0 0"><Shape><Appearance><Material emissiveColor="1 0.78 0.25" diffuseColor="0 0 0"/></Appearance><IndexedLineSet coordIndex="0 1 2 3 0 -1 4 5 6 7 4 -1 0 4 -1 1 5 -1 2 6 -1 3 7"><Coordinate point="-0.5 -0.5 -0.5 0.5 -0.5 -0.5 0.5 0.5 -0.5 -0.5 0.5 -0.5 -0.5 -0.5 0.5 0.5 -0.5 0.5 0.5 0.5 0.5 -0.5 0.5 0.5"/></IndexedLineSet></Shape></Transform>`);
    L.push(' </Scene>\n</X3D>\n');
    return L.join('\n');
  }

  if (meta.shareShapes) {
    SHARE = new Map();
    const owner = new Map<string, string>();
    for (const b of ir.bodies) for (const sh of b.shapes) {
      const k = `${sh.mat}|${JSON.stringify(sh.geom)}`;
      if (!owner.has(k)) owner.set(k, `${sh.def}S`);
      SHARE.set(sh.def, owner.get(k)!);
    }
  }
  try {
  // the Loom look's line colour (outlines and trails); unused until the look is selected
  L.push(`  <Shape><Appearance DEF="LoomLine"><Material emissiveColor="0.95 0.74 0.3" diffuseColor="0 0 0"/></Appearance><PointSet><Coordinate point="0 -10 0"/></PointSet></Shape>`);
  for (const b of ir.bodies) L.push(visual(b, mats, b.pose, '  ', b.role !== 'board' && b.role !== 'marble'));
  const marbles = ir.bodies.filter((b) => b.role === 'marble');
  if (marbles.length) {
    L.push(`  <Switch DEF="Trails" whichChoice="-1"><Group>`);
    marbles.forEach((b) => L.push(`   <Shape><Appearance USE="LoomLine"/><LineSet vertexCount="${TRAIL}"><Coordinate DEF="${b.def}Trail" point="${Array(TRAIL).fill(vec(b.pose.p)).join(' ')}"/></LineSet></Shape>`));
    L.push(`  </Group></Switch>`);
  }
  for (const c of ir.clocks) {
    L.push(`  <TimeSensor DEF="${c.def}" cycleInterval="${n(c.cycle)}" loop="true"/>`);
    if (c.values) L.push(`  <PositionInterpolator DEF="${c.def}Path" key="${vec(c.keys)}" keyValue="${c.values.map(vec).join(' ')}"/>`);
    if (c.rotations) L.push(`  <OrientationInterpolator DEF="${c.def}Turn" key="${vec(c.keys)}" keyValue="${c.rotations.map((q) => vec(quatToAxisAngle(q))).join(' ')}"/>`);
  }
  const s = ir.surface, w = ir.world ?? {}, g = ir.gravity ?? [0, -9.81, 0];
  const surf = `appliedParameters='"BOUNCE" "FRICTION_COEFFICIENT-2"' bounce="${n(s.bounce)}" minBounceSpeed="${n(s.minBounceSpeed)}" frictionCoefficients="${n(s.friction)} ${n(s.friction)}"`;
  L.push(`  <RigidBodyCollection DEF="Machine" gravity="${vec(g)}" iterations="${w.iterations ?? 10}" preferAccuracy="true"${w.autoDisable ? ` autoDisable="true" disableLinearSpeed="${n(w.disableLinearSpeed ?? 0)}" disableAngularSpeed="${n(w.disableAngularSpeed ?? 0)}" disableTime="${n(w.disableTime ?? 0)}"` : ''}>`);
  for (const b of ir.bodies) {
    const attrs = `DEF="${b.def}Body" containerField="bodies" position="${vec(b.pose.p)}"${orientAttr(b.pose.q)}${b.fixed ? ' fixed="true"' : ` mass="${n(b.mass ?? 1)}"`}${b.linearVelocity ? ` linearVelocity="${vec(b.linearVelocity)}"` : ''}${b.angularVelocity ? ` angularVelocity="${vec(b.angularVelocity)}"` : ''}${b.damping ? ` autoDamp="true" linearDampingFactor="${n(b.damping.linear)}" angularDampingFactor="${n(b.damping.angular)}"` : ''}`;
    L.push(`   <RigidBody ${attrs}>\n     ${collidables(b)}\n   </RigidBody>`);
  }
  for (const j of ir.joints) {
    const f = Object.entries(j.fields).map(([k, v]) => ` ${k}="${fieldAttr(v)}"`).join('');
    L.push(`   <${j.type} DEF="${j.def}" containerField="joints"${f} forceOutput='"ALL"'>${j.body1 ? `<RigidBody USE="${j.body1}Body" containerField="body1"/>` : ''}${j.body2 ? `<RigidBody USE="${j.body2}Body" containerField="body2"/>` : ''}</${j.type}>`);
  }
  L.push(`   <CollisionCollection DEF="Surfaces" containerField="collider" ${surf}>`);
  for (const b of ir.bodies) for (const u of collidableUse(b)) L.push(`    ${u}`);
  L.push('   </CollisionCollection>');
  L.push('  </RigidBodyCollection>');
  const chimeBodies = ir.bodies.filter((b) => b.shapes.some((x) => ir.chimes.includes(x.def)));
  if (chimeBodies.length) {
    L.push(`  <CollisionSensor DEF="Chimes" description="bells and xylophone bars: contacts here ring">`);
    L.push(`   <CollisionCollection DEF="ChimeSurfaces" containerField="collider" ${surf}>`);
    for (const b of chimeBodies) for (const sh of b.shapes) if (ir.chimes.includes(sh.def)) L.push(`    ${chimeUse(b, sh)}`);
    L.push('   </CollisionCollection>');
    L.push('  </CollisionSensor>');
  }
  for (const c of ir.clocks) {
    if (c.values) {
      L.push(`  <ROUTE fromNode="${c.def}" fromField="fraction_changed" toNode="${c.def}Path" toField="set_fraction"/>`);
      L.push(`  <ROUTE fromNode="${c.def}Path" fromField="value_changed" toNode="${c.body}Body" toField="set_position"/>`);
      L.push(`  <ROUTE fromNode="${c.def}Path" fromField="value_changed" toNode="${c.body}T" toField="set_translation"/>`);
    }
    if (c.rotations) {
      L.push(`  <ROUTE fromNode="${c.def}" fromField="fraction_changed" toNode="${c.def}Turn" toField="set_fraction"/>`);
      L.push(`  <ROUTE fromNode="${c.def}Turn" fromField="value_changed" toNode="${c.body}Body" toField="set_orientation"/>`);
      L.push(`  <ROUTE fromNode="${c.def}Turn" fromField="value_changed" toNode="${c.body}T" toField="set_rotation"/>`);
    }
  }
  if (o.meta?.extra) L.push(o.meta.extra);
  for (const b of ir.bodies) if (!b.fixed) {
    L.push(`  <ROUTE fromNode="${b.def}Body" fromField="position" toNode="${b.def}T" toField="set_translation"/>`);
    L.push(`  <ROUTE fromNode="${b.def}Body" fromField="orientation" toNode="${b.def}T" toField="set_rotation"/>`);
  }
  if (o.sound) {
    // impact sounds: X3D 4.0 SpatialSound voices, each with an AudioClip; the page sets location, intensity, pitch and startTime per impact
    L.push('  <Group DEF="Voices">');
    for (const smp of o.sound.samples) for (let k = 0; k < o.sound.voices; k++)
      L.push(`   <SpatialSound DEF="Voice_${smp.replace(/-/g, '_')}_${k}" location="0 0.5 0" intensity="0" referenceDistance="0.6" rolloffFactor="1" distanceModel="INVERSE"><AudioClip DEF="Clip_${smp.replace(/-/g, '_')}_${k}" containerField="children" url='${xmlEscape(mfstring(o.sound.base + smp + '.wav'))}'/></SpatialSound>`);
    L.push('  </Group>');
  }
  if (o.ghostUrl) {
    // the race: the same machine on X_ITE's Bullet inside an Inline; its nodes come in through standard IMPORT statements
    L.push(`  <Inline DEF="Ghost" url='${xmlEscape(mfstring(o.ghostUrl))}'/>`);
    L.push(`  <IMPORT inlineDEF="Ghost" importedDEF="GhostMachine" AS="GhostMachine"/>`);
    for (const b of ir.bodies) if (b.role === 'marble') L.push(`  <IMPORT inlineDEF="Ghost" importedDEF="Ghost${b.def}" AS="Ghost${b.def}"/>`);
    ir.clocks.forEach((_, i) => L.push(`  <IMPORT inlineDEF="Ghost" importedDEF="GhostClock${i}" AS="GhostClock${i}"/>`));
  }
  L.push(' </Scene>\n</X3D>\n');
  return L.join('\n');
  } finally { SHARE = null; }
}

/** Read the machine description back from an exported file (WorldInfo MetadataString "x3d-physx-machine"). */
export function machineFromX3D(text: string): unknown {
  const tag = text.match(/<MetadataString[^>]*name="(X3dPhysxMachine|x3d-physx-machine)"[^>]*>/);
  const val = tag?.[0].match(/value='([^']*)'/);
  if (!val) return null;
  const attr = val[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const inner = attr.trim().replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  try { return JSON.parse(inner); } catch { return null; }
}
