import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validateX3DJson, parseLlmX3D, repairPrompt, NODE_NAMES } from '../src/index.ts';
import { restrictSchema, nodeDefNames } from '../src/restrict.ts';
import { loadFixedSchema, generate, UPSTREAM_SHA1 } from '../tools/gen.mjs';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020');
const { schema, sha1, fixed } = loadFixedSchema();
const mk = () => new Ajv2020({ strict: false, validateFormats: false });
const ajvOk = mk().compile(schema);

const doc = (...children: unknown[]) => ({ X3D: { encoding: 'UTF-8', '@profile': 'Full', '@version': '4.0', Scene: { '-children': children } } });
const shape = (geometry: unknown) => ({ Shape: { '-geometry': geometry } });

// id prefix zod-NNN: stable handles for the receipts and the docs section
const GOOD: [string, unknown][] = [
  ['zod-g01 box', doc(shape({ Box: { '@size': [1, 2, 3] } }))],
  ['zod-g02 DEF/USE', doc({ Transform: { '@DEF': 'T', '-children': [shape({ Sphere: {} })] } }, { Transform: { '@USE': 'T' } })],
  ['zod-g03 navinfo array', doc({ NavigationInfo: { '@type': ['EXAMINE', 'ANY'] } })],
  ['zod-g04 geoSystem tuple', doc({ GeoLocation: { '@geoSystem': ['GD', 'WE'] } })],
  // positions past minItems may be absent: arm 8 of @geoSystem is prefixItems x4 with minItems 2 (found by the corpus run, TransmitterPdu.x3d)
  ['zod-g06 geoSystem short tuple', doc({ GeoLocation: { '@geoSystem': ['UTM', 'Z3', 'N'] } })],
  ['zod-g07 geoSystem one-element', doc({ GeoLocation: { '@geoSystem': ['GC'] } })],
  ['zod-g05 head meta', { X3D: { encoding: 'UTF-8', '@profile': 'Interchange', '@version': '4.0', head: { meta: [{ '@name': 'title', '@content': 'x' }] }, Scene: { '-children': [{ WorldInfo: { '@title': 't' } }] } } }],
];
const BAD: [string, unknown][] = [
  ['zod-b01 size length', doc(shape({ Box: { '@size': [1, 2] } }))],
  ['zod-b02 unknown node', doc({ Teapot: {} })],
  ['zod-b03 misspelled field', doc(shape({ Box: { '@sizee': [1, 1, 1] } }))],
  ['zod-b04 navinfo bare string', doc({ NavigationInfo: { '@type': 'EXAMINE' } })],
  ['zod-b05 bad encoding enum', { X3D: { ...(doc() as any).X3D, encoding: 'ASCII' } }],
  ['zod-b06 missing Scene', { X3D: { encoding: 'UTF-8', '@profile': 'Full', '@version': '4.0' } }],
  ['zod-b07 string where number', doc(shape({ Sphere: { '@radius': 'big' } }))],
  ['zod-b08 USE with extra field', doc({ Transform: { '@USE': 'T', '@scale': [1, 1, 1] } })],
  ['zod-b10 geoSystem too long', doc({ GeoLocation: { '@geoSystem': ['GC', 'WGS84'] } })],
  ['zod-b11 geoSystem too short', doc({ GeoLocation: { '@geoSystem': ['UTM'] } })],
  ['zod-b12 geoSystem six elements', doc({ GeoLocation: { '@geoSystem': ['UTM', 'Z3', 'N', 'WGS84', 'S', 'N'] } })],
  ['zod-b09 color out of range', doc(shape({ Box: {} }), { Background: { '@skyColor': [2, 0, 0] } })],
];

test('zod-001 bundled schema is the upstream file; the one known fix is applied', () => {
  assert.equal(sha1, UPSTREAM_SHA1);
  assert.equal(fixed, 1);
});

test('zod-002 generated file is up to date with the schema', () => {
  assert.equal(readFileSync(new URL('../src/generated/x3d.zod.ts', import.meta.url), 'utf8'), generate(schema));
});

for (const [name, d] of GOOD) test(`${name}: zod accepts, ajv accepts`, () => {
  const r = validateX3DJson(d);
  assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.issues.slice(0, 3)));
  assert.equal(ajvOk(d), true);
});

for (const [name, d] of BAD) test(`${name}: zod and ajv both reject`, () => {
  assert.equal(validateX3DJson(d).ok, false);
  assert.equal(ajvOk(d), false);
});

test('zod-003 issue paths use the x3d_mcp format', () => {
  const r = validateX3DJson(doc(shape({ Box: { '@size': [1, 2] } })));
  assert.ok(!r.ok);
  assert.ok(r.issues.some((i) => i.path.startsWith('X3D/Scene/-children/0/Shape/-geometry/Box/@size')), JSON.stringify(r.issues));
});

