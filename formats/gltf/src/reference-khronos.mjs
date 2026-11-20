// Runs the Khronos glTF Sample Renderer on a harnessed glb in headless Chromium and returns {ok, png, part}.
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';
import { pkgVersion } from '../../../x3d.gltf/render/browser.mjs';
import { NODE_MODULES } from './paths.mjs';

export const KHRONOS_VERSION = pkgVersion(path.join(NODE_MODULES, '@khronosgroup/gltf-viewer'));

export async function renderKhronos({ browser, glb, cameraIndex, size = 512, timeoutMs = 90_000 }) {
  const server = await startServer({ glbPath: path.resolve(glb) });
  const part = { console: { errors: [], warnings: [] }, blocked: [] };
  let ctx = null, png = null, ok = false;
  const t0 = Date.now();
  try {
    ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await ctx.route(/^(https?|wss?):/i, (r) => (r.request().url().startsWith(server.origin + '/') ? r.continue() : (part.blocked.push(r.request().url()), r.abort('blockedbyclient'))));
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') part.console.errors.push(m.text()); else if (m.type() === 'warning') part.console.warnings.push(m.text()); });
    page.on('pageerror', (e) => part.console.errors.push(`pageerror: ${e.message}`));
    await page.goto(`${server.origin}/pages/khronos.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__pageReady === true, null, { timeout: timeoutMs });
    Object.assign(part, await page.evaluate((p) => window.__render(p), { size, cameraIndex }));
    part.userAgent = await page.evaluate(() => navigator.userAgent);
    part.webgl = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return { version: gl.getParameter(gl.VERSION), renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : null };
    });
    png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
    ok = true;
  } catch (e) {
    part.error = String(e?.message ?? e).split('\n').slice(0, 4).join(' | ');
  } finally {
    await ctx?.close().catch(() => {});
    await server.close();
  }
  part.totalMs = Date.now() - t0;
  return { ok, png, part };
}
