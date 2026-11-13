import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium' }); const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
let errs = 0; p.on('pageerror', () => errs++);
await p.goto('http://127.0.0.1:5181/ragdoll.html');
await p.waitForFunction(() => window.__demo?.ready);
await p.evaluate(() => {
  const S = window.__rag, br = window.__demo.bridge; window.__trace = [];
  br.onState((e) => {
    const st = e.state; let vmax = 0, bad = -1;
    for (const l of S.links) { const o = l.index * 13; const v = Math.hypot(st[o + 7], st[o + 8], st[o + 9]); if (!Number.isFinite(v) && bad < 0) bad = l.index; vmax = Math.max(vmax, v); }
    window.__trace.push({ t: +e.time.toFixed(3), vmax: +vmax.toFixed(2), bad, boom: S.boom.done, score: S.ouch?.total, ev: e.events.length / 13, maxImp: Math.max(0, ...Array.from({ length: e.events.length / 13 }, (_, k) => e.events[k * 13 + 11])) });
  });
});
await p.locator('#canvas').click({ position: { x: 5, y: 5 } });
await p.keyboard.press('2');
await p.waitForTimeout(6000);
const tr = await p.evaluate(() => window.__trace);
const firstBig = tr.findIndex((x) => x.vmax > 30 || x.bad >= 0);
console.log('samples', tr.length, 'errors', errs, 'first big at', firstBig, JSON.stringify(tr.slice(Math.max(0, firstBig - 6), firstBig + 3)));
console.log('max impulse in an event before that:', Math.max(...tr.slice(0, Math.max(1, firstBig)).map((x) => x.maxImp)));
await b.close();
