// shared: node grab.js url out.png [wait ms] [extra eval]
const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
 const [,,url,out,wait,pre]=process.argv;
 const b=await chromium.launch({executablePath:process.env.CHROME||undefined,args:['--enable-unsafe-webgpu','--no-sandbox','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const p=await b.newPage({viewport:{width:640,height:360}});
 p.on('console',m=>console.log('console',m.type(),m.text().slice(0,500)));
 p.on('pageerror',e=>console.log('pageerror',e.message.slice(0,500)));
 await p.goto(url);
 await p.waitForFunction(()=>window.__done||window.__err,null,{timeout:180000}).catch(e=>console.log('timeout'));
 await p.waitForTimeout(+wait||3000);
 if(pre){ console.log('pre',JSON.stringify(await p.evaluate(pre))); await p.waitForTimeout(+wait||3000);}
 console.log(await p.evaluate(()=>window.__err||window.__info));
 const data=await p.evaluate(async()=>{ const t=window.__sc; if(!t) return null; const d=window.__ctx._d; const w=t.width,h=t.height; const bpr=Math.ceil(w*4/256)*256; const buf=d.createBuffer({size:bpr*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}); const e=d.createCommandEncoder(); e.copyTextureToBuffer({texture:t},{buffer:buf,bytesPerRow:bpr},[w,h]); d.queue.submit([e.finish()]); await buf.mapAsync(GPUMapMode.READ); const a=new Uint8Array(buf.getMappedRange().slice(0)); const c=document.createElement('canvas'); c.width=w;c.height=h; const x=c.getContext('2d'); const im=x.createImageData(w,h); const bgra=window.__fmt.startsWith('bgra'); for(let y=0;y<h;y++)for(let i=0;i<w;i++){const s=y*bpr+i*4,o=(y*w+i)*4; im.data[o]=a[s+(bgra?2:0)];im.data[o+1]=a[s+1];im.data[o+2]=a[s+(bgra?0:2)];im.data[o+3]=255;} x.putImageData(im,0,0); return c.toDataURL('image/png').split(',')[1]; });
 if(data) fs.writeFileSync(out,Buffer.from(data,'base64'));
 await b.close();
})();
