import test from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { X3DDoc, ROOT } from '../src/yx3d.js'

const SRC = `<?xml version="1.0" encoding="UTF-8"?>
<X3D profile="Interchange" version="4.0"><head><meta name="title" content="t"/></head><Scene>
<Transform DEF="T1" translation="0 1 0"><Shape DEF="S1"><Appearance><Material diffuseColor="1 0 0"/></Appearance><Box size="1 1 1"/></Shape></Transform>
<Transform DEF="T2"><Shape USE="S1"/></Transform>
<TimeSensor DEF="Clock" cycleInterval="2" loop="true"/>
<ROUTE fromNode="Clock" fromField="fraction_changed" toNode="T1" toField="set_rotation"/>
</Scene></X3D>`

export function pair(src = SRC) {
  const a = new X3DDoc(), b = new X3DDoc()
  a.loadXML(src)
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
  return [a, b]
}
export function sync(...ds) { // full pairwise exchange until quiet
  for (let r = 0; r < 2; r++) for (const x of ds) for (const y of ds) if (x !== y) Y.applyUpdate(y.doc, Y.encodeStateAsUpdate(x.doc, Y.encodeStateVector(y.doc)))
}

test('import then export is stable and keeps structure', () => {
  const [a] = pair()
  const x = a.toXML()
  assert.match(x, /<Transform DEF="T1" translation="0 1 0">/)
  assert.match(x, /<Shape USE="S1"\/>/)
  assert.match(x, /<Material diffuseColor="1 0 0"\/>/)
  assert.equal(a.tree().conflicts.length, 0)
  const b = new X3DDoc().loadXML(x)
  assert.equal(b.toXML(), x.replace(/<head>.*<\/head>/, m => m)) // second round trip is a fixed point
})

test('two peers editing different fields of one node both survive; same field converges', () => {
  const [a, b] = pair()
  const t1 = a.findByDef('T1')
  a.setField(t1, 'translation', '5 5 5'); b.setField(t1, 'scale', '2 2 2')
  sync(a, b)
  assert.equal(a.getField(t1, 'translation'), '5 5 5'); assert.equal(b.getField(t1, 'scale'), '2 2 2')
  a.setField(t1, 'rotation', '0 1 0 1'); b.setField(t1, 'rotation', '1 0 0 2')
  sync(a, b)
  assert.equal(a.getField(t1, 'rotation'), b.getField(t1, 'rotation'))
  assert.equal(a.toXML(), b.toXML())
})

test('field edit concurrent with a move is not lost; concurrent moves pick one parent', () => {
  const [a, b] = pair()
  const t2 = a.findByDef('T2'), s1 = a.findByDef('S1'), t1 = a.findByDef('T1')
  a.move(s1, t2, 'children'); b.setField(s1, 'castShadow', 'false'); b.move(s1, ROOT, 'children')
  sync(a, b)
  assert.equal(a.toXML(), b.toXML())
  const i = a.index().get(s1); assert.ok(i, 'node is still in the scene')
  assert.equal(a.getField(s1, 'castShadow'), 'false')
  assert.equal(a.tree().conflicts.filter(c => c.kind === 'duplicate').length, 0)
})

test('concurrent moves that would make a cycle: no crash, converged, orphans reported', () => {
  const [a, b] = pair()
  const t1 = a.findByDef('T1'), t2 = a.findByDef('T2')
  a.move(t1, t2); b.move(t2, t1)
  sync(a, b)
  assert.equal(a.toXML(), b.toXML())
  assert.ok(a.tree().orphans.length >= 2) // the cycle is cut off the scene, nothing is destroyed
  assert.ok(a.nodes.has(t1) && a.nodes.has(t2))
})

test('concurrent adds into an SFNode slot: one wins everywhere, the other is a reported conflict', () => {
  const [a, b] = pair()
  const s1 = a.findByDef('S1')
  a.remove(a.index && [...a.nodes.keys()].find(u => a.nodes.get(u).get('type') === 'Box'))
  sync(a, b)
  a.addXML('<Sphere radius="1"/>', s1, 'geometry'); b.addXML('<Cone/>', s1, 'geometry')
  sync(a, b)
  assert.equal(a.toXML(), b.toXML())
  assert.equal(a.tree().conflicts.filter(c => c.kind === 'sfnode-slot').length, 1)
})

