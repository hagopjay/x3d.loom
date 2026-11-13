// The draw-a-domino page. Draw mode: a physics-free X3D scene; a PlaneSensor on the table turns pointer drags into strokes, and a pool
// of domino Transforms shows the laid-out row as you draw (no reload). Run mode: the generated RigidBody scene on PhysX; Push tips the
// first domino of every row; the page times each domino's fall and fits the toppling wave's speed.
import { DemoShell, X3D, $, rows } from './shell.ts';
import { BODY_STRIDE, CONTACT_STRIDE } from '../bridge/model.ts';
import { MATERIALS, toX3D } from '../machine/index.ts';
import type { MachineIR } from '../machine/index.ts';
import { FALLEN, FRICTION, GAP, H, LARHAM, MAX_DOMINOES, PRESETS, T, TABLE, W, buildDominoes, colorOf, dominoes, sanitizeRun, starts, tiltOf, tip, waveSpeed } from './dominoes-scene.ts';
import type { Domino, DominoRun } from './dominoes-scene.ts';
import { PHYSX_SWEEP } from './dominoes-sweep.ts';
import { renderChart } from './scatter-chart.ts';
import { lookAt, viewpoint } from './view.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;
const VIEWS = ['Overview', 'Low', 'Above'];
const SQRT_GH = Math.sqrt(9.81 * H);

interface Experiment { gap: number; friction: number; v: number; n: number; name: string }
const S = {
  run: PRESETS.spiral(GAP.initial) as DominoRun,
  undo: [] as string[],
  drawing: null as null | { path: [number, number][] },
  draw: null as null | { scene: SAI; pool: SAI[]; shapes: SAI[]; cache: string[]; ink: SAI; inkSet: SAI },
  ds: [] as Domino[],
  fall: [] as (number | undefined)[],
  pushedAt: -1,
  lastFall: 0,
  recorded: false,
  view: 0,
  follow: false,
  experiments: JSON.parse(localStorage.getItem('x3d-physx-domino-runs') ?? '[]') as Experiment[],
  gap: GAP.initial,
  friction: FRICTION.initial,
  clacks: 0,
};
S.run.friction = S.friction;

const shell = new DemoShell({
  id: 'dominoes',
  title: 'Draw-a-domino run',
  tagline: 'Draw rows on the table, push, and time the toppling wave against real dominoes',
  controls: [
    { id: 'push', group: 'Dominoes', label: 'Push', key: 't', run: () => push(), mode: 'run', title: 'tip the first domino of every row' },
    { id: 'follow', group: 'Dominoes', label: 'Follow the wave', key: 'f', run: () => toggleFollow(), mode: 'run', pressed: false },
    { id: 'undo-stroke', group: 'Dominoes', label: 'Undo row', key: 'mod+z', keyLabel: '⌘Z', run: () => undo(), mode: 'draw' },
    { id: 'clear', group: 'Dominoes', label: 'Clear table', key: 'x', run: () => setRun({ ...S.run, name: 'My dominoes', strokes: [] }, 'table cleared'), mode: 'draw' },
    { id: 'view', group: 'Dominoes', label: 'View: Overview', key: 'v', run: () => cycleView() },
    { id: 's-line', group: 'Shapes', label: 'Line', key: '1', run: () => preset('line') },
    { id: 's-spiral', group: 'Shapes', label: 'Spiral', key: '2', run: () => preset('spiral') },
    { id: 's-fork', group: 'Shapes', label: 'Fork', key: '3', run: () => preset('fork') },
    { id: 's-heart', group: 'Shapes', label: 'Heart', key: '4', run: () => preset('heart') },
    { id: 's-wave', group: 'Shapes', label: 'Sine', key: '5', run: () => preset('wave') },
  ],
  modes: { initial: 'draw', enter: (m) => (m === 'draw' ? enterDraw() : Promise.resolve()) },
  scene: () => { const b = buildDominoes(S.run); return { ir: b.ir, meta: b.meta }; },
  sound: {
    samples: ['clack-domino', 'knock-wood'], voices: 8, impulseRange: [1e-4, 1.2e-2],
    pick: (e) => {
      const d1 = e.b1 > 0, d2 = e.b2 > 0; // body 0 is the table
      return d1 && d2 ? { sample: 'clack-domino' } : { sample: 'knock-wood' };
    },
  },
  loaded: (_read, ir: MachineIR) => {
    S.ds = buildDominoes(S.run).ds;
    S.fall = S.ds.map(() => undefined); S.pushedAt = -1; S.recorded = false; S.clacks = 0;
    void ir;
    shell.view(VIEWS[S.view]);
    readout();
    shell.hud('Space runs · T pushes the first domino of each row · F follows the wave · Tab back to drawing');
  },
  state: (e) => { timeFalls(e.time); for (let o = 0; o < e.events.length; o += CONTACT_STRIDE) if (e.events[o] > 0 && e.events[o + 1] > 0) S.clacks++; if (S.follow) chase(); },
  counters: () => [['dominoes', `${S.ds.length} in ${S.run.strokes.length} rows`], ['fallen', `${S.fall.filter((x) => x !== undefined).length}`], ['clacks', String(S.clacks)]],
  save: () => S.run,
  restore: (v) => { const r = sanitizeRun(v); if (typeof r === 'string') return r; S.run = r; syncSliders(); return null; },
  fileName: () => S.run.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'dominoes',
});

