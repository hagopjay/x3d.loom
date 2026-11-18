// CHAMBER HARP 2.0: pure functions and scene contract. No browser required.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {YANTRA} from '../src/yantra-data.js';
import {spiralOrder,mirrorClasses,chamberVoices,locate,spiralLights,lastArrival,PENTATONIC} from '../src/chambers.js';
import {SparkPool} from '../src/sparks.js';
import {buildScene,SCENE_BINDINGS} from '../src/scene.js';
import {PulseTransport,ResonanceAudio,AUDIO_LIMITS} from '../src/audio.js';
const F=YANTRA.faces;
const independent=JSON.parse(fs.readFileSync(new URL('../data/independent-arrangement.json',import.meta.url),'utf8'));

test('spiral visits all 43 chambers once, outer ring first, bindu last',()=>{
  const o=spiralOrder(F);assert.equal(o.length,43);assert.equal(new Set(o).size,43);
  for(let k=1;k<o.length;k++)assert.ok(F[o[k-1]].ring>=F[o[k]].ring);
  assert.equal(F[o.at(-1)].id,'Chamber_01');assert.equal(F[o[0]].ring,4);
});
test('mirror chambers share a pitch and the scale rises toward the bindu',()=>{
  const {classes,classOf}=mirrorClasses(F);assert.equal(classes.length,26,'1+5+6+6+8 bilateral classes');
  for(const c of classes){assert.ok(c.members.length===1||c.members.length===2);
    if(c.members.length===2){const [a,b]=c.members.map(i=>F[i].centroid);assert.ok(Math.abs(a[0]+b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9);}
    else assert.ok(Math.abs(F[c.members[0]].centroid[0])<1e-9,'singleton classes sit on the axis');}
  const v=chamberVoices(F,{rootHz:110});
  for(let i=0;i<43;i++)assert.equal(v[i].hz,v[classOf.indexOf(classOf[i])].hz);
  const byRing=r=>v.filter(x=>x.ring===r).map(x=>x.hz);
  for(let r=0;r<4;r++)assert.ok(Math.min(...byRing(r))>=Math.max(...byRing(r+1)),'ring '+r+' sits at or above ring '+(r+1));
  assert.equal(v.find(x=>x.id==='Chamber_01').hz,110*2*PENTATONIC[0]*8,'bindu is three octaves over the outer root');
  for(const x of v){assert.ok(x.hz>=220&&x.hz<=1760);assert.ok(Math.abs(x.pan)<=.85);}
});
test('every independent interior sample lands in its own chamber; void centroids land in voids',()=>{
  assert.equal(independent.chambers.length,43);
  for(const c of independent.chambers){const w=locate(YANTRA,...c.interiorSample);assert.equal(w.kind,'chamber');
    const f=F[w.index];assert.equal(f.coverageDepth,c.coverage);assert.ok(f.vertices.every((p,i)=>Math.hypot(p[0]-c.coordinates[i][0],p[1]-c.coordinates[i][1])<1e-12)||c.coordinates.every(q=>f.vertices.some(p=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-12)));}
  for(const v of YANTRA.voids){const w=locate(YANTRA,...v.centroid);assert.equal(w.kind,'void');assert.equal(v.coverageDepth%2,0,'voids have even coverage');}
  for(const f of F)assert.equal(f.coverageDepth%2,1,'chambers have odd coverage');
  assert.deepEqual(locate(YANTRA,.99,.99),{kind:'outside'});
});
test('spiral light field is a bounded pure function of the beat',()=>{
  const o=spiralOrder(F);
  for(const beat of [0,.25,1,7.3,21.5,99.99]){const a=spiralLights(o,beat),b=spiralLights(o,beat);assert.deepEqual(a,b);for(const x of a)assert.ok(x>=0&&x<=1);}
  const at=spiralLights(o,10);assert.equal(at[o[20]],1,'the chamber struck on this half-beat is fully lit');
  assert.equal(lastArrival(o,5),-Infinity);assert.equal(lastArrival(o,21),21);assert.equal(lastArrival(o,30),21);assert.equal(lastArrival(o,43),42.5);
});
test('spark pool is deterministic, bounded and empties after its lifetime',()=>{
  const a=new SparkPool(60),b=new SparkPool(60);a.burst(0,0,80,1);b.burst(0,0,80,1);
  assert.deepEqual(a.sample(1.4),b.sample(1.4));assert.equal(a.live,60,'a burst larger than the pool recycles slots');
  for(const p of a.sample(1.6))assert.ok(p.every(Number.isFinite)&&Math.hypot(p[0],p[1])<3);
  a.sample(10);assert.equal(a.live,0);
});
test('2.0 scene adds 43 chamber lights, 9 triangle lights, one touch sensor and 60 sparks without touching the canonical points',()=>{
  const s=buildScene(YANTRA,{quality:'high'}),x=s.xml;
  for(const n of [...SCENE_BINDINGS.chamberLights,...SCENE_BINDINGS.triangleLights,...SCENE_BINDINGS.sparks,'ChamberTouch'])assert.ok(x.includes(`DEF="${n}"`),n);
  assert.equal((x.match(/<TouchSensor\b/g)||[]).length,2,'chamber plate and bindu');assert.equal(s.stats.chamberLights,43);
  const pts=x.match(/<Coordinate DEF="YantraCoordinates" point="([^"]+)"/)[1].split(' ').map(Number);
  const expected=YANTRA.triangles.flatMap(t=>[...t.vertices,t.vertices[0]].flatMap(v=>[v[0],v[1],0]));assert.deepEqual(pts,expected);
  assert.ok(!/<ParticleSystem|<ImageTexture|<Script/.test(x),'texture-free and script-free');
  assert.ok(x.includes('<component name="PointingDeviceSensor" level="1"/>'));
});
class P{constructor(){this.value=0;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}}
class N{constructor(c){this.c=c;for(const k of ['gain','frequency','detune','pan','delayTime','Q','threshold','knee','ratio','attack','release'])this[k]=new P();}connect(o){return o;}disconnect(){}start(){}stop(t){this.stopsAt=t;}}
class Ctx{constructor(){this.currentTime=0;this.state='suspended';this.destination=new N(this);this.made=0;}async resume(){this.state='running';}async close(){this.state='closed';}
  n(){this.made++;return new N(this);}createGain(){return this.n();}createOscillator(){return this.n();}createStereoPanner(){return this.n();}createBiquadFilter(){return this.n();}createDynamicsCompressor(){return this.n();}createDelay(){return this.n();}createConvolver(){return this.n();}
  createBuffer(ch,len){const d=Array.from({length:ch},()=>new Float32Array(len));return {getChannelData:i=>d[i]};}}
test('struck chambers ring only through the open gate and never exceed their voice ceiling',async()=>{
  let wall=0;const t=new PulseTransport({bpm:54,now:()=>wall}),s=new ResonanceAudio(t,{AudioContextClass:Ctx});
  assert.equal(s.strike(440),false,'silent before the listener opts in');
  await s.enable();s.tick();let ok=0;for(let i=0;i<30;i++)ok+=s.strike(330+i,{pan:2,strength:9})?1:0;
  assert.equal(ok,AUDIO_LIMITS.maxStrikeVoices);assert.equal(s.stats().strikeVoices,AUDIO_LIMITS.maxStrikeVoices);
  t.pause();s.tick();assert.equal(s.strike(440),false,'held transport is silent');
  t.resume();s.tick();s.voicing='chambers';s.spiral=spiralOrder(F);s.chamberVoices=chamberVoices(F,{rootHz:s.rootHz});
  s._pluck(0,s.context.currentTime,0);const last=[...s._voices].at(-1);assert.equal(last.oscillator.frequency.value,s.rootHz*2*s.chamberVoices[s.spiral[0]].ratio);
  await s.dispose();
});
