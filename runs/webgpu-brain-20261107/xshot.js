const { chromium } = require('playwright');
(async()=>{
 const [,,url,out,w,h,wait]=process.argv;
 const b=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:+w||640,height:+h||360}});
 p.on('pageerror',e=>console.log('pe',e.message.slice(0,200)));
 await p.goto(url);
 await p.waitForFunction(()=>window.__done||window.__err,null,{timeout:180000});
 console.log(await p.evaluate(()=>window.__err||'ok'));
 await p.waitForTimeout(+wait||30000);
 await p.screenshot({path:out}); await b.close();
})();
