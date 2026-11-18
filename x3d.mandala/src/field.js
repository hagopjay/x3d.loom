// Synthetic oscillators, not network measurements. Stable seed; circular
// coherence uses the complex order parameter rather than linear phase variance.
const TAU=2*Math.PI;
export const PALETTES=Object.freeze({
  saffron:{name:'Saffron / rose',primary:[.89,.29,.38],secondary:[.26,.61,.70],gold:[1,.76,.40]},
  lapis:{name:'Lapis / moon',primary:[.42,.37,.91],secondary:[.26,.76,.76],gold:[.86,.85,.67]},
  ember:{name:'Ember / copper',primary:[.96,.28,.15],secondary:[.73,.30,.49],gold:[1,.66,.28]},
  jade:{name:'Jade / pearl',primary:[.24,.72,.56],secondary:[.39,.55,.80],gold:[.91,.85,.61]}
});
export function coherence(phases){if(!phases.length)return 0;const n=phases.length;return Math.hypot(phases.reduce((s,a)=>s+Math.cos(a)/n,0),phases.reduce((s,a)=>s+Math.sin(a)/n,0));}
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export function sampleField(time,beat,{coupling=.72,pulseBeat=-100,depth=.65,palette='saffron'}={}){
  const lock=clamp(coupling),phases=[];
  for(let i=0;i<64;i++){
    const seed=(Math.sin(i*127.1+17.7)*43758.5453)%1;
    phases.push(beat*Math.PI/4+(1-lock)*(i*2.39996323+Math.sin(beat*.13+seed*TAU)*.6));
  }
  const order=coherence(phases),fraction=beat-Math.floor(beat);
  const pulse=Math.pow(.5+.5*Math.cos(fraction*TAU),8);
  const extra=Math.exp(-Math.max(0,beat-pulseBeat)*2.6)*(beat>=pulseBeat?1:0);
  const breath=.5-.5*Math.cos(beat*Math.PI/2);
  const cycle=.5+.5*Math.sin(beat*Math.PI/32);
  const base=PALETTES[palette]??PALETTES.saffron;
  const tint=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
  return {time,beat,pulse:clamp((pulse*.74+extra*.6)*clamp(depth)),breath,coherence:order,
    energy:clamp(.36+.26*breath+.12*order+.10*extra),peers:64,
    primary:tint(base.primary,base.secondary,cycle*.15),secondary:tint(base.secondary,base.primary,(1-cycle)*.13),gold:base.gold};
}