// ------------------------------------------------------------------ draw mode

const COLORS = 5;
function drawXML(): string {
  const q0: [number, number, number, number] = [0, 0, 0, 1];
  const ir: MachineIR = { bodies: [], joints: [], clocks: [], chimes: [], surface: { bounce: 0, minBounceSpeed: 0.1, friction: 0.2 } };
  void q0;
  const mats = Array.from({ length: COLORS }, (_, k) => `<Appearance DEF="DomMat${k}">${MATERIALS[`domino${k}`]}</Appearance>`);
  const pool = Array.from({ length: MAX_DOMINOES }, (_, k) => `<Transform DEF="P${k}" scale="0 0 0"/>`).join('');
  const extra = `
  <Switch whichChoice="-1">${mats.map((m, k) => `<Shape DEF="DomShape${k}">${m}<Box size="${W} ${H} ${T}"/></Shape>`).join('')}</Switch>
  <Transform rotation="1 0 0 -1.5708">
   <PlaneSensor DEF="Pen" description="draw a row of dominoes" autoOffset="false"/>
   <Transform translation="0 0 -0.02"><Shape><Appearance>${MATERIALS.felt}</Appearance><Box size="${TABLE} ${TABLE} 0.04"/></Shape></Transform>
  </Transform>
  <Transform translation="0 ${H / 2} 0">${pool}</Transform>
  <Shape><Appearance><Material emissiveColor="1 0.78 0.3" diffuseColor="0 0 0"/></Appearance><LineSet DEF="InkSet" vertexCount="2"><Coordinate DEF="Ink" point="0 0.002 0 0 0.002 0"/></LineSet></Shape>`;
  const meta = buildDominoes(S.run).meta;
  return toX3D(ir, { mode: 'run', meta: { ...meta, title: `${S.run.name} (drawing)`, extra, navigation: '"NONE"', components: '  <component name="PointingDeviceSensor" level="1"/>\n' } });
}

async function enterDraw() {
  const scene = await shell.browser.createX3DFromString(drawXML());
  await shell.browser.replaceWorld(scene);
  const pool = Array.from({ length: MAX_DOMINOES }, (_, k) => scene.getNamedNode(`P${k}`));
  const shapes = Array.from({ length: COLORS }, (_, k) => scene.getNamedNode(`DomShape${k}`));
  S.draw = { scene, pool, shapes, cache: [], ink: scene.getNamedNode('Ink'), inkSet: scene.getNamedNode('InkSet') };
  const pen = scene.getNamedNode('Pen');
  pen.addFieldCallback('dom', 'isActive', (on: boolean) => { if (on) S.drawing = { path: [] }; else finishStroke(); });
  pen.addFieldCallback('dom', 'trackPoint_changed', (v: SAI) => {
    if (!S.drawing) return;
    const p: [number, number] = [+v.x.toFixed(4), +(-v.y).toFixed(4)]; // sensor plane (x, y) is the table's (x, −z)
    const last = S.drawing.path[S.drawing.path.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004) return;
    S.drawing.path.push(p);
    paint();
  });
  try { scene.getNamedNode(VIEWS[S.view]).set_bind = true; } catch { /* default view */ }
  paint();
  shell.status(`drawing · ${S.ds.length} dominoes · drag on the table to add a row`);
  shell.hud('Drag on the table to draw a row · 1–5 shapes · ⌘Z undo · Tab to run');
}

