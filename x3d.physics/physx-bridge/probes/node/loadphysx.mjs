// Node loader shim for the web-only physx-js-webidl build: pretend to be a worker, hand it the wasm bytes.
import { readFileSync } from 'node:fs';
const DIR = new URL('../../node_modules/physx-js-webidl/', import.meta.url).pathname;
export async function loadPhysX() {
  const factory = (await import(DIR + 'physx-js-webidl.mjs')).default;
  const proc = globalThis.process;
  Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true, writable: true });
  globalThis.WorkerGlobalScope = function () {};
  let p;
  try { p = factory({ wasmBinary: readFileSync(DIR + 'physx-js-webidl.wasm') }); }
  finally { Object.defineProperty(globalThis, 'process', { value: proc, configurable: true, writable: true }); }
  const P = await p; delete globalThis.WorkerGlobalScope; return P;
}
