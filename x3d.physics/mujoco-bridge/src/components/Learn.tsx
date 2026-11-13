import { useState } from "react";
import { LESSONS, type Lesson, type Block } from "../data/lessons";
import { Badge, Card, Inline } from "./ui";

const LEVEL_TONE: Record<string, string> = {
  Beginner: "green",
  Intermediate: "amber",
  Advanced: "violet",
};

export default function Learn({ onTry }: { onTry: (l: Lesson) => void }) {
  const [sel, setSel] = useState(LESSONS[0].id);
  const lesson = LESSONS.find((l) => l.id === sel) ?? LESSONS[0];
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Card title="Curriculum" className="lg:col-span-4 xl:col-span-3" bodyClassName="overflow-auto">
        <div className="flex flex-col p-2">
          {LESSONS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSel(l.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${
                l.id === sel
                  ? "border-sky-500/60 bg-sky-500/10"
                  : "border-transparent hover:border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[13px] font-semibold text-slate-100">{l.title}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-5">
                <Badge tone={LEVEL_TONE[l.level] ?? "slate"}>{l.level}</Badge>
                <span className="text-[10px] text-slate-500">{l.minutes} min</span>
              </div>
            </button>
          ))}
        </div>
      </Card>
      <Card className="lg:col-span-8 xl:col-span-9" title={lesson.title} bodyClassName="overflow-auto">
        <div className="max-w-3xl space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LEVEL_TONE[lesson.level] ?? "slate"}>{lesson.level}</Badge>
            <Badge tone="sky">{lesson.minutes} min read</Badge>
            <span className="text-sm text-slate-400">{lesson.summary}</span>
          </div>
          {lesson.blocks.map((b, i) => (
            <BlockView key={i} b={b} />
          ))}
          {(lesson.tryPreset || lesson.tryXml) && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onTry(lesson)}
                className="rounded-lg border border-sky-500/60 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/25"
              >
                ⚡ {lesson.tryLabel ?? "Try it in the playground"}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.t === "h") return <h3 className="pt-2 text-lg font-bold text-slate-100">{b.text}</h3>;
  if (b.t === "p") return <p className="text-sm leading-7 text-slate-300"><Inline text={b.text} /></p>;
  if (b.t === "ul")
    return (
      <ul className="list-disc space-y-1.5 pl-6 text-sm leading-6 text-slate-300">
        {b.items.map((it, i) => (
          <li key={i}><Inline text={it} /></li>
        ))}
      </ul>
    );
  if (b.t === "code")
    return (
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-900 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">{b.lang}</div>
        <pre className="overflow-auto bg-[#0a0f1e] p-3 font-mono text-[12px] leading-5 text-slate-200">{b.code}</pre>
      </div>
    );
  const styles =
    b.kind === "tip"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : b.kind === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-sky-500/40 bg-sky-500/10 text-sky-200";
  const icon = b.kind === "tip" ? "💡" : b.kind === "warn" ? "⚠️" : "ℹ️";
  return (
    <div className={`rounded-lg border p-3 text-sm leading-6 ${styles}`}>
      {icon} <Inline text={b.text} />
    </div>
  );
}
