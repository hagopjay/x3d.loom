// usage: node probes/run-probe.mjs <path-under-server> [browser]  -- opens the page in real-WebGL Playwright, prints window.__probe
import { chromium, firefox, webkit } from 'playwright';
const [, , path, which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch(which === 'chromium' ? { channel: 'chromium' } : {});
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
const logs = []; page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`)); page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto('http://127.0.0.1:5181/' + path);
await page.waitForFunction(() => window.__probe, null, { timeout: 120000 });
const r = await page.evaluate(() => window.__probe);
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
console.log(JSON.stringify({ browser: which, version: browser.version(), result: r, logs: logs.filter(l => !/X_ITE|Welcome|is a /.test(l)).slice(0, 20) }, null, 1));
await browser.close();
