// Side by side: the same standard X3D file on PhysX (through the bridge) and on X_ITE's built-in Bullet.
import { X3DPhysXBridge } from '../bridge/bridge.ts';
import { disableCollections } from '../bridge/reader.ts';
import { SceneClocks } from '../bridge/clocks.ts';
import { BODY_STRIDE } from '../bridge/model.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const X3D = (window as any).X3D;
const params = new URLSearchParams(location.search);
const url = new URL(params.get('scene') ?? 'scenes/marble-minimal.x3d', location.href).href;
const $ = (id: string) => document.getElementById(id)!;

/** Fill a <dl> from [term, value] rows with text nodes only (DEF names come from scene files). */
function rows(el: HTMLElement, data: [string, string][]) {
  el.replaceChildren(...data.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
}
function label(btn: HTMLElement, text: string, key: string) {
  const kbd = document.createElement('kbd'); kbd.textContent = key;
  btn.replaceChildren(document.createTextNode(text + ' '), kbd);
}

interface Sample { wall: number; pxTime: number; px: number[][]; bt: number[][] }
const S = {
  ready: false, running: false, startWall: 0, log: [] as Sample[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bridge: null as X3DPhysXBridge | null, btScene: null as any, dynamic: [] as { index: number; def: string }[],
  btClocks: new SceneClocks(),
  error: '' as string,
};
(window as unknown as { __sbs: typeof S }).__sbs = S;

const bridge = new X3DPhysXBridge(X3D, $('px'), { fixedStep: 1 / 240, clocksFollowPhysics: true });
S.bridge = bridge;
const bt = ($('bt') as unknown as { browser: { createX3DFromURL: (u: unknown) => Promise<unknown>; replaceWorld: (s: unknown) => Promise<void>; currentFrameRate: number; currentTime: number } }).browser;

async function loadBoth() {
  S.ready = false; S.running = false; S.log = [];
  label($('run'), 'Run', 'Space');
  const read = await bridge.load(url);
  S.dynamic = read.model.collections.flatMap((c) => c.bodies.filter((b) => !b.fixed && b.enabled).map((b) => ({ index: b.index, def: b.def })));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = await bt.createX3DFromURL(new X3D.MFString(url));
  disableCollections(s); // held until Run, so both start together
  await bt.replaceWorld(s);
  await S.btClocks.hold(s); // its clocks follow physics too, as the bridge's do
  S.btScene = s;
  $('px-version').textContent = `${bridge.stats.physxVersion} · wasm ${bridge.stats.wasmLoadMs.toFixed(0)} ms · build ${bridge.stats.buildMs.toFixed(1)} ms`;
  $('scene-name').textContent = `${url.split('/').pop()} · ${S.dynamic.length} dynamic of ${read.bodyNodes.length} bodies · ${read.report.lostAuthored.length} authored fields lost on PhysX`;
  $('loss').textContent = JSON.stringify(read.report, null, 1);
  S.ready = true;
  render();
}

function setBulletEnabled(on: boolean) {
  for (const c of bridge.model!.collections) S.btScene.getNamedNode(c.def).enabled = on && c.enabled;
}

function run() {
  if (!S.ready) return;
  if (S.running) { bridge.pause(); setBulletEnabled(false); S.btClocks.pause(); S.running = false; label($('run'), 'Run', 'Space'); return; }
  S.running = true; label($('run'), 'Pause', 'Space');
  if (!S.startWall) S.startWall = performance.now();
  S.btClocks.start(); bridge.run(); setBulletEnabled(true);
}

async function reset() { bridge.pause(); S.running = false; S.startWall = 0; await loadBoth(); }

const fmt = (v: number[]) => v.map((x) => x.toFixed(3)).join(' ');
function positions() {
  const st = bridge.lastState;
  const px = S.dynamic.map((d) => (st ? Array.from(st.subarray(d.index * BODY_STRIDE, d.index * BODY_STRIDE + 3)) : [0, 0, 0]));
  const btp = S.dynamic.map((d) => { const p = S.btScene?.getNamedNode(d.def).position; return p ? [p.x, p.y, p.z] : [0, 0, 0]; });
  return { px, bt: btp };
}

function render() {
  const { px, bt: btp } = positions();
  const st = bridge.stats;
  rows($('px-readout'), [
    ['sim time', `${st.simTime.toFixed(3)} s · ${st.stepCount} steps`],
    ['physics', `${(st.physicsMsPerStep * 1000).toFixed(0)} µs/step · ${st.stepsPerSecond} steps/s`],
    ...S.dynamic.slice(0, 3).map((d, i): [string, string] => [d.def, fmt(px[i])]),
  ]);
  rows($('bt-readout'), [
    ['frame rate', `${bt.currentFrameRate.toFixed(0)} fps (step = 1/fps)`],
    ['wall time', `${S.startWall ? ((performance.now() - S.startWall) / 1000).toFixed(3) : '0.000'} s`],
    ...S.dynamic.slice(0, 3).map((d, i): [string, string] => [d.def, fmt(btp[i])]),
  ]);
  if (S.dynamic.length) {
    const d = Math.hypot(px[0][0] - btp[0][0], px[0][1] - btp[0][1], px[0][2] - btp[0][2]);
    $('divergence').textContent = `${S.dynamic[0].def}: PhysX ↔ Bullet ${(d * 1000).toFixed(1)} mm apart`;
  }
}

function frame() {
  if (S.ready) {
    render();
    if (S.running) {
      const { px, bt: btp } = positions();
      S.log.push({ wall: (performance.now() - S.startWall) / 1000, pxTime: bridge.stats.simTime, px, bt: btp });
    }
  }
  requestAnimationFrame(frame);
}

$('run').onclick = run;
$('reset').onclick = () => void reset();
$('step').onclick = () => { if (S.ready && !S.running) void bridge.step(4).then(render); };
$('report').onclick = () => { $('loss').hidden = !$('loss').hidden; };
addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); run(); } else if (k === 'r') void reset(); else if (k === 's') $('step').click(); else if (k === 'l') $('report').click();
});

loadBoth().catch((e) => { S.error = String(e?.stack ?? e); console.error(e); });
requestAnimationFrame(frame);
