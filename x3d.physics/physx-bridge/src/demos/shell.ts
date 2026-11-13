// The demo shell: everything the demos share with the Marble Machine page, so each demo only describes its scene and its own controls.
// Run, step, reset, speed, record and replay (bit-exact, with a saved run file), the two looks, contact sound, Export/Import of standard
// X3D, the loss report, a help overlay listing every shortcut, and live counters (physics time per step, frame rate).
// Every control is a visible button with a keyboard shortcut; the shortcut is printed on the button.
import { X3DPhysXBridge } from '../bridge/bridge.ts';
import type { RunLog, StateEvent } from '../bridge/bridge.ts';
import type { ReadResult } from '../bridge/reader.ts';
import type { WorldOptions } from '../bridge/world.ts';
import { toX3D, xmlEscape } from '../machine/index.ts';
import type { MachineIR, SceneMeta } from '../machine/index.ts';
import { ImpactSound, resumeAudioOnGesture } from '../demo/sound.ts';
import type { PickSample } from '../demo/sound.ts';
import { Looks } from '../demo/looks.ts';
import type { Look } from '../demo/looks.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const X3D = (window as any).X3D;
export const $ = (id: string) => document.getElementById(id)!;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', attrs: Record<string, string> = {}) {
  const e = document.createElement(tag); e.textContent = text; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e;
}
export function rows(dl: HTMLElement, data: [string, string][]) { dl.replaceChildren(...data.flatMap(([k, v]) => [el('dt', k), el('dd', v)])); }

/** The pages in this project, for the header's navigation. */
export const PAGES = [
  { href: 'index.html', label: 'All demos' },
  { href: 'machine.html', label: 'Marble Machine' },
  { href: 'musicbox.html', label: 'Music box' },
  { href: 'dominoes.html', label: 'Dominoes' },
  { href: 'trebuchet.html', label: 'Trebuchet' },
  { href: 'galton.html', label: 'Galton board' },
  { href: 'ragdoll.html', label: 'Stairs of doom' },
  { href: 'barrage.html', label: 'Dummy barrage' },
];

export interface Control {
  id: string;
  label: string;
  /** e.key value ('a', ' ', 'ArrowUp', ...); prefix 'shift+' or 'mod+' (⌘ or Ctrl). Matching ignores case unless shift+ is given. */
  key?: string;
  /** How the key is printed on the button (default derived from key). */
  keyLabel?: string;
  group: string;
  title?: string;
  run?: () => unknown;
  /** Press-and-hold controls (pointer or key): down on press, up on release. */
  hold?: { down: () => void; up: () => void };
  /** A toggle shown with aria-pressed. */
  pressed?: boolean;
  /** Only when the demo is in this mode (pages with an edit mode and a run mode). */
  mode?: string;
}

export interface DemoSpec {
  id: string;
  title: string;
  /** One line under the title. */
  tagline: string;
  controls: Control[];
  /** The scene: IR plus what the file says about itself. Called on every load (reset, record, import). */
  scene(): { ir: MachineIR; meta: SceneMeta };
  /** The sound: samples the scene carries voices for, and how an impact picks one. */
  /** `settle`: seconds after a (re)load during which impacts stay silent (bodies settling onto what holds them). Default 0.15. */
  sound?: { samples: string[]; voices: number; pick: PickSample; impulseRange?: [number, number]; settle?: number };
  world?: WorldOptions;
  /** After each load: find nodes, hook sensors. */
  loaded?(read: ReadResult, ir: MachineIR): void | Promise<void>;
  /** Every state event from PhysX. */
  state?(e: StateEvent): void;
  /** Rows for the live counters (every 100 ms). */
  counters?(): [string, string][];
  /** The page's own description, saved in exports and run files (and given back to restore). */
  save(): unknown;
  restore(v: unknown): string | null | Promise<string | null>;
  /** File name stem for exports and runs. */
  fileName(): string;
  /** An export variant for plain X3D browsers (default: the run scene without sound voices). */
  exportScene?(): { ir: MachineIR; meta: SceneMeta };
  /** Optional edit mode (Tab toggles): the shell calls these and hides the run controls while editing. */
  modes?: { initial: string; enter(mode: string): Promise<void> };
  /** Key presses not bound to a control (drawing tools and so on). Return true when handled. */
  key?(e: KeyboardEvent): boolean;
}

