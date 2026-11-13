import ControlLab from './ControlLab';
import { useEffect, useState } from "react";
import type { MuJoCoEngine, LogLine } from "../mujoco/engine";
import { PRESETS, type Preset } from "../data/presets";
import CodeEditor from "./CodeEditor";
import Console from "./Console";
import ViewerPanel from "./ViewerPanel";
import Telemetry from "./Telemetry";
import Inspector from "./Inspector";
import { Btn, Card } from "./ui";

export default function Playground({
  engine,
  xml,
  setXml,
  presetId,
  onApply,
  onPreset,
  onReset,
  error,
  logs,
  modelVersion,
  running,
  setRunning,
  speed,
  setSpeed,
}: {
  engine: MuJoCoEngine;
  xml: string;
  setXml: (v: string) => void;
  presetId: string;
  onApply: () => void;
  onPreset: (id: string) => void;
  onReset: (key: number) => void;
  error: string | null;
  logs: LogLine[];
  modelVersion: number;
  running: boolean;
  setRunning: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
}) {
  const [bottomTab, setBottomTab] = useState<"telemetry" | "inspector" | "console">("telemetry");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const preset: Preset | undefined = PRESETS.find((p) => p.id === presetId);

  return (
    <>
    <ControlLab engine={engine} modelVersion={modelVersion} setRunning={setRunning} draftPending={engine.ready && xml !== engine.xml} />
    <div className="grid gap-3 lg:grid-cols-12">
      {/* left: editor + console */}
      <div className="flex min-h-[540px] flex-col gap-3 lg:col-span-5">
        <Card
          className="min-h-[380px] flex-1"
          title="MJCF editor"
          actions={
            <>
              <select
                aria-label="Starter model"
                className="max-w-[150px] !py-1 text-xs"
                value={presetId}
                onChange={(e) => onPreset(e.target.value)}
                title="Load a starter model"
              >
                {presetId === "custom" && <option value="custom" disabled>Custom / edited model</option>}
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Btn disabled={engine.status !== "ready"} variant="primary" onClick={onApply} title="Compile the XML and run (Ctrl/Cmd+Enter)">
                ▶ Apply &amp; run
              </Btn>
              <Btn onClick={() => onReset(-1)} title="mj_resetData">
                ⟲ Reset
              </Btn>
            </>
          }
        >
          <div className="flex h-full min-h-0 flex-col">
            {preset && (
              <div className="border-b border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] leading-5 text-slate-400">
                <span className="font-semibold text-slate-300">{preset.name}</span> — {preset.blurb}{" "}
                <span className="text-slate-600">[{preset.tags.join(" · ")}]</span>
              </div>
            )}
            {error && (
              <div className="max-h-28 overflow-auto border-b border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] leading-5 text-rose-300">
                {error}
              </div>
            )}
            <div className="min-h-0 flex-1">
              <CodeEditor
                value={xml}
                onChange={setXml}
                onRun={onApply}
                placeholder={"<mujoco>…</mujoco>"}
              />
            </div>
            <div className="border-t border-slate-800 px-3 py-1 text-[10px] text-slate-600">
              Ctrl/⌘+Enter to compile &amp; run · Tab indents · broken XML is reported with the compiler error
            </div>
          </div>
        </Card>
        <Card title="Console" className="h-36 shrink-0">
          <Console logs={logs} />
        </Card>
      </div>

      {/* right: viewport + bottom panel */}
      <div className="flex flex-col gap-3 lg:col-span-7">
        <ViewerPanel
          engine={engine}
          modelVersion={modelVersion}
          running={running}
          setRunning={setRunning}
          speed={speed}
          setSpeed={setSpeed}
          onReset={onReset}
        />
        <div className="flex h-[300px] min-h-0 flex-col">
          <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/90 px-2 py-1.5">
            {(
              [
                ["telemetry", "Telemetry"],
                ["inspector", "Inspector"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBottomTab(id)}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                  bottomTab === id ? "bg-sky-500/20 text-sky-300" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto px-2 text-[10px] text-slate-600">reads live from mjModel / mjData typed arrays</span>
          </div>
          <div className="min-h-0 flex-1">
            {bottomTab === "telemetry" && <Telemetry engine={engine} modelVersion={modelVersion} />}
            {bottomTab === "inspector" && <Inspector engine={engine} modelVersion={modelVersion} tick={tick} />}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
