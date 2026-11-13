// Performance of the full default machine (93 bodies: 20 marbles, 40 dominoes, every piece type).
// A) physics alone: drop 20, then step the worker 1200 steps as fast as it goes (no frame pacing), per contact-report mode;
// B) real time: run 15 s after Drop 20 and sample X_ITE's frame rate and the bridge's physics time.
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium', headed = ''] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch({ ...(which === 'chromium' ? { channel: 'chromium' } : {}), headless: headed !== 'headed' });
const out = { browser: which, version: browser.version(), headed: headed === 'headed', physicsOnly: {}, realtime: null };
for (const contacts of ['all', 'none']) {
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5181/'}machine.html?contacts=${contacts}`);
  await page.waitForFunction(() => window.__mm?.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__mm.enterRun());
  await page.waitForFunction(() => window.__mm.mode === 'run' && window.__mm.bridge.lastState, null, { timeout: 60000 });
  out.physicsOnly[contacts] = await page.evaluate(async () => {
    const b = window.__mm.bridge;
    const st = b.lastState; const marbles = window.__mm.marbles;
    marbles.forEach((i, k) => b.teleport(i, [(k % 2 ? 0.52 : -0.52) + ((k >> 1) % 3 - 1) * 0.008, 1.0 + 0.02 * (k >> 1), 0]));
    void st;
    const t0 = performance.now(); let worker = 0;
    for (let k = 0; k < 50; k++) { const ev = await b.step(24); worker += b.stats.lastPhysicsMs; void ev; }
    return { steps: 1200, wallMsPerStep: +((performance.now() - t0) / 1200).toFixed(3), workerMsPerStep: +(worker / 1200).toFixed(3), simulatedSeconds: 5 };
  });
  await page.close();
}
{
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5181/'}machine.html`);
  await page.waitForFunction(() => window.__mm?.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__mm.enterRun());
  await page.waitForFunction(() => window.__mm.mode === 'run' && window.__mm.bridge.lastState, null, { timeout: 60000 });
  await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('0');
  const samples = []; const t0 = Date.now();
  while (Date.now() - t0 < 15000) { await page.waitForTimeout(1000); samples.push(await page.evaluate(() => ({ fps: +window.__mm.bridge.browser.currentFrameRate.toFixed(1), raf: window.__frames, physUs: Math.round(window.__mm.bridge.stats.physicsMsPerStep * 1000), stepsPerSec: window.__mm.bridge.stats.stepsPerSecond, sim: +window.__mm.bridge.stats.simTime.toFixed(2) }))); }
  const fps = samples.slice(2).map((s) => s.fps), raf = (samples.at(-1).raf - samples[1].raf) / (samples.length - 2);
  out.realtime = { seconds: 15, simulated: samples.at(-1).sim, x3dFpsMedian: fps.sort((a, b) => a - b)[Math.floor(fps.length / 2)], x3dFpsMin: Math.min(...fps), rafPerSecond: +raf.toFixed(1), physicsUsPerStepLast: samples.at(-1).physUs, stepsPerSecond: samples.map((s) => s.stepsPerSec) };
  await page.close();
}
writeFileSync(`evidence/p5-perf-${which}${headed === 'headed' ? '-headed' : ''}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
await browser.close();
