// A second judge: the same real mouse gestures on two X3D files in headless Chromium + X_ITE, with the watched
// fields read on every frame.
//   node selfcode/court.cjs <x_ite dist dir> <watch DEF.field,...> <a.x3d> <sensor DEF in a> <b.x3d> <sensor DEF in b> [--at=x,y]
// Prints {browser, runs: [{file, sensorAt, presses, samples: [[seconds since first press, [values]], ...]}]}.
// Software GL: values and order are claims, frame rate is not. court.py compares the two runs.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const at = (args.find(x => x.startsWith('--at=')) || '').slice(5).split(',').map(Number);      // where the sensor was found last time
const [xite, watchArg, ...rest] = args.filter(x => !x.startsWith('--at='));
const files = [[rest[0], rest[1]], [rest[2], rest[3]]];
const watch = watchArg.split(',').map(w => w.split('.'));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.x3d': 'model/x3d+xml', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary' };
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/xite/x_ite.css><script src=/xite/x_ite.min.js></script>
<style>body{margin:0}x3d-canvas{width:960px;height:600px;display:block}</style>
<x3d-canvas id=c contextMenu=false notifications=false splashScreen=false timings=false></x3d-canvas>`;
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(page); }
  const m = u.match(/^\/f\/(\d)\/(.+)$/);          // /f/<i>/scene.x3d is the file itself; anything else beside it is its neighbour
  const f = m ? (m[2] === 'scene.x3d' ? files[Number(m[1])][0] : path.join(path.dirname(files[Number(m[1])][0]), path.basename(m[2])))
              : path.join(xite, u.replace(/^\/xite\//, ''));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const runs = [];
  let name = null;
  for (let i = 0; i < files.length; i++) {
    const sensor = files[i][1];
    const p = await browser.newPage({ viewport: { width: 960, height: 600 } });
    await p.goto(`http://localhost:${server.address().port}/`);
    await p.evaluate(async u => { const B = X3D.getBrowser(document.getElementById('c')); await B.loadURL(new X3D.MFString(u)); }, `/f/${i}/scene.x3d`);
    await p.waitForFunction(s => { try { return !!X3D.getBrowser(document.getElementById('c')).currentScene.getNamedNode(s); } catch (e) { return false; } }, sensor, { timeout: 90000 });
    await sleep(1500);
    name = await p.evaluate(() => { const B = X3D.getBrowser(document.getElementById('c')); return `${B.name} ${B.version}`; });
    let hit = null;
    if (at.length === 2 && at.every(Number.isFinite)) {
      await p.mouse.move(at[0] - 3, at[1] - 3); await p.mouse.move(at[0], at[1], { steps: 2 }); await sleep(150);
      if (await p.evaluate(s => X3D.getBrowser(document.getElementById('c')).currentScene.getNamedNode(s).isOver, sensor)) hit = { x: at[0], y: at[1] };
    }
    if (!hit) scan: for (let y = 40; y < 600; y += 24) for (let x = 40; x < 960; x += 24) {
      await p.mouse.move(x - 3, y - 3); await p.mouse.move(x, y, { steps: 2 }); await sleep(60);
      if (await p.evaluate(s => X3D.getBrowser(document.getElementById('c')).currentScene.getNamedNode(s).isOver, sensor)) { hit = { x, y }; break scan; }
    }
    if (!hit) { runs.push({ file: path.basename(files[i][0]), sensorAt: null, presses: [], samples: [] }); await p.close(); continue; }
    await p.mouse.move(5, 5); await sleep(400);
    await p.evaluate(w => {
      const s = X3D.getBrowser(document.getElementById('c')).currentScene;
      window.__samples = []; window.__presses = [];
      window.addEventListener('mousedown', () => window.__presses.push(performance.now()), true);
      const tick = () => {
        window.__samples.push([performance.now(), w.map(([d, f]) => { const v = s.getNamedNode(d)[f]; return typeof v === 'object' ? String(v) : v; })]);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, watch);
    const click = async hold => { await p.mouse.down(); await sleep(hold); await p.mouse.up(); };
    await sleep(600);
    await p.mouse.move(hit.x, hit.y); await sleep(500);
    await click(90); await sleep(4200);                       // one click, and time to finish
    await click(90); await sleep(500); await click(90);       // two clicks close together
    await sleep(4200);
    await p.mouse.move(5, 5); await sleep(700);               // leave
    await p.mouse.move(hit.x, hit.y); await sleep(700);       // come back without pressing
    await click(1500); await sleep(4200);                     // a long hold
    const out = await p.evaluate(() => ({ samples: window.__samples, presses: window.__presses }));
    const zero = out.presses[0];
    runs.push({ file: path.basename(files[i][0]), sensorAt: hit, presses: out.presses.map(t => +((t - zero) / 1000).toFixed(3)),
      samples: out.samples.map(([t, v]) => [+((t - zero) / 1000).toFixed(3), v]) });
    await p.close();
  }
  await browser.close(); server.close();
  console.log(JSON.stringify({ browser: name, watch: watchArg, runs }));
})();
