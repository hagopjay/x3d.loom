// The Marble Machine page: build mode (a physics-free X3D blueprint; pieces dragged with X3D PlaneSensors and snapped to the 4 cm pegboard)
// and run mode (the generated standard X3D scene on PhysX through the bridge). Every control is a button with a keyboard shortcut.
import { X3DPhysXBridge } from '../bridge/bridge.ts';
import type { RunLog } from '../bridge/bridge.ts';
import { SceneClocks } from '../bridge/clocks.ts';
import { renderDivergence } from './divergence-chart.ts';
import { ImpactSound, SAMPLES, resumeAudioOnGesture } from './sound.ts';
import { Looks } from './looks.ts';
import type { Look } from './looks.ts';
resumeAudioOnGesture();
import type { Series } from './divergence-chart.ts';
import { BODY_STRIDE } from '../bridge/model.ts';
import type { Vec3 } from '../bridge/model.ts';
import { MAPPING, XITE_BULLET } from '../bridge/mapping.ts';
import { CUP, COLS, GRID, PARAM_STEPS, PIECES, PIECE_FIELDS, ROWS, buildIR, dropPoint, machineFromX3D, pieceBounds, pieceInfo, sanitizeMachine, toModel, toX3D } from '../machine/index.ts';
import type { Machine, PieceInst, PieceType } from '../machine/index.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const X3D = (window as any).X3D;
const $ = (id: string) => document.getElementById(id)!;
const canvas = $('canvas') as unknown as { browser: SAI };
const browser = canvas.browser;
// developer switch for the performance probe: ?contacts=none|found|all (default: the bridge's choice)
const qp = new URLSearchParams(location.search);
const contactsParam = qp.get('contacts') as 'none' | 'found' | 'all' | null;
const bridge = new X3DPhysXBridge(X3D, canvas, { fixedStep: 1 / 240, clocksFollowPhysics: true, ...(contactsParam ? { world: { contacts: contactsParam } } : {}) });
const SPEEDS = [0.1, 0.25, 0.5, 1];

const S = {
  ready: false, mode: 'build' as 'build' | 'run', machine: null as unknown as Machine, selected: null as number | null,
  undoStack: [] as string[], redoStack: [] as string[], buildScene: null as SAI, speed: 3, error: '',
  marbles: [] as number[], drops: 0, lastRun: null as RunLog | null, replayResult: null as unknown,
  looks: null as Looks | null, look: 'photoreal' as Look, sound: null as ImpactSound | null, muted: false, soundVolume: 0.8, ticks: 0, race: false, ghost: null as null | { coll: SAI; marbles: SAI[]; clocks: SceneClocks; url: string }, raceSeries: new Map<number, Series & { t0: number }>(), impactWindow: [] as [number, number][], bridge, lastBuildMs: 0,
};
(window as unknown as { __mm: unknown }).__mm = S;

const status = (t: string) => { $('status').textContent = t; };
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', attrs: Record<string, string> = {}) {
  const e = document.createElement(tag); e.textContent = text; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e;
}
function rows(dl: HTMLElement, data: [string, string][]) {
  dl.replaceChildren(...data.flatMap(([k, v]) => [el('dt', k), el('dd', v)]));
}
function label(btn: HTMLElement, text: string, key: string) { btn.replaceChildren(document.createTextNode(text + ' '), el('kbd', key)); }

// ------------------------------------------------------------------ build mode

const piece = (id: number | null) => S.machine.pieces.find((p) => p.id === id) ?? null;

/** Scene loads run one at a time: overlapping replaceWorld calls abort each other in X_ITE (measured: "Replacing world aborted" on fast edits). */
let loads: Promise<unknown> = Promise.resolve();
const serial = <T>(f: () => Promise<T>): Promise<T> => { const p = loads.then(f, f); loads = p.catch(() => {}); return p; };
const enterBuild = () => serial(enterBuildNow);
const enterRun = () => serial(enterRunNow);

async function enterBuildNow() {
  bridge.pause();
  S.mode = 'build';
  document.body.dataset.mode = 'build';
  $('mode-build').setAttribute('aria-pressed', 'true'); $('mode-run').setAttribute('aria-pressed', 'false');
  const t0 = performance.now();
  const xml = toX3D(buildIR(S.machine), { mode: 'build', machine: S.machine });
  const scene = await browser.createX3DFromString(xml);
  await browser.replaceWorld(scene);
  S.buildScene = scene;
  for (const p of S.machine.pieces) hookPiece(p);
  S.lastBuildMs = performance.now() - t0;
  if (S.selected !== null && !piece(S.selected)) S.selected = null;
  showSelection();
  status(`build mode · ${S.machine.pieces.length} pieces · view rebuilt in ${S.lastBuildMs.toFixed(0)} ms`);
  $('hud').textContent = 'drag pieces on the pegboard · Q/E rotate · Del delete · Tab run';
}

