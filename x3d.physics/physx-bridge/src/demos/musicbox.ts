// The physics music box page: a peg grid that edits the turning drum live, presets, tempo, three views, and the shell's controls.
import { DemoShell, X3D, $, el, rows } from './shell.ts';
import { BODY_STRIDE, CONTACT_STRIDE } from '../bridge/model.ts';
import { NOTES, NOTE_NAMES, PRESETS, STEPS, TEMPO, buildMusicBox, emptyBox, pegDef, sanitizeBox } from './musicbox-scene.ts';
import type { MusicBox } from './musicbox-scene.ts';
import type { MachineIR } from '../machine/index.ts';

/** Measured in Node (tools/musicbox-sim.ts): a column's notes sound about 0.75 of a step after the column reaches the feet. */
const STRIKE_LAG = 0.75;
const BAR_COLORS = ['#d9332e', '#e68c26', '#e6c23a', '#3fa66b', '#3b6fd9'];
const VIEWS = ['Front', 'Side', 'Top'];

const S = {
  box: PRESETS.twinkle() as MusicBox,
  cursor: [0, 0] as [number, number],
  column: -1,
  notes: 0,
  revolutions: 0,
  lastFrac: 0,
  struckThisTurn: new Set<string>(),
  view: 0,
  drum: -1,
  hammerOf: new Map<number, number>(), // body index -> note index
  barOf: new Map<number, number>(),
};

const shell = new DemoShell({
  id: 'musicbox',
  title: 'Physics music box',
  tagline: 'A pinned drum, ten hammers on hinges, ten tuned bars: every note is a contact',
  controls: [
    { id: 'p-twinkle', group: 'Music box', label: 'Twinkle', key: '1', run: () => preset('twinkle'), title: 'traditional' },
    { id: 'p-ode', group: 'Music box', label: 'Ode to Joy', key: '2', run: () => preset('ode'), title: 'Beethoven' },
    { id: 'p-arp', group: 'Music box', label: 'Arpeggios', key: '3', run: () => preset('arpeggio') },
    { id: 'p-dice', group: 'Music box', label: 'Dice', key: '4', run: () => preset('random'), title: 'random pegs on a pentatonic scale' },
    { id: 'p-clear', group: 'Music box', label: 'Pull all pegs', key: 'x', run: () => applyGrid(NOTES.map(() => '.'.repeat(STEPS)), 'all pegs pulled') },
    { id: 'tempo-down', group: 'Music box', label: 'Slower tempo', key: '[', run: () => tempo(-TEMPO.step) },
    { id: 'tempo-up', group: 'Music box', label: 'Faster tempo', key: ']', run: () => tempo(TEMPO.step) },
    { id: 'view', group: 'Music box', label: 'View: Front', key: 'v', run: () => cycleView() },
  ],
  scene: () => buildMusicBox(S.box, { allPegs: true }),
  exportScene: () => buildMusicBox(S.box),
  sound: {
    samples: ['tine-c6'], voices: 12, impulseRange: [3e-4, 1e-2],
    pick: (e) => {
      const bar = S.barOf.has(e.b1) ? e.b1 : S.barOf.has(e.b2) ? e.b2 : -1;
      const ham = S.hammerOf.has(e.b1) ? e.b1 : S.hammerOf.has(e.b2) ? e.b2 : -1;
      if (bar < 0 || ham < 0) return null; // only hammer on bar rings
      return { sample: 'tine-c6', note: NOTES[S.barOf.get(bar)!] };
    },
  },
  loaded: (read, ir: MachineIR) => {
    S.drum = ir.bodies.findIndex((b) => b.def === 'Drum');
    S.hammerOf.clear(); S.barOf.clear();
    ir.bodies.forEach((b, i) => { if (b.role === 'hammer') S.hammerOf.set(i, +b.def.slice(6)); if (b.role === 'chime') S.barOf.set(i, +b.def.slice(3)); });
    S.revolutions = 0; S.lastFrac = 0; S.notes = 0;
    void read;
    shell.view(VIEWS[S.view]);
    shell.hud('Space plays · click the grid to set pegs · 1–4 tunes · [ ] tempo · V view');
  },
  state: (e) => {
    playhead();
    if (e.time < 0.15) return;
    for (let o = 0; o < e.events.length; o += CONTACT_STRIDE) {
      const a = e.events[o], b = e.events[o + 1];
      if (S.barOf.has(a) && S.hammerOf.has(b)) struck(S.barOf.get(a)!); else if (S.barOf.has(b) && S.hammerOf.has(a)) struck(S.barOf.get(b)!);
    }
  },
  counters: () => [
    ['tune', `${S.box.name} · ${S.box.tempo} BPM`],
    ['pegs', String(S.box.grid.join('').split('x').length - 1)],
    ['notes struck', String(S.notes)],
    ['revolutions', String(S.revolutions)],
  ],
  save: () => S.box,
  restore: (v) => { const m = sanitizeBox(v); if (typeof m === 'string') return m; S.box = m; renderGrid(); return null; },
  fileName: () => S.box.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'music-box',
  key: (e) => gridKey(e),
});

