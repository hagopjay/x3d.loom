const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {PNG}=require('pngjs');
const D=__dirname;
const p=new PNG({width:1,height:1});p.data=Buffer.from([255,255,255,255]);
const uri='data:image/png;base64,'+PNG.sync.write(p).toString('base64');
const srv=http.createServer((q,r)=>{const f=path.join(D,decodeURIComponent(q.url.split('?')[0]));
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
 const t={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css'}[path.extname(f)]||'application/octet-stream';
 r.writeHead(200,{'content-type':t});fs.createReadStream(f).pipe(r);});
const srgbDec=b=>{const c=b/255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
function page(name,sceneInner,attrs){
 sceneInner=sceneInner.replace(/<(\w+)((?:[^<>"']|"[^"]*"|'[^']*')*?)\s*\/>/g,'<$1$2></$1>');
 const html=`<!doctype html><html><head><meta charset="utf-8"><script src="/node_modules/x_ite/dist/x_ite.min.js"></script>
<style>html,body{margin:0;background:#f0f}x3d-canvas{display:block;width:128px;height:128px}</style></head><body>
<x3d-canvas id="c" ${attrs} contentScale="1" antialiased="false" update="auto" splashScreen="false" notifications="false" contextMenu="false" cache="false"><X3D profile="Full" version="4.1"><Scene>${sceneInner}</Scene></X3D></x3d-canvas></body></html>`;
 fs.writeFileSync(path.join(D,'scenes',name+'.html'),html);
 return html;}
const bg=c=>`<NavigationInfo headlight="false" type='"NONE"'/><Background skyColor="${c}"/><Viewpoint position="0 0 5" fieldOfView="0.7854"/>`;
const env=`<EnvironmentLight intensity="1" diffuseTexture='<ComposedCubeMapTexture DEF="W"><ImageTexture containerField="front" url='"${uri}"'/><ImageTexture containerField="back" url='"${uri}"'/><ImageTexture containerField="left" url='"${uri}"'/><ImageTexture containerField="right" url='"${uri}"'/><ImageTexture containerField="top" url='"${uri}"'/><ImageTexture containerField="bottom" url='"${uri}"'/></ComposedCubeMapTexture>'/>`;
function envNode(){const faces=['front','back','left','right','top','bottom'].map(f=>`<ImageTexture containerField="${f}Texture" url='"${uri}"'/>`).join('');
 const t=n=>`<ComposedCubeMapTexture containerField="${n}">${faces}</ComposedCubeMapTexture>`;
 return `<EnvironmentLight intensity="1">${t('diffuseTexture')}${t('specularTexture')}</EnvironmentLight>`;}
const sphere=m=>`<Shape><Appearance>${m}</Appearance><Sphere radius="1.2"/></Shape>`;
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 let b;const launch=async a=>chromium.launch(a?{args:a}:{});
 b=await launch();let swift=false;
 const out={versions:{},furnace:[],exp2:[],probes:{}};
 async function probe(){const pg=await b.newPage();await pg.goto('http://127.0.0.1:'+port+'/node_modules/x_ite/dist/example.html').catch(()=>{});
  const r=await pg.evaluate(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2');if(!g)return null;const e=g.getExtension('WEBGL_debug_renderer_info');return {r:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'n/a',v:e?g.getParameter(e.UNMASKED_VENDOR_WEBGL):'n/a'}});await pg.close();return r;}
 let gl=await probe();
 if(!gl){await b.close();b=await launch(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']);gl=await probe();out.probes.flags='swiftshader args';}
 out.versions={chromium:b.version(),playwright:require('playwright/package.json').version,x_ite:JSON.parse(fs.readFileSync(D+'/node_modules/x_ite/package.json')).version,webgl:gl};
 async function measure(name,html){
  const pg=await b.newPage({viewport:{width:200,height:200},deviceScaleFactor:1});
  const logs=[];pg.on('console',m=>logs.push(m.text()));pg.on('pageerror',e=>logs.push('ERR '+e.message));
  await pg.goto('http://127.0.0.1:'+port+'/scenes/'+name+'.html');
  await pg.waitForTimeout(4000);
  const buf=await pg.locator('#c').screenshot();
  fs.writeFileSync(D+'/scenes/'+name+'.png',buf);
  const im=PNG.sync.read(buf);
  const px=(x,y)=>{const i=(y*im.width+x)*4;return [im.data[i],im.data[i+1],im.data[i+2]]};
  const cx=Math.floor(im.width/2)-2,cy=Math.floor(im.height/2)-2;let s=[0,0,0];
  for(let y=0;y<5;y++)for(let x=0;x<5;x++){const q=px(cx+x,cy+y);s=s.map((v,k)=>v+q[k]);}
  const mean=s.map(v=>v/25);await pg.close();
  return {name,size:[im.width,im.height],centre:mean,corner:px(2,2),logs:logs.filter(l=>/error|warn|fail/i.test(l)).slice(0,3)};}
 const attrs=(o={})=>`toneMapping="NONE" exposure="1" ${o.cs?`colorSpace="${o.cs}"`:''} ${o.dcs?`displayColorSpace="${o.dcs}"`:''}`;
 const cases=[[0,1,.5],[0,.5,.5],[0,0,.5],[0,1,1],[1,0,1],[1,.25,1],[1,.5,1],[1,.75,1],[1,1,1]];
 for(const [m,r,c] of cases){
  const mat=`<PhysicalMaterial baseColor="${c} ${c} ${c}" metallic="${m}" roughness="${r}"/>`;
  const name=`furnace_m${m}_r${r}_c${c}`;
  const h=page(name,bg('1 1 1')+envNode()+sphere(mat),attrs());
  const res=await measure(name,h);res.metallic=m;res.roughness=r;res.baseColor=c;res.linear=res.centre.map(srgbDec);out.furnace.push(res);}

 out.controls=[];
 const ctrls={noenv:'',intensity0:envNode().replace('intensity="1"','intensity="0"'),intensity05:envNode().replace('intensity="1"','intensity="0.5"')};
 for(const [ck,cv] of Object.entries(ctrls))for(const [m,r,c] of [[0,1,.5],[1,0,1],[1,.5,1]]){
  const name=`ctrl_${ck}_m${m}_r${r}_c${c}`;
  const h=page(name,bg('1 1 1')+cv+sphere(`<PhysicalMaterial baseColor="${c} ${c} ${c}" metallic="${m}" roughness="${r}"/>`),attrs());
  const res=await measure(name,h);res.linear=res.centre.map(srgbDec);out.controls.push(res);}
 const mats={a_unlit:'<UnlitMaterial emissiveColor="0.5 0.5 0.5"/>',b_legacy:'<Material diffuseColor="0 0 0" emissiveColor="0.5 0.5 0.5"/>',c_physical:'<PhysicalMaterial baseColor="0 0 0" emissiveColor="0.5 0.5 0.5" metallic="0" roughness="1"/>'};
 const modes=[['default',{}],['cs_LINEAR',{cs:'LINEAR'}],['cs_SRGB',{cs:'SRGB'}],['cs_LWPM',{cs:'LINEAR_WHEN_PHYSICAL_MATERIAL'}],['dcs_DISPLAY_P3',{dcs:'DISPLAY_P3'}]];
 for(const [mk,mv] of Object.entries(mats))for(const [dk,dv] of modes){
  const name=`exp2_${mk}_${dk}`;const h=page(name,bg('0 0 0')+sphere(mv),attrs(dv));
  const res=await measure(name,h);res.material=mk;res.mode=dk;out.exp2.push(res);}
 fs.writeFileSync(D+'/results.json',JSON.stringify(out,null,1));
 console.log(JSON.stringify(out.versions));
 for(const r of out.furnace)console.log(r.name,r.centre.join(','),'bg',r.corner.join(','),r.linear.map(v=>v.toFixed(3)).join(','),r.logs.join('|'));
 for(const r of out.controls)console.log(r.name,r.centre.join(','),r.linear.map(v=>v.toFixed(3)).join(','));
 for(const r of out.exp2)console.log(r.name,r.centre.join(','),'bg',r.corner.join(','),r.logs.join('|'));
 await b.close();srv.close();})();