/** Drag with the piece's PlaneSensor; snap to the 4 cm grid; commit on release. */
function hookPiece(p: PieceInst) {
  const drag = S.buildScene.getNamedNode(`Drag${p.id}`), xf = S.buildScene.getNamedNode(`Piece${p.id}`);
  let start: [number, number] | null = null;
  drag.addFieldCallback('mm', 'isActive', (on: boolean) => {
    const cur = piece(p.id);
    if (!cur) return;
    if (on) { start = [cur.gx, cur.gy]; select(p.id); return; }
    const moved = start && (start[0] !== cur.gx || start[1] !== cur.gy);
    if (moved && start) {
      const after = [cur.gx, cur.gy];
      cur.gx = start[0]; cur.gy = start[1]; pushUndo(); cur.gx = after[0]; cur.gy = after[1]; // undo restores the pre-drag position
      status(`moved ${pieceInfo(cur.type).label} to (${cur.gx}, ${cur.gy})`);
    }
    drag.offset = new X3D.SFVec3f(cur.gx * GRID, cur.gy * GRID, 0); // autoOffset kept the raw drag position; keep the snapped one
    start = null;
    showSelection();
  });
  drag.addFieldCallback('mm', 'translation_changed', (v: SAI) => {
    const cur = piece(p.id);
    if (!cur) return;
    const gx = Math.max(COLS[0], Math.min(COLS[1], Math.round(v.x / GRID))), gy = Math.max(ROWS[0], Math.min(ROWS[1], Math.round(v.y / GRID)));
    if (gx === cur.gx && gy === cur.gy) return;
    cur.gx = gx; cur.gy = gy;
    xf.translation = new X3D.SFVec3f(gx * GRID, gy * GRID, 0);
    showSelection();
  });
}

function select(id: number | null) { S.selected = id; showSelection(); }

