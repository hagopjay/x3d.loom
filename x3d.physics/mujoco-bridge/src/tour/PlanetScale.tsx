import {useMemo,useState} from 'react';

/**
 * "The path to planet scale": PLAN.md sections 4 and 5 as drawings.
 * Every number here is an Estimate from PLAN.md section 4 (20,000 researchers a day) unless marked otherwise.
 */

const PHASES=[
 {id:'0',name:'Harden the seed',who:'one laptop',state:'done',note:'Tests in 3 browsers, licence, threat model'},
 {id:'S1',name:'Agents slice',who:'AI assistants',state:'done',note:'validate · convert · simulate over MCP'},
 {id:'1',name:'One arm → any robot',who:'robotics labs',state:'next',note:'Menagerie scoreboard, exact replay'},
 {id:'2',name:'SDKs, CLI, transports',who:'developers',state:'later',note:'Python + JS packages, Web Worker, WebSocket'},
 {id:'3',name:'Hosted beta',who:'hundreds / day',state:'later',note:'CDN app, sandboxed jobs, citable links'},
 {id:'4',name:'Planet scale',who:'tens of thousands / day',state:'later',note:'multi-region, GPU queue, open registry'},
] as const;

function wrap(text:string,max=24):string[]{const out:string[]=[];let line='';for(const w of text.split(' ')){if((line+' '+w).trim().length>max&&line){out.push(line);line=w;}else line=(line+' '+w).trim();}if(line)out.push(line);return out;}

