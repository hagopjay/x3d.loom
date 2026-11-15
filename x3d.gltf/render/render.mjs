#!/usr/bin/env node
// Render ORACLE: draws one glb in headless Chromium (WebGL2 via ANGLE/SwiftShader) with three, Babylon or X_ITE.
//
//   node render/render.mjs --engine three|babylon|xite --glb FILE.glb --out FILE.png
//        [--size 512] [--camera JSON | --frame-from ORIG.glb] [--json receipt.json]
//        [--timeout-ms 60000]
//
// Exit codes: 0 rendered, 1 usage error, 2 load/render failed (receipt written, no PNG), 3 Chromium cannot launch.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { boundsOfGlb, frameCamera, normaliseCamera } from './frame.mjs';
import { glbInfo } from './glbinfo.mjs';
import { startServer, NODE_MODULES } from './server.mjs';
import { launchChromium, pkgVersion } from './browser.mjs';
import { buildWrapper } from './x3dwrap.mjs';
import sharp from 'sharp';
import { backgroundStats, BG_RGB } from './imgstats.mjs';

export const ENGINES = {
  three: { page: 'three.html', pkg: 'three', label: 'three.js' },
  babylon: { page: 'babylon.html', pkg: 'babylonjs', label: 'Babylon.js' },
  xite: { page: 'xite.html', pkg: 'x_ite', label: 'X_ITE' },
};
export const TIMEOUT_MS = 60_000;

// Which served files count as "decoder asset fetched" evidence, per codec.
const ASSET_PATTERNS = {
  draco: /draco_(decoder|wasm_wrapper)/i,
  meshopt: /meshopt_decoder/i, // three imports this module at page load even for files that need no meshopt
  ktx2: /(basis_transcoder|libktx|ktx2decoder|msc_basis|uastc|zstddec)/i,
};

