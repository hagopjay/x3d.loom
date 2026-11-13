import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Collect page errors (uncaught exceptions and console errors); each test ends by expecting none. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { check: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** Open a demo page built on the shell and wait until its first scene is in. */
export async function openDemo(page: Page, file: string) {
  await page.goto(file);
  await page.waitForFunction(() => (window as any).__demo?.ready || (window as any).__demo?.error, null, { timeout: 90_000 });
  expect(await page.evaluate(() => (window as any).__demo.error)).toBe('');
  await page.locator('#canvas').click({ position: { x: 5, y: 5 } }); // keyboard focus
}

export async function openMachine(page: Page) {
  await page.goto('machine.html');
  await page.waitForFunction(() => (window as any).__mm?.ready, null, { timeout: 90_000 });
  await page.evaluate(() => (window as any).__mm.enterRun());
  await page.waitForFunction(() => (window as any).__mm.mode === 'run' && (window as any).__mm.bridge.lastState, null, { timeout: 90_000 });
  await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
}