// ------------------------------------------------------------------ the grid

const cells: HTMLButtonElement[][] = [];
const heads: HTMLElement[] = [];
function renderGrid() {
  const g = $('seq');
  if (!cells.length) {
    g.append(el('span'));
    for (let s = 0; s < STEPS; s++) { const h = el('span', String(s + 1), { class: 'col-head' }); heads.push(h); g.append(h); }
    for (let i = NOTES.length - 1; i >= 0; i--) {
      const lab = el('span', '', { class: 'note' });
      const sw = el('i'); sw.style.background = BAR_COLORS[i % 5];
      lab.append(sw, document.createTextNode(NOTE_NAMES[i]));
      g.append(lab);
      cells[i] = [];
      for (let s = 0; s < STEPS; s++) {
        const b = el('button', '', { class: `cell${s % 4 === 0 ? ' beat' : ''}`, 'aria-label': `${NOTE_NAMES[i]}, step ${s + 1}`, tabindex: '-1' }) as HTMLButtonElement;
        b.onclick = () => { S.cursor = [i, s]; toggle(i, s); };
        b.onfocus = () => { S.cursor = [i, s]; };
        cells[i][s] = b; g.append(b);
      }
    }
    cells[0][0].tabIndex = 0;
  }
  NOTES.forEach((_, i) => { for (let s = 0; s < STEPS; s++) cells[i][s].setAttribute('aria-pressed', String(S.box.grid[i][s] === 'x')); });
}

function setPeg(i: number, s: number, on: boolean) {
  const r = S.box.grid[i];
  S.box.grid[i] = r.slice(0, s) + (on ? 'x' : '.') + r.slice(s + 1);
  cells[i][s].setAttribute('aria-pressed', String(on));
  // live: the collidable joins or leaves PhysX's collision detection, the visual follows (standard X3D fields, set through SAI)
  try {
    const sc = shell.bridge.scene;
    sc.getNamedNode(pegDef(i, s)).enabled = on;
    sc.getNamedNode(`${pegDef(i, s)}V`).whichChoice = on ? 0 : -1;
  } catch { /* scene not loaded yet */ }
}
function toggle(i: number, s: number) {
  const on = S.box.grid[i][s] !== 'x';
  setPeg(i, s, on);
  S.box.name = S.box.name.endsWith('(edited)') ? S.box.name : `${S.box.name} (edited)`;
  shell.status(`${on ? 'set' : 'pulled'} the ${NOTE_NAMES[i]} peg at step ${s + 1}${shell.bridge.running ? ': live on the turning drum' : ''}`);
}