test('zod-004 parseLlmX3D handles fences, bad JSON, and builds a repair prompt', () => {
  const good = '```json\n' + JSON.stringify(doc(shape({ Box: {} }))) + '\n```';
  assert.equal(parseLlmX3D(good).ok, true);
  const bad = parseLlmX3D('{"X3D": ');
  assert.ok(!bad.ok && bad.issues[0].code === 'json_parse');
  const r = parseLlmX3D(JSON.stringify(doc({ Teapot: {} })));
  assert.ok(!r.ok);
  assert.match(repairPrompt(r.issues), /Web3D X3D 4\.0 JSON Schema/);
});

test('zod-005 node count: 364 defs, 261 scene nodes', () => {
  assert.equal(NODE_NAMES.length, 364);
  assert.equal(nodeDefNames(schema).length, 261);
});

const VOCAB = ['Transform', 'Group', 'Shape', 'Appearance', 'Material', 'Box', 'Sphere', 'Cone', 'Cylinder', 'Viewpoint', 'NavigationInfo', 'WorldInfo'];
for (const lean of [false, true]) test(`zod-006 restricted schema (lean=${lean}) keeps the vocabulary and refuses the rest`, () => {
  const r = mk().compile(restrictSchema(schema, { nodes: VOCAB, lean }));
  assert.equal(r(doc(shape({ Box: { '@size': [1, 2, 3] } }), { WorldInfo: { '@title': 't' } })), true);
  assert.equal(r(doc(shape({ Torus: {} }))), false);
  assert.equal(r(doc({ PointLight: {} })), false);          // valid X3D, outside the vocabulary
  assert.equal(ajvOk(doc({ PointLight: {} })), true);
  assert.equal(r(doc(shape({ Box: { '@size': [1, 2] } }))), false);   // field typing survives restriction
});

test('zod-007 restricted schemas are much smaller than the full one', () => {
  const full = JSON.stringify(schema).length;
  const lean = JSON.stringify(restrictSchema(schema, { nodes: VOCAB, lean: true })).length;
  assert.ok(lean < full / 20, `${lean} vs ${full}`);
});

test('zod-008 a document nested past the Zod stack is reported as not-checked, never as valid', () => {
  let node: any = { Shape: {} };
  for (let i = 0; i < 5000; i++) node = { Transform: { '-children': [node] } };
  const r = validateX3DJson(doc(node));
  assert.ok(!r.ok && r.issues[0].code === 'stack_depth');
});

test('zod-010 a failed union points at the arm the document meant (not at the USE arm, not at "Invalid input")', () => {
  const nav = validateX3DJson(doc({ NavigationInfo: { '@type': 'EXAMINE' } }));
  assert.ok(!nav.ok && nav.issues.length === 1);
  assert.equal(nav.issues[0].path, 'X3D/Scene/-children/0/NavigationInfo/@type');
  assert.match(nav.issues[0].message, /expected array, received string/);
  const rad = validateX3DJson(doc({ Transform: { '-children': [shape({ Sphere: { '@radius': '0.36' } })] } }));
  assert.ok(!rad.ok);
  assert.equal(rad.issues[0].path, 'X3D/Scene/-children/0/Transform/-children/0/Shape/-geometry/Sphere/@radius');
  assert.match(rad.issues[0].message, /expected number, received string/);
});

test('zod-011 restrictSchema refuses unknown node names (same rule as x3d_mcp llm_schema.py)', () => {
  assert.throws(() => restrictSchema(schema, { nodes: ['Box', 'Teapot'] }), /Teapot/);
  assert.throws(() => restrictSchema(schema, { nodes: ['X3D'] }), /X3D/);
});

// Parity guard with x3d_mcp tests/test_llm_schema.py: both sides hash the same four restricted schemas.
test('zod-012 restricted schemas hash to the values x3d_mcp pins', async () => {
  const { createHash } = await import('node:crypto');
  const canon = (o: any): any => Array.isArray(o) ? o.map(canon) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])])) : o;
  const sha = (nodes: string[], lean: boolean) => createHash('sha1').update(JSON.stringify(canon(restrictSchema(schema, { nodes, lean })))).digest('hex').slice(0, 12);
  const STARTER = ['Transform', 'Group', 'Shape', 'Appearance', 'Material', 'Box', 'Sphere', 'Cone', 'Cylinder', 'Viewpoint', 'NavigationInfo', 'WorldInfo'];
  const got = { starterFull: sha(STARTER, false), starterLean: sha(STARTER, true) };
  assert.deepEqual(got, PINNED, JSON.stringify(got));
});
const PINNED = { starterFull: '339dee2fc602', starterLean: '2e7ef1bfc403' };
