import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage();
p.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
await p.goto('http://127.0.0.1:5181/dominoes.html');
await p.waitForTimeout(8000);
console.log(await p.evaluate(() => ({ ready: window.__demo?.ready, err: window.__demo?.error, status: document.getElementById('status').textContent })));
await b.close();
