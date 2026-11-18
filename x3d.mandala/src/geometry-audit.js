// A lightweight independent check at the native-browser representation boundary.
// Full chamber topology is computed by the separate finite-segment DCEL tool.
const TRIPLES=[[1,2,7],[2,3,7],[1,3,8],[1,4,6],[1,5,9],[4,6,9],[2,7,9],[3,7,8],[3,8,9],[4,4,8],[5,5,6],[2,6,6]];
const APEX_BASE=[[8,1],[6,2],[9,3],[1,6],[5,7],[4,8],[2,9]];
const line=(a,b)=>[a[1]-b[1],b[0]-a[0],a[0]*b[1]-b[0]*a[1]];
const intersection=(a,b)=>{const d=a[0]*b[1]-b[0]*a[1];if(Math.abs(d)<1e-18)throw Error('AUDIT_PARALLEL');return[(a[1]*b[2]-b[1]*a[2])/d,(a[2]*b[0]-b[2]*a[0])/d];};
const distance=(p,l)=>Math.abs(l[0]*p[0]+l[1]*p[1]+l[2])/Math.hypot(l[0],l[1]);
export function auditTriangles(triangles,tolerance=1e-7){
  const t=triangles.map(t=>t.vertices??t);
  if(t.length!==9||t.some(v=>v.length!==3||v.some(p=>!p.slice(0,2).every(Number.isFinite))))throw Error('AUDIT_BAD_COORDINATES');
  let concurrency=0,incidence=0,circle=0,reflection=0;
  for(const [i,j,k]of TRIPLES)for(const side of[1,2]){
    const a=t[i-1],b=t[j-1],c=t[k-1],p=intersection(line(a[0],a[side]),line(c[0],c[side]));
    concurrency=Math.max(concurrency,distance(p,line(b[1],b[2])));
  }
  for(const[a,b]of APEX_BASE)incidence=Math.max(incidence,Math.abs(t[a-1][0][1]-t[b-1][1][1]));
  for(const i of[2,6])for(const p of t[i])circle=Math.max(circle,Math.abs(Math.hypot(p[0],p[1])-1));
  for(const v of t)reflection=Math.max(reflection,Math.abs(v[0][0]),Math.abs(v[1][0]+v[2][0]),Math.abs(v[1][1]-v[2][1]));
  const maxResidualR=Math.max(concurrency,incidence,circle,reflection);
  return{pass:maxResidualR<=tolerance,toleranceR:tolerance,maxResidualR,concurrencyR:concurrency,apexBaseR:incidence,circumcircleR:circle,reflectionR:reflection,checks:24+7+6+27};
}
export function trianglesFromNativePoints(points){
  if(points.length!==36)throw Error('AUDIT_EXPECTED_36_LINE_POINTS');
  return Array.from({length:9},(_,i)=>points.slice(i*4,i*4+3).map(p=>[Number(p.x??p[0]),Number(p.y??p[1])]));
}
