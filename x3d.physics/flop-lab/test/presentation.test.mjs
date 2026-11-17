// Presentation isolation and resource-bound controls with explicit DOM/audio stubs.
// These do not render pixels or substitute for a native browser observation.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
let strokes = 0, audioContexts = 0, oscillators = 0, checks = 0;
const context = new Proxy({measureText:s=>({width:String(s).length*7})}, {
  get(o,k) { return k in o ? o[k] : (..._args)=>{strokes++;}; },
  set(o,k,v) {o[k]=v;return true;}
});
const rect = ()=>({width:800,height:600,left:0,top:0});
const stage = {append(){},getBoundingClientRect:rect};
const makeCanvas = ()=>({style:{},parentElement:stage,clientWidth:800,clientHeight:600,width:0,height:0,
  getContext:()=>context,getBoundingClientRect:rect,setAttribute(){},remove(){}});
const query={matches:false,addEventListener(){},removeEventListener(){}};
const document={hidden:false,createElement:tag=>tag==='canvas'?makeCanvas():{style:{}},addEventListener(){},removeEventListener(){}};
class AudioStub {
  constructor(){audioContexts++;this.state='running';this.currentTime=0;this.destination={};}
  createGain(){const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};return {gain:param,connect(){return this;},disconnect(){}};}
  createOscillator(){oscillators++;return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){this.onended?.();}};}
  async resume(){this.state='running';}
  async close(){this.state='closed';}
}
const source=['core','level','game','view','celebration'].map(f=>fs.readFileSync(new URL('src/'+f+'.js',root),'utf8')).join('\n');
const M=vm.runInNewContext(source+'\n({View,StuntFeedback,Sim,defaultLevel,NOINPUT});',{
  document,window:{devicePixelRatio:2,matchMedia:()=>query,AudioContext:AudioStub},
  THREE:{WebGLRenderer:class {constructor(){throw new Error('intended no-WebGL control');}}}
});
const sim=new M.Sim(M.defaultLevel()), view=new M.View(makeCanvas()); view.load(sim.W);
for(let i=0;i<45;i++)sim.step(M.NOINPUT,1/60);
const before=JSON.stringify(sim.W.bodies), level=JSON.stringify(sim.level), hash=sim.W.hash();
for(const costume of ['pilot','party','noodle']){
  assert.equal(view.setCostume(costume),true);
  for(let i=0;i<40;i++)view.draw(sim,1/60);
}
assert.equal(JSON.stringify(sim.W.bodies),before);assert.equal(JSON.stringify(sim.level),level);assert.equal(sim.W.hash(),hash);
assert.ok(strokes>0);assert.equal(view.stats().renderer,'canvas2d'); checks++;
console.log('PASS all mascot outfits draw without changing physical/source state (Canvas stubs)');
assert.equal(view.setCostume('invalid'),false);assert.equal(view.costume,'noodle');
view.reducedMotion=true;assert.equal(view.expression(sim).blink,false);
view.reviewing=true;sim.stunt={bonkCd:.12};sim.mode='limp';assert.equal(view.expression(sim).bonk,false);checks++;
console.log('PASS refused costume and reduced-motion/review expression boundaries');
const feedback=new M.StuntFeedback({stage});
feedback.emit([{seq:1,type:'puff',title:'Puff'}]);const once=feedback.status();
feedback.emit([{seq:1,type:'puff',title:'Puff'}]);assert.equal(feedback.status().particles,once.particles);
assert.equal(feedback.status().popups,once.popups);assert.equal(audioContexts,0);assert.equal(oscillators,0);checks++;
console.log('PASS duplicate event does not repeat celebration; sound remains opt-in');
for(let i=2;i<900;i++)feedback.emit([{seq:i,type:'bank',points:i}]);
assert.ok(feedback.status().particles<=200);assert.ok(feedback.status().popups<=2);assert.ok(feedback.seen.size<=512);checks++;
console.log('PASS long celebration stream retains bounded work');
feedback.setReducedMotion(true);feedback.emit([{seq:1000,type:'bank'}]);feedback.render(.016);
assert.equal(feedback.status().particles,0);assert.ok(feedback.status().popups>0);
feedback.setReducedMotion(false);query.matches=true;feedback.emit([{seq:1001,type:'bank'}]);assert.equal(feedback.status().particles,0);query.matches=false;checks++;
console.log('PASS explicit and OS reduced-motion preserve readable cards without confetti');
feedback.render(.016,{paused:true});assert.equal(feedback.status().popups,0);assert.equal(feedback.status().particles,0);
document.hidden=true;feedback.emit([{seq:1002,type:'bank'}]);assert.equal(feedback.status().popups,0);document.hidden=false;checks++;
console.log('PASS pause/background prevent stale celebration backlog');
await feedback.enableSound();assert.equal(audioContexts,1);assert.ok(oscillators>0);assert.equal(feedback.status().soundEnabled,true);
feedback.setVolume(999);assert.equal(feedback.status().volume,1);feedback.setVolume(-1);assert.equal(feedback.status().volume,0);
feedback.disableSound();const stopped=oscillators;feedback.emit([{seq:1003,type:'flip'}]);assert.equal(oscillators,stopped);checks++;
console.log('PASS explicit audio activation and mute/volume boundaries (audio stubs)');
feedback.dispose();feedback.emit([{seq:1004,type:'bank'}]);assert.equal(feedback.status().particles,0);assert.equal(feedback.status().popups,0);checks++;
console.log('PASS disposal prevents new feedback');
// A real sub-unit goal exposed a UI regression: max=1 left completed bars at 35/80%.
const app=fs.readFileSync(new URL('src/app.js',root),'utf8');
const take=(name,next)=>{const from=app.indexOf('function '+name+'(');let to=app.indexOf('\nfunction '+next+'(',from);if(to<0)to=app.indexOf('\nasync function '+next+'(',from);assert.ok(from>=0&&to>from,'actual app function boundaries');return app.slice(from,to);};
const nodes=new Map(), node=id=>{if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}},dataset:{}});return nodes.get(id);};
const ui=vm.createContext({$:node,view:{},stickerStamp:'',S:{scrub:-1,sim:{mode:'hero'},ghostOn:false,
  expedition:{summary:()=>({title:'First Flight',state:'complete',time:1,progress:.8,target:.8,unit:'s airborne',eligible:true})},
  show:{summary:()=>({prompt:{target:.35,progress:.35,complete:true,unit:'s airborne'},stickers:[]})}}});
vm.runInContext(take('updateExpedition','updateShowtime')+'\n'+take('updateShowtime','setShowSound'),ui);
ui.updateExpedition();assert.equal(node('missionProgress').max,.8);assert.equal(node('missionProgress').value,.8);checks++;
console.log('PASS actual mission DOM binding fills a completed 0.8-second bar');
ui.updateShowtime();assert.equal(node('showPromptProgress').max,.35);assert.equal(node('showPromptProgress').value,.35);
assert.match(node('showPromptValue').textContent,/0\.35 \/ 0\.35/);checks++;
console.log('PASS actual Showtime DOM binding fills and accurately labels a 0.35-second goal');
console.log(checks+' presentation controls pass. DOM, Canvas and audio adapters are stubs; native pixels/audio require separate observation.');
