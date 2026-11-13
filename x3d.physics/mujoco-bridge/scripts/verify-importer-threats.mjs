// Importer threat tests (THREAT-MODEL.md). Each check is either
//   'defended'   the current reader rejects or neutralises the input (assertion must hold), or
//   'gap'        a documented weakness: the check measures the current behaviour so a fix shows up as a change.
// Runs the real readScene/importBundle with jsdom's DOMParser (the browser uses its own DOMParser).
import assert from 'node:assert/strict';
import {writeFile,mkdir,mkdtemp,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import JSZip from 'jszip';
import {DEFAULT_RECIPE,DEFAULT_TARGET} from '../src/bridge/contract.ts';
import {createScene,readScene,manifest} from '../src/bridge/scene.ts';
import {importBundle} from '../src/bridge/package.ts';
import {compileRecipe} from '../src/bridge/model.ts';
globalThis.DOMParser=new JSDOM().window.DOMParser;

const report={generatedAt:new Date().toISOString(),scope:'readScene (X3D) and importBundle (experiment ZIP) under hostile input; jsdom DOMParser stands in for the browser parser.',checks:[]};
async function check(id,kind,name,fn){
 const t0=performance.now();
 try{const details=await fn();report.checks.push({id,kind,name,status:'pass',ms:+(performance.now()-t0).toFixed(1),details});console.log(`PASS [${kind}] ${id} ${name}`);}
 catch(e){report.checks.push({id,kind,name,status:'fail',error:String(e.stack??e)});console.error(`FAIL [${kind}] ${id} ${name}: ${e.message}`);}
}
const xml=createScene(DEFAULT_RECIPE,DEFAULT_TARGET);
const rejects=(bad,re)=>{assert.throws(()=>readScene(bad),re);};
const ab=u8=>u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength);
async function pkg(edit=z=>z,opts={}){
 const z=new JSZip();z.file('manifest.json',JSON.stringify(manifest(DEFAULT_RECIPE,DEFAULT_TARGET),null,2));
 z.file('x3d/scene.x3d',xml);z.file('mjcf/model.xml',compileRecipe(DEFAULT_RECIPE));await edit(z);
 return z.generateAsync({type:'uint8array',compression:'DEFLATE',...opts});
}
// Patch every local and central header for `name` to declare `size` bytes uncompressed (a lying ZIP).
function lie(u8,name,size){
 const b=Buffer.from(u8),n=Buffer.from(name);let hits=0;
 for(let i=0;i<b.length-46;i++){
  if(b.readUInt32LE(i)===0x04034b50&&b.readUInt16LE(i+26)===n.length&&b.subarray(i+30,i+30+n.length).equals(n)){b.writeUInt32LE(size,i+22);hits++;}
  if(b.readUInt32LE(i)===0x02014b50&&b.readUInt16LE(i+28)===n.length&&b.subarray(i+46,i+46+n.length).equals(n)){b.writeUInt32LE(size,i+24);hits++;}
 }
 assert.equal(hits,2,'patched local + central header');return new Uint8Array(b);
}

