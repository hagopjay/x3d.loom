import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ locale: 'en-US' });
await page.goto('http://127.0.0.1:5181/sidebyside.html?scene=scenes/joints-and-sensors.x3d');
await page.waitForFunction(() => window.__sbs?.ready);
const r = await page.evaluate(async () => {
  const S = window.__sbs, b = S.bridge, c = b.scene.getNamedNode('ElevatorClock'), e = b.scene.getNamedNode('ElevatorBody');
  const snap = () => ({ now: +(Date.now() / 1000).toFixed(3), isActive: c.isActive, isPaused: c.isPaused, start: c.startTime, pause: +c.pauseTime.toFixed(3), resume: c.resumeTime, frac: +c.fraction_changed.toFixed(4), elevY: +e.position.y.toFixed(4), enabled: c.enabled, loop: c.loop });
  const out = [snap()];
  await new Promise((r) => setTimeout(r, 800)); out.push(snap());
  c.pauseTime = (Date.now() / 1000); await new Promise((r) => setTimeout(r, 50)); out.push(snap());
  await new Promise((r) => setTimeout(r, 800)); out.push(snap());
  return out;
});
console.log(JSON.stringify(r, null, 0));
await browser.close();
