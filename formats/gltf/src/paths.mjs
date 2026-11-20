// Where things live. The engines (three, Babylon, X_ITE) and their render oracle are reused from the sibling lane ../../x3d.gltf.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOOM = path.resolve(ROOT, '..', '..');
export const GLTF_LANE = path.join(LOOM, 'x3d.gltf');
export const NODE_MODULES = path.join(ROOT, 'node_modules');
export const PAGES = path.join(ROOT, 'pages');
