// Scenes for the engine comparison. Each scene: { id, T, xml, probes: [DEF...], analyse(trajs) -> metrics, analytic note }.
// A trajectory is { t: [s...], p: [[x,y,z]...], q: [[x,y,z,angle]...] } sampled at 60 Hz from simulation start, per probed RigidBody DEF.
// The XML is plain X3D 4.0 (no script): the same text goes to X_ITE 16.6.0 and to the bridge reader.
const g = 9.8;
const head = (t) => `<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Immersive" version="4.0"><head><component name="RigidBodyPhysics" level="2"/><meta name="title" content="${t}"/></head><Scene>\n<NavigationInfo type='"EXAMINE"' headlight="true"/><Viewpoint position="0 3 14"/>\n`;
const tail = '</Scene></X3D>\n';
const shape = (geom, def, ctn = 'geometry') => `<CollidableShape ${def ? `DEF="${def}" ` : ''}containerField="${ctn}"><Shape containerField="shape">${geom}</Shape></CollidableShape>`;
const rb = (def, pos, geom, o = '') => `<RigidBody DEF="${def}" position="${pos.join(' ')}" ${o}>${shape(geom)}</RigidBody>`;
const col = (o = '') => `<CollisionCollection containerField="collider" ${o}/>`;
const joint = (type, attrs, b1, b2) => `<${type} containerField="joints" ${attrs}><RigidBody USE="${b1}" containerField="body1"/><RigidBody USE="${b2}" containerField="body2"/></${type}>`;
const GROUND = (y = -0.5) => rb('G', [0, y, 0], '<Box size="40 1 40"/>', 'mass="1" fixed="true"');

const stat = {
  max: (a) => Math.max(...a), min: (a) => Math.min(...a), last: (a) => a[a.length - 1],
  crossings: (t, y, level = 0) => { const out = []; for (let i = 1; i < y.length; i++) if ((y[i - 1] - level) < 0 && (y[i] - level) >= 0) { const f = (level - y[i - 1]) / (y[i] - y[i - 1]); out.push(t[i - 1] + f * (t[i] - t[i - 1])); } return out; },
};