function withTimeout(promise, ms, what) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`timeout after ${ms} ms while ${what}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

/**
 * Renders one glb. Never throws for load failures: returns {ok, receipt, exitCode}.
 * opts: {engine, glb, out, size, camera, frameFrom, json, browser, timeoutMs}
 */
export async function renderGlb(opts) {
  const t00 = Date.now();
  const { engine, glb, out = null, size = 512, json = null, timeoutMs = TIMEOUT_MS } = opts;
  const eng = ENGINES[engine];
  if (!eng) throw new UsageError(`unknown --engine ${engine} (three|babylon|xite)`);
  if (!glb || !fs.existsSync(glb)) throw new UsageError(`--glb ${glb} does not exist`);
  if (!Number.isInteger(size) || size < 16 || size > 4096) throw new UsageError('--size must be an integer in 16..4096');

  const receipt = {
    schema: 'x3d.gltf/render-receipt@1',
    engine: { name: eng.label, id: engine, package: eng.pkg, version: pkgVersion(path.join(NODE_MODULES, eng.pkg)) },
    chromium: null,
    userAgent: null,
    webgl: null,
    size,
    camera: null,
    background: { hex: '0x20242c', rgb: BG_RGB },
    glb: { path: path.resolve(glb) },
    lighting: null,
    colour: null,
    decoderConfig: null,
    decoders: null,
    stats: null,
    timing: { loadMs: null, settleMs: null, totalMs: null },
    console: { errors: [], warnings: [] },
    network: { failed: [], blocked: [], aborted: [], httpErrors: [] },
    loaded: false,
    degraded: false,
    error: null,
    png: null,
    image: null,
    notes: [],
  };
  // a failure before the browser starts still produces a receipt, an exit code of 2 and no PNG
  const failEarly = (msg) => {
    receipt.error = msg;
    receipt.timing.totalMs = Date.now() - t00;
    if (out) fs.rmSync(out, { force: true });
    writeReceipt(json, receipt);
    return { ok: false, receipt, exitCode: 2 };
  };

  // ---- camera: passed in, or framed from another glb, or (last resort) from the glb itself ----
  let camera;
  let cameraSource;
  if (opts.camera) {
    camera = normaliseCamera(typeof opts.camera === 'string' ? JSON.parse(opts.camera) : opts.camera); // throws on bad input: usage error
    cameraSource = 'explicit --camera';
  } else {
    const from = opts.frameFrom ?? glb;
    try {
      camera = normaliseCamera(frameCamera(await boundsOfGlb(from)));
    } catch (e) {
      return failEarly(`framing failed: cannot compute bounds of ${from}: ${String(e.message).split('\n')[0]}`);
    }
    cameraSource = opts.frameFrom
      ? `framed from ${path.resolve(opts.frameFrom)}`
      : 'framed from the rendered glb itself (no --camera / --frame-from: original and optimised files will NOT share a camera)';
  }
  receipt.camera = { ...camera, source: cameraSource };

  let info;
  try {
    info = glbInfo(glb);
  } catch (e) {
    return failEarly(`not a readable GLB: ${e.message}`);
  }
  Object.assign(receipt.glb, info);

  // ---- what the glb needs, to wire the X_ITE wrapper ----
  const hasLights = info.declaredLights > 0;
  // X_ITE wrapper: skyColor is given as the sRGB components of 0x20242c; the clear pixel was verified to come out as (32,36,44)
  let wrapper = null;
  if (engine === 'xite') {
    let ambient = null;
    if (!hasLights) {
      // 1x1 mid-grey PNG as the six faces of a diffuse cube map: a uniform, weak ambient term
      const grey = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 128, g: 128, b: 128 } } }).png().toBuffer();
      ambient = { intensity: 0.2, dataUri: `data:image/png;base64,${grey.toString('base64')}` };
    }
    wrapper = buildWrapper(camera, { headlight: !hasLights, bg: BG_RGB.map((c) => c / 255), glbUrl: 'model.glb', ambient });
    receipt.xiteWrapper = wrapper.replace(/base64,[A-Za-z0-9+/=]+/g, 'base64,...');
  }

  const server = await startServer({ glbPath: path.resolve(glb), wrapperX3d: wrapper });
  let browser = opts.browser ?? null;
  const ownBrowser = !browser;
  let context = null;
  let ok = false;
  let png = null;
  try {
    try {
      if (!browser) browser = await launchChromium();
    } catch (e) {
      receipt.error = `chromium launch failed: ${String(e.message).split('\n')[0]}`;
      receipt.timing.totalMs = Date.now() - t00;
      writeReceipt(json, receipt);
      return { ok: false, receipt, exitCode: 3 };
    }
    receipt.chromium = browser.version();
    context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    // NO NETWORK: every http(s)/ws(s) request that is not to our own 127.0.0.1 server is aborted here, before it leaves the
    // browser (this also covers requests made from Web Workers, e.g. Babylon's KTX2 / Draco worker pools). The launch flags
    // (--no-proxy-server, --host-resolver-rules) alone did NOT stop a Babylon worker from reaching cdn.babylonjs.com in this sandbox.
    await context.route(/^(https?|wss?):/i, (route) => {
      const u = route.request().url();
      if (u.startsWith(server.origin + '/')) return route.continue();
      receipt.network.blocked.push(`${route.request().method()} ${u} -> blocked by render oracle (no network at render time)`);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    receipt.userAgent = await page.evaluate(() => navigator.userAgent);

    // ---- capture everything the page says ----
    const seenConsole = new Set();
    const onConsole = (m) => {
      const text = m.text();
      const key = `${m.type()}|${text}`;
      if (seenConsole.has(key)) return;
      seenConsole.add(key);
      if (m.type() === 'error') receipt.console.errors.push(text);
      else if (m.type() === 'warning') receipt.console.warnings.push(text);
    };
    page.on('console', onConsole);
    page.on('worker', (w) => w.on('console', onConsole));
    page.on('pageerror', (e) => receipt.console.errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
      const u = r.url();
      const err = r.failure()?.errorText ?? 'failed';
      const entry = `${r.method()} ${u} -> ${err}`;
      if (/^(https?|wss?):/i.test(u) && !u.startsWith(server.origin + '/')) {
        if (!receipt.network.blocked.some((b) => b.includes(u))) receipt.network.blocked.push(entry); // tried to leave 127.0.0.1
      } else if (/ERR_ABORTED/.test(err)) receipt.network.aborted.push(entry); // e.g. X_ITE drops its fetch after reading the body
      else receipt.network.failed.push(entry);
    });
    page.on('response', (r) => {
      if (r.status() >= 400) receipt.network.httpErrors.push(`${r.status()} ${r.url()}`);
    });

    const pageUrl = `${server.origin}/pages/${eng.page}`;
    const params = {
      size,
      camera,
      glbUrl: '/model.glb',
      wrapperUrl: '/wrapper.x3d',
      hasLights,
      declaredLights: info.declaredLights,
    };

    let pageResult = null;
    try {
      pageResult = await withTimeout(
        (async () => {
          await page.goto(pageUrl, { waitUntil: 'load' });
          await page.waitForFunction(() => window.__pageReady === true, null, { timeout: timeoutMs });
          return page.evaluate((p) => window.__render(p), params);
        })(),
        timeoutMs,
        `rendering with ${engine}`,
      );
      ok = true;
    } catch (e) {
      receipt.error = String(e?.message ?? e).split('\n').slice(0, 6).join(' | ');
    }

    if (pageResult) {
      const { engine: _e, version: _v, ...rest } = pageResult;
      if (rest.notes) receipt.notes.push(...rest.notes);
      delete rest.notes;
      Object.assign(receipt, pickDefined(rest, ['lighting', 'colour', 'decoderConfig', 'stats', 'loaderErrors', 'glInfo', 'ktx2', 'xite', 'babylon']));
      receipt.timing.loadMs = round1(rest.loadMs);
      receipt.timing.settleMs = round1(rest.settleMs);
      receipt.decoders = rest.decoders;
    }

    // WebGL identity of the browser (same GPU process as the page's context)
    try {
      receipt.webgl = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return { webgl2: false };
        const e = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          webgl2: true,
          version: gl.getParameter(gl.VERSION),
          renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          compressedTextureExtensions: gl.getSupportedExtensions().filter((x) => /compressed_texture|texture_compression/i.test(x)),
        };
      });
    } catch (e) {
      receipt.webgl = { error: String(e.message).split('\n')[0] };
    }

    // decoder assets that the page really pulled from the local server
    const served = server.log.filter((l) => l.status === 200).map((l) => l.path);
    const fetchedBy = (re) => [...new Set(served.filter((p) => re.test(p)))];
    if (receipt.decoders) {
      for (const k of Object.keys(ASSET_PATTERNS)) {
        const d = (receipt.decoders[k] ??= { calls: null });
        d.declaredInGlb = { draco: info.usesDraco, meshopt: info.usesMeshopt, ktx2: info.usesKtx2 }[k];
        d.assetsFetched = fetchedBy(ASSET_PATTERNS[k]);
        // invoked: engine-side call counter when we have one (three, Babylon); otherwise (X_ITE) the evidence is that the
        // file needs the codec AND the decoder asset was served AND the load succeeded.
        d.invoked = d.calls != null ? d.calls > 0 : Boolean(d.declaredInGlb && d.assetsFetched.length > 0 && ok);
      }
    }

    if (ok) {
      // ---- one picture, taken from the compositor (what a viewer would see) ----
      png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
      receipt.image = await backgroundStats(png);
      receipt.image.sha256 = crypto.createHash('sha256').update(png).digest('hex');
    }
  } finally {
    try {
      await context?.close();
    } catch {
      /* ignore */
    }
    if (ownBrowser && browser) await browser.close().catch(() => {});
    await server.close();
  }

  receipt.loaded = ok;
  receipt.degraded = ok && (receipt.console.errors.length > 0 || receipt.network.failed.length > 0 || receipt.network.httpErrors.length > 0 || receipt.network.blocked.length > 0);
  if (ok && receipt.stats && receipt.stats.triangles === 0) receipt.notes.push('engine reports 0 triangles after load: nothing drawable was created');
  if (ok && receipt.image && receipt.image.nonBackgroundFraction < 0.001) receipt.notes.push('picture is blank (no pixel differs from the background)');
  receipt.timing.totalMs = Date.now() - t00;

  if (ok && out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, png);
    receipt.png = path.resolve(out);
  } else if (!ok && out) {
    fs.rmSync(out, { force: true }); // no stale PNG after a failed load
  }
  writeReceipt(json, receipt);
  return { ok, receipt, exitCode: ok ? 0 : 2, png };
}

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
function pickDefined(o, keys) {
  const r = {};
  for (const k of keys) if (o[k] !== undefined) r[k] = o[k];
  return r;
}
function writeReceipt(file, receipt) {
  if (!file) return;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
}

export class UsageError extends Error {}

const USAGE = `usage: node render/render.mjs --engine three|babylon|xite --glb FILE.glb --out FILE.png
         [--size 512] [--camera JSON | --frame-from ORIG.glb] [--json receipt.json] [--timeout-ms 60000]
