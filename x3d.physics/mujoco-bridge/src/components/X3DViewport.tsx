import {useEffect,useRef,useState} from 'react';
import type {BridgeSession} from '../bridge/session';
import {createScene} from '../bridge/scene';
import {loadXite,XiteAdapter,type BridgeCanvas} from '../bridge/xiteAdapter';
import type {Ack,Envelope} from '../bridge/contract';
export default function X3DViewport({session,revision,send,onSelect}:{session:BridgeSession;revision:number;send:(type:Envelope['type'],payload:unknown,source:'x3d')=>Ack;onSelect:(id:string)=>void}){
 const container=useRef<HTMLDivElement>(null),adapter=useRef<XiteAdapter|null>(null),generation=useRef(0);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('Loading the local X_ITE runtime…');
 const callbacks=useRef({send,onSelect});callbacks.current={send,onSelect};
 useEffect(()=>{
  let cancelled=false;let canvas:BridgeCanvas|null=null;
  (async()=>{try{
   const api=await loadXite();if(cancelled)return;
   await customElements.whenDefined('x3d-canvas');if(cancelled)return;
   canvas=document.createElement('x3d-canvas') as BridgeCanvas;
   canvas.setAttribute('contentScale','1');canvas.setAttribute('update','auto');canvas.setAttribute('splashScreen','false');
   canvas.setAttribute('aria-label','Live X3D authoring scene');canvas.style.cssText='display:block;width:100%;height:100%;';
   container.current?.append(canvas);
   if(!canvas.browser)throw Error('X_ITE could not create a WebGL browser. The authoring contract, exports and MuJoCo remain usable below.');
   adapter.current=new XiteAdapter(api,canvas.browser,()=>session.recipe,(t,p,s)=>callbacks.current.send(t,p,s),id=>callbacks.current.onSelect(id),setStatus);
   setReady(true);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e));}})();
  return()=>{cancelled=true;generation.current++;adapter.current?.dispose();adapter.current=null;canvas?.remove();};
 },[session]);
 useEffect(()=>{
  if(!ready||!adapter.current||!session.engine.ready)return;const g=++generation.current;
  adapter.current.load(createScene(session.recipe,session.target,session.snapshot())).catch(e=>{if(g===generation.current)setError(String(e));});
 },[ready,session,revision]);
 useEffect(()=>{let raf=0;const draw=()=>{raf=requestAnimationFrame(draw);if(adapter.current&&session.engine.ready){try{adapter.current.sync(session.snapshot());}catch(e){setError(String(e));}}};raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);},[session]);
 return <section className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#07131e] shadow-xl shadow-black/20">
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3"><div><span className="text-xs font-semibold tracking-wide text-cyan-200">X3D AUTHORING & OBSERVATION</span><span className="ml-3 text-[10px] text-slate-500">X_ITE 16.7.0 · standard nodes · Y-up</span></div><div className="flex gap-2"><button type="button" className="bridge-button" onClick={()=>adapter.current?.view(false)}>Workshop view</button><button type="button" className="bridge-button" onClick={()=>adapter.current?.view(true)}>Plan view</button></div></div>
  <div className="relative h-[480px] min-h-[300px] sm:h-[520px]"><div ref={container} className="absolute inset-0"/>{error&&<div role="alert" className="absolute inset-0 flex items-center justify-center bg-slate-950/90 p-8 text-center text-sm leading-7 text-amber-200">{error}</div>}<div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-cyan-300/30 bg-slate-950/85 px-3 py-1 text-cyan-200">Cyan sphere: drag a controller goal</span><span className="rounded-full border border-orange-300/30 bg-slate-950/85 px-3 py-1 text-orange-200">Orange sphere: drag to author an obstacle</span><span className="rounded-full border border-slate-700 bg-slate-950/85 px-3 py-1 text-slate-400">Drag links to inspect · background to orbit · wheel to zoom</span></div></div>
  <p role="status" className="border-t border-slate-800 px-4 py-2 text-[10px] leading-5 text-slate-400">{status}</p>
 </section>;
}
