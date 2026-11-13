// Thumbnails for the hub page: each demo in action, the stage only, 720×450.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('public/thumbs', { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const BASE = process.env.BASE ?? 'http://127.0.0.1:5181/';
async function shot(name, url, act) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(BASE + url);
  await page.waitForFunction(() => (window.__demo?.ready || window.__mm?.ready), null, { timeout: 60000 });
  await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
  await act(page);
  const box = await page.locator('#canvas').boundingBox();
  const w = Math.min(box.width, box.height * 1.6), h = w / 1.6;
  await page.screenshot({ path: `public/thumbs/${name}.png`, clip: { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h }, scale: 'css' });
  await page.close();
}
await shot('machine', 'machine.html', async (p) => { await p.evaluate(() => window.__mm.enterRun()); await p.waitForFunction(() => window.__mm.mode === 'run' && window.__mm.bridge.lastState); await p.keyboard.press('k'); await p.keyboard.press('5'); await p.waitForTimeout(3500); });
await shot('musicbox', 'musicbox.html', async (p) => { await p.keyboard.press('Space'); await p.waitForTimeout(2500); });
await shot('dominoes', 'dominoes.html', async (p) => { await p.keyboard.press('2'); await p.waitForTimeout(400); await p.keyboard.press('Tab'); await p.waitForFunction(() => window.__demo.mode === 'run' && window.__demo.read && window.__dom.pushedAt < 0); await p.keyboard.press('t'); await p.waitForTimeout(2600); });
await shot('galton', 'galton.html', async (p) => { await p.keyboard.press('o'); await p.waitForTimeout(9000); });
await shot('trebuchet', 'trebuchet.html', async (p) => { await p.waitForTimeout(800); await p.keyboard.press('f'); await p.waitForTimeout(1250); });
await shot('sidebyside', 'sidebyside.html', async (p) => { await p.waitForTimeout(2500); }).catch((e) => console.log('sidebyside', String(e).slice(0, 200)));
await browser.close();
console.log('ok');
