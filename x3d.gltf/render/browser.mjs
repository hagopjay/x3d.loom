// Playwright + Chromium plumbing shared by render.mjs, matrix.mjs and the tests.

import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);

/** Resolves the globally installed Playwright (NODE_PATH, then a few known locations). */
export function loadPlaywright() {
  const tried = [];
  const candidates = [
    () => require('playwright'),
    () => require('playwright-core'),
    ...['/opt/node-tools/node_modules/playwright', '/usr/local/lib/node_modules_global/playwright', '/opt/node22/lib/node_modules/playwright'].map(
      (p) => () => require(p),
    ),
  ];
  for (const c of candidates) {
    try {
      return c();
    } catch (e) {
      tried.push(String(e.message).split('\n')[0]);
    }
  }
  throw new Error(`cannot resolve playwright (${tried.join(' | ')})`);
}

// WebGL2 on a GPU-less box: ANGLE on SwiftShader (software Vulkan).
// Network: no proxy, and every host except 127.0.0.1 fails to resolve, so a decoder that is not served
// locally cannot be silently fetched from a CDN. The failure then shows up as a request error.
export const CHROMIUM_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--force-color-profile=srgb',
  '--disable-lcd-text',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-proxy-server',
  '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

export async function launchChromium(extra = {}) {
  const { chromium } = loadPlaywright();
  return chromium.launch({ args: CHROMIUM_ARGS, ...extra });
}

/** Returns {ok, version, error}. Used by the tests to decide skip vs fail. */
export async function probeChromium() {
  try {
    const b = await launchChromium();
    const version = b.version();
    await b.close();
    return { ok: true, version };
  } catch (e) {
    return { ok: false, error: String(e.message).split('\n')[0] };
  }
}

export function pkgVersion(pkgDir) {
  return JSON.parse(fs.readFileSync(`${pkgDir}/package.json`, 'utf8')).version;
}
