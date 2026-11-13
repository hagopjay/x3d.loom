// Firefox: notes per drum turn and the bridge's pacing (does it fall behind and drop time?).
import { firefox } from 'playwright';
const b = await firefox.launch(); const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
await p.goto((process.env.BASE ?? 'http://127.0.0.1:5182/') + 'musicbox.html');
await p.waitForFunction(() => window.__demo?.ready, null, { timeout: 90000 });
await p.evaluate(() => {
  const S = window.__mb, br = window.__demo.bridge; window.__turns = []; let last = 0, lastN = 0, lastWall = performance.now(), lastSim = 0;
  br.onState(() => { if (S.revolutions !== last) { const now = performance.now(); window.__turns.push({ turn: last, notes: S.notes - lastN, wallS: +((now - lastWall) / 1000).toFixed(2), simS: +(br.stats.simTime - lastSim).toFixed(2), sps: br.stats.stepsPerSecond, fps: Math.round(window.__demo.browser.currentFrameRate) }); last = S.revolutions; lastN = S.notes; lastWall = now; lastSim = br.stats.simTime; } });
});
await p.locator('#canvas').click({ position: { x: 5, y: 5 } }); await p.keyboard.press('Space');
await p.waitForFunction(() => window.__mb.revolutions >= 5, null, { timeout: 120000 });
console.log(JSON.stringify(await p.evaluate(() => window.__turns)));
await b.close();
