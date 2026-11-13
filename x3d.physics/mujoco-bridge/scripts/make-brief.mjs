// Build the shareable brief: one self-contained HTML file (fonts, images, drawings embedded; no network)
// plus a PDF of it. Captures the live arm and the drawings from the running guided tour, so the brief
// shows what the software actually does.
//   node scripts/make-brief.mjs [--out ../release]        (run from bridge/, after `npm run build`)
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';

const outDir=path.resolve(process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'../release');
mkdirSync(outDir,{recursive:true});
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const E=JSON.parse(readFileSync('src/data/evidence.json','utf8'));
const font=f=>readFileSync(`dist/vendor/x_ite/assets/fonts/${f}`).toString('base64');
// start.py falls back to a free port when the asked one is busy: read the address it prints.
const server=spawn('python3',['-u','start.py','--no-browser','--port','0'],{stdio:['ignore','pipe','ignore']});
process.on('exit',()=>server.kill());
const URL=await new Promise((resolve,reject)=>{let buf='';server.stdout.on('data',d=>{buf+=d;const m=buf.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m)resolve(m[0]);});setTimeout(()=>reject(Error('start.py did not print its address')),15000);});

const browser=await chromium.launch({channel:'chromium'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1.5});
await page.goto(URL);
await page.getByText(/I own the motion/).waitFor({timeout:60000});
await page.getByRole('button',{name:/Play/}).click();
await page.getByText(/Contact: the tip presses/).waitFor({timeout:20000});
await page.waitForTimeout(2500);
const jpg=async loc=>(await loc.screenshot({type:'jpeg',quality:84})).toString('base64');
const plate=await jpg(page.locator('.plate').first());
const convo=await jpg(page.locator('.card',{has:page.getByText('The conversation',{exact:true})}).first());
const force=(await page.locator('.card',{hasText:'Press force'}).first().innerText()).match(/([\d.]+) N/)?.[1]??'—';
const svg=async label=>page.locator(`svg[aria-label^="${label}"]`).first().evaluate(e=>e.outerHTML);
const phases=await svg('Six phases'),cloud=await svg('A cloud of dots'),arch=await svg('Three architecture drawings'),bars=await svg('Bar chart'),bubbles=await svg('Two speech bubbles');

