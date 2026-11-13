// usage: node probes/run-sbs.mjs [browser] [seconds] [scene]  -- runs the side-by-side page, saves a screenshot and the trajectory log
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium', secs = '4', scene = ''] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch(which === 'chromium' ? { channel: 'chromium' } : {});
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1400, height: 900 } });
const logs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); }); page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'sidebyside.html' + (scene ? '?scene=' + scene : ''));
await page.waitForFunction(() => window.__sbs?.ready || window.__sbs?.error, null, { timeout: 60000 });
const err = await page.evaluate(() => window.__sbs.error);
if (err) { console.log('ERROR', err, logs); process.exit(1); }
await page.screenshot({ path: `evidence/p1-sidebyside-${which}-t0.png` });
await page.keyboard.press('Space');
await page.waitForTimeout(700);
await page.screenshot({ path: `evidence/p1-sidebyside-${which}-mid.png` });
await page.waitForTimeout(Number(secs) * 1000 - 700);
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.screenshot({ path: `evidence/p1-sidebyside-${which}-end.png` });
const out = await page.evaluate(() => {
  const S = window.__sbs; const b = S.bridge;
  return { dynamic: S.dynamic, stats: b.stats, samples: S.log.length, log: S.log.filter((_, i) => i % 3 === 0).map((s) => ({ wall: +s.wall.toFixed(4), pxTime: +s.pxTime.toFixed(4), px: s.px[0].map((x) => +x.toFixed(5)), bt: s.bt[0].map((x) => +x.toFixed(5)) })),
    report: { lostAuthored: b.report.lostAuthored, notes: b.report.notes, summary: b.report.summary } };
});
const ua = await page.evaluate(() => navigator.userAgent);
writeFileSync(`evidence/p1-sidebyside-${which}.json`, JSON.stringify({ browser: which, version: browser.version(), ua, seconds: Number(secs), ...out, consoleErrors: logs }, null, 1));
const last = out.log[out.log.length - 1];
console.log(which, browser.version(), 'samples', out.samples, 'stats', JSON.stringify(out.stats));
console.log('final PhysX', last?.px, 'Bullet', last?.bt);
console.log('notes', JSON.stringify(out.report.notes), '\nlostAuthored', JSON.stringify(out.report.lostAuthored), '\nconsole', logs.slice(0, 8));
await browser.close();
