import { useEffect, useRef, useState } from 'react';
import type { MuJoCoEngine } from '../mujoco/engine';
import { attachControl, DEFAULT_CONTROL, disturbCartpole, supportsFeedback, isArm, isCartpole, type ControlSettings } from '../mujoco/controllers';
import { compatibleTrials, measureTrial, trialCsv, type Trial } from '../mujoco/trials';
import { downloadText } from '../utils/experiment';
import { Btn } from './ui';

export default function ControlLab({ engine, modelVersion, setRunning, draftPending }: { engine:MuJoCoEngine; modelVersion:number; setRunning:(v:boolean)=>void; draftPending:boolean }) {
  const [settings,setSettings]=useState<ControlSettings>(structuredClone(DEFAULT_CONTROL));
  const [run,setRun]=useState<Trial|null>(null); const [baseline,setBaseline]=useState<Trial|null>(null);
  const [busy,setBusy]=useState(false); const [progress,setProgress]=useState(0); const [message,setMessage]=useState('');
  const [signal,setSignal]=useState(''); const abort=useRef<AbortController|null>(null);
  const settingsRef=useRef(settings); settingsRef.current=settings;
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{
    abort.current?.abort();
    if(!engine.ready) return;
    const next:ControlSettings=engine.controlRecord ?? {...structuredClone(DEFAULT_CONTROL),mode:supportsFeedback(engine)?'feedback':'off',manual:Array(engine.model.nu).fill(0)};
    if(isArm(engine)) engine.reset(engine.listKeyframes().find(k=>k.name==='home')?.id??-1);
    attachControl(engine,next); setSettings(next); setRun(null); setMessage('');
    setSignal(engine.series[0]?.id??'');
  },[engine,modelVersion]);
  useEffect(()=>engine.on('reset',()=>{ if(engine.ready) attachControl(engine,settingsRef.current); }),[engine]);
  const update=(c:ControlSettings)=>{ try {attachControl(engine,c);setSettings(c);setMessage('');} catch(e){setMessage(String(e));} };
  const arm=engine.ready&&isArm(engine), cart=engine.ready&&isCartpole(engine);
  const actuators=engine.ready?engine.listActuators():[];
  const measure=async()=>{
    setRunning(false); engine.running=false; setBusy(true);setProgress(0);setMessage('');
    const controller=new AbortController(); abort.current=controller;
    try {setRun(await measureTrial(engine,settings,controller.signal,setProgress));setMessage('5 s trial complete. The workspace state was preserved.');}
    catch(e){setMessage(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);abort.current=null;}
  };
  const index=run?.columns.findIndex(c=>c.id===signal)??-1;
  const comparable=!!run&&!!baseline&&compatibleTrials(run,baseline);
  const values=index>=0?run!.samples.map(s=>s.v[index]).filter(Number.isFinite):[];
  const old=comparable&&index>=0?baseline!.samples.map(s=>s.v[index]).filter(Number.isFinite):[];
  const low=Math.min(0,...values,...old),high=Math.max(1e-6,...values,...old);
  const path=(data:Trial)=>data.samples.map((s,i)=>`${i?'L':'M'}${(40+s.t/data.duration*710).toFixed(2)},${(155-(s.v[index]-low)/(high-low)*130).toFixed(2)}`).join(' ');
  const peak=values.length?Math.max(...values.map(Math.abs)):0;
  const rmse=comparable&&index>=0?Math.sqrt(run!.samples.reduce((sum,s,i)=>sum+(s.v[index]-baseline!.samples[i].v[index])**2,0)/run!.samples.length):null;
  return <section aria-label="Control and measurement lab" className="mb-3 rounded-xl border border-cyan-300/20 bg-gradient-to-r from-cyan-950/35 to-slate-900/70 p-4">
    <div className="flex flex-wrap items-center gap-3">
      <div className="mr-auto"><p className="font-mono text-[9px] tracking-[.2em] text-cyan-300">CONTROL / MEASURE / COMPARE</p><p className="mt-1 text-xs text-slate-400">{arm?'Reach, then press: target angles command the arm against the orange obstacle.':cart?'Test local recovery: enable feedback, then add a pole disturbance.':'Observe passive dynamics, or command available actuators manually.'}</p></div>
      <label className="text-xs text-slate-300">Controller <select aria-label="Controller mode" className="ml-2 !text-xs" disabled={!engine.ready||busy} value={settings.mode} onChange={e=>update({...settings,mode:e.target.value as ControlSettings['mode']})}><option value="off">Off / zero input</option>{actuators.length>0&&<option value="manual">Manual</option>}{supportsFeedback(engine)&&<option value="feedback">Feedback</option>}</select></label>
      <Btn disabled={!engine.ready||busy} onClick={()=>{engine.reset(arm?engine.listKeyframes().find(k=>k.name==='home')?.id??-1:-1);if(cart&&supportsFeedback(engine))disturbCartpole(engine);attachControl(engine,settings);setRunning(true);}}>Restart experiment</Btn>
      {cart&&supportsFeedback(engine)&&<Btn disabled={busy} onClick={()=>disturbCartpole(engine)}>Disturb +0.08 rad</Btn>}
      <Btn variant="primary" disabled={!engine.ready||draftPending||busy} onClick={measure}>{busy?`Measuring ${Math.round(progress*100)}%`:'Measure 5 s'}</Btn>
      {busy&&<Btn onClick={()=>abort.current?.abort()}>Cancel trial</Btn>}
    </div>
    {settings.mode==='feedback'&&arm&&<div className="mt-3 flex flex-wrap gap-5">{['Shoulder','Elbow'].map((name,i)=><label key={name} className="flex items-center gap-2 text-xs text-slate-300">{name} target <input aria-label={`${name} target`} disabled={busy} type="range" min={-1.8} max={1.8} step={0.01} value={settings.target[i]} onChange={e=>{const target=[...settings.target] as [number,number];target[i]=Number(e.target.value);update({...settings,target});}}/><span className="w-16 font-mono">{settings.target[i].toFixed(2)} rad</span></label>)}</div>}
    {settings.mode==='manual'&&<div className="mt-3 flex flex-wrap gap-4">{actuators.map((a,i)=><label key={a.id} className="flex items-center gap-2 text-xs text-slate-300">{a.name}<input aria-label={`Control ${a.name}`} disabled={busy} type="range" min={a.ctrllimited?a.ctrlrange[0]:-1} max={a.ctrllimited?a.ctrlrange[1]:1} step="0.01" value={settings.manual[i]??0} onChange={e=>{const manual=[...settings.manual];manual[i]=Number(e.target.value);update({...settings,manual});}}/><span className="font-mono">{(settings.manual[i]??0).toFixed(2)}</span></label>)}</div>}
    <p className="mt-2 text-[10px] leading-5 text-slate-500">Trials use an independent simulation, reset to {arm?'home':'qpos0'}{cart?' + 0.08 rad tilt':''}, and sample every physics tick. Changes to source, options or controller require a new trial. Feedback gains target the bundled models.</p>
    {message&&<p role="status" className="mt-2 text-xs text-lime-200">{message}</p>}
    {run&&<div className="mt-4 border-t border-slate-700/60 pt-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400"><strong className="mr-auto text-cyan-200">MEASURED RUN · {run.metrics.steps.toLocaleString()} ticks · {run.duration.toFixed(3)} s · {run.controller.mode}</strong><Btn onClick={()=>setBaseline(structuredClone(run))}>Pin as baseline</Btn>{baseline&&<Btn onClick={()=>setBaseline(null)}>Clear baseline</Btn>}<Btn onClick={()=>downloadText('measured-trial.json',JSON.stringify({run,baseline},null,2),'application/json')}>Trial JSON ↓</Btn><Btn onClick={()=>downloadText('measured-trial.csv',trialCsv(run),'text/csv')}>Trial CSV ↓</Btn></div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-slate-300"><span>Peak contacts: {run.metrics.peakContacts}</span><span>Peak |ctrl| / range: {(run.metrics.peakControlFraction*100).toFixed(1)}%</span><span>Finite state: {run.metrics.finite?'yes':'no'}</span><span>dt: {run.timestep} s</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-3"><select aria-label="Measured signal" className="max-w-full !text-xs" value={signal} onChange={e=>setSignal(e.target.value)}>{run.columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><span className="text-[10px] text-cyan-300">Cyan: current · peak absolute value {peak.toFixed(4)}</span>{baseline&&<span className="text-[10px] text-amber-300">{comparable?`Amber: baseline · RMSE ${rmse?.toFixed(5)}`:'Baseline incompatible: engine, timestep or signal layout changed.'}</span>}</div>
      {index>=0&&<svg role="img" aria-label="Measured trajectory comparison" viewBox="0 0 800 190" className="mt-2 h-44 w-full rounded-lg bg-slate-950/60"><path d="M40 20 V155 H750" stroke="#334155" fill="none"/>{[0,1,2,3,4,5].map(t=><text key={t} x={40+t/5*710} y="178" fill="#64748b" fontSize="10">{t}s</text>)}<text x="3" y="25" fill="#64748b" fontSize="10">{high.toFixed(2)}</text><text x="3" y="155" fill="#64748b" fontSize="10">{low.toFixed(2)}</text>{comparable&&<path d={path(baseline!)} fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 4"/>}<path d={path(run)} fill="none" stroke="#67e8f9" strokeWidth="1.7"/></svg>}
      <p className="text-[10px] leading-5 text-slate-500">The chart shows this saved trial, not the live telemetry below. Comparison requires matching engine, timestep and signal layout; XML, options and start states are retained in JSON. This is a measured experiment record, not a full replay checkpoint.</p>
    </div>}
  </section>;
}
