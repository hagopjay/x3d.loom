import { useRef, type ReactNode } from "react";

const CLS = {
  comment: "text-slate-500 italic",
  punct: "text-slate-500",
  tag: "text-sky-400",
  attr: "text-amber-300",
  str: "text-emerald-300",
  text: "text-slate-300",
};

/** Tiny, dependency-free XML syntax highlighter producing React spans. */
function highlight(src: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let key = 0;
  let i = 0;
  const push = (text: string, cls: string) => {
    if (text) nodes.push(<span key={key++} className={cls}>{text}</span>);
  };
  while (i < src.length) {
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      const stop = end === -1 ? src.length : end + 3;
      push(src.slice(i, stop), CLS.comment);
      i = stop;
      continue;
    }
    if (src[i] === "<") {
      const end = src.indexOf(">", i);
      const hasClose = end !== -1;
      const stop = hasClose ? end + 1 : src.length;
      const tag = src.slice(i, stop);
      push("<", CLS.punct);
      const inner = tag.slice(1, hasClose ? -1 : undefined);
      const re = /([A-Za-z_][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*')/g;
      let m: RegExpExecArray | null;
      let last = 0;
      while ((m = re.exec(inner))) {
        if (m.index > last) push(inner.slice(last, m.index), CLS.tag);
        push(m[1], CLS.attr);
        push(m[2], CLS.punct);
        push(m[3], CLS.str);
        last = m.index + m[0].length;
      }
      if (last < inner.length) push(inner.slice(last), CLS.tag);
      if (hasClose) push(">", CLS.punct);
      i = stop;
      continue;
    }
    const next = src.indexOf("<", i);
    const stop = next === -1 ? src.length : next;
    push(src.slice(i, stop), CLS.text);
    i = stop;
  }
  return nodes;
}

export default function CodeEditor({
  value,
  onChange,
  onRun,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hlRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (hlRef.current) {
      hlRef.current.scrollTop = ta.scrollTop;
      hlRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = taRef.current;
      if (!el) return;
      const s = el.selectionStart;
      const en = el.selectionEnd;
      const nv = value.slice(0, s) + "  " + value.slice(en);
      onChange(nv);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = s + 2;
      });
    }
  };

  const lineCount = value.split("\n").length;
  const fontCls = "font-mono text-[13px] leading-[1.5] p-3";

  return (
    <div className="relative flex h-full min-h-0 bg-[#0a0f1e]">
      <div
        ref={gutterRef}
        className={cn2("w-10 shrink-0 select-none overflow-hidden border-r border-slate-800/80 bg-[#0a0f1e] py-3 pr-2 text-right font-mono text-[13px] leading-[1.5] text-slate-600")}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <pre
          ref={hlRef}
          aria-hidden
          className={cn2("pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre text-slate-300", fontCls)}
        >
          {highlight(value)}
          {"\n"}
        </pre>
        <textarea
          ref={taRef}
          aria-label="MJCF source editor"
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          className={cn2(
            "absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent text-transparent caret-sky-400 outline-none selection:bg-sky-500/30",
            fontCls,
          )}
        />
      </div>
    </div>
  );
}

function cn2(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
