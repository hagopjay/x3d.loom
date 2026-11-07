// node shot-xite.js URL OUT.png [W H] [settleMs]: one still of the original X_ITE KANSEI page (software WebGL, headless Chromium), 3D only (hud=0 in the URL)
const { chromium } = require('playwright');
(async () => {
  const [, , url, out, W, H, settle] = process.argv;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: +W || 640, height: +H || 360 } });
  p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300)));
  p.on('console', m => { if (/error/i.test(m.type())) console.log('console', m.text().slice(0, 300)); });
  await p.goto(url);
  await p.waitForFunction(() => window.__ready, null, { timeout: 280000 }).catch(() => console.log('not ready'));
  await p.waitForTimeout(+settle || 6000);
  await p.screenshot({ path: out });
  console.log('xite', JSON.stringify(await p.evaluate(() => window.__ready)).slice(0, 200));
  await b.close();
})();