function PhaseMap(){
 const W=1100,y=126,x0=110,dx=(W-2*x0)/(PHASES.length-1);
 return <figure className="overflow-x-auto" aria-labelledby="phase-cap">
  <svg viewBox={`0 0 ${W} 300`} className="min-w-[780px] w-full" role="img" aria-label="Six phases from one laptop to planet scale; phase 0 and the agents slice are done, phase 1 is next.">
   <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink)" strokeWidth="1.2" opacity=".35"/></pattern></defs>
   {/* the audience: a band under the stations, rising from one laptop to tens of thousands a day */}
   <path d={`M${x0} ${y+150} L${x0+dx*2} ${y+146} C ${x0+dx*3.2} ${y+142}, ${x0+dx*4.2} ${y+128}, ${x0+dx*5} ${y+100}`} fill="none" stroke="var(--mj)" strokeWidth="2.5" className="flow"/>
   <text x={x0+dx*5} y={y+168} textAnchor="end" className="serif" fontStyle="italic" fontSize="15" fill="var(--mj)">people served per day: 1 → tens of thousands ↗</text>
   {/* the line: solid where travelled, dotted ahead */}
   <line x1={x0} y1={y} x2={x0+dx*1.5} y2={y} stroke="var(--ink)" strokeWidth="6" strokeLinecap="round"/>
   <line x1={x0+dx*1.5} y1={y} x2={x0+dx*5} y2={y} stroke="var(--ink)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round"/>
   {PHASES.map((p,i)=>{const x=x0+dx*i,done=p.state==='done';return <g key={p.id}>
    <circle cx={x} cy={y} r={done?17:14} fill={done?'var(--ink)':p.state==='next'?'url(#hatch)':'var(--paper)'} stroke="var(--ink)" strokeWidth="3"/>
    <text x={x} y={y+5} textAnchor="middle" fontSize="12" fontWeight="700" fill={done?'var(--paper)':'var(--ink)'} className="mono">{p.id}</text>
    <text x={x} y={y-46} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">{p.name}</text>
    <text x={x} y={y-28} textAnchor="middle" fontSize="12" fill="var(--ink-2)" className="mono">{p.who}</text>
    <text x={x} y={y+40} textAnchor="middle" fontSize="11.5" fill="var(--ink-2)">{wrap(p.note).map((l,k)=><tspan key={k} x={x} dy={k?15:0}>{l}</tspan>)}</text>
    {done&&<text x={x} y={y+24+15*wrap(p.note).length+12} textAnchor="middle" fontSize="10" className="mono" fill="var(--ink)" letterSpacing="1.5">✓ GATE PASSED</text>}
    {/* a gate after every phase: nothing advances without its evidence file */}
    {i<PHASES.length-1&&<g transform={`translate(${x+dx/2-7},${y-11})`}><rect width="14" height="22" rx="2" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5"/><line x1="7" y1="3" x2="7" y2="19" stroke="var(--ink)" strokeWidth="1.5"/></g>}
   </g>;})}
   <g transform={`translate(${x0+dx*1.5},${y-74})`}><path d="M0 0 L0 63" stroke="var(--x3d)" strokeWidth="2"/><rect x="-50" y="-26" width="100" height="24" rx="12" fill="var(--x3d)"/><text x="0" y="-9" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">YOU ARE HERE</text></g>
  </svg>
  <figcaption id="phase-cap" className="mt-2 text-sm text-[var(--ink-2)]"><b>The route.</b> Each ▯ is a gate: a phase ends only when its tests pass and an evidence file says so (phase 0's is <span className="mono">GATE-0.md</span>). Solid line = built and checked; dotted = planned. Durations and audiences are the plan's estimates.</figcaption>
 </figure>;
}

/** Architecture at three sizes, drawn as boxes and wires. */
function Box({x,y,w,h,title,sub,tone='ink'}:{x:number;y:number;w:number;h:number;title:string;sub?:string;tone?:'ink'|'x3d'|'mj'|'ghost'}){
 const stroke=tone==='x3d'?'var(--x3d)':tone==='mj'?'var(--mj)':'var(--ink)';
 return <g><rect x={x} y={y} width={w} height={h} rx="5" fill={tone==='ghost'?'transparent':'#fbf8f1'} stroke={stroke} strokeWidth="1.6" strokeDasharray={tone==='ghost'?'4 4':undefined}/>
  <text x={x+w/2} y={y+(sub?h/2-3:h/2+5)} textAnchor="middle" fontSize="13" fontWeight="700" fill={stroke==='var(--ink)'?'var(--ink)':stroke}>{title}</text>
  {sub&&<text x={x+w/2} y={y+h/2+14} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)" className="mono">{sub}</text>}</g>;
}
const Wire=({d,dashed=true}:{d:string;dashed?:boolean})=><path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.4" className={dashed?'flow':undefined} markerEnd="url(#arrow)"/>;

function Architecture(){
 return <figure className="overflow-x-auto" aria-labelledby="arch-cap">
  <svg viewBox="0 0 1040 420" className="min-w-[860px] w-full" role="img" aria-label="Three architecture drawings: today on one laptop, a hosted beta, and planet scale.">
   <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--ink)"/></marker></defs>
   {[['TODAY','one laptop · nothing hosted',20],['HOSTED BETA','hundreds of researchers a day',365],['PLANET SCALE','tens of thousands a day',710]].map(([t,s,x])=><g key={t as string}>
    <text x={Number(x)} y="26" className="mono" fontSize="12" letterSpacing="2.5" fill="var(--ink-2)">{t}</text>
    <text x={Number(x)} y="48" className="serif" fontStyle="italic" fontSize="17" fill="var(--ink)">{s}</text></g>)}
   <line x1="345" y1="16" x2="345" y2="404" stroke="var(--ink)" strokeOpacity=".2"/><line x1="690" y1="16" x2="690" y2="404" stroke="var(--ink)" strokeOpacity=".2"/>
   {/* today */}
   <Box x={20} y={70} w={300} h={88} title="Your browser" sub="X_ITE draws · MuJoCo WASM moves" tone="x3d"/>
   <Box x={20} y={190} w={140} h={64} title="AI assistant" sub="MCP over stdio"/>
   <Box x={180} y={190} w={140} h={64} title="Python tools" sub="native MuJoCo 3.17"/>
   <Box x={20} y={286} w={300} h={64} title="Colab G4 notebook" sub="1,000s of worlds on a GPU" tone="mj"/>
   <Wire d="M160 222 L178 222"/><Wire d="M250 256 L250 284"/>
   <text x="20" y="384" fontSize="12" fill="var(--ink-2)">The <tspan fontWeight="700" fill="var(--ink)">experiment package</tspan> (.zip) is the only thing that moves between them.</text>
   {/* hosted beta */}
   <Box x={365} y={70} w={150} h={56} title="CDN" sub="static app, cached"/>
   <Box x={530} y={70} w={140} h={56} title="Browsers" sub="physics stays here" tone="x3d"/>
   <Box x={365} y={150} w={305} h={56} title="Stateless API" sub="validate · convert · package · replay"/>
   <Box x={365} y={230} w={150} h={64} title="Sandboxed jobs" sub="no network, time limits" tone="mj"/>
   <Box x={530} y={230} w={140} h={64} title="Storage" sub="content-addressed"/>
   <Box x={365} y={318} w={305} h={44} title="ORCID sign-in · quotas · metrics"/>
   <Wire d="M515 98 L528 98"/><Wire d="M600 128 L600 148"/><Wire d="M440 208 L440 228"/><Wire d="M600 208 L600 228"/>
   {/* planet */}
   {[0,1,2].map(i=><g key={i} transform={`translate(${710+i*12},${70+i*10})`}><rect width="290" height="120" rx="6" fill="#fbf8f1" stroke="var(--ink)" strokeWidth="1.4" opacity={i===2?1:.55}/></g>)}
   <text x="868" y="112" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)">Region × 3+</text>
   <text x="868" y="132" textAnchor="middle" fontSize="10.5" className="mono" fill="var(--ink-2)">API + workers autoscale on queue depth</text>
   <text x="868" y="150" textAnchor="middle" fontSize="10.5" className="mono" fill="var(--ink-2)">old engines kept forever → old papers replay</text>
   <Box x={734} y={222} w={140} h={64} title="GPU queue" sub="metered, quota-gated" tone="mj"/>
   <Box x={886} y={222} w={136} h={64} title="Open registry" sub="search · fork · cite"/>
   <Box x={734} y={306} w={288} h={56} title="Open spec + conformance suite" sub="a 2nd implementation proves it" tone="ghost"/>
   <Wire d="M804 202 L804 220"/><Wire d="M954 202 L954 220"/>
  </svg>
  <figcaption id="arch-cap" className="mt-2 text-sm text-[var(--ink-2)]"><b>Same contract, three sizes.</b> What changes is <i>where</i> the boxes run, never the language they speak (<span className="mono">x3d-mujoco/0.1</span>). Hosting starts at phase 3; year one is deliberately local.</figcaption>
 </figure>;
}

