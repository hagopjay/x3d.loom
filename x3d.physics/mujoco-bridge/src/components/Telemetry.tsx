import { useEffect, useRef, useState } from "react";
import type { MuJoCoEngine } from "../mujoco/engine";
import { Card } from "./ui";

export default function Telemetry({ engine, modelVersion }: { engine: MuJoCoEngine; modelVersion: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // default-select the first few series whenever a new model is compiled
  useEffect(() => {
    setSelected(engine.series.slice(0, 4).map((s) => s.id));
  }, [engine, modelVersion]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (w === 0 || h === 0) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a0f1e";
      ctx.fillRect(0, 0, w, h);
      const data = engine.telemetry;
      if (!data.length) {
        ctx.fillStyle = "#475569";
        ctx.font = "12px Inter, sans-serif";
        ctx.fillText("press play — telemetry streams here (qpos / qvel / sensordata / forces / contacts)", 12, 22);
        return;
      }
      const ids = selected
        .map((id) => engine.series.findIndex((s) => s.id === id))
        .filter((i) => i >= 0);
      const t1 = data[data.length - 1].t;
      const t0 = Math.max(data[0].t, t1 - 12);
      let ymin = Infinity;
      let ymax = -Infinity;
      for (const row of data) {
        if (row.t < t0) continue;
        for (const i of ids) {
          const v = row.v[i];
          if (Number.isFinite(v)) {
            if (v < ymin) ymin = v;
            if (v > ymax) ymax = v;
          }
        }
      }
      if (!Number.isFinite(ymin)) {
        ymin = 0;
        ymax = 1;
      }
      if (ymax - ymin < 1e-9) {
        ymin -= 1;
        ymax += 1;
      }
      const pad = (ymax - ymin) * 0.08;
      ymin -= pad;
      ymax += pad;
      const X = (t: number) => 10 + (w - 60) * ((t - t0) / Math.max(1e-6, t1 - t0));
      const Y = (v: number) => h - 20 - (h - 40) * ((v - ymin) / (ymax - ymin));
      ctx.font = "10px 'JetBrains Mono', monospace";
      for (let g = 0; g <= 4; g++) {
        const v = ymin + ((ymax - ymin) * g) / 4;
        const y = Y(v);
        ctx.strokeStyle = "#16213a";
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(w - 10, y);
        ctx.stroke();
        ctx.fillStyle = "#5b6b85";
        ctx.fillText(v.toFixed(2), w - 44, y + 3);
      }
      if (ymin < 0 && ymax > 0) {
        ctx.strokeStyle = "#2b3a55";
        ctx.beginPath();
        const y = Y(0);
        ctx.moveTo(10, y);
        ctx.lineTo(w - 10, y);
        ctx.stroke();
      }
      for (const i of ids) {
        const def = engine.series[i];
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (const row of data) {
          if (row.t < t0) continue;
          const v = row.v[i];
          if (!Number.isFinite(v)) {
            started = false;
            continue;
          }
          const x = X(row.t);
          const y = Y(v);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#5b6b85";
      ctx.fillText(`${t0.toFixed(2)}s`, 10, h - 6);
      ctx.fillText(`${t1.toFixed(2)}s`, w - 56, h - 6);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, selected]);

  return (
    <Card
      className="h-full"
      title="Telemetry (data.* live)"
      actions={
        <span className="text-[11px] text-slate-500">raw values / mixed units · last 12 s</span>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex max-h-24 flex-wrap gap-1 overflow-auto border-b border-slate-800 p-2">
          {engine.series.length === 0 && <span className="px-1 text-xs text-slate-600">no series — load a model</span>}
          {engine.series.map((def) => {
            const on = selected.includes(def.id);
            return (
              <button
                key={def.id}
                type="button"
                onClick={() =>
                  setSelected((s) => (s.includes(def.id) ? s.filter((x) => x !== def.id) : [...s, def.id]))
                }
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                  on ? "border-slate-600 bg-slate-800 text-slate-200" : "border-slate-800 bg-transparent text-slate-600"
                }`}
                title={`${def.group} · ${def.label}`}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: def.color }} />
                {def.label}
              </button>
            );
          })}
        </div>
        <canvas ref={canvasRef} className="min-h-0 w-full flex-1" />
      </div>
    </Card>
  );
}
