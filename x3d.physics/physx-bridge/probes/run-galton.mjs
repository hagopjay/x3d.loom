// The Galton board in a real browser: pour all beads, shake, read the histogram statistics; tilt and pour again; screenshots.
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch({ ...(which === 'chromium' ? { channel: 'chromium' } : {}) });
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5181/'}galton.html`);
await page.waitForFunction(() => window.__demo?.ready || window.__demo?.error, null, { timeout: 60000 });
if (await page.evaluate(() => window.__demo.error)) { console.log(await page.evaluate(() => window.__demo.error)); process.exit(1); }
await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
await page.keyboard.press('o');
await page.waitForTimeout(6000);
await page.screenshot({ path: `evidence/galton-pouring-${which}.png` });
await page.waitForFunction(() => !window.__galton.pouring, null, { timeout: 120000 });
await page.waitForTimeout(3000);
await page.keyboard.press('h');
await page.waitForTimeout(3000);
const level = await page.evaluate(() => ({ ...window.__galton.stats, bins: window.__galton.bins, sim: window.__demo.bridge.stats.simTime, physUs: window.__demo.bridge.stats.physicsMsPerStep * 1000, stepsPerSecond: window.__demo.bridge.stats.stepsPerSecond, fps: window.__demo.browser.currentFrameRate, ticks: window.__demo.sound?.triggered }));
await page.screenshot({ path: `evidence/galton-${which}.png` });
// tilt 8° right and pour again
await page.keyboard.press('r');
await page.waitForFunction(() => window.__galton.stats && window.__galton.stats.binned === 0, null, { timeout: 30000 });
for (let k = 0; k < 4; k++) await page.keyboard.press(']');
await page.keyboard.press('o');
await page.waitForFunction(() => !window.__galton.pouring, null, { timeout: 120000 });
await page.waitForTimeout(3000); await page.keyboard.press('h'); await page.waitForTimeout(3000);
const tilted = await page.evaluate(() => ({ tilt: window.__galton.g.tilt, ...window.__galton.stats, bins: window.__galton.bins }));
await page.screenshot({ path: `evidence/galton-tilt-${which}.png` });
const out = { browser: which, version: browser.version(), level, tilted, errors };
console.log(JSON.stringify(out));
writeFileSync(`evidence/galton-${which}.json`, JSON.stringify(out, null, 1));
await browser.close();
