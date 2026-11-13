// The trebuchet page. Fire removes the Latch joint from RigidBodyCollection.joints (standard X3D, through SAI); the sling's joint is
// removed when the stone's flight angle comes down through the release angle. Near release the page steps PhysX one 1/240 s step at a
// time, so the release is exact to a step. The camera follows the stone and cuts to the castle; every shot is drawn and tabulated.
import { DemoShell, X3D, $, rows } from './shell.ts';
import { BODY_STRIDE } from '../bridge/model.ts';
import { quatRotate } from '../bridge/math.ts';
import type { Vec3 } from '../bridge/model.ts';
import { LIMITS, LONG, SHORT, buildTrebuchet, defaultTrebuchet, flightAngle, sanitizeTrebuchet, shouldRelease, stoneRadius } from './trebuchet-scene.ts';
import type { Trebuchet } from './trebuchet-scene.ts';
import { renderChart } from './scatter-chart.ts';
import { lookAt } from './view.ts';

const VIEWS = ['Trebuchet', 'Field', 'Castle', 'Follow'];
interface Shot { counterweight: number; stone: number; sling: number; release: number; speed: number; angle: number; efficiency: number; range: number | null; apex: number; flight: number | null; moved: number; path: [number, number][] }

const S = {
  t: defaultTrebuchet() as Trebuchet,
  idx: { arm: -1, cw: -1, stone: -1, blocks: [] as number[] },
  phase: 'cocked' as 'cocked' | 'swinging' | 'flying' | 'landed',
  fine: false,
  lastAngle: 0,
  lastTime: 0,
  shot: null as null | (Shot & { t0: number; releasedAt: number; cwY0: number; blocks0: number[][] }),
  shots: JSON.parse(localStorage.getItem('x3d-physx-trebuchet-shots') ?? '[]') as Shot[],
  view: 0,
  auto: true,
  trail: [] as Vec3[],
};

const shell: DemoShell = new DemoShell({
  id: 'trebuchet',
  title: 'Trebuchet vs castle',
  tagline: 'A hinged counterweight, a sling, a prong angle: tune it and knock the castle down',
  controls: [
    { id: 'fire', group: 'Trebuchet', label: 'Fire', key: 'f', run: () => fire(), title: 'remove the latch joint' },
    { id: 'auto', group: 'Trebuchet', label: 'Auto camera', key: 'a', run: () => toggleAuto(), pressed: true },
    { id: 'view', group: 'Trebuchet', label: 'View: Trebuchet', key: 'v', run: () => cycleView() },
    { id: 'c-keep', group: 'Castle', label: 'Keep', key: '1', run: () => castle('keep') },
    { id: 'c-wall', group: 'Castle', label: 'Wall', key: '2', run: () => castle('wall') },
    { id: 'c-pyramid', group: 'Castle', label: 'Pyramid', key: '3', run: () => castle('pyramid') },
  ],
  scene: () => {
    const b = buildTrebuchet(S.t);
    const extra = `  <Shape><Appearance><Material emissiveColor="0.72 0.6 0.4" diffuseColor="0 0 0"/></Appearance><LineSet DEF="SlingSet" vertexCount="2"><Coordinate DEF="SlingLine" point="0 -5 0 0 -5 0"/></LineSet></Shape>
  <Shape><Appearance><Material emissiveColor="1 0.78 0.3" diffuseColor="0 0 0"/></Appearance><LineSet DEF="TrailSet" vertexCount="2"><Coordinate DEF="Trail" point="0 -5 0 0 -5 0"/></LineSet></Shape>
  <Viewpoint DEF="Follow" description="Following the stone" position="0 6 20" fieldOfView="0.8"/>`;
    return { ir: b.ir, meta: { ...b.meta, extra } };
  },
  sound: {
    samples: ['thud-stone', 'knock-wood'], voices: 8, impulseRange: [4, 3000], settle: 0.3,
    pick: (e) => (e.b1 === S.idx.arm || e.b2 === S.idx.arm ? { sample: 'knock-wood' } : { sample: 'thud-stone' }),
  },
  loaded: () => {
    S.idx = buildTrebuchet(S.t).idx;
    S.phase = 'cocked'; S.shot = null; S.fine = false; S.trail = [];
    shell.labelButton('fire', 'Fire');
    drawSling(); drawTrail();
    if (S.view === 3) S.view = 0;
    shell.view(VIEWS[S.view]); shell.labelButton('view', `View: ${VIEWS[S.view]}`);
    readout();
    shell.hud('F fires · sliders tune · A auto camera · V view · R re-cocks and rebuilds the castle');
    if (!shell.bridge.running) shell.run(); // let the castle settle; the latch holds the arm
  },
  state: (e) => onState(e.time),
  counters: () => [['phase', S.phase], ['shots', String(S.shots.length)]],
  save: () => S.t,
  restore: (v) => { const t = sanitizeTrebuchet(v); if (typeof t === 'string') return t; S.t = t; syncSliders(); return null; },
  fileName: () => `trebuchet-${S.t.counterweight}kg-${S.t.castle}`,
});

