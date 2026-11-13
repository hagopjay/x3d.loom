import CommandPalette from './components/CommandPalette';
import KnowledgeCheck from './components/KnowledgeCheck';
import { useCallback, useEffect, useRef, useState } from "react";
import { MuJoCoEngine, type LogLine } from "./mujoco/engine";
import { PRESETS } from "./data/presets";
import { LESSONS, type Lesson } from "./data/lessons";
import { CHALLENGES, type Challenge } from "./data/challenges";
import Playground from "./components/Playground";
import Learn from "./components/Learn";
import Challenges from "./components/Challenges";
import ReferenceView from "./components/ReferenceView";
import ExperimentDeck from "./components/ExperimentDeck";
import { Badge, Btn, Logo } from "./components/ui";
import { downloadText, fileStem, observationPacket, telemetryCsv } from "./utils/experiment";

type Tab = "playground" | "experiments" | "learn" | "challenges" | "reference";
const START = PRESETS.find(p => p.id === "contact-arm") ?? PRESETS[0];
const DRAFT_KEY = "mujoco-observatory.draft.v1";
const NOTE_KEY = "mujoco-observatory.note.v1";
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "playground", label: "Workspace", hint: "Author, simulate, inspect, and export" },
  { id: "experiments", label: "Field guide", hint: "Three core labs and two extension protocols" },
  { id: "learn", label: "Learn", hint: `${LESSONS.length} guided lessons` },
  { id: "challenges", label: "Challenges", hint: `${CHALLENGES.length} checks on independent simulations` },
  { id: "reference", label: "Reference", hint: "MJCF / mjModel / mjData" },
];
function stored(key: string, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export default function App() {
  const [engine] = useState(() => new MuJoCoEngine());
  const [status, setStatus] = useState(engine.status);
  const [tab, setTab] = useState<Tab>("playground");
  const [xml, setXml] = useState(() => stored(DRAFT_KEY, START.xml));
  const [presetId, setPresetId] = useState(() => PRESETS.find(p => p.xml === stored(DRAFT_KEY, START.xml))?.id ?? "custom");
  const initialXml = useRef(xml);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [modelVersion, setModelVersion] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [note, setNote] = useState(() => stored(NOTE_KEY));
  const [notice, setNotice] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const offStatus = engine.on("status", () => setStatus(engine.status));
    const offLog = engine.on("log", () => setLogs([...engine.logs]));
    const offModel = engine.on("model", () => { setModelVersion(v => v + 1); setError(null); });
    engine.init().then(() => {
      if (cancelled || engine.status !== "ready" || engine.ready) return;
      try { engine.loadXML(initialXml.current); }
      catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        engine.log("error", message);
        // Keep an invalid saved draft visible while bringing up a known working scene.
        try { engine.loadXML(START.xml); setError(message); } catch { /* engine banner reports failure */ }
      }
    });
    return () => { cancelled = true; offStatus(); offLog(); offModel(); };
  }, [engine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, xml); localStorage.setItem(NOTE_KEY, note); setDraftSaved(true); }
      catch { setDraftSaved(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [xml, note]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  const applyXml = useCallback((source: string, pid?: string) => {
    try {
      engine.loadXML(source);
      setXml(source);
      setPresetId(pid ?? PRESETS.find(p => p.xml === source)?.id ?? "custom");
      setError(null);
      setRunning(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      engine.log("error", message);
    }
  }, [engine]);

  const editXml = useCallback((source: string) => {
    setXml(source); setDraftSaved(false);
    setPresetId(PRESETS.find(p => p.xml === source)?.id ?? "custom");
  }, []);
  const loadPreset = useCallback((id: string) => {
    const preset = PRESETS.find(p => p.id === id);
    if (preset) applyXml(preset.xml, preset.id);
  }, [applyXml]);
  const reset = useCallback((key = -1) => engine.reset(key), [engine]);
  const tryLesson = useCallback((lesson: Lesson) => {
    if (lesson.tryPreset) loadPreset(lesson.tryPreset);
    else if (lesson.tryXml) applyXml(lesson.tryXml);
    setTab("playground");
  }, [applyXml, loadPreset]);
  const loadChallenge = useCallback((challenge: Challenge) => {
    if (challenge.presetId) loadPreset(challenge.presetId);
    else if (challenge.xml) applyXml(challenge.xml);
    setTab("playground");
    engine.log("info", `${challenge.title}: edit and apply, then run its isolated check in Challenges.`);
  }, [applyXml, loadPreset, engine]);
  const exportObservation = () => {
    try {
      downloadText(`${fileStem(engine.xml)}-observation.json`, JSON.stringify(observationPacket(engine, note), null, 2), "application/json");
      setNotice("Observation exported with compiled XML, current settings, named body poses, and the telemetry buffer.");
    } catch (err) { setNotice(String(err)); }
  };
  useEffect(() => { if (tab !== "playground") setRunning(false); }, [tab]);
  const dirty = engine.ready && xml !== engine.xml;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800/80 bg-[#0a101a]/95">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-lime-300/25 bg-lime-300/5 p-2"><Logo className="h-7 w-7" /></div>
            <div><div className="text-base font-semibold tracking-tight text-white">MuJoCo <span className="font-light text-lime-200">Observatory</span></div><div className="mt-0.5 font-mono text-[9px] tracking-[.16em] text-slate-500">EXPERIMENT WORKBENCH 02 / OBSERVE → EXPLAIN</div></div>
          </div>
          <nav className="flex flex-wrap items-center gap-1 lg:ml-6" aria-label="Main navigation">
            {TABS.map(item => <button key={item.id} type="button" onClick={() => setTab(item.id)} title={item.hint} aria-current={tab === item.id ? "page" : undefined} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === item.id ? "bg-lime-300/10 text-lime-200 ring-1 ring-lime-300/25" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{item.label}</button>)}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <CommandPalette commands={[
              ...PRESETS.map(p=>({id:p.id,label:`Load ${p.name}`,hint:'model',run:()=>{loadPreset(p.id);setTab('playground');}})),
              ...TABS.map(t=>({id:t.id,label:t.label,hint:'navigation',run:()=>setTab(t.id)})),
              {id:'pause',label:'Pause simulation',hint:'transport',run:()=>setRunning(false)},
              {id:'play',label:'Play simulation',hint:'transport',run:()=>setRunning(true)},
              {id:'reset',label:'Reset model',hint:'transport',run:()=>reset()},
            ]} />
            {status === "loading" && <Badge tone="amber">Loading physics…</Badge>}
            {status === "ready" && <Badge tone="green">● MuJoCo {engine.version} / WASM</Badge>}
            {status === "error" && <Badge tone="rose">Engine unavailable</Badge>}
            <a href="https://mujoco.readthedocs.io/en/3.17.0/" target="_blank" rel="noreferrer" className="px-2 text-xs text-slate-500 hover:text-slate-200">Docs ↗</a>
          </div>
        </div>
      </header>
      {status === "error" && <div role="alert" className="border-b border-rose-500/40 bg-rose-500/10 px-5 py-3 text-xs text-rose-200">MuJoCo could not start: {engine.errorMsg}. Reload to retry. Lessons and reference remain available.</div>}
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-5 sm:px-5">
        <div hidden={tab !== "playground"}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div><p className="mb-2 font-mono text-[9px] tracking-[.22em] text-lime-300/80">AUTHOR → SIMULATE → OBSERVE → EXPORT</p><h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">Physics, made observable.</h1><p className="mt-2 text-xs leading-5 text-slate-500">Real MJCF compilation. Inspectable state. A recorded path to your next experiment.</p></div>
            <div className="flex gap-6 pb-1 text-right">{[[PRESETS.length,"MODELS"],[LESSONS.length,"LESSONS"],[CHALLENGES.length,"CHECKS"]].map(([value,label]) => <div key={label}><div className="font-mono text-xl text-slate-200">{String(value).padStart(2,"0")}</div><div className="mt-1 font-mono text-[9px] tracking-wider text-slate-600">{label}</div></div>)}</div>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">{[
            {id:'contact-arm',n:'01',title:'Reach & contact',text:'Torque limits · joint targets · contact sensing'},
            {id:'cartpole',n:'02',title:'Recover balance',text:'A real disturbance · bounded feedback'},
            {id:'ball-drop',n:'03',title:'Read the rebound',text:'Free fall · solver response · contact evidence'},
          ].map(p=><button key={p.id} type="button" onClick={()=>loadPreset(p.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${presetId===p.id?'border-cyan-300/40 bg-cyan-300/5':'border-slate-800 bg-slate-900/40 hover:border-slate-600'}`}><span className="font-mono text-2xl font-light text-cyan-200/70">{p.n}</span><span><strong className="block text-xs text-slate-200">{p.title}</strong><span className="mt-1 block text-[10px] text-slate-500">{p.text}</span></span></button>)}</div>
          <section className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/65 p-2.5" aria-label="Experiment files">
            <Btn onClick={() => importRef.current?.click()}>↥ Import MJCF</Btn>
            <input ref={importRef} type="file" accept=".xml,.mjcf,text/xml,application/xml" className="hidden" aria-label="Import MJCF file" onChange={async event => {
              const file = event.target.files?.[0]; if (!file) return;
              try {
                if (file.size > 2_000_000) throw new Error("Use a self-contained MJCF file smaller than 2 MB for this workbench.");
                editXml(await file.text()); setError(null); setNotice(`${file.name} is in the editor. Apply to compile it.`);
              } catch (err) { setNotice(err instanceof Error ? err.message : String(err)); }
              event.target.value = "";
            }} />
            <Btn onClick={() => downloadText(`${fileStem(xml)}.xml`, xml, "application/xml")}>MJCF ↓</Btn>
            <Btn disabled={!engine.ready} onClick={exportObservation}>Observation JSON ↓</Btn>
            <Btn disabled={!engine.ready} onClick={() => { downloadText(`${fileStem(engine.xml)}-telemetry.csv`, telemetryCsv(engine), "text/csv"); setNotice("Current telemetry buffer exported. Use simulation timestamps to align runs."); }}>Telemetry CSV ↓</Btn>
            <span className={`ml-auto px-2 text-[10px] ${dirty ? "text-amber-300" : "text-slate-500"}`}>{dirty ? "Draft differs from the running model — Apply to compile" : engine.ready ? "Editor and compiled source agree" : "Starting engine…"}</span>
            <span className="text-[10px] text-slate-600">{draftSaved ? "draft saved in this browser" : "draft saving unavailable / pending"}</span>
          </section>
          <Playground engine={engine} xml={xml} setXml={editXml} presetId={presetId} onApply={() => applyXml(xml)} onPreset={loadPreset} onReset={reset} error={error} logs={logs} modelVersion={modelVersion} running={running} setRunning={setRunning} speed={speed} setSpeed={setSpeed} />
          <label className="mt-4 block rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3"><span className="block font-mono text-[10px] tracking-wider text-lime-200/80">EXPERIMENT NOTE</span><input aria-label="Experiment note" value={note} onChange={e => {setNote(e.target.value); setDraftSaved(false);}} placeholder="I predict…  I changed…  I observed…  This result does not yet establish…" className="mt-2 w-full !border-0 !bg-transparent !p-0 !text-xs !text-slate-300" /><span className="mt-2 block text-[10px] text-slate-600">Included in the observation JSON. Live inspector settings are recorded separately from the source XML.</span></label>
        </div>
        {tab === "experiments" && <ExperimentDeck onLoad={id => {loadPreset(id); setTab("playground");}} />}
        {tab === "learn" && <><Learn onTry={tryLesson} /><KnowledgeCheck /></>}
        {tab === "challenges" && <Challenges engine={engine} onLoadChallenge={loadChallenge} draftPending={dirty} />}
        {tab === "reference" && <ReferenceView />}
      </main>
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border border-lime-300/30 bg-slate-900 px-5 py-3 text-xs leading-5 text-lime-100 shadow-2xl">{notice}</div>}
      <footer className="border-t border-slate-800/70 px-5 py-3 text-center font-mono text-[9px] leading-5 tracking-wide text-slate-600">MUJOCO OWNS THE PHYSICS · THREE.JS DISPLAYS THE STATE · Z-UP / SI UNITS · CONTROL & CONTACT LAB · EDITION 02</footer>
    </div>
  );
}
