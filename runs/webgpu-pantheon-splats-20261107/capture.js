const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, file, out, w, h, pre] = process.argv;
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  p.on('console', m => console.log('console', m.type(), m.text().slice(0,300)));
  p.on('pageerror', e => console.log('pageerror', e.message.slice(0,300)));
  await p.addInitScript(() => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 600); });
  await p.goto('file://' + file);
  await p.waitForFunction(() => window.__demo && window.__demo.ready, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  if (pre) { await p.evaluate(pre); await p.waitForTimeout(5000); }
  await p.evaluate(() => { window.__demo.capture(960, 540, false).then(x => { window.__res = x; }, e => { window.__err = String(e); }); });
  await p.waitForFunction(() => window.__res || window.__err, null, { timeout: 120000 }).catch(e => console.log('wait', e.message.slice(0,100)));
  console.log(await p.evaluate(() => document.getElementById('log').innerText.slice(0,300) + JSON.stringify({vp: window.__demo.world.viewpoint && window.__demo.world.viewpoint.def, n: window.__demo.world.viewpoints.map(v=>v.def), tr: !!window.__demo.cam.tr, rot: window.__demo.cam.rot})));
  console.log(await p.evaluate(() => window.__err || Object.prototype.toString.call(window.__res) + ' ' + (window.__res && Object.keys(window.__res))));
  const data = await p.evaluate(async () => { const x = window.__res; const blob = x instanceof Blob ? x : (x && (x.blob)); if (!blob) return null; const u = new Uint8Array(await blob.arrayBuffer()); let s=''; for (let i=0;i<u.length;i+=8192) s+=String.fromCharCode(...u.subarray(i,i+8192)); return btoa(s); });
  if (data) fs.writeFileSync(out, Buffer.from(data, 'base64'));
  await b.close();
})();
