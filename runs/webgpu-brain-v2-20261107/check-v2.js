// node check-v2.js PAGE_URL OUT_PREFIX [click]: opens a built Neural Canvas page in headless Chromium (SwiftShader WebGPU, swap chain stubbed, requestAnimationFrame slowed to 1.2 s),
// waits until the page's own state says ready, lets it settle, takes the canvas read-back plus the DOM as one screenshot (OUT_PREFIX-page.png) and the DOM alone (OUT_PREFIX-dom.png).
// With "click" it then presses the Timing button and prints the result block and the panel text (use ?tsec=4&twarm=1 so the window is short; frames are 1.2 s apart here, so the numbers are NOT valid).
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , url, outp, click] = process.argv;
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--no-sandbox', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  p.on('console', (m) => { if (/error/i.test(m.type())) { errs.push(m.text().slice(0, 200)); console.log('console', m.type(), m.text().slice(0, 240)); } });
  p.on('pageerror', (e) => { errs.push(e.message); console.log('pageerror', e.message.slice(0, 300)); });
  p.on('requestfailed', (r) => console.log('requestfailed', r.url().slice(0, 100)));
  await p.addInitScript(()=>{
   /*SLOWRAF*/ window.requestAnimationFrame=(cb)=>setTimeout(()=>cb(performance.now()),1200);
  const origGC=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t,o){ if(t!=='webgpu') return origGC.call(this,t,o);
   const canvas=this; const ctx={_t:null,_d:null,_f:'bgra8unorm',canvas,configure(c){this._d=c.device;this._f=c.format;window.__fmt=c.format;},unconfigure(){},
    getCurrentTexture(){const w=canvas.width,h=canvas.height; if(!this._t||this._t.width!==w||this._t.height!==h){this._t=this._d.createTexture({size:[w,h],format:this._f,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC|GPUTextureUsage.TEXTURE_BINDING}); window.__sc=this._t;} return this._t;}};
   window.__ctx=ctx; return ctx; };
  window.__snap=async()=>{ const t=window.__sc; if(!t) return false; const d=window.__ctx._d,w=t.width,h=t.height,bpr=Math.ceil(w*4/256)*256;
    const buf=d.createBuffer({size:bpr*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}); const e=d.createCommandEncoder(); e.copyTextureToBuffer({texture:t},{buffer:buf,bytesPerRow:bpr},[w,h]); d.queue.submit([e.finish()]);
    await buf.mapAsync(GPUMapMode.READ); const a=new Uint8Array(buf.getMappedRange().slice(0)); buf.destroy();
    const st=document.getElementById('stage'); let ov=document.getElementById('__ov'); if(!ov){ov=document.createElement('canvas');ov.id='__ov';ov.className=st.className;ov.style.cssText=st.style.cssText+';pointer-events:none';st.after(ov);} ov.style.top=st.style.top;ov.style.height=st.style.height; ov.width=w;ov.height=h;
    const x=ov.getContext('2d'),im=x.createImageData(w,h),bgra=window.__fmt.startsWith('bgra'); for(let y=0;y<h;y++)for(let i=0;i<w;i++){const s=y*bpr+i*4,o=(y*w+i)*4; im.data[o]=a[s+(bgra?2:0)];im.data[o+1]=a[s+1];im.data[o+2]=a[s+(bgra?0:2)];im.data[o+3]=255;} x.putImageData(im,0,0); return true; };
 });
  await p.goto(url);
  await p.waitForFunction(() => window.__loom && window.__loom.state && window.__loom.state.ready, null, { timeout: 240000 }).catch(() => console.log('not ready'));
  await p.waitForTimeout(9000); await p.evaluate(() => window.__snap()); await p.waitForTimeout(500);
  await p.screenshot({ path: outp + '-page.png' });
  console.log('state', JSON.stringify(await p.evaluate(() => ({ kind: window.__loom.state.kind, look: window.__loom.state.lookId, cam: window.__loom.state.cam, via: window.__adapterVia, build: window.__x3dBuild, hooks: !!window.__timingHooks, btn: !!document.getElementById('x3d-timing-btn') }))));
  if (click) {
    await p.evaluate(() => document.getElementById('x3d-timing-btn').click());
    await p.waitForFunction(() => window.__timingResult, null, { timeout: 120000 }).catch(() => console.log('no timing result'));
    await p.waitForTimeout(500);
    console.log('panel:', JSON.stringify(await p.evaluate(() => document.getElementById('x3d-timing-panel').innerText.slice(0, 700))));
    console.log('result:', JSON.stringify(await p.evaluate(() => window.__timingResult)).slice(0, 1400));
    await p.screenshot({ path: outp + '-panel.png' });
  }
  console.log('errors', errs.length); await b.close();
})();
