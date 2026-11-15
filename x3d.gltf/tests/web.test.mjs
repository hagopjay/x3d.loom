// The browser bundle must do what the CLI does: same profiles, same gates, and (the meshopt encoder is deterministic) the same bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { buildFixtures } from '../fixtures/build.mjs';
import { optimize } from '../src/optimize.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x3dgltf-web-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const fx = await buildFixtures(path.join(tmp, 'fx'));
await build({ entryPoints: [new URL('../web/forge.mjs', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, outfile: path.join(tmp, 'forge.bundle.js'), external: ['node:fs', 'node:path'], logLevel: 'silent' });
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><meta charset=utf-8><title>forge</title><script type="module">import * as F from "./forge.bundle.js"; window.F = F; window.ready = true;</script>');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let browser, server, page, port;
try {
  const { chromium } = createRequire(import.meta.url)('playwright');
  server = http.createServer((q, r) => { const f = path.join(tmp, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(tmp) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }).end(fs.readFileSync(f)); });
  await new Promise((res) => server.listen(0, '127.0.0.1', res)); port = server.address().port;
  browser = await chromium.launch(); page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction('window.ready === true', null, { timeout: 30000 });
} catch (e) { console.error('chromium unavailable:', e.message); }
test.after(async () => { await browser?.close(); server?.close(); });

for (const [fixture, profile] of [['identity-dup', 'web'], ['repeated', 'instanced'], ['dense', 'web-filter'], ['animated', 'quantized']]) {
  test(`browser bundle == Node CLI: ${fixture} / ${profile}`, { skip: !page && 'chromium not available' }, async () => {
    const node = await optimize(fs.readFileSync(fx[fixture]), profile);
    const r = await page.evaluate(async ({ url, profile }) => {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const o = await window.F.forge(bytes, profile);
      const h = await crypto.subtle.digest('SHA-256', o.bytes);
      return { sha: [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join(''), size: o.bytes.byteLength, ok: o.report.ok, failures: o.report.failures, lost: o.report.identity.lost, added: o.report.identity.added };
    }, { url: `http://127.0.0.1:${port}/fx/${fixture}.glb`, profile });
    assert.equal(r.ok, true, r.failures.join('; ')); assert.equal(r.lost, 0); assert.equal(r.added, 0);
    assert.equal(r.size, node.bytes.length, 'same byte length');
    assert.equal(r.sha, sha(node.bytes), 'byte-identical to the Node output');
  });
}
