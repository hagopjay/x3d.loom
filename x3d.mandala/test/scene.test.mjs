import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScene,applySceneState,lotusPaths,SCENE_BINDINGS} from '../src/scene.js';
const fixture={construction:'Test <construction> & source',triangles:Array.from({length:9},(_,i)=>({id:'t'+i,vertices:[[0,i%2?-.9:.9],[-.7,.05*i-.5],[.7,.05*i-.5]]})),faces:[]};

test('native scene is finite, deterministic, geometry-only and explicitly shares the canonical yantra',()=>{
  const a=buildScene(fixture),b=buildScene(fixture);assert.equal(a.xml,b.xml);
  assert.equal(a.stats.triangles,9);assert.equal(a.stats.suppliedChambers,0);assert.deepEqual(a.stats.lotusPetals,[8,16]);
  assert.ok(a.xml.includes('DEF="YantraCoordinates"'));assert.ok(a.xml.includes('USE="YantraCoordinates"'));
  assert.ok(a.xml.includes('USE="YantraGlowMesh"'));assert.ok(!/NaN|Infinity|<Script|<Inline|<ImageTexture|<ComposedShader|<PixelTexture/.test(a.xml));
  const defs=[...a.xml.matchAll(/DEF="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(defs).size,defs.length);
  assert.ok(a.xml.includes('&lt;construction&gt; &amp; source'));
  for(const name of [...SCENE_BINDINGS.materials,...SCENE_BINDINGS.petalGroups,...SCENE_BINDINGS.rings])assert.ok(defs.includes(name),name);
});
test('lotus tessellation closes its authored paths and quality changes decoration only',()=>{
  const p=lotusPaths(8,2,3,20);assert.equal(p.length,8);
  for(const path of p){assert.deepEqual(path[0],path.at(-1));assert.ok(path.every(v=>v.every(Number.isFinite)));}
  const high=buildScene(fixture,{quality:'high'}),medium=buildScene(fixture,{quality:'balanced'});
  assert.ok(high.stats.dustPoints>medium.stats.dustPoints);assert.ok(high.stats.bytes>medium.stats.bytes);
  const coords=s=>s.match(/<Coordinate DEF="YantraCoordinates" point="([^"]+)"/)[1];assert.equal(coords(high.xml),coords(medium.xml));
  assert.ok(Math.abs(high.stats.circleRelativeChordError-(1-Math.cos(Math.PI/320)))<1e-15);
});
test('bad canonical geometry is refused instead of silently drawing a different figure',()=>{
  assert.throws(()=>buildScene({triangles:[]}),/NINE_TRIANGLES/);
  const broken=structuredClone(fixture);broken.triangles[0].vertices[1][0]=NaN;assert.throws(()=>buildScene(broken),/NONFINITE/);
});
test('animation uses uniform similarity transforms and never writes canonical coordinate data',()=>{
  const nodes=new Map(),scene={getNamedNode(name){if(name==='YantraCoordinates')throw Error('Canonical coordinate mutation attempted');if(!nodes.has(name))nodes.set(name,{});return nodes.get(name);}};
  class Field{constructor(...v){this.value=v;}}
  const X3D={SFVec3f:Field,SFRotation:Field,SFColor:Field};
  for(let i=0;i<100;i++)applySceneState(scene,X3D,{time:i/10,beat:i*.9/10,pulse:i%2,motion:1});
  const scale=nodes.get('YantraFront').scale.value;assert.equal(scale[0],scale[1]);assert.equal(scale[1],scale[2]);
  applySceneState(scene,X3D,{layerMode:'underlay',motion:0});assert.equal(nodes.get('YantraFrontSwitch').whichChoice,-1);assert.equal(nodes.get('YantraBackSwitch').whichChoice,0);
  applySceneState(scene,X3D,{layerMode:'overlay',yantraFrontOpacity:2,yantraBackOpacity:-1});assert.equal(nodes.get('YantraFrontSwitch').whichChoice,0);assert.equal(nodes.get('YantraBackSwitch').whichChoice,-1);
  assert.ok([...nodes.values()].filter(n=>n.transparency!==undefined).every(n=>n.transparency>=0&&n.transparency<=1));
  applySceneState(scene,X3D,{layerMode:'both',yantraFrontOpacity:0});
  for(const name of ['YantraGold','YantraGlow','YantraAura','YantraFill','YantraFill1','YantraFill2','YantraFill3','YantraFill4'])assert.equal(nodes.get(name).transparency,1,name);
});

test('ring materials color only supplied active chamber faces',()=>{
  const data=structuredClone(fixture);data.faces=Array.from({length:5},(_,ring)=>({ring,vertices:[[0,.2],[-.1,0],[.1,0]]}));
  const scene=buildScene(data);assert.deepEqual(scene.stats.chamberRingCounts,[1,1,1,1,1]);assert.equal(scene.stats.suppliedChambers,5);
  for(let ring=0;ring<5;ring++)assert.ok(scene.xml.includes(`DEF="YantraFill${ring||''}"`));
  assert.ok(scene.stats.authoredPearls>0);assert.ok(scene.xml.includes('DEF="GuillocheGold"'));
});
