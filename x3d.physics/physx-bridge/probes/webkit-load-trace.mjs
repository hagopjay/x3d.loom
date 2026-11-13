import { webkit } from 'playwright';
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 200)));
await p.goto('http://127.0.0.1:5182/' + (process.argv[2] ?? 'musicbox.html') + (process.argv[3] ?? ''));
await p.waitForFunction(() => window.__demo?.ready, null, { timeout: 90000 });
await p.evaluate(() => {
  const d = window.__demo, br = d.bridge; window.__trace = [];
  const T = (n) => window.__trace.push(n + ' ' + Math.round(performance.now()));
  const lp = Object.getPrototypeOf(d.looks); const prep = lp.prepare; lp.prepare = async function () { T('prepare>'); const r = await prep.call(this); T('prepare<'); return r; };
  const ld = d.spec.loaded; d.spec.loaded = async (...a) => { T('loaded>'); const r = await ld?.(...a); T('loaded<'); return r; };
  for (const k of ['loadString', 'rebuild']) { const f = br[k].bind(br); br[k] = async (...a) => { T(k + '>'); const r = await f(...a); T(k + '<'); return r; }; }
  const hold = br.clocks.hold.bind(br.clocks); br.clocks.hold = async (...a) => { T('hold>'); const r = await hold(...a); T('hold<'); return r; };
  const cfs = br.browser.createX3DFromString.bind(br.browser); br.browser.createX3DFromString = async (...a) => { for (let k = 0; k < 4; k++) { T('create>' + k); const r = await Promise.race([cfs(...a), new Promise((res) => setTimeout(() => res(null), 8000))]); if (r) { T('create<' + k); return r; } T('create stalled ' + k); } };
  const rw = br.browser.replaceWorld.bind(br.browser); br.browser.replaceWorld = async (...a) => { T('replace>'); const r = await rw(...a); T('replace<'); return r; };
  const rs = d.spec.restore; d.spec.restore = (v) => { T('restore>'); const r = rs(v); T('restore< ' + r); return r; };
  if (!window.__noDownload) {} const dl = d.download; if (location.hash === '#nodl') d.download = () => {}; if (location.hash === '#nosound') d.spec.sound = undefined; const xml = d.exportX3D(); d.download = dl; T('exported');
  (async () => { for (let k = 0; k < 4; k++) { T('import#' + k); await d.importX3D(xml); T('done#' + k); } })();
});
await p.waitForTimeout(40000);
console.log(await p.evaluate(() => window.__trace));
await b.close();