/** Apply a whole new grid live (presets, clear): only the pegs that differ are switched, no reload. */
function applyGrid(grid: string[], msg: string) {
  NOTES.forEach((_, i) => { for (let s = 0; s < STEPS; s++) if ((S.box.grid[i][s] === 'x') !== (grid[i][s] === 'x')) setPeg(i, s, grid[i][s] === 'x'); });
  shell.status(msg);
}

async function preset(k: string) {
  const p = PRESETS[k]();
  const tempoChanged = p.tempo !== S.box.tempo;
  if (tempoChanged) { S.box = p; renderGrid(); await shell.load(true); }
  else applyGrid(p.grid, `${p.name}: pegs set on the drum`);
  S.box.name = p.name;
  shell.status(`${p.name} · ${p.tempo} BPM`);
}

async function tempo(d: number) {
  const t = Math.max(TEMPO.min, Math.min(TEMPO.max, S.box.tempo + d));
  if (t === S.box.tempo) return;
  S.box.tempo = t;
  await shell.load(true); // the drum's TimeSensor gets a new cycleInterval: reload (pegs and tune are kept)
  shell.status(`tempo ${t} BPM: one turn of the drum every ${((STEPS * 60) / t / 2).toFixed(2)} s`);
}

function cycleView() {
  S.view = (S.view + 1) % VIEWS.length;
  shell.view(VIEWS[S.view]);
  shell.labelButton('view', `View: ${VIEWS[S.view]}`);
}

function gridKey(e: KeyboardEvent) {
  const [i, s] = S.cursor;
  const d = ({ ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, number[]>)[e.key];
  if (d) {
    const ni = Math.max(0, Math.min(NOTES.length - 1, i + d[0])), ns = (s + d[1] + STEPS) % STEPS;
    cells[i][s].tabIndex = -1; cells[ni][ns].tabIndex = 0; cells[ni][ns].focus();
    S.cursor = [ni, ns];
    return true;
  }
  if (e.key === 'Enter' && document.activeElement?.classList.contains('cell')) { toggle(i, s); return true; }
  return false;
}

// ------------------------------------------------------------------ playhead and struck notes

/** The drum's angle from PhysX's state (it is kinematic: it follows the X3D clock) gives the column under the hammers. */
function playhead() {
  const st = shell.bridge.lastState;
  if (!st || S.drum < 0) return;
  const o = S.drum * BODY_STRIDE, qx = st[o + 3], qw = st[o + 6];
  const frac = (((-2 * Math.atan2(qx, qw)) / (2 * Math.PI)) % 1 + 1) % 1;
  if (frac < S.lastFrac - 0.5) { S.revolutions++; S.struckThisTurn.clear(); }
  S.lastFrac = frac;
  const col = (Math.floor(frac * STEPS - STRIKE_LAG + 0.5) + STEPS) % STEPS;
  if (col !== S.column) {
    if (S.column >= 0) { heads[S.column]?.classList.remove('now'); NOTES.forEach((_, i) => cells[i][S.column]?.classList.remove('now')); }
    S.column = col;
    heads[col]?.classList.add('now'); NOTES.forEach((_, i) => cells[i][col]?.classList.add('now'));
  }
}

/** A hammer struck its bar: flash the cell of the column now sounding. */
function struck(note: number) {
  S.notes++;
  const c = cells[note]?.[S.column];
  if (!c) return;
  c.classList.remove('fade'); c.classList.add('struck');
  requestAnimationFrame(() => requestAnimationFrame(() => { c.classList.add('fade'); c.classList.remove('struck'); }));
  const r = $('mb-readout');
  rows(r, [['last note', `${NOTE_NAMES[note]} (MIDI ${NOTES[note]}) at step ${S.column + 1}`], ['struck', `${S.notes} notes in ${S.revolutions} turns`]]);
}

renderGrid();
void shell.start();
Object.assign(window as unknown as Record<string, unknown>, { __mb: S, __X3D: X3D });
void emptyBox;
