// Stairs of doom. The H-Anim figure waits at the top (physics paused: a stiff figure cannot balance on its own); a push sets every
// HAnimJoint.stiffness to 0 (limp: standard X3D, live), kicks the pelvis and records the attempt. Impacts score on the Ouch-o-meter,
// pop BONK!/OOF! words in 3D (X3D Text on Billboards), and play cartoon sounds and grunts. Power flicker toggles stiffness at random
// (rigid, then floppy). The TNT crate at the bottom goes KA-BOOM. The best crash replays in slow motion with its sounds and words.
import { DemoShell, X3D, $, el, rows } from '../demos/shell.ts';
import { BODY_STRIDE, CONTACT_STRIDE } from '../bridge/model.ts';
import type { Quat, Vec3 } from '../bridge/model.ts';
import type { RunLog } from '../bridge/bridge.ts';
import { lookAt } from '../demos/view.ts';
import { CANNON, WRECK, blast, buildStage, cannonDir, defaultStage, muzzle, tntAt } from './stage.ts';
import type { Contraption } from './stage.ts';
import { quatFromTo } from '../bridge/math.ts';
import type { Stage } from './stage.ts';
import { OuchMeter, PARTS, partOf } from './ouch.ts';
import type { Hit } from './ouch.ts';
import { CrashTest, headWord } from './crashtest.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;
const POPS = 12, PUSHES = { nudge: 1, shove: 2.5, launch: 5 } as const;
const VIEWS = ['Side', 'Top', 'Bottom', 'Follow'];

interface Attempt { n: number; character: string; push: string; score: number; hits: number; combo: number; byPart: Record<string, number>; log: RunLog | null }
const S = {
  stage: defaultStage() as Stage,
  links: [] as { index: number; segment: string; mass: number }[],
  linkSet: new Set<number>(),
  root: -1, rootCenter: [0, 0, 0] as Vec3,
  joints: [] as SAI[],
  phase: 'ready' as 'ready' | 'falling' | 'done',
  ouch: null as OuchMeter | null,
  pushAt: 0, quietSince: -1,
  attempts: [] as Attempt[],
  best: null as Attempt | null,
  flicker: false, flickerNext: 0, rigid: false,
  plank: false,
  pops: [] as { t: SAI; text: SAI; mat: SAI; born: number; at: Vec3 }[],
  popNext: 0,
  popAt: 0,
  boom: { node: null as SAI, done: false, at: 0 },
  gruntAt: 0,
  view: 0, auto: true,
  replay: false,
  tntBody: -1,
  loose: [] as number[],
  wrecker: -1, struck: false,
  crash: null as CrashTest | null, heat: true, frameAt: 0,
};