/** Lay out every row (and the one being drawn) and move the pooled Transforms; only changed ones are touched. */
function paint() {
  const d = S.draw; if (!d) return;
  const run: DominoRun = S.drawing ? { ...S.run, strokes: [...S.run.strokes, { path: S.drawing.path, gap: S.gap }] } : S.run;
  S.ds = dominoes(run);
  for (let k = 0; k < MAX_DOMINOES; k++) {
    const x = S.ds[k], key = x ? `${x.x.toFixed(4)},${x.z.toFixed(4)},${x.yaw.toFixed(3)},${colorOf(x)}` : '';
    if (d.cache[k] === key) continue;
    d.cache[k] = key;
    const t = d.pool[k];
    if (!x) { t.scale = new X3D.SFVec3f(0, 0, 0); continue; }
    t.translation = new X3D.SFVec3f(x.x, 0, x.z);
    t.rotation = new X3D.SFRotation(0, 1, 0, x.yaw);
    t.scale = new X3D.SFVec3f(1, 1, 1);
    t.children = new X3D.MFNode(d.shapes[colorOf(x)]);
  }
  const ink = S.drawing?.path ?? [];
  const pts = ink.length >= 2 ? ink : [[0, 0], [0, 0]];
  d.ink.point = new X3D.MFVec3f(...pts.map(([x, z]) => new X3D.SFVec3f(x, 0.002, z)));
  d.inkSet.vertexCount = new X3D.MFInt32(pts.length);
  shell.status(`drawing · ${S.ds.length} dominoes in ${run.strokes.length} rows${S.ds.length >= MAX_DOMINOES ? ` (the limit is ${MAX_DOMINOES})` : ''}`);
}

function finishStroke() {
  const st = S.drawing; S.drawing = null;
  if (!st || st.path.length < 2) { paint(); return; }
  const before = dominoes(S.run).length;
  const next: DominoRun = { ...S.run, name: S.run.name.endsWith('(edited)') || S.run.name === 'My dominoes' ? S.run.name : `${S.run.name} (edited)`, strokes: [...S.run.strokes, { path: st.path, gap: S.gap }] };
  if (dominoes(next).length - before < 2) { paint(); shell.status('too short for a row: draw a longer stroke'); return; }
  S.undo.push(JSON.stringify(S.run));
  S.run = next;
  paint();
}

function undo() { if (!S.undo.length) return; S.run = JSON.parse(S.undo.pop()!); paint(); shell.status('row removed'); }

async function setRun(r: DominoRun, msg: string) {
  S.undo.push(JSON.stringify(S.run));
  S.run = { ...r, friction: S.friction, strokes: r.strokes.map((s) => ({ ...s, gap: S.gap })) };
  if (shell.mode === 'run') await shell.load(); else paint();
  shell.status(msg);
}
const preset = (k: string) => setRun(PRESETS[k](S.gap), `${PRESETS[k](S.gap).name}: ${dominoes(PRESETS[k](S.gap)).length} dominoes`);

// ------------------------------------------------------------------ sliders

function syncSliders() {
  S.gap = S.run.strokes[0]?.gap ?? S.gap; S.friction = S.run.friction ?? FRICTION.initial;
  ($('gap') as HTMLInputElement).value = String(S.gap); ($('mu') as HTMLInputElement).value = String(S.friction);
  $('gap-out').textContent = `${S.gap.toFixed(2)} H = ${(S.gap * H * 1000).toFixed(1)} mm`;
  $('mu-out').textContent = S.friction.toFixed(2);
}
let reloadTimer = 0;
function onSlider() {
  S.gap = +($('gap') as HTMLInputElement).value; S.friction = +($('mu') as HTMLInputElement).value;
  S.run = { ...S.run, friction: S.friction, strokes: S.run.strokes.map((s) => ({ ...s, gap: S.gap })) };
  syncSliders();
  if (shell.mode === 'run') { clearTimeout(reloadTimer); reloadTimer = window.setTimeout(() => void shell.load(), 250); } else paint();
}
$('gap').oninput = onSlider; $('mu').oninput = onSlider;

