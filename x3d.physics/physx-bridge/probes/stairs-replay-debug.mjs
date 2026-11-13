import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium' }); const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
p.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text().slice(0, 200)); });
await p.goto('http://127.0.0.1:5181/ragdoll.html');
await p.waitForFunction(() => window.__demo?.ready);
await p.locator('#canvas').click({ position: { x: 5, y: 5 } });
await p.keyboard.press('2');
await p.waitForFunction(() => window.__rag.phase === 'done', null, { timeout: 60000 });
const a = await p.evaluate(() => { const a = window.__rag.best; return { score: a.score, steps: a.log?.hashes.length, msgs: a.log?.messages.length }; });
console.log('attempt', JSON.stringify(a));
await p.keyboard.press('q');
for (let k = 0; k < 12; k++) { await p.waitForTimeout(5000); console.log(k, JSON.stringify(await p.evaluate(() => ({ replay: window.__rag.replay, step: window.__demo.bridge.stats.stepCount, sim: window.__demo.bridge.stats.simTime, hud: document.getElementById('hud').textContent.slice(0, 80) })))); if (!(await p.evaluate(() => window.__rag.replay))) break; }
await b.close();
