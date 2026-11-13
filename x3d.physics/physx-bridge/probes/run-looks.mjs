// Both looks: screenshots after Drop 20, photoreal then Loom; errors and the switched state are reported.
import { chromium, firefox, webkit } from 'playwright';
const [, , which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch(which === 'chromium' ? { channel: 'chromium' } : {});
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'warning' && /EnvironmentLight/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'machine.html');
await page.waitForFunction(() => window.__mm?.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__mm.enterRun());
await page.waitForFunction(() => window.__mm.looks, null, { timeout: 60000 });
await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
await page.keyboard.press('0'); await page.waitForTimeout(3500);
await page.screenshot({ path: `evidence/p4-look-photoreal-${which}.png` });
await page.keyboard.press('k'); await page.waitForTimeout(2500);
await page.screenshot({ path: `evidence/p4-look-loom-${which}.png` });
const st = await page.evaluate(() => ({ look: window.__mm.look, tone: window.__mm.bridge.browser.getBrowserOption('ToneMapping') }));
console.log(which, JSON.stringify(st), 'errors', errs.slice(0, 3));
await browser.close();
