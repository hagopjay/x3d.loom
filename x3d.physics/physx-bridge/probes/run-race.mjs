// The race: PhysX (bridge) and X_ITE's Bullet ghosts in one view; Drop 20; sample the readout; screenshots.
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium', secs = '16'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch(which === 'chromium' ? { channel: 'chromium' } : {});
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 1000 } });
const logs = []; page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); }); page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'machine.html');
await page.waitForFunction(() => window.__mm?.ready, null, { timeout: 60000 });
await page.evaluate(async () => { await window.__mm.enterRun(); await window.__mm.toggleRace(); });
await page.waitForFunction(() => window.__mm.ghost, null, { timeout: 60000 });
await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
await page.keyboard.press('0');
const samples = []; const t0 = Date.now();
while (Date.now() - t0 < Number(secs) * 1000) { await page.waitForTimeout(1000); samples.push(await page.evaluate(() => ({ t: +window.__mm.bridge.stats.simTime.toFixed(2), ...window.__mm.raceNow }))); if (samples.length === 5) await page.screenshot({ path: `evidence/p4-race-${which}-run.png` }); }
await page.keyboard.press(' ');
await page.waitForTimeout(500);
await page.screenshot({ path: `evidence/p4-race-${which}-end.png` });
const series = await page.evaluate(() => [...window.__mm.raceSeries.values()].map((s) => ({ t: s.t, d: s.d.map((x) => +x.toFixed(4)) })));
writeFileSync(`evidence/p4-race-${which}.json`, JSON.stringify({ browser: which, version: browser.version(), samples, series, errors: logs }, null, 1));
console.log(which, browser.version()); for (const s of samples.filter((_, i) => i % 3 === 0 || i === samples.length - 1)) console.log(' ', JSON.stringify(s));
console.log(' errors', logs.slice(0, 5));
await browser.close();
