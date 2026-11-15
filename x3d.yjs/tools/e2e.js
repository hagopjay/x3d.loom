// Two real X_ITE browsers on one page, linked through Yjs: edits on A must show on B, pixel for pixel.
// playwright is expected on the machine (NODE_PATH), as in the three.js bridge rig.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { serve } from './serve.js'
const srv = await serve(); const port = srv.address().port
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const page = await br.newPage({ viewport: { width: 1200, height: 900 } })
page.on('console', m => { if (/error/i.test(m.type())) console.log('console.' + m.type(), m.text()) })
page.on('pageerror', e => console.log('pageerror', e.message))
await page.goto(`http://127.0.0.1:${port}/demo/index.html?xite=/xite/x_ite.min.js`)
await page.waitForFunction(() => window.demoReady, null, { timeout: 60000 })
const out = { rig: { chromium: br.version(), gl: 'SwiftShader', xite: '16.6.0' }, checks: {} }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const diff = async () => {
  await sleep(600)
  const a = await (await page.$('#ca')).screenshot(), b = await (await page.$('#cb')).screenshot()
  return page.evaluate(async ([a, b]) => {
    const dec = async s => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height).data }
    const [da, db] = [await dec(a), await dec(b)]; let s = 0, n = 0; for (let i = 0; i < da.length; i += 4) { const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); s += d; if (d > 6) n++ }
    return { meanAbs: s / (da.length / 4 * 3), diffPixels: n, total: da.length / 4 }
  }, [a.toString('base64'), b.toString('base64')])
}
const empty = await page.evaluate(() => { const c = document.querySelector('#ca'); return 1 })
out.checks.initial = await diff()
// 1. field edit on A, measure A-to-B latency to the SAI field on B
const lat = []
for (let i = 0; i < 20; i++) {
  lat.push(await page.evaluate(async i => {
    const d = window.demo, node = d.bb.currentScene.getNamedNode('y_' + d.B.findByDef('BoxT').replace(/\./g, '_'))
    const want = `${i - 5} ${i % 3} 0`
    const t0 = performance.now(); d.A.setField(d.A.findByDef('BoxT'), 'translation', want)
    for (let k = 0; k < 2000; k++) { const v = node.translation; if (Math.abs(v.x - (i - 5)) < 1e-4 && Math.abs(v.y - (i % 3)) < 1e-4) return performance.now() - t0; await new Promise(r => setTimeout(r, 0)) }
    return -1
  }, i))
}
out.checks.latency_ms_20_edits_inprocess_link = { values: lat.map(v => +v.toFixed(2)), median: [...lat].sort((a, b) => a - b)[10], max: Math.max(...lat) }
out.checks.afterFieldEdits = await diff()
// 2. structure: add on A, remove on B, move, route-free
await page.evaluate(() => { const d = window.demo; d.A.addXML('<Transform DEF="Zed" translation="0 1.8 0"><Shape><Appearance><Material diffuseColor="1 1 0"/></Appearance><Sphere radius="0.4"/></Shape></Transform>') })
await sleep(300); out.checks.afterAdd = await diff()
await page.evaluate(() => { const d = window.demo; d.B.move(d.B.findByDef('Zed'), d.B.findByDef('BoxT')) })
await sleep(300); out.checks.afterMove = await diff()
await page.evaluate(() => { const d = window.demo; d.B.remove(d.B.findByDef('Zed')) })
await sleep(300); out.checks.afterRemove = await diff()
// 3. offline both edit, reconnect, clash on one field
await page.evaluate(() => { const d = window.demo; d.AB.setOnline(false); d.A.setField(d.A.findByDef('BoxT'), 'translation', '-3 0 0'); d.B.setField(d.B.findByDef('BoxT'), 'translation', '3 0 0'); d.A.setField(d.A.findByDef('BoxM'), 'diffuseColor', '0 1 0'); d.B.setField(d.B.findByDef('BallT'), 'translation', '2 1 0') })
const mid = await diff()
await page.evaluate(() => window.demo.AB.setOnline(true)); await sleep(300)
out.checks.offlineDiverged = mid; out.checks.afterReconnect = await diff()
// 4. agent peer C edits with a bad op in the middle
out.agent = await page.evaluate(() => { const d = window.demo; return d.agentApply(d.C, [{ op: 'modify_node', def: 'BoxM', fields: { diffuseColor: '0 0 1' } }, { op: 'modify_node', def: 'Nope', fields: { a: '1' } }, { op: 'add_node', parent: '#scene', xml: '<Transform DEF="AG" translation="0 2 0"><Shape><Appearance><Material diffuseColor="1 0 1"/></Appearance><Sphere radius="0.3"/></Shape></Transform>' }], 'e2e') })
await sleep(300); out.checks.afterAgent = await diff()
out.final = await page.evaluate(() => { const d = window.demo; const want = []; const go = ns => ns.forEach(n => { want.push('y_' + n.uid.replace(/\./g, '_')); go(n.kids) }); go(d.A.tree().roots); want.sort(); const sa = d.adA.snapshot(), sb = d.adB.snapshot(); const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]); const h = x => x.toXML(); return { docNodes: want.length, xiteNodesA: sa.length, xiteNodesB: sb.length, xiteMatchesDocA: same(sa, want), xiteMatchesDocB: same(sb, want), convergedABC: h(d.A) === h(d.B) && h(d.B) === h(d.C), adapterA: d.adA.stats, adapterB: d.adB.stats, conflicts: d.A.tree().conflicts } })
out.screens = {}
console.log(JSON.stringify(out, null, 1))
await page.screenshot({ path: process.env.SHOT || 'demo/e2e.png' })
await br.close(); srv.close()
