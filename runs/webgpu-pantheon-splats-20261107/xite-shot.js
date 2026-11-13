const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('console', m => console.log('c', m.text().slice(0,160))); p.on('pageerror', e => console.log('pe', e.message.slice(0,200)));
  await p.goto('http://localhost:8765/index.html');
  await p.waitForFunction(() => { const c=document.getElementById('c'); return c && c.browser && c.browser.currentScene && c.browser.currentScene.rootNodes && c.browser.currentScene.rootNodes.length>0; }, null, {timeout:120000});
  await p.waitForTimeout(30000); if (process.argv[3]) { await p.evaluate(() => { const s=document.getElementById('c').browser.currentScene; s.getNamedNode('CA_Oculus').set_bind=true; }); await p.waitForTimeout(25000); }
  await p.screenshot({ path: process.argv[2] });
  await b.close();
})();
