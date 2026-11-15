// receipts/corpus.json: the glbs the matrix ran on, by sha256, with where each one is published. The matrix itself prints file names only, never machine paths.
//   node tools/corpus-manifest.mjs receipts/corpus-files.txt receipts/corpus.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ORIGIN = [
  [/x3d-blender-io\/docs\/brag\//, 'x3d-blender-io@54aba0c:docs/brag/'],
  [/x3d\.castle\/results\/exporter-70\/sample-glb\//, 'x3d.castle@0a1073f:results/exporter-70/sample-glb/'],
];
const [listFile, outFile] = process.argv.slice(2);
const files = fs.readFileSync(listFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const rows = files.map((f) => {
  const b = fs.readFileSync(f), name = path.basename(f);
  let origin = null;
  for (const [rx, prefix] of ORIGIN) { const m = rx.exec(f); if (m) origin = prefix + f.slice(m.index + m[0].length); }
  return { file: name, bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex'), origin: origin || 'Unreal-lane upload pack (not committed to a repository; the sha256 identifies the file)' };
});
fs.writeFileSync(outFile, JSON.stringify({ schema: 'x3d.gltf.corpus/v1', files: rows }, null, 1) + '\n');
console.log(rows.map((r) => `${r.file.padEnd(60)} ${String(r.bytes).padStart(8)}  ${r.origin}`).join('\n'));
