// node page-states.js PAGE_URL OUT_DIR: drives the built brain page through its layers, a look, a pick, the Inside view and the torso tab, one screenshot each
// (WebGPU swap chain stubbed with an offscreen texture, requestAnimationFrame slowed to 1.2 s so the software adapter is not flooded). Correctness only.
const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
 const url=process.argv[2], outdir=process.argv[3]; fs.mkdirSync(outdir,{recursive:true});
 const b=await chromium.launch({args:['--enable-unsafe-webgpu','--no-sandbox','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const p=await b.newPage({viewport:{width:1100,height:620}});
 const errs=[]; p.on('console',m=>{const t=m.text(); if(/error/i.test(m.type())) {errs.push(t.slice(0,200)); console.log('c',m.type(),t.slice(0,240));} else if(/x3d to babylon|warn/i.test(m.type()+t)) console.log('c',m.type(),t.slice(0,240));});
 p.on('pageerror',e=>{errs.push(e.message); console.log('pe',e.message.slice(0,300));});
 p.on('requestfailed',r=>console.log('reqfail',r.url().slice(0,100)));
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
 await p.waitForFunction(()=>window.__loom&&window.__loom.state&&window.__loom.state.ready,null,{timeout:240000}).catch(e=>console.log('not ready'));
 const shot=async(name,wait)=>{ await p.waitForTimeout(wait||7000); await p.evaluate(()=>window.__snap()); await p.waitForTimeout(400); await p.screenshot({path:outdir+'/'+name+'.png'}); console.log('shot',name); };
 const toggle=async(def)=>{ await p.evaluate((d)=>{const cb=document.querySelector('#layerList input[data-def="'+d+'"]'); cb.click();},def); };
 await shot('00-home',8000);
 await toggle('SW_TRACTS'); await shot('01-tracts');
 await toggle('SW_TRACTS'); await toggle('SW_SLICES'); await shot('02-slices');
 await toggle('SW_SLICES'); await toggle('SW_LABELS'); await shot('03-labels');
 await toggle('SW_LABELS'); await toggle('SW_CORTEX'); await toggle('SW_WET'); await shot('04-wet');
 await toggle('SW_WET'); await toggle('SW_CORTEX');
 await p.evaluate(()=>document.querySelector('#lookGrid .look:nth-child(4)').click()); await shot('05-look4');
 await p.evaluate(()=>document.querySelector('#btnLookReset').click());
 await p.mouse.move(520,300); await p.waitForTimeout(2500); await p.mouse.click(520,300); await p.waitForTimeout(3000);
 console.log('region panel:', JSON.stringify(await p.evaluate(()=>{const e=document.querySelector('#right'); return e? e.innerText.replace(/\s+/g,' ').slice(0,200):null;})));
 console.log('state:', JSON.stringify(await p.evaluate(()=>window.__loom.state)).slice(0,300));
 await shot('06-picked',4000);
 await p.evaluate(()=>{const c=document.querySelector('#views .chip[data-vp="VP_INSIDE"]'); if(c) c.click();}); await shot('07-inside',9000);
 await p.evaluate(()=>document.querySelector('#tab-torso').click()); await shot('08-torso',20000);
 console.log('errors:',errs.length);
 await b.close();
})();