const SPEEDS = [0.1, 0.25, 0.5, 1];
const META_NAME = 'X3dPhysxDemo';

/** Build the standard toX3D options for a demo scene (sound voices in the browser, none in exports). */
export function demoX3D(ir: MachineIR, meta: SceneMeta, sound?: DemoSpec['sound']) {
  // the photoreal look's cube map (loaded at run time) needs its component declared, or X_ITE warns
  // in the browser only (exports stay plain X3D 4.0): X_ITE's shadow-map size for these small scenes
  meta = { ...meta, shadowMapSize: 2048, components: (meta.components ?? '') + '  <component name="CubeMapTexturing" level="1"/>\n' };
  return toX3D(ir, { mode: 'run', meta, sound: sound ? { samples: sound.samples, voices: sound.voices, base: 'sounds/' } : undefined });
}

export class DemoShell {
  readonly spec: DemoSpec;
  readonly bridge: X3DPhysXBridge;
  readonly browser: SAI;
  mode: string;
  ir: MachineIR | null = null;
  read: ReadResult | null = null;
  sound: ImpactSound | null = null;
  looks: Looks | null = null;
  look: Look = 'photoreal';
  muted = false;
  soundVolume = 0.8;
  speedIndex = 3;
  lastRun: RunLog | null = null;
  replayResult: unknown = null;
  ready = false;
  error = '';
  loadMs = 0;
  private loads: Promise<unknown> = Promise.resolve();
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly all: Control[];

  constructor(spec: DemoSpec) {
    resumeAudioOnGesture();
    this.spec = spec;
    this.mode = spec.modes?.initial ?? 'run';
    const canvas = $('canvas') as unknown as { browser: SAI };
    this.browser = canvas.browser;
    const qp = new URLSearchParams(location.search).get('contacts') as WorldOptions['contacts'] | null; // developer switch (performance probe)
    this.bridge = new X3DPhysXBridge(X3D, canvas, { fixedStep: 1 / 240, clocksFollowPhysics: true, world: { ...spec.world, ...(qp ? { contacts: qp } : {}) } });
    this.all = [...spec.controls, ...this.standardControls()];
    this.renderChrome();
    this.bridge.onState((e) => { if (e.time > (spec.sound?.settle ?? 0.15)) this.sound?.handle(e.events); spec.state?.(e); });
    window.addEventListener('keydown', (e: KeyboardEvent) => this.onKey(e, true));
    window.addEventListener('keyup', (e: KeyboardEvent) => this.onKey(e, false));
    (window as unknown as { __demo: unknown }).__demo = this;
  }

  // ---------------------------------------------------------------- chrome

