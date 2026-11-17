// One phase-continuous musical transport drives both the X3D field updates and
// scheduled Web Audio events. Audio is created only after an explicit gesture.
// The frequency ratios below are musical choices, not therapeutic claims.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const finite=(x,label)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new TypeError(label+' must be finite.');return x;};
const wallNow=()=>performance.now()/1000;
export const AUDIO_LIMITS=Object.freeze({minBpm:24,maxBpm:100,minRootHz:55,maxRootHz:440,maxMasterGain:.22,maxPluckVoices:12,lookaheadSeconds:.12});

export class PulseTransport {
  constructor({bpm=54,now=wallNow,paused=false}={}){
    this._fallbackNow=now;this._now=now;this._clock='performance';
    this._bpm=clamp(finite(bpm,'Tempo'),AUDIO_LIMITS.minBpm,AUDIO_LIMITS.maxBpm);
    this._seconds=0;this._beats=0;this._at=now();this._state=paused?'paused':'running';
  }
  _position(){const delta=this._state==='running'?Math.max(0,this._now()-this._at):0;return {time:this._seconds+delta,beat:this._beats+delta*this._bpm/60};}
  _anchor(){const p=this._position();this._seconds=p.time;this._beats=p.beat;this._at=this._now();return p;}
  time(){return this._position().time;}
  beat(){return this._position().beat;}
  get bpm(){return this._bpm;}
  get state(){return this._state;}
  get clock(){return this._clock;}
  setTempo(value){this._anchor();this._bpm=clamp(finite(value,'Tempo'),AUDIO_LIMITS.minBpm,AUDIO_LIMITS.maxBpm);return this._bpm;}
  pause(){if(this._state!=='paused'){this._anchor();this._state='paused';}return this;}
  resume(){if(this._state!=='running'){this._at=this._now();this._state='running';}return this;}
  reset(){this._seconds=0;this._beats=0;this._at=this._now();return this;}
  bindClock(now,label='external'){
    if(typeof now!=='function')throw new TypeError('A clock function is required.');
    const p=this._position(),at=finite(now(),'Clock');
    this._seconds=p.time;this._beats=p.beat;this._now=now;this._at=at;this._clock=label;return this;
  }
  usePerformanceClock(){return this.bindClock(this._fallbackNow,'performance');}
}