const at = (i: number) => { const st = shell.bridge.lastState!, o = i * BODY_STRIDE; return { p: [st[o], st[o + 1], st[o + 2]] as Vec3, q: [st[o + 3], st[o + 4], st[o + 5], st[o + 6]] as [number, number, number, number], v: [st[o + 7], st[o + 8], st[o + 9]] as Vec3 }; };
const tipOf = () => { const a = at(S.idx.arm), d = quatRotate(a.q, [(LONG + SHORT) / 2, 0, 0]); return [a.p[0] + d[0], a.p[1] + d[1], a.p[2] + d[2]] as Vec3; };

/** Remove a joint from the collection's joints field (standard X3D); the bridge releases it in PhysX before the next step. */
function removeJoint(def: string) {
  const coll = shell.bridge.scene.getNamedNode('Machine'), keep = [];
  for (let i = 0; i < coll.joints.length; i++) if (coll.joints[i].getNodeName() !== def) keep.push(coll.joints[i]);
  coll.joints = new X3D.MFNode(...keep);
}

function fire() {
  if (S.phase !== 'cocked' || !shell.bridge.lastState) { if (S.phase !== 'cocked') shell.status('already fired: R re-cocks'); return; }
  const blocks0 = S.idx.blocks.map((i) => at(i).p);
  S.shot = { counterweight: S.t.counterweight, stone: S.t.stone, sling: S.t.sling, release: S.t.release, speed: 0, angle: 0, efficiency: 0, range: null, apex: 0, flight: null, moved: 0, path: [], t0: shell.bridge.stats.simTime, releasedAt: -1, cwY0: at(S.idx.cw).p[1], blocks0 };
  removeJoint('Latch');
  S.phase = 'swinging'; S.trail = [];
  shell.labelButton('fire', 'Fired');
  if (!shell.bridge.running) shell.run();
  if (S.auto) setView(0);
  shell.status('fire: the Latch joint was removed from RigidBodyCollection.joints');
}

function onState(time: number) {
  if (!shell.bridge.lastState || S.idx.stone < 0) return;
  drawSling();
  const s = at(S.idx.stone), [vx, vy] = s.v;
  if (S.phase === 'swinging' && !S.fine) {
    // close to the release angle: step one physics step at a time, so the sling lets go within a step of it
    const ang = flightAngle(vx, vy), rate = time > S.lastTime ? (S.lastAngle - ang) / (time - S.lastTime) : 0;
    if (vx > 2 && Math.hypot(vx, vy) > 5 && ang - S.t.release < Math.max(2, rate * 0.06)) void fineRelease();
    S.lastAngle = ang; S.lastTime = time;
  }
  if (S.phase === 'flying' && S.shot) {
    const last = S.trail[S.trail.length - 1];
    if (!last || Math.hypot(s.p[0] - last[0], s.p[1] - last[1]) > 0.8) { S.trail.push(s.p); S.shot.path.push([+s.p[0].toFixed(2), +s.p[1].toFixed(2)]); drawTrail(); }
    S.shot.apex = Math.max(S.shot.apex, s.p[1]);
    if (S.auto && S.view !== 3) setView(3);
    if (S.view === 3) follow(s.p);
    // landed: on the ground, or stopped by the castle
    const r = stoneRadius(S.t.stone);
    if (vy < 0 && (s.p[1] < r + 0.08 || (s.p[0] > S.t.distance - 1.5 && Math.hypot(vx, vy) < 0.5 * S.shot.speed))) {
      S.phase = 'landed'; S.shot.range = +s.p[0].toFixed(1); S.shot.flight = +(time - S.shot.releasedAt).toFixed(2);
      S.trail.push(s.p); drawTrail();
      if (S.auto) setTimeout(() => setView(2), 350);
      setTimeout(() => finishShot(), 3000);
    }
  }
  if (S.phase !== 'cocked') readout();
}

