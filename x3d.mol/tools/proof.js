#!/usr/bin/env node
/* Proof frames for the x3d.mol page: serves docs/ on localhost, opens each scene in headless Chromium (SwiftShader, so correctness only,
   never timing), and records console errors, whether the frame is blank, and a PNG.

   node tools/proof.js --docs docs --babylon /path/to/babylonjs@9.32.0/babylon.js --out OUTDIR [--scenes 1aay,AF-P26651-F1] [--gpu 0|1] [--q low|high]
                       [--w 1280 --h 800] [--hash "scheme=ss"] [--cinema 1] [--wait 6000]

   --gpu 0 draws with WebGL2 (a real canvas capture). --gpu 1 asks for WebGPU; headless cannot present a WebGPU canvas, so the harness
   from x3d.webgpu/bridge/tools/smoke.js is reused (offscreen texture, slow frame pacing) and only frame count and errors are judged. */
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const { chromium } = require("playwright");
const a = Object.fromEntries(process.argv.slice(2).reduce((m, v, i, arr) => (v.startsWith("--") ? m.concat([[v.slice(2), arr[i + 1]]]) : m), []));
const docs = path.resolve(a.docs || "docs"), out = path.resolve(a.out || "proof"), babylon = a.babylon;
const gpu = a.gpu === "1", q = a.q || "low", W = +(a.w || 1280), H = +(a.h || 800), wait = +(a.wait || 6000);
fs.mkdirSync(out, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".gz": "application/gzip", ".x3d": "model/x3d+xml" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]), f = path.join(docs, u === "/" ? "index.html" : u);
  if (!f.startsWith(docs) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const cat = JSON.parse(fs.readFileSync(path.join(docs, "scenes/catalog.json")));
  const ids = (a.scenes ? a.scenes.split(",") : cat.scenes.map((s) => s.id));
  const b = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-webgpu-adapter=swiftshader"] });
  const results = [];
  for (const id of ids) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(), errs = [], warns = [];
    p.on("pageerror", (e) => errs.push("pageerror: " + String(e.message).slice(0, 240)));
    p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 240)); if (m.type() === "warning") warns.push(m.text().slice(0, 160)); });
    if (babylon) await p.route("**/babylon.js", (r) => r.fulfill({ path: babylon, contentType: "text/javascript" }));
    if (gpu) await p.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 300);
      const o = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, op) { if (t !== "webgpu") return o.call(this, t, op); const canvas = this;
        const ctx = { _t: null, _d: null, _f: "bgra8unorm", canvas, configure(c) { this._d = c.device; this._f = c.format; }, unconfigure() {},
          getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) this._t = this._d.createTexture({ size: [w, h], format: this._f, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING }); return this._t; } };
        window.__ctx = ctx; return ctx; };
    });
    const t0 = Date.now();
    await p.goto(`http://localhost:${port}/index.html#scene=${id}&q=${q}&gpu=${gpu ? 1 : 0}${a.hash ? "&" + a.hash : ""}${a.cinema ? "&cinema=1" : ""}`);
    let ready = null;
    try { await p.waitForFunction(() => window.__xmolReady || window.__xmolError, null, { timeout: 180000 }); ready = await p.evaluate(() => window.__xmolReady || { error: window.__xmolError }); } catch (e) { ready = { error: "timeout waiting for the scene" }; }
    await p.waitForTimeout(wait);
    const stats = await p.evaluate(() => {
      const cv = document.getElementById("stage"), w = 160, h = Math.round(160 * cv.height / cv.width), s = document.createElement("canvas"); s.width = w; s.height = h;
      const g = s.getContext("2d"); try { g.drawImage(cv, 0, 0, w, h); } catch (e) { return { error: String(e) }; }
      const d = g.getImageData(0, 0, w, h).data; let lit = 0, sum = 0, bg = [d[0], d[1], d[2]];
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += l; if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 40) lit++; }
      const r = (window.XMolBody && document.getElementById("receipt") && document.getElementById("receipt").innerText) || "";
      return { litFraction: +(lit / (w * h)).toFixed(3), meanLuma: +(sum / (w * h)).toFixed(1), receipt: r.slice(0, 700) };
    });
    const png = path.join(out, `${id}${gpu ? "-webgpu" : ""}${a.hash ? "-" + a.hash.replace(/[^a-z0-9]+/gi, "_") : ""}${a.cinema ? "-cinema" : ""}.png`);
    if (!gpu) await p.screenshot({ path: png });
    const info = await p.evaluate(() => { const e = window.__xmolReady; return e || null; });
    const fps = await p.evaluate(() => (document.getElementById("fps") || {}).textContent || "");
    results.push({ id, ready, ms: Date.now() - t0, stats, errors: errs.slice(0, 6), warnings: warns.slice(0, 3), png: gpu ? null : path.basename(png), fps, ok: !!ready && !ready.error && !errs.length && (gpu || (stats.litFraction >= 0.01)) });
    console.log(JSON.stringify({ id, ok: results[results.length - 1].ok, backend: ready && ready.backend, lit: stats.litFraction, luma: stats.meanLuma, errors: errs.slice(0, 2), ms: Date.now() - t0 }));
    await ctx.close();
  }
  const verText = await (await b.newPage()).evaluate(() => navigator.userAgent);
  fs.writeFileSync(path.join(out, `proof${gpu ? "-webgpu" : ""}.json`), JSON.stringify({ browser: await b.version(), userAgent: verText, rig: "headless Chromium, SwiftShader (software), correctness only, no timing", viewport: [W, H], quality: q, gpu, results }, null, 1));
  await b.close(); srv.close();
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
})();
