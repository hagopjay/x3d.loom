import { readFile } from "node:fs/promises";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && !specifier.includes("?")) {
    try { return await nextResolve(specifier + ".ts", context); } catch {}
  }
  if (specifier.endsWith(".wasm?url")) {
    const result = await nextResolve(specifier.slice(0, -4), context);
    return { url: result.url + "?url", shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".wasm?url")) {
    const bytes = await readFile(new URL(url.slice(0, -4)));
    const dataUrl = "data:application/wasm;base64," + bytes.toString("base64");
    return { format: "module", source: `export default ${JSON.stringify(dataUrl)}`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