const shell: DemoShell = new DemoShell({
  id: 'ragdoll',
  title: 'Stairs of doom',
  tagline: 'A standard H-Anim humanoid, PhysX underneath, and a very long staircase',
  controls: [
    { id: 'go1', group: 'Stunt', label: 'Nudge', key: '1', run: () => go(1) },
    { id: 'go2', group: 'Stunt', label: 'Shove', key: '2', run: () => go(2) },
    { id: 'go3', group: 'Stunt', label: 'Launch', key: '3', run: () => go(3) },
    { id: 'c-stairs', group: 'Contraption', label: 'Stairs', key: 'j', run: () => pick('stairs'), pressed: true },
    { id: 'c-cannon', group: 'Contraption', label: 'Cannon', key: 'n', run: () => pick('cannon'), pressed: false },
    { id: 'c-wrecking', group: 'Contraption', label: 'Wrecking ball', key: 'w', run: () => pick('wrecking'), pressed: false },
    { id: 'boom', group: 'Stunt', label: 'Boom', key: 'b', run: () => explode('button'), title: 'set off the TNT crate' },
    { id: 'flicker', group: 'Stunt', label: 'Power flicker', key: 'f', run: () => toggleFlicker(), pressed: false, title: 'the dummy\'s power supply glitches: rigid, then floppy, at random' },
    { id: 'plank', group: 'Stunt', label: 'Plank', key: 'l', run: () => togglePlank(), pressed: false, title: 'fall stiff as a board' },
    { id: 'instant', group: 'Stunt', label: 'Instant replay', key: 'q', run: () => instantReplay(), title: 'the best crash in slow motion' },
    { id: 'swap', group: 'Who', label: 'Character: dummy', key: 'h', run: () => swap() },
    { id: 'view', group: 'Who', label: 'View: Side', key: 'v', run: () => cycleView() },
    { id: 'heat', group: 'Who', label: 'Heat map', key: 't', pressed: true, title: 'crash-test view: each body part turns yellow, orange, red by the hardest hit it took', run: () => { S.heat = !S.heat; shell.setPressed('heat', S.heat); S.crash?.show(S.heat); } },
    { id: 'auto', group: 'Who', label: 'Auto camera', key: 'a', run: () => { S.auto = !S.auto; shell.setPressed('auto', S.auto); }, pressed: true },
  ],
  scene: () => {
    const b = buildStage(S.stage);
    return { ir: b.ir, meta: { ...b.meta, components: (b.meta.components ?? '') + '  <component name="Text" level="1"/>\n', extra: `${b.meta.extra}\n${extras()}` } };
  },
  sound: {
    samples: ['bonk', 'thud-body', 'oof', 'ow', 'ugh', 'knock-wood', 'boing'], voices: 5, impulseRange: [0.8, 120], settle: 0.1,
    pick: (e) => {
      const l1 = S.linkSet.has(e.b1), l2 = S.linkSet.has(e.b2);
      if (!l1 && !l2) return e.impulse > 0.5 ? { sample: 'knock-wood' } : null; // boxes and props
      const link = S.links.find((l) => l.index === (l1 ? e.b1 : e.b2))!;
      const pitch = S.stage.character === 'cartoon' ? 55 : 43; // the cartoon squeaks a fifth higher; the dummy grunts low and robotic
      const now = performance.now();
      if (e.impulse > 25 && now - S.gruntAt > 450) { S.gruntAt = now; return { sample: ['oof', 'ow', 'ugh'][Math.floor(now) % 3], note: pitch }; }
      if (partOf(link.segment) === 'head' && e.impulse > 3) return { sample: 'bonk' };
      if (e.impulse > 60 && S.stage.character === 'cartoon') return { sample: 'boing' };
      return { sample: 'thud-body' };
    },
  },
  loaded: (read) => {
    const h = read.humanoids[0];
    S.links = h.model.links.map((l) => ({ index: l.index, segment: l.segment, mass: l.mass }));
    S.linkSet = new Set(S.links.map((l) => l.index));
    S.root = h.model.links[0].index; S.rootCenter = h.model.links[0].center; S.joints = h.joints;
    S.ouch = new OuchMeter(S.links);
    S.crash = new CrashTest(shell.bridge.scene, 'hanim_', h.model.links); S.crash.show(S.heat);
    S.phase = 'ready'; S.quietSince = -1; S.rigid = true; S.boom = { node: null, done: false, at: 0 };
    S.tntBody = read.bodyNodes.findIndex((n: SAI) => n.getNodeName() === 'TNTBody');
    S.wrecker = read.bodyNodes.findIndex((n: SAI) => n.getNodeName() === 'WreckerBody');
    S.loose = read.model.collections.flatMap((c) => c.bodies.filter((b) => !b.fixed).map((b) => b.index));
    const sc = shell.bridge.scene;
    S.pops = Array.from({ length: POPS }, (_, k) => ({ t: sc.getNamedNode(`Pop${k}`), text: sc.getNamedNode(`PopText${k}`), mat: sc.getNamedNode(`PopMat${k}`), born: -1, at: [0, 0, 0] as Vec3 }));
    if (!S.replay) setView(S.stage.contraption === 'stairs' ? (S.view === 3 ? 0 : S.view) : 0);
    readout();
    const who = S.stage.character === 'cartoon' ? 'She' : 'He';
    shell.hud({ stairs: `${who} is waiting at the top. 1 nudge · 2 shove · 3 launch`, cannon: `${who} is waiting by the cannon. 1 gentle · 2 strong · 3 max`, wrecking: `${who} is waiting for the ball. 1 gentle · 2 hard · 3 huge`, floor: `${who} is waiting.` }[S.stage.contraption] + ' · B boom · F power flicker · Q instant replay · J/N/W stairs, cannon, wrecking ball');
  },
  state: (e) => onState(e.time, e.events),
  counters: () => [['attempts', String(S.attempts.length)], ['phase', S.replay ? 'instant replay' : S.phase]],
  save: () => S.stage,
  restore: () => null,
  fileName: () => `stairs-of-doom-${S.stage.character}`,
});