// ------------------------------------------------------------------ run mode: push, time, follow

function push() {
  if (shell.mode !== 'run' || !S.ds.length) return;
  const st = starts(S.run, S.ds);
  for (const i of st) { const t = tip(S.ds[i]); shell.bridge.teleport(i + 1, t.p, t.q, t.v, t.w); }
  S.pushedAt = shell.bridge.stats.simTime; S.recorded = false;
  if (!shell.bridge.running) shell.run();
  shell.status(`pushed the first domino of ${st.length} row${st.length === 1 ? '' : 's'}`);
}

function timeFalls(t: number) {
  const st = shell.bridge.lastState; if (!st) return;
  let any = false;
  S.ds.forEach((_, i) => {
    if (S.fall[i] !== undefined) return;
    const o = (i + 1) * BODY_STRIDE;
    if (tiltOf(st[o + 3], st[o + 5]) > FALLEN) { S.fall[i] = t; any = true; S.lastFall = t; }
  });
  if (any) readout();
  // a run is over when nothing new has fallen for a second: record it as an experiment
  if (!S.recorded && S.pushedAt >= 0 && t - S.lastFall > 1 && S.fall.some((x) => x !== undefined)) { S.recorded = true; recordExperiment(); }
}

/** Speeds per row (each row's own fall times along its own arc). */
function speeds() {
  const out: { stroke: number; v: number; n: number }[] = [];
  S.run.strokes.forEach((s, k) => {
    const idx = S.ds.map((d, i) => (d.stroke === k ? i : -1)).filter((i) => i >= 0);
    const r = waveSpeed(idx.map((i) => S.fall[i]), s.gap * H + T);
    if (r) out.push({ stroke: k, ...r });
  });
  return out;
}

function readout() {
  const sp = speeds(), fallen = S.fall.filter((x) => x !== undefined).length;
  const best = sp.sort((a, b) => b.n - a.n)[0];
  $('wave-big').textContent = best ? `${best.v.toFixed(2)} m/s · ${(best.v / SQRT_GH).toFixed(2)} √(gH)` : S.pushedAt >= 0 ? 'timing…' : 'push to start';
  rows($('wave-readout'), [
    ['fallen', `${fallen} of ${S.ds.length}`],
    ['gap', `${S.gap.toFixed(2)} H (${(S.gap * H * 1000).toFixed(1)} mm) · pitch ${((S.gap * H + T) * 1000).toFixed(1)} mm`],
    ['friction', S.friction.toFixed(2)],
    ['rows timed', sp.length ? sp.map((s) => `#${s.stroke + 1}: ${s.v.toFixed(3)} m/s (${s.n} dominoes)`).join(' · ') : '–'],
    ['√(gH)', `${SQRT_GH.toFixed(3)} m/s for H = ${(H * 1000).toFixed(1)} mm`],
  ]);
}

function recordExperiment() {
  const sp = speeds();
  if (!sp.length) { shell.status('this run was too short to time: rows need about ten dominoes'); return; }
  const v = sp.reduce((a, s) => a + s.v * s.n, 0) / sp.reduce((a, s) => a + s.n, 0), n = sp.reduce((a, s) => a + s.n, 0);
  S.experiments.push({ gap: S.gap, friction: S.friction, v, n, name: S.run.name });
  S.experiments = S.experiments.slice(-60);
  localStorage.setItem('x3d-physx-domino-runs', JSON.stringify(S.experiments));
  chart();
  shell.status(`timed: ${v.toFixed(3)} m/s = ${(v / SQRT_GH).toFixed(2)} √(gH) at gap ${S.gap.toFixed(2)} H, friction ${S.friction.toFixed(2)} (added to the chart)`);
}