async function fineRelease() {
  S.fine = true;
  const b = shell.bridge, running = b.running;
  b.pause();
  for (let k = 0; k < 240 && S.phase === 'swinging'; k++) {
    const s = at(S.idx.stone), [vx, vy] = s.v;
    if (shouldRelease(vx, vy, S.t.release)) { release(s.p, vx, vy); break; }
    await b.step(1);
  }
  if (running) shell.run();
  S.fine = false;
}

function release(p: Vec3, vx: number, vy: number) {
  removeJoint('Sling');
  const sh = S.shot!, v = Math.hypot(vx, vy), drop = sh.cwY0 - at(S.idx.cw).p[1];
  Object.assign(sh, { speed: +v.toFixed(2), angle: +flightAngle(vx, vy).toFixed(1), efficiency: +((0.5 * S.t.stone * v * v) / (S.t.counterweight * 9.81 * Math.max(drop, 1e-6))).toFixed(3), releasedAt: shell.bridge.stats.simTime, apex: p[1] });
  sh.path.push([+p[0].toFixed(2), +p[1].toFixed(2)]);
  S.trail = [p];
  S.phase = 'flying';
  shell.status(`released at ${sh.angle}° and ${sh.speed} m/s: the Sling joint was removed from the collection`);
}

function finishShot() {
  const sh = S.shot; if (!sh || shell.bridge.lastState === null) return;
  sh.moved = S.idx.blocks.filter((i, k) => Math.hypot(...at(i).p.map((v, c) => v - sh.blocks0[k][c])) > 0.3).length;
  const { t0: _t0, releasedAt: _r, cwY0: _c, blocks0: _b, ...keep } = sh;
  void _t0; void _r; void _c; void _b;
  S.shots.push(keep); S.shots = S.shots.slice(-30);
  localStorage.setItem('x3d-physx-trebuchet-shots', JSON.stringify(S.shots));
  readout(); chart();
  shell.status(`range ${sh.range ?? '?'} m · ${sh.moved} castle blocks moved · R re-cocks`);
}

function readout() {
  const sh = S.shot;
  $('shot-big').textContent = sh?.range != null ? `${sh.range} m · ${sh.moved || '…'} blocks` : sh && S.phase === 'flying' ? `${sh.speed} m/s at ${sh.angle}°` : S.phase === 'cocked' ? 'ready: F fires' : 'swinging…';
  rows($('shot-readout'), [
    ['release', sh && sh.speed ? `${sh.angle}° (asked ${S.t.release}°) · ${sh.speed} m/s` : '–'],
    ['efficiency', sh && sh.speed ? `${(sh.efficiency * 100).toFixed(0)} % of the counterweight's drop became the stone's speed` : '–'],
    ['apex', sh && sh.apex ? `${sh.apex.toFixed(1)} m` : '–'],
    ['flight', sh?.flight != null ? `${sh.flight} s to ${sh.range} m` : '–'],
    ['castle', `${S.t.castle}, ${S.idx.blocks.length} blocks, front at ${S.t.distance} m`],
  ]);
}

function chart() {
  const xs = [0, 60, 120, 180, 240], maxY = Math.max(20, ...S.shots.flatMap((s) => s.path.map((p) => p[1]))) * 1.1;
  const cur = S.shots[S.shots.length - 1];
  renderChart($('traj'), $('traj-legend'), $('traj-table'), {
    aria: 'Flight paths of the shots: height against distance',
    x: { label: 'distance from the axle (m)', min: -10, max: 260, ticks: xs },
    y: { label: 'height (m)', min: 0, max: maxY, ticks: [0, Math.round(maxY / 2), Math.round(maxY * 0.9)] },
    lines: [
      ...S.shots.slice(0, -1).map((s) => ({ label: '', pts: s.path })),
      ...(cur ? [{ label: `${cur.range ?? '?'} m`, pts: cur.path, gold: true, labelAt: 'end' as const }] : []),
      { label: 'castle', pts: [[S.t.distance, 0], [S.t.distance, 5]], strong: true, labelAt: 'end' as const },
    ],
    lineLegend: [{ label: 'last shot', gold: true }, { label: 'earlier shots, castle', gold: false }],
    measured: { label: 'landing', pts: S.shots.filter((s) => s.range != null).map((s) => ({ x: s.range!, y: 0, tip: `${s.range} m · ${s.counterweight} kg, ${s.stone} kg stone, ${s.sling} m sling, released at ${s.angle}° and ${s.speed} m/s · ${s.moved} blocks` })), hideLegend: false },
    table: { head: ['cw kg', 'stone', 'sling', 'release', 'm/s', 'range', 'blocks'], rows: S.shots.map((s) => [String(s.counterweight), String(s.stone), String(s.sling), `${s.angle}°`, String(s.speed), s.range != null ? String(s.range) : '–', String(s.moved)]) },
  });
}

