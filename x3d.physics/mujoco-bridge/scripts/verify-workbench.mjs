import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {MuJoCoEngine} from '../src/mujoco/engine.ts';
import {PRESETS} from '../src/data/presets.ts';
import {attachControl,disturbCartpole,jointState,supportsFeedback} from '../src/mujoco/controllers.ts';
import {measureTrial,compatibleTrials,trialCsv} from '../src/mujoco/trials.ts';
import {observationPacket} from '../src/utils/experiment.ts';
const engine=new MuJoCoEngine();await engine.init();assert.equal(engine.status,'ready',engine.errorMsg);
const report={generatedAt:new Date().toISOString(),engine:engine.version,node:process.version,scope:'Real WASM tests of live controllers, cooperative measured trials, records and comparisons. Does not validate WebGL or browser interaction.',checks:[]};
async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'fail',error:String(e.stack??e)});console.error('FAIL '+name+': '+e.message);}}
const config={mode:'feedback',target:[0.35,0.6],manual:[]};
let armRun;
const load=(id)=>engine.loadXML(PRESETS.find(p=>p.id===id).xml);
const state=()=>JSON.stringify({time:engine.data.time,qpos:[...engine.data.qpos],qvel:[...engine.data.qvel],ctrl:[...engine.data.ctrl],xml:engine.xml});
await check('contact arm: named touch and bounded tracking over five seconds',async()=>{
 load('contact-arm');const before=state();armRun=await measureTrial(engine,config);
 assert.equal(state(),before);assert.equal(armRun.samples.length,2501);assert.equal(armRun.metrics.peakContacts,1);
 const touch=armRun.columns.findIndex(c=>c.id==='sens:tip_touch[0]');assert.ok(armRun.samples.at(-1).v[touch]>0);
 assert.ok(Math.abs(armRun.metrics.finalQpos[0]-.35)<.25);assert.ok(Math.abs(armRun.metrics.finalQpos[1]-.6)<.25);
 assert.ok(armRun.metrics.peakControlFraction<=1+1e-12);
 return {workspaceUnchanged:true,finalTouchN:armRun.samples.at(-1).v[touch],...armRun.metrics};
});
await check('repeatability: identical full trajectories from recorded reset',async()=>{
 const repeated=await measureTrial(engine,config);assert.ok(compatibleTrials(armRun,repeated));assert.deepEqual(repeated.samples,armRun.samples);assert.deepEqual(repeated.start,armRun.start);return {equalSamples:repeated.samples.length};
});
await check('unobstructed arm target tracks accurately',async()=>{
 const r=await measureTrial(engine,{...config,target:[-.2,1]});assert.ok(Math.abs(r.metrics.finalQpos[0]+.2)<.01);assert.ok(Math.abs(r.metrics.finalQpos[1]-1)<.01);return r.metrics;
});
await check('trial captures live options without changing original state',async()=>{
 engine.setOptNum('iterations',157);engine.setOptNum('timestep',.004);engine.data.qvel[0]=.12;engine.step(5);const before=state();
 const r=await measureTrial(engine,config);assert.equal(state(),before);assert.equal(r.options.iterations,157);assert.equal(r.timestep,.004);assert.equal(r.samples.length,1251);assert.equal(compatibleTrials(armRun,r),false);return {timestep:r.timestep,iterations:r.options.iterations,samples:r.samples.length};
});
await check('cartpole feedback recovers from positive and negative tilts',()=>{
 load('cartpole');let results=[];
 for(const tilt of [.08,-.08]){engine.reset();disturbCartpole(engine,tilt);attachControl(engine,config);let peak=0;engine.simulate(5,engine.controller,e=>{peak=Math.max(peak,Math.abs(jointState(e,'hinge')[0]));});const final=Math.abs(jointState(engine,'hinge')[0]);assert.ok(peak<.5);assert.ok(final<.001);results.push({tilt,peak,final});}return results;
});
await check('cartpole measured trial documents and applies disturbance',async()=>{
 const r=await measureTrial(engine,config);assert.equal(r.start.disturbance_rad,.08);assert.equal(r.start.qpos[1],.08);assert.ok(Math.abs(r.metrics.finalQpos[1])<.001);return r.metrics;
});
await check('manual control clamps commands to named actuator range',()=>{
 load('contact-arm');attachControl(engine,{...config,mode:'manual',manual:[100,-100]});assert.deepEqual([...engine.data.ctrl],[8,-5]);engine.step(3);assert.deepEqual([...engine.data.ctrl],[8,-5]);return {applied:[...engine.data.ctrl]};
});
await check('off mode clears previous actuator commands',()=>{
 attachControl(engine,{...config,mode:'off'});assert.deepEqual([...engine.data.ctrl],[0,0]);assert.equal(engine.controlRecord.mode,'off');return {ctrl:[...engine.data.ctrl]};
});
await check('cancellation cleans trial and preserves live state',async()=>{
 const c=new AbortController();const before=state();let progressed=false;
 await assert.rejects(()=>measureTrial(engine,config,c.signal,()=>{progressed=true;c.abort();}),/cancelled/);assert.ok(progressed);assert.equal(state(),before);engine.step();return {cancelledAfterYield:true,workspaceStillSteps:true};
});
await check('interactive trial step limit rejects oversized work',async()=>{
 engine.setOptNum('timestep',.0001);await assert.rejects(()=>measureTrial(engine,config),/25,000/);return {limitEnforced:true};
});
await check('ball passive trial records contact without feedback',async()=>{
 load('ball-drop');const r=await measureTrial(engine,{...config,mode:'off'});assert.ok(r.metrics.peakContacts>0);assert.ok(r.samples.every(s=>s.v.every(Number.isFinite)));return r.metrics;
});
await check('CSV and observation exports preserve source, controller and signal layout',()=>{
 load('contact-arm');attachControl(engine,config);engine.sampleTelemetry();const packet=observationPacket(engine,'verification note');assert.deepEqual(packet.controller,config);assert.equal(packet.model.compiled_source_xml,engine.xml);assert.equal(packet.experiment_note,'verification note');
 const csv=trialCsv(armRun);assert.equal(csv.split('\r\n').length,armRun.samples.length+1);assert.ok(csv.includes('"ctrl:shoulder_motor"'));return {csvRows:armRun.samples.length,columns:armRun.columns.length,observationSchema:packet.schema};
});
await check('modified models cannot attach an incompatible automatic controller',()=>{
 engine.loadXML(PRESETS.find(p=>p.id==='contact-arm').xml.replaceAll('name="shoulder"','name="renamed"').replaceAll('joint="shoulder"','joint="renamed"'));
 assert.equal(supportsFeedback(engine),false);assert.throws(()=>attachControl(engine,config),/Feedback requires/);
 attachControl(engine,{...config,mode:'off'});engine.step();return {offModeStillWorks:true};
});
await check('scheduler accounts for dropped catch-up time',()=>{
 load('cartpole');engine.running=true;engine.speed=1;engine.advance(1);assert.ok(Math.abs(engine.droppedSeconds-.95)<1e-10);assert.ok(Math.abs(engine.data.time-.05)<1e-10);engine.reset();assert.equal(engine.droppedSeconds,0);return {oneSecondGapDropped:.95,advanced:.05};
});
engine.dispose();report.summary={passed:report.checks.filter(c=>c.status==='pass').length,failed:report.checks.filter(c=>c.status==='fail').length};
await writeFile('validation/workbench-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary));process.exitCode=report.summary.failed?1:0;
