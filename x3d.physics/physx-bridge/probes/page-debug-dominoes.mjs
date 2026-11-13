import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 300)); });
await p.goto('http://127.0.0.1:5181/dominoes.html');
await p.waitForFunction(() => window.__demo?.ready);
await p.keyboard.press('1');
await p.waitForTimeout(500);
await p.keyboard.press('Tab');
await p.waitForTimeout(4000);
const s = () => p.evaluate(() => ({ mode: window.__demo.mode, read: !!window.__demo.read, ds: window.__dom.ds.length, fallLen: window.__dom.fall.length, fallen: window.__dom.fall.filter((x) => x !== undefined).length, pushedAt: window.__dom.pushedAt, running: window.__demo.bridge.running, t: window.__demo.bridge.stats.simTime, status: document.getElementById('status').textContent, recorded: window.__dom.recorded, lastFall: window.__dom.lastFall }));
console.log(await s());
await p.keyboard.press('t');
for (let k = 0; k < 5; k++) { await p.waitForTimeout(1500); console.log(await s()); }
await p.screenshot({ path: '/tmp/dom-run.png' });
await b.close();