camera JSON: {"position":[x,y,z],"target":[x,y,z],"up":[0,1,0],"fov":0.7854}   (fov = vertical, radians)
exit: 0 ok, 1 usage, 2 load failed (receipt written, no PNG), 3 chromium cannot launch`;

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        engine: { type: 'string' },
        glb: { type: 'string' },
        out: { type: 'string' },
        size: { type: 'string', default: '512' },
        camera: { type: 'string' },
        'frame-from': { type: 'string' },
        json: { type: 'string' },
        'timeout-ms': { type: 'string', default: String(TIMEOUT_MS) },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (e) {
    console.error(e.message + '\n' + USAGE);
    process.exit(1);
  }
  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (!values.engine || !values.glb || !values.out) {
    console.error('--engine, --glb and --out are required\n' + USAGE);
    process.exit(1);
  }
  if (values.camera && values['frame-from']) {
    console.error('use either --camera or --frame-from, not both');
    process.exit(1);
  }
  let res;
  try {
    res = await renderGlb({
      engine: values.engine,
      glb: values.glb,
      out: values.out,
      size: Number(values.size),
      camera: values.camera,
      frameFrom: values['frame-from'],
      json: values.json,
      timeoutMs: Number(values['timeout-ms']),
    });
  } catch (e) {
    if (e instanceof UsageError || e instanceof SyntaxError || /^camera\./.test(e.message)) {
      console.error(`error: ${e.message}\n${USAGE}`);
      process.exit(1);
    }
    throw e;
  }
  const r = res.receipt;
  const line = [
    `${r.engine.id} ${r.engine.version}`,
    r.loaded ? 'loaded' : 'FAILED',
    r.stats ? `meshes=${r.stats.meshes} tris=${r.stats.triangles}` : '',
    `errors=${r.console.errors.length} warnings=${r.console.warnings.length}`,
    r.degraded ? 'DEGRADED' : '',
    r.png ? `-> ${r.png}` : '',
  ]
    .filter(Boolean)
    .join('  ');
  console.log(line);
  if (!r.loaded) console.error(`render failed: ${r.error}`);
  process.exit(res.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(4);
  });
}
