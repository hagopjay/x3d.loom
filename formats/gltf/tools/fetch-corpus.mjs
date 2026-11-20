#!/usr/bin/env node
// Fetch the pinned Khronos glTF-Sample-Assets subset into corpus/cache/ and check every sha256 against corpus/manifest.json.
//   node tools/fetch-corpus.mjs            fetch missing files, verify all
//   node tools/fetch-corpus.mjs --pin      (maintainers) record sha256 of what was fetched into the manifest
// The cache is git-ignored: the corpus is named by commit + sha256, never copied into this repo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MANIFEST = path.join(ROOT, 'corpus', 'manifest.json');
const CACHE = path.join(ROOT, 'corpus', 'cache');

export function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}
export const cachePath = (asset) => path.join(CACHE, `${asset.id}.glb`);
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const assetUrl = (m, a) => `https://raw.githubusercontent.com/${m.repo}/${m.commit}/${a.path}`;

export async function ensureCorpus({ pin = false, log = console.log } = {}) {
  const m = loadManifest();
  fs.mkdirSync(CACHE, { recursive: true });
  for (const a of m.assets) {
    const f = cachePath(a);
    if (!fs.existsSync(f)) {
      const url = assetUrl(m, a);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
      fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
      log(`fetched ${a.id} <- ${url}`);
    }
    const buf = fs.readFileSync(f);
    const h = sha256(buf);
    if (pin) {
      a.sha256 = h;
      a.bytes = buf.length;
    } else if (a.sha256 !== h) {
      throw new Error(`CORPUS_DRIFT ${a.id}: manifest ${a.sha256} != cache ${h} (delete corpus/cache/${a.id}.glb to refetch)`);
    }
    log(`ok ${a.id.padEnd(30)} ${String(buf.length).padStart(9)} B  sha256 ${h.slice(0, 12)}`);
  }
  if (pin) fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
  return m;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureCorpus({ pin: process.argv.includes('--pin') }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
