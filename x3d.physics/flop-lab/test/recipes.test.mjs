import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const source = ['core', 'level', 'recipes', 'game'].map(f => fs.readFileSync(new URL('src/' + f + '.js', root), 'utf8')).join('\n');
const M = vm.runInNewContext(source + '\n({createLabWorld, LAB_WORLDS, Sim, NOINPUT});');
let checks = 0;
for (const card of M.LAB_WORLDS) {
  const a = M.createLabWorld(card.id, 7), b = M.createLabWorld(card.id, 7);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.bodies.length > 0 && a.bodies.length <= 900);
  const ids = [...a.bodies, ...a.joints, ...a.zones].map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  const bodyIds = new Set(a.bodies.map(x => x.id));
  assert.ok(a.joints.every(j => bodyIds.has(j.a) && (!j.b || bodyIds.has(j.b))));
  const s = new M.Sim(a);
  for (let i = 0; i < 180; i++) s.step(M.NOINPUT, 1 / 60);
  assert.ok(s.W.bodies.every(x => Number.isFinite(x.x + x.y + x.a + x.vx + x.vy)));
  checks += 5;
  if (card.id !== 'museum') { assert.notEqual(JSON.stringify(a), JSON.stringify(M.createLabWorld(card.id, 8))); checks++; }
  console.log('PASS recipe ' + card.id + ': ' + a.bodies.length + ' bodies, 180 fixed steps finite');
}
for (const args of [['unknown', 7], ['skyline', -1], ['tidal', NaN], ['cascade', 2.4]]) {
  assert.throws(() => M.createLabWorld(...args)); checks++;
}
console.log('Recipe checks: ' + checks + ' pass. No renderer or cross-host result claimed.');
