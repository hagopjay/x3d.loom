// Record a run in one browser engine, replay it in the same engine, the two others and Node; compare every step's state hash.
// usage: node probes/determinism.mjs [recorder] [seconds]
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [, , recorder = 'chromium', secs = '8'] = process.argv;
const engines = { chromium, firefox, webkit };
const BASE = process.env.BASE ?? 'http://127.0.0.1:5181/';
async function open(which) {
  const b = await engines[which].launch(which === 'chromium' ? { channel: 'chromium' } : {});
  const page = await b.newPage({ locale: 'en-US', viewport: { width: 1400, height: 900 } });
  await page.goto(BASE + 'machine.html');
  await page.waitForFunction(() => window.__mm?.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__mm.enterRun()); // (a Tab key press can arrive before the page has focus)
  await page.waitForFunction(() => window.__mm.mode === 'run' && window.__mm.bridge.lastState, null, { timeout: 60000 });
  await page.locator('#canvas').click({ position: { x: 5, y: 5 } }); // focus for the key presses below
  return { b, page, version: b.version() };
}
const out = { recorder, seconds: Number(secs), replays: {} };
{
  const { b, page, version } = await open(recorder);
  await page.keyboard.press('c');
  await page.waitForFunction(() => window.__mm.bridge.isRecording, null, { timeout: 30000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(Number(secs) * 1000);
  await page.keyboard.press('c');
  await page.waitForFunction(() => window.__mm.lastRun, null, { timeout: 30000 });
  const log = await page.evaluate(() => window.__mm.lastRun);
  writeFileSync(`evidence/p4-run-${recorder}.json`, JSON.stringify(log));
  out.recorded = { version, steps: log.hashes.length, batches: log.messages.length, teleports: log.messages.reduce((s, m) => s + m.teleports.length, 0), paths: log.messages.reduce((s, m) => s + m.paths.length, 0) };
  out.replays[`${recorder} (same page)`] = { version, ...(await page.evaluate(() => window.__mm.replay())) };
  await b.close();
}
const text = JSON.stringify(JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(`evidence/p4-run-${recorder}.json`, 'utf8'))));
for (const which of ['chromium', 'firefox', 'webkit']) {
  const { b, page, version } = await open(which);
  out.replays[which === recorder ? `${which} (fresh page)` : which] = { version, ...(await page.evaluate((t) => window.__mm.loadRun(t), text)) };
  await b.close();
}
out.replays.node = JSON.parse(execFileSync(process.execPath, ['tools/replay-node.ts', `evidence/p4-run-${recorder}.json`], { encoding: 'utf8' }).trim().split('\n').pop());
writeFileSync(`evidence/p4-determinism-${recorder}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
