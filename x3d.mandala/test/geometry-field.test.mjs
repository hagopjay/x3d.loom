import test from 'node:test';import assert from 'node:assert/strict';
import {YANTRA,GEOMETRY_CERTIFICATE as C} from '../src/yantra-data.js';
import {auditTriangles,trianglesFromNativePoints} from '../src/geometry-audit.js';
import {coherence,sampleField} from '../src/field.js';
import {buildScene} from '../src/scene.js';
test('canonical and actual serialized X3D coordinates meet the explicit CPU tolerance',()=>{
  assert.equal(C.activeChambers,43);assert.deepEqual(C.activeRingCountsInnerToOuter,[1,8,10,10,14]);
  assert.ok(auditTriangles(YANTRA.triangles,1e-12).pass);
  const xml=buildScene(YANTRA).xml,values=xml.match(/<Coordinate DEF="YantraCoordinates" point="([^"]+)"/)[1].split(' ').map(Number);
  const points=Array.from({length:values.length/3},(_,i)=>values.slice(i*3,i*3+3));
  const extracted=trianglesFromNativePoints(points);assert.deepEqual(extracted,YANTRA.triangles.map(t=>t.vertices));assert.ok(auditTriangles(extracted,1e-12).pass);
  const native=extracted.map(t=>t.map(p=>p.map(Math.fround)));assert.ok(auditTriangles(native,1e-7).pass);
});
test('symmetric near-fake width perturbation fails concurrency even if it looks plausible',()=>{
  const changed=structuredClone(YANTRA.triangles);changed[0].vertices[1][0]+=.0001;changed[0].vertices[2][0]-=.0001;
  const audit=auditTriangles(changed,1e-12);assert.ok(!audit.pass);assert.ok(audit.concurrencyR>1e-6);assert.equal(audit.reflectionR,0);
});
test('circular coherence survives wrapping and global phase rotation',()=>{
  assert.ok(coherence([.01,2*Math.PI-.01])>.999);const phases=[.3,2,5.8,3.7];assert.ok(Math.abs(coherence(phases)-coherence(phases.map(x=>x+3)))<1e-14);
  assert.ok(coherence([0,Math.PI/2,Math.PI,3*Math.PI/2])<1e-14);
});
test('synthetic field is deterministic and modulates color without changing geometry',()=>{
  const before=JSON.stringify(YANTRA),a=sampleField(3,2.7,{coupling:.8}),b=sampleField(3,2.7,{coupling:.8});assert.deepEqual(a,b);
  for(let i=0;i<1000;i++){const s=sampleField(i/10,i*.09,{coupling:i%100/100});assert.ok(s.coherence>=0&&s.coherence<=1+1e-14);assert.ok(s.primary.every(Number.isFinite));}
  assert.equal(JSON.stringify(YANTRA),before);
});
