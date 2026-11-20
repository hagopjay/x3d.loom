#!/usr/bin/env node
// One image per run: rows = assets, columns = reference + engines, each tile labelled with its encode-matched SSIM / PSNR-fg and verdict.
//   node tools/contact-sheet.mjs runs/<id> [--tile 192]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.resolve(process.argv[2]);
const tile = Number(process.argv[process.argv.indexOf('--tile') + 1]) || 192;
const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
const cols = ['khronos', 'three', 'babylon', 'xite', 'cycles'];
const label = 34, left = 210, head = 30;
const W = left + cols.length * tile, H = head + run.assets.length * (tile + label);
const colour = { pass: '#3fb950', warn: '#d29922', fail: '#f85149', reference: '#58a6ff', error: '#f85149', not_run: '#8b949e' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#0d1117"/><style>text{font-family:DejaVu Sans,Arial,sans-serif;fill:#e6edf3}</style>`;
cols.forEach((c, i) => { svg += `<text x="${left + i * tile + 6}" y="20" font-size="14" font-weight="bold">${c === 'khronos' ? 'Khronos (reference)' : c}</text>`; });
const comps = [];
run.assets.forEach((a, r) => {
  const y = head + r * (tile + label);
  svg += `<text x="8" y="${y + tile / 2}" font-size="13" font-weight="bold">${esc(a.id)}</text>`;
  if (a.consensus?.reference_suspect) svg += `<text x="8" y="${y + tile / 2 + 36}" font-size="11" fill="#d29922">engines agree: reference suspect</text>`;
  if (a.semantic) svg += `<text x="8" y="${y + tile / 2 + 18}" font-size="11" fill="${a.semantic.verdict === 'pass' ? '#3fb950' : '#f85149'}">semantic ${a.semantic.verdict} (${a.semantic.rules.length} rules)</text>`;
  cols.forEach((c, i) => {
    const row = a.runs.find((x) => x.id === c);
    const png = path.join(dir, a.id, `${c}.png`);
    if (fs.existsSync(png)) comps.push({ input: png, left: left + i * tile, top: y, resize: true });
    if (row) {
      const m = row.matched;
      const t = row.status === 'reference' ? 'reference' : m ? `${row.status} · SSIM ${m.ssim} · ${m.psnr_fg_db} dB` : row.status;
      svg += `<text x="${left + i * tile + 4}" y="${y + tile + 22}" font-size="11" fill="${colour[row.status] ?? '#e6edf3'}">${esc(t)}</text>`;
    }
  });
});
svg += '</svg>';
const tiles = await Promise.all(comps.map(async (c) => ({ input: await sharp(c.input).resize(tile, tile).png().toBuffer(), left: c.left, top: c.top })));
const out = path.join(dir, 'contact-sheet.png');
await sharp(Buffer.from(svg)).composite(tiles).png().toFile(out);
console.log(out);