  private standardControls(): Control[] {
    const run = 'run-only';
    return [
      { id: 'run', group: 'Run', label: 'Run', key: ' ', keyLabel: 'Space', run: () => this.toggleRun(), mode: run },
      { id: 'step', group: 'Run', label: 'Step', key: 's', run: () => this.step(), mode: run },
      { id: 'reset', group: 'Run', label: 'Reset', key: 'r', run: () => this.reset(), mode: run },
      { id: 'slower', group: 'Run', label: 'Slower', key: ',', run: () => this.setSpeed(-1), mode: run },
      { id: 'faster', group: 'Run', label: 'Faster', key: '.', run: () => this.setSpeed(1), mode: run },
      { id: 'record', group: 'Record and replay', label: 'Record', key: 'c', run: () => this.record(), mode: run },
      { id: 'replay', group: 'Record and replay', label: 'Replay', key: 'p', run: () => this.replay(), mode: run },
      { id: 'save-run', group: 'Record and replay', label: 'Save run', key: 'shift+S', keyLabel: '⇧S', run: () => this.saveRun() },
      { id: 'load-run', group: 'Record and replay', label: 'Load run', key: 'shift+O', keyLabel: '⇧O', run: () => this.pick('.json,application/json', (t) => this.loadRun(t)) },
      { id: 'look', group: 'Look and sound', label: 'Look: photoreal', key: 'k', run: () => this.toggleLook() },
      { id: 'mute', group: 'Look and sound', label: 'Sound on', key: 'm', run: () => this.toggleMute(), pressed: true },
      { id: 'vol-down', group: 'Look and sound', label: 'Quieter', key: '-', keyLabel: '−', run: () => this.volume(-0.1) },
      { id: 'vol-up', group: 'Look and sound', label: 'Louder', key: '=', run: () => this.volume(0.1) },
      { id: 'export', group: 'File', label: 'Export .x3d', key: 'mod+s', keyLabel: '⌘S', run: () => this.exportX3D() },
      { id: 'import', group: 'File', label: 'Import .x3d', key: 'mod+o', keyLabel: '⌘O', run: () => this.pick('.x3d,model/x3d+xml', (t) => this.importX3D(t)) },
      { id: 'loss', group: 'File', label: 'Loss report', key: 'i', run: () => { $('loss-detail').hidden = !$('loss-detail').hidden; } },
      { id: 'help', group: 'File', label: 'Shortcuts', key: '?', run: () => this.help() },
    ];
  }

  private renderChrome() {
    const nav = $('demo-nav');
    nav.replaceChildren(...PAGES.map((p) => {
      const a = el('a', p.label, { href: p.href });
      if (location.pathname.endsWith(p.href) || (p.href === 'index.html' && /\/$/.test(location.pathname))) a.setAttribute('aria-current', 'page');
      return a;
    }));
    $('tagline').textContent = this.spec.tagline;
    const side = $('side');
    const groups = new Map<string, Control[]>();
    for (const c of this.all) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
    const sections: HTMLElement[] = [];
    for (const [g, cs] of groups) {
      const sec = el('section', '', { 'data-group': g });
      sec.append(el('h2', g));
      const row = el('div', '', { class: 'row' });
      for (const c of cs) {
        const b = el('button', '', { id: c.id, ...(c.title ? { title: c.title } : {}), ...(c.mode ? { 'data-mode': c.mode } : {}) }) as HTMLButtonElement;
        if (c.pressed !== undefined) b.setAttribute('aria-pressed', String(c.pressed));
        this.buttons.set(c.id, b);
        this.labelButton(c.id, c.label);
        if (c.hold) { b.onpointerdown = () => c.hold!.down(); b.onpointerup = b.onpointerleave = () => c.hold!.up(); }
        else b.onclick = () => void this.invoke(c);
        row.append(b);
      }
      sec.append(row);
      if (g === 'Run') sec.append(el('dl', '', { id: 'counters' }));
      if (g === 'Record and replay') sec.append(el('p', '', { id: 'replay-result', class: 'dim' }));
      if (g === 'Look and sound') sec.append(el('p', 'volume 80 %', { id: 'volume', class: 'dim' }));
      if (g === 'File') { sec.append(el('p', '', { id: 'loss', class: 'dim' })); const d = el('div', '', { id: 'loss-detail' }); d.hidden = true; sec.append(d); }
      sections.push(sec);
    }
    // demo panels (#panels in the page) go between the demo's controls and the standard ones
    const panels = document.getElementById('panels');
    const demoGroups = new Set(this.spec.controls.map((c) => c.group));
    const first = sections.filter((s) => demoGroups.has(s.dataset.group!) || s.dataset.group === 'Run');
    side.replaceChildren(...first, ...(panels ? [panels] : []), ...sections.filter((s) => !first.includes(s)));
    ($('replay') as HTMLButtonElement).disabled = true; ($('save-run') as HTMLButtonElement).disabled = true;
    document.body.dataset.mode = this.mode;
  }

