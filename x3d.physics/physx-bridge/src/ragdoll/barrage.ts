// The dummy barrage page: three trebuchets, three toon crash-test dummies, a showpiece castle. Fire removes a trebuchet's Latch joint
// from RigidBodyCollection.joints; at release the Sling joint goes too, the dummy-weight ball leaves the simulation and the real ragdoll
// takes its place with its velocity (an X3D joint cannot hold an H-Anim figure). Words pop, dummies grunt, stones thud, the castle falls.
import { DemoShell, X3D, $, rows } from '../demos/shell.ts';
import { BODY_STRIDE, CONTACT_STRIDE } from '../bridge/model.ts';
import type { Vec3 } from '../bridge/model.ts';
import { flightAngle, shouldRelease } from '../demos/trebuchet-scene.ts';
import { lookAt } from '../demos/view.ts';
import { LANES, buildBarrage, defaultBarrage } from './barrage-scene.ts';
import { OuchMeter, partOf } from './ouch.ts';
import type { Hit } from './ouch.ts';
import { CrashTest, headWord } from './crashtest.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;
const POPS = 14, VIEWS = ['Battery', 'Castle', 'Field', 'Follow'];
interface Lane { k: number; arm: number; stone: number; root: number; links: { index: number; segment: string; mass: number }[]; phase: 'cocked' | 'swinging' | 'flying' | 'landed'; ouch: OuchMeter; crash: CrashTest; flewAt: number; boomed: boolean }

const S = {
  b: defaultBarrage(),
  lanes: [] as Lane[],
  linkOf: new Map<number, Lane>(),
  blocks: [] as number[], blocks0: [] as Vec3[], roofs: [] as number[], roofs0: [] as Vec3[],
  pops: [] as { t: SAI; text: SAI; mat: SAI; born: number; at: Vec3 }[], popNext: 0, popAt: 0,
  gruntAt: 0, follow: -1, view: 0, queue: [] as number[], nextFireAt: 0,
  damage: { stones: 0, roofs: 0 },
  explosive: true,
  blockSet: new Set<number>(),
  booms: [] as { at: Vec3; born: number }[],
  heat: true, frameAt: 0,
};

const shell: DemoShell = new DemoShell({
  id: 'barrage',
  title: 'Dummy barrage',
  tagline: 'Three trebuchets, three crash-test dummies, one very nice castle',
  controls: [
    { id: 'fire', group: 'Barrage', label: 'Fire next', key: 'f', run: () => fireNext() },
    { id: 'all', group: 'Barrage', label: 'Fire all three', key: 'a', run: () => { S.queue = S.lanes.filter((l) => l.phase === 'cocked').map((l) => l.k); S.nextFireAt = 0; if (!shell.bridge.running) shell.run(); } },
    { id: 'view', group: 'Barrage', label: 'View: Battery', key: 'v', run: () => setView((S.view + 1) % VIEWS.length) },
    { id: 'heat', group: 'Barrage', label: 'Heat map', key: 't', pressed: true, title: 'crash-test view: each body part turns yellow, orange, red by the hardest hit it took', run: () => { S.heat = !S.heat; shell.setPressed('heat', S.heat); for (const l of S.lanes) l.crash.show(S.heat); } },
    { id: 'explosive', group: 'Barrage', label: 'Explosive dummies', key: 'x', pressed: true, run: () => { S.explosive = !S.explosive; shell.setPressed('explosive', S.explosive); } },
  ],
  scene: () => {
    const b = buildBarrage(S.b);
    return { ir: b.ir, meta: { ...b.meta, components: (b.meta.components ?? '') + '  <component name="Text" level="1"/>\n', extra: `${b.meta.extra}\n${extras()}` } };
  },
  sound: {
    samples: ['thud-stone', 'thud-body', 'bonk', 'oof', 'ow', 'ugh', 'knock-wood', 'boom'], voices: 6, impulseRange: [2, 1500], settle: 0.5,
    pick: (e) => {
      const lane = S.linkOf.get(e.b1) ?? S.linkOf.get(e.b2);
      if (!lane) return e.impulse > 15 ? { sample: 'thud-stone' } : null;
      const link = lane.links.find((l) => l.index === e.b1 || l.index === e.b2)!, now = performance.now();
      if (e.impulse > 30 && now - S.gruntAt > 350) { S.gruntAt = now; return { sample: ['oof', 'ow', 'ugh'][Math.floor(now) % 3], note: 50 }; }
      return partOf(link.segment) === 'head' ? { sample: 'bonk' } : { sample: 'thud-body' };
    },
  },
  loaded: (read) => {
    const b = buildBarrage(S.b);
    S.blocks = b.idx.blocks; S.roofs = b.idx.roofs;
    S.lanes = b.idx.tre.map((t, k) => {
      const h = read.humanoids[k].model;
      return { k, arm: t.arm, stone: t.stone, root: h.links[0].index, links: h.links.map((l) => ({ index: l.index, segment: l.segment, mass: l.mass })), phase: 'cocked', ouch: new OuchMeter(h.links), crash: new CrashTest(shell.bridge.scene, `t${k}_`, h.links), flewAt: 0, boomed: false } as Lane;
    });
    for (const l of S.lanes) l.crash.show(S.heat);
    S.blockSet = new Set([...S.blocks, ...S.roofs]);
    S.linkOf = new Map(S.lanes.flatMap((l) => l.links.map((x) => [x.index, l] as [number, Lane])));
    const st = shell.bridge.lastState!;
    const at = (i: number): Vec3 => [st[i * BODY_STRIDE], st[i * BODY_STRIDE + 1], st[i * BODY_STRIDE + 2]];
    S.blocks0 = S.blocks.map(at); S.roofs0 = S.roofs.map(at); S.damage = { stones: 0, roofs: 0 }; S.queue = []; S.follow = -1;
    const sc = shell.bridge.scene;
    S.pops = Array.from({ length: POPS }, (_, k) => ({ t: sc.getNamedNode(`Pop${k}`), text: sc.getNamedNode(`PopText${k}`), mat: sc.getNamedNode(`PopMat${k}`), born: -1, at: [0, 0, 0] as Vec3 }));
    setView(0);
    readout();
    shell.hud('F fires the next trebuchet · A fires all three · V view · R rebuilds the castle');
    if (!shell.bridge.running) shell.run();
  },
  state: (e) => onState(e.time, e.events),
  counters: () => [['dummies thrown', String(S.lanes.filter((l) => l.phase !== 'cocked' && l.phase !== 'swinging').length)], ['stones knocked out', `${S.damage.stones} of ${S.blocks.length}`]],
  save: () => S.b,
  restore: () => null,
  fileName: () => 'dummy-barrage',
});

