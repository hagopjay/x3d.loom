// Offline native-X3D edition. No bundler or package install required.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';import {createArtwork} from '../src/scene-package.js';
const root=fileURLToPath(new URL('..',import.meta.url)),vendor=path.join(root,'vendor/x_ite');
const output=process.argv[2]||path.join(root,'dist/Sri-Yantra-Resonance-Loom.html');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const origin=JSON.parse(fs.readFileSync(path.join(vendor,'ORIGIN.json'),'utf8'));
for(const [name,hash]of Object.entries(origin.files_sha256))if(sha(fs.readFileSync(path.join(vendor,name)))!==hash)throw Error('Pinned runtime drift: '+name);
const mime=name=>name.endsWith('.wasm')?'application/wasm':name.endsWith('.woff2')?'font/woff2':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.png')?'image/png':'application/octet-stream';
const data=(type,bytes)=>'data:'+type+';base64,'+Buffer.from(bytes).toString('base64');
const assets={};for(const name of Object.keys(origin.files_sha256))if(name.startsWith('assets/'))assets[name]=data(mime(name),fs.readFileSync(path.join(vendor,name)));
let css=fs.readFileSync(path.join(vendor,'x_ite.css'),'utf8');
css=css.replace(/url\(([^)]+)\)/g,(whole,p)=>{const name=p.replace(/^['"]|['"]$/g,'');if(name.startsWith('data:'))return whole;if(!assets[name])throw Error('Missing CSS asset '+name);return 'url('+assets[name]+')';});
assets['x_ite.css']=data('text/css',css);
const original=fs.readFileSync(path.join(vendor,'x_ite.min.js'),'utf8');let runtime=original;
// Resource-URL adaptation only, applied to the derived standalone. The pinned
// vendor source remains unchanged. X3D nodes/shaders/math are untouched.
const edits=[
 ['e=document.currentScript?.src??document.location.href','e=document.currentScript?.src||document.location.href'],
 ['new URL("x_ite.css",ao.getScriptURL())','window.__sriAsset("x_ite.css")'],
 ['new URL(`assets/fonts/${e}`,this.getScriptURL()).href','window.__sriAsset("assets/fonts/"+e)'],
 ['new URL(`assets/lib/${e}`,this.getScriptURL()).href','window.__sriAsset("assets/lib/"+e)']
];
const cssIntegrity='sha384-'+crypto.createHash('sha384').update(css).digest('base64');
edits.push(['sha384-LjqGCbHHyX6wENYgkRJ/9RmmFuv15OQ5a2tXJcy74LdX25w1zBhrgNBZCht6zgop',cssIntegrity]);
for(const[a,b]of edits){if(runtime.split(a).length!==2)throw Error('Runtime URL adapter no longer matches pinned16.8.0');runtime=runtime.replace(a,()=>b);}
const bootstrap='window.__SRI_ASSETS='+JSON.stringify(assets)+';window.__sriAsset=function(name){if(!Object.hasOwn(window.__SRI_ASSETS,name))throw Error("Unbundled runtime resource: "+name);return window.__SRI_ASSETS[name];};';
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>')
 .replace('<script src="vendor/x_ite/x_ite.min.js"></script>',()=>'<script>'+bootstrap+'</script><script>'+runtime.replaceAll('</script','<\\/script')+'</script>');
const modules=new Map();
function visit(file){
 if(modules.has(file))return;modules.set(file,'');
 const source=fs.readFileSync(path.join(root,file),'utf8').replace(/\b(from\s*|import\s*)(['"])([^'"\n]+)\2/g,(whole,prefix,q,spec)=>{
  if(!spec.startsWith('.'))throw Error('Unexpected external module '+spec);
  const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));if(dependency.startsWith('../'))throw Error('Module escapes app');visit(dependency);return prefix+q+'sri/'+dependency+q;
 });modules.set(file,data('text/javascript',source));
}
visit('src/app.js');
const importMap='<script type="importmap">'+JSON.stringify({imports:Object.fromEntries([...modules].map(([name,url])=>['sri/'+name,url]))})+'</script>';
html=html.replace('<script type="module" src="src/app.js"></script>',()=>importMap+'<script type="module">import "sri/src/app.js";</script>');
const guidePath=path.join(root,'docs/FIELD-GUIDE.html');
if(fs.existsSync(guidePath)){
 const guide=fs.readFileSync(guidePath,'utf8');
 html=html.replace('</body>',()=>'<script>document.getElementById("guide-frame").srcdoc='+JSON.stringify(guide).replaceAll('<','\\u003c')+';</script></body>');
}
html=html.replace('</body>',()=>'<!-- X_ITE16.8.0 license:\n'+(fs.readFileSync(path.join(vendor,'DIST-LICENSE.md'),'utf8')+'\n'+fs.readFileSync(path.join(vendor,'assets/fonts/PT_Sans/OFL.txt'),'utf8')).replaceAll('--','—')+'\n--></body>');
// Replacement callbacks preserve literal dollar sequences in embedded code.
if(!html.includes(runtime.replaceAll('</script','<\\/script')))throw Error('Standalone runtime byte identity failed.');
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,html);
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const scene=createArtwork({quality:'high'});fs.writeFileSync(path.join(root,'dist/Sri-Yantra-Resonance-Loom.x3d'),scene.xml);
const adapter={schema:'standalone-resource-adapter/1',runtime:'X_ITE16.8.0',originalRuntimeSHA256:sha(original),standaloneRuntimeSHA256:sha(runtime),changes:edits.map(([from,to])=>({from,to})),scope:'Resource URL expressions, inline-script base URL fallback and rebuilt CSS integrity hash only. Geometry, shaders, numerical fields and rendering algorithms unchanged.',moduleCount:modules.size,embeddedAssetCount:Object.keys(assets).length,htmlBytes:Buffer.byteLength(html),externalRuntimeRequests:0};
fs.writeFileSync(path.join(root,'docs/packaging-adapter.json'),JSON.stringify(adapter,null,2)+'\n');
console.log(JSON.stringify({output:path.resolve(output),bytes:Buffer.byteLength(html),modules:modules.size,assets:Object.keys(assets).length,x3dBytes:Buffer.byteLength(scene.xml)}));