  private keyLabel(c: Control) { return c.keyLabel ?? (c.key ? (c.key.length === 1 ? c.key.toUpperCase() : c.key.replace(/^shift\+/, '⇧').replace(/^mod\+/, '⌘')) : ''); }
  labelButton(id: string, text: string) {
    const b = this.buttons.get(id), c = this.all.find((x) => x.id === id);
    if (!b || !c) return;
    const k = this.keyLabel(c);
    b.replaceChildren(document.createTextNode(text + (k ? ' ' : '')), ...(k ? [el('kbd', k)] : []));
  }
  setPressed(id: string, on: boolean) { this.buttons.get(id)?.setAttribute('aria-pressed', String(on)); }
  setDisabled(id: string, off: boolean) { const b = this.buttons.get(id); if (b) b.disabled = off; }
  status(t: string) { $('status').textContent = t; }
  hud(t: string) { $('hud').textContent = t; }

  private async invoke(c: Control) {
    if (c.mode === 'run-only' && this.mode !== 'run') return;
    if (c.mode && c.mode !== 'run-only' && c.mode !== this.mode) return;
    try { await c.run?.(); } catch (e) { this.status(`error: ${e}`); console.error(e); }
  }

  private matches(c: Control, e: KeyboardEvent) {
    if (!c.key) return false;
    let k = c.key, shift = false, mod = false;
    if (k.startsWith('shift+')) { shift = true; k = k.slice(6); }
    if (k.startsWith('mod+')) { mod = true; k = k.slice(4); }
    if (mod !== (e.metaKey || e.ctrlKey)) return false;
    if (shift) return e.shiftKey && e.key === k;
    if (k === '?') return e.key === '?';
    if (e.shiftKey && k.length === 1 && /[a-z]/i.test(k)) return false; // ⇧ letters are separate shortcuts
    return k.length === 1 ? e.key.toLowerCase() === k.toLowerCase() : e.key === k;
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (down && e.key === 'Tab' && this.spec.modes) { e.preventDefault(); void this.toggleMode(); return; }
    if (down && e.key === 'Escape') { const h = document.getElementById('help-dialog') as HTMLDialogElement | null; if (h?.open) h.close(); }
    const c = this.all.find((x) => this.matches(x, e));
    if (c) {
      if (e.key === ' ' || e.metaKey || e.ctrlKey || e.key.startsWith('Arrow')) e.preventDefault();
      if (c.hold) { if (!e.repeat) (down ? c.hold.down : c.hold.up)(); return; }
      if (down) void this.invoke(c);
      return;
    }
    if (down && this.spec.key?.(e)) e.preventDefault();
  }

  private help() {
    let d = document.getElementById('help-dialog') as HTMLDialogElement | null;
    if (!d) {
      d = el('dialog', '', { id: 'help-dialog', 'aria-label': 'Keyboard shortcuts' }) as HTMLDialogElement;
      const groups = new Map<string, Control[]>();
      for (const c of this.all) if (c.key) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
      d.append(el('h2', `${this.spec.title}: every control and its key`));
      const grid = el('div', '', { class: 'help-grid' });
      for (const [g, cs] of groups) {
        const dl = el('dl');
        rows(dl, cs.map((c) => [this.keyLabel(c), c.title ? `${c.label}: ${c.title}` : c.label]));
        const sec = el('section'); sec.append(el('h3', g), dl); grid.append(sec);
      }
      if (this.spec.modes) { const sec = el('section'); const dl = el('dl'); rows(dl, [['Tab', 'switch between editing and running']]); sec.append(el('h3', 'Mode'), dl); grid.append(sec); }
      const close = el('button', 'Close', { class: 'close' }); close.onclick = () => d!.close();
      d.append(grid, close);
      document.body.append(d);
    }
    if (d.open) d.close(); else d.showModal();
  }

