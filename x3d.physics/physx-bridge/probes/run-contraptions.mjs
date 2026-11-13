// Cannon and wrecking ball in a real browser.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chromium' }); const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await p.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'ragdoll.html');
await p.waitForFunction(() => window.__demo?.ready, null, { timeout: 120000 });
await p.locator('#canvas').click({ position: { x: 5, y: 5 } });
const out = {};
for (const [key, level, tag] of [['n', '3', 'cannon'], ['w', '2', 'wrecking']]) {
  await p.keyboard.press(key);
  await p.waitForFunction(() => window.__rag.phase === 'ready' && window.__rag.links.length, null, { timeout: 60000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `evidence/${tag}-ready.png` });
  await p.keyboard.press(level);
  await p.waitForTimeout(tag === 'cannon' ? 900 : 700);
  await p.screenshot({ path: `evidence/${tag}-action.png` });
  await p.waitForFunction(() => window.__rag.phase === 'done', null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(500);
  await p.screenshot({ path: `evidence/${tag}-end.png` });
  out[tag] = await p.evaluate(() => { const a = window.__rag.attempts.at(-1); return a ? { score: a.score, hits: a.hits, push: a.push } : null; });
}
console.log(JSON.stringify({ ...out, errors }));
writeFileSync('evidence/contraptions-chromium.json', JSON.stringify({ ...out, errors }, null, 1));
await b.close();
