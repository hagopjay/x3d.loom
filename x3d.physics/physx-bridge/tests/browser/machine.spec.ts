// The bridge and the Marble Machine: hub, side by side, build, run, record and replay, looks and sound, the export on plain X_ITE.
import { test, expect } from '@playwright/test';
import { openMachine, watchErrors } from './helpers.ts';
/* eslint-disable @typescript-eslint/no-explicit-any */

test('hub: every demo has a card and its page loads', async ({ page, request }) => {
  const e = watchErrors(page);
  await page.goto('index.html');
  const hrefs = await page.locator('a.card').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(['machine.html', 'musicbox.html', 'dominoes.html', 'trebuchet.html', 'galton.html', 'sidebyside.html']);
  for (const h of hrefs) expect((await request.get(h!)).status()).toBe(200);
  for (const img of await page.locator('a.card img').all()) expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  e.check();
});

test('side by side: one file runs on PhysX and on Bullet', async ({ page }) => {
  const e = watchErrors(page);
  await page.goto('sidebyside.html');
  await page.waitForFunction(() => (window as any).__sbs?.ready || (window as any).__sbs?.error, null, { timeout: 90_000 });
  await page.locator('body').press('Space');
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => { const S = (window as any).__sbs; return { steps: S.bridge.stats.stepCount, samples: S.log.length, last: S.log.at(-1) }; });
  expect(r.steps).toBeGreaterThan(240);
  expect(r.samples).toBeGreaterThan(10);
  // the marble moved on both engines
  expect(r.last.px[0][1]).toBeLessThan(0.5);
  expect(r.last.bt[0][1]).toBeLessThan(0.5);
  e.check();
});

test('machine: build mode adds and undoes a piece', async ({ page }) => {
  const e = watchErrors(page);
  await page.goto('machine.html');
  await page.waitForFunction(() => (window as any).__mm?.ready, null, { timeout: 90_000 });
  const n0 = await page.evaluate(() => (window as any).__mm.machine.pieces.length);
  await page.evaluate(() => (window as any).__mm.addPiece('ramp'));
  expect(await page.evaluate(() => (window as any).__mm.machine.pieces.length)).toBe(n0 + 1);
  await page.evaluate(() => (window as any).__mm.undo());
  expect(await page.evaluate(() => (window as any).__mm.machine.pieces.length)).toBe(n0);
  e.check();
});

test('machine: 20 marbles run through the default machine into the cup', async ({ page }) => {
  const e = watchErrors(page);
  await openMachine(page);
  await page.keyboard.press('0');
  // the run takes about 12 s of simulated time; Firefox simulates the full machine at about half speed
  await expect.poll(() => page.evaluate(() => (window as any).__mm.counters?.inCup ?? 0), { timeout: 150_000, intervals: [2000] }).toBeGreaterThanOrEqual(15);
  e.check();
});

test('machine: a recorded run replays bit-exactly; looks and sound work', async ({ page }) => {
  const e = watchErrors(page);
  await openMachine(page);
  await page.keyboard.press('c');
  await page.waitForFunction(() => (window as any).__mm.bridge.isRecording);
  await page.keyboard.press('5');
  // 2 s of simulated time (Firefox simulates the full machine at about half speed)
  await page.waitForFunction(() => (window as any).__mm.bridge.stats.simTime > 2, null, { timeout: 60_000 });
  await page.keyboard.press('c');
  await page.waitForFunction(() => (window as any).__mm.lastRun);
  const res = await page.evaluate(() => (window as any).__mm.replay());
  expect(res.steps).toBeGreaterThan(400);
  expect(res.mismatches).toBe(0);
  expect(await page.evaluate(() => (window as any).__mm.sound.triggered)).toBeGreaterThan(0);
  await page.keyboard.press('k');
  expect(await page.evaluate(() => (window as any).__mm.look)).toBe('loom');
  e.check();
});

test('the exported machine runs on plain X_ITE (its own engine, no bridge)', async ({ page }) => {
  const e = watchErrors(page);
  await page.goto('index.html');
  await page.evaluate(async () => {
    await new Promise<void>((r) => { const s = document.createElement('script'); s.src = 'vendor/x_ite/x_ite.min.js'; s.onload = () => r(); document.head.append(s); });
    document.body.innerHTML = '<x3d-canvas id="c" splashScreen="false" src="scenes/marble-machine.x3d" style="width:900px;height:600px;display:block"></x3d-canvas>';
  });
  const y = () => page.evaluate(() => { try { return (document.getElementById('c') as any).browser.currentScene.getNamedNode('Marble0Body').position.y; } catch { return null; } });
  await expect.poll(y, { timeout: 60_000 }).not.toBeNull();
  const y0 = (await y())!;
  await expect.poll(y, { timeout: 30_000 }).toBeLessThan(y0 - 0.1); // Bullet makes the first marble fall
  e.check();
});