/** 20,000 browsers each running their own physics; the server only hands out the app. */
function Constellation(){
 const dots=useMemo(()=>{let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;return Array.from({length:260},()=>{const a=r()*Math.PI*2,d=Math.sqrt(r())*1;return {x:500+Math.cos(a)*d*430,y:150+Math.sin(a)*d*120,dl:(r()*3).toFixed(2)};});},[]);
 return <figure aria-labelledby="const-cap">
  <svg viewBox="0 0 1000 300" className="w-full" role="img" aria-label="A cloud of dots, each a researcher's browser running its own physics, all fed by one small static file server.">
   {dots.filter((_,i)=>i%9===0).map((d,i)=><line key={i} x1="500" y1="150" x2={d.x} y2={d.y} stroke="var(--ink)" strokeOpacity=".12"/>)}
   {dots.map((d,i)=><circle key={i} cx={d.x} cy={d.y} r="3.2" fill="var(--mj)" className="live-dot" style={{animationDelay:`${d.dl}s`}}/>)}
   <rect x="455" y="128" width="90" height="44" rx="4" fill="var(--ink)"/>
   <text x="500" y="148" textAnchor="middle" fill="var(--paper)" fontSize="12" fontWeight="700">CDN</text>
   <text x="500" y="163" textAnchor="middle" fill="var(--paper)" fontSize="10" className="mono">static files</text>
  </svg>
  <figcaption id="const-cap" className="mt-1 text-sm text-[var(--ink-2)]">Each <span className="mj">●</span> is someone's browser doing its own physics. The centre only hands out a ~30 MB app, once, from a cache. <b>Twenty thousand visitors means twenty thousand physics engines nobody has to rent.</b></figcaption>
 </figure>;
}

const LOADS=[
 {id:'interactive',label:'Interactive physics, if servers ran it',value:20000,note:'Estimate (mine): 20,000 people × 1 hour of live simulation. In this design it runs in their browsers, so this server bill is avoided.',avoided:true},
 {id:'rollouts',label:'Batch rollouts on servers',value:333,note:'PLAN.md §4: 10% of people run 10 jobs of 60 CPU-seconds ≈ 14 cores busy on average.',avoided:false},
 {id:'api',label:'API calls (validate, convert, package)',value:5.6,note:'PLAN.md §4: 20 calls each × 50 ms CPU ≈ 4.6 calls/s on average.',avoided:false},
] as const;