function chart() {
  const fmt = (x: number) => x.toFixed(1);
  renderChart($('chart'), $('chart-legend'), $('chart-table'), {
    aria: 'Domino wave speed against gap: your runs, PhysX sweeps and published measurements',
    x: { label: 'gap / H', min: 0, max: 0.9, ticks: [0, 0.2, 0.4, 0.6, 0.8], fmt },
    y: { label: 'v / √(gH)', min: 0.6, max: 1.9, ticks: [0.8, 1.2, 1.6], fmt },
    lines: Object.entries(PHYSX_SWEEP).map(([k, pts]) => ({ label: `μ ${k.split(' ')[1]}`, pts, strong: Math.abs(+k.split(' ')[1] - S.friction) < 0.01 })),
    reference: { label: 'real dominoes (Larham, read)', pts: LARHAM.map(([x, y]) => ({ x, y, tip: `real dominoes: ${y.toFixed(2)} √(gH) at gap ${x.toFixed(2)} H (Larham 2013)` })) },
    measured: { label: 'your runs', pts: S.experiments.map((e) => ({ x: e.gap, y: e.v / SQRT_GH, tip: `${(e.v / SQRT_GH).toFixed(2)} √(gH) · gap ${e.gap.toFixed(2)} H · μ ${e.friction.toFixed(2)} · ${e.name}` })) },
    table: {
      head: ['source', 'gap/H', 'friction', 'v/√(gH)', 'm/s'],
      rows: [
        ...S.experiments.map((e) => ['your run', e.gap.toFixed(2), e.friction.toFixed(2), (e.v / SQRT_GH).toFixed(2), e.v.toFixed(3)]),
        ...LARHAM.map(([x, y]) => ['Larham (read)', x.toFixed(2), '–', y.toFixed(2), '–']),
      ],
    },
  });
}

function toggleFollow() {
  S.follow = !S.follow;
  shell.setPressed('follow', S.follow);
  if (S.follow) { ensureChase(); chase(); shell.view('Chase'); } else shell.view(VIEWS[S.view]);
}

/** A Viewpoint that rides beside the most recently fallen domino. */
function ensureChase() {
  const sc = shell.bridge.scene;
  try { sc.getNamedNode('Chase'); return; } catch { /* add it */ }
  const vp = sc.createNode('Viewpoint');
  vp.description = 'Following the wave'; vp.fieldOfView = 0.8;
  sc.addNamedNode('Chase', vp); sc.addRootNode(vp);
}
function chase() {
  const st = shell.bridge.lastState; if (!st) return;
  let last = -1, tl = -1;
  S.fall.forEach((t, i) => { if (t !== undefined && t >= tl) { tl = t; last = i; } });
  const i = last >= 0 ? Math.min(S.ds.length - 1, last) : 0, d = S.ds[i]; if (!d) return;
  const o = (i + 1) * BODY_STRIDE, at: [number, number, number] = [st[o], 0.01, st[o + 2]];
  const side: [number, number] = [Math.cos(d.yaw), -Math.sin(d.yaw)];
  const from: [number, number, number] = [at[0] + 0.3 * side[0] - 0.18 * Math.sin(d.yaw), 0.22, at[2] + 0.3 * side[1] - 0.18 * Math.cos(d.yaw)];
  try {
    const vp = shell.bridge.scene.getNamedNode('Chase');
    vp.position = new X3D.SFVec3f(...from);
    const [x, y, z, a] = lookAt(from, at).split(' ').map(Number);
    vp.orientation = new X3D.SFRotation(x, y, z, a);
  } catch { /* no chase */ }
}

function cycleView() {
  S.view = (S.view + 1) % VIEWS.length;
  if (S.follow) toggleFollow();
  if (shell.mode === 'run') shell.view(VIEWS[S.view]); else try { S.draw!.scene.getNamedNode(VIEWS[S.view]).set_bind = true; } catch { /* */ }
  shell.labelButton('view', `View: ${VIEWS[S.view]}`);
}

$('chart-table-toggle').onclick = () => { $('chart-table').hidden = !$('chart-table').hidden; };
$('chart-clear').onclick = () => { S.experiments = []; localStorage.removeItem('x3d-physx-domino-runs'); chart(); };
window.addEventListener('keydown', (e) => { if ((e.key === 'y' || e.key === 'Y') && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) $('chart-table-toggle').click(); });

syncSliders();
chart();
void shell.start();
Object.assign(window as unknown as Record<string, unknown>, { __dom: S, __viewpoint: viewpoint });
