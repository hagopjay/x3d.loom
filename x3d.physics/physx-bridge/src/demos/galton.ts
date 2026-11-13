// The Galton board page: pour (beads metered from the hopper into the chute), drop one, shake and tilt (live RigidBodyCollection.gravity),
// the board's settings, and a live histogram against Binomial(rows, ½) with a χ² test.
import { DemoShell, X3D, $, rows as dlRows } from './shell.ts';
import { BODY_STRIDE } from '../bridge/model.ts';
import { quatMul, quatToAxisAngle, axisAngleToQuat } from '../bridge/math.ts';
import type { MachineIR } from '../machine/index.ts';
import { LIMITS, SHAKE, binomial, buildGalton, chiSquare, chiSquareP, defaultGalton, geometry, gravityFor, sanitizeGalton, shakeGravity } from './galton-scene.ts';
import type { Galton } from './galton-scene.ts';
import { renderHistogram } from './histogram-chart.ts';
import { lookAtQuat } from './view.ts';

const RATE = 20; // beads per second while pouring
const VIEWS = ['Front', 'Pins', 'Bins'];
const S = {
  g: defaultGalton() as Galton,
  beads: [] as number[],
  pouring: false,
  pourStart: 0,
  pourDone: 0,
  shakeStart: -1,
  bins: [] as number[],
  view: 0,
  ticks: 0,
  stats: null as null | { binned: number; mean: number; sd: number; chi2: number; dof: number; p: number },
};

const shell: DemoShell = new DemoShell({
  id: 'galton',
  title: 'Galton board',
  tagline: 'Glass beads through hexagonal pins: does the bell curve appear?',
  controls: [
    { id: 'pour', group: 'Galton board', label: 'Pour', key: 'o', run: () => togglePour(), pressed: false, title: `${RATE} beads a second from the hopper` },
    { id: 'drop1', group: 'Galton board', label: 'Drop 1', key: '1', run: () => drop(1) },
    { id: 'shake', group: 'Galton board', label: 'Shake', key: 'h', run: () => shake(), title: 'tap the board: frees beads wedged between pins' },
    { id: 'tilt-left', group: 'Galton board', label: 'Tilt left', key: '[', run: () => tilt(-1) },
    { id: 'tilt-right', group: 'Galton board', label: 'Tilt right', key: ']', run: () => tilt(1) },
    { id: 'level', group: 'Galton board', label: 'Level', key: 'l', run: () => tilt(0) },
    { id: 'view', group: 'Galton board', label: 'View: Front', key: 'v', run: () => cycleView() },
  ],
  scene: () => { const b = buildGalton(S.g); return { ir: b.ir, meta: b.meta }; },
  world: { contacts: 'sensed' }, // only bead-on-pin pairs report (the pins are in a CollisionSensor): piles in the bins cost nothing
  sound: { samples: ['tick-bead'], voices: 10, impulseRange: [3e-5, 1.5e-3], pick: () => ({ sample: 'tick-bead' }) },
  loaded: (_read, ir: MachineIR) => {
    S.beads = buildGalton(S.g).beads; S.pouring = false; S.pourDone = 0; S.shakeStart = -1; S.stats = null;
    shell.setPressed('pour', false); shell.labelButton('pour', 'Pour');
    void ir;
    applyView();
    count();
    shell.hud('O pours · 1 drops one · H shakes · [ ] tilt · V view');
  },
  state: (e) => {
    const G = geometry(S.g);
    // metering: the lowest bead in the hopper goes to the chute, RATE a second (page-side, recorded with the run like any teleport)
    if (S.pouring) {
      const due = Math.floor((e.time - S.pourStart) * RATE) - S.pourDone;
      if (due > 0 && drop(Math.min(due, 3)) === 0) { togglePour(); shell.status('the hopper is empty'); }
    }
    if (S.shakeStart >= 0) {
      const u = e.time - S.shakeStart;
      const g = shakeGravity(S.g.tilt, u);
      shell.bridge.scene.getNamedNode('Machine').gravity = new X3D.SFVec3f(...g);
      if (u > SHAKE.s) S.shakeStart = -1;
    }
    if (++S.ticks % 6 === 0) count();
    void G;
  },
  counters: () => [['beads', `${S.beads.length} · ${S.stats?.binned ?? 0} in the bins`], ['tilt', `${S.g.tilt}°`], ['pin pitch', `${(S.g.pitch * 1000).toFixed(0)} mm`]],
  save: () => S.g,
  restore: (v) => { const g = sanitizeGalton(v); if (typeof g === 'string') return g; S.g = g; syncSliders(); return null; },
  fileName: () => `galton-${S.g.rows}-rows-${S.g.beads}-beads`,
});

function hopperBeads(): number[] {
  const st = shell.bridge.lastState, G = geometry(S.g);
  if (!st) return [];
  return S.beads.filter((i) => st[i * BODY_STRIDE + 1] > G.neckY).sort((a, b) => st[a * BODY_STRIDE + 1] - st[b * BODY_STRIDE + 1]);
}
/** Move the lowest n beads of the hopper into the chute. Returns how many moved. */
function drop(n: number): number {
  const take = hopperBeads().slice(0, n), G = geometry(S.g);
  take.forEach((i, k) => shell.bridge.teleport(i, [G.dropAt[0], G.dropAt[1] - k * 0.009, 0]));
  S.pourDone += take.length;
  if (take.length && !shell.bridge.running) shell.run();
  return take.length;
}
function togglePour() {
  S.pouring = !S.pouring;
  if (S.pouring) { S.pourStart = shell.bridge.stats.simTime; S.pourDone = 0; if (!shell.bridge.running) shell.run(); }
  shell.setPressed('pour', S.pouring); shell.labelButton('pour', S.pouring ? 'Stop pouring' : 'Pour');
}
function shake() { if (!shell.bridge.running) shell.run(); S.shakeStart = shell.bridge.stats.simTime; shell.status(`shake: ${Math.round(SHAKE.s * SHAKE.hz)} taps (gravity jerked up and aside for 0.04 s each)`); }