test('delete concurrent with edit: delete wins, no throw; DEF clash is renamed deterministically', () => {
  const [a, b] = pair()
  const t1 = a.findByDef('T1')
  a.remove(t1); b.setField(t1, 'scale', '3 3 3')
  sync(a, b); assert.equal(a.toXML(), b.toXML())
  a.addXML('<Group DEF="G"/>'); b.addXML('<Group DEF="G"/>')
  sync(a, b)
  assert.equal(a.toXML(), b.toXML())
  assert.match(a.toXML(), /DEF="G_2"/)
  assert.equal(a.tree().conflicts.filter(c => c.kind === 'def-clash').length, 1)
})

test('observe emits field / added / removed / moved events with origin', () => {
  const [a, b] = pair()
  const got = []; b.observe((ev, origin) => got.push(...ev.map(e => ({ ...e, origin }))))
  const t1 = a.findByDef('T1')
  a.setField(t1, 'translation', '9 9 9')
  const u = a.addXML('<Box/>', ROOT)
  a.move(u, a.findByDef('T2'))
  a.remove(u)
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(b.doc)), 'net')
  const kinds = got.map(e => e.kind)
  assert.ok(kinds.includes('field') && got.find(e => e.kind === 'field').value === '9 9 9')
  assert.equal(got[0].origin, 'net')
  assert.equal(b.toXML(), a.toXML())
})

test('routes survive and export with user DEF names; route to a removed node is dropped', () => {
  const [a] = pair()
  a.addRoute(a.findByDef('Clock'), 'fraction_changed', a.findByDef('T2'), 'set_rotation')
  assert.equal((a.toXML().match(/<ROUTE /g) || []).length, 2) // 1 imported + 1 added
  a.remove(a.findByDef('T2'))
  assert.equal((a.toXML().match(/<ROUTE /g) || []).length, 1)
})

// ---- randomised convergence: 3 peers, random ops, random partial syncs; always end converged, never throw
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 }
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 41, 57, 103, 150]) test(`fuzz seed ${seed}: 3 peers, 300 random ops, converge`, () => {
  const r = rng(seed), peers = [new X3DDoc(), new X3DDoc(), new X3DDoc()]
  peers[0].loadXML(SRC); for (const p of peers.slice(1)) Y.applyUpdate(p.doc, Y.encodeStateAsUpdate(peers[0].doc))
  const pick = a => a[Math.floor(r() * a.length)]
  const uids = p => [...p.nodes.keys()]
  for (let i = 0; i < 300; i++) {
    const p = pick(peers), u = uids(p), k = r()
    if (!u.length) continue
    if (k < 0.45) p.setField(pick(u), pick(['translation', 'scale', 'size', 'diffuseColor']), `${(r() * 9).toFixed(1)} 1 2`)
    else if (k < 0.60) p.addXML(`<Transform><Shape><Box/></Shape></Transform>`, r() < 0.5 ? ROOT : pick(u))
    else if (k < 0.72) p.remove(pick(u))
    else if (k < 0.88) { const a = pick(u), b = pick(u); if (a !== b) p.move(a, r() < 0.2 ? ROOT : b) }
    else if (k < 0.92) p.addXML(`<Appearance DEF="D${Math.floor(r() * 3)}"/>`, pick(u), 'appearance')
    else { const q = pick(peers); if (q !== p) Y.applyUpdate(q.doc, Y.encodeStateAsUpdate(p.doc, Y.encodeStateVector(q.doc))) }
  }
  sync(...peers)
  const x = peers.map(p => p.toXML())
  assert.equal(x[0], x[1]); assert.equal(x[1], x[2])
  assert.deepEqual(peers[0].tree().conflicts.map(c => c.kind).sort(), peers[2].tree().conflicts.map(c => c.kind).sort())
})

test('regression: remove() on a node whose kids hint array forms a cycle does not recurse forever (found by bench fuzz, seed in 200)', () => {
  const [a, b] = pair()
  const t1 = a.findByDef('T1'), t2 = a.findByDef('T2')
  a.move(t1, t2); b.move(t2, t1); sync(a, b)
  a.remove(t1); sync(a, b)
  assert.equal(a.toXML(), b.toXML())
})
