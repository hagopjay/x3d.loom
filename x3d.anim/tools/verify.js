// node tools/verify.js [--shots DIR]  -> one JSON line; writes receipts/<case>.json and fixtures/<case>.x3d
// Per case: author in the tool, bake, write X3D, then in X_ITE 16.6.0 and in the three.js bridge compare, at 41 fractions of the cycle:
//   xiteVsOracle  : what the author sees (Theatre / GSAP itself) against what X_ITE plays             (bake error: interpolators are piecewise linear)
//   xiteVsOurs    : our model of the interpolators against X_ITE                                        (should be ~1e-7)
//   bridgeVsXite  : the three.js bridge's reader interpolators and ROUTEs against X_ITE's               (should be ~1e-7)
// and, with the clock frozen, three pictures per engine, once through the interpolators and once by LIVE driving (the oracle's state written through the SAI, no baking):
//   pictures: PSNR and foreground IoU, three.js bridge against X_ITE.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { CASES, stage } from './cases.js'; import { embed } from '../src/x3d-write.js'; import { withXite, loadScene, sweep, shot } from './xite.js'; import { withBridge } from './bridge.js';
import { toChannelValue, sampleChannel, distValue } from '../src/model.js';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), si = args.indexOf('--shots'), shots = si >= 0 ? args[si + 1] : null;
const N = 41, fractions = Array.from({ length: N }, (_, i) => Math.min(1, (i + (i === 0 || i === N - 1 ? 0 : 0.37)) / (N - 1))), FR3 = [0.25, 0.6, 0.95];
const browserJs = fs.readFileSync(path.join(HERE, 'dist', 'x3d-anim.browser.js'), 'utf8');
fs.mkdirSync(path.join(HERE, 'receipts'), { recursive: true });

