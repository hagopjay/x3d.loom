// usage: node probes/run-machine.mjs [browser] -- smoke test of the Marble Machine page: build view, run, drop marbles, screenshots
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium', secs = '12'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch(which === 'chromium' ? { channel: 'chromium' } : {});
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const logs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); }); page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'machine.html');
await page.waitForFunction(() => window.__mm?.ready || window.__mm?.error, null, { timeout: 60000 });
const err = await page.evaluate(() => window.__mm.error); if (err) { console.log('ERROR', err, logs); process.exit(1); }
await page.waitForTimeout(800);
await page.screenshot({ path: `evidence/p3-machine-${which}-build.png` });
await page.keyboard.press('Tab');
await page.waitForFunction(() => window.__mm.mode === 'run' && window.__mm.bridge.lastState, null, { timeout: 60000 });
await page.waitForTimeout(500);
await page.keyboard.press('0'); // drop 20
const t0 = Date.now(); const samples = [];
const dominoAngles = () => page.evaluate(() => { const sc = window.__mm.bridge.scene; const a = (re) => window.__mm.bridge.readResult.bodyNodes.filter((n) => re.test(n.getNodeName())).map((n) => +n.orientation.angle.toFixed(2)); return { row1: a(/^P31Domino\d+Body$/), row2: a(/^P33Domino\d+Body$/) }; });
const extra = {};
while (Date.now() - t0 < Number(secs) * 1000) {
  await page.waitForTimeout(1000);
  samples.push(await page.evaluate(() => ({ ...window.__mm.counters })));
  if (samples.length === 4) await page.screenshot({ path: `evidence/p3-machine-${which}-run.png` });
  if (samples.length === 5) { extra.beforeFlip = await dominoAngles(); await page.keyboard.down('f'); await page.waitForTimeout(400); await page.keyboard.up('f'); await page.keyboard.press('l'); }
  if (samples.length === 7) extra.afterFlip = await dominoAngles();
}
await page.screenshot({ path: `evidence/p3-machine-${which}-end.png` });
const out = await page.evaluate(() => ({ stats: window.__mm.bridge.stats, report: { lost: window.__mm.bridge.report.lostAuthored.length, notes: window.__mm.bridge.report.notes.length } }));
writeFileSync(`evidence/p3-machine-${which}.json`, JSON.stringify({ browser: which, version: browser.version(), samples, extra, ...out, consoleErrors: logs }, null, 1));
const fallen = (a) => a ? a.filter((x) => x > 0.5).length + '/' + a.length : '-';
console.log('dominoes fallen (|angle| > 0.5 rad): row1 before flip', fallen(extra.beforeFlip?.row1), 'row2 before flip', fallen(extra.beforeFlip?.row2), '| after flip: row1', fallen(extra.afterFlip?.row1), 'row2', fallen(extra.afterFlip?.row2));
console.log(which, browser.version(), JSON.stringify(samples[samples.length - 1]), JSON.stringify(out.stats));
console.log('console', logs.filter((l) => !l.includes('getField')).slice(0, 8));
await browser.close();