const scenes = [];
// 1. drop: a sphere (r 0.5, 1 kg) falls 4.5 m (centre 5 -> 0.5 at contact) onto a fixed ground; bounce 0.5. Analytic: contact at sqrt(2*4.5/g)=0.958 s, v = 9.39 m/s; rebound apex height 0.25 * 4.5 = 1.125 m above the contact centre.
scenes.push({
  id: 'drop-bounce', T: 3, probes: ['S'],
  xml: head('drop-bounce') + `<RigidBodyCollection DEF="W" gravity="0 -${g} 0">${col('bounce="0.5" minBounceSpeed="0" appliedParameters=\'"BOUNCE"\'')}${GROUND()}${rb('S', [0, 5, 0], '<Sphere radius="0.5"/>', 'mass="1"')}</RigidBodyCollection>` + tail,
  analyse(tr) {
    const y = tr.S.p.map((p) => p[1]), t = tr.S.t, apex = [], tImpact = Math.sqrt(2 * 4.5 / g);
    let first = y.findIndex((v, i) => t[i] > tImpact - 0.2 && v <= 0.55); let hi = -1; if (first >= 0) for (let i = first; i < y.length; i++) { if (y[i] > hi) hi = y[i]; if (y[i] < hi - 0.02 && hi > 0.6) break; }
    const rest = stat.last(y);
    return { 'apex above contact (m), analytic 1.125': +(hi - 0.5).toFixed(3), 'final centre height (m), analytic 0.5': +rest.toFixed(3), 'first contact (s), analytic 0.958': +(t[first] ?? NaN).toFixed(3) };
  },
});
// 2. stack: three 1 m boxes stacked, 1 kg each, 6 s. Expect all three at rest: heights 0.5 / 1.5 / 2.5 and no drift sideways.
scenes.push({
  id: 'stack3', T: 6, probes: ['B1', 'B2', 'B3'],
  xml: head('stack3') + `<RigidBodyCollection DEF="W" gravity="0 -${g} 0">${col('bounce="0" appliedParameters=\'"BOUNCE"\'')}${GROUND()}${rb('B1', [0, 0.5, 0], '<Box size="1 1 1"/>', 'mass="1"')}${rb('B2', [0, 1.51, 0], '<Box size="1 1 1"/>', 'mass="1"')}${rb('B3', [0, 2.52, 0], '<Box size="1 1 1"/>', 'mass="1"')}</RigidBodyCollection>` + tail,
  analyse(tr) {
    const dr = (k) => Math.hypot(tr[k].p[tr[k].p.length - 1][0], tr[k].p[tr[k].p.length - 1][2]);
    return { 'B1 height (m), ideal 0.5': +stat.last(tr.B1.p.map((p) => p[1])).toFixed(4), 'B2 height (m), ideal 1.5': +stat.last(tr.B2.p.map((p) => p[1])).toFixed(4), 'B3 height (m), ideal 2.5': +stat.last(tr.B3.p.map((p) => p[1])).toFixed(4), 'sideways drift of top box (m)': +dr('B3').toFixed(5) };
  },
});
// 3. slope: a 1 m cube on a 30 degree ground, Coulomb friction mu 0.2. Analytic a = g (sin 30 - 0.2 cos 30) = 3.19 m/s^2; the distance in the 1 s from t=0.5 to 1.5 s is v0 + a/2 ...
const th = Math.PI / 6, nrm = [-Math.sin(th), Math.cos(th), 0];
scenes.push({
  id: 'slope-mu0.2', T: 2, probes: ['C'],
  xml: head('slope') + `<RigidBodyCollection DEF="W" gravity="0 -${g} 0">${col(`bounce="0" frictionCoefficients="0.2 0.2" appliedParameters='"FRICTION_COEFFICIENT-2"'`)}<RigidBody DEF="G" position="0 0 0" orientation="0 0 1 ${th}" mass="1" fixed="true">${shape('<Box size="60 1 60"/>')}</RigidBody>${rb('C', [nrm[0] * 1.0, nrm[1] * 1.0 + 0.002, 0], '<Box size="1 1 1"/>', `mass="1" orientation="0 0 1 ${th}"`)}</RigidBodyCollection>` + tail,
  analyse(tr) {
    const p = tr.C.p, t = tr.C.t, along = (q) => (q[0] * -Math.cos(th) + q[1] * -Math.sin(th));      // distance travelled downhill
    const at = (s) => { const i = t.findIndex((x) => x >= s); return along(p[i]); };
    const d = at(1.5) - at(0.5), v = (at(1.5) - at(1.0)) / 0.5 - (at(1.0) - at(0.5)) / 0.5;       // v is a * 0.5 s, so acceleration = diff of mean speeds / 0.5 s
    return { 'downhill distance, 0.5 s to 1.5 s (m)': +d.toFixed(3), 'acceleration (m/s2), analytic 3.19': +(v / 0.5).toFixed(2) };
  },
});
// 4. pendulum: a 0.25 m sphere bob 2 m from a BallJoint pivot, released at 10 degrees. Physical pendulum T = 2 pi sqrt((L^2 + 0.4 r^2) / (g L)) = 2.8429 s, 5 oscillations in 15 s.
const L = 2, r = 0.25, ang = 10 * Math.PI / 180, T0 = 2 * Math.PI * Math.sqrt((L * L + 0.4 * r * r) / (g * L));
scenes.push({
  id: 'pendulum-ball', T: 15, probes: ['Bob'], analytic: { period: T0 },
  xml: head('pendulum') + `<RigidBodyCollection DEF="W" gravity="0 -${g} 0">${col('bounce="0"')}${rb('Pin', [0, 5, 0], '<Box size="0.2 0.2 0.2"/>', 'mass="1" fixed="true"')}${rb('Bob', [L * Math.sin(ang), 5 - L * Math.cos(ang), 0], `<Sphere radius="${r}"/>`, 'mass="1"')}${joint('BallJoint', 'anchorPoint="0 5 0"', 'Pin', 'Bob')}</RigidBodyCollection>` + tail,
  analyse(tr) {
    const x = tr.Bob.p.map((p) => p[0]), up = stat.crossings(tr.Bob.t, x, 0), down = stat.crossings(tr.Bob.t, x.map((v) => -v), 0), all = up.concat(down).sort((a, b) => a - b);
    const per = all.length > 2 ? (all[all.length - 1] - all[0]) / (all.length - 1) * 2 : NaN;
    const len = tr.Bob.p.map((p) => Math.hypot(p[0], p[1] - 5, p[2])), amp = Math.max(...x.slice(-200).map(Math.abs));
    return { ['period (s), analytic ' + T0.toFixed(4)]: +per.toFixed(4), 'period error (%)': +((per - T0) / T0 * 100).toFixed(2), 'max drift of arm length (m), ideal 0': +(Math.max(...len) - Math.min(...len)).toFixed(4), 'amplitude in the last 3 s (m), start 0.347': +amp.toFixed(3) };
  },
});
// 5. hinge door: a 0.8x2x0.1 door on a vertical SingleAxisHinge, spun at 3 rad/s into a stop at +1.0 rad, bounce 0. Gravity cannot move it.
scenes.push({
  id: 'hinge-limit', T: 3, probes: ['Door'],
  xml: head('hinge') + `<RigidBodyCollection DEF="W" gravity="0 -${g} 0">${col('bounce="0"')}${rb('Frame', [0, 2, 0], '<Box size="0.2 4 0.2"/>', 'mass="1" fixed="true"')}${rb('Door', [0.6, 2, 0], '<Box size="0.8 2 0.1"/>', 'mass="1" angularVelocity="0 3 0" linearVelocity="0 0 -1.5"')}${joint('SingleAxisHingeJoint', 'anchorPoint="0.1 2 0" axis="0 1 0" minAngle="-1" maxAngle="1" stopBounce="0"', 'Frame', 'Door')}</RigidBodyCollection>` + tail,
  analyse(tr) {
    const th2 = tr.Door.p.map((p) => Math.atan2(-(p[2]), p[0] - 0.1)), mx = Math.max(...th2.map((v) => Math.abs(v))), last = Math.abs(stat.last(th2));
    const anchorDrift = Math.max(...tr.Door.p.map((p) => Math.abs(Math.hypot(p[0] - 0.1, p[2]) - 0.5)));
    return { 'max angle (rad), limit 1.0': +mx.toFixed(3), 'angle at 3 s (rad)': +last.toFixed(3), 'door centre off its 0.5 m circle (m), ideal 0': +anchorDrift.toFixed(4) };
  },
});
// 6. slider: a 1 kg box on a SliderJoint along +x, thrown at 2 m/s into a stop at separation 1.5 m (box starts 0.6 m out). Gravity on: it must not sag.
scenes.push({
  id: 'slider-limit', T: 3, probes: ['Car'],
  xml: head('slider') + `<RigidBodyCollection DEF="W" gravity="0 -${g} 0">${col('bounce="0"')}${rb('Rail', [0, 3, 0], '<Box size="0.4 0.4 0.4"/>', 'mass="1" fixed="true"')}${rb('Car', [0.6, 3, 0], '<Box size="0.4 0.4 0.4"/>', 'mass="1" linearVelocity="2 0 0"')}${joint('SliderJoint', 'axis="1 0 0" minSeparation="0.5" maxSeparation="1.5" stopBounce="0"', 'Rail', 'Car')}</RigidBodyCollection>` + tail,
  analyse(tr) {
    const xs = tr.Car.p.map((p) => p[0]), ys = tr.Car.p.map((p) => p[1]), zs = tr.Car.p.map((p) => p[2]);
    return { 'max separation (m), limit 1.5': +Math.max(...xs).toFixed(3), 'x at 3 s (m)': +stat.last(xs).toFixed(3), 'sag (m), ideal 0': +(3 - Math.min(...ys)).toFixed(4), 'z drift (m)': +Math.max(...zs.map(Math.abs)).toFixed(4) };
  },
});
// 7. billiards: two 1 kg spheres, A at 3 m/s hits B at rest, no gravity, bounce 1. Analytic: A stops, B leaves at 3 m/s (momentum and energy).
scenes.push({
  id: 'billiards-head-on', T: 2, probes: ['A', 'B'],
  xml: head('billiards') + `<RigidBodyCollection DEF="W" gravity="0 0 0">${col('bounce="1" minBounceSpeed="0" appliedParameters=\'"BOUNCE"\'')}${rb('A', [-3, 0, 0], '<Sphere radius="0.5"/>', 'mass="1" linearVelocity="3 0 0"')}${rb('B', [0, 0, 0], '<Sphere radius="0.5"/>', 'mass="1"')}</RigidBodyCollection>` + tail,
  analyse(tr) {
    const v = (k) => { const p = tr[k].p, n = p.length - 1; return (p[n][0] - p[n - 6][0]) / (tr[k].t[n] - tr[k].t[n - 6]); };
    const vA = v('A'), vB = v('B'), p0 = 3, ke0 = 4.5;
    return { 'A speed after (m/s), analytic 0': +vA.toFixed(3), 'B speed after (m/s), analytic 3': +vB.toFixed(3), 'momentum error (%)': +(Math.abs(vA + vB - p0) / p0 * 100).toFixed(2), 'energy error (%)': +(Math.abs(0.5 * (vA * vA + vB * vB) - ke0) / ke0 * 100).toFixed(2) };
  },
});
module.exports = { joint, scenes, stat, head, tail, rb, col, GROUND, shape, g };