/** Scene additions: the pop-up words (X3D Text on Billboards), a fireball and the one-off sounds. */
function extras() {
  const pops = Array.from({ length: POPS }, (_, k) => `  <Transform DEF="Pop${k}" scale="0 0 0"><Billboard axisOfRotation="0 0 0"><Shape><Appearance><Material DEF="PopMat${k}" diffuseColor="0 0 0" emissiveColor="1 0.8 0.2"/></Appearance><Text DEF="PopText${k}" string='"BONK!"'><FontStyle family='"SANS"' style="BOLD" justify='"MIDDLE" "MIDDLE"' size="0.2"/></Text></Shape></Billboard></Transform>`).join('\n');
  const sfx = ['whistle-down', 'power-down', 'power-up', 'boom'].map((s) => `  <SpatialSound DEF="Sfx_${s.replace(/-/g, '_')}" location="0 2 2" intensity="0.9" referenceDistance="6" rolloffFactor="0.6" distanceModel="INVERSE"><AudioClip DEF="SfxClip_${s.replace(/-/g, '_')}" containerField="children" url='"sounds/${s}.wav"'/></SpatialSound>`).join('\n');
  // the label on all four sides of the crate
  const face = (rot: number, k: number) => `<Transform rotation="0 1 0 ${rot}"><Transform translation="0 0 0.252">${k ? '<Shape USE="TNTWord"/>' : `<Shape DEF="TNTWord"><Appearance><Material diffuseColor="0 0 0" emissiveColor="1 0.95 0.85"/></Appearance><Text string='"TNT"'><FontStyle family='"SANS"' style="BOLD" justify='"MIDDLE" "MIDDLE"' size="0.2"/></Text></Shape>`}</Transform></Transform>`;
  const tnt = `  <Transform DEF="TNTLabel" translation="${tntAt(S.stage).join(' ')}">${[0, 1.5708, 3.1416, 4.7124].map((r, k) => face(r, k)).join('')}</Transform>`;
  const fire = `  <Transform DEF="Fireball" translation="${tntAt(S.stage).join(' ')}" scale="0 0 0"><Shape><Appearance><Material DEF="FireMat" diffuseColor="0 0 0" emissiveColor="1 0.55 0.1" transparency="0.2"/></Appearance><Sphere radius="1"/></Shape></Transform>`;
  const follow = `  <Viewpoint DEF="Follow" description="Following the fall" position="-4 3 1" fieldOfView="0.8"/>`;
  return [pops, sfx, tnt, fire, follow].join('\n');
}

const sfx = (name: string, at?: Vec3) => {
  if (shell.muted) return;
  try {
    const sc = shell.bridge.scene, k = name.replace(/-/g, '_');
    if (at) sc.getNamedNode(`Sfx_${k}`).location = new X3D.SFVec3f(...at);
    sc.getNamedNode(`Sfx_${k}`).intensity = shell.soundVolume;
    sc.getNamedNode(`SfxClip_${k}`).startTime = Date.now() / 1000;
  } catch { /* not loaded */ }
};

// ------------------------------------------------------------------ the push

