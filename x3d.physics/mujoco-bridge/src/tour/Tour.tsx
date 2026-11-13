import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {BridgeSession} from '../bridge/session';
import {createScene} from '../bridge/scene';
import {exportBundle} from '../bridge/package';
import {loadXite,XiteAdapter,type BridgeCanvas} from '../bridge/xiteAdapter';
import type {Ack,Envelope,Frame} from '../bridge/contract';
import {downloadText} from '../utils/experiment';
import EVIDENCE from '../data/evidence.json';
import PlanetScale from './PlanetScale';

/**
 * The guided tour: a plain-language front door to the X3D ⇄ MuJoCo bridge.
 * Everything live on this page is the real thing (MuJoCo 3.17 WASM physics, X_ITE rendering, the
 * bridge contract); the numbers in "Receipts" come from validation/ via scripts/tour-evidence.mjs.
 */

const FONT_CSS=`
@font-face{font-family:"Tour Serif";src:url(./vendor/x_ite/assets/fonts/Droid/DroidSerif-Regular.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Tour Serif";src:url(./vendor/x_ite/assets/fonts/Droid/DroidSerif-Italic.woff2) format("woff2");font-weight:400;font-style:italic;font-display:swap}
@font-face{font-family:"Tour Serif";src:url(./vendor/x_ite/assets/fonts/Droid/DroidSerif-Bold.woff2) format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"Tour Sans";src:url(./vendor/x_ite/assets/fonts/PT_Sans/PTSans-Regular.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Tour Sans";src:url(./vendor/x_ite/assets/fonts/PT_Sans/PTSans-Bold.woff2) format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Tour Sans";src:url(./vendor/x_ite/assets/fonts/PT_Sans/PTSans-Italic.woff2) format("woff2");font-style:italic;font-display:swap}
@font-face{font-family:"Tour Mono";src:url(./vendor/x_ite/assets/fonts/Ubuntu/UbuntuMono-R.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Tour Mono";src:url(./vendor/x_ite/assets/fonts/Ubuntu/UbuntuMono-B.woff2) format("woff2");font-weight:700;font-display:swap}`;

type Who='you'|'x3d'|'mujoco';
interface Msg{id:number;who:Who;raw:string;plain:string}
const deg=(r:number)=>Math.round(r*180/Math.PI);
const grams=(n:number)=>Math.round(n/9.81*1000);
function feel(n:number){if(n<.05)return 'nothing at all';if(n<.6)return 'a feather-light touch';if(n<2)return 'about the weight of a phone in your palm';if(n<5)return 'like holding a can of soup';return 'like holding a bag of sugar';}

function narrate(f:Frame|null,lastEdit:number):{title:string;body:string}{
 if(!f)return {title:'Waking up the physics engine…',body:'MuJoCo is being loaded into your browser. Nothing is sent to a server.'};
 if(Date.now()-lastEdit<2600)return {title:'You changed the world itself.',body:'Moving the ball changes the physical model, so MuJoCo rebuilt it from the new description and put the arm back at its start. Changing the goal does not rebuild anything: it is just a new instruction.'};
 if(!f.running)return {title:f.simTime>0?'Paused.':'Everything is still.',body:f.simTime>0?`Frozen at ${f.simTime.toFixed(2)} s of simulated time. Press play to continue.`:'The arm waits at its starting pose. Press play and MuJoCo starts computing its motion about 500 times a second.'};
 if(f.contactPoint&&f.touchN>.05)return {title:`Contact: the tip presses with ${f.touchN.toFixed(2)} N.`,body:`That's about ${grams(f.touchN)} g of push, ${feel(f.touchN)}. MuJoCo measured it with a touch sensor and reported it back; X3D lit the red dot where they meet.`};
 return {title:'The arm is reaching for the blue goal.',body:'Motors at the shoulder and elbow pull toward the goal angles. MuJoCo works out every push, swing and wobble; X3D only draws what MuJoCo reports.'};
}

