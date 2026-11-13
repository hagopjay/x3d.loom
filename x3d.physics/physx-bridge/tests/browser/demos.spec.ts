// The four demos on the shell: each does its physical job in every browser, with no page errors.
import { test, expect } from '@playwright/test';
import { openDemo, watchErrors } from './helpers.ts';
/* eslint-disable @typescript-eslint/no-explicit-any */

test('music box: every peg sounds once per turn, and pulled pegs fall silent', async ({ page }) => {
  const e = watchErrors(page);
  await openDemo(page, 'musicbox.html');
  const pegs = await page.evaluate(() => (window as any).__mb.box.grid.join('').split('x').length - 1);
  // notes counted per completed turn of the drum (read at the turn, not after it)
  await page.evaluate(() => {
    const S = (window as any).__mb, w = window as any; w.__turns = []; let last = 0, n0 = 0;
    w.__demo.bridge.onState(() => { if (S.revolutions !== last) { w.__turns.push(S.notes - n0); last = S.revolutions; n0 = S.notes; } });
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => (window as any).__turns.length >= 3, null, { timeout: 180_000 });
  const turns = await page.evaluate(() => (window as any).__turns);
  expect(turns.slice(1, 3)).toEqual([pegs, pegs]); // the first turn starts mid-way
  await page.keyboard.press('x'); // pull every peg, live
  const [n0, r0] = await page.evaluate(() => [(window as any).__mb.notes, (window as any).__mb.revolutions]);
  await page.waitForFunction((r) => (window as any).__mb.revolutions >= r + 2, r0, { timeout: 180_000 });
  expect(await page.evaluate(() => (window as any).__mb.notes) - n0).toBeLessThanOrEqual(2); // at most hammers already lifted
  e.check();
});

test('dominoes: a straight row falls completely at the speed the Node sweep predicts', async ({ page }) => {
  const e = watchErrors(page);
  await openDemo(page, 'dominoes.html');
  await page.keyboard.press('1');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => (window as any).__demo.mode === 'run' && (window as any).__dom.fall.length === (window as any).__dom.ds.length && (window as any).__dom.pushedAt < 0, null, { timeout: 90_000 });
  await page.keyboard.press('t');
  await page.waitForFunction(() => (window as any).__dom.recorded, null, { timeout: 120_000 });
  const r = await page.evaluate(() => ({ fallen: (window as any).__dom.fall.filter((x: unknown) => x !== undefined).length, of: (window as any).__dom.ds.length, v: (window as any).__dom.experiments.at(-1).v }));
  expect(r.fallen).toBe(r.of);
  // Node, straight row, gap 0.45 H, friction 0.2: 1.297 √(gH) = 0.922 m/s (evidence/dominoes-sweep.json)
  expect(r.v).toBeGreaterThan(0.83); expect(r.v).toBeLessThan(1.02);
  e.check();
});

test('trebuchet: fire, release at the asked angle, land where Node says', async ({ page }) => {
  const e = watchErrors(page);
  await openDemo(page, 'trebuchet.html');
  await page.waitForTimeout(1000);
  await page.keyboard.press('f');
  await page.waitForFunction(() => (window as any).__treb.shots.length > 0, null, { timeout: 120_000 });
  const s = await page.evaluate(() => (window as any).__treb.shots.at(-1));
  expect(Math.abs(s.angle - 40)).toBeLessThan(1);
  expect(Math.abs(s.range - 165.6)).toBeLessThan(2); // Node: 165.6 m (evidence/trebuchet-sim-2000-37-5-40.json)
  e.check();
});

test('Galton board: 240 beads poured and shaken land in a centred bell', async ({ page }) => {
  const e = watchErrors(page);
  await openDemo(page, 'galton.html');
  await page.keyboard.press('o');
  await page.waitForFunction(() => !(window as any).__galton.pouring, null, { timeout: 180_000 });
  // waits in simulated time: Firefox runs this board at about half speed
  const sim = () => page.evaluate(() => (window as any).__demo.bridge.stats.simTime as number);
  let t = await sim();
  await page.waitForFunction((t0) => (window as any).__demo.bridge.stats.simTime > t0 + 3, t, { timeout: 60_000 });
  await page.keyboard.press('h');
  t = await sim();
  await page.waitForFunction((t0) => (window as any).__demo.bridge.stats.simTime > t0 + 4, t, { timeout: 60_000 });
  const st = await page.evaluate(() => (window as any).__galton.stats);
  expect(st.binned).toBeGreaterThanOrEqual(225);
  expect(Math.abs(st.mean)).toBeLessThan(0.8);
  expect(st.sd).toBeGreaterThan(1.5); expect(st.sd).toBeLessThan(3.5);
  e.check();
});

test('every demo exports standard X3D that it can import again', async ({ page }) => {
  for (const f of ['musicbox.html', 'dominoes.html', 'trebuchet.html', 'galton.html']) {
    const e = watchErrors(page);
    await openDemo(page, f);
    const ok = await page.evaluate(async () => { const d = (window as any).__demo; const xml = d.exportX3D(); return { head: xml.startsWith('<?xml') && xml.includes('version="4.0"') && !xml.includes('shadowMapSize'), imported: await d.importX3D(xml) }; });
    expect(ok).toEqual({ head: true, imported: true });
    e.check();
  }
});