async function metrics(pg, a, b) {   // PSNR (dB, RGB) and foreground IoU (luma > 12) between two PNG buffers
  return pg.evaluate(async ([A, B]) => { const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
    const px = async (s) => { const i = await load(s), c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const x = await px(A), y = await px(B); let se = 0, inter = 0, uni = 0; for (let i = 0; i < x.length; i += 4) { for (let k = 0; k < 3; k++) se += (x[i + k] - y[i + k]) ** 2; const fa = 0.2126 * x[i] + 0.7152 * x[i + 1] + 0.0722 * x[i + 2] > 12, fb = 0.2126 * y[i] + 0.7152 * y[i + 1] + 0.0722 * y[i + 2] > 12; if (fa && fb) inter++; if (fa || fb) uni++; }
    const mse = se / (x.length / 4 * 3); return { psnr: mse === 0 ? 99 : +(10 * Math.log10(255 * 255 / mse)).toFixed(2), iou: uni ? +(inter / uni).toFixed(4) : 1 }; }, [a.toString('base64'), b.toString('base64')]);
}
const results = {}; let envAll;
await withXite(async (px, envX) => withBridge(async (pb, envB) => {
  envAll = { ...envX, bridge: envB }; const mp = await px.context().browser().newPage(); await mp.setContent('<canvas></canvas>');
  for (const pg of [px, pb]) await pg.addScriptTag({ content: browserJs });
  for (const c of CASES) {
    const made = await c.make(), tl = made.timeline, x3d = embed(stage(), tl); fs.writeFileSync(path.join(HERE, 'fixtures', c.id + '.x3d'), x3d);
    await loadScene(px, x3d); await loadScene(pb, x3d); const gx = await sweep(px, tl, fractions), gb = await sweep(pb, tl, fractions);
    const per = tl.channels.map((ch, ci) => { let eo = 0, eu = 0, eb = 0; fractions.forEach((f, i) => { const t = f * tl.duration, X = gx[i][ci], O = toChannelValue(ch.type, made.oracle(t)[ch.def][ch.field]); eo = Math.max(eo, distValue(ch.type, X, O)); eu = Math.max(eu, distValue(ch.type, X, sampleChannel(ch, t))); eb = Math.max(eb, distValue(ch.type, gb[i][ci], X)); });
      const r = made.report.find((q) => q.def === ch.def && q.field === ch.field), g = (v) => +v.toPrecision(3); return { channel: ch.def + '.' + ch.field, type: ch.type, keys: ch.keys.length, samples: r.samples, bakeErr: g(r.maxErr), xiteVsOracle: g(eo), xiteVsOurs: g(eu), bridgeVsXite: g(eb), unit: ch.type === 'SFRotation' ? 'rad' : 'value' }; });
    const pics = []; // pictures
    for (const f of FR3) { const t = f * tl.duration, row = { fraction: f };
      for (const mode of ['interp', 'live']) { const bufs = {};
        for (const [name, pg] of [['xite', px], ['bridge', pb]]) {
          if (mode === 'interp') await sweep(pg, tl, [f]); else { await sweep(pg, tl, [0]); await pg.evaluate(async ([st]) => { const br = window.__br || X3D.getBrowser('#c'); X3DAnim.applyState(X3D, window.__sc, st); await br.nextFrame(); await br.nextFrame(); }, [made.oracle(t)]); }
          bufs[name] = await shot(pg); if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `${c.id}.${mode}.${String(f).replace('.', '_')}.${name}.png`), bufs[name]); } }
        row[mode] = await metrics(mp, bufs.bridge, bufs.xite); }
      pics.push(row); }
    // live path read-back: after applyState the node holds what the author's tool said
    await sweep(px, tl, [0]); const tmid = 0.5 * tl.duration, back = await px.evaluate(async ([st, ch]) => { X3DAnim.applyState(X3D, window.__sc, st); await X3D.getBrowser('#c').nextFrame(); const rd = { SFFloat: (v) => [v], SFVec2f: (v) => [v.x, v.y], SFVec3f: (v) => [v.x, v.y, v.z], SFColor: (v) => [v.r, v.g, v.b], SFRotation: (v) => [v.x, v.y, v.z, v.angle] }; return ch.map((c) => rd[c.type](window.__sc.getNamedNode(c.def)[c.field])); }, [made.oracle(tmid), tl.channels.map((c) => ({ def: c.def, field: c.field, type: c.type }))]);
    const liveErr = Math.max(...tl.channels.map((ch, i) => distValue(ch.type, back[i], toChannelValue(ch.type, made.oracle(tmid)[ch.def][ch.field]))));
    const gm = (f) => Math.max(...per.map(f));
    results[c.id] = { tool: c.tool, source: made.source, duration: tl.duration, channels: tl.channels.length, keys: tl.channels.reduce((n, ch) => n + ch.keys.length, 0), samplesPerChannel: made.report[0].samples, checkPoints: made.checkPoints, fractions: N, per, pictures: pics,
      worstXiteVsOracle: gm((p) => p.xiteVsOracle), worstXiteVsOurs: gm((p) => p.xiteVsOurs), worstBridgeVsXite: gm((p) => p.bridgeVsXite), liveReadbackErr: +liveErr.toPrecision(3), minPsnrInterp: Math.min(...pics.map((p) => p.interp.psnr)), minPsnrLive: Math.min(...pics.map((p) => p.live.psnr)), minIou: Math.min(...pics.flatMap((p) => [p.interp.iou, p.live.iou])), pageErrors: [...(px._errs || []), ...(pb._errs || [])] };
    fs.writeFileSync(path.join(HERE, 'receipts', c.id + '.json'), JSON.stringify({ env: envAll, ...results[c.id] }, null, 1));
  } }));
const ok = Object.values(results).every((r) => r.worstXiteVsOurs < 1e-4 && r.worstBridgeVsXite < 1e-4 && r.liveReadbackErr < 1e-5 && !r.pageErrors.length);
console.log(JSON.stringify({ ok, env: envAll, results })); if (!ok) process.exitCode = 1; process.exit(process.exitCode || 0);
