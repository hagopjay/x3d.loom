// The music box in a real browser: load Twinkle, play ~2 turns, count struck notes against the pegs, toggle a peg live, screenshot.
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch({ ...(which === 'chromium' ? { channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] } : {}) });
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5181/'}musicbox.html`);
await page.waitForFunction(() => window.__demo?.ready || window.__demo?.error, null, { timeout: 60000 });
const err = await page.evaluate(() => window.__demo.error);
if (err) { console.log('ERROR', err); process.exit(1); }
const pegs = await page.evaluate(() => window.__mb.box.grid.join('').split('x').length - 1);
await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
await page.keyboard.press('Space');
await page.waitForFunction(() => window.__mb.revolutions >= 2, null, { timeout: 30000 });
const twoTurns = await page.evaluate(() => ({ notes: window.__mb.notes, revs: window.__mb.revolutions, t: window.__demo.bridge.stats.simTime }));
// live edit: pull every peg, then count notes during one more turn
await page.evaluate(() => { for (const b of document.querySelectorAll('#seq button.cell[aria-pressed="true"]')) b.click(); });
const n0 = await page.evaluate(() => window.__mb.notes), r0 = await page.evaluate(() => window.__mb.revolutions);
await page.waitForFunction((r) => window.__mb.revolutions >= r + 1, r0, { timeout: 30000 });
const afterPull = await page.evaluate((n) => window.__mb.notes - n, n0);
await page.keyboard.press('1'); // Twinkle back, live
await page.waitForTimeout(1500);
await page.screenshot({ path: `evidence/musicbox-${which}.png` });
const stats = await page.evaluate(() => ({ fps: window.__demo.browser.currentFrameRate, physUs: window.__demo.bridge.stats.physicsMsPerStep * 1000, triggered: window.__demo.sound?.triggered, skipped: window.__demo.sound?.skipped, nonFinite: window.__demo.sound?.nonFinite.length }));
const out = { browser: which, version: browser.version(), pegs, twoTurns, notesDuringTurnWithNoPegs: afterPull, stats, errors };
console.log(JSON.stringify(out));
writeFileSync(`evidence/musicbox-${which}.json`, JSON.stringify(out, null, 1));
await browser.close();
