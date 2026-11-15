// Node harness: the real reader in a vm (as x3d.webgpu/bridge/tools/test-dom.js), plus the engines. No browser, no GPU.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const HERE = path.resolve(__dirname, '..'), LOOM = path.resolve(HERE, '..', '..');
const BRIDGE = path.join(LOOM, 'x3d.webgpu', 'bridge');
const { DOMParser } = require(path.join(BRIDGE, 'tools', 'test-dom.js'));
const bundle = require(path.join(BRIDGE, 'tools', 'bundle.js'));
const RAPIER = require('@dimforge/rapier3d-compat'), CANNON = require('cannon-es');
let rapierReady = null;
async function load() {
  if (!rapierReady) rapierReady = RAPIER.init();
  await rapierReady;
  const sandbox = { DOMParser, console, location: { href: 'https://example.invalid/test/' }, performance: require('node:perf_hooks').performance, setTimeout, clearTimeout, document: { getElementById() { return null; } }, __physLibs: { RAPIER, CANNON } };
  sandbox.window = sandbox; vm.createContext(sandbox);
  vm.runInContext(bundle('reader'), sandbox);
  for (const f of ['engines.js', 'engine-rapier.js', 'engine-cannon.js']) vm.runInContext(fs.readFileSync(path.join(HERE, 'src', f), 'utf8'), sandbox, { filename: f });
  return { R: sandbox.__R, X3DSAI: sandbox.X3DSAI, BR: sandbox.__bridge, sandbox };
}
// a scene driven by hand: open(xml) then step(dt) advances the SAI clock and ticks every RigidBodyCollection
async function openScene(xml, engine, opts = {}) {
  const ctx = await load(), { R, X3DSAI, BR } = ctx;
  BR.physEngines.use(engine, opts); let ts = 1000;
  const scene = await X3DSAI.B.createX3DFromString(xml);
  const tickTo = (dt) => { R.events.begin(ts += dt); R.events.drain(); };
  return { ...ctx, scene, ts: () => ts, advance: (dt) => tickTo(dt), nodes: () => R.bridge.worlds.flatMap((w) => w.nodes), node: (def) => R.bridge.worlds.flatMap((w) => w.nodes).find((n) => n.def === def) };
}
module.exports = { load, openScene, RAPIER, CANNON, HERE, LOOM, BRIDGE };