function extras() {
  const pops = Array.from({ length: POPS }, (_, k) => `  <Transform DEF="Pop${k}" scale="0 0 0"><Billboard axisOfRotation="0 0 0"><Shape><Appearance><Material DEF="PopMat${k}" diffuseColor="0 0 0" emissiveColor="1 0.8 0.2"/></Appearance><Text DEF="PopText${k}" string='"BONK!"'><FontStyle family='"SANS"' style="BOLD" justify='"MIDDLE" "MIDDLE"' size="1.1"/></Text></Shape></Billboard></Transform>`).join('\n');
  const fire = `  <Transform DEF="Fireball" scale="0 0 0"><Shape><Appearance><Material DEF="FireMat" diffuseColor="0 0 0" emissiveColor="1 0.6 0.12" transparency="0.15"/></Appearance><Sphere radius="1"/></Shape></Transform>\n  <SpatialSound DEF="Sfx_boom" location="150 3 0" intensity="0.9" referenceDistance="60" rolloffFactor="0.3" distanceModel="INVERSE"><AudioClip DEF="SfxClip_boom" containerField="children" url='"sounds/boom.wav"'/></SpatialSound>`;
  const sfx = `  <SpatialSound DEF="Sfx_whistle" location="0 10 0" intensity="0.9" referenceDistance="40" rolloffFactor="0.4" distanceModel="INVERSE"><AudioClip DEF="SfxClip_whistle" containerField="children" url='"sounds/whistle-down.wav"'/></SpatialSound>`;
  return `${pops}\n${fire}\n${sfx}\n  <Viewpoint DEF="Follow" description="Following the dummy" position="-10 8 20" fieldOfView="0.85"/>`;
}

const removeJoint = (def: string) => {
  const coll = shell.bridge.scene.getNamedNode('Machine'), keep = [];
  for (let i = 0; i < coll.joints.length; i++) if (coll.joints[i].getNodeName() !== def) keep.push(coll.joints[i]);
  coll.joints = new X3D.MFNode(...keep);
};

function fireNext() { const l = S.lanes.find((x) => x.phase === 'cocked'); if (l) fire(l); else shell.status('all three are thrown: R rebuilds the castle and re-cocks'); }
function fire(l: Lane) {
  removeJoint(`T${l.k}Latch`);
  l.phase = 'swinging';
  if (!shell.bridge.running) shell.run();
  shell.status(`trebuchet ${l.k + 1}: the Latch joint was removed from the collection`);
}