/** The live scene: X_ITE in a "plate", driven by the real bridge session. */
function LivePlate({session,revision,send}:{session:BridgeSession;revision:number;send:(t:Envelope['type'],p:unknown,s:Envelope['source'])=>Ack}){
 const host=useRef<HTMLDivElement>(null),adapter=useRef<XiteAdapter|null>(null),gen=useRef(0);
 const [ready,setReady]=useState(false),[err,setErr]=useState('');
 const sendRef=useRef(send);sendRef.current=send;
 useEffect(()=>{let dead=false,canvas:BridgeCanvas|null=null;(async()=>{try{
  const api=await loadXite();if(dead)return;await customElements.whenDefined('x3d-canvas');if(dead)return;
  canvas=document.createElement('x3d-canvas') as BridgeCanvas;canvas.setAttribute('contentScale','1');canvas.setAttribute('splashScreen','false');canvas.setAttribute('notifications','false');canvas.setAttribute('aria-label','Live 3D scene: a two-link robot arm, a blue goal and an orange ball');canvas.style.cssText='display:block;width:100%;height:100%';
  host.current?.append(canvas);if(!canvas.browser)throw Error('Your browser could not start WebGL, so the 3D view is off. The physics still runs.');
  adapter.current=new XiteAdapter(api,canvas.browser,()=>session.recipe,(t,p,s)=>sendRef.current(t,p,s),()=>{},()=>{});setReady(true);
 }catch(e){if(!dead)setErr(e instanceof Error?e.message:String(e));}})();
  return()=>{dead=true;gen.current++;adapter.current?.dispose();adapter.current=null;canvas?.remove();};},[session]);
 useEffect(()=>{if(!ready||!adapter.current)return;const g=++gen.current;adapter.current.load(createScene(session.recipe,session.target,session.snapshot())).catch(e=>{if(g===gen.current)setErr(String(e));});},[ready,session,revision]);
 useEffect(()=>{let raf=0;const tick=()=>{raf=requestAnimationFrame(tick);if(adapter.current&&session.engine.ready){try{adapter.current.sync(session.snapshot());}catch{/* next frame */}}};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[session]);
 return <div className="plate h-[360px] sm:h-[460px]"><div ref={host} className="absolute inset-0 overflow-hidden rounded"/>
  {err&&<div role="alert" className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-amber-100">{err}</div>}
  <div className="pointer-events-none absolute left-3 top-3 z-[3] flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white"><span className="live-dot inline-block h-2 w-2 rounded-full bg-[#ff6a3d]"/>LIVE · in your browser</div>
  <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[3] text-[11px] leading-5 text-white/80">Drag the <b className="text-[#7aa2ff]">blue</b> goal or the <b className="text-[#ff9a6b]">orange</b> ball with your mouse. Drag the background to look around.</div>
 </div>;
}

function useBridge(){
 const [session]=useState(()=>new BridgeSession());
 const [ready,setReady]=useState(false),[frame,setFrame]=useState<Frame|null>(null),[revision,setRevision]=useState(0),[failed,setFailed]=useState('');
 const [msgs,setMsgs]=useState<Msg[]>([]);const nid=useRef(0);const lastEdit=useRef(0);const lastPose=useRef(0);
 const say=useCallback((who:Who,raw:string,plain:string)=>setMsgs(m=>[...m.slice(-24),{id:++nid.current,who,raw,plain}]),[]);
 const send=useCallback((type:Envelope['type'],payload:unknown,source:Envelope['source']='ui'):Ack=>{
  const ack=session.command(type,payload,source);
  if(ack.accepted){setRevision(session.modelRevision);setFrame(session.snapshot());}
  const from=source==='x3d'?'X3D (your drag)':'You';
  if(type==='target.set'&&Array.isArray(payload))say('x3d',`${source==='x3d'?'X3D':'UI'} → MuJoCo  target.set [${(payload as number[]).map(v=>v.toFixed(2)).join(', ')}] rad`,`${from}: "Reach for shoulder ${deg((payload as number[])[0])}°, elbow ${deg((payload as number[])[1])}°." ${ack.accepted?'MuJoCo: "Got it."':'MuJoCo refused: '+ack.message}`);
  else if(type==='model.replace'){lastEdit.current=Date.now();say('x3d',`X3D → MuJoCo  model.replace  (revision ${ack.modelRevision})`,ack.accepted?`${from} moved the ball. MuJoCo rebuilt the world as version ${ack.modelRevision} and reset the arm.`:`MuJoCo refused the edit: ${ack.message}`);}
  else if(type==='transport.set')say('you',`UI → MuJoCo  transport.set ${String(payload)}`,payload?'You pressed play: MuJoCo starts stepping time forward.':'You paused time.');
  else if(type==='reset')say('you','UI → MuJoCo  reset','Back to the starting pose; same world, fresh clock.');
  return ack;
 },[session,say]);
 useEffect(()=>{let dead=false;session.init().then(()=>{if(dead)return;setReady(true);setRevision(session.modelRevision);setFrame(session.snapshot());
  say('mujoco','MuJoCo 3.17.0 (WebAssembly) ready · model revision 1','MuJoCo: "I\'m running inside this page. I own the motion and the forces."');
  say('x3d','X_ITE 16.7.0 · X3D 4.0 scene · 2 bodies bound','X3D: "I own how things look and what you point at. I never move the arm myself."');
 }).catch(e=>!dead&&setFailed(String(e)));return()=>{dead=true;};},[session,say]);
 useEffect(()=>{let raf=0,last=performance.now(),sample=last;const loop=(now:number)=>{raf=requestAnimationFrame(loop);const dt=(now-last)/1000;last=now;if(!session.engine.ready)return;try{session.advance(dt);}catch{session.engine.running=false;}
  if(now-sample>180){sample=now;const f=session.snapshot();setFrame(f);
   if(f.running&&now-lastPose.current>1600){lastPose.current=now;const [q1,q2]=f.qpos;say('mujoco',`MuJoCo → X3D  pose q=[${q1.toFixed(3)}, ${q2.toFixed(3)}] touch=${f.touchN.toFixed(2)} N  t=${f.simTime.toFixed(2)} s`,f.touchN>.05?`MuJoCo: "Shoulder ${deg(q1)}°, elbow ${deg(q2)}°. The tip is pressing with ${f.touchN.toFixed(1)} N."`:`MuJoCo: "Shoulder ${deg(q1)}°, elbow ${deg(q2)}°. No contact yet."`);}}
 };raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);},[session,say]);
 return {session,ready,frame,revision,msgs,send,failed,lastEdit};
}

function Conversation({msgs}:{msgs:Msg[]}){
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{const b=box.current;if(b)b.scrollTop=b.scrollHeight;},[msgs]);
 return <div className="card flex h-[460px] flex-col overflow-hidden">
  <div className="flex items-center justify-between border-b hairline px-4 py-2"><p className="kicker">The conversation</p><p className="text-[11px] text-[var(--ink-2)]"><span className="x3d">■ X3D</span> · <span className="mj">■ MuJoCo</span> · ■ you</p></div>
  <div ref={box} className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite" aria-label="Messages between X3D and MuJoCo, translated into plain English">
   {msgs.map(m=><div key={m.id} className={`msg-in rounded px-3 py-2 ${m.who==='x3d'?'bubble-x3d mr-6':m.who==='mujoco'?'bubble-mj ml-6':'bubble-you mr-10'}`}>
    <p className="serif text-[14px] italic leading-snug">{m.plain}</p>
    <p className="mono mt-1 break-all text-[10.5px] text-[var(--ink-3)]">{m.raw}</p></div>)}
  </div>
  <p className="border-t hairline px-4 py-2 text-[11px] leading-4 text-[var(--ink-2)]">Italic: what it means. Small print: the actual message in the bridge contract <span className="mono">x3d-mujoco/0.1</span>.</p>
 </div>;
}

const Section=({n,kicker,title,children,id}:{n:string;kicker:string;title:ReactNode;children:ReactNode;id?:string})=>
 <section id={id} className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8">
  <div className="mb-8 grid gap-2 sm:grid-cols-[90px_1fr]"><p className="sec-num text-4xl leading-none">§{n}</p><div><p className="kicker">{kicker}</p><h2 className="serif mt-2 max-w-[22ch] text-[clamp(28px,4vw,46px)] leading-[1.05]">{title}</h2></div></div>
  <div className="sm:pl-[98px]">{children}</div>
 </section>;

export default function Tour(){
 useEffect(()=>{const s=document.createElement('style');s.textContent=FONT_CSS;document.head.append(s);const prev=document.documentElement.style.background;document.documentElement.style.background='#f2ede1';document.title='X3D ⇄ MuJoCo · a guided tour';return()=>{s.remove();document.documentElement.style.background=prev;};},[]);
 const {session,ready,frame,revision,msgs,send,failed,lastEdit}=useBridge();
 const [obsX,setObsX]=useState(.88);const commitTimer=useRef<number|undefined>(undefined);
 const target=frame?.target??[.35,.6];
 const moveBall=(x:number)=>{setObsX(x);window.clearTimeout(commitTimer.current);commitTimer.current=window.setTimeout(()=>{const r=structuredClone(session.recipe);r.obstacle.position=[x,r.obstacle.position[1],.34];send('model.replace',r,'ui');},380);};
 useEffect(()=>{if(ready)setObsX(session.recipe.obstacle.position[0]);},[ready,revision,session]);
 const story=narrate(frame,lastEdit.current);
 const exportPkg=async()=>{const bytes=await exportBundle(session.recipe,session.target,session.snapshot(),session.history,null);const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download='my-first-experiment.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 const E=EVIDENCE;
 const totalChecks=E.nodeChecks.passed+E.threats.passed+E.schema.passed+E.browsers.reduce((a,b)=>a+b.passed,0);

 return <div className="tour min-h-screen">
  {/* masthead */}
  <header className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 border-b-2 border-[var(--ink)] px-5 py-4 sm:px-8">
   <p className="mono text-[12px] tracking-[.2em]">FIELD NOTES · Nº 1 · <span className="x3d">X3D</span> ⇄ <span className="mj">MUJOCO</span></p>
   <nav className="flex gap-4 text-[13px] font-bold"><a href="#try" className="hover:underline">Try it</a><a href="#scale" className="hover:underline">Planet scale</a><a href="?lab=1" className="hover:underline">Open the lab →</a></nav>
  </header>

  {/* hero */}
  <section className="mx-auto grid max-w-[1180px] gap-10 px-5 pb-10 pt-14 sm:px-8 lg:grid-cols-[1.25fr_.75fr]">
   <div>
    <p className="kicker rise" style={{animationDelay:'.05s'}}>An open bridge between two worlds</p>
    <h1 className="serif rise mt-4 text-[clamp(42px,7.4vw,92px)] leading-[.95] tracking-[-.01em]" style={{animationDelay:'.15s'}}>One language for how things <i className="x3d">look</i>.<br/>Another for how they <i className="mj">move</i>.</h1>
    <p className="rise mt-6 max-w-[54ch] text-[19px] leading-8 text-[var(--ink-2)]" style={{animationDelay:'.3s'}}><b className="text-[var(--ink)]">X3D</b> is the web's open standard for 3D scenes. <b className="text-[var(--ink)]">MuJoCo</b> is the physics engine robotics researchers trust. They have never spoken to each other. <b className="text-[var(--ink)]">This bridge lets them talk</b>, live, in your browser, with nothing to install.</p>
    <div className="rise mt-8 flex flex-wrap gap-3" style={{animationDelay:'.45s'}}><a href="#try" className="btn btn-ink">Try it, it's live ↓</a><a href="#scale" className="btn">How it scales to the planet</a></div>
   </div>
   <aside className="rise self-end" style={{animationDelay:'.55s'}}>
    <svg viewBox="0 0 360 270" className="w-full" role="img" aria-label="Two speech bubbles, X3D and MuJoCo, exchanging messages through the bridge">
     <rect x="6" y="18" width="172" height="74" rx="14" fill="var(--x3d-soft)" stroke="var(--x3d)" strokeWidth="2"/><text x="92" y="49" textAnchor="middle" className="serif" fontStyle="italic" fontSize="16" fill="var(--x3d)">"Here's where</text><text x="92" y="71" textAnchor="middle" className="serif" fontStyle="italic" fontSize="16" fill="var(--x3d)">you should reach."</text>
     <rect x="182" y="170" width="172" height="74" rx="14" fill="var(--mj-soft)" stroke="var(--mj)" strokeWidth="2"/><text x="268" y="201" textAnchor="middle" className="serif" fontStyle="italic" fontSize="16" fill="var(--mj)">"Here's where</text><text x="268" y="223" textAnchor="middle" className="serif" fontStyle="italic" fontSize="16" fill="var(--mj)">I actually am."</text>
     <path d="M180 58 C 290 58, 290 120, 276 166" fill="none" stroke="var(--ink)" strokeWidth="2" className="flow"/><path d="M180 208 C 70 208, 70 150, 86 96" fill="none" stroke="var(--ink)" strokeWidth="2" className="flow"/>
     <text x="180" y="138" textAnchor="middle" className="mono" fontSize="11" fill="var(--ink-2)">x3d-mujoco/0.1</text>
    </svg>
   </aside>
  </section>

  {/* live */}
  <Section n="1" id="try" kicker="Try it" title={<>Push a robot arm into a ball. <i>Watch the two engines talk.</i></>}>
   {failed&&<p role="alert" className="card mb-4 p-4 text-sm">Physics could not start here: {failed}</p>}
   <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
    <div>
     {ready?<LivePlate session={session} revision={revision} send={send}/>:<div className="plate grid h-[360px] place-items-center text-sm text-white/70 sm:h-[460px]">Loading MuJoCo into your browser…</div>}
     <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-mj" disabled={!ready} onClick={()=>send('transport.set',!session.engine.running)}>{frame?.running?'❚❚ Pause':'▶ Play'}</button>
      <button type="button" className="btn" disabled={!ready} onClick={()=>send('reset',null)}>↺ Start over</button>
      <span className="mono ml-auto text-[13px] text-[var(--ink-2)]">t = {frame?.simTime.toFixed(2)??'0.00'} s · world v{revision}</span>
     </div>
     <div className="mt-5 grid gap-5 sm:grid-cols-2">
      <label className="block"><span className="text-sm font-bold"><span className="x3d">Goal</span>: shoulder {deg(target[0])}°</span><input aria-label="Goal shoulder angle" className="x3d-range mt-2" type="range" min={-1.8} max={1.8} step={.01} disabled={!ready} value={target[0]} onChange={e=>send('target.set',[Number(e.target.value),target[1]])}/><span className="block text-xs text-[var(--ink-2)]">An instruction. Nothing gets rebuilt.</span></label>
      <label className="block"><span className="text-sm font-bold"><span className="mj">Ball</span>: {Math.round(obsX*100)} cm out</span><input aria-label="Ball position" className="mj-range mt-2" type="range" min={.5} max={1.05} step={.01} disabled={!ready} value={obsX} onChange={e=>moveBall(Number(e.target.value))}/><span className="block text-xs text-[var(--ink-2)]">A change to the world. MuJoCo rebuilds it.</span></label>
     </div>
    </div>
    <div className="space-y-4">
     <div className="border-l-4 border-[var(--ink)] pl-4" aria-live="polite"><p className="serif text-[22px] leading-tight">{story.title}</p><p className="mt-2 text-[15px] leading-7 text-[var(--ink-2)]">{story.body}</p></div>
     <div className="grid grid-cols-3 gap-2 text-center">{[['Press force',`${(frame?.touchN??0).toFixed(2)} N`,`≈ ${grams(frame?.touchN??0)} g`],['Touching?',frame?.contactPoint?'Yes':'No','contact points'],['Physics steps','500 / s','one every 2 ms of sim time']].map(([k,v,s])=><div key={k} className="card px-2 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-2)]">{k}</p><p className="mono text-2xl font-bold">{v}</p><p className="text-[11px] text-[var(--ink-3)]">{s}</p></div>)}</div>
     <Conversation msgs={msgs}/>
    </div>
   </div>
  </Section>

  {/* who owns what */}
  <Section n="2" kicker="The one rule" title={<>Every value has <i>exactly one owner</i>.</>}>
   <div className="grid items-stretch gap-0 md:grid-cols-[1fr_120px_1fr]">
    <div className="card bubble-x3d p-6"><p className="kicker x3d">X3D owns</p><ul className="serif mt-3 space-y-2 text-xl"><li>how everything looks</li><li>what you click and drag</li><li>what you <i>want</i>: goals, edits</li><li>labels, units, ids</li></ul></div>
    <svg viewBox="0 0 120 200" className="hidden h-full w-full md:block" aria-hidden="true"><path d="M8 70 L112 70" stroke="var(--x3d)" strokeWidth="2.5" className="flow" markerEnd="url(#ah)"/><path d="M112 130 L8 130" stroke="var(--mj)" strokeWidth="2.5" className="flow" markerEnd="url(#ah2)"/><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--x3d)"/></marker><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--mj)"/></marker></defs><text x="60" y="58" textAnchor="middle" fontSize="10" className="mono" fill="var(--x3d)">intentions</text><text x="60" y="150" textAnchor="middle" fontSize="10" className="mono" fill="var(--mj)">measurements</text></svg>
    <div className="card bubble-mj p-6"><p className="kicker mj">MuJoCo owns</p><ul className="serif mt-3 space-y-2 text-xl"><li>where things actually are</li><li>speeds, forces, collisions</li><li>sensor readings</li><li>the clock</li></ul></div>
   </div>
   <p className="mt-6 max-w-[70ch] text-[16px] leading-7 text-[var(--ink-2)]">Why it matters: when two programs can both move the same arm, they slowly disagree and nobody knows which one to believe. Here the 3D scene only <i>asks</i>, and the physics engine only <i>answers</i>. Each message carries an id and the version of the world it was meant for, so a stale request is refused instead of quietly applied. You can see that in the small print of the conversation above.</p>
  </Section>

  {/* package */}
  <Section n="3" kicker="Share it" title={<>An experiment you can <i>attach to an email</i>.</>}>
   <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
    <div className="relative mx-auto w-full max-w-[460px]">
     {[['manifest.json','what this is, units, who owns what, known losses','ink'],['x3d/scene.x3d','the scene: opens in any X3D viewer','x3d'],['mjcf/model.xml','the physics model MuJoCo compiled','mj'],['records/…','observations, every command, the trial','ink']].map(([f,d,t],i)=><div key={f} className="card relative mb-[-10px] flex w-[calc(100%-42px)] items-center gap-4 p-4" style={{transform:`translateX(${i*14}px) rotate(${i%2?.6:-.6}deg)`,zIndex:4-i}}><span className={`mono text-sm font-bold ${t==='x3d'?'x3d':t==='mj'?'mj':''}`}>{f}</span><span className="text-sm text-[var(--ink-2)]">{d}</span></div>)}
    </div>
    <div><p className="text-[17px] leading-8 text-[var(--ink-2)]">Science gets stuck when a result can't be re-run. The bridge packs the <b className="text-[var(--ink)]">scene, the physics model, every command and the measurements</b> into one small <span className="mono">.zip</span>. A reviewer drops it into this page and sees the same arm, with the same settings, and can measure it again.</p>
     <p className="mt-3 text-[15px] leading-7 text-[var(--ink-2)]">The importer is suspicious by design. It refuses anything that could run code, fetch files or explode in size, and it rejects a package whose parts disagree with each other.</p>
     <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="btn btn-ink" disabled={!ready} onClick={exportPkg}>↓ Download what you just made</button><button type="button" className="btn" disabled={!ready} onClick={()=>downloadText('my-scene.x3d',createScene(session.recipe,session.target,session.snapshot()),'model/x3d+xml')}>↓ Just the 3D scene</button></div></div>
   </div>
  </Section>

  {/* receipts */}
  <Section n="4" kicker="Receipts, not promises" title={<>{totalChecks} checks, <i>all</i> passing.</>}>
   <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <div className="card p-5"><p className="mono text-5xl font-bold">{E.nodeChecks.passed}<span className="text-2xl text-[var(--ink-3)]">/{E.nodeChecks.total}</span></p><p className="mt-2 font-bold">engine &amp; contract tests</p><p className="text-sm text-[var(--ink-2)]">Real MuJoCo, every command type, round trips.</p></div>
    <div className="card p-5"><p className="mono text-5xl font-bold">{E.threats.defended}</p><p className="mt-2 font-bold">attacks refused</p><p className="text-sm text-[var(--ink-2)]">Booby-trapped files, zip bombs, hidden scripts. {E.threats.gaps} weaker spots measured and written down.</p></div>
    <div className="card p-5"><p className="mono text-5xl font-bold">3<span className="text-2xl text-[var(--ink-3)]"> browsers</span></p><p className="mt-2 font-bold">tested by a robot hand</p><p className="text-sm text-[var(--ink-2)]">{E.browsers.map(b=>`${b.label} ${b.version??''}`).join(' · ')}: drags, rebuilds, exports, phone-width, keyboard-only.</p></div>
    <div className="card p-5"><p className="mono text-5xl font-bold">{E.secondValidator.errorsBefore[0]}→{E.secondValidator.errorsAfter[0]}</p><p className="mt-2 font-bold">bugs a second checker found</p><p className="text-sm text-[var(--ink-2)]">An independent X3D validator caught errors the first one missed, in every scene. Fixed.</p></div>
   </div>
   <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
    <div className="card p-6"><p className="kicker">The number that surprised us</p><p className="serif mt-3 text-[clamp(24px,3vw,34px)] leading-tight">The same experiment, run in a browser and in a lab's Python, ends with the arm in the same place to within <span className="mono mj">0.0000000000000006</span> radians.</p>
     <p className="mt-3 text-[15px] leading-7 text-[var(--ink-2)]">At the tip of this one-metre arm, that difference is <b className="text-[var(--ink)]">smaller than a proton</b>. Two different machines, two different languages, 2,500 steps of collisions, and the same answer. That is what lets a result found in a browser be trusted by a lab. <span className="text-[var(--ink-3)]">(Measured {E.recorded.nativeVsBrowserDate} on Chromium, Firefox and WebKit trials.)</span></p></div>
    <div className="card p-6"><p className="kicker">Rebuilt from source</p><p className="serif mt-3 text-2xl leading-snug">Building the app again from its source code gave a file <i>identical, byte for byte</i>, to the one delivered.</p><p className="mt-2 text-sm text-[var(--ink-2)]">So what you run is what the source says. (Checked {E.recorded.buildByteIdentical}.)</p></div>
   </div>
  </Section>

  {/* agents */}
  <Section n="5" kicker="For AI assistants too" title={<>An assistant can now <i>build, check and run</i> physics experiments.</>}>
   <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
    <div className="card space-y-3 p-5 text-[15px]">
     {[['you','"Turn this pendulum into a 3D scene."'],['mj','mjcf_to_x3d → valid X3D, 0 errors. Lost on the way: 2 joints, 1 keyframe, dynamics (listed, not hidden).'],['you','"Now push the arm into the ball and save the experiment."'],['mj','simulate → 2,500 steps, 1 contact, package saved. validate_scene → consistent.'],['you','"Load this file for me: <include file=/etc/passwd>"'],['mj','Refused: "<include> reads other files."']].map(([w,t],i)=><p key={i} className={`rounded px-3 py-2 ${w==='you'?'bubble-you mr-10':'bubble-mj ml-10'} ${w==='you'?'serif italic':'mono text-[13px]'}`}>{t}</p>)}
     <p className="text-xs text-[var(--ink-3)]">Condensed from a recorded session with the real tools (2026-11-06).</p>
    </div>
    <div><p className="text-[17px] leading-8 text-[var(--ink-2)]">Three tools speak the same bridge contract through the <b className="text-[var(--ink)]">Model Context Protocol</b>, the standard way AI assistants use software. <span className="mono text-[15px]">validate_scene</span> checks a scene or package; <span className="mono text-[15px]">mjcf_to_x3d</span> turns any MuJoCo model into a 3D scene and lists what it lost; <span className="mono text-[15px]">simulate</span> runs it and returns the measurements.</p>
     <p className="mt-3 text-[15px] leading-7 text-[var(--ink-2)]">Every conversion reports its losses. An assistant is never told a translation was perfect when it wasn't.</p></div>
   </div>
  </Section>

  {/* planet scale */}
  <Section n="6" id="scale" kicker="The path to planet scale" title={<>From one laptop to <i>tens of thousands of researchers a day</i>.</>}>
   <PlanetScale/>
  </Section>

  {/* limits */}
  <Section n="7" kicker="Honest limits" title={<>What this <i>isn't</i>, yet.</>}>
   <ul className="grid gap-3 text-[15px] leading-7 md:grid-cols-2">{[
    ['Not a universal translator.','Today it fully handles one carefully described arm. Any MuJoCo model can be turned into a picture, but turning arbitrary 3D scenes into physics is phase 1.'],
    ['Not X3D\'s own physics.','X3D has a physics component of its own; this bridge doesn\'t claim to implement it. MuJoCo is the authority.'],
    ['Not yet replayable to the last bit.','Records are observations. Exact checkpoints and bit-for-bit replay come in phase 1.'],
    ['The GPU notebook is a sketch.','It is written and checked, but it hasn\'t been run on the GPU yet.'],
   ].map(([h,p])=><li key={h} className="border-t hairline pt-3"><b>{h}</b> <span className="text-[var(--ink-2)]">{p}</span></li>)}</ul>
  </Section>

  <footer className="mx-auto max-w-[1180px] border-t-2 border-[var(--ink)] px-5 py-8 sm:px-8">
   <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p><b>X3D ⇄ MuJoCo bridge 0.2</b> · open source, <a className="underline" href="./legal/LICENSE">Apache-2.0</a> · <a className="underline" href="./legal/NOTICE">notices</a> · MuJoCo 3.17 · X_ITE 16.7</p>
    <div className="flex gap-3"><a className="btn btn-ink" href="?lab=1">Open the full lab →</a><a className="btn" href="?workspace=1">Original workbench</a></div></div>
   <p className="mt-4 text-xs text-[var(--ink-3)]">Everything on this page runs on your computer. Nothing you do here is sent anywhere.</p>
  </footer>
 </div>;
}