function showSelection() {
  const sel = S.buildScene?.getNamedNode('Selection');
  const p = piece(S.selected);
  const body = $('inspector-body');
  if (!p) {
    if (sel) sel.scale = new X3D.SFVec3f(0, 0, 0);
    body.replaceChildren(el('span', 'Nothing selected. Click a piece on the board.'));
    for (const id of ['rot-left', 'rot-right', 'delete', 'param-up', 'param-down']) ($(id) as HTMLButtonElement).disabled = true;
    return;
  }
  const info = pieceInfo(p.type);
  const ir = buildIR({ ...S.machine, pieces: [p] });
  const b = pieceBounds(ir, p.id);
  if (sel && b) {
    const a = (p.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const cx = p.gx * GRID + b.center[0] * c - b.center[1] * s, cy = p.gy * GRID + b.center[0] * s + b.center[1] * c;
    sel.translation = new X3D.SFVec3f(cx, cy, b.center[2]);
    sel.rotation = new X3D.SFRotation(0, 0, 1, a);
    sel.scale = new X3D.SFVec3f(b.size[0] + 0.012, b.size[1] + 0.012, b.size[2] + 0.004);
  }
  const prm = { ...info.defaults, ...p.params };
  const dl = el('dl');
  rows(dl, [
    ['piece', `${info.label} #${p.id}`], ['at', `(${p.gx}, ${p.gy}) holes = ${(p.gx * GRID).toFixed(2)}, ${(p.gy * GRID).toFixed(2)} m`], ['rotation', `${p.rot}°`],
    ...Object.entries(prm).map(([k, v]): [string, string] => [k, `${+v.toFixed(3)} ${PARAM_STEPS[k]?.unit ?? ''}`]),
    ['X3D', info.nodes], ['does', info.about],
  ]);
  // info: what PhysX does with this piece's X3D fields, and what X_ITE's own engine does
  const info2 = el('dl', '', { class: 'mapping' });
  const rowsInfo: [string, string][] = [];
  for (const [node, field] of PIECE_FIELDS[p.type]) {
    const r = MAPPING[node]?.[field];
    if (r) rowsInfo.push([`${node}.${field}`, `PhysX: ${r[0]}: ${r[1]}`]);
    const bt = XITE_BULLET[`${node}.${field}`] ?? XITE_BULLET[node];
    if (bt) rowsInfo.push(['', `Bullet (X_ITE): ${bt}`]);
  }
  rows(info2, rowsInfo);
  body.replaceChildren(dl, el('h3', 'Its X3D fields on each engine'), info2);
  for (const id of ['rot-left', 'rot-right', 'delete']) ($(id) as HTMLButtonElement).disabled = false;
  const hasParam = Object.keys(info.defaults).length > 0;
  ($('param-up') as HTMLButtonElement).disabled = !hasParam; ($('param-down') as HTMLButtonElement).disabled = !hasParam;
}

function pushUndo() { S.undoStack.push(JSON.stringify(S.machine)); if (S.undoStack.length > 200) S.undoStack.shift(); S.redoStack = []; }
async function edit(fn: (m: Machine) => void, msg: string) {
  if (S.mode !== 'build') return;
  pushUndo(); fn(S.machine); await enterBuild(); status(msg);
}
async function addPiece(type: PieceType) {
  if (S.mode !== 'build') await enterBuild();
  const info = pieceInfo(type);
  const id = Math.max(0, ...S.machine.pieces.map((p) => p.id)) + 1;
  const near = piece(S.selected);
  const gx = near ? Math.min(COLS[1], near.gx + 4) : 0, gy = near ? Math.max(ROWS[0], near.gy - 3) : 12;
  await edit((m) => m.pieces.push({ id, type, gx, gy, rot: info.rot, params: {} }), `added ${info.label} #${id}: drag it into place`);
  select(id);
}
const rotate = (d: number) => { const p = piece(S.selected); if (p) void edit(() => { p.rot = (((p.rot + d) % 360) + 360) % 360; if (p.rot > 180) p.rot -= 360; }, `rotated to ${p.rot + d}°`); };
const remove = () => { const p = piece(S.selected); if (p) void edit((m) => { m.pieces = m.pieces.filter((x) => x !== p); S.selected = null; }, `deleted ${pieceInfo(p.type).label} #${p.id}`); };
function param(dir: number) {
  const p = piece(S.selected); if (!p) return;
  const info = pieceInfo(p.type), k = Object.keys(info.defaults)[0]; if (!k) return;
  const r = PARAM_STEPS[k], cur = p.params?.[k] ?? info.defaults[k];
  const v = Math.max(r.min, Math.min(r.max, +(cur + dir * r.step).toFixed(4)));
  void edit(() => { p.params = { ...p.params, [k]: v }; }, `${k} = ${v}`);
}
async function undo() { if (S.mode !== 'build' || !S.undoStack.length) return; S.redoStack.push(JSON.stringify(S.machine)); S.machine = JSON.parse(S.undoStack.pop()!); await enterBuild(); status('undone'); }
async function redo() { if (S.mode !== 'build' || !S.redoStack.length) return; S.undoStack.push(JSON.stringify(S.machine)); S.machine = JSON.parse(S.redoStack.pop()!); await enterBuild(); status('redone'); }

// ------------------------------------------------------------------ run mode

async function enterRunNow() {
  S.mode = 'run';
  document.body.dataset.mode = 'run';
  $('mode-build').setAttribute('aria-pressed', 'false'); $('mode-run').setAttribute('aria-pressed', 'true');
  status('building the PhysX world…');
  const ir = buildIR(S.machine);
  if (S.ghost) { URL.revokeObjectURL(S.ghost.url); S.ghost = null; }
  S.raceSeries.clear();
  const ghostUrl = S.race ? URL.createObjectURL(new Blob([toX3D(ir, { mode: 'ghost', machine: S.machine })], { type: 'model/x3d+xml' })) : undefined;
  const xml = toX3D(ir, { mode: 'run', machine: S.machine, ghostUrl, sound: { samples: SAMPLES, voices: 4, base: 'sounds/' } });
  const read = await bridge.loadString(xml, `${S.machine.name}.x3d`);
  S.sound = new ImpactSound(X3D, bridge.scene, ir, 4);
  S.looks = new Looks(X3D, browser, bridge.scene, ir);
  await S.looks.prepare().catch((e) => console.warn('CubeMapTexturing unavailable', e));
  S.looks.apply(S.look);
  S.sound.enabled = !S.muted; S.sound.volume = S.soundVolume;
  if (ghostUrl) await attachGhost(ghostUrl, ir.clocks.length);
  S.marbles = read.bodyNodes.map((n: SAI, i: number) => (/^Marble\d+Body$/.test(n.getNodeName()) ? i : -1)).filter((i: number) => i >= 0);
  S.impactWindow = [];
  label($('run'), 'Run', 'Space');
  const r = read.report;
  $('loss').textContent = `Loss report: ${r.lostAuthored.length} authored fields lost on PhysX; ${r.notes.length} build notes (${r.notes.filter((n) => n.status === 'approximated').length} approximated).`;
  // the loss report panel: per-status counts, the authored fields PhysX cannot honour, and the build notes (grouped)
  const groups = new Map<string, number>();
  for (const n of r.notes) { const k = `${n.node}.${n.field}: ${n.status}: ${n.how}`; groups.set(k, (groups.get(k) ?? 0) + 1); }
  const lr = el('dl');
  rows(lr, [
    ['fields', Object.entries(r.summary).map(([k, v]) => `${v} ${k}`).join(' · ')],
    ['lost (authored)', r.lostAuthored.length ? r.lostAuthored.map((l) => `${l.def}.${l.field}`).join(', ') : 'none: every field this machine sets is honoured or approximated'],
    ...[...groups].map(([k, c]): [string, string] => [`${c}×`, k]),
  ]);
  $('loss-detail').replaceChildren(lr);
  status(`run mode · ${read.bodyNodes.length} bodies, ${read.jointNodes.length} joints · PhysX ${bridge.stats.physxVersion} · build ${bridge.stats.buildMs.toFixed(0)} ms`);
  $('hud').textContent = 'Space run · 1/5/0 drop marbles · F flip · L launch · Tab build';
}

function toggleRun() {
  if (S.mode !== 'run') return;
  if (bridge.running) { bridge.pause(); label($('run'), 'Run', 'Space'); }
  else { bridge.run(); bridge.speed = SPEEDS[S.speed]; label($('run'), 'Pause', 'Space'); }
  syncGhost();
}

function toggleLook() {
  S.look = S.look === 'photoreal' ? 'loom' : 'photoreal';
  S.looks?.apply(S.look);
  label($('look'), S.look === 'photoreal' ? 'Look: photoreal' : 'Look: Loom', 'K');
  status(S.look === 'photoreal' ? 'photoreal: PhysicalMaterial, image-based light (procedural studio), shadows, PBR-neutral tone mapping' : 'Loom: gold on dark, outlines, glowing trails');
}

function mute() { S.muted = !S.muted; if (S.sound) S.sound.enabled = !S.muted; label($('mute'), S.muted ? 'Sound off' : 'Sound on', 'M'); $('mute').setAttribute('aria-pressed', String(!S.muted)); }
function volume(d: number) { S.soundVolume = Math.max(0, Math.min(1, +(S.soundVolume + d).toFixed(2))); if (S.sound) S.sound.volume = S.soundVolume; $('volume').textContent = `volume ${Math.round(S.soundVolume * 100)} %`; }

// ------------------------------------------------------------------ race (PhysX vs X_ITE's Bullet)

/** Wait for the Inline, then reach the ghost's collection, marbles and clocks through the scene's IMPORTs. */
async function attachGhost(url: string, clocks: number) {
  const sc = bridge.scene;
  const get = (n: string) => { try { return sc.getImportedNode(n); } catch { return null; } };
  for (let k = 0; k < 200 && !get('GhostMachine'); k++) await new Promise((r) => setTimeout(r, 50));
  const coll = get('GhostMachine');
  if (!coll) { status('race: the Bullet ghost did not load'); return; }
  const marbles = S.marbles.map((i) => get(`Ghost${bridge.bodyNodes[i].getNodeName().replace(/Body$/, '')}`));
  const c = new SceneClocks();
  await c.holdNodes(Array.from({ length: clocks }, (_, i) => get(`GhostClock${i}`)).filter(Boolean));
  S.ghost = { coll, marbles, clocks: c, url };
  status(`race: ${marbles.filter(Boolean).length} ghost marbles on X_ITE's Bullet, imported from an Inline`);
}

/** The ghost runs exactly while PhysX runs (and not during replays or slow motion, which Bullet's per-frame step cannot follow). */
function syncGhost() {
  const g = S.ghost; if (!g) return;
  const on = bridge.running && SPEEDS[S.speed] === 1;
  if (g.coll.enabled !== on) { g.coll.enabled = on; if (on) g.clocks.start(); else g.clocks.pause(); }
}

function ghostTeleport(bodyIndex: number, p: Vec3) {
  const g = S.ghost; if (!g) return;
  const k = S.marbles.indexOf(bodyIndex), gm = g.marbles[k];
  if (!gm) return;
  gm.position = new X3D.SFVec3f(...p); gm.linearVelocity = new X3D.SFVec3f(0, 0, 0); gm.angularVelocity = new X3D.SFVec3f(0, 0, 0);
  S.raceSeries.set(k, { t: [], d: [], t0: bridge.stats.simTime });
}

function raceSample() {
  const g = S.ghost, st = bridge.lastState;
  if (!g || !st || !bridge.running) return;
  for (const [k, s] of S.raceSeries) {
    const i = S.marbles[k], gp = g.marbles[k]?.position;
    if (!gp) continue;
    const d = Math.hypot(st[i * BODY_STRIDE] - gp.x, st[i * BODY_STRIDE + 1] - gp.y, st[i * BODY_STRIDE + 2] - gp.z);
    const t = bridge.stats.simTime - s.t0;
    if (t >= 0 && (!s.t.length || t - s.t[s.t.length - 1] >= 0.099)) { s.t.push(+t.toFixed(3)); s.d.push(d); }
  }
}

function raceReadout() {
  const g = S.ghost;
  if (!g) { rows($('race-readout'), [['race', 'off: press G to run Bullet ghosts beside PhysX']]); return; }
  const st = bridge.lastState;
  const cupP = st ? S.marbles.filter((i) => Math.abs(st[i * BODY_STRIDE] - CUP.x) < CUP.inner / 2 && st[i * BODY_STRIDE + 1] < CUP.top && st[i * BODY_STRIDE + 1] > 0).length : 0;
  const cupB = g.marbles.filter((m) => { const p = m?.position; return p && Math.abs(p.x - CUP.x) < CUP.inner / 2 && p.y < CUP.top && p.y > 0; }).length;
  const lost = g.marbles.filter((m) => (m?.position?.y ?? 0) < -0.1).length;
  const cur = [...S.raceSeries.values()].map((s) => s.d[s.d.length - 1]).filter((d) => d !== undefined);
  rows($('race-readout'), [
    ['in the cup', `PhysX ${cupP} · Bullet ${cupB}`],
    ['fell out of the world', `PhysX 0 · Bullet ${lost}`],
    ['distance now', cur.length ? `mean ${(100 * cur.reduce((a, b) => a + b, 0) / cur.length).toFixed(1)} cm · max ${(100 * Math.max(...cur)).toFixed(1)} cm (${cur.length} pairs)` : 'drop marbles to start'],
    ['clocks', `PhysX 1/240 s fixed · Bullet 1/${browser.currentFrameRate.toFixed(0)} s per frame`],
  ]);
  (S as unknown as Record<string, unknown>).raceNow = { cupP, cupB, lost, pairs: cur.length, mean: cur.length ? cur.reduce((a, b) => a + b, 0) / cur.length : 0, max: cur.length ? Math.max(...cur) : 0 };
  renderDivergence($('race-chart'), $('race-table-view'), [...S.raceSeries.values()]);
}

async function toggleRace() {
  S.race = !S.race;
  $('race').setAttribute('aria-pressed', String(S.race));
  if (S.mode === 'run') await enterRun();
  raceReadout();
}

/** Teleport parked marbles (on the shelf) into the hopper, a quarter second apart. */
function drop(k: number) {
  if (S.mode !== 'run') return;
  const st = bridge.lastState; if (!st) return;
  const parked = S.marbles.filter((i) => st[i * BODY_STRIDE + 1] > 0.99);
  const take = parked.slice(0, k);
  if (!take.length) { status('no marbles left on the shelf: Reset to collect them'); return; }
  take.forEach((i, j) => setTimeout(() => { const p = dropPoint(S.drops++) as Vec3; bridge.teleport(i, p); ghostTeleport(i, p); }, j * 250));
  if (!bridge.running) toggleRun();
  status(`dropping ${take.length} marble${take.length > 1 ? 's' : ''}`);
}

const jointDefs = (suffix: string) => (bridge.readResult?.jointNodes ?? []).map((n: SAI) => n.getNodeName()).filter((d: string) => d.endsWith(suffix));
function flip(up: boolean) { if (S.mode === 'run') for (const d of jointDefs('Motor')) bridge.setField(d, 'axis1Torque', up ? 0.06 : -0.02); }
function launch() {
  if (S.mode !== 'run') return;
  for (const d of jointDefs('Slider')) bridge.setField(d, 'sliderForce', 3);
  setTimeout(() => { for (const d of jointDefs('Slider')) bridge.setField(d, 'sliderForce', -0.2); }, 150);
}
function speed(d: number) { S.speed = Math.max(0, Math.min(SPEEDS.length - 1, S.speed + d)); bridge.speed = SPEEDS[S.speed]; $('speed').textContent = `×${SPEEDS[S.speed]}${S.ghost && SPEEDS[S.speed] !== 1 ? ' (Bullet ghosts wait: they step once per frame)' : ''}`; syncGhost(); }
async function reset() {
  if (S.mode !== 'run') return;
  bridge.pause(); label($('run'), 'Run', 'Space');
  if (S.ghost) { await enterRun(); status('reset: both engines reloaded'); return; } // the ghost's Bullet state lives in X_ITE: reload the race
  await bridge.rebuild(); S.impactWindow = []; status('reset: marbles back on the shelf');
}

function counters() {
  if (S.mode === 'run' && bridge.lastState) {
    const st = bridge.lastState, now = performance.now();
    const inCup = S.marbles.filter((i) => Math.abs(st[i * BODY_STRIDE] - CUP.x) < CUP.inner / 2 && st[i * BODY_STRIDE + 1] < CUP.top && st[i * BODY_STRIDE + 1] > 0).length;
    const onShelf = S.marbles.filter((i) => st[i * BODY_STRIDE + 1] > 0.99).length;
    S.impactWindow.push([now, bridge.stats.newContacts]);
    while (S.impactWindow.length > 1 && now - S.impactWindow[0][0] > 1000) S.impactWindow.shift();
    const [t0, c0] = S.impactWindow[0], perSec = now > t0 ? ((bridge.stats.newContacts - c0) * 1000) / (now - t0) : 0;
    rows($('counters'), [
      ['in the cup', `${inCup} / ${S.marbles.length}`], ['on the shelf', String(onShelf)], ['time', `${bridge.stats.simTime.toFixed(2)} s`],
      ['impacts / s', perSec.toFixed(0)], ['physics', `${(bridge.stats.physicsMsPerStep * 1000).toFixed(0)} µs/step · ${bridge.stats.stepsPerSecond} steps/s`],
      ['frame', `${browser.currentFrameRate.toFixed(0)} fps · ${(1000 / Math.max(1, browser.currentFrameRate)).toFixed(1)} ms`],
    ]);
    (S as unknown as Record<string, unknown>).counters = { inCup, onShelf, perSec, simTime: bridge.stats.simTime };
    raceSample();
    S.looks?.updateTrails(bridge.lastState);
    if (++S.ticks % 4 === 0 || !bridge.running) raceReadout();
  }
  setTimeout(counters, 100);
}

// ------------------------------------------------------------------ record and replay

async function record() {
  if (S.mode !== 'run') return;
  if (!bridge.isRecording) {
    await bridge.startRecording({ machine: S.machine });
    label($('record'), 'Stop recording', 'C'); $('record').classList.add('rec');
    label($('run'), 'Pause', 'Space'); bridge.run(); bridge.speed = SPEEDS[S.speed]; syncGhost();
    status('recording from the initial state: every step input and state hash');
    return;
  }
  bridge.pause(); label($('run'), 'Run', 'Space'); syncGhost();
  S.lastRun = bridge.stopRecording();
  label($('record'), 'Record', 'C'); $('record').classList.remove('rec');
  ($('replay') as HTMLButtonElement).disabled = ($('save-run') as HTMLButtonElement).disabled = !S.lastRun;
  const r = S.lastRun!;
  status(`recorded ${r.hashes.length} steps (${(r.hashes.length * r.fixedStep).toFixed(2)} s) in ${r.messages.length} batches`);
}

async function replay() {
  if (S.mode !== 'run' || !S.lastRun || bridge.isRecording) return;
  label($('run'), 'Run', 'Space');
  bridge.pause(); syncGhost();
  $('replay-result').textContent = 'replaying…';
  const res = await bridge.replay(S.lastRun, { onProgress: (k) => { if (k % 240 < 8) $('replay-result').textContent = `replaying… step ${k} / ${S.lastRun!.hashes.length}`; } });
  S.replayResult = res;
  $('replay-result').textContent = res.mismatches === 0
    ? `replay: all ${res.steps} step hashes identical (${res.ms.toFixed(0)} ms)`
    : `replay: ${res.mismatches} of ${res.steps} step hashes differ, first at step ${res.firstMismatch}`;
  return res;
}

function saveRun() {
  if (!S.lastRun) return;
  const a = el('a', '', { href: URL.createObjectURL(new Blob([JSON.stringify(S.lastRun)], { type: 'application/json' })), download: `run-${S.machine.name.replace(/[^\w-]+/g, '-').toLowerCase()}-${S.lastRun.hashes.length}-steps.json` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.getAttribute('href')!), 1000);
  status(`saved ${a.getAttribute('download')}`);
}

async function loadRun(text: string) {
  let log: RunLog;
  try { log = JSON.parse(text); } catch { status('not a run file'); return; }
  if (log?.format !== 'x3d-physx-run/1' || !Array.isArray(log.messages) || !Array.isArray(log.hashes) || !log.model) { status('not an x3d-physx run file'); return; }
  const m = sanitizeMachine((log.context as { machine?: unknown })?.machine);
  if (typeof m !== 'string' && JSON.stringify(m) !== JSON.stringify(S.machine)) { pushUndo(); S.machine = m; $('machine-name').textContent = m.name; }
  if (S.mode !== 'run') await enterRun();
  S.lastRun = log;
  ($('replay') as HTMLButtonElement).disabled = ($('save-run') as HTMLButtonElement).disabled = false;
  status(`loaded a run of ${log.hashes.length} steps recorded in ${log.recordedIn.match(/(Firefox|Chrome|Version)\/[\d.]+/)?.[0] ?? 'a browser'}`);
  return replay();
}

// ------------------------------------------------------------------ files

function exportX3D() {
  // marbles start above the hopper, so the file runs by itself in plain X_ITE too
  const xml = toX3D(buildIR(S.machine, { marbleStart: 'hopper' }), { mode: 'run', machine: S.machine });
  const a = el('a', '', { href: URL.createObjectURL(new Blob([xml], { type: 'model/x3d+xml' })), download: `${S.machine.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'marble-machine'}.x3d` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.getAttribute('href')!), 1000);
  status(`exported ${a.getAttribute('download')} (${(xml.length / 1024).toFixed(0)} KB, standard X3D 4.0)`);
  return xml;
}
async function importText(text: string) {
  const m = sanitizeMachine(machineFromX3D(text));
  if (typeof m === 'string') { status(`import failed: ${m} (only files exported by the Marble Machine carry the machine description)`); return false; }
  pushUndo(); S.machine = m; S.selected = null; await enterBuild(); $('machine-name').textContent = m.name; status(`imported ${m.name}: ${m.pieces.length} pieces`);
  return true;
}
async function loadDefault() {
  const m = sanitizeMachine(await (await fetch('scenes/machines/grand-cascade.json')).json());
  if (typeof m === 'string') throw new Error(m);
  if (S.machine) pushUndo();
  S.machine = m; S.selected = null; $('machine-name').textContent = m.name;
  await enterBuild();
}

// ------------------------------------------------------------------ wiring

for (const p of PIECES) {
  const b = el('button', '', { title: p.about, 'data-piece': p.type });
  label(b, p.label, p.key.toUpperCase());
  b.onclick = () => void addPiece(p.type);
  $('palette-buttons').append(b);
}
const on = (id: string, f: () => unknown) => { $(id).onclick = () => void f(); };
on('mode-build', () => S.mode !== 'build' && enterBuild()); on('mode-run', () => S.mode !== 'run' && enterRun());
on('rot-left', () => rotate(-15)); on('rot-right', () => rotate(15)); on('delete', remove);
on('param-down', () => param(-1)); on('param-up', () => param(1)); on('undo', undo); on('redo', redo);
on('run', toggleRun); on('step', () => S.mode === 'run' && bridge.step(4)); on('reset', reset);
on('drop1', () => drop(1)); on('drop5', () => drop(5)); on('drop20', () => drop(20));
on('loss-toggle', () => { $('loss-detail').hidden = !$('loss-detail').hidden; });
on('look', toggleLook); on('mute', mute); on('vol-down', () => volume(-0.1)); on('vol-up', () => volume(0.1));
on('race', toggleRace); on('race-table', () => { $('race-table-view').hidden = !$('race-table-view').hidden; });
on('launch', launch); on('record', record); on('replay', replay); on('save-run', saveRun);
on('load-run', () => ($('run-file') as HTMLInputElement).click());
($('run-file') as HTMLInputElement).onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) await loadRun(await f.text()); };
on('slower', () => speed(-1)); on('faster', () => speed(1));
$('flip').onpointerdown = () => flip(true); $('flip').onpointerup = $('flip').onpointerleave = () => flip(false);
on('export', exportX3D); on('import', () => ($('import-file') as HTMLInputElement).click());
($('import-file') as HTMLInputElement).onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) await importText(await f.text()); };
on('load-default', loadDefault); on('clear', () => edit((m) => { m.pieces = []; S.selected = null; }, 'empty board'));

addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key, mod = e.metaKey || e.ctrlKey;
  if (k === 'Tab') { e.preventDefault(); void (S.mode === 'build' ? enterRun() : enterBuild()); return; }
  if (mod && k.toLowerCase() === 'z') { e.preventDefault(); void (e.shiftKey ? redo() : undo()); return; }
  if (mod && k.toLowerCase() === 's') { e.preventDefault(); exportX3D(); return; }
  if (mod && k.toLowerCase() === 'o') { e.preventDefault(); ($('import-file') as HTMLInputElement).click(); return; }
  if (e.shiftKey && k === 'G') { void loadDefault(); return; }
  if (e.shiftKey && k === 'S') { saveRun(); return; }
  if (e.shiftKey && k === 'O') { ($('run-file') as HTMLInputElement).click(); return; }
  if (e.shiftKey && k === 'N') { void edit((m) => { m.pieces = []; S.selected = null; }, 'empty board'); return; }
  if (mod || e.altKey) return;
  if (S.mode === 'build') {
    const pal = PIECES.find((p) => p.key === k.toLowerCase());
    if (k === 'q' || k === 'Q') rotate(-15); else if (k === 'e' || k === 'E') rotate(15);
    else if (k === 'Delete' || k === 'Backspace') remove();
    else if (k === '[') param(-1); else if (k === ']') param(1);
    else if (k === 'Escape') select(null);
    else if (k.startsWith('Arrow') && piece(S.selected)) {
      e.preventDefault();
      const p = piece(S.selected)!, [dx, dy] = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, number[]>)[k];
      void edit(() => { p.gx = Math.max(COLS[0], Math.min(COLS[1], p.gx + dx)); p.gy = Math.max(ROWS[0], Math.min(ROWS[1], p.gy + dy)); }, `moved to (${p.gx + dx}, ${p.gy + dy})`);
    } else if (pal) void addPiece(pal.type);
  } else {
    if (k === ' ') { e.preventDefault(); toggleRun(); }
    else if (k === 's') void bridge.step(4);
    else if (k === 'c' || k === 'C') void record();
    else if (k === 'p' || k === 'P') void replay();
    else if (k === 'g' || k === 'G') void toggleRace();
    else if (k === 'm' || k === 'M') mute();
    else if (k === 'k' || k === 'K') toggleLook();
    else if (k === 'i' || k === 'I') $('loss-toggle').click();
    else if (k === '-') volume(-0.1); else if (k === '=' || k === '+') volume(0.1);
    else if (k === 't' || k === 'T') $('race-table').click();
    else if (k === 'r' || k === 'R') void reset();
    else if (k === '1') drop(1); else if (k === '5') drop(5); else if (k === '0') drop(20);
    else if ((k === 'f' || k === 'F') && !e.repeat) flip(true);
    else if (k === 'l' || k === 'L') launch();
    else if (k === ',') speed(-1); else if (k === '.') speed(1);
  }
});
addEventListener('keyup', (e: KeyboardEvent) => { if ((e.key === 'f' || e.key === 'F') && S.mode === 'run') flip(false); });

bridge.onState((ev) => S.sound?.handle(ev.events));
/** Expose the page's actions on S for tests, without ever overwriting a state field (that bit twice: the undo stack, the volume). */
function expose(fns: Record<string, unknown>) {
  for (const [k, f] of Object.entries(fns)) { if (k in S && typeof (S as Record<string, unknown>)[k] !== 'function') throw new Error(`page state already has a field named ${k}`); (S as Record<string, unknown>)[k] = f; }
}
expose({ toggleLook, mute, volume, toggleRace, record, replay, loadRun, buildIR, toModel, toX3D, enterBuild, enterRun, addPiece, rotate, remove, undo, redo, drop, flip, launch, reset, exportX3D, importText, select, toggleRun });
loadDefault().then(() => { S.ready = true; counters(); }).catch((e) => { S.error = String(e?.stack ?? e); status(`error: ${e}`); console.error(e); });
