import { useEffect, useRef, useState } from "react";
import type { MuJoCoEngine } from "../mujoco/engine";
import { Viewer3D, type ViewOpts } from "../mujoco/viewer";
import { Btn, Card } from "./ui";

interface Status {
  time: number;
  fps: number;
  ncon: number;
  warnings: string[];
  physicsMs:number; renderMs:number; ratio:number; steps:number; dropped:number; calls:number; triangles:number; geometries:number; unsupported:string[];
}

export default function ViewerPanel({
  engine,
  modelVersion,
  running,
  setRunning,
  speed,
  setSpeed,
  onReset,
}: {
  engine: MuJoCoEngine;
  modelVersion: number;
  running: boolean;
  setRunning: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  onReset: (key: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer3D | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [opts, setOpts] = useState<ViewOpts>({ contacts: true, jointAxes: true, sites: false, grid: true });
  const [status, setStatus] = useState<Status>({ time: 0, fps: 0, ncon: 0, warnings: [], physicsMs:0, renderMs:0, ratio:0, steps:0, dropped:0, calls:0, triangles:0, geometries:0, unsupported:[] });
  const [keySel, setKeySel] = useState(-1);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const runningRef = useRef(running);
  runningRef.current = running;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const engineReady = engine.status === "ready";

  // create the three.js viewer once the engine is up
  useEffect(() => {
    if (!engineReady || !containerRef.current || viewerRef.current) return;
    try {
      const v = new Viewer3D(containerRef.current);
      viewerRef.current = v;
      if (engine.ready) {v.rebuild(engine);v.frameModel(engine);}
      setViewError(null);
    } catch (e: any) {
      setViewError(e?.message ?? String(e));
    }
    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady]);

  // rebuild meshes when a new model is compiled
  useEffect(() => {
    if (viewerRef.current && engine.ready) { viewerRef.current.rebuild(engine); viewerRef.current.frameModel(engine); }
    setKeySel(-1);
  }, [engine, modelVersion]);

  // main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let fpsT = last;
    let physicsMs=0, renderMs=0, steps=0, simSeconds=0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      last = now;
      const e = engine;
      if (!e.ready) return;
      e.running = runningRef.current;
      e.speed = speedRef.current;
      const physicsStart=performance.now();
      const before=Number(e.data.time);
      steps += e.advance(dt);
      simSeconds += Math.max(0,Number(e.data.time)-before);
      physicsMs += performance.now()-physicsStart;
      e.sampleTelemetry();
      const v = viewerRef.current;
      const renderStart=performance.now();
      if (v && containerRef.current?.clientWidth) {
        v.sync(e, optsRef.current);
        v.render();
      }
      renderMs += performance.now()-renderStart;
      frames++;
      if (now - fpsT > 400) {
        setStatus({
          time: e.data.time as number,
          fps: Math.round((frames * 1000) / (now - fpsT)),
          ncon: e.data.ncon as number,
          warnings: e.warnings(),
          physicsMs:physicsMs/frames, renderMs:renderMs/frames, ratio:simSeconds/((now-fpsT)/1000), steps, dropped:e.droppedSeconds,
          calls:v?.stats().calls??0, triangles:v?.stats().triangles??0, geometries:v?.stats().geometries??0, unsupported:v?.unsupported??[],
        });
        physicsMs=0; renderMs=0; steps=0; simSeconds=0;
        frames = 0;
        fpsT = now;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const keys = engine.ready ? engine.listKeyframes() : [];

  return (
    <Card
      className="h-[54vh] min-h-[380px]"
      title={
        <span className="flex items-center gap-2">
          3D viewport
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-slate-400">
            {engine.ready ? (engine.xml.match(/model="([^"]+)"/)?.[1] ?? "model") : "…"}
          </span>
        </span>
      }
      actions={
        <>
          <Btn variant={running ? "default" : "primary"} onClick={() => setRunning(!running)} title={running ? "Pause" : "Play"}>
            {running ? "❚❚ Pause" : "▶ Play"}
          </Btn>
          <Btn disabled={!engine.ready} onClick={() => { setRunning(false); engine.running = false; engine.step(1); engine.sampleTelemetry(); }} title="Pause and advance one physics step">
            ⏭ Step
          </Btn>
          <select
            className="max-w-[110px] !py-1 text-xs"
            value={keySel}
            title="Reset state (keyframe or qpos0)"
            onChange={(e) => {
              const k = Number(e.target.value);
              setKeySel(k);
              onReset(k);
            }}
          >
            <option value={-1}>reset: qpos0</option>
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                key: {k.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            speed
            <input
              type="range"
              min={0.1}
              max={4}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-20"
            />
            <span className="w-8 font-mono text-slate-300">{speed.toFixed(1)}×</span>
          </label>
          <Btn onClick={() => {if(engine.ready)viewerRef.current?.frameModel(engine);}}>Fit</Btn>
          <select aria-label="Render quality" defaultValue="balanced" className="!text-xs" onChange={e=>viewerRef.current?.setQuality(e.target.value)}><option value="low">Fast</option><option value="balanced">Balanced</option><option value="high">High</option></select>
          <span className="mx-1 h-4 w-px bg-slate-700" />
          {(["iso", "top", "front", "side"] as const).map((v) => (
            <Btn key={v} variant="ghost" className="!px-2 !py-1 !text-[11px]" onClick={() => viewerRef.current?.setView(v)}>
              {v}
            </Btn>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-700" />
          {(
            [
              ["contacts", "contacts"],
              ["jointAxes", "axes"],
              ["sites", "sites"],
              ["grid", "grid"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOpts((o) => ({ ...o, [k]: !o[k] }))}
              className={`rounded border px-1.5 py-1 text-[11px] ${
                opts[k] ? "border-sky-500/60 bg-sky-500/15 text-sky-300" : "border-slate-700 bg-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </>
      }
    >
      <div className="relative h-full min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {viewError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-6 text-center text-sm text-rose-300">
            WebGL unavailable: {viewError}
          </div>
        )}
        {!engine.ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-6 text-center text-sm text-slate-400">
            {engine.status === "loading" ? "loading MuJoCo WASM…" : `engine error: ${engine.errorMsg}`}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800/80 bg-slate-950/70 px-3 py-1.5 font-mono text-[11px] text-slate-400">
          <span>
            t = <span className="text-sky-300">{status.time.toFixed(3)} s</span>
          </span>
          <span>{status.fps} fps</span>
          <span title="Average CPU time in the physics advance per display frame">physics {status.physicsMs.toFixed(2)} ms</span>
          <span title="CPU render submission time; not GPU timing">render CPU {status.renderMs.toFixed(2)} ms</span>
          <span>sim/wall {status.ratio.toFixed(2)}×</span>
          <span title="Simulation time omitted by bounded catch-up">dropped {status.dropped.toFixed(3)} s</span>
          <span title="Current WebGL resource counts">{status.calls} draws · {status.triangles.toLocaleString()} tris · {status.geometries} geometries</span>
          {status.unsupported.length>0&&<span className="text-amber-300">{status.unsupported.length} unsupported geoms (pink placeholders)</span>}
          <span>
            ncon = <span className="text-rose-300">{status.ncon}</span>
          </span>
          {status.warnings.length > 0 && <span className="text-amber-300">⚠ {status.warnings.join(", ")}</span>}
          <span className="ml-auto text-slate-600">drag to orbit · wheel to zoom · right-drag to pan</span>
        </div>
      </div>
    </Card>
  );
}
