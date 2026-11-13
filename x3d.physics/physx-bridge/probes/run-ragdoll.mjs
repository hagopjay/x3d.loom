// Phase-1 ragdoll in a real browser: the H-Anim dummy loads as an articulation, drops, gets shoved; frame and physics timing; screenshots.
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch({ ...(which === 'chromium' ? { channel: 'chromium' } : {}) });
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5181/'}ragdoll.html`);
await page.waitForFunction(() => window.__demo?.ready || window.__demo?.error, null, { timeout: 90000 });
if (await page.evaluate(() => window.__demo.error)) { console.log(await page.evaluate(() => window.__demo.error)); process.exit(1); }
const loaded = await page.evaluate(() => ({ links: window.__rag.links, status: document.getElementById('status').textContent, notes: window.__demo.bridge.report.notes.filter((n) => /HAnim/.test(n.node)).map((n) => `${n.node}.${n.field}: ${n.status}`) }));
await page.screenshot({ path: `evidence/ragdoll-p1-standing-${which}.png` });
await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
await page.keyboard.press('d');
await page.waitForTimeout(700);
await page.screenshot({ path: `evidence/ragdoll-p1-falling-${which}.png` });
await page.waitForTimeout(3500);
await page.screenshot({ path: `evidence/ragdoll-p1-landed-${which}.png` });
const landed = await page.evaluate(() => { const st = window.__demo.bridge.lastState, o = window.__rag.root * 13; return { rootY: +st[o + 1].toFixed(3), fps: Math.round(window.__demo.browser.currentFrameRate), physUs: Math.round(window.__demo.bridge.stats.physicsMsPerStep * 1000), sps: window.__demo.bridge.stats.stepsPerSecond, impacts: window.__demo.bridge.stats.newContacts }; });
// the H-Anim side: a joint's rotation field follows physics
const hanim = await page.evaluate(() => { const sc = window.__demo.bridge.scene, k = sc.getNamedNode('hanim_l_knee').rotation, hum = sc.getNamedNode('Dummy'); return { lKneeAngle: +k.angle.toFixed(3), humanoidY: +hum.translation.y.toFixed(3) }; });
await page.keyboard.press('t');
await page.waitForTimeout(2500);
await page.screenshot({ path: `evidence/ragdoll-p1-shoved-${which}.png` });
// replay: record a drop (state hashes now include the ragdoll's links), replay it, compare every step
await page.keyboard.press('c');
await page.waitForFunction(() => window.__demo.bridge.isRecording, null, { timeout: 30000 });
await page.keyboard.press('d');
await page.waitForFunction(() => window.__demo.bridge.stats.simTime > 2.5, null, { timeout: 60000 });
await page.keyboard.press('c');
await page.waitForFunction(() => window.__demo.lastRun, null, { timeout: 30000 });
const replay = await page.evaluate(() => window.__demo.replay());
// the model the bridge read from the X3D against the one Node builds from the same description (tolerance 1e-5)
const sameModel = await page.evaluate(async () => {
  const { stageModel } = await import('/src/ragdoll/stage.ts');
  const node = stageModel(window.__rag.stage).humanoids[0], read = window.__demo.bridge.model.humanoids[0];
  const diffs = [];
  const cmp = (a, b, path) => {
    if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-5) diffs.push(`${path}: ${a} vs ${b}`); return; }
    if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) { diffs.push(`${path}: length ${a.length} vs ${b.length}`); return; } a.forEach((x, i) => cmp(x, b[i], `${path}[${i}]`)); return; }
    if (a && b && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!['def', 'name', 'from'].includes(k)) cmp(a[k], b[k], `${path}.${k}`); return; }
    if (a !== b) diffs.push(`${path}: ${a} vs ${b}`);
  };
  cmp(read.links, node.links, 'links');
  return { links: read.links.length, shapes: read.links.reduce((n, l) => n + l.shapes.length, 0), diffs: diffs.slice(0, 12), diffCount: diffs.length };
});
const out = { browser: which, version: browser.version(), loaded, landed, hanim, replay, sameModel, errors };
console.log(JSON.stringify(out));
writeFileSync(`evidence/ragdoll-p1-${which}.json`, JSON.stringify(out, null, 1));
await browser.close();
