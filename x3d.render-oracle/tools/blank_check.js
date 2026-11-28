// node blank.js SCENEDIR NAME...  -> JSON {name: fraction of pixels differing from the corner pixel} in X_ITE 16.6.0 (128x128, SwiftShader)
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const dist=path.join(__dirname,'node_modules/x_ite/dist');
const [dir,...names]=process.argv.slice(2);
const mime={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.json':'application/json','.html':'text/html'};
const srv=http.createServer((q,r)=>{ if(q.url==='/'){r.setHeader('content-type','text/html');return r.end(`<!doctype html><meta charset=utf-8><link rel=stylesheet href="/x_ite.css"><body style="margin:0"><x3d-canvas id=c style="width:128px;height:128px;display:block" notifications="false" contextMenu="false"></x3d-canvas><script src="/x_ite.min.js"></script>`);}
 const f=path.join(dist,decodeURIComponent(q.url.split('?')[0])); if(!f.startsWith(dist)||!fs.existsSync(f)){r.statusCode=404;return r.end();} r.setHeader('content-type',mime[path.extname(f)]||'application/octet-stream'); r.end(fs.readFileSync(f));});
(async()=>{await new Promise(o=>srv.listen(0,o));const port=srv.address().port;
const br=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const res={};
for(const n of names){const pg=await br.newPage({viewport:{width:128,height:128}});
 try{await pg.goto(`http://localhost:${port}/`);await pg.waitForFunction(()=>window.X3D&&X3D.getBrowser('#c'),{timeout:20000});
  const xml=fs.readFileSync(path.join(dir,n+'.x3d'),'utf8');
  const err=await pg.evaluate(async(xml)=>{const b=X3D.getBrowser('#c');try{b.setBrowserOption('Notifications',false);const sc=await b.createX3DFromString(xml);await b.replaceWorld(sc);for(let i=0;i<8;i++)await b.nextFrame();return null;}catch(e){return String(e).slice(0,120);}},xml);
  const buf=await pg.locator('#c').screenshot();
  const {PNG}=(()=>{try{return require('pngjs')}catch(e){return{}}})();
  const png=PNG?PNG.sync.read(buf):null; let frac=null;
  if(png){const d=png.data,c=[d[0],d[1],d[2]];let k=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-c[0])+Math.abs(d[i+1]-c[1])+Math.abs(d[i+2]-c[2])>12)k++;frac=+(k/(d.length/4)).toFixed(4);}
  res[n]={frac,err};}catch(e){res[n]={frac:null,err:String(e).slice(0,120)};}
 await pg.close();}
console.log(JSON.stringify(res));await br.close();srv.close();})();
