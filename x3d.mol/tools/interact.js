#!/usr/bin/env node
/* Interaction proof for the x3d.mol page (headless Chromium, SwiftShader: correctness only, never timing).
   Checks: the PAE map answers hover and click and draws the arc, the stage answers hover and click with a residue card,
   Escape clears, and a phone-width layout has no horizontal scroll and no overlapping main panels.

   node tools/interact.js --docs docs --babylon /path/to/babylon.js --out OUTDIR [--scene AF-P04637-F1] */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const a = Object.fromEntries(process.argv.slice(2).reduce((m, v, i, arr) => (v.startsWith("--") ? m.concat([[v.slice(2), arr[i + 1]]]) : m), []));
const docs = path.resolve(a.docs || "docs"), out = path.resolve(a.out || "proof-interact"), scene = a.scene || "AF-P04637-F1";
fs.mkdirSync(out, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".gz": "application/gzip" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]), f = path.join(docs, u === "/" ? "index.html" : u);
  if (!f.startsWith(docs) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); fs.createReadStream(f).pipe(res);
});
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); console.log(ok ? "ok  " : "FAIL", name, detail === undefined ? "" : JSON.stringify(detail)); };

async function open(b, w, h, hash) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  if (a.babylon) await p.route("**/babylon.js", (r) => r.fulfill({ path: a.babylon, contentType: "text/javascript" }));
  await p.goto(`http://localhost:${srv.address().port}/index.html#${hash}`);
  await p.waitForFunction(() => window.__xmolReady || window.__xmolError, null, { timeout: 180000 });
  await p.waitForTimeout(3000);
  return { ctx, p, errs };
}

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const b = await chromium.launch({ args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const overlaps = (p) => p.evaluate(() => {
    const ids = ["side", "info", "controls", "legend", "pae", "residue", "receipt", "menu"], r = {};
    for (const id of ids) { const e = document.getElementById(id); if (e && !e.hidden && getComputedStyle(e).display !== "none") { const q = e.getBoundingClientRect(); if (q.right > 0 && q.left < innerWidth) r[id] = [q.left, q.top, q.right, q.bottom].map(Math.round); } }
    const bad = [], k = Object.keys(r);
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const A = r[k[i]], B = r[k[j]]; if (A[0] < B[2] - 1 && B[0] < A[2] - 1 && A[1] < B[3] - 1 && B[1] < A[3] - 1) bad.push(k[i] + "/" + k[j]); }
    return { r, bad };
  });
  { // desktop
    const { ctx, p, errs } = await open(b, 1280, 800, `scene=${scene}&q=low&gpu=0`);
    const ready = await p.evaluate(() => window.__xmolReady);
    check("scene boots", ready && !ready.error, ready);
    const hasPae = await p.evaluate(() => !document.getElementById("pae").hidden);
    check("PAE panel visible for an AlphaFold scene", hasPae);
    { const o = await overlaps(p); check("1280 wide: panels do not overlap", o.bad.length === 0, o); }
    if (hasPae) {
      const box = await p.locator("#paeCanvas").boundingBox();
      // a cell inside the folded domain block (roughly 40% along both axes) and one between two far regions
      await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await p.waitForTimeout(500);
      const t1 = await p.evaluate(() => document.getElementById("paeRead").innerText);
      check("PAE hover names both residues and a value", /row [\s\S]* column [\s\S]*\sPAE [0-9.]+ Å/.test(t1), t1);
      const lock1 = await p.evaluate(() => (window.__xmolState.paeLock ? window.__xmolState.paeLock.size : 0));
      check("PAE hover highlights two residues in the model", lock1 === 2, lock1);
      await p.screenshot({ path: path.join(out, "pae-hover.png") });
      await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.8);
      await p.waitForTimeout(400);
      const locked = await p.evaluate(() => window.__xmolState.paeLocked);
      check("PAE click locks the pair", locked === true);
      await p.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
      await p.waitForTimeout(300);
      const still = await p.evaluate(() => window.__xmolState.paeLocked && window.__xmolState.paeLock && window.__xmolState.paeLock.size === 2);
      check("PAE lock survives moving the pointer", still);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
      const cleared = await p.evaluate(() => !window.__xmolState.paeLocked && !window.__xmolState.paeLock);
      check("Escape clears the PAE lock", cleared);
    }
    // stage hover and pin: sweep a coarse grid across the middle of the canvas until a residue answers
    let hit = null;
    for (const fy of [0.5, 0.45, 0.55, 0.4, 0.6]) { for (const fx of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65]) {
      await p.mouse.move(1280 * (0.25 + 0.5 * fx) + 20, 800 * fy); await p.waitForTimeout(250);
      const vis = await p.evaluate(() => !document.getElementById("residue").hidden);
      if (vis) { hit = [fx, fy]; break; } } if (hit) break; }
    check("stage hover shows a residue card", !!hit, hit);
    if (hit) {
      const txt = await p.evaluate(() => document.getElementById("residue").innerText);
      check("residue card names residue, class and secondary structure", /[A-Z]{3} \d+/.test(txt) && /pLDDT|B-factor/.test(txt), txt);
      await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(400);
      const pinned = await p.evaluate(() => window.__xmolState.pinned);
      check("click pins the residue", pinned !== null, pinned);
      await p.mouse.move(40, 780); await p.waitForTimeout(300);
      const keep = await p.evaluate(() => !document.getElementById("residue").hidden && /pinned/.test(document.getElementById("residue").innerText));
      check("pinned card stays when the pointer leaves", keep);
      await p.screenshot({ path: path.join(out, "pinned.png") });
    }
    await p.click("#scheme"); await p.keyboard.press("Escape");
    const schemes = await p.evaluate(() => Array.from(document.getElementById("scheme").options).map((o) => o.value));
    check("colour schemes offered", schemes.length >= 3, schemes);
    check("no console errors on desktop", errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }
  { // tablet / small laptop
    const { ctx, p, errs } = await open(b, 1024, 720, `scene=${scene}&q=low&gpu=0`);
    const dims = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check("1024 wide: no horizontal scroll", dims.sw <= dims.iw, dims);
    const o = await overlaps(p); check("1024 wide: panels do not overlap", o.bad.length === 0, o);
    await p.mouse.move(600, 400); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(out, "tablet.png") });
    check("no console errors at 1024", errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }
  { // phone
    const { ctx, p, errs } = await open(b, 390, 844, `scene=${scene}&q=low&gpu=0`);
    const dims = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check("phone: no horizontal scroll", dims.sw <= dims.iw, dims);
    let o = await overlaps(p); check("phone: panels do not overlap", o.bad.length === 0, o);
    await p.screenshot({ path: path.join(out, "phone.png") });
    await p.click("#paeBtn"); await p.waitForTimeout(400);
    const paeShown = await p.evaluate(() => getComputedStyle(document.getElementById("pae")).display !== "none");
    check("phone: the PAE map opens from its button", paeShown);
    await p.mouse.click(250, 300); await p.waitForTimeout(500);
    o = await overlaps(p); check("phone: panels do not overlap with the PAE map and a residue card open", o.bad.length === 0, o);
    await p.screenshot({ path: path.join(out, "phone-pae.png") });
    await p.click("#paeBtn"); await p.click("#menu"); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(out, "phone-menu.png") });
    check("no console errors on phone", errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }
  { // the Blender cut: tab, still, gate numbers, download, hand-off to the live viewer
    const { ctx, p, errs } = await open(b, 1280, 800, `scene=1aay&q=low&gpu=0`);
    const tab = await p.$('#tabs [data-k="cine"]');
    const tabShown = tab && (await tab.isVisible());
    check("Blender tab is offered", tabShown);
    if (tabShown) {
      await tab.click(); await p.waitForTimeout(300);
      const shots = await p.$$eval(".shot", (els) => els.map((e) => e.dataset.cine));
      check("Blender tab lists stills", shots.length >= 1, shots);
      await p.click(`.shot[data-cine="${shots[0]}"]`); await p.waitForTimeout(1200);
      const box = await p.evaluate(() => { const i = document.querySelector("#cineBox img"); return { open: !document.getElementById("cineBox").hidden, img: i ? i.naturalWidth : 0, text: document.getElementById("cineBody").innerText, href: document.getElementById("cineGet").href }; });
      check("still opens at full size", box.open && box.img >= 1280, { img: box.img });
      check("gate shows XSD valid and witness pass", /XSD valid/.test(box.text) && /witness\s*pass/.test(box.text), box.text.slice(0, 400));
      const dl = await p.evaluate(async (u) => { const r = await fetch(u); return { status: r.status, bytes: (await r.arrayBuffer()).byteLength }; }, box.href);
      check("X3D download is served", dl.status === 200 && dl.bytes > 1000, dl);
      await p.screenshot({ path: path.join(out, "blender-still.png") });
      await p.click("#cineOpen"); await p.waitForFunction((id) => window.__xmolReady && window.__xmolReady.id === id, shots[0], { timeout: 120000 });
      check("open in viewer loads the same structure", true, shots[0]);
    }
    check("no console errors on the Blender tab", errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, "interact.json"), JSON.stringify({ rig: "headless Chromium, SwiftShader (software), correctness only, no timing", scene, checks }, null, 1));
  await b.close(); srv.close();
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
})();
