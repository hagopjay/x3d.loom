// Node loader for the web-only physx-js-webidl build: pretend to be a worker and hand it the wasm bytes.
import { readFileSync } from 'node:fs';
import { PhysXContext } from '../src/bridge/world.ts';
const DIR = new URL('../node_modules/physx-js-webidl/', import.meta.url).pathname;
let ctx: Promise<PhysXContext> | null = null;
export function physx(): Promise<PhysXContext> {
  return (ctx ??= (async () => {
    const factory = (await import(DIR + 'physx-js-webidl.mjs')).default;
    const g = globalThis as Record<string, unknown>;
    const proc = g.process;
    Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true, writable: true });
    g.WorkerGlobalScope = function () {};
    let p: Promise<unknown>;
    try { p = factory({ wasmBinary: readFileSync(DIR + 'physx-js-webidl.wasm') }); }
    finally { Object.defineProperty(globalThis, 'process', { value: proc, configurable: true, writable: true }); }
    const P = await p;
    delete g.WorkerGlobalScope;
    return new PhysXContext(P);
  })());
}
