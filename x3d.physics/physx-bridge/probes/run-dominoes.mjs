// Dominoes in a real browser: draw a stroke with the mouse on the table (PlaneSensor), then the spiral preset; run, push, time the wave.
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch({ ...(which === 'chromium' ? { channel: 'chromium' } : {}) });
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5181/'}dominoes.html`);
await page.waitForFunction(() => window.__demo?.ready || window.__demo?.error, null, { timeout: 60000 });
if (await page.evaluate(() => window.__demo.error)) { console.log(await page.evaluate(() => window.__demo.error)); process.exit(1); }
await page.keyboard.press('x');
await page.waitForTimeout(300);
// draw an S-curve with the mouse across the stage
const box = await page.locator('#canvas').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx - 300, cy + 120); await page.mouse.down();
for (let k = 0; k <= 60; k++) { const u = k / 60; await page.mouse.move(cx - 300 + 600 * u, cy + 120 - 200 * u + 60 * Math.sin(u * 6.28), { steps: 2 }); }
await page.mouse.up();
await page.waitForTimeout(400);
const drawn = await page.evaluate(() => ({ strokes: window.__dom.run.strokes.length, dominoes: window.__dom.ds.length, pts: window.__dom.run.strokes[0]?.path.length }));
await page.screenshot({ path: `evidence/dominoes-draw-${which}.png` });
await page.keyboard.press('Tab');
await page.waitForFunction(() => window.__demo.mode === 'run' && window.__demo.read && window.__dom.fall.length === window.__dom.ds.length, null, { timeout: 60000 });
await page.keyboard.press('t');
const dump = () => page.evaluate(() => ({ mode: window.__demo.mode, ds: window.__dom.ds.length, fallen: window.__dom.fall.filter((x) => x !== undefined).length, pushedAt: window.__dom.pushedAt, running: window.__demo.bridge.running, t: window.__demo.bridge.stats.simTime, status: document.getElementById('status').textContent }));
await page.waitForFunction(() => window.__dom.recorded, null, { timeout: 30000 }).catch(async (e) => { console.log('STATE', JSON.stringify(await dump())); await page.screenshot({ path: '/tmp/dom-fail.png' }); throw e; });
const drawnRun = await page.evaluate(() => ({ fallen: window.__dom.fall.filter((x) => x !== undefined).length, of: window.__dom.ds.length, exp: window.__dom.experiments.at(-1), clacks: window.__dom.clacks }));
// the spiral, followed by the chase camera, screenshot mid-wave
await page.keyboard.press('2');
await page.waitForFunction(() => window.__dom.fall.length === window.__dom.ds.length && window.__dom.ds.length > 100 && window.__demo.read && window.__dom.pushedAt < 0, null, { timeout: 60000 });
await page.keyboard.press('t');
await page.waitForTimeout(2500);
await page.screenshot({ path: `evidence/dominoes-run-${which}.png` });
await page.keyboard.press('f');
await page.waitForTimeout(1500);
await page.screenshot({ path: `evidence/dominoes-follow-${which}.png` });
await page.waitForFunction(() => window.__dom.recorded, null, { timeout: 90000 });
const spiral = await page.evaluate(() => ({ fallen: window.__dom.fall.filter((x) => x !== undefined).length, of: window.__dom.ds.length, exp: window.__dom.experiments.at(-1), physUs: window.__demo.bridge.stats.physicsMsPerStep * 1000, fps: window.__demo.browser.currentFrameRate, triggered: window.__demo.sound?.triggered }));
const out = { browser: which, version: browser.version(), drawn, drawnRun, spiral, errors };
console.log(JSON.stringify(out));
writeFileSync(`evidence/dominoes-${which}.json`, JSON.stringify(out, null, 1));
await browser.close();