function drawSling() {
  try {
    const sc = shell.bridge.scene, line = sc.getNamedNode('SlingLine');
    if (S.phase === 'flying' || S.phase === 'landed' || !shell.bridge.lastState) { line.point = new X3D.MFVec3f(new X3D.SFVec3f(0, -5, 0), new X3D.SFVec3f(0, -5, 0)); return; }
    const a = tipOf(), b = at(S.idx.stone).p;
    line.point = new X3D.MFVec3f(new X3D.SFVec3f(...a), new X3D.SFVec3f(...b));
  } catch { /* not loaded */ }
}
function drawTrail() {
  try {
    const sc = shell.bridge.scene, pts = S.trail.length >= 2 ? S.trail : [[0, -5, 0], [0, -5, 0]] as Vec3[];
    sc.getNamedNode('Trail').point = new X3D.MFVec3f(...pts.map((p) => new X3D.SFVec3f(...p)));
    sc.getNamedNode('TrailSet').vertexCount = new X3D.MFInt32(pts.length);
  } catch { /* not loaded */ }
}
function follow(p: Vec3) {
  try {
    const vp = shell.bridge.scene.getNamedNode('Follow'), from: Vec3 = [p[0] - 14, Math.max(3, p[1] + 3), 26];
    vp.position = new X3D.SFVec3f(...from);
    const [x, y, z, a] = lookAt(from, [p[0] + 6, p[1], 0]).split(' ').map(Number);
    vp.orientation = new X3D.SFRotation(x, y, z, a);
  } catch { /* not loaded */ }
}
function setView(k: number) { S.view = k; shell.view(VIEWS[k]); shell.labelButton('view', `View: ${VIEWS[k]}`); }
function cycleView() { setView((S.view + 1) % VIEWS.length); if (S.view === 3 && shell.bridge.lastState) follow(at(S.idx.stone).p); }
function toggleAuto() { S.auto = !S.auto; shell.setPressed('auto', S.auto); }
async function castle(c: Trebuchet['castle']) { S.t = { ...S.t, castle: c }; await shell.load(); shell.status(`castle: ${c}`); }

// sliders
const KEYS = ['counterweight', 'stone', 'sling', 'release', 'distance'] as const;
const UNITS: Record<string, string> = { counterweight: ' kg', stone: ' kg', sling: ' m', release: '°', distance: ' m' };
function syncSliders() {
  for (const k of KEYS) {
    const [lo, hi, st] = LIMITS[k], el = $(k) as HTMLInputElement;
    Object.assign(el, { min: String(lo), max: String(hi), step: String(st), value: String(S.t[k]) });
    $(`${k}-out`).textContent = `${S.t[k]}${UNITS[k]}`;
  }
}
let timer = 0;
for (const k of KEYS) ($(k) as HTMLInputElement).oninput = () => {
  S.t = { ...S.t, [k]: +($(k) as HTMLInputElement).value }; syncSliders();
  clearTimeout(timer); timer = window.setTimeout(() => void shell.load(), 300);
};
$('traj-table-toggle').onclick = () => { $('traj-table').hidden = !$('traj-table').hidden; };
$('traj-clear').onclick = () => { S.shots = []; localStorage.removeItem('x3d-physx-trebuchet-shots'); chart(); };
window.addEventListener('keydown', (e) => { if ((e.key === 'y' || e.key === 'Y') && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) $('traj-table-toggle').click(); });

syncSliders();
chart();
void shell.start();
Object.assign(window as unknown as Record<string, unknown>, { __treb: S });
