// Three showcase scenes for the engine demo. Each scene is one function of `mode`:
//   'live'   the X3D a browser runs itself: RigidBodyCollection + ROUTEs from every RigidBody to a drawn Transform (what X_ITE's own Bullet steps)
//   'replay' the same Transforms driven by Position/OrientationInterpolators filled from a recorded run of one of our engines (script-free X3D 4.0)
// The recorder (tools/record-demo.js) runs the 'live' text through the bridge reader with each engine and writes the 'replay' files.
const g = 9.8;
let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const col = (a, b, c) => `<Appearance><Material diffuseColor="${a} ${b} ${c}" specularColor="0.35 0.35 0.35" shininess="0.35"/></Appearance>`;
const geomXml = (k) => k.kind === 'box' ? `<Box size="${k.size.join(' ')}"/>` : k.kind === 'sphere' ? `<Sphere radius="${k.r}"/>` : k.kind === 'cylinder' ? `<Cylinder radius="${k.r}" height="${k.h}"/>` : `<Cone bottomRadius="${k.r}" height="${k.h}"/>`;

// a body: { id, geom, pos, rot, color, fixed, vel, avel, mass, hidden }
function sceneXml(sc, mode, interp) {
  const body = (b) => `<RigidBody DEF="B_${b.id}" position="${b.pos.join(' ')}" ${b.rot ? `orientation="${b.rot.join(' ')}"` : ''} mass="${b.mass || 1}" ${b.fixed ? 'fixed="true"' : ''} ${b.vel ? `linearVelocity="${b.vel.join(' ')}"` : ''} ${b.avel ? `angularVelocity="${b.avel.join(' ')}"` : ''}><CollidableShape containerField="geometry"><Shape containerField="shape">${geomXml(b.geom)}</Shape></CollidableShape></RigidBody>`;
  const tf = (b) => `<Transform DEF="T_${b.id}" translation="${b.pos.join(' ')}" ${b.rot ? `rotation="${b.rot.join(' ')}"` : ''}><Shape>${col(...b.color)}${geomXml(b.geom)}</Shape></Transform>`;
  const drawn = sc.bodies.filter((b) => !b.hidden);
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Immersive" version="4.0"><head>${mode === 'live' ? '<component name="RigidBodyPhysics" level="2"/>' : ''}<meta name="title" content="${sc.id} ${mode}"/></head><Scene>\n`;
  x += `<NavigationInfo type='"EXAMINE" "ANY"' headlight="false"/><Viewpoint description="${sc.id}" position="${sc.camera.pos.join(' ')}" orientation="${sc.camera.rot.join(' ')}" fieldOfView="0.7"/>\n`;
  x += `<Background skyColor="0.02 0.03 0.07 0.06 0.08 0.16" skyAngle="1.5" groundColor="0.02 0.03 0.07" groundAngle="0"/>\n<DirectionalLight direction="-0.4 -1 -0.5" intensity="0.9" color="1 0.96 0.9"/><DirectionalLight direction="0.6 -0.3 0.7" intensity="0.35" color="0.6 0.75 1"/>\n`;
  for (const b of sc.static || []) x += `<Transform translation="${b.pos.join(' ')}" ${b.rot ? `rotation="${b.rot.join(' ')}"` : ''}><Shape>${col(...b.color)}${geomXml(b.geom)}</Shape></Transform>\n`;
  for (const b of drawn) x += tf(b) + '\n';
  if (mode === 'live') {
    x += `<RigidBodyCollection DEF="W" gravity="0 -${g} 0" iterations="${sc.iterations || 10}"><CollisionCollection containerField="collider" bounce="${sc.bounce}" minBounceSpeed="0" frictionCoefficients="${sc.mu} ${sc.mu}" appliedParameters='"BOUNCE" "FRICTION_COEFFICIENT-2"'/>\n`;
    for (const b of sc.bodies) x += body(b) + '\n';
    for (const j of sc.joints || []) x += `<${j.type} containerField="joints" ${j.attrs}><RigidBody USE="B_${j.b1}" containerField="body1"/><RigidBody USE="B_${j.b2}" containerField="body2"/></${j.type}>\n`;
    x += '</RigidBodyCollection>\n';
    for (const b of drawn) x += `<ROUTE fromNode="B_${b.id}" fromField="position" toNode="T_${b.id}" toField="set_translation"/><ROUTE fromNode="B_${b.id}" fromField="orientation" toNode="T_${b.id}" toField="set_rotation"/>\n`;
  } else {
    x += `<TimeSensor DEF="CLK" cycleInterval="${interp.T}" loop="true"/>\n`;
    for (const b of drawn) { const t = interp.tr['B_' + b.id]; if (!t) continue;
      x += `<PositionInterpolator DEF="PI_${b.id}" key="${interp.keys}" keyValue="${t.p.map((p) => p.map((v) => +v.toFixed(3)).join(' ')).join(' ')}"/><OrientationInterpolator DEF="OI_${b.id}" key="${interp.keys}" keyValue="${t.q.map((q) => q.map((v) => +v.toFixed(4)).join(' ')).join(' ')}"/>\n`;
      x += `<ROUTE fromNode="CLK" fromField="fraction_changed" toNode="PI_${b.id}" toField="set_fraction"/><ROUTE fromNode="CLK" fromField="fraction_changed" toNode="OI_${b.id}" toField="set_fraction"/><ROUTE fromNode="PI_${b.id}" fromField="value_changed" toNode="T_${b.id}" toField="set_translation"/><ROUTE fromNode="OI_${b.id}" fromField="value_changed" toNode="T_${b.id}" toField="set_rotation"/>\n`; }
  }
  return x + '</Scene></X3D>\n';
}

