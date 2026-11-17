// Real XML DOM parser in Node. Native-browser DOM behavior is a separate smoke check.
import { DOMParser } from 'linkedom';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const source = ['core','level','recipes','game','x3dio'].map(f => fs.readFileSync(new URL('src/' + f + '.js', root), 'utf8')).join('\n');
const M = vm.runInNewContext(source + '\n({createLabWorld,toX3D,fromX3D});', { DOMParser, TextEncoder });
let count = 0;
for (const recipe of ['museum', 'skyline', 'cascade', 'tidal', 'carnival']) {
  const original = M.toX3D(M.createLabWorld(recipe, 7));
  const imported = M.fromX3D(original), again = M.toX3D(imported);
  assert.equal(again, original); count++;
  console.log('PASS XML DOM canonical round trip: ' + recipe);
}
const original = M.toX3D(M.createLabWorld('museum', 7));
for (const [name, candidate] of [
  ['negative geometry', original.replace("radius='0.5'", "radius='-0.5'")],
  ['nonfinite gravity', original.replace("gravity='0 -30 0'", "gravity='0 NaN 0'")],
  ['unsupported 3D orientation', original.replace("orientation='0 0 1 0'", "orientation='1 0 0 0.3'")],
  ['entity declaration', original.replace('<Scene>', '<!ENTITY bad "x"><Scene>')],
  ['script capability', original.replace('<Scene>', '<Scene><Script/>')]
]) {
  assert.notEqual(candidate, original, name + ' mutation must change the specimen');
  assert.throws(() => M.fromX3D(candidate)); count++;
  assert.equal(M.toX3D(M.createLabWorld('museum', 7)), original); count++;
  console.log('PASS refused ' + name + '; repaired twin retained');
}
console.log(count + ' XML DOM controls pass (linkedom; not a browser render test).');
