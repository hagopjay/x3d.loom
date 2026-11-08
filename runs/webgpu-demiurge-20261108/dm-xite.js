// node dm-xite.js out.png URL [wait ms]: the ORIGINAL demiurge page (X_ITE 16.5.1, WebGL 2) at the same size, for the comparison. Full Chromium: the headless shell crashes on X_ITE scenes here.
const { chromium } = require('playwright');
(async () => {
  const [, , out, url, wait] = process.argv;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
  await p.goto(url);
  await p.waitForFunction(() => window.gdBoot && (window.gdBoot.done || window.gdBoot.failed), null, { timeout: 300000 });
  await p.waitForTimeout(+wait || 20000);
  console.log(JSON.stringify(await p.evaluate(() => window.gdBoot.log.slice(-3))));
  await p.screenshot({ path: out }); await b.close();
})();
