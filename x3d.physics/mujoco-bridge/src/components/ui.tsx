import type { ReactNode } from "react";
import { cn } from "../utils/cn";

const TONES: Record<string, string> = {
  slate: "border-slate-700 bg-slate-800/80 text-slate-300",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  rose: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

export function Badge({ children, tone = "slate", className, title }: { children: ReactNode; tone?: string; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", TONES[tone] ?? TONES.slate, className)}>
      {children}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  title,
  variant = "default",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  variant?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    default: "border-slate-700 bg-slate-800/80 text-slate-200 hover:border-slate-500 hover:bg-slate-700/80",
    primary: "border-sky-500/60 bg-sky-500/90 text-white hover:bg-sky-400 shadow-lg shadow-sky-950/40",
    danger: "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
    ghost: "border-transparent bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40", styles, className)}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2">
          <div className="min-w-0 truncate text-xs font-bold uppercase tracking-wider text-slate-400">{title}</div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5">{actions}</div>
        </div>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Renders **bold** and `inline code` markers inside plain text. */
export function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let m: RegExpExecArray | null;
  let last = 0;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-100">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code key={key++} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.85em] text-sky-300">
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="url(#g)" />
      <circle cx="16" cy="10" r="3.2" fill="#0b1120" />
      <path d="M16 13.5v6" stroke="#0b1120" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 26l6-6.5 6 6.5" stroke="#0b1120" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="26" r="2" fill="#0b1120" />
      <circle cx="22" cy="26" r="2" fill="#0b1120" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