  // ---------------------------------------------------------------- loading

  /** Scene loads run one at a time (overlapping replaceWorld calls abort each other in X_ITE). */
  serial<T>(f: () => Promise<T>): Promise<T> { const p = this.loads.then(f, f); this.loads = p.catch(() => {}); return p; }

  /** Build the scene from the page's current description and load it into X_ITE and PhysX. */
  load(keepRunning = false) {
    return this.serial(async () => {
      const wasRunning = this.bridge.running;
      const t0 = performance.now();
      const { ir, meta } = this.spec.scene();
      const xml = demoX3D(ir, meta, this.spec.sound);
      const read = await this.bridge.loadString(xml, `${this.spec.fileName()}.x3d`);
      this.ir = ir; this.read = read;
      const snd = this.spec.sound;
      this.sound = snd ? new ImpactSound(X3D, this.bridge.scene, ir, snd.voices, { samples: snd.samples, pick: snd.pick, impulseRange: snd.impulseRange }) : null;
      if (this.sound) { this.sound.enabled = !this.muted; this.sound.volume = this.soundVolume; }
      this.looks = new Looks(X3D, this.browser, this.bridge.scene, ir);
      await this.looks.prepare().catch((e) => console.warn('CubeMapTexturing unavailable', e));
      this.looks.apply(this.look);
      await this.spec.loaded?.(read, ir);
      this.lossReport(read);
      this.loadMs = performance.now() - t0;
      this.labelButton('run', 'Run');
      this.status(`${read.bodyNodes.length} bodies, ${read.jointNodes.length} joints · PhysX ${this.bridge.stats.physxVersion} · loaded in ${this.loadMs.toFixed(0)} ms`);
      if (keepRunning && wasRunning) this.run();
      return read;
    });
  }

  private lossReport(read: ReadResult) {
    const r = read.report;
    $('loss').textContent = `Loss report: ${r.lostAuthored.length} authored fields lost on PhysX; ${r.notes.length} build notes (${r.notes.filter((n) => n.status === 'approximated').length} approximated).`;
    const groups = new Map<string, number>();
    for (const n of r.notes) { const k = `${n.node}.${n.field}: ${n.status}: ${n.how}`; groups.set(k, (groups.get(k) ?? 0) + 1); }
    const dl = el('dl');
    rows(dl, [
      ['fields', Object.entries(r.summary).map(([k, v]) => `${v} ${k}`).join(' · ')],
      ['lost (authored)', r.lostAuthored.length ? r.lostAuthored.map((l) => `${l.def}.${l.field}`).join(', ') : 'none: every field this scene sets is honoured or approximated'],
      ...[...groups].map(([k, c]): [string, string] => [`${c}×`, k]),
    ]);
    $('loss-detail').replaceChildren(dl);
  }

  async toggleMode() {
    if (!this.spec.modes) return;
    await this.setMode(this.mode === 'run' ? this.spec.modes.initial : 'run');
  }
  async setMode(m: string) {
    if (!this.spec.modes) return;
    this.bridge.pause();
    this.mode = m;
    document.body.dataset.mode = m;
    await this.serial(() => this.spec.modes!.enter(m));
    if (m === 'run') await this.load();
  }

  // ---------------------------------------------------------------- run