const LABELS: Record<string, string[]> = { stairs: ['Nudge', 'Shove', 'Launch'], cannon: ['Fire: gentle', 'Fire: strong', 'Fire: max'], wrecking: ['Swing: gentle', 'Swing: hard', 'Swing: huge'] };
async function pick(c: Contraption) {
  S.stage = { ...S.stage, contraption: c };
  for (const k of ['stairs', 'cannon', 'wrecking']) shell.setPressed(`c-${k}`, k === c);
  LABELS[c].forEach((l, i) => shell.labelButton(`go${i + 1}`, l));
  S.best = null;
  await shell.load();
}
async function go(level: 1 | 2 | 3) {
  if (S.stage.contraption === 'cannon') return fireCannon(level);
  if (S.stage.contraption === 'wrecking') return swingBall(level);
  return push((['nudge', 'shove', 'launch'] as const)[level - 1]);
}

/** Load (if needed), record from the authored state, and set off: the common start of every attempt. */
async function begin(context: string) {
  if (S.replay) return false;
  if (S.phase !== 'ready' || S.stage.contraption === 'wrecking') await shell.load();
  await shell.bridge.startRecording({ demo: 'ragdoll', state: S.stage, push: context });
  S.ouch!.reset(); S.crash?.reset(); S.phase = 'falling'; S.quietSince = -1; S.struck = false;
  return true;
}

async function fireCannon(level: number) {
  const v = CANNON.speeds[level - 1];
  if (!(await begin(`cannon ${v} m/s`))) return;
  setStiffness(S.plank ? 0.7 : 0);
  // into the barrel and out: the pelvis at the muzzle, the body along the barrel, the barrel's speed
  const d = cannonDir(), m = muzzle(), wob = (Math.random() - 0.5) * 0.6;
  shell.bridge.teleport(S.root, [m[0], m[1] + d[1] * 0.6, m[2] + d[2] * 0.6], quatFromTo([0, 1, 0], d), [d[0] * v + wob, d[1] * v, d[2] * v], [3 + wob, wob, 0]);
  sfx('boom', m);
  pop({ t: 0, link: -1, segment: '', part: 'torso', dv: 9, points: 0, combo: 0, word: 'BOOM!', at: [m[0], m[1] + 0.8, m[2]] }, true);
  S.flickerNext = 0.3 + Math.random() * 0.6;
  shell.run();
  if (S.auto) setView(3);
  shell.status(`cannon: ${v} m/s at ${Math.round((CANNON.elevation * 180) / Math.PI)}°`);
}

async function swingBall(level: number) {
  S.stage = { ...S.stage, level };
  if (!(await begin(`wrecking ball ${WRECK.pushes[level - 1]} m/s`))) return;
  // release: the Latch joint leaves RigidBodyCollection.joints (standard X3D); he stays stiff with fear until it hits
  const coll = shell.bridge.scene.getNamedNode('Machine'), keep = [];
  for (let i = 0; i < coll.joints.length; i++) if (coll.joints[i].getNodeName() !== 'Latch') keep.push(coll.joints[i]);
  coll.joints = new X3D.MFNode(...keep);
  shell.run();
  if (S.auto) setView(0);
  shell.status(`wrecking ball released with a ${WRECK.pushes[level - 1]} m/s push: the Latch joint was removed from the collection`);
}

async function push(kind: keyof typeof PUSHES) {
  if (S.replay) return;
  if (!(await begin(kind))) return;
  const b = shell.bridge;
  setStiffness(S.plank ? 0.7 : 0);
  // the pelvis keeps its pose; it gets a forward velocity, a little lift and a spin
  const st = b.lastState!, o = S.root * BODY_STRIDE;
  const v = PUSHES[kind], wobble = (Math.random() - 0.5) * 0.6;
  b.teleport(S.root, [st[o], st[o + 1], st[o + 2]], [st[o + 3], st[o + 4], st[o + 5], st[o + 6]], [wobble * 0.4, 0.3 + v * 0.06, v], [v * 0.3, wobble, 0.3 * wobble]);
  S.flickerNext = 0.3 + Math.random() * 0.6;
  sfx('whistle-down', [st[o], st[o + 1], st[o + 2]]);
  shell.run();
  if (S.auto) setView(3);
  shell.status(`${kind}: ${v} m/s, every HAnimJoint.stiffness set to ${S.plank ? '0.7 (plank)' : '0 (limp)'}${S.flicker ? ', power flicker on' : ''}`);
}

