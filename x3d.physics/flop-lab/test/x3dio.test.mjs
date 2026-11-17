// Pure data/codec controls. Native DOM import controls belong to the browser run.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = ['core', 'level', 'game', 'x3dio'].map(name => fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8')).join('\n');
const context = vm.createContext({ TextEncoder });
vm.runInContext(source + '\nglobalThis.api={defaultLevel,toX3D,validateLevel,validatePart,getLevelStats,x3dPreflight,parseMF,mfs};', context);
const A = context.api;
let count = 0;
function control(name, run) { run(); count++; console.log('PASS ' + name); }
function mutant(name, code, change) {
  control(name, () => {
    const broken = A.defaultLevel(); change(broken);
    assert.throws(() => A.validateLevel(broken), error => String(error.message).startsWith(code + ':'), code);
    assert.equal(A.validateLevel(A.defaultLevel()).valid, true, 'repaired default must pass the same healthy instrument');
  });
}
control('Default scene still exports byte-for-byte to its retained X3D', () => {
  const xml = A.toX3D(A.defaultLevel());
  assert.equal(xml, fs.readFileSync(new URL('../level/default-level.x3d', import.meta.url), 'utf8'));
  A.x3dPreflight(xml);
});
control('Stats distinguish actual model counts and centre-only bounds', () => {
  const stats = A.getLevelStats(A.defaultLevel());
  assert.equal(stats.bodies, 255); assert.equal(stats.joints, 182); assert.equal(stats.parts, 62);
  assert.match(stats.bounds.scope, /centres only/);
});
mutant('Negative dimensions are refused before world construction', 'X3D_NUMBER', L => { L.bodies.find(b => b.shape === 'box').w = -1; });
mutant('NaN position cannot be repaired silently by JSON cloning', 'X3D_NUMBER', L => { L.bodies[0].x = NaN; });
mutant('Infinity material friction is refused', 'X3D_NUMBER', L => { L.bodies[0].fric = Infinity; });
mutant('Negative restitution is refused', 'X3D_NUMBER', L => { L.bodies[0].rest = -0.1; });
mutant('Fractional substep counts are refused', 'X3D_NUMBER', L => { L.physics.substeps = 3.5; });
mutant('Unknown physics settings cannot disappear during export', 'X3D_UNSUPPORTED_FIELD', L => { L.physics.unsupported = 1; });
mutant('Body velocity fields cannot disappear during export', 'X3D_UNSUPPORTED_FIELD', L => { L.bodies[0].vx = 9; });
mutant('Duplicate global body identifiers are refused', 'X3D_DUPLICATE_DEF', L => { L.bodies[1].id = L.bodies[0].id; });
mutant('Body IDs colliding with derived visual IDs are refused', 'X3D_DUPLICATE_DEF', L => { L.bodies[1].id = 'C_' + L.bodies[0].id; });
mutant('Reserved world DEF cannot become a body', 'X3D_DUPLICATE_DEF', L => { L.bodies[0].id = 'WORLD'; });
mutant('Dangling joint endpoint is refused', 'X3D_REFERENCE', L => { L.joints[0].b = 'MissingBody'; });
mutant('Self-joint is refused', 'X3D_REFERENCE', L => { L.joints[0].b = L.joints[0].a; });
mutant('Reversed hinge bounds are refused', 'X3D_JOINT_LIMIT', L => { L.joints[0].min = 1; L.joints[0].max = -1; });
mutant('Region size is validated, not just body poses', 'X3D_NUMBER', L => { L.zones[0].h = 0; });
mutant('Water allocation is bounded independently of source body count', 'X3D_WATER_BUDGET', L => { L.zones.find(z => z.kind === 'water').w = 400; });
mutant('Pill sampling expansion is bounded independently of body count', 'X3D_PILL_BUDGET', L => { const b = L.bodies.find(b => b.shape === 'pill'); b.r = 0.001; b.hl = 80; });
mutant('Unknown kinematic channel is refused', 'X3D_KINEMATIC', L => { L.bodies.find(b => b.kin).kin.mystery = 1; });
mutant('Invalid prefab density is refused before expansion', 'X3D_PART_BUDGET', L => { const p = L.parts.find(p => p.kind === 'jelly'); p.p.cols = 20; p.p.rows = 20; });
mutant('Unknown prefab parameter is diagnosed, not discarded', 'X3D_PART_FIELD', L => { L.parts[0].p.unsupported = 10; });
control('Part updates reject out-of-range cannon power', () => {
  assert.throws(() => A.validatePart('cannon', { x: 0, y: 0, power: 900 }), /X3D_NUMBER/);
  assert.equal(A.validatePart('cannon', { x: 0, y: 0, power: 40 }).power, 40);
});
control('Finite source-size overflow is refused', () => { assert.throws(() => A.x3dPreflight(' '.repeat(2 * 1024 * 1024 + 1)), /X3D_BYTES/); });
for (const [name, source] of [
  ['external DTD', '<!DOCTYPE X3D SYSTEM "https://example.invalid/file.dtd"><X3D/>'],
  ['entity subset', '<!DOCTYPE X3D [<!ENTITY sample "bad">]><X3D/>'],
  ['CDATA payload', '<X3D><![CDATA[something]]></X3D>'],
  ['processing instruction', '<?injected path="file"?><X3D/>']
]) control(name + ' preflight is refused', () => assert.throws(() => A.x3dPreflight(source), /X3D_XML_DECLARATION/));
control('MFString retains quotes and backslashes rather than deleting them', () => {
  const value = 'a "quoted" path C:\\local\\lab';
  const encoded = A.mfs({ title: value });
  const result = A.parseMF(encoded, { _first: null });
  assert.equal(result.title, value);
});
control('MFString prototype keys and repeated keys are refused', () => {
  assert.throws(() => A.parseMF('"__proto__=value"', { _first: null }), /X3D_METADATA_KEY/);
  assert.throws(() => A.parseMF('"rest=0.1" "rest=0.9"', { _first: null }), /X3D_METADATA_KEY/);
  assert.throws(() => A.parseMF('"rest=0.1" trailing', { _first: null }), /X3D_METADATA/);
});
control('Small compliance survives the serializer', () => {
  const L = A.defaultLevel();
  assert.match(A.toX3D(L), /comp=0\.00001/);
});
console.log('\n' + count + ' X3D bridge controls passed. DOM and schema checks remain separate.');
