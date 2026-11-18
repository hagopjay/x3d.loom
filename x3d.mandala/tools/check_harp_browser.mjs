// CHAMBER HARP 2.0 browser gate. Drives real pointer clicks through X_ITE's
// TouchSensor on the source page (served over HTTP) and on the standalone
// (file://), then checks lights, sparks, keys, voids, bloom and that the
// canonical YantraCoordinates point field is never written.
// Usage: node tools/check_harp_browser.mjs [--chromium PATH] [--shots DIR]
// Writes docs/harp-browser-2.0.json. Needs Playwright (npm i playwright or a
// global install on NODE_PATH via a symlinked node_modules).
import {chromium} from 'playwright';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:undefined;};
const chrome=arg('--chromium')||process.env.CHROME,shots=arg('--shots');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.x3d':'model/x3d+xml','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${srv.address().port}/`;
const browser=await chromium.launch({...(chrome?{executablePath:chrome}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const report={schema:'sri-harp-browser/1',created_utc:new Date().toISOString(),browser:browser.version(),renderer:'SwiftShader (software WebGL2 via ANGLE); real GPUs were not available to this gate',targets:[]};
let fails=0;
async function run(url,label,deep){
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errs=[],checks=[];
  const check=(name,ok,detail)=>{checks.push({name,pass:!!ok,detail});if(!ok)fails++;console.log((ok?'PASS ':'FAIL ')+label+' :: '+name+(ok?'':' '+JSON.stringify(detail)));};
  page.on('pageerror',e=>errs.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  page.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url());});page.on('request',r=>{const u=r.url();if(!/^(data|blob|file):/.test(u)&&!u.startsWith(base))errs.push('external request '+u);});
  await page.goto(url);await page.waitForFunction(()=>window.__sri?.ready||window.__sri?.error,null,{timeout:90000});
  const boot=await page.evaluate(()=>({error:__sri.error,audit:__sri.nativeAudit?.pass,residual:__sri.nativeAudit?.maxResidualR,lights:__sri.scene.getNamedNode('ChamberLight43')!==null,touch:!!__sri.scene.getNamedNode('ChamberTouch'),software:__sri.software||'',bloomOn:__sri.bloom?.enabled}));
  check('boots with native audit, 43 chamber lights and a TouchSensor',!boot.error&&boot.audit&&boot.lights&&boot.touch,boot);
  check('bloom defaults off on a software renderer',!boot.software||boot.bloomOn===false,{software:boot.software,bloomOn:boot.bloomOn});
  const before=await page.evaluate(()=>JSON.stringify(Array.from(__sri.scene.getNamedNode('YantraCoordinates').point)));
  // Immersive centres the yantra; the ortho camera then maps yantra units to pixels.
  await page.keyboard.press('KeyH');await page.waitForTimeout(800);
  await page.evaluate(()=>{__sri.transport.pause();__sri.settings.spiral=0;});await page.waitForTimeout(400);
  const toScreen=([x,y])=>page.evaluate(([x,y])=>{const vp=__sri.scene.getNamedNode('SanctuaryCamera'),f=Array.from(vp.fieldOfView),p=vp.position,W=innerWidth,H=innerHeight;
    const half=(f[3]-f[1])/2,ppu=Math.min(W,H)/2/half,k=2.35;return [W/2+(x*k-p.x)*ppu,H/2-(y*k-p.y)*ppu];},[x,y]);
  const F=await page.evaluate(()=>__sri.yantra.faces.map(f=>({id:f.id,c:f.centroid,ring:f.ring})));
  const hits=[];
  for(const id of ['Chamber_33','Chamber_40','Chamber_25','Chamber_12','Chamber_01']){
    const i=F.findIndex(f=>f.id===id),[sx,sy]=await toScreen(F[i].c),n0=await page.evaluate(()=>__sri.harp.struck);
    await page.mouse.click(sx,sy);await page.waitForTimeout(450);
    const r=await page.evaluate(([i])=>{const H=__sri.harp,last=H.strikes.at(-1),m=__sri.scene.getNamedNode('ChamberLight'+String(i+1).padStart(2,'0'));return {struck:H.struck,index:last?.index,transparency:m.transparency,sparks:__sri.sparks.live};},[i]);
    hits.push({id,screen:[Math.round(sx),Math.round(sy)],...r,ok:r.struck===n0+1&&r.index===i&&r.transparency<.6});
  }
  check('real pointer clicks strike the chamber under the cursor and light it (TouchSensor -> locate)',hits.every(h=>h.ok),hits);
  check('a strike launches sparks from the chamber',hits.some(h=>h.sparks>0),hits.map(h=>h.sparks));
  const voidC=await page.evaluate(()=>__sri.yantra.voids[0].centroid),[vx,vy]=await toScreen(voidC);
  const n1=await page.evaluate(()=>__sri.harp.struck);await page.mouse.click(vx,vy);await page.waitForTimeout(300);
  const voidR=await page.evaluate(()=>({struck:__sri.harp.struck,message:document.getElementById('message').textContent}));
  check('a void between chambers explains even coverage and does not strike',voidR.struck===n1&&/EVEN COVERAGE/.test(voidR.message),voidR);
  const n2=voidR.struck;await page.keyboard.press('Digit4');await page.waitForTimeout(900);
  const ring=await page.evaluate(()=>__sri.harp.struck);check('key 4 sounds ring 3 (10 chambers)',ring-n2===10,{delta:ring-n2});
  await page.keyboard.press('Space');await page.waitForTimeout(250);const res=await page.evaluate(()=>({live:__sri.sparks.live,lit:__sri.harp.lit}));
  check('Resonance (Space) cascades light through the chambers and bursts the bindu',res.live>10&&res.lit>10,res);
  if(deep){
    await page.evaluate(()=>{__sri.settings.spiral=.7;__sri.transport.resume();});await page.waitForTimeout(2500);
    const spiral=await page.evaluate(()=>({lit:__sri.harp.lit,beat:__sri.transport.beat()}));check('the transport spiral keeps chambers lit while running',spiral.lit>=1,spiral);
    await page.evaluate(()=>{document.getElementById('bloom').checked=true;document.getElementById('bloom').dispatchEvent(new Event('change'));});await page.waitForTimeout(1500);
    const bloom=await page.evaluate(()=>{const c=document.querySelector('canvas.bloom.far');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return {w:c.width,h:c.height,mean:s/(d.length/4)/3,hidden:c.hidden,governed:__sri.bloom.governed};});
    check('bloom overlay copies the native frame when enabled',bloom.mean>2&&bloom.w>0,bloom);
    if(shots){fs.mkdirSync(shots,{recursive:true});
      await page.evaluate(()=>{__sri.transport.pause();__sri.settings.spiral=0;const T=performance.now()/1000+60;for(const i of [0,11,16,26,32,39,21,22])__sri.harp.strikes.push({index:i,t:T});__sri.sparks.burst(0,0,40,performance.now()/1000+.05,{speed:1.4});});
      await page.waitForTimeout(700);await page.screenshot({path:path.join(shots,'harp-'+label+'.png')});}
  }
  const after=await page.evaluate(()=>JSON.stringify(Array.from(__sri.scene.getNamedNode('YantraCoordinates').point)));
  check('canonical YantraCoordinates unchanged after every interaction',before===after,{bytes:before.length});
  check('zero page errors, HTTP failures and external requests',!errs.length,errs);
  report.targets.push({target:label,url:url.replace(/127\.0\.0\.1:\d+/,'localhost').replace(pathToFileURL(root).href,'file://<x3d.mandala>'),checks});await page.close();
}
await run(base+'index.html','source',true);
const standalone=arg('--standalone')||path.join(root,'dist/Sri-Yantra-Resonance-Loom.html');
if(fs.existsSync(standalone))await run(pathToFileURL(path.resolve(standalone)).href,'standalone',true);
report.status=fails?'fail':'pass';report.failures=fails;
fs.writeFileSync(path.join(root,'docs/harp-browser-2.0.json'),JSON.stringify(report,null,2)+'\n');
await browser.close();srv.close();console.log(report.status.toUpperCase(),report.browser,'failures',fails);process.exit(fails?1:0);
