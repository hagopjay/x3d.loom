import { useEffect, useRef } from "react";
import type { LogLine } from "../mujoco/engine";

const KIND: Record<string, string> = {
  info: "text-slate-400",
  ok: "text-emerald-300",
  warn: "text-amber-300",
  error: "text-rose-400",
};

export default function Console({ logs }: { logs: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const t0 = logs.length ? logs[0].t : 0;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);
  return (
    <div ref={ref} className="h-full min-h-0 overflow-auto px-3 py-2 font-mono text-[11px] leading-5">
      {logs.length === 0 && <div className="text-slate-600">console — engine and compile messages appear here…</div>}
      {logs.map((l, i) => (
        <div key={i} className={KIND[l.kind] ?? "text-slate-400"}>
          <span className="mr-2 text-slate-600">[{((l.t - t0) / 1000).toFixed(3).padStart(7)}s]</span>
          {l.text}
        </div>
      ))}
    </div>
  );
}