  run() { this.bridge.run(); this.bridge.speed = SPEEDS[this.speedIndex]; this.labelButton('run', 'Pause'); }
  pause() { this.bridge.pause(); this.labelButton('run', 'Run'); }
  toggleRun() { if (this.mode !== 'run') return; if (this.bridge.running) this.pause(); else this.run(); }
  async step() { if (this.mode === 'run') { this.pause(); await this.bridge.step(4); } }
  async reset() { if (this.mode !== 'run') return; this.pause(); await this.load(); this.status('reset: the scene was rebuilt from its X3D'); }
  setSpeed(d: number) {
    this.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, this.speedIndex + d));
    this.bridge.speed = SPEEDS[this.speedIndex];
    this.status(`speed ×${SPEEDS[this.speedIndex]}${SPEEDS[this.speedIndex] < 1 ? ' (slow motion: physics time runs slower than the wall clock; the X3D clocks follow it)' : ''}`);
  }
  get speed() { return SPEEDS[this.speedIndex]; }

  // ---------------------------------------------------------------- look and sound

  toggleLook() {
    this.look = this.look === 'photoreal' ? 'loom' : 'photoreal';
    this.looks?.apply(this.look);
    this.labelButton('look', this.look === 'photoreal' ? 'Look: photoreal' : 'Look: Loom');
    this.status(this.look === 'photoreal' ? 'photoreal: PhysicalMaterial, image-based light, shadows, PBR-neutral tone mapping' : 'Loom: gold on dark, outlines');
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.sound) this.sound.enabled = !this.muted;
    this.labelButton('mute', this.muted ? 'Sound off' : 'Sound on'); this.setPressed('mute', !this.muted);
  }
  volume(d: number) {
    this.soundVolume = Math.max(0, Math.min(1, +(this.soundVolume + d).toFixed(2)));
    if (this.sound) this.sound.volume = this.soundVolume;
    $('volume').textContent = `volume ${Math.round(this.soundVolume * 100)} %`;
  }

  // ---------------------------------------------------------------- record and replay

  async record() {
    if (this.mode !== 'run') return;
    if (!this.bridge.isRecording) {
      await this.load(); // the run starts from the X3D of the current description (live edits included)
      await this.bridge.startRecording({ demo: this.spec.id, state: this.spec.save() });
      this.labelButton('record', 'Stop recording'); this.buttons.get('record')?.classList.add('rec');
      this.run();
      this.status('recording from the initial state: every step input and state hash');
      return;
    }
    this.pause();
    this.lastRun = this.bridge.stopRecording();
    this.labelButton('record', 'Record'); this.buttons.get('record')?.classList.remove('rec');
    this.setDisabled('replay', !this.lastRun); this.setDisabled('save-run', !this.lastRun);
    const r = this.lastRun!;
    this.status(`recorded ${r.hashes.length} steps (${(r.hashes.length * r.fixedStep).toFixed(2)} s)`);
  }

  async replay() {
    if (this.mode !== 'run' || !this.lastRun || this.bridge.isRecording) return;
    this.pause();
    const log = this.lastRun;
    $('replay-result').textContent = 'replaying…';
    const res = await this.bridge.replay(log, { onProgress: (k) => { if (k % 240 < 8) $('replay-result').textContent = `replaying… step ${k} / ${log.hashes.length}`; } });
    this.replayResult = res;
    $('replay-result').textContent = res.mismatches === 0
      ? `replay: all ${res.steps} step hashes identical (${res.ms.toFixed(0)} ms)`
      : `replay: ${res.mismatches} of ${res.steps} step hashes differ, first at step ${res.firstMismatch}`;
    return res;
  }

  saveRun() {
    if (!this.lastRun) return;
    this.download(JSON.stringify(this.lastRun), `run-${this.spec.fileName()}-${this.lastRun.hashes.length}-steps.json`, 'application/json');
  }

  async loadRun(text: string) {
    let log: RunLog;
    try { log = JSON.parse(text); } catch { this.status('not a run file'); return; }
    if (log?.format !== 'x3d-physx-run/1' || !Array.isArray(log.messages) || !log.model) { this.status('not an x3d-physx run file'); return; }
    const ctx = log.context as { demo?: string; state?: unknown } | undefined;
    if (ctx?.demo !== this.spec.id) { this.status(`this run was recorded on another page (${ctx?.demo ?? 'unknown'})`); return; }
    const err = await this.spec.restore(ctx.state);
    if (err) { this.status(`run file: ${err}`); return; }
    if (this.mode !== 'run') await this.setMode('run'); else await this.load();
    this.lastRun = log;
    this.setDisabled('replay', false); this.setDisabled('save-run', false);
    this.status(`loaded a run of ${log.hashes.length} steps recorded in ${log.recordedIn.match(/(Firefox|Chrome|Version)\/[\d.]+/)?.[0] ?? 'a browser'}`);
    return this.replay();
  }

  // ---------------------------------------------------------------- files

  exportX3D() {
    const { ir, meta } = this.spec.exportScene?.() ?? this.spec.scene();
    const xml = toX3D(ir, { mode: 'run', meta: { ...meta, metaName: META_NAME, metaValue: { demo: this.spec.id, state: this.spec.save() } } });
    this.download(xml, `${this.spec.fileName()}.x3d`, 'model/x3d+xml');
    this.status(`exported ${this.spec.fileName()}.x3d (${(xml.length / 1024).toFixed(0)} KB, standard X3D 4.0)`);
    return xml;
  }

  async importX3D(text: string) {
    const v = readMeta(text, META_NAME) as { demo?: string; state?: unknown } | null;
    if (!v || v.demo !== this.spec.id) { this.status(`import: only files exported by this page carry its description${v?.demo ? ` (this one is from ${v.demo})` : ''}`); return false; }
    const err = await this.spec.restore(v.state);
    if (err) { this.status(`import: ${err}`); return false; }
    if (this.spec.modes && this.mode !== 'run') await this.serial(() => this.spec.modes!.enter(this.mode)); else await this.load();
    this.status('imported');
    return true;
  }

  download(text: string, name: string, type: string) {
    const a = el('a', '', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.getAttribute('href')!), 1000);
  }

  private pick(accept: string, f: (text: string) => unknown) {
    const i = el('input', '', { type: 'file', accept }) as HTMLInputElement;
    i.onchange = async () => { const file = i.files?.[0]; if (file) await f(await file.text()); };
    i.click();
  }

  // ---------------------------------------------------------------- counters

  private tick() {
    if (this.read && this.mode === 'run') {
      const b = this.bridge;
      rows($('counters'), [
        ...(this.spec.counters?.() ?? []),
        ['time', `${b.stats.simTime.toFixed(2)} s · ×${this.speed}`],
        ['physics', `${(b.stats.physicsMsPerStep * 1000).toFixed(0)} µs/step · ${b.stats.stepsPerSecond} steps/s`],
        ['frame', `${this.browser.currentFrameRate.toFixed(0)} fps`],
      ]);
    }
    setTimeout(() => this.tick(), 100);
  }

  /** Load the first scene and start the counters. */
  async start() {
    try {
      if (this.spec.modes && this.mode !== 'run') await this.serial(() => this.spec.modes!.enter(this.mode));
      else await this.load();
      this.ready = true;
      this.tick();
    } catch (e) {
      this.error = String((e as Error)?.stack ?? e); this.status(`error: ${e}`); console.error(e);
    }
  }

  /** Bind a Viewpoint by DEF name. */
  view(def: string) { try { this.bridge.scene.getNamedNode(def).set_bind = true; } catch { /* not in this scene */ } }
}

/** Read a page description back from an exported file (the WorldInfo MetadataString). */
export function readMeta(text: string, name: string): unknown {
  const tag = text.match(new RegExp(`<MetadataString[^>]*name="${name}"[^>]*>`));
  const val = tag?.[0].match(/value='([^']*)'/);
  if (!val) return null;
  const attr = val[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const inner = attr.trim().replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  try { return JSON.parse(inner); } catch { return null; }
}

export { xmlEscape };
