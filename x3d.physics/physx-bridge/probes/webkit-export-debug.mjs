// WebKit: does awaiting importX3D inside page.evaluate hang, and does a fire-and-poll import complete?
import { webkit } from 'playwright';
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
for (const f of ['musicbox.html', 'galton.html']) {
  await p.goto('http://127.0.0.1:5182/' + f);
  await p.waitForFunction(() => window.__demo?.ready, null, { timeout: 90000 });
  await p.evaluate(() => { window.__xml = window.__demo.exportX3D(); });
  const t0 = Date.now();
  await p.evaluate(() => { window.__imp = undefined; window.__demo.importX3D(window.__xml).then((r) => { window.__imp = r; }); });
  await p.waitForFunction(() => window.__imp !== undefined, null, { timeout: 60000 }).catch(() => {});
  console.log(f, 'fire-and-poll import', await p.evaluate(() => window.__imp), Date.now() - t0, 'ms');
  const t1 = Date.now();
  const r = await Promise.race([p.evaluate(() => window.__demo.importX3D(window.__xml)), new Promise((r) => setTimeout(() => r('TIMEOUT'), 30000))]);
  console.log(f, 'awaited-in-evaluate import', r, Date.now() - t1, 'ms');
}
await b.close();
