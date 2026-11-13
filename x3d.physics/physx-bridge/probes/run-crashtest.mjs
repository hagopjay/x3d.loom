// Crash-test heat map in a real browser: stairs, cannon and wrecking ball with the heat map on; a close-up of the painted dummy
// after each, and the head score (HIC-style, a rough lower bound) and the worst-hit segments. BROWSER=firefox|webkit for the others.
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const name = process.env.BROWSER ?? 'chromium';
const type = { chromium, firefox, webkit }[name];
const b = await type.launch(name === 'chromium' ? { channel: 'chromium' } : {}); const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); p.on('framenavigated', (f) => { if (f === p.mainFrame()) console.log('navigated', f.url()); }); p.on('crash', () => console.log('page crashed'));
await p.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'ragdoll.html');
await p.waitForFunction(() => window.__demo?.ready, null, { timeout: 120000 });
await p.locator('#canvas').click({ position: { x: 5, y: 5 } });
const out = {};
for (const [key, level, tag] of [['j', '3', 'stairs'], ['n', '3', 'cannon'], ['w', '2', 'wrecking']]) {
  await p.keyboard.press(key);
  await p.waitForFunction(() => window.__rag.phase === 'ready' && window.__rag.links.length && window.__rag.crash, null, { timeout: 60000 });
  await p.waitForTimeout(600);
  const t0 = Date.now();
  await p.keyboard.press(level);
  let fpsMin = 999;
  for (let k = 0; k < 6; k++) { await p.waitForTimeout(500); fpsMin = Math.min(fpsMin, await p.evaluate(() => Math.round(window.__demo.browser.currentFrameRate))); }
  await p.waitForFunction(() => window.__rag.phase === 'done', null, { timeout: 90000 }).catch(() => {});
  const wall = (Date.now() - t0) / 1000;
  // close-up: the Follow view (after the auto camera's own switch)
  await p.waitForTimeout(600);
  if (!(await p.evaluate(() => !!window.__rag))) { console.log(`${tag}: page lost its state (url ${p.url()})`); out[tag] = { lost: true }; await p.waitForFunction(() => window.__demo?.ready && window.__rag, null, { timeout: 120000 }).catch(() => {}); continue; }
  for (let k = 0; k < 4 && (await p.evaluate(() => window.__rag.view)) !== 3; k++) await p.keyboard.press('v');
  await p.waitForTimeout(1800); // X_ITE animates the viewpoint change
  await p.screenshot({ path: `evidence/heat-${tag}${name === 'chromium' ? '' : '-' + name}.png` });
  out[tag] = await p.evaluate((wall) => {
    const S = window.__rag, a = S.attempts.at(-1);
    return { score: a?.score, hits: a?.hits, hic: Math.round(S.crash.hic), headG: Math.round(S.crash.headG), worst: S.crash.worst(4).map((w) => `${w.segment} ${Math.round(w.g)} g`), simTime: +window.__demo.bridge.stats.simTime.toFixed(2), wall: +wall.toFixed(1) };
  }, wall);
  out[tag].fpsMin = fpsMin;
}
// the heat map off restores the colours
await p.keyboard.press('t'); await p.waitForTimeout(400);
await p.screenshot({ path: `evidence/heat-off${name === 'chromium' ? '' : '-' + name}.png` });
console.log(JSON.stringify({ browser: name, ...out, errors }, null, 1));
writeFileSync(`evidence/crashtest-${name}.json`, JSON.stringify({ browser: name, ...out, errors }, null, 1));
await b.close();
