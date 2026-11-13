// node census.js SRC_DIR  -> JSON {defs:[...node types the reader knows]} : evaluates the reader parts in one scope (no DOM, no Babylon needed to load them)
const fs = require('fs'), path = require('path');
const src = process.argv[2];
const parts = ['brain/reader.js', 'gobbler/reader-ext.js', 'demiurge/reader-ext-dm.js', 'dynasty/reader-ext-dl.js', 'manifold/manifold-reader-ext.js', 'drift/drift-ext.js',
  ...(process.argv.slice(3))];
let code = 'class Body {}; var BABYLON = {}; var window = {}; var document = {getElementById(){return null;}};\n';
for (const p of parts) { const f = path.join(src, p); if (fs.existsSync(f)) code += fs.readFileSync(f, 'utf8') + '\n'; }
code += '\nreturn { defs: Object.keys(DEFS), container: CONTAINER };';
let out; try { out = new Function(code)(); } catch (e) { console.error('census failed:', e.message); process.exit(1); }
console.log(JSON.stringify(out));
