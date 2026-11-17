import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root = new URL('../', import.meta.url);
const names = ['core', 'level', 'recipes', 'game', 'x3dio'];
const source = names.map(f => fs.readFileSync(new URL('src/' + f + '.js', root), 'utf8')).join('\n');
const M = vm.runInNewContext(source + '\n({LAB_WORLDS,createLabWorld,toX3D,getLevelStats});');
const rows = [];
for (const card of M.LAB_WORLDS) {
  const level = M.createLabWorld(card.id, 7), xml = M.toX3D(level);
  const name = card.id === 'museum' ? 'default-level.x3d' : card.id + '-seed-7.x3d';
  fs.writeFileSync(new URL('level/' + name, root), xml);
  rows.push({ path: 'level/' + name, recipe: card.id, seed: card.id === 'museum' ? null : 7,
    bytes: Buffer.byteLength(xml), sha256: crypto.createHash('sha256').update(xml).digest('hex'), stats: M.getLevelStats(level) });
}
const report = { schema: 'floplab.level-build/1',
  inputs: { tool_sha256: crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
    node: process.version,
    source: Object.fromEntries(names.map(f => [f + '.js', crypto.createHash('sha256').update(fs.readFileSync(new URL('src/' + f + '.js', root))).digest('hex')])) },
  levels: rows,
  scope: 'Deterministic authored source-level exports. Not a live gameplay checkpoint or a physics-parity claim.' };
fs.writeFileSync(new URL('receipts/showtime-levels.json', root), JSON.stringify(report, null, 2) + '\n');
for (const row of rows) console.log(row.path + ': ' + row.bytes + ' bytes, ' + row.stats.bodies + ' bodies');