function onState(t: number, events: Float32Array) {
  const st = shell.bridge.lastState; if (!st || !S.lanes.length) return;
  // a volley: one trebuchet every 1.6 s
  if (S.queue.length && t >= S.nextFireAt) { const l = S.lanes[S.queue.shift()!]; if (l.phase === 'cocked') fire(l); S.nextFireAt = t + 1.6; }
  for (const l of S.lanes) {
    if (l.phase === 'swinging') {
      const o = l.stone * BODY_STRIDE, vx = st[o + 7], vy = st[o + 8];
      if (shouldRelease(vx, vy, 40)) release(l, [st[o], st[o + 1], st[o + 2]], [vx, vy, st[o + 9]]);
    }
  }
  // explosive dummies: the first hard hit on the castle goes KA-BOOM
  if (S.explosive) for (let o = 0; o < events.length; o += CONTACT_STRIDE) {
    const a = events[o], b = events[o + 1], lane = S.linkOf.get(a) ?? S.linkOf.get(b), other = S.linkOf.has(a) ? b : a;
    if (lane && !lane.boomed && lane.phase === 'flying' && S.blockSet.has(other) && events[o + 11] > 20) boom(lane, [events[o + 4], events[o + 5], events[o + 6]]);
  }
  for (const l of S.lanes) if (l.phase === 'flying' || l.phase === 'landed') {
    for (const h of l.ouch.feed(events, t)) { l.crash.hit(h.link, h.dv); if (h.dv >= 2 && performance.now() - S.popAt > 110) { S.popAt = performance.now(); pop(h); } }
    l.crash.sample(st, t);
  }
  // a dummy has landed when it is slow, low and has flown a while
  for (const l of S.lanes) if (l.phase === 'flying' && t - l.flewAt > 2) { const o = l.root * BODY_STRIDE; if (Math.hypot(st[o + 7], st[o + 8], st[o + 9]) < 2) { l.phase = 'landed'; if (S.follow === l.k) setTimeout(() => setView(1), 900); } }
  // castle damage: stones moved more than 30 cm; roofs dropped a metre
  if (Math.round(t * 10) % 3 === 0) {
    const at = (i: number): Vec3 => [st[i * BODY_STRIDE], st[i * BODY_STRIDE + 1], st[i * BODY_STRIDE + 2]];
    S.damage.stones = S.blocks.filter((i, j) => Math.hypot(...at(i).map((x, c) => x - S.blocks0[j][c])) > 0.3).length;
    S.damage.roofs = S.roofs.filter((i, j) => at(i)[1] < S.roofs0[j][1] - 1).length;
    readout();
  }
  if (S.view === 3) follow();
  animatePops();
  const now = performance.now(); for (const l of S.lanes) l.crash.tick(S.frameAt ? Math.min(0.1, (now - S.frameAt) / 1000) : 0); S.frameAt = now;
}

/** The swap: the ball leaves (CollidableShape.enabled, hidden), the dummy appears just ahead of it with its velocity. */
function release(l: Lane, p: Vec3, v: Vec3) {
  removeJoint(`T${l.k}Sling`);
  const sc = shell.bridge.scene;
  try { sc.getNamedNode(`T${l.k}StoneS`).enabled = false; sc.getNamedNode(`T${l.k}StoneT`).scale = new X3D.SFVec3f(0, 0, 0); } catch { /* */ }
  const s = Math.hypot(...v), ahead: Vec3 = [p[0] + (v[0] / s) * 1.5, p[1] + (v[1] / s) * 1.5, p[2]];
  shell.bridge.teleport(l.root, ahead, [Math.SQRT1_2, 0, 0, Math.SQRT1_2], v, [0, 0, 2 + l.k]);
  l.phase = 'flying'; l.flewAt = shell.bridge.stats.simTime; l.crash.reset();
  try { sc.getNamedNode('Sfx_whistle').location = new X3D.SFVec3f(...ahead); if (!shell.muted) { sc.getNamedNode('Sfx_whistle').intensity = shell.soundVolume; sc.getNamedNode('SfxClip_whistle').startTime = Date.now() / 1000; } } catch { /* */ }
  S.follow = l.k; setView(3);
  shell.status(`dummy ${l.k + 1} away at ${s.toFixed(1)} m/s, ${flightAngle(v[0], v[1]).toFixed(0)}° up: the ball left the simulation and the H-Anim ragdoll took its place`);
}

