// Plays demo/showcase headlessly: checks no page errors, divergence during the split, convergence after, X_ITE node sets == document, screenshots.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { serve } from './serve.js'
import fs from 'node:fs'
const srv = await serve(); const port = srv.address().port
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const page = await br.newPage({ viewport: { width: 1280, height: 1500 } })
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
await page.goto(`http://127.0.0.1:${port}/demo/showcase/index.html?xite=/xite/x_ite.min.js`)
await page.waitForFunction(() => window.showReady, null, { timeout: 90000 })
const out = process.env.OUT || 'demo/showcase'; const res = { shots: [] }
const cap = async n => { await page.screenshot({ path: `${out}/${n}.png` }); res.shots.push(n) }
await cap('shot-0-ready')
await page.click('#play')
const waitCap = (txt, t = 60000) => page.waitForFunction(s => document.getElementById('cap').textContent.includes(s), txt, { timeout: t })
await waitCap('Bob recolours'); await new Promise(r => setTimeout(r, 700)); await cap('shot-1-concurrent')
await waitCap('Two realities'); await new Promise(r => setTimeout(r, 1500))
res.split = await page.evaluate(() => { const s = window.showcase; return { hashes: [s.hs(s.A), s.hs(s.B), s.hs(s.C)], aLamp: !!s.A.findByDef('Lamp'), bLamp: !!s.B.findByDef('Lamp'), cube: [s.A, s.B, s.C].map(d => d.getField(d.findByDef('BoxT'), 'translation')) } })
await cap('shot-2-split-brain')
await waitCap('Converged', 90000); await new Promise(r => setTimeout(r, 1200))
res.end = await page.evaluate(() => { const s = window.showcase; const want = []; const go = ns => ns.forEach(n => { want.push('y_' + n.uid.replace(/\./g, '_')); go(n.kids) }); go(s.A.tree().roots); want.sort(); const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]); return { hashes: [s.hs(s.A), s.hs(s.B), s.hs(s.C)], orphans: s.A.tree().orphans.length, conflicts: s.A.tree().conflicts.map(c => c.kind), xiteMatches: ['A', 'B', 'C'].map(k => same(s.adapters[k].snapshot(), want)), adapterErrors: ['A', 'B', 'C'].map(k => s.adapters[k].stats.error || null), cube: s.A.getField(s.A.findByDef('BoxT'), 'translation'), clock: s.A.getField(s.A.findByDef('Clock'), 'cycleInterval'), lamp: !!s.A.findByDef('Lamp') } })
await cap('shot-3-converged')
await page.click('#rescue'); await new Promise(r => setTimeout(r, 800))
res.rescue = await page.evaluate(() => { const s = window.showcase; return { hashes: [s.hs(s.A), s.hs(s.B), s.hs(s.C)], orphans: s.A.tree().orphans.length, g1: !!s.A.tree().roots.find(r => r.def === 'G1' || r.def === 'G2') } })
await page.fill('#sc', '3'); await page.dispatchEvent('#sc', 'input'); await new Promise(r => setTimeout(r, 1500)); await cap('shot-4-history')
res.errors = errs
console.log(JSON.stringify(res, null, 1))
await br.close(); srv.close()
