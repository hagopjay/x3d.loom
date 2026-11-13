import { useEffect, useRef, useState } from "react";
import { CHALLENGES, validateChallengeModel, type Challenge, type ChallengeResult } from "../data/challenges";
import type { MuJoCoEngine } from "../mujoco/engine";
import { Badge, Btn, Card, Inline } from "./ui";

const DIFF_TONE: Record<string, string> = { Easy: "green", Medium: "amber", Hard: "rose" };

export default function Challenges({
  engine,
  onLoadChallenge,
  draftPending = false,
}: {
  engine: MuJoCoEngine;
  onLoadChallenge: (c: Challenge) => void;
  draftPending?: boolean;
}) {
  const [results, setResults] = useState<Record<string, ChallengeResult | null>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const runCheck = (c: Challenge) => {
    if (checking) return;
    const prerequisite = validateChallengeModel(c, engine);
    if (prerequisite) { setResults(r => ({ ...r, [c.id]: prerequisite })); return; }
    setChecking(c.id);
    setResults((r) => ({ ...r, [c.id]: null }));
    // let the UI paint before the (synchronous) fast-forward
    timerRef.current = setTimeout(() => {
      let trial: MuJoCoEngine | null = null;
      try {
        trial = engine.fork();
        const res = c.verify(trial);
        engine.log(res.pass ? "ok" : "warn", `[${c.title}] ${res.pass ? "PASS" : "not yet"} — ${res.detail}`);
        setResults((r) => ({ ...r, [c.id]: res }));
      } catch (e: any) {
        engine.log("error", `[${c.title}] check failed: ${e?.message ?? String(e)}`);
        setResults((r) => ({ ...r, [c.id]: { pass: false, detail: String(e?.message ?? e) } }));
      } finally {
        trial?.dispose();
        timerRef.current = null;
        setChecking(null);
      }
    }, 30);
  };

  return (
    <section>
      <div className="mb-4 rounded-xl border border-lime-300/20 bg-lime-300/5 p-4 text-xs leading-6 text-slate-300">
        <strong className="text-lime-200">Checks run in an independent simulation.</strong> Each check compiles a copy of the last applied XML, copies live editable options, resets, and measures its stated goal. Your workspace state is preserved. A failed goal is useful experimental evidence.
        {draftPending && <p className="mt-1 text-amber-200">The editor has unapplied changes. Return to Workspace and Apply before testing those changes.</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {CHALLENGES.map((c) => {
        const res = results[c.id];
        return (
          <Card key={c.id} title={c.title} className="min-h-[240px]">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <Badge tone={DIFF_TONE[c.difficulty] ?? "slate"}>{c.difficulty}</Badge>
                {c.autopilot && <Badge tone="violet">ships with autopilot</Badge>}
                {res && <Badge tone={res.pass ? "green" : "rose"}>{res.pass ? "PASSED ✓" : "not yet"}</Badge>}
              </div>
              <p className="text-sm leading-6 text-slate-300">
                <Inline text={c.brief} />
              </p>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs leading-5 text-slate-400">
                <span className="font-semibold text-slate-300">Goal:</span> <Inline text={c.goal} />
              </div>
              <details
                open={!!openHints[c.id]}
                onToggle={(e) => setOpenHints((o) => ({ ...o, [c.id]: (e.target as HTMLDetailsElement).open }))}
              >
                <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
                  Hints ({c.hints.length})
                </summary>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">
                  {c.hints.map((h, i) => (
                    <li key={i}><Inline text={h} /></li>
                  ))}
                </ul>
              </details>
              {res && (
                <div
                  className={`rounded-lg border p-2.5 font-mono text-[11px] leading-5 ${
                    res.pass ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {res.detail}
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Btn variant="primary" disabled={checking !== null} onClick={() => onLoadChallenge(c)} title="Load this challenge's starter model into the editor">
                  Load starter
                </Btn>
                <Btn onClick={() => runCheck(c)} disabled={checking !== null || !engine.ready || draftPending}>
                  {checking === c.id ? "running…" : "▶ Run check"}
                </Btn>
              </div>
            </div>
          </Card>
        );
      })}
      </div>
    </section>
  );
}