function poseOf(i: number): { p: Vec3; q: Quat } {
  const st = shell.bridge.lastState!, o = i * BODY_STRIDE;
  return { p: [st[o], st[o + 1], st[o + 2]], q: [st[o + 3], st[o + 4], st[o + 5], st[o + 6]] };
}

/** Standard X3D: HAnimJoint.stiffness on every joint (the bridge forwards it to the articulation's drives). */
function setStiffness(s: number) {
  for (let k = 1; k < S.joints.length; k++) S.joints[k].stiffness = new X3D.MFFloat(s, s, s);
  S.rigid = s > 0.5;
}

function toggleFlicker() { S.flicker = !S.flicker; shell.setPressed('flicker', S.flicker); shell.status(S.flicker ? 'power flicker: the figure will snap rigid and flop at random during the fall' : 'power flicker off'); }
function togglePlank() { S.plank = !S.plank; shell.setPressed('plank', S.plank); }

// ------------------------------------------------------------------ every physics batch

function onState(t: number, events: Float32Array) {
  if (!S.ouch || S.root < 0) return;
  const replaying = shell.bridge.replaying;
  if (S.phase === 'falling' || replaying) {
    const hits = S.ouch.feed(events, t);
    // words only for real hits, at most one every 0.12 s (taps still score; the screen stays readable)
    const now = performance.now();
    for (const h of hits) { S.crash?.hit(h.link, h.dv); if (h.dv >= 1.5 && now - S.popAt > 120) { S.popAt = now; pop(h); } }
    if (shell.bridge.lastState) S.crash?.sample(shell.bridge.lastState, t);
    // the wrecking ball's first hit: he goes limp
    if (!S.struck && S.wrecker >= 0 && !replaying) for (let o = 0; o < events.length; o += CONTACT_STRIDE) {
      if ((events[o] === S.wrecker && S.linkSet.has(events[o + 1])) || (events[o + 1] === S.wrecker && S.linkSet.has(events[o]))) { S.struck = true; setStiffness(S.plank ? 0.7 : 0); break; }
    }
    // power flicker (not during a replay: the recorded stiffness changes come back by themselves)
    if (S.flicker && !replaying && S.phase === 'falling' && t > S.flickerNext) {
      const rigid = !S.rigid;
      setStiffness(rigid ? 1 : 0);
      sfx(rigid ? 'power-up' : 'power-down', poseOf(S.root).p);
      S.flickerNext = t + (rigid ? 0.25 + Math.random() * 0.5 : 0.4 + Math.random() * 1.0);
    }
    // the TNT goes off when the figure touches it
    if (!S.boom.done && S.tntBody >= 0) for (let o = 0; o < events.length; o += CONTACT_STRIDE) {
      const a = events[o], b = events[o + 1];
      if ((a === S.tntBody && S.linkSet.has(b)) || (b === S.tntBody && S.linkSet.has(a))) { explode('touch'); break; }
    }
    if (!replaying) settle(t);
    readout();
  }
  if (S.view === 3) follow();
  animatePops();
  const now = performance.now(); S.crash?.tick(S.frameAt ? Math.min(0.1, (now - S.frameAt) / 1000) : 0); S.frameAt = now;
}

/** The fall is over when every link has been slow for a second (or after 14 s). */
function settle(t: number) {
  const st = shell.bridge.lastState!;
  const v = Math.max(...S.links.map((l) => Math.hypot(st[l.index * BODY_STRIDE + 7], st[l.index * BODY_STRIDE + 8], st[l.index * BODY_STRIDE + 9])));
  if (v < 0.08) { if (S.quietSince < 0) S.quietSince = t; } else S.quietSince = -1;
  if ((S.quietSince >= 0 && t - S.quietSince > 1 && t > 1.2) || t > 14) finish();
}