function LoadChart(){
 const [hover,setHover]=useState<string|null>(null);const [table,setTable]=useState(false);
 const max=LOADS[0].value,W=640,barH=34,gap=22,left=0;
 return <figure aria-labelledby="load-cap" className="card p-5">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-lg font-bold">Server CPU-hours per day at 20,000 researchers</h4><button type="button" className="text-sm underline decoration-dotted" onClick={()=>setTable(t=>!t)}>{table?'Show the chart':'Show the numbers'}</button></div>
  <p className="text-sm text-[var(--ink-2)]">Estimates. The vermilion bar is the work this design <i>doesn't</i> pay for.</p>
  {table?<table className="mt-3 w-full text-sm"><thead><tr className="text-left"><th className="py-1">Load</th><th className="py-1 text-right">CPU-h/day</th><th className="py-1 pl-4">Basis</th></tr></thead><tbody>{LOADS.map(l=><tr key={l.id} className="border-t hairline align-top"><td className="py-2 pr-2">{l.label}</td><td className="mono py-2 text-right">{l.value.toLocaleString()}</td><td className="py-2 pl-4 text-[var(--ink-2)]">{l.note}</td></tr>)}</tbody></table>:
  <div className="relative mt-4">
   <svg viewBox={`0 0 ${W} ${LOADS.length*(barH+gap)+8}`} className="w-full" role="img" aria-label="Bar chart: interactive physics 20,000 CPU-hours avoided; rollouts 333; API 5.6.">
    {LOADS.map((l,i)=>{const y=i*(barH+gap)+18,w=Math.max(4,(l.value/max)*(W-150));const on=hover===l.id;return <g key={l.id} onMouseEnter={()=>setHover(l.id)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(l.id)} onBlur={()=>setHover(null)} tabIndex={0}>
     <rect x={left} y={y-18} width={W} height={barH+gap-4} fill="transparent"/>
     <text x={left} y={y-4} fontSize="12.5" fill="var(--ink)">{l.label}</text>
     <rect x={left} y={y} width={w} height={barH-14} rx="4" fill={l.avoided?'var(--mj)':'#8a8274'} opacity={hover&&!on?.45:1}/>
     <text x={left+w+8} y={y+15} fontSize="13" fontWeight="700" className="mono" fill="var(--ink)">{l.value.toLocaleString()}{l.avoided?' (avoided)':''}</text>
    </g>;})}
   </svg>
   {hover&&<div role="tooltip" className="pointer-events-none absolute right-0 top-0 max-w-[280px] rounded border border-[var(--ink)] bg-[var(--paper)] p-3 text-xs leading-5 shadow-[3px_3px_0_var(--ink)]">{LOADS.find(l=>l.id===hover)!.note}</div>}
  </div>}
  <figcaption id="load-cap" className="mt-3 text-sm text-[var(--ink-2)]">The 5.6 bar is too small to see on this scale. That is the point: <b>the expensive part of physics happens on visitors' own machines</b>.</figcaption>
 </figure>;
}

const KPIS=[
 ['~600 GB','a day of app downloads','cached at the CDN'],
 ['~4.6 /s','API calls on average','~50/s at a 10× peak'],
 ['~14 cores','for server-side rollouts','autoscaled for peaks'],
 ['~7 TB','of packages a year','before de-duplication'],
] as const;

export default function PlanetScale(){
 return <div className="space-y-12">
  <PhaseMap/>
  <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
   <Constellation/>
   <div><p className="kicker">Why it can be cheap</p><p className="serif mt-2 text-2xl leading-snug">The costly part of physics is the <span className="underline-mj">simulation loop</span>. Here it runs inside each visitor's browser, so <i>more visitors add almost no server cost</i>.</p>
    <p className="mt-3 text-[15px] leading-7 text-[var(--ink-2)]">What servers do is the work browsers can't: batches of thousands of rollouts, long jobs, converting big model libraries. That part is metered from day one, and the GPU tier sits behind its own quota.</p></div>
  </div>
  <div><p className="kicker mb-3">The arithmetic for 20,000 researchers a day (Estimates, PLAN.md §4)</p>
   <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{KPIS.map(([v,l,s])=><div key={l} className="card p-4"><p className="mono text-3xl font-bold">{v}</p><p className="mt-1 text-sm font-bold">{l}</p><p className="text-xs text-[var(--ink-2)]">{s}</p></div>)}</div></div>
  <LoadChart/>
  <Architecture/>
  <div className="grid gap-3 md:grid-cols-3">{[
   ['Scale is mostly trust, not compute','Correctness, reproducibility, security and versioning matter more than raw servers. That is why phase 0 was tests, a licence and a threat model.'],
   ['Old results keep working','Each package pins the engine build it ran on. Old WASM builds and worker images are small, so they are kept forever: a 2026 paper still replays in 2036.'],
   ['Nobody has to trust one codebase','The end state is an open specification with a conformance suite, and a second, independent implementation that passes it.'],
  ].map(([h,p])=><div key={h} className="border-t-2 border-[var(--ink)] pt-3"><p className="font-bold">{h}</p><p className="mt-1 text-sm leading-6 text-[var(--ink-2)]">{p}</p></div>)}</div>
 </div>;
}
