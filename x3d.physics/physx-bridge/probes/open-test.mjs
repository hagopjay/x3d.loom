import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium' });
const page = await b.newPage({ locale: 'en-US', viewport: { width: 1400, height: 900 } });
const logs = []; page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`)); page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto('http://127.0.0.1:5181/machine.html');
await page.waitForFunction(() => window.__mm?.ready || window.__mm?.error, null, { timeout: 60000 });
await page.keyboard.press('Tab'); await page.waitForTimeout(5000);
console.log(await page.evaluate(() => ({ mode: window.__mm.mode, err: window.__mm.error, status: document.getElementById('status').textContent, last: !!window.__mm.bridge.lastState })), logs.filter((l) => !l.includes('vite') && !l.includes('getField')).slice(0, 10));
await b.close();