function finish() {
  if (S.phase !== 'falling') return;
  S.phase = 'done';
  const log = shell.bridge.stopRecording();
  shell.pause();
  const o = S.ouch!;
  const a: Attempt = { n: S.attempts.length + 1, character: S.stage.character, push: (log?.context as { push?: string })?.push ?? '?', score: o.total, hits: o.hits, combo: o.maxCombo, byPart: { ...o.byPart }, log };
  S.attempts.push(a);
  const isBest = !S.best || a.score > S.best.score;
  if (isBest) S.best = a;
  shell.lastRun = log; shell.setDisabled('replay', !log); shell.setDisabled('save-run', !log);
  readout();
  shell.status(`${a.score} points in ${a.hits} hits${isBest ? ': a new best! Q for the instant replay' : ` (best ${S.best!.score})`}`);
  if (S.auto) setTimeout(() => setView(2), 300);
}

// ------------------------------------------------------------------ the TNT crate

function explode(why: 'touch' | 'button') {
  if (S.boom.done || S.tntBody < 0 || !shell.bridge.lastState) return;
  if (why === 'button' && S.phase === 'ready' && !shell.bridge.running) shell.run();
  S.boom.done = true;
  const sc = shell.bridge.scene, st = shell.bridge.lastState;
  // the crate leaves the simulation (CollidableShape.enabled, live) and the scene; in a replay the recorded changes do it
  const replaying = shell.bridge.replaying;
  try { if (!replaying) sc.getNamedNode('TNTS').enabled = false; sc.getNamedNode('TNTT').scale = new X3D.SFVec3f(0, 0, 0); sc.getNamedNode('TNTLabel').scale = new X3D.SFVec3f(0, 0, 0); } catch { /* */ }
  const T = tntAt(S.stage);
  if (!replaying) for (const [i, J] of blast(st, S.links, S.loose, T)) shell.bridge.impulse(i, J);
  S.boom.at = performance.now();
  sfx('boom', T);
  pop({ t: 0, link: -1, segment: '', part: 'torso', dv: 99, points: 0, combo: 0, word: 'KA-BOOM!', at: [T[0], T[1] + 1, T[2]] }, true);
  shell.status(why === 'touch' ? 'KA-BOOM! The figure found the TNT.' : 'KA-BOOM!');
}

// ------------------------------------------------------------------ pop-up words and the fireball

function pop(h: Hit, big = false) {
  const p = S.pops[S.popNext++ % POPS]; if (!p.t) return;
  p.text.string = new X3D.MFString(h.word);
  const hot = Math.min(1, h.dv / 8);
  p.mat.emissiveColor = new X3D.SFColor(1, 0.85 - 0.55 * hot, 0.25 - 0.2 * hot);
  p.mat.transparency = 0;
  p.born = performance.now() * (big ? 1 : 1); p.at = [h.at[0], h.at[1] + 0.25, h.at[2]];
  (p as unknown as { big: boolean }).big = big;
}

function animatePops() {
  const now = performance.now();
  for (const p of S.pops) {
    if (p.born < 0 || !p.t) continue;
    const age = (now - p.born) / 1000, big = (p as unknown as { big?: boolean }).big ? 2.2 : 1;
    if (age > 1.1) { p.t.scale = new X3D.SFVec3f(0, 0, 0); p.born = -1; continue; }
    const s = big * (age < 0.12 ? (age / 0.12) * 1.3 : 1.3 - 0.3 * Math.min(1, (age - 0.12) / 0.12));
    p.t.scale = new X3D.SFVec3f(s, s, s);
    p.t.translation = new X3D.SFVec3f(p.at[0], p.at[1] + 0.5 * age, p.at[2]);
    p.mat.transparency = Math.max(0, (age - 0.7) / 0.4);
  }
  if (S.boom.at) {
    const age = (now - S.boom.at) / 1000;
    try {
      const f = shell.bridge.scene.getNamedNode('Fireball'), m = shell.bridge.scene.getNamedNode('FireMat');
      if (age > 0.9) { f.scale = new X3D.SFVec3f(0, 0, 0); S.boom.at = 0; }
      else { const r = 0.3 + 2.2 * Math.sqrt(age / 0.9); f.scale = new X3D.SFVec3f(r, r, r); m.transparency = Math.min(1, 0.2 + age); m.emissiveColor = new X3D.SFColor(1, 0.55 - 0.4 * age, 0.1); }
    } catch { /* */ }
  }
}

// ------------------------------------------------------------------ replay, camera, panel