function tilt(d: number) {
  const [lo, hi] = LIMITS.tilt;
  S.g.tilt = d === 0 ? 0 : Math.max(lo, Math.min(hi, S.g.tilt + 2 * d));
  try { shell.bridge.scene.getNamedNode('Machine').gravity = new X3D.SFVec3f(...gravityFor(S.g.tilt)); } catch { /* not loaded */ }
  applyView();
  shell.status(`tilt ${S.g.tilt}°: RigidBodyCollection.gravity = ${gravityFor(S.g.tilt).map((x) => x.toFixed(2)).join(' ')} (live)`);
}

/** The camera rolls with the tilt, so gravity stays straight down on screen and the board appears to lean. */
function applyView() {
  const def = VIEWS[S.view];
  try {
    const vp = shell.bridge.scene.getNamedNode(def), G = geometry(S.g);
    const eye: [number, number, number] = [vp.position.x, vp.position.y, vp.position.z];
    const look: [number, number, number] = def === 'Front' ? [0, G.hopperTop / 2, 0] : def === 'Pins' ? [0, (G.firstRow + G.lastRow) / 2, 0] : [0, 0.1, 0];
    const q = quatMul(lookAtQuat(eye, look), axisAngleToQuat(0, 0, 1, (S.g.tilt * Math.PI) / 180));
    const [x, y, z, a] = quatToAxisAngle(q);
    vp.orientation = new X3D.SFRotation(x, y, z, a);
  } catch { /* not loaded */ }
  shell.view(def);
}
function cycleView() { S.view = (S.view + 1) % VIEWS.length; applyView(); shell.labelButton('view', `View: ${VIEWS[S.view]}`); }

function count() {
  const st = shell.bridge.lastState; if (!st) return;
  const G = geometry(S.g), bins = G.bins.map(() => 0);
  for (const i of S.beads) {
    const x = st[i * BODY_STRIDE], y = st[i * BODY_STRIDE + 1];
    if (y < G.lastRow - 0.012 && y > 0) { const j = Math.round(x / S.g.pitch + S.g.rows / 2); if (j >= 0 && j < bins.length) bins[j]++; }
  }
  S.bins = bins;
  const N = bins.reduce((a, b) => a + b, 0), p = binomial(S.g.rows), exp = p.map((x) => x * N);
  const mean = N ? bins.reduce((s, x, j) => s + x * (j - S.g.rows / 2), 0) / N : 0, sd = N ? Math.sqrt(bins.reduce((s, x, j) => s + x * (j - S.g.rows / 2 - mean) ** 2, 0) / N) : 0;
  const { chi2, dof } = chiSquare(bins, exp);
  S.stats = { binned: N, mean, sd, chi2, dof, p: dof > 0 ? chiSquareP(chi2, dof) : NaN };
  renderHistogram($('hist'), $('hist-legend'), $('hist-table'), bins, exp, G.bins.map((_, j) => String(j - S.g.rows / 2)));
  dlRows($('galton-readout'), [
    ['in the bins', `${N} of ${S.beads.length}`],
    ['centre', `${mean >= 0 ? '+' : ''}${mean.toFixed(2)} bins (binomial 0)`],
    ['spread σ', `${sd.toFixed(2)} bins (binomial ${(Math.sqrt(S.g.rows) / 2).toFixed(2)})`],
    ['χ² vs binomial', N >= 30 && dof > 0 ? `${chi2.toFixed(1)} on ${dof} dof · p = ${S.stats.p < 1e-4 ? S.stats.p.toExponential(1) : S.stats.p.toFixed(3)}${S.stats.p < 0.05 ? ' (not binomial)' : ' (consistent)'}` : 'needs 30 beads'],
  ]);
}

// sliders
const sl = (id: 'beads' | 'rows' | 'pitch' | 'bounce') => $(id) as HTMLInputElement;
function syncSliders() {
  for (const k of ['beads', 'rows', 'pitch', 'bounce'] as const) { const [lo, hi, st] = LIMITS[k]; Object.assign(sl(k), { min: String(lo), max: String(hi), step: String(st), value: String(S.g[k]) }); }
  $('beads-out').textContent = String(S.g.beads); $('rows-out').textContent = `${S.g.rows} (${S.g.rows + 1} bins)`;
  $('pitch-out').textContent = `${(S.g.pitch * 1000).toFixed(0)} mm`; $('bounce-out').textContent = S.g.bounce.toFixed(2);
}
let timer = 0;
for (const k of ['beads', 'rows', 'pitch', 'bounce'] as const) sl(k).oninput = () => {
  S.g = { ...S.g, [k]: +sl(k).value }; syncSliders();
  clearTimeout(timer); timer = window.setTimeout(() => void shell.load(), 300);
};
$('hist-table-toggle').onclick = () => { $('hist-table').hidden = !$('hist-table').hidden; };
window.addEventListener('keydown', (e) => { if ((e.key === 'y' || e.key === 'Y') && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) $('hist-table-toggle').click(); });

syncSliders();
void shell.start();
Object.assign(window as unknown as Record<string, unknown>, { __galton: S });
