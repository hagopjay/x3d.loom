// Bundle the exact installed Three distribution and the static addon closure.
// This copies licensed upstream bytes; it does not rewrite library code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules/three');
const destination = path.join(root, 'vendor/three');
const packageInfo = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
if (packageInfo.version !== '0.187.0') throw new Error('Install the pinned three@0.187.0 before vendoring.');
const visited = new Set(), manifest = {};
function copy(relative) {
  const full = path.resolve(source, relative);
  if (!full.startsWith(source + path.sep)) throw new Error('Dependency leaves Three package');
  relative = path.relative(source, full).split(path.sep).join('/');
  if (visited.has(relative)) return;
  visited.add(relative);
  const bytes = fs.readFileSync(full), target = path.join(destination, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  manifest[relative] = { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  if (!relative.endsWith('.js')) return;
  const text = bytes.toString('utf8');
  // The pinned files use literal static relative ESM imports/exports. Record
  // the source version and file hashes so this narrow copy can be audited.
  for (const match of text.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) copy(path.join(path.dirname(relative), specifier));
    else if (specifier.startsWith('three/addons/')) copy('examples/jsm/' + specifier.slice('three/addons/'.length));
    else if (specifier !== 'three') throw new Error('Unexpected external module: ' + specifier);
  }
}
copy('LICENSE'); copy('build/three.module.js');
for (const name of ['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass']) copy('examples/jsm/postprocessing/' + name + '.js');
fs.writeFileSync(path.join(destination, 'ORIGIN.json'), JSON.stringify({
  schema: 'floplab.vendor/1', name: 'three', version: packageInfo.version,
  source: 'https://www.npmjs.com/package/three/v/0.187.0',
  repository: 'https://github.com/mrdoob/three.js',
  entrypoints: ['build/three.module.js', ...['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass'].map(n => 'examples/jsm/postprocessing/' + n + '.js')],
  import_map: { three: './vendor/three/build/three.module.js', 'three/addons/': './vendor/three/examples/jsm/' },
  scope: 'Unmodified installed package files and static relative addon dependency closure; not the entire npm package.',
  files: Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
}, null, 2) + '\n');
console.log('Vendored Three ' + packageInfo.version + ': ' + visited.size + ' files, ' + Object.values(manifest).reduce((n, x) => n + x.bytes, 0) + ' bytes.');