async function instantReplay() {
  const a = S.best ?? S.attempts[S.attempts.length - 1];
  if (!a?.log || S.replay) { shell.status('no crash to replay yet: push first'); return; }
  S.replay = true;
  await shell.load(); // the scene as it was before the push (the TNT back in place)
  S.ouch!.reset(); S.crash?.reset(); S.boom = { node: null, done: false, at: 0 };
  shell.hud(`INSTANT REPLAY · attempt ${a.n} · ${a.score} points · slow motion ×0.35`);
  if (S.auto) setView(3);
  S.phase = 'falling';
  const r = await shell.bridge.replay(a.log, { realtime: true, speed: 0.35, events: true });
  S.phase = 'done'; S.replay = false;
  shell.hud(`Replayed attempt ${a.n}: ${r.steps} steps${r.mismatches ? ` (${r.mismatches} step hashes differ: logged, within tolerance if the fall looks the same)` : ''}. 1/2/3 push again.`);
  (S as unknown as { lastReplay: unknown }).lastReplay = { attempt: a.n, ...r };
}

function follow() {
  try {
    const { p } = poseOf(S.root), vp = shell.bridge.scene.getNamedNode('Follow');
    const from: Vec3 = [p[0] - 5.4, Math.max(1.4, p[1] + 1.8), p[2] - 0.8];
    vp.position = new X3D.SFVec3f(...from);
    const [x, y, z, a] = lookAt(from, [p[0], p[1] - 0.2, p[2] + 0.4]).split(' ').map(Number);
    vp.orientation = new X3D.SFRotation(x, y, z, a);
  } catch { /* */ }
}
function setView(k: number) { S.view = k; if (k === 3) follow(); shell.view(VIEWS[k]); shell.labelButton('view', `View: ${VIEWS[k]}`); }
function cycleView() { setView((S.view + 1) % VIEWS.length); }

async function swap() {
  S.stage = { ...S.stage, character: S.stage.character === 'dummy' ? 'cartoon' : 'dummy' };
  shell.labelButton('swap', `Character: ${S.stage.character}`);
  await shell.load();
}

function readout() {
  const o = S.ouch; if (!o) return;
  $('ouch-big').textContent = `${o.total.toLocaleString('en-US')}`;
  $('ouch-combo').textContent = o.combo > 1 && S.phase === 'falling' ? `${o.combo}-hit combo` : o.maxCombo > 1 ? `best combo ${o.maxCombo} hits` : '';
  // body-part bars (one series: points per part; values written beside the bars)
  const max = Math.max(1, ...PARTS.map((p) => o.byPart[p]));
  const bars = $('ouch-bars');
  if (!bars.childElementCount) for (const p of PARTS) { const row = el('div', '', { class: 'bar-row' }); row.append(el('span', p, { class: 'bar-label' }), el('span', '', { class: 'bar', 'data-part': p }), el('span', '0', { class: 'bar-value', 'data-part': p })); bars.append(row); }
  for (const p of PARTS) {
    (bars.querySelector(`.bar[data-part="${p}"]`) as HTMLElement).style.width = `${(100 * o.byPart[p]) / max}%`;
    bars.querySelector(`.bar-value[data-part="${p}"]`)!.textContent = o.byPart[p].toLocaleString('en-US');
  }
  rows($('ouch-readout'), [
    ['hits', String(o.hits)],
    ['head score', S.crash && S.crash.hic > 0 ? `${Math.round(S.crash.hic)} HIC-style · ${headWord(S.crash.hic)}` : '–'],
    ['worst hit', S.crash?.worst(1).map((w) => `${w.segment} · ${Math.round(w.g)} g`)[0] ?? '–'],
    ['best', S.best ? `${S.best.score.toLocaleString('en-US')} (attempt ${S.best.n}, ${S.best.character}, ${S.best.push})` : '–'],
    ['attempts', S.attempts.slice(-5).map((a) => `#${a.n} ${a.score}`).join(' · ') || '–'],
  ]);
}

void shell.start();
Object.assign(window as unknown as Record<string, unknown>, { __rag: S });
