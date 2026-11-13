import { firefox } from 'playwright';
const b = await firefox.launch(); const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
p.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 250)));
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto((process.env.BASE ?? 'http://127.0.0.1:5182/') + (process.argv[2] ?? 'musicbox.html'));
for (let k = 0; k < 8; k++) { await p.waitForTimeout(4000); console.log(k, JSON.stringify(await p.evaluate(() => ({ ready: window.__demo?.ready, err: window.__demo?.error, status: document.getElementById('status')?.textContent, stalls: window.__demo?.bridge.stats.createStalls })))); }
await b.close();
