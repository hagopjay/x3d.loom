// The barrage in a real browser: fire all three, follow, castle shots, damage numbers.
import { chromium, firefox, webkit } from 'playwright';
const name = process.env.BROWSER ?? 'chromium';
import { writeFileSync } from 'node:fs';
const b = await ({ chromium, firefox, webkit })[name].launch(name === 'chromium' ? { channel: 'chromium' } : {}); const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await p.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'barrage.html');
await p.waitForFunction(() => window.__demo?.ready || window.__demo?.error, null, { timeout: 120000 });
if (await p.evaluate(() => window.__demo.error)) { console.log(await p.evaluate(() => window.__demo.error)); process.exit(1); }
await p.waitForTimeout(1500);
await p.screenshot({ path: `evidence/barrage-ready${name === 'chromium' ? '' : '-' + name}.png` });
await p.locator('#canvas').click({ position: { x: 5, y: 5 } });
await p.keyboard.press('a');
await p.waitForFunction(() => window.__bar.lanes.some((l) => l.phase === 'flying'), null, { timeout: 60000 });
await p.waitForTimeout(1200); await p.screenshot({ path: `evidence/barrage-flight${name === 'chromium' ? '' : '-' + name}.png` });
await p.waitForFunction(() => window.__bar.lanes.every((l) => l.phase === 'landed'), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(3000);
await p.evaluate(() => window.__demo.view('Castle'));
await p.waitForTimeout(800); await p.screenshot({ path: `evidence/barrage-castle${name === 'chromium' ? '' : '-' + name}.png` });
for (let k = 0; k < 4 && (await p.evaluate(() => window.__bar.view)) !== 3; k++) await p.keyboard.press('v'); await p.waitForTimeout(1800); await p.screenshot({ path: `evidence/barrage-heat${name === 'chromium' ? '' : '-' + name}.png` });
const r = await p.evaluate(() => ({ damage: window.__bar.damage, stones: window.__bar.blocks.length, lanes: window.__bar.lanes.map((l) => ({ phase: l.phase, ouch: l.ouch.total, hic: Math.round(l.crash.hic), worst: l.crash.worst(2).map((w) => `${w.segment} ${Math.round(w.g)} g`) })), fps: Math.round(window.__demo.browser.currentFrameRate), physUs: Math.round(window.__demo.bridge.stats.physicsMsPerStep * 1000), load: document.getElementById('status').textContent }));
console.log(JSON.stringify({ ...r, errors }));
writeFileSync(`evidence/barrage-${name}.json`, JSON.stringify({ browser: name, ...r, errors }, null, 1));
await b.close();
