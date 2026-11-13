import { register } from "node:module";

// Node 24 erases TypeScript types. This loader supplies Vite's WASM ?url import.
register(new URL("./wasm-url-loader.mjs", import.meta.url));