/** A cartoon blast at a point: stones within 4.5 m thrown outward and up, the dummy too; fireball, boom, KA-BOOM. */
function boom(l: Lane, at: Vec3) {
  l.boomed = true;
  const st = shell.bridge.lastState!, R = 4.5;
  for (const i of S.blockSet) {
    const o = i * BODY_STRIDE, d: Vec3 = [st[o] - at[0], st[o + 1] - at[1], st[o + 2] - at[2]], r = Math.hypot(...d);
    if (r > R || r < 1e-3) continue;
    const m = 20, k = (m * 14) / Math.max(0.8, r);
    shell.bridge.impulse(i, [(d[0] / r) * k + m * 3, (d[1] / r) * k + m * 5, (d[2] / r) * k]);
  }
  for (const x of l.links) shell.bridge.impulse(x.index, [-x.mass * 3, x.mass * 6, 0]); // the dummy bounces back out of the hole
  S.booms.push({ at, born: performance.now() });
  try {
    const sc = shell.bridge.scene, f = sc.getNamedNode('Fireball');
    f.translation = new X3D.SFVec3f(...at);
    if (!shell.muted) { sc.getNamedNode('Sfx_boom').location = new X3D.SFVec3f(...at); sc.getNamedNode('Sfx_boom').intensity = shell.soundVolume; sc.getNamedNode('SfxClip_boom').startTime = Date.now() / 1000; }
  } catch { /* */ }
  pop({ t: 0, link: -1, segment: '', part: 'torso', dv: 99, points: 0, combo: 0, word: 'KA-BOOM!', at: [at[0], at[1] + 1.5, at[2]] }, 2.4);
}

function follow() {
  const l = S.lanes[S.follow]; if (!l) return;
  const st = shell.bridge.lastState!, o = l.root * BODY_STRIDE, p: Vec3 = [st[o], st[o + 1], st[o + 2]];
  if (!p.every(Number.isFinite)) return;
  try {
    const vp = shell.bridge.scene.getNamedNode('Follow'), from: Vec3 = [p[0] - 13, Math.max(3, p[1] + 3.5), p[2] + 17];
    vp.position = new X3D.SFVec3f(...from);
    const [x, y, z, a] = lookAt(from, [p[0] + 4, p[1], p[2]]).split(' ').map(Number);
    vp.orientation = new X3D.SFRotation(x, y, z, a);
  } catch { /* */ }
}
function setView(k: number) { S.view = k; if (k === 3) follow(); shell.view(VIEWS[k]); shell.labelButton('view', `View: ${VIEWS[k]}`); }

function pop(h: Hit, big = 1) {
  const p = S.pops[S.popNext++ % POPS]; if (!p?.t) return;
  (p as unknown as { big: number }).big = big;
  p.text.string = new X3D.MFString(h.word);
  const hot = Math.min(1, h.dv / 8);
  p.mat.emissiveColor = new X3D.SFColor(1, 0.85 - 0.55 * hot, 0.25 - 0.2 * hot); p.mat.transparency = 0;
  p.born = performance.now(); p.at = [h.at[0], h.at[1] + 0.8, h.at[2]];
}
function animatePops() {
  const now = performance.now();
  for (const p of S.pops) {
    if (p.born < 0 || !p.t) continue;
    const age = (now - p.born) / 1000;
    if (age > 1.2) { p.t.scale = new X3D.SFVec3f(0, 0, 0); p.born = -1; continue; }
    const big = (p as unknown as { big?: number }).big ?? 1, s = big * (age < 0.12 ? (age / 0.12) * 1.3 : 1.3 - 0.3 * Math.min(1, (age - 0.12) / 0.12));
    p.t.scale = new X3D.SFVec3f(s, s, s); p.t.translation = new X3D.SFVec3f(p.at[0], p.at[1] + 1.2 * age, p.at[2]); p.mat.transparency = Math.max(0, (age - 0.8) / 0.4);
  }
  // the fireball grows and fades (one at a time; the newest blast)
  const b = S.booms[S.booms.length - 1];
  try {
    const f = shell.bridge.scene.getNamedNode('Fireball'), m = shell.bridge.scene.getNamedNode('FireMat');
    const age = b ? (now - b.born) / 1000 : 9;
    if (age > 1.1) f.scale = new X3D.SFVec3f(0, 0, 0);
    else { const r = 0.8 + 5 * Math.sqrt(age / 1.1); f.scale = new X3D.SFVec3f(r, r, r); m.transparency = Math.min(1, 0.15 + age * 0.8); m.emissiveColor = new X3D.SFColor(1, 0.6 - 0.45 * age, 0.12); }
  } catch { /* */ }
}

function readout() {
  const pct = S.blocks.length ? Math.round((100 * S.damage.stones) / S.blocks.length) : 0;
  $('castle-big').textContent = `${pct} % of the castle`;
  rows($('castle-readout'), [
    ['stones knocked out', `${S.damage.stones} of ${S.blocks.length}`],
    ['roofs toppled', `${S.damage.roofs} of ${S.roofs.length}`],
    ...S.lanes.map((l): [string, string] => [`dummy ${l.k + 1}`, `${l.phase}${l.ouch.total ? ` · ${l.ouch.total.toLocaleString('en-US')} ouch` : ''}${l.crash.hic > 0 ? ` · head ${Math.round(l.crash.hic)}, ${headWord(l.crash.hic)}` : ''}`]),
  ]);
}

void shell.start();
Object.assign(window as unknown as Record<string, unknown>, { __bar: S, LANES });
