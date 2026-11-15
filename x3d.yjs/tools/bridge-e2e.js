// The same adapter against the x3d.loom three.js bridge (shared reader + three.js body, r187). Incremental application of
// Yjs edits must draw the same picture as loading the final document from scratch (pixel diff 0), and the node sets must match.
// Reads the bridge bundle through its own tools/bundle.js: nothing under x3d.threejs/ or x3d.webgpu/ is copied or changed.
import { createRequire } from 'node:module'
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const HERE = path.resolve(import.meta.dirname, '..')
const bundle = require(path.resolve(HERE, '../x3d.threejs/bridge/tools/bundle.js'))
const THREE = path.join(HERE, 'node_modules/three/build')
const files = { '/bundle-body.js': bundle('body'), '/dist/yx3d.js': fs.readFileSync(path.join(HERE, 'demo/dist/yx3d.js'), 'utf8') }
const page_html = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#000"><canvas id=c width=480 height=320 style="width:480px;height:320px;display:block"></canvas>
<script type="module">import * as THREE from '/three/three.module.js'; window.THREE = THREE
const add = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s) })
await add('/bundle-body.js')
const body = new Body(document.getElementById('c'), { tone: 'none', onNote: m => (window.__notes = window.__notes || []).push(m) }); await body.init(); X3DSAI.setBody(body); window.__body = body
window.Y = await import('/dist/yx3d.js'); window.ready = true</script>`
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0]
  if (u === '/') { r.setHeader('content-type', 'text/html'); return r.end(page_html) }
  if (files[u] !== undefined) { r.setHeader('content-type', 'text/javascript'); return r.end(files[u]) }
  if (u.startsWith('/three/')) { const f = path.join(THREE, u.slice(7)); if (fs.existsSync(f)) { r.setHeader('content-type', 'text/javascript'); return fs.createReadStream(f).pipe(r) } }
  r.statusCode = 404; r.end('no')
}).listen(0)
await new Promise(r => srv.on('listening', r))
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const page = await br.newPage({ viewport: { width: 520, height: 360 } })
page.on('pageerror', e => console.log('pageerror', e.message))
await page.goto(`http://127.0.0.1:${srv.address().port}/`)
await page.waitForFunction(() => window.ready, null, { timeout: 90000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const shot = async () => { await sleep(500); return (await (await page.$('#c')).screenshot()).toString('base64') }
const SRC = `<?xml version="1.0" encoding="UTF-8"?><X3D profile="Interchange" version="4.0"><Scene><NavigationInfo type='"NONE"'/><Viewpoint position="0 1.5 9"/><DirectionalLight direction="-0.3 -1 -0.5"/>
<Transform DEF="Floor" translation="0 -1 0"><Shape><Appearance><Material diffuseColor="0.3 0.35 0.4"/></Appearance><Box size="10 0.2 6"/></Shape></Transform>
<Transform DEF="BoxT" translation="-2 0 0"><Shape><Appearance><Material DEF="BoxM" diffuseColor="0.9 0.3 0.2"/></Appearance><Box/></Shape></Transform>
<Transform DEF="BallT" translation="2 0 0"><Shape><Appearance><Material diffuseColor="0.2 0.5 0.9"/></Appearance><Sphere radius="0.8"/></Shape></Transform></Scene></X3D>`
const out = { rig: { chromium: br.version(), gl: 'SwiftShader', three: 'r187', bridge: 'x3d.threejs/bridge shared reader + three.js body' }, steps: {} }
const res = await page.evaluate(async SRC => {
  const { X3DDoc, Y, Link, SaiAdapter, agentApply } = window.Y
  const A = new X3DDoc(), B = new X3DDoc(); A.loadXML(SRC); Y.applyUpdate(B.doc, Y.encodeStateAsUpdate(A.doc)); new Link(A.doc, B.doc)
  const ad = await new SaiAdapter(A, X3DSAI.B).load()
  const steps = [], lat = []
  const snapEq = () => { const want = []; const go = ns => ns.forEach(n => { want.push('y_' + n.uid.replace(/\./g, '_')); go(n.kids) }); go(A.tree().roots); want.sort(); const s = ad.snapshot(); return s.length === want.length && s.every((v, i) => v === want[i]) }
  // 1: 20 remote field edits from B, latency to the bridge node
  for (let i = 0; i < 20; i++) { const node = X3DSAI.B.currentScene.getNamedNode('y_' + B.findByDef('BoxT').replace(/\./g, '_')); const t0 = performance.now(); B.setField(B.findByDef('BoxT'), 'translation', `${i - 5} ${i % 3} 0`); await ad.idle(); const v = node.translation; lat.push(performance.now() - t0); if (Math.abs(v.x - (i - 5)) > 1e-4 && Math.abs(v[0] - (i - 5)) > 1e-4) lat[lat.length - 1] = -1 }
  await ad.idle(); steps.push(['fields', snapEq(), { ...ad.stats }])
  B.setField(B.findByDef('BoxM'), 'diffuseColor', '0 1 0'); await ad.idle(); steps.push(['colour', snapEq(), { ...ad.stats }])
  B.addXML('<Transform DEF="Add1" translation="0 1.8 0"><Shape><Appearance><Material diffuseColor="1 1 0"/></Appearance><Sphere radius="0.4"/></Shape></Transform>'); await ad.idle(); steps.push(['add at root', snapEq(), { ...ad.stats }])
  B.addXML('<Shape DEF="Child"><Appearance><Material diffuseColor="1 0 1"/></Appearance><Cone/></Shape>', B.findByDef('BallT')); await ad.idle(); steps.push(['append under Transform', snapEq(), { ...ad.stats }])
  B.move(B.findByDef('Add1'), B.findByDef('BoxT')); await ad.idle(); steps.push(['move (reload path)', snapEq(), { ...ad.stats }])
  B.remove(B.findByDef('Child')); await ad.idle(); steps.push(['remove (reload path)', snapEq(), { ...ad.stats }])
  const ar = agentApply(A, [{ op: 'modify_node', def: 'BoxM', fields: { diffuseColor: '0 0 1' } }, { op: 'modify_node', def: 'Zip', fields: {} }], 'e2e'); await ad.idle(); steps.push(['agent op (1 ok, 1 refused)', snapEq(), ar.map(x => x.ok)])
  return { steps, lat, mode: ad.mode, xml: A.toXML(), notes: window.__notes || [] }
}, SRC)
out.mode = res.mode; out.steps = res.steps; out.notes = res.notes.slice(0, 5)
out.fieldEditMs = { median: [...res.lat].sort((a, b) => a - b)[10], max: Math.max(...res.lat), failed: res.lat.filter(v => v < 0).length }
const inc = await shot()
// from-scratch picture: replaceWorld with the final canonical XML
await page.evaluate(async xml => { const sc = await X3DSAI.B.createX3DFromString(xml); await X3DSAI.B.replaceWorld(sc); await X3DSAI.B.nextFrame() }, res.xml)
const fresh = await shot()
out.pixelDiffIncrementalVsFresh = await page.evaluate(async ([a, b]) => {
  const dec = async s => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height).data }
  const [da, db] = [await dec(a), await dec(b)]; let s = 0, n = 0; for (let i = 0; i < da.length; i += 4) { const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); s += d; if (d > 6) n++ } return { meanAbs: s / (da.length / 4 * 3), diffPixels: n, total: da.length / 4 }
}, [inc, fresh])
fs.writeFileSync(process.env.SHOT || 'demo/bridge-e2e.png', Buffer.from(fresh, 'base64'))
console.log(JSON.stringify(out, null, 1))
await br.close(); srv.close()