// ---------- X3D / XML ----------
await check('X1','defended','XXE: external entity in an internal DTD subset is refused before parsing',()=>{
 rejects(xml.replace('<?xml version="1.0" encoding="UTF-8"?>','<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>').replace('name="upperLength_m"','name="&xxe;"'),/DTD\/entity/);
});
await check('X2','defended','entity expansion ("billion laughs") is refused before parsing, in well under a second',()=>{
 const ents=['<!ENTITY a0 "lol">',...Array.from({length:9},(_,i)=>`<!ENTITY a${i+1} "${`&a${i};`.repeat(10)}">`)].join('');
 const t=performance.now();rejects(xml.replace('<X3D ',`<!DOCTYPE X3D [${ents}]>\n<X3D `).replace('</Scene>','<WorldInfo title="&a9;"/></Scene>'),/DTD\/entity/);
 const ms=performance.now()-t;assert.ok(ms<250,`took ${ms} ms`);return {ms};
});
await check('X3','defended','DTD detection is case-insensitive (<!doctype, <!Entity)',()=>{
 rejects(xml.replace('<X3D ','<!doctype X3D>\n<X3D '),/DTD\/entity/);rejects(xml.replace('<Scene>','<Scene><!Entity x "y">'),/DTD\/entity/);
});
await check('X4','defended','oversized scene text (>200 000 characters) is refused before parsing',()=>{
 rejects(xml.replace('</Scene>',`<!--${' '.repeat(200_001)}--></Scene>`),/200 KB/);
});
await check('X5','defended','executable and external-content nodes are refused (Script, Inline, ExternProtoDeclare, ProtoInstance, Anchor, ImageTexture)',()=>{
 const nodes=['<Script DEF="S"><![CDATA[ecmascript: function initialize(){}]]></Script>','<Inline url=\'"evil.x3d"\'/>','<ExternProtoDeclare name="P" url=\'"p.x3d"\'/>','<ProtoInstance name="P"/>','<Anchor/>','<Shape><Appearance><ImageTexture/></Appearance><Box/></Shape>'];
 for(const n of nodes)rejects(xml.replace('</Scene>',`${n}</Scene>`),/Unsupported node/);return {nodes:nodes.length};
});
await check('X6','defended','giant meshes are outside the profile: no mesh geometry nodes are accepted',()=>{
 const pts=Array.from({length:3000},(_,i)=>`${i} ${i} ${i}`).join(' ');
 for(const n of [`<IndexedFaceSet coordIndex="0 1 2 -1"><Coordinate point="${pts}"/></IndexedFaceSet>`,'<TriangleSet/>','<ElevationGrid xDimension="2" zDimension="2"/>'])
  rejects(xml.replace('<Box size="3 .02 3"/>',n),/Unsupported node/);
});
await check('X7','defended','event-handler and url attributes are refused on allowed nodes',()=>{
 rejects(xml.replace('<Box size="3 .02 3"/>','<Box size="3 .02 3" onclick="alert(1)"/>'),/Executable/);
 rejects(xml.replace('<Sphere DEF="ObstacleGeometry"','<Sphere url="https://example.invalid" DEF="ObstacleGeometry"'),/Executable/);
});
await check('X8','defended','non-finite and out-of-range physical values are refused (NaN, Infinity, 1e308, negative mass)',()=>{
 for(const v of ['NaN','Infinity','1e308','-0.5','0.65 0.65'])rejects(xml.replace(/name="upperMass_kg" value="[^"]*"/,`name="upperMass_kg" value="${v}"`));
});
await check('X9','defended','prototype pollution through the embedded manifest JSON has no effect',()=>{
 const m=JSON.stringify({...manifest(DEFAULT_RECIPE,DEFAULT_TARGET)}).replace('{"protocol"','{"__proto__":{"polluted":true},"protocol"');
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const bad=xml.replace(/(<MetadataString DEF="BridgeManifest"[^>]*value=")[^"]*"/,`[cost withheld]${esc(JSON.stringify(m))}"`);
 const r=readScene(bad);assert.equal(({}).polluted,undefined);assert.equal(r.recipe.polluted,undefined);assert.deepEqual(Object.keys(r.recipe).sort(),['lowerLength','lowerMass','obstacle','profile','upperLength','upperMass']);
});
await check('X10','gap','URL-bearing fields not literally named "url" (Background backUrl …) pass the filter, but are dropped: import returns only the recipe and target and the scene is regenerated canonically',()=>{
 const r=readScene(xml.replace('<Background ','<Background backUrl=\'"https://example.invalid/track.png"\' '));
 assert.ok(!JSON.stringify(r).includes('example.invalid'));return {accepted:true,urlInOutput:false};
});
await check('X11','gap','deeply nested allowed nodes (5 000 Transforms within the size limit) parse; bounded only by the 200 KB cap',()=>{
 const depth=5000,t=performance.now();const r=readScene(xml.replace('</Scene>',`${'<Transform>'.repeat(depth)}${'</Transform>'.repeat(depth)}</Scene>`));
 const ms=performance.now()-t;assert.ok(r.recipe);assert.ok(ms<5000);return {depth,ms:+ms.toFixed(1)};
});

// ---------- Experiment ZIP ----------
await check('Z1','defended','packages over 2 MB are refused before unzipping',async()=>{
 await assert.rejects(()=>importBundle(new ArrayBuffer(2_000_001)),/2 MB/);
});
await check('Z2','defended','honest ZIP bomb: a member declaring >5 MB uncompressed is refused before inflating',async()=>{
 const u8=await pkg(z=>z.file('records/zeros.bin',new Uint8Array(6_000_000)));assert.ok(u8.length<2_000_000);
 await assert.rejects(()=>importBundle(ab(u8)),/bounded prototype import profile/);return {compressedBytes:u8.length,declared:6_000_000};
});
await check('Z3','defended','many members whose declared sizes total >12 MB are refused before inflating',async()=>{
 const u8=await pkg(z=>{for(let i=0;i<3;i++)z.file(`records/part${i}.bin`,new Uint8Array(4_500_000));});
 await assert.rejects(()=>importBundle(ab(u8)),/bounded prototype import profile/);return {compressedBytes:u8.length};
});
await check('Z4','defended','path-traversal member names are never written: import is in-memory and reads three fixed members only',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bridge-zip-')),cwd=process.cwd();process.chdir(dir);
 try{
  const u8=await pkg(z=>{z.file('../../evil.sh','#!/bin/sh\necho owned');z.file('/abs/evil.txt','x');z.file('x3d/../../../evil2.txt','x');});
  const r=await importBundle(ab(u8));assert.deepEqual(r.recipe,DEFAULT_RECIPE);assert.deepEqual(await readdir(dir),[]);
  return {imported:true,filesWritten:0};
 }finally{process.chdir(cwd);}
});
await check('Z5','defended','MJCF <include>, plugins and extra assets in the package are refused: mjcf/model.xml must equal the MJCF regenerated from the recipe',async()=>{
 const base=compileRecipe(DEFAULT_RECIPE);
 const variants={include:base.replace('<worldbody>','<include file="/etc/passwd"/><worldbody>'),plugin:base.replace('<worldbody>','<extension><plugin plugin="mujoco.elasticity.cable"/></extension><worldbody>'),mesh:base.replace('<worldbody>','<asset><mesh name="m" file="huge.stl"/></asset><worldbody>')};
 for(const [k,v] of Object.entries(variants)){assert.notEqual(v,base,k);const u8=await pkg(z=>z.file('mjcf/model.xml',v));await assert.rejects(()=>importBundle(ab(u8)),/inconsistent/,k);}
 return {variants:Object.keys(variants)};
});
await check('Z6','defended','manifest and scene that disagree are refused (no silent preference for either)',async()=>{
 const m=manifest({...DEFAULT_RECIPE,upperMass:1.5},DEFAULT_TARGET);const u8=await pkg(z=>z.file('manifest.json',JSON.stringify(m)));
 await assert.rejects(()=>importBundle(ab(u8)),/disagree/);
});
await check('Z7','defended','the scene inside a package goes through the same X3D filter (Script refused)',async()=>{
 const u8=await pkg(z=>z.file('x3d/scene.x3d',xml.replace('</Scene>','<Script/></Scene>')));await assert.rejects(()=>importBundle(ab(u8)),/Unsupported node/);
});
await check('Z8','gap','lying ZIP: a member whose headers under-declare its size passes the pre-check and is fully inflated before JSZip notices the mismatch',async()=>{
 // 30 MB of JSON whitespace in manifest.json compresses to ~30 KB; headers patched to claim 100 bytes.
 const real=JSON.stringify(manifest(DEFAULT_RECIPE,DEFAULT_TARGET))+' '.repeat(30_000_000);
 const u8=lie(await pkg(z=>z.file('manifest.json',real)),'manifest.json',100);
 const before=process.memoryUsage().arrayBuffers+process.memoryUsage().heapUsed;let peak=before;
 const timer=setInterval(()=>{const m=process.memoryUsage();peak=Math.max(peak,m.arrayBuffers+m.heapUsed);},1);
 let outcome;try{await importBundle(ab(u8));outcome='accepted';}catch(e){outcome=`rejected: ${e.message}`;}finally{clearInterval(timer);}
 // Current behaviour: rejected only after decompression (JSZip compressedObject.js size check at end of stream).
 assert.match(outcome,/size mismatch/);
 return {compressedBytes:u8.length,declaredBytes:100,actualBytes:real.length,outcome,approxPeakExtraMB:+((peak-before)/1e6).toFixed(1),worstCaseNote:'deflate tops out near 1032:1, so a 2 MB package can inflate to roughly 2 GB before rejection'};
});

await mkdir('validation',{recursive:true});
const passed=report.checks.filter(c=>c.status==='pass').length,failed=report.checks.length-passed;
await writeFile('validation/importer-threat-results.json',JSON.stringify({...report,passed,failed},null,2));
console.log(JSON.stringify({passed,failed,defended:report.checks.filter(c=>c.kind==='defended').length,gaps:report.checks.filter(c=>c.kind==='gap').length}));
if(failed)process.exit(1);
