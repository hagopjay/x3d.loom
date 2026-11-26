const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// node spell.cjs <x_ite dist dir>   plays eight spellings of 'a full turn' in X_ITE and prints the angle about +Y at four fractions
const xite = path.resolve(process.argv[2] || 'node_modules/x_ite/dist');
const cases = ["0 3.14159 6.28318", "0 3.1416 6.2832", "0 3.141593 6.283185", "0 3.14159265 6.28318531", "0 3.1415927 6.2831853", "0 6.28319", "0 4", "0 2.0944 4.18879 6.28319"];
const page = `<!doctype html><meta charset=utf-8><script src=/xite/x_ite.min.js></script><x3d-canvas id=c style="width:64px;height:64px" splashScreen=false notifications=false></x3d-canvas>`;
const server = http.createServer((q, r) => {
  if (q.url === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(page); }
  fs.readFile(path.join(xite, q.url.replace(/^\/xite\//, '')), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': q.url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(d); });
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.goto(`http://localhost:${server.address().port}/`);
  await p.waitForFunction(() => { try { return !!X3D.getBrowser(document.getElementById('c')); } catch (e) { return false; } });
  const out = {};
  for (const angles of cases) {
    const a = angles.split(' '), n = a.length;
    const kv = a.map(x => `0 1 0 ${x}`).join(' '), keys = a.map((_, i) => i / (n - 1)).join(' ');
    out[angles] = await p.evaluate(async ([kv, keys]) => {
      const B = X3D.getBrowser(document.getElementById('c'));
      const scene = await B.createX3DFromString(`<X3D profile='Interchange' version='4.0'><Scene><Transform DEF='T'><Shape><Box/></Shape></Transform><TimeSensor DEF='C' cycleInterval='4' loop='true'/><OrientationInterpolator DEF='O' key='${keys}' keyValue='${kv}'/><ROUTE fromNode='C' fromField='fraction_changed' toNode='O' toField='set_fraction'/><ROUTE fromNode='O' fromField='value_changed' toNode='T' toField='set_rotation'/></Scene></X3D>`);
      B.replaceWorld(scene);
      const S = [];
      await new Promise(done => { const t0 = performance.now(); const tick = () => {
        try { const s = B.currentScene, r = s.getNamedNode('T').rotation, f = s.getNamedNode('C').fraction_changed;
          let ang = (r.y < 0 ? -1 : 1) * r.angle; ang = ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); S.push([f, ang]); } catch (e) {}
        if (performance.now() - t0 > 5000) done(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      const res = {};
      for (const f of [0.125, 0.375, 0.625, 0.875]) { let best = null; for (const s of S) if (best === null || Math.abs(s[0] - f) < Math.abs(best[0] - f)) best = s; res[f] = [+best[0].toFixed(3), +best[1].toFixed(3)]; }
      return { frames: S.length, at: res };
    }, [kv, keys]);
  }
  const name = await p.evaluate(() => { const B = X3D.getBrowser(document.getElementById('c')); return `${B.name} ${B.version}`; });
  console.log(JSON.stringify({ browser: name, chromium: b.version(), forward_would_read: { 0.125: 0.785, 0.375: 2.356, 0.625: 3.927, 0.875: 5.498 }, out }));
  await b.close(); server.close();
})();