export class ResonanceAudio {
  constructor(transport,{AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
    if(!(transport instanceof PulseTransport))throw new TypeError('A PulseTransport is required.');
    this.transport=transport;this.AudioContextClass=AudioContextClass;
    this.context=null;this.muted=true;this.volume=.48;this.rootHz=110;this.disposed=false;
    this.texture={energy:.5,coherence:.7,pulse:0};this._voices=new Set();this._pads=[];
    this._timer=null;this._nextStep=null;this._lastTempo=transport.bpm;this._lastBeat=transport.beat();
    this._gate=false;this._scheduled=0;this._skipped=0;this._lastScheduledBeat=null;
  }
  async enable(){
    if(this.disposed)throw new Error('This sound instrument has been disposed.');
    if(!this.context){
      if(!this.AudioContextClass)throw new Error('Web Audio is unavailable in this browser.');
      this.context=new this.AudioContextClass({latencyHint:'interactive'});this._buildGraph();
    }
    await this.context.resume();
    this._clearFuture();this.muted=false;this.transport.bindClock(()=>this.context.currentTime,'audio');
    this._nextStep=null;this._lastBeat=this.transport.beat();this._lastTempo=this.transport.bpm;
    if(!this._timer){this._timer=setInterval(()=>this.tick(),25);this._timer.unref?.();}
    this.tick();return this;
  }
  _buildGraph(){
    const c=this.context;
    this.input=c.createGain();this.input.gain.value=.8;
    this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.Q.value=.45;
    this.filter.frequency.value=1300;this.input.connect(this.filter);
    this.master=c.createGain();this.master.gain.value=0;
    this.compressor=c.createDynamicsCompressor();
    this.compressor.threshold.value=-15;this.compressor.knee.value=18;this.compressor.ratio.value=4;
    this.compressor.attack.value=.012;this.compressor.release.value=.22;
    this.master.connect(this.compressor).connect(c.destination);
    this.dry=c.createGain();this.dry.gain.value=.76;this.filter.connect(this.dry).connect(this.master);
    this.delays=[];
    for(const [pan,division,feedback] of [[-.62,.75,.22],[.62,1.125,.18]]){
      const delay=c.createDelay(3),gain=c.createGain(),wet=c.createGain(),panner=c.createStereoPanner();
      delay.delayTime.value=60/this.transport.bpm*division;gain.gain.value=feedback;wet.gain.value=.17;panner.pan.value=pan;
      this.filter.connect(delay);delay.connect(gain).connect(delay);delay.connect(wet).connect(panner).connect(this.master);
      this.delays.push({delay,gain,wet,panner,division});
    }
    this.reverb=c.createConvolver();this.reverb.buffer=this._impulse(2.6);
    this.reverbWet=c.createGain();this.reverbWet.gain.value=.15;
    this.filter.connect(this.reverb).connect(this.reverbWet).connect(this.master);
    for(const [i,ratio] of [.5,1,1.5,2].entries()){
      const oscillator=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner();
      oscillator.type='sine';oscillator.frequency.value=this.rootHz*ratio;
      oscillator.detune.value=[-1.6,0,1.4,-.8][i];gain.gain.value=[.13,.11,.075,.045][i];pan.pan.value=[-.3,.25,-.5,.48][i];
      oscillator.connect(gain).connect(pan).connect(this.input);oscillator.start();this._pads.push({oscillator,gain,pan,ratio});
    }
  }
  _impulse(seconds){
    const c=this.context,frames=Math.floor(c.sampleRate*seconds),buffer=c.createBuffer(2,frames,c.sampleRate);
    let seed=0x5a17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let channel=0;channel<2;channel++){
      const data=buffer.getChannelData(channel);let smooth=0;
      for(let i=0;i<frames;i++){smooth=.72*smooth+(random()*2-1)*.28;data[i]=smooth*Math.pow(1-i/frames,2.8);}
    }
    return buffer;
  }
  setMuted(value){
    const muted=!!value;
    if(!this.context){this.muted=true;return this.muted;}
    if(muted!==this.muted){
      this.muted=muted;
      if(muted)this.transport.usePerformanceClock();else this.transport.bindClock(()=>this.context.currentTime,'audio');
      this._clearFuture();this._nextStep=null;this._lastBeat=this.transport.beat();
    }
    this.tick();return this.muted;
  }
  setVolume(value){this.volume=clamp(finite(value,'Volume'),0,1);this._applyGate();return this.volume;}
  setRootHz(value){
    this.rootHz=clamp(finite(value,'Fundamental frequency'),AUDIO_LIMITS.minRootHz,AUDIO_LIMITS.maxRootHz);
    if(this.context)for(const p of this._pads)p.oscillator.frequency.setTargetAtTime(this.rootHz*p.ratio,this.context.currentTime,.22);
    return this.rootHz;
  }
  setTexture(values={}){
    for(const key of ['energy','coherence','pulse'])if(Number.isFinite(values[key]))this.texture[key]=clamp(values[key],0,1);
  }
  _clearFuture(){
    if(!this.context)return;
    const now=this.context.currentTime;
    for(const voice of this._voices)if(voice.when>now+.005){try{voice.oscillator.stop(now);}catch{}voice.cancelled=true;}
  }
  _applyGate(){
    if(!this.context||this.disposed)return;
    const gate=!this.muted&&this.transport.state==='running'&&this.context.state==='running';
    if(this._gate&&!gate){this._clearFuture();this._nextStep=null;}
    this._gate=gate;
    this.master.gain.setTargetAtTime(gate?this.volume*AUDIO_LIMITS.maxMasterGain:0,this.context.currentTime,.075);
  }
  _pluck(step,when,beat){
    if(this._voices.size>=AUDIO_LIMITS.maxPluckVoices){this._skipped++;return;}
    const c=this.context,ratios=[1,1.5,1.25,2,1.125,1.5,5/3,1.25],ratio=ratios[Math.floor(step/2)%ratios.length];
    const oscillator=c.createOscillator(),gain=c.createGain(),panner=c.createStereoPanner();
    oscillator.type=step%4===0?'triangle':'sine';oscillator.frequency.value=this.rootHz*ratio*(step%8===0?1:2);
    panner.pan.value=Math.sin(step*2.399963229728653)*.64;
    const strength=(step%4===0?.075:.043)*(.6+this.texture.energy*.4)*(1+this.texture.pulse*.18),duration=step%4===0?1.45:.9;
    gain.gain.setValueAtTime(.00001,when);gain.gain.exponentialRampToValueAtTime(strength,when+.024);
    gain.gain.exponentialRampToValueAtTime(.00001,when+duration);
    oscillator.connect(gain).connect(panner).connect(this.input);
    const voice={oscillator,gain,panner,when,beat,cancelled:false};this._voices.add(voice);
    oscillator.onended=()=>{this._voices.delete(voice);oscillator.disconnect();gain.disconnect();panner.disconnect();};
    oscillator.start(when);oscillator.stop(when+duration+.04);this._scheduled++;this._lastScheduledBeat=beat;
  }
  tick(){
    if(!this.context||this.disposed)return;
    this._applyGate();if(!this._gate)return;
    const beat=this.transport.beat(),bpm=this.transport.bpm,now=this.context.currentTime;
    const tempoChanged=bpm!==this._lastTempo,rewound=beat<this._lastBeat-.05;
    if(tempoChanged||rewound){this._clearFuture();this._nextStep=null;}
    if(this._nextStep===null)this._nextStep=Math.floor(beat*2+1e-8)+1;
    const firstFuture=Math.floor(beat*2+1e-8)+1;
    if(this._nextStep<firstFuture){this._skipped+=firstFuture-this._nextStep;this._nextStep=firstFuture;}
    const until=beat+AUDIO_LIMITS.lookaheadSeconds*bpm/60;let guard=0;
    while(this._nextStep*.5<=until&&guard++<4){
      const scheduledBeat=this._nextStep*.5;
      this._pluck(this._nextStep,now+(scheduledBeat-beat)*60/bpm,scheduledBeat);this._nextStep++;
    }
    const breath=.5-.5*Math.cos(beat*Math.PI/2),brightness=600+this.texture.energy*1300+breath*500+this.texture.pulse*300;
    this.filter.frequency.setTargetAtTime(brightness,now,.1);
    for(const [i,p] of this._pads.entries())p.gain.gain.setTargetAtTime([.13,.11,.075,.045][i]*(.72+breath*.28),now,.09);
    for(const d of this.delays)d.delay.delayTime.setTargetAtTime(Math.min(2.95,60/bpm*d.division),now,.22);
    this.reverbWet.gain.setTargetAtTime(.11+.1*this.texture.coherence,now,.2);
    this._lastTempo=bpm;this._lastBeat=beat;
  }
  stats(){return {enabled:!!this.context,muted:this.muted,contextState:this.context?.state??'not-created',transportState:this.transport.state,clock:this.transport.clock,
    bpm:this.transport.bpm,rootHz:this.rootHz,volume:this.volume,maxMasterGain:AUDIO_LIMITS.maxMasterGain,
    activeVoices:this._voices.size,scheduledNotes:this._scheduled,skippedSubdivisions:this._skipped,lastScheduledBeat:this._lastScheduledBeat,disposed:this.disposed};}
  async dispose(){
    if(this.disposed)return;this.disposed=true;
    if(this._timer){clearInterval(this._timer);this._timer=null;}
    this.transport.usePerformanceClock();
    if(this.context){
      const now=this.context.currentTime;this.master.gain.cancelScheduledValues(now);this.master.gain.setValueAtTime(0,now);
      for(const voice of this._voices){try{voice.oscillator.stop(now);}catch{}}
      for(const pad of this._pads){try{pad.oscillator.stop(now);}catch{}}
      await this.context.close();this._voices.clear();
    }
  }
}
