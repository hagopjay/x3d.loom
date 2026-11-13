import assert from 'node:assert/strict';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {Quaternion,Vector3,Euler} from 'three';
import JSZip from 'jszip';
import {BridgeSession} from '../src/bridge/session.ts';
import {DEFAULT_RECIPE,PROTOCOL,PROFILE,parseRecipe} from '../src/bridge/contract.ts';
import {mjToX3d,x3dToMj,rotationToX3d,forwardTarget,inverseTarget} from '../src/bridge/math.ts';
import {createScene,readScene} from '../src/bridge/scene.ts';
import {exportBundle,importBundle} from '../src/bridge/package.ts';
import {XiteAdapter} from '../src/bridge/xiteAdapter.ts';
const dom=new JSDOM();globalThis.DOMParser=dom.window.DOMParser;
const s=new BridgeSession();await s.init();
const report={generatedAt:new Date().toISOString(),engine:s.engine.version,scope:'Real MuJoCo WASM, XML and package round-trips, protocol semantics, coordinate mathematics; X_ITE adapter field calls tested with a deliberately substituted browser port, not a GPU.',checks:[]};
async function check(name,fn){try{const details=await fn();report.checks.push({name,status:'pass',details});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'fail',error:String(e.stack??e)});console.error('FAIL '+name+': '+e.message);}}
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} ≉ ${b}`);
const state=()=>JSON.stringify({model:s.engine.xml,time:s.engine.data.time,q:[...s.engine.data.qpos],v:[...s.engine.data.qvel],recipe:s.recipe,target:s.target,rev:s.modelRevision});
await check('real engine initializes curated model and stable body mappings',()=>{assert.equal(s.engine.version,'3.17.0');const f=s.snapshot();assert.equal(f.bodies.length,2);assert.equal(f.modelRevision,1);assert.equal(f.running,false);near(f.qpos[0],-.45);near(f.qpos[1],1.45);return {ids:f.bodies.map(b=>b.id)};});
await check('basis transform is invertible and preserves proper orientation',()=>{
 for(const p of [[1,2,3],[0,0,0],[-4,.2,7]])assert.deepEqual(x3dToMj(mjToX3d(p)),p);
 const C=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
 for(const e of [[.3,.8,-.4],[0,0,Math.PI],[-1.1,.2,.9]]){
  const q=new Quaternion().setFromEuler(new Euler(...e));const rot=rotationToX3d([q.w,q.x,q.y,q.z]);
  const actual=new Quaternion().setFromAxisAngle(new Vector3(...rot.slice(0,3)),rot[3]);const expected=C.clone().multiply(q).multiply(C.clone().invert());near(Math.abs(actual.dot(expected)),1);
 }assert.throws(()=>rotationToX3d([0,0,0,0]));return {basis:'(x,z,-y)',rotationsCompared:3};
});
await check('forward and inverse target agree on elbow-positive branch',()=>{for(const a of [[.35,.6],[-.2,1],[.5,.4]]){const p=forwardTarget([.55,.45],a),back=inverseTarget([.55,.45],p[0],p[1]);near(a[0],back[0]);near(a[1],back[1]);}assert.throws(()=>inverseTarget([.55,.45],9,9),/outside/);});
await check('target command reaches controller and real touch returns to snapshot',()=>{assert.ok(s.command('target.set',[.35,.6],'x3d').accepted);s.engine.simulate(5,s.engine.controller);const f=s.snapshot();assert.ok(f.touchN>0);assert.ok(f.contactPoint);assert.ok(Math.abs(f.qpos[0]-.35)<.25);return {touchN:f.touchN,contactPoint:f.contactPoint,ctrl:f.ctrl};});
await check('authored geometry and mass compile into the named MuJoCo model',()=>{const r=structuredClone(DEFAULT_RECIPE);r.upperLength=.62;r.lowerLength=.37;r.upperMass=1.1;r.lowerMass=.7;r.obstacle.position=[.75,.8,.34];const a=s.command('model.replace',r,'x3d');assert.ok(a.accepted,a.message);const e=s.engine,upper=e.objId(e.OBJ.mjOBJ_BODY.value,'upper'),lower=e.objId(e.OBJ.mjOBJ_BODY.value,'lower');near(e.model.body_pos[lower*3],.62);near(e.model.body_mass[upper],1.1);near(e.model.body_mass[lower],.77);assert.equal(e.data.time,0);assert.equal(e.running,false);return {revision:s.modelRevision,lowerParentOffset:e.model.body_pos[lower*3]};});
await check('invalid recipe and stale revision preserve physical state',()=>{const before=state();const r=structuredClone(s.recipe);r.upperMass=-1;assert.equal(s.command('model.replace',r).accepted,false);assert.equal(state(),before);const ack=s.dispatch({protocol:PROTOCOL,id:'stale',source:'test',expectedModelRevision:1,type:'target.set',payload:[0,0]});assert.equal(ack.accepted,false);assert.match(ack.message,/Stale/);assert.equal(state(),before);});
await check('duplicate commands are idempotent; identifier conflicts are rejected',()=>{const c={protocol:PROTOCOL,id:'one-step',source:'test',expectedModelRevision:s.modelRevision,type:'step',payload:null};const a=s.dispatch(c),t=s.engine.data.time;assert.equal(a.accepted,true);assert.deepEqual(s.dispatch(c),a);assert.equal(s.engine.data.time,t);assert.equal(s.dispatch({...c,payload:'different'}).accepted,false);return {time:t};});
await check('protocol rejects unknown type, malformed target and invalid transport',()=>{const before=state();for(const c of [{protocol:'unknown',id:'bad',source:'test',expectedModelRevision:s.modelRevision,type:'step',payload:null},{protocol:PROTOCOL,id:'bad2',source:'test',expectedModelRevision:s.modelRevision,type:'teleport',payload:null}])assert.equal(s.dispatch(c).accepted,false);assert.equal(s.command('target.set',[99,0]).accepted,false);assert.equal(s.command('transport.set','yes').accepted,false);assert.equal(state(),before);});
await check('standard X3D XML round-trips the declared physical profile',()=>{const xml=createScene(s.recipe,s.target,s.snapshot()),parsed=readScene(xml);assert.deepEqual(parsed.recipe,s.recipe);assert.deepEqual(parsed.target,s.target);const d=new DOMParser().parseFromString(xml,'application/xml');assert.equal(d.querySelector('parsererror'),null);assert.equal(d.querySelector('[DEF="BridgeContract"]').parentElement.tagName,'WorldInfo');assert.equal(d.querySelectorAll('ROUTE').length,2);return {profile:d.documentElement.getAttribute('profile'),nodes:d.querySelectorAll('*').length,warnings:parsed.warnings};});
await check('external X3D annotation and obstacle edits drive physical recompilation',()=>{let xml=createScene(s.recipe,s.target,s.snapshot());const d=new DOMParser().parseFromString(xml,'application/xml');d.querySelector('[DEF="UpperMass"]').setAttribute('value','1.3');d.querySelector('[DEF="ObstacleHandle"]').setAttribute('translation','.7 .72 0');const parsed=readScene(new dom.window.XMLSerializer().serializeToString(d));assert.equal(parsed.recipe.upperMass,1.3);assert.deepEqual(parsed.recipe.obstacle.position,[.7,.72,.34]);assert.ok(s.command('model.replace',parsed.recipe,'file').accepted);return {recipe:s.recipe};});
await check('importer rejects scripts, URLs, DTDs, duplicate IDs and wrong profiles',()=>{const xml=createScene(s.recipe,s.target);for(const bad of [xml.replace('</Scene>','<Script url="javascript:alert(1)"/></Scene>'),xml.replace('<Sphere DEF="ObstacleGeometry"','<Sphere url="https://example.invalid" DEF="ObstacleGeometry"'),xml.replace('<?xml version="1.0" encoding="UTF-8"?>','<!DOCTYPE X3D []>'),xml.replace('DEF="TopView"','DEF="HomeView"'),xml.replace('name="upperMass_kg" value="1.3"','name="upperMass_kg" value="-2"')])assert.throws(()=>readScene(bad));assert.throws(()=>parseRecipe({...s.recipe,profile:'anything'}));});
await check('experiment package is internally consistent and round-trips',async()=>{const bytes=await exportBundle(s.recipe,s.target,s.snapshot(),s.history,null),p=await importBundle(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));assert.deepEqual(p.recipe,s.recipe);const z=await JSZip.loadAsync(bytes);assert.ok(z.file('records/observation.json'));return {bytes:bytes.length,members:Object.keys(z.files)};});
await check('tampered package MJCF is rejected rather than silently substituted',async()=>{const bytes=await exportBundle(s.recipe,s.target,s.snapshot(),[],null),z=await JSZip.loadAsync(bytes);z.file('mjcf/model.xml','<mujoco/>');const edited=await z.generateAsync({type:'uint8array'});await assert.rejects(()=>importBundle(edited.buffer),/inconsistent/);});
// A narrow fake vendor port exercises field names, direction, authority, drag callbacks and cleanup.
class NodePort{callbacks=new Map();addFieldCallback(key,name,cb){this.callbacks.set(key,{name,cb});}removeFieldCallback(key){this.callbacks.delete(key);}fire(name,v){for(const c of this.callbacks.values())if(c.name===name)c.cb(v);}}
class Vec{constructor(x,y,z){Object.assign(this,{x,y,z});}}class Rot{constructor(x,y,z,a){Object.assign(this,{x,y,z,a});}}class Color{constructor(r,g,b){Object.assign(this,{r,g,b});}}class MF extends Array{constructor(...values){super();this.push(...values);}}
const api={SFVec3f:Vec,SFRotation:Rot,SFColor:Color,MFDouble:MF};let nodes=new Map(),adapter;
await check('X_ITE adapter writes named transforms and physical sensor metadata',async()=>{
 nodes=new Map();const scene={getNamedNode(name){if(!nodes.has(name))nodes.set(name,new NodePort());return nodes.get(name);}},browser={version:'substituted-port',async createX3DFromString(){return scene;},async replaceWorld(){}};
 adapter=new XiteAdapter(api,browser,()=>s.recipe,(t,p,source)=>s.command(t,p,source),()=>{},()=>{});await adapter.load(createScene(s.recipe,s.target,s.snapshot()));const f=s.snapshot();adapter.sync(f);const p=mjToX3d(f.bodies[0].position);assert.deepEqual([nodes.get('BodyUpper').translation.x,nodes.get('BodyUpper').translation.y,nodes.get('BodyUpper').translation.z],p);assert.equal(nodes.get('ContactForce').value[0],f.touchN);return {fieldNamesVerified:true,actualWebGL:false};
});
await check('X3D drag callback submits a controller target to the actual engine',()=>{const drag=nodes.get('TargetDrag'),p=forwardTarget([s.recipe.upperLength,s.recipe.lowerLength],[.25,.7]);drag.fire('isActive',true);drag.fire('translation_changed',new Vec(p[0],p[1],0));drag.fire('isActive',false);near(s.target[0],.25);near(s.target[1],.7);assert.deepEqual(s.engine.controlRecord.target,s.target);});
await check('high-precision target metadata survives X3D and package round-trip',async()=>{
 assert.ok(s.command('target.set',[.2345678912345,.8765432198765],'test').accepted);
 const xml=createScene(s.recipe,s.target,s.snapshot());assert.deepEqual(readScene(xml).target,s.target);
 const bytes=await exportBundle(s.recipe,s.target,s.snapshot(),[],null);const parsed=await importBundle(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));assert.deepEqual(parsed.target,s.target);
});
await check('obstacle drag stages then commits an authored physical edit',()=>{const drag=nodes.get('ObstacleDrag'),before=s.modelRevision;drag.fire('isActive',true);drag.fire('translation_changed',new Vec(.66,.77,0));assert.equal(s.modelRevision,before);drag.fire('isActive',false);assert.equal(s.modelRevision,before+1);assert.deepEqual(s.recipe.obstacle.position,[.66,.77,.34]);assert.equal(s.engine.running,false);});
await check('adapter disposal removes all field callbacks',()=>{adapter.dispose();assert.ok([...nodes.values()].every(n=>n.callbacks.size===0));});
await check('emitted node fields exist in the official X3D 4.0 UOM',async()=>{
 const uom=new DOMParser().parseFromString(await readFile('docs/X3DUOM-4.0.xml','utf8'),'application/xml');const xml=new DOMParser().parseFromString(createScene(s.recipe,s.target,s.snapshot()),'application/xml');let checked=0;
 for(const n of xml.querySelectorAll('Scene *')){
  if(n.tagName==='ROUTE')continue;
  const def=uom.querySelector(`ConcreteNode[name="${n.tagName}"] > InterfaceDefinition`);assert.ok(!!def,`unknown ${n.tagName}`);
  for(const a of n.attributes){if(['DEF','USE','containerField'].includes(a.name))continue;assert.ok(!![...def.querySelectorAll('field')].find(f=>f.getAttribute('name')===a.name),`${n.tagName}.${a.name}`);checked++;}
 }return {fieldsChecked:checked,uom:'Web3D X3DUOM 4.0, retrieved 2026-11-05',notClaimed:'Full ISO schema validation or native RigidBodyPhysics conformance'};
});
await mkdir('public/bridge',{recursive:true});

s.dispose();dom.window.close();report.summary={passed:report.checks.filter(c=>c.status==='pass').length,failed:report.checks.filter(c=>c.status==='fail').length};await writeFile('validation/bridge-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));process.exitCode=report.summary.failed?1:0;
