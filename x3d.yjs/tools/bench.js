// node tools/bench.js   -> markdown tables. Rig is printed first; every number is wall time on that rig (no GPU involved).
import * as Y from 'yjs'
import os from 'node:os'
import { X3DDoc, ROOT } from '../src/yx3d.js'
const t = (f, n = 1) => { const a = performance.now(); for (let i = 0; i < n; i++) f(i); return (performance.now() - a) / n }
const scene = n => `<X3D profile="Full" version="4.0"><Scene>${Array.from({ length: n }, (_, i) => `<Transform DEF="T${i}" translation="${i} 0 0"><Shape><Appearance><Material diffuseColor="1 0 0"/></Appearance><Box/></Shape></Transform>`).join('')}</Scene></X3D>`
console.log(`rig: node ${process.version}, yjs ${(await import('yjs/package.json', { with: { type: 'json' } })).default.version}, ${os.cpus()[0].model.trim()} x${os.cpus().length}\n`)
console.log('| scene | nodes | loadXML ms | toXML ms | tree() ms | state bytes | state gz-free bytes/node |\n|---|---|---|---|---|---|---|')
const docs = {}
for (const n of [100, 1000, 10000]) {
  const d = new X3DDoc(); const xml = scene(n)
  const l = t(() => d.loadXML(xml)); const nodes = d.nodes.size
  const x = t(() => d.toXML()), tr = t(() => d.tree()); const st = Y.encodeStateAsUpdate(d.doc).length
  docs[n] = d
  console.log(`| ${n} Transform+Shape+Appearance+Material+Box | ${nodes} | ${l.toFixed(1)} | ${x.toFixed(1)} | ${tr.toFixed(1)} | ${st} | ${(st / nodes).toFixed(1)} |`)
}
console.log('\n| nodes | local setField ops/s (no observer) | with observer (field-only fast path) | add+remove pairs/s, incremental index | add+remove pairs/s, full rebuild (old path) | bytes per setField update | remote apply ops/s |\n|---|---|---|---|---|---|')
for (const n of [100, 1000, 10000]) {
  const d = docs[n], uid = d.findByDef('T' + (n >> 1)), N = 4000
  const a = t(i => d.setField(uid, 'translation', i + ' 0 0'), N)
  const off = d.observe(() => {}); const b = t(i => d.setField(uid, 'translation', i + ' 1 0'), N); off()
  const peer = new X3DDoc(); Y.applyUpdate(peer.doc, Y.encodeStateAsUpdate(d.doc))
  const sizes = []; peer.doc.on('update', u => sizes.push(u.length))
  const ups = []; d.doc.on('update', u => ups.push(u))
  for (let i = 0; i < 500; i++) d.setField(uid, 'translation', i + ' 2 0')
  const c = (() => { const p2 = new X3DDoc(); Y.applyUpdate(p2.doc, Y.encodeStateAsUpdate(d.doc)); const a0 = performance.now(); return p2 })()
  const p3 = new X3DDoc(); const base = Y.encodeStateAsUpdate(d.doc); Y.applyUpdate(p3.doc, base)
  const more = []; d.doc.on('update', u => more.push(u)); for (let i = 0; i < 2000; i++) d.setField(uid, 'translation', i + ' 3 0')
  const r0 = performance.now(); for (const u of more) Y.applyUpdate(p3.doc, u); const rops = more.length / ((performance.now() - r0) / 1000)
  const off2 = d.observe(() => {}); const e = t(i => { const u = d.addXML('<Box/>'); d.remove(u) }, 400); off2()
  const off3 = d.observe(() => {}, { full: true }); const e2 = t(i => { const u = d.addXML('<Box/>'); d.remove(u) }, n > 2000 ? 3 : 100); off3()
  console.log(`| ${d.nodes.size} | ${(1000 / a).toFixed(0)} | ${(1000 / b).toFixed(0)} | ${(1000 / e).toFixed(0)} | ${(1000 / e2).toFixed(1)} | ${Math.round(ups.reduce((s, u) => s + u.length, 0) / ups.length)} | ${rops.toFixed(0)} |`)
}
// the same structural edit when the scene has bounded fan-out (groups of 10): cost should not follow the scene size
console.log('\nStructural edit with fan-out 10 (balanced scene; add one Box under a leaf group, then remove it):\n\n| nodes | depth | pairs/s incremental | pairs/s full rebuild |\n|---|---|---|---|')
const tree10 = d => { const g = (lvl, id) => lvl === d ? `<Transform DEF="L${id}"><Shape><Appearance><Material diffuseColor="1 0 0"/></Appearance><Box/></Shape></Transform>` : `<Group DEF="G${id}">${Array.from({ length: 10 }, (_, i) => g(lvl + 1, id + i)).join('')}</Group>`; return `<X3D profile="Full" version="4.0"><Scene>${g(0, '')}</Scene></X3D>` }
for (const d of [2, 3, 4]) {
  const x = new X3DDoc().loadXML(tree10(d)); const leaf = x.findByDef('G' + '9'.repeat(d - 1))
  const o1 = x.observe(() => {}); const a = t(() => { const u = x.addXML('<Box/>', leaf); x.remove(u) }, 300); o1()
  const o2 = x.observe(() => {}, { full: true }); const b = t(() => { const u = x.addXML('<Box/>', leaf); x.remove(u) }, x.nodes.size > 2000 ? 3 : 60); o2()
  console.log(`| ${x.nodes.size} | ${d} | ${(1000 / a).toFixed(0)} | ${(1000 / b).toFixed(1)} |`)
}
// convergence fuzz at scale: 200 seeds x 3 peers x 300 ops
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 }
let ok = 0, idxOk = 0; const kinds = {}
const t0 = performance.now()
for (let seed = 1; seed <= 200; seed++) {
  const r = rng(seed), P = [new X3DDoc(), new X3DDoc(), new X3DDoc()]
  P[0].loadXML(scene(6)); for (const p of P.slice(1)) Y.applyUpdate(p.doc, Y.encodeStateAsUpdate(P[0].doc))
  const offs = P.map(p => p.observe(() => {}))
  const pick = a => a[Math.floor(r() * a.length)]
  for (let i = 0; i < 300; i++) {
    const p = pick(P), u = [...p.nodes.keys()]; if (!u.length) continue; const k = r()
    if (k < 0.45) p.setField(pick(u), pick(['translation', 'scale', 'size']), `${(r() * 9).toFixed(1)} 1 2`)
    else if (k < 0.6) p.addXML('<Transform><Shape><Box/></Shape></Transform>', r() < 0.5 ? ROOT : pick(u))
    else if (k < 0.72) p.remove(pick(u))
    else if (k < 0.88) { const a = pick(u), b = pick(u); if (a !== b) p.move(a, r() < 0.2 ? ROOT : b) }
    else if (k < 0.92) p.addXML(`<Appearance DEF="D${Math.floor(r() * 3)}"/>`, pick(u), 'appearance')
    else { const q = pick(P); if (q !== p) Y.applyUpdate(q.doc, Y.encodeStateAsUpdate(p.doc, Y.encodeStateVector(q.doc))) }
  }
  for (let k = 0; k < 2; k++) for (const x of P) for (const y of P) if (x !== y) Y.applyUpdate(y.doc, Y.encodeStateAsUpdate(x.doc, Y.encodeStateVector(y.doc)))
  const x = P.map(p => p.toXML()); if (x[0] === x[1] && x[1] === x[2]) ok++
  P.forEach((p, i) => { const got = [...offs[i].index()].map(([u, c]) => u + c.parent + c.slot).sort().join(), want = [...p.index()].map(([u, c]) => u + c.parent + c.slot).sort().join(); if (got === want) idxOk++ })
  for (const c of P[0].tree().conflicts) kinds[c.kind] = (kinds[c.kind] || 0) + 1
  kinds.orphans = (kinds.orphans || 0) + P[0].tree().orphans.length
}
console.log(`\nfuzz: ${ok}/200 seeds converged, incremental index equals the full rebuild on ${idxOk}/600 peer copies (3 peers, 300 random ops each: setField, add, remove, move, SFNode-slot add, partial syncs), ${((performance.now() - t0) / 1000).toFixed(1)} s; reported by tree() across all seeds: ${JSON.stringify(kinds)}`)