// ---- 1. AVALANCHE: 40 mixed bodies fall into a funnel (a floor and four tilted walls). Chaos: every engine heaps them differently. -----------------------------------------------------------------------
function avalanche(opt = {}) {
  seed = 7; const bodies = [], ps = [[0.95, 0.55, 0.25], [0.25, 0.8, 0.95], [0.6, 0.95, 0.4], [0.95, 0.4, 0.7], [0.98, 0.85, 0.3]];
  // funnel: floor + 4 walls leaning 0.45 rad
  const W = (id, pos, rot, size) => ({ id, geom: { kind: 'box', size }, pos, rot, fixed: true, color: [0.16, 0.2, 0.32] });
  const lean = 0.5;
  bodies.push(W('floor', [0, -0.25, 0], null, [3.2, 0.5, 3.2]));
  bodies.push(W('wE', [2.0, 1.2, 0], [0, 0, 1, -lean], [0.3, 4.2, 6]), W('wW', [-2.0, 1.2, 0], [0, 0, 1, lean], [0.3, 4.2, 6]), W('wN', [0, 1.2, -2.0], [1, 0, 0, -lean], [6, 4.2, 0.3]), W('wS', [0, 1.2, 2.0], [1, 0, 0, lean], [6, 4.2, 0.3]));
  for (const b of bodies) b.hidden = false;
  const kinds = ['sphere', 'box', 'cylinder', 'cone'];
  for (let i = 0; i < 40; i++) {
    const k = kinds[i % 4], layer = Math.floor(i / 9), ix = i % 3, iz = Math.floor((i % 9) / 3);
    // default: a 3 x 3 lattice per layer (0.85 m apart, bodies are at most 0.7 m wide) with a small jitter, so nothing starts inside anything else; opt.overlap: the old random column, bodies overlap at the start (a stress test)
    const x = opt.overlap ? (rnd() - 0.5) * 1.8 : (ix - 1) * 0.85 + (rnd() - 0.5) * 0.16, z = opt.overlap ? (rnd() - 0.5) * 1.8 : (iz - 1) * 0.85 + (rnd() - 0.5) * 0.16;
    const y = opt.overlap ? 2.2 + Math.floor(i / 8) * 0.85 + rnd() * 0.2 : 2.2 + layer * 0.95 + rnd() * 0.1;
    const geom = k === 'sphere' ? { kind: 'sphere', r: 0.28 } : k === 'box' ? { kind: 'box', size: [0.5, 0.5, 0.5] } : k === 'cylinder' ? { kind: 'cylinder', r: 0.22, h: 0.55 } : { kind: 'cone', r: 0.3, h: 0.6 };
    const ax = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], l = Math.hypot(...ax) || 1;
    bodies.push({ id: 'p' + i, geom, pos: [x, y, z].map((v) => +v.toFixed(3)), rot: [ax[0] / l, ax[1] / l, ax[2] / l, +(rnd() * 3).toFixed(3)].map((v) => +v.toFixed(3)), color: ps[i % 5], mass: 1 });
  }
  return { id: 'avalanche', title: 'Avalanche', T: 5, bounce: 0.15, mu: 0.5, bodies, camera: { pos: [0, 5.2, 9.4], rot: [1, 0, 0, -0.42] }, note: '40 bodies (10 each of sphere, box, cylinder, cone) into a funnel; cone and cylinder are real shapes in Rapier and cannon-es, bounding spheres in the built-in engine' };
}
// ---- 2. CRADLE: five 0.5 m balls on BallJoint strings; the left one is lifted. Elastic (bounce 1). A good cradle passes the impulse through and swings the last ball. ----------------------------------------------
function cradle() {
  const bodies = [], joints = [], L = 3, r = 0.5, cols = [[0.95, 0.55, 0.25], [0.95, 0.85, 0.3], [0.6, 0.95, 0.4], [0.25, 0.8, 0.95], [0.7, 0.5, 0.98]];
  bodies.push({ id: 'beam', geom: { kind: 'box', size: [7, 0.2, 0.3] }, pos: [0, 4.1, 0], fixed: true, color: [0.2, 0.25, 0.4] });
  const ang = 0.7;
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * (2 * r + 0.002), lifted = i === 0;
    const pos = lifted ? [x - L * Math.sin(ang), 4 - L * Math.cos(ang), 0] : [x, 4 - L, 0];
    bodies.push({ id: 'ball' + i, geom: { kind: 'sphere', r }, pos: pos.map((v) => +v.toFixed(4)), color: cols[i], mass: 1 });
    joints.push({ type: 'BallJoint', attrs: `anchorPoint="${x} 4 0"`, b1: 'beam', b2: 'ball' + i });
  }
  return { id: 'cradle', title: "Newton's cradle", T: 8, bounce: 1, mu: 0.1, iterations: 20, rapierOpts: { sub: 4 }, bodies, joints, camera: { pos: [0, 2.6, 11], rot: [1, 0, 0, -0.08] }, note: 'five 0.5 m spheres, 1 kg, BallJoint strings 3 m, bounce 1, left ball lifted 0.7 rad; the strings are not drawn' };
}
// ---- 3. GATE: a door on a limited hinge swings into its stop, a cart on a slider runs into its stop, and a bouncing ball keeps time. X_ITE 16.6.0 builds hinges without limits (docs chapter 13 section 9.5). -------------
function gate() {
  const bodies = [], joints = [];
  bodies.push({ id: 'ground', geom: { kind: 'box', size: [14, 0.4, 8] }, pos: [0, -0.2, 0], fixed: true, color: [0.14, 0.18, 0.3] });
  bodies.push({ id: 'post', geom: { kind: 'box', size: [0.3, 4, 0.3] }, pos: [-3.5, 2, 0], fixed: true, color: [0.5, 0.52, 0.6] });
  bodies.push({ id: 'door', geom: { kind: 'box', size: [2.4, 3.2, 0.12] }, pos: [-1.95, 2.1, 0], mass: 2, avel: [0, 3.2, 0], vel: [0, 0, -4.48], color: [0.95, 0.55, 0.25] });
  joints.push({ type: 'SingleAxisHingeJoint', attrs: 'anchorPoint="-3.35 2.1 0" axis="0 1 0" minAngle="-1.1" maxAngle="1.1" stopBounce="0"', b1: 'post', b2: 'door' });
  bodies.push({ id: 'rail', geom: { kind: 'box', size: [0.4, 0.4, 0.4] }, pos: [0.5, 0.9, 2.2], fixed: true, color: [0.5, 0.52, 0.6] });
  bodies.push({ id: 'stopL', geom: { kind: 'box', size: [0.15, 0.7, 0.7] }, pos: [0.15, 0.9, 2.2], fixed: true, color: [0.95, 0.4, 0.4], hidden: false });
  bodies.push({ id: 'stopR', geom: { kind: 'box', size: [0.15, 0.7, 0.7] }, pos: [4.6, 0.9, 2.2], fixed: true, color: [0.95, 0.4, 0.4] });
  bodies.push({ id: 'cart', geom: { kind: 'box', size: [0.8, 0.6, 0.6] }, pos: [1.4, 0.9, 2.2], vel: [3, 0, 0], color: [0.25, 0.8, 0.95] });
  joints.push({ type: 'SliderJoint', attrs: 'axis="1 0 0" minSeparation="0.9" maxSeparation="3.7" stopBounce="0"', b1: 'rail', b2: 'cart' });
  bodies.push({ id: 'ball', geom: { kind: 'sphere', r: 0.45 }, pos: [3, 6, -1.8], color: [0.6, 0.95, 0.4] });
  return { id: 'gate', title: 'Gate, cart and ball', T: 6, bounce: 0.8, mu: 0.4, bodies, joints, camera: { pos: [0, 4.2, 12.5], rot: [1, 0, 0, -0.2] }, note: 'door: hinge limit +-1.1 rad, spun at 3.2 rad/s; cart: slider stops at 0.9 and 3.7 m, thrown at 3 m/s; ball: bounce 0.8' };
}
module.exports = { avalanche, cradle, gate, sceneXml };
