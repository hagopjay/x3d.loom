// Chamber harp: a playable reading of the 43 canonical chambers.
// Pure functions over YANTRA.faces. Nothing here writes geometry; it only
// orders chambers, names their pitches and answers point-in-chamber queries.
const EPS=1e-12;
export const PENTATONIC=Object.freeze([1,9/8,5/4,3/2,5/3]);
// Sung inward: from the outer ring toward the bindu, clockwise from the top.
export function spiralOrder(faces){
  const angle=f=>{const a=Math.atan2(f.centroid[0],f.centroid[1]);return a<0?a+2*Math.PI:a;};
  return faces.map((f,i)=>({i,ring:f.ring,a:angle(f)})).sort((p,q)=>q.ring-p.ring||p.a-q.a||p.i-q.i).map(p=>p.i);
}
// Bilateral symmetry is the yantra's law, so mirror chambers share a pitch.
// Classes are ordered outer ring to bindu, then bottom to top; each class is a
// pentatonic step, so the instrument rises toward the centre.
export function mirrorClasses(faces){
  const key=f=>f.ring+':'+Math.abs(f.centroid[0]).toFixed(6)+':'+f.centroid[1].toFixed(6);
  const reps=new Map();
  faces.forEach((f,i)=>{const k=key(f);if(!reps.has(k))reps.set(k,{ring:f.ring,y:f.centroid[1],ax:Math.abs(f.centroid[0]),members:[]});reps.get(k).members.push(i);});
  const classes=[...reps.values()].sort((p,q)=>q.ring-p.ring||p.y-q.y||p.ax-q.ax);
  const classOf=new Array(faces.length);classes.forEach((c,k)=>c.members.forEach(i=>classOf[i]=k));
  return {classes,classOf};
}
export function chamberVoices(faces,{rootHz=110}={}){
  const {classes,classOf}=mirrorClasses(faces),last=Math.max(1,classes.length-1),span=15;
  return faces.map((f,i)=>{
    const k=classOf[i],step=Math.round(k*span/last),octave=Math.floor(step/5),degree=step%5;
    return {index:i,id:f.id,ring:f.ring,coverageDepth:f.coverageDepth,mirrorClass:k,step,
      ratio:PENTATONIC[degree]*2**octave,hz:rootHz*2*PENTATONIC[degree]*2**octave,
      pan:Math.max(-.85,Math.min(.85,f.centroid[0]*.9)),coveringTriangles:f.coveringTriangles.slice()};
  });
}
function inTriangle(p,a,b,c){
  const s=(u,v,w)=>(u[0]-w[0])*(v[1]-w[1])-(v[0]-w[0])*(u[1]-w[1]);
  const d1=s(p,a,b),d2=s(p,b,c),d3=s(p,c,a);
  return !((d1<-EPS||d2<-EPS||d3<-EPS)&&(d1>EPS||d2>EPS||d3>EPS));
}
function inPolygon(p,v){for(let i=1;i+1<v.length;i++)if(inTriangle(p,v[0],v[i],v[i+1]))return true;return false;}
// Returns {kind:'chamber',index} | {kind:'void',index} | {kind:'outside'} for a
// point in yantra units (R = 1, centre at the bindu).
export function locate(yantra,x,y){
  const p=[x,y];
  if(Math.hypot(x,y)>1+1e-9)return {kind:'outside'};
  for(let i=0;i<yantra.faces.length;i++)if(inPolygon(p,yantra.faces[i].vertices))return {kind:'chamber',index:i};
  for(let i=0;i<(yantra.voids||[]).length;i++)if(inPolygon(p,yantra.voids[i].vertices))return {kind:'void',index:i};
  return {kind:'outside'};
}
// Deterministic light field for the transport spiral: chamber spiral[k] is
// struck on half-beat k. Intensity decays over `decay` beats, so the field is
// a pure function of the musical beat (no hidden per-frame state).
export function spiralLights(order,beat,{decay=1.6,steps=2}={}){
  const out=new Float64Array(order.length),now=Math.floor(beat*steps);
  for(let k=now;k>now-Math.ceil(decay*steps)-1&&k>=0;k--){
    const age=beat-k/steps;if(age<0)continue;
    const j=order[k%order.length];out[j]=Math.max(out[j],Math.exp(-age*3/decay));
  }
  return out;
}
// When the spiral reaches the bindu (the last chamber in the order), the
// pilgrimage completes; returns the beat of the most recent arrival.
export function lastArrival(order,beat,steps=2){
  const n=order.length,k=Math.floor(beat*steps);if(k<n-1)return -Infinity;
  return (Math.floor((k-(n-1))/n)*n+(n-1))/steps;
}
