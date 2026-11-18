import test from 'node:test';
import assert from 'node:assert/strict';
import {PulseTransport,ResonanceAudio,AUDIO_LIMITS} from '../src/audio.js';
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} ~= ${b}`);

test('tempo changes preserve time and musical phase while changing future beat rate',()=>{
  let now=100;const t=new PulseTransport({bpm:60,now:()=>now});now+=2.25;
  near(t.time(),2.25);near(t.beat(),2.25);t.setTempo(90);near(t.beat(),2.25);
  now+=2;near(t.time(),4.25);near(t.beat(),5.25);
});
test('pause freezes time and beat; resume excludes the paused duration',()=>{
  let now=0;const t=new PulseTransport({bpm:54,now:()=>now});now=3;t.pause();
  const p=[t.time(),t.beat()];now=100;near(t.time(),p[0]);near(t.beat(),p[1]);
  t.resume();now=102;near(t.time(),5);near(t.beat(),4.5);assert.equal(t.state,'running');
});
test('switching from display clock to audio clock and back never jumps phase',()=>{
  let display=10,audio=0;const t=new PulseTransport({bpm:48,now:()=>display});display=14;
  const before=t.beat();t.bindClock(()=>audio,'audio');near(t.beat(),before);assert.equal(t.clock,'audio');
  audio=2;near(t.time(),6);near(t.beat(),4.8);display=50;t.usePerformanceClock();near(t.beat(),4.8);
  display=51;near(t.beat(),5.6);near(t.time(),7);
  t.pause();audio=17;t.bindClock(()=>audio,'audio');audio=18;near(t.time(),7);near(t.beat(),5.6);
});
test('transport reset and accepted control limits remain finite',()=>{
  let now=2;const t=new PulseTransport({bpm:54,now:()=>now});now=5;t.setTempo(1000);assert.equal(t.bpm,AUDIO_LIMITS.maxBpm);
  t.setTempo(-4);assert.equal(t.bpm,AUDIO_LIMITS.minBpm);assert.throws(()=>t.setTempo(NaN));t.reset();near(t.time(),0);near(t.beat(),0);
  assert.throws(()=>new PulseTransport({bpm:Infinity}));
});
test('sound construction is silent and does not instantiate AudioContext without a gesture',()=>{
  let constructed=0;class ForbiddenContext{constructor(){constructed++;throw Error('must not construct');}}
  const sound=new ResonanceAudio(new PulseTransport(),{AudioContextClass:ForbiddenContext});
  assert.equal(constructed,0);assert.equal(sound.stats().enabled,false);assert.equal(sound.stats().muted,true);
  sound.setVolume(2);assert.equal(sound.volume,1);sound.setRootHz(1000);assert.equal(sound.rootHz,440);
  sound.setRootHz(1);assert.equal(sound.rootHz,55);assert.throws(()=>sound.setVolume(NaN));
  sound.setTexture({energy:100,coherence:-1,pulse:NaN});assert.deepEqual(sound.texture,{energy:1,coherence:0,pulse:0});
  sound.tick();assert.equal(constructed,0);assert.equal(sound.stats().scheduledNotes,0);
});

// These graph/scheduler controls use explicit Web Audio-shaped adapters. They
// test event ownership and timing; they do not assert native sound or pixels.
class Param {
  constructor(){this.value=0;this.events=[];}
  setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);}
  setTargetAtTime(v,t,k){this.value=v;this.events.push(['target',v,t,k]);}
  exponentialRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t]);}
  cancelScheduledValues(t){this.events.push(['cancel',t]);}
}
class Node {
  constructor(context){this.context=context;for(const key of ['gain','frequency','detune','pan','delayTime','Q','threshold','knee','ratio','attack','release'])this[key]=new Param();}
  connect(other){return other;}
  disconnect(){this.disconnected=true;}
  start(t=0){this.startedAt=t;}
  stop(t=0){this.stopsAt=t;if(t<=this.context.currentTime)this.end();}
  end(){if(!this.ended){this.ended=true;this.onended?.();}}
}
class AudioAdapter {
  constructor(){this.currentTime=0;this.sampleRate=8000;this.state='suspended';this.destination=new Node(this);this.nodes=[];}
  async resume(){this.state='running';}
  async close(){this.state='closed';}
  node(){const node=new Node(this);this.nodes.push(node);return node;}
  createGain(){return this.node();}createOscillator(){return this.node();}createStereoPanner(){return this.node();}
  createBiquadFilter(){return this.node();}createDynamicsCompressor(){return this.node();}createDelay(){return this.node();}createConvolver(){return this.node();}
  createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:i=>data[i]};}
  advance(seconds){this.currentTime+=seconds;for(const node of this.nodes)if(node.stopsAt<=this.currentTime)node.end();}
}

test('audio scheduling rebases phase, skips late notes, and clears pause/mute boundaries',async()=>{
  let wall=10;const t=new PulseTransport({bpm:54,now:()=>wall});wall=12;
  const sound=new ResonanceAudio(t,{AudioContextClass:AudioAdapter}),before=t.beat();
  await sound.enable();near(t.beat(),before);assert.equal(t.clock,'audio');assert.equal(sound.stats().contextState,'running');
  const c=sound.context;c.advance(.15);sound.tick();assert.equal(sound.stats().scheduledNotes,1);
  sound.tick();assert.equal(sound.stats().scheduledNotes,1,'same subdivision cannot be scheduled twice');
  c.advance(20);const prior=sound.stats().scheduledNotes;sound.tick();
  assert.ok(sound.stats().scheduledNotes-prior<=1,'a delayed scheduler never dumps overdue events');
  assert.ok(sound.stats().skippedSubdivisions>20);assert.ok(sound.stats().activeVoices<=AUDIO_LIMITS.maxPluckVoices);
  const phase=t.beat();sound.setMuted(true);near(t.beat(),phase);assert.equal(t.clock,'performance');
  wall+=1;near(t.beat(),phase+.9);const resumed=t.beat();sound.setMuted(false);near(t.beat(),resumed);assert.equal(t.clock,'audio');
  t.pause();sound.tick();assert.equal(sound.master.gain.value,0);const paused=t.beat();c.advance(5);near(t.beat(),paused);
  t.resume();sound.setVolume(1);sound.tick();assert.equal(sound.master.gain.value,AUDIO_LIMITS.maxMasterGain);
  await sound.dispose();assert.equal(c.state,'closed');assert.equal(sound.stats().disposed,true);assert.equal(sound._timer,null);
});
