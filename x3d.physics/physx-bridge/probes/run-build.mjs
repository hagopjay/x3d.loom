// Build mode with a real pointer: drag the bell with the mouse (X3D PlaneSensor), check the snap, rotate (E), undo (Cmd/Ctrl+Z).
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch(which === 'chromium' ? { channel: 'chromium' } : {});
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const logs = []; page.on('pageerror', (e) => logs.push(e.message));
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'machine.html');
await page.waitForFunction(() => window.__mm?.ready, null, { timeout: 60000 });
await page.waitForTimeout(800);
// world -> screen for the Front viewpoint (position 0 0.54 2.05, fieldOfView 0.7 on the smaller canvas side)
const box = await page.locator('#canvas').boundingBox();
const toScreen = (x, y, z) => { const s = Math.min(box.width, box.height) / 2 / Math.tan(0.35), d = 2.05 - z; return [box.x + box.width / 2 + (x * s) / d, box.y + box.height / 2 - ((y - 0.54) * s) / d]; };
const piece = async (id) => page.evaluate((id) => { const p = window.__mm.machine.pieces.find((q) => q.id === id); return p && { gx: p.gx, gy: p.gy, rot: p.rot }; }, id);
const before = await piece(4);
const [sx, sy] = toScreen(before.gx * 0.04, before.gy * 0.04 + 0.01, 0.02);
const [ex, ey] = toScreen((before.gx - 3) * 0.04, (before.gy + 2) * 0.04 + 0.01, 0.02);
await page.mouse.move(sx, sy); await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(sx + ((ex - sx) * i) / 12, sy + ((ey - sy) * i) / 12); await page.waitForTimeout(30); }
await page.mouse.up(); await page.waitForTimeout(400);
const dragged = await piece(4), selected = await page.evaluate(() => window.__mm.selected);
await page.screenshot({ path: `evidence/p3-build-${which}-dragged.png` });
await page.keyboard.press('e'); await page.waitForFunction(() => window.__mm.machine.pieces.find((q) => q.id === 4).rot === 15, null, { timeout: 10000 }).catch(() => {});
const rotated = await piece(4);
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await page.waitForTimeout(800);
const undone1 = await piece(4);
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await page.waitForTimeout(800);
const undone2 = await piece(4);
const r = { before, dragged, selected, rotated, afterUndo1: undone1, afterUndo2: undone2, expectedDrag: { gx: before.gx - 3, gy: before.gy + 2 }, errors: logs };
writeFileSync(`evidence/p3-build-${which}.json`, JSON.stringify({ browser: which, version: browser.version(), ...r }, null, 1));
console.log(which, JSON.stringify(r));
await browser.close();
