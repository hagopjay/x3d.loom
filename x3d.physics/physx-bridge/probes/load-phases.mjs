import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
await p.goto('http://127.0.0.1:5181/galton.html');
await p.waitForFunction(() => window.__demo?.ready, null, { timeout: 60000 });
const r = await p.evaluate(async () => {
  const d = window.__demo, br = d.bridge, t = {};
  const { ir, meta } = d.spec.scene();
  let t0 = performance.now();
  const { demoX3D } = await import('/src/demos/shell.ts');
  const xml = demoX3D(ir, meta, d.spec.sound); t.emit = performance.now() - t0; t.kb = xml.length / 1024;
  t0 = performance.now(); const scene = await br.browser.createX3DFromString(xml); t.parse = performance.now() - t0;
  t0 = performance.now(); await br.browser.replaceWorld(scene); t.replace = performance.now() - t0;
  t0 = performance.now(); await d.load(); t.fullLoad = performance.now() - t0; t.workerBuild = br.stats.buildMs;
  return t;
});
console.log(JSON.stringify(r));
await b.close();