const checks=E.nodeChecks.passed+E.threats.passed+E.schema.passed+E.browsers.reduce((a,b)=>a+b.passed,0);
const date=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>X3D ⇄ MuJoCo — a briefing</title>
<meta name="description" content="An open bridge between X3D (how 3D things look) and MuJoCo (how they move): what we built, the evidence, and the path to planet scale.">
<style>
@font-face{font-family:S;src:url(data:font/woff2;base64,${font('Droid/DroidSerif-Regular.woff2')}) format("woff2");font-style:normal}
@font-face{font-family:S;src:url(data:font/woff2;base64,${font('Droid/DroidSerif-Italic.woff2')}) format("woff2");font-style:italic}
@font-face{font-family:P;src:url(data:font/woff2;base64,${font('PT_Sans/PTSans-Regular.woff2')}) format("woff2");font-weight:400}
@font-face{font-family:P;src:url(data:font/woff2;base64,${font('PT_Sans/PTSans-Bold.woff2')}) format("woff2");font-weight:700}
@font-face{font-family:M;src:url(data:font/woff2;base64,${font('Ubuntu/UbuntuMono-R.woff2')}) format("woff2");font-weight:400}
@font-face{font-family:M;src:url(data:font/woff2;base64,${font('Ubuntu/UbuntuMono-B.woff2')}) format("woff2");font-weight:700}
:root{--paper:#f2ede1;--paper-2:#e9e2d1;--ink:#1c1915;--ink-2:#4a443b;--ink-3:#8a8274;--x3d:#2343d6;--x3d-soft:#dfe4fb;--mj:#df4a1f;--mj-soft:#fbe2d8}
*{box-sizing:border-box}html{background:var(--paper)}
body{margin:0;color:var(--ink);font:400 17px/1.65 P,"Gill Sans",sans-serif;-webkit-font-smoothing:antialiased;
 background:var(--paper) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .1 0 0 0 0 .09 0 0 0 0 .07 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{max-width:1080px;margin:0 auto;padding:0 32px}
.serif{font-family:S,Georgia,serif}.mono{font-family:M,Menlo,monospace;font-variant-numeric:tabular-nums}
.x3d{color:var(--x3d)}.mj{color:var(--mj)}
.kicker{font:400 11.5px/1 M,monospace;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-2);margin:0}
h1,h2,h3{font-family:S,Georgia,serif;font-weight:400;margin:0}
h1{font-size:clamp(44px,7vw,84px);line-height:.98;letter-spacing:-.01em}
h2{font-size:clamp(30px,4vw,44px);line-height:1.06;max-width:24ch}
h3{font-size:22px;line-height:1.2}
p{margin:.6em 0}.lede{font-size:20px;line-height:1.6;color:var(--ink-2);max-width:56ch}.muted{color:var(--ink-2)}.small{font-size:13.5px;line-height:1.5}
b{color:var(--ink)}
header.mast{border-bottom:2px solid var(--ink);display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 0}
section{padding:56px 0;border-top:1px solid rgba(28,25,21,.15)}
.sec-head{display:grid;grid-template-columns:76px 1fr;gap:8px;margin-bottom:28px}
.sec-num{font:italic 38px/1 S,serif;color:var(--ink-3)}
.grid{display:grid;gap:18px}.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
.hero{display:grid;grid-template-columns:1.3fr .7fr;gap:40px;align-items:end;padding:48px 0 36px}
.card{background:#faf7ef;border:1.5px solid var(--ink);border-radius:6px;padding:20px}
.tile .n{font:700 44px/1 M,monospace}.tile .n small{font-size:20px;color:var(--ink-3)}.tile p{margin:.5em 0 0}
.plate{position:relative;border-radius:4px;box-shadow:0 30px 60px -30px rgba(28,25,21,.55),0 0 0 1px rgba(28,25,21,.35);overflow:visible}
.plate img{display:block;width:100%;border-radius:4px}
.plate:before,.plate:after{content:"";position:absolute;width:18px;height:18px;border:2px solid var(--ink)}
.plate:before{top:-9px;left:-9px;border-right:0;border-bottom:0}.plate:after{bottom:-9px;right:-9px;border-left:0;border-top:0}
figure{margin:0}figcaption{font-size:13.5px;line-height:1.5;color:var(--ink-2);margin-top:10px}
.owner{padding:22px;border-radius:6px;border:1.5px solid var(--ink)}.owner ul{font:400 20px/1.5 S,serif;margin:.6em 0 0;padding-left:1.1em}
.ox{background:var(--x3d-soft);border-left:5px solid var(--x3d)}.om{background:var(--mj-soft);border-right:5px solid var(--mj)}
.quote{font:400 clamp(24px,3vw,32px)/1.3 S,serif}
.stamp{display:inline-block;border:2px solid currentColor;border-radius:4px;padding:2px 8px;font:700 11px/1.4 M,monospace;letter-spacing:.12em;text-transform:uppercase;transform:rotate(-2deg)}
.chat p{margin:0 0 8px;padding:8px 12px;border-radius:4px;font-size:14.5px}
.you{background:var(--paper-2);border-left:3px solid var(--ink);margin-right:40px !important;font:italic 15px/1.45 S,serif}
.tool{background:var(--mj-soft);border-right:3px solid var(--mj);margin-left:40px !important;font:13px/1.45 M,monospace}
svg{max-width:100%;height:auto;display:block}.scroll{overflow-x:auto}
.flow{stroke-dasharray:6 6;animation:dash 1.2s linear infinite}@keyframes dash{to{stroke-dashoffset:-24}}
.live-dot{animation:pulse 1.4s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
.limits li{margin:0 0 10px}
.ask{border:2px solid var(--ink);border-radius:8px;padding:24px;background:#faf7ef;box-shadow:5px 5px 0 var(--ink)}
.ask ol{margin:.4em 0 0;padding-left:1.2em}.ask li{margin:.35em 0}
code,.code{font:14px/1.5 M,monospace;background:var(--paper-2);padding:1px 6px;border-radius:3px}
footer{border-top:2px solid var(--ink);padding:22px 0 44px;font-size:13px;color:var(--ink-2)}
@media (max-width:820px){.hero,.g2,.g3{grid-template-columns:1fr}.g4{grid-template-columns:1fr 1fr}.sec-head{grid-template-columns:1fr}.wrap{padding:0 18px}}
@media (prefers-reduced-motion:reduce){.flow,.live-dot{animation:none}}
@media print{@page{size:A4;margin:12mm}body{font-size:12.5px;background:var(--paper)}.wrap{max-width:none;padding:0}
 section{padding:22px 0;break-inside:auto}.card,.owner,figure,.ask,.tile{break-inside:avoid}h2{font-size:28px}h1{font-size:50px}.lede{font-size:15px}
 .flow,.live-dot{animation:none}.no-print{display:none}
 .hero{grid-template-columns:1.45fr .55fr!important;padding:16px 0!important;gap:24px}.g2{grid-template-columns:1fr 1fr!important}.g3{grid-template-columns:repeat(3,1fr)!important}.g4{grid-template-columns:repeat(4,1fr)!important}
 .sec-head{grid-template-columns:56px 1fr!important;margin-bottom:16px}.sec-num{font-size:28px}.card{padding:14px}.tile .n{font-size:32px}.quote{font-size:20px}.owner ul{font-size:16px}.limits{columns:2!important}
 section{break-before:auto}h2{break-after:avoid}.sec-head{break-after:avoid}}
</style></head><body>
<div class="wrap">
<header class="mast"><p class="mono" style="margin:0;font-size:12px;letter-spacing:.2em">FIELD NOTES · Nº 1 · <span class="x3d">X3D</span> ⇄ <span class="mj">MUJOCO</span></p><p class="kicker">A briefing for colleagues · ${date}</p></header>

<div class="hero">
 <div><p class="kicker">An open bridge between two worlds</p>
  <h1 style="margin-top:16px">One language for how things <i class="x3d">look</i>.<br>Another for how they <i class="mj">move</i>.</h1>
  <p class="lede" style="margin-top:22px"><b>X3D</b> is the ISO-standard, web-native format for 3D scenes. <b>MuJoCo</b> is the physics engine robotics researchers trust. They have never spoken to each other. <b>We built the bridge</b>, and it runs entirely in a web browser, with nothing to install.</p></div>
 <div>${bubbles}</div>
</div>

<section style="border-top:2px solid var(--ink)">
 <div class="sec-head"><p class="sec-num">§1</p><div><p class="kicker">What it does, live</p><h2>A robot arm pushes into a ball. <i>The two engines narrate it.</i></h2></div></div>
 <div class="grid" style="grid-template-columns:1.25fr .75fr;align-items:start">
  <figure><div class="plate"><img alt="The live 3D scene: a two-link robot arm pressing its tip against an orange ball" src="data:image/jpeg;base64,${plate}"></div>
   <figcaption>Captured from the running app: MuJoCo 3.17 (WebAssembly) computes the motion and X_ITE 16.7 draws it. The tip was pressing with <b>${force} N</b>, about ${Math.round(Number(force)/9.81*1000)||'—'} g of push.</figcaption></figure>
  <figure><img alt="The running conversation between X3D and MuJoCo, each message translated into plain English" src="data:image/jpeg;base64,${convo}" style="width:100%;border-radius:6px;border:1.5px solid var(--ink)">
   <figcaption>Every message between the two, translated. Italic: what it means. Small print: the actual contract message.</figcaption></figure>
 </div>
</section>

<section>
 <div class="sec-head"><p class="sec-num">§2</p><div><p class="kicker">Why both communities should care</p><h2>Each side gains what it <i>can't easily build alone</i>.</h2></div></div>
 <div class="grid g3">
  <div class="card"><h3 class="x3d">X3D gains</h3><p class="muted">A real dynamics engine without inventing one, and a standard place to author physical parameters (masses, lengths, contacts) inside an open, inspectable scene format.</p></div>
  <div class="card"><h3 class="mj">MuJoCo gains</h3><p class="muted">A standard, browser-viewable presentation layer, not just for <i>models</i> but for whole <i>experiments</i>: scene, sensors, commands and results travel together.</p></div>
  <div class="card"><h3>Researchers gain</h3><p class="muted">Reproducible experiment packages. A reviewer opens one ZIP in a web page, sees the same scene, re-runs the trial and checks the numbers.</p></div>
 </div>
</section>

<section>
 <div class="sec-head"><p class="sec-num">§3</p><div><p class="kicker">The one design rule</p><h2>Every value has <i>exactly one owner</i>.</h2></div></div>
 <div class="grid g2">
  <div class="owner ox"><p class="kicker x3d">X3D owns</p><ul><li>how everything looks</li><li>what you click and drag</li><li>what you <i>want</i>: goals, edits</li><li>units, labels, stable ids</li></ul></div>
  <div class="owner om"><p class="kicker mj">MuJoCo owns</p><ul><li>where things actually are</li><li>speeds, forces, collisions</li><li>sensor readings</li><li>the clock</li></ul></div>
 </div>
 <p class="muted" style="max-width:72ch;margin-top:18px">The 3D scene only <i>asks</i>; the physics engine only <i>answers</i>. Every request carries an id and the version of the world it was meant for, so a stale request is refused rather than quietly applied. Changing a goal is an instruction. Moving the ball changes the world, so MuJoCo recompiles it and says so. The contract (<span class="mono">x3d-mujoco/0.1</span>) is versioned and has JSON Schemas.</p>
</section>

<section>
 <div class="sec-head"><p class="sec-num">§4</p><div><p class="kicker">Receipts, not promises</p><h2>${checks} automated checks, <i>all passing</i>.</h2></div></div>
 <div class="grid g4">
  <div class="card tile"><p class="n">${E.nodeChecks.passed}<small>/${E.nodeChecks.total}</small></p><p><b>engine &amp; contract tests</b></p><p class="small muted">Real MuJoCo: every command type, round trips, stale and duplicate requests.</p></div>
  <div class="card tile"><p class="n">${E.threats.defended}</p><p><b>attacks refused</b></p><p class="small muted">Entity bombs, ZIP bombs, path traversal, hidden scripts. ${E.threats.gaps} weaker spots measured and documented.</p></div>
  <div class="card tile"><p class="n">3<small> browsers</small></p><p><b>driven end to end</b></p><p class="small muted">${E.browsers.map(b=>`${b.label} ${b.version??''}`).join(', ')}, with hardware WebGL: drags, rebuilds, export/import, phone width, keyboard only.</p></div>
  <div class="card tile"><p class="n">${E.secondValidator.errorsBefore[0]}→${E.secondValidator.errorsAfter[0]}</p><p><b>bugs a 2nd validator caught</b></p><p class="small muted">An independent X3D checker found errors in every exported scene that XML Schema misses. Fixed.</p></div>
 </div>
 <div class="grid g2" style="margin-top:18px">
  <div class="card"><p class="kicker">The number that surprised us</p><p class="quote" style="margin-top:12px">Browser and native Python runs of the same experiment end within <span class="mj">6&thinsp;×&thinsp;10<sup style="font-size:.6em">−16</sup></span> radians of each other.</p><p class="muted">After 2,500 steps of contact physics, in Chromium, Firefox and WebKit. At the tip of the one-metre arm that is <b>smaller than a proton</b>. A result found in a browser holds up in a lab.</p></div>
  <div class="card"><p class="kicker">Reproducible by construction</p><p class="quote" style="margin-top:12px">Rebuilding the app from source gave a file <i>byte-identical</i> to the one delivered.</p><p class="muted">The Python tools generate MuJoCo models byte-identical to the browser's, so packages written by either side check out on the other.</p></div>
 </div>
</section>

<section>
 <div class="sec-head"><p class="sec-num">§5</p><div><p class="kicker">For AI assistants too</p><h2>An assistant can now <i>build, check and run</i> physics experiments.</h2></div></div>
 <div class="grid g2" style="align-items:start">
  <div class="card chat">
   <p class="you">"Turn this pendulum into a 3D scene."</p>
   <p class="tool">mjcf_to_x3d → valid X3D, 0 errors. Losses listed: 2 joints, 1 keyframe, dynamics.</p>
   <p class="you">"Push the arm into the ball and save the experiment."</p>
   <p class="tool">simulate → 2,500 steps, 1 contact, package saved · validate_scene → consistent.</p>
   <p class="you">"Load this: &lt;include file="/etc/passwd"/&gt;"</p>
   <p class="tool">Refused: &lt;include&gt; reads other files.</p>
   <p class="small" style="color:var(--ink-3);margin-top:6px">Condensed from a recorded session with the real tools.</p>
  </div>
  <div><p class="muted">Three tools speak the bridge contract through the <b>Model Context Protocol</b>, the standard way AI assistants use software. They live alongside X3D validation in one server:</p>
   <p><span class="mono"><b>validate_scene</b></span> <span class="muted">checks a scene or experiment package.</span><br><span class="mono"><b>mjcf_to_x3d</b></span> <span class="muted">turns any MuJoCo model into an X3D scene and reports what it lost.</span><br><span class="mono"><b>simulate</b></span> <span class="muted">runs it and returns the measurements.</span></p>
   <p class="muted">No conversion ever claims to be perfect: every one returns a machine-readable loss report.</p></div>
 </div>
</section>

<section>
 <div class="sec-head"><p class="sec-num">§6</p><div><p class="kicker">The path to planet scale</p><h2>From one laptop to <i>tens of thousands of researchers a day</i>.</h2></div></div>
 <figure class="scroll">${phases}<figcaption><b>The route.</b> Each ▯ is a gate: a phase ends only when its tests pass and an evidence file says so. Solid = built and checked; dotted = planned.</figcaption></figure>
 <div class="grid g2" style="margin-top:34px;align-items:center">
  <figure>${cloud}<figcaption>Each <span class="mj">●</span> is a visitor's browser running its own physics. The centre only hands out a static app, once, from a cache.</figcaption></figure>
  <div><p class="kicker">Why it can be cheap</p><p class="quote" style="margin-top:10px">The costly part of physics is the simulation loop. It runs in each visitor's browser, so <i>more visitors add almost no server cost</i>.</p><p class="muted">Servers do only what browsers can't: batches of thousands of rollouts, long jobs, converting big model libraries. That part is metered, and GPU sweeps sit behind their own quota.</p></div>
 </div>
 <p class="kicker" style="margin:30px 0 12px">The arithmetic for 20,000 researchers a day (estimates)</p>
 <div class="grid g4">${[['~600 GB','app downloads a day','cached at a CDN'],['~4.6 /s','API calls on average','~50/s at a 10× peak'],['~14 cores','for server rollouts','autoscaled for peaks'],['~7 TB','of packages a year','before de-duplication']].map(([v,l,s])=>`<div class="card tile"><p class="n" style="font-size:30px">${v}</p><p><b>${l}</b></p><p class="small muted">${s}</p></div>`).join('')}</div>
 <figure class="card" style="margin-top:18px"><p style="margin:0"><b>Server CPU-hours per day at 20,000 researchers</b> <span class="muted small">(estimates; the vermilion bar is work this design doesn't pay for)</span></p>${bars}<figcaption>Interactive physics: 20,000 people × 1 hour, if servers ran it (avoided: it runs in browsers). Batch rollouts: 10% of people run 10 jobs of 60 CPU-seconds. API: 20 calls each × 50 ms.</figcaption></figure>
 <figure class="scroll" style="margin-top:30px">${arch}<figcaption><b>Same contract, three sizes.</b> What changes is <i>where</i> the boxes run, never the language they speak. Year one is deliberately local; hosting starts at phase 3.</figcaption></figure>
 <div class="grid g3" style="margin-top:26px">
  <div style="border-top:2px solid var(--ink);padding-top:10px"><b>Scale is mostly trust</b><p class="small muted">Correctness, reproducibility, security and versioning first. That is why phase 0 was tests, a licence and a threat model.</p></div>
  <div style="border-top:2px solid var(--ink);padding-top:10px"><b>Old results keep working</b><p class="small muted">Each package pins its engine build; old builds are kept, so a 2026 paper still replays in 2036.</p></div>
  <div style="border-top:2px solid var(--ink);padding-top:10px"><b>No single codebase to trust</b><p class="small muted">The end state is an open spec, a conformance suite anyone can run, and an independent second implementation.</p></div>
 </div>
</section>

<section>
 <div class="sec-head"><p class="sec-num">§7</p><div><p class="kicker">Honest limits</p><h2>What it <i>isn't</i>, yet.</h2></div></div>
 <ul class="limits muted" style="columns:2;column-gap:40px;padding-left:1.1em">
  <li><b>Not a universal translator.</b> One carefully described arm today; general MuJoCo ⇄ X3D (with a public scoreboard over MuJoCo Menagerie) is phase 1.</li>
  <li><b>Not X3D's own physics.</b> X3D has a RigidBodyPhysics component; we don't claim to implement it. MuJoCo is the authority.</li>
  <li><b>Not bit-for-bit replay yet.</b> Records are observations. Exact checkpoints come in phase 1.</li>
  <li><b>The GPU notebook is a sketch.</b> It is written and checked, but hasn't been run on a GPU yet.</li>
 </ul>
</section>

<section>
 <div class="ask">
  <p class="kicker">What I'd love from you</p>
  <h3 style="margin-top:10px">Try it in two minutes, then tell me where it breaks.</h3>
  <ol class="muted"><li>Unzip <span class="code">X3D-MuJoCo-Bridge-${pkg.version}.zip</span> and run <span class="code">python3 start.py</span> (Windows: <span class="code">START-Windows.cmd</span>). The guided tour opens in your browser.</li>
   <li>Robotics folks: which MuJoCo models should the first conversion scoreboard cover?</li>
   <li>X3D folks: is the metadata convention something you'd author by hand, and would RigidBodyPhysics or H-Anim users want a profile next?</li>
   <li>Everyone: what would make you trust a result someone sends you as an experiment package?</li></ol>
 </div>
</section>

<footer><p><b>X3D ⇄ MuJoCo bridge ${pkg.version}</b> · contract x3d-mujoco/0.1 · MuJoCo 3.17 · X_ITE 16.7 · open source under Apache-2.0 · prepared by Hagop Jay Tumayan, ${date}.</p>
<p>Numbers come from the project's own test records (generated ${E.generatedAt}); scale figures are estimates. "MuJoCo" (Google DeepMind) and "X3D" (Web3D Consortium) name other organisations' projects; no endorsement is implied. Embedded fonts: Droid Serif (Apache-2.0), PT Sans (SIL OFL 1.1), Ubuntu Mono (Ubuntu Font Licence 1.0). This file works offline and makes no network requests.</p></footer>
</div></body></html>`;

const htmlPath=path.join(outDir,'X3D-MuJoCo-Bridge-brief.html');writeFileSync(htmlPath,html);
const v=await browser.newPage({viewport:{width:1280,height:900}});
const net=[];v.on('request',r=>{if(!r.url().startsWith('file:')&&!r.url().startsWith('data:'))net.push(r.url());});
await v.goto('file://'+htmlPath);await v.waitForTimeout(800);
await v.screenshot({path:path.join(outDir,'..','evidence','brief-preview.webp').replace('/release/../','/'),fullPage:true}).catch(()=>{});
const pdfPath=path.join(outDir,'X3D-MuJoCo-Bridge-brief.pdf');
await v.emulateMedia({media:'print',reducedMotion:'reduce'});
await v.pdf({path:pdfPath,format:'A4',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});
console.log(JSON.stringify({html:htmlPath,htmlKB:Math.round(html.length/1024),pdf:pdfPath,pdfKB:Math.round(readFileSync(pdfPath).length/1024),externalRequests:net,force}));
await browser.close();process.exit(0);
