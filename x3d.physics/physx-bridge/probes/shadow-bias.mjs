import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto('http://127.0.0.1:5181/musicbox.html');
await page.waitForFunction(() => window.__demo?.ready, null, { timeout: 60000 });
for (const b of [2048, 4096]) {
  await page.evaluate((b) => { const k = window.__demo.bridge.scene.getNamedNode('Key'); k.shadowMapSize = b; }, b);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/tmp/shadowmap-${b}.png`, clip: { x: 150, y: 250, width: 800, height: 430 } });
}
console.log(await page.evaluate(() => { const k = window.__demo.bridge.scene.getNamedNode('Key'); return [k.shadowMapSize, k.shadowBias]; }));
await browser.close();
