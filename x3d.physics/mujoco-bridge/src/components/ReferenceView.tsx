import { useMemo, useState } from "react";
import { REF_SECTIONS } from "../data/reference";
import { Card } from "./ui";

export default function ReferenceView() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const sections = useMemo(() => {
    if (!query) return REF_SECTIONS;
    return REF_SECTIONS.map((s) => ({
      ...s,
      rows: s.rows.filter((r) => (s.title + " " + (s.blurb ?? "") + " " + r.join(" ")).toLowerCase().includes(query)),
    })).filter((s) => s.rows.length > 0 || s.title.toLowerCase().includes(query));
  }, [query]);

  return (
    <div className="space-y-3">
      <Card title="Cheat-sheet & reference" bodyClassName="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            aria-label="Search reference"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search: solref, freejoint, Newton, sensordata, gear…"
            className="w-full max-w-md !py-2 font-mono !text-sm"
          />
          <span className="text-xs text-slate-500">
            {sections.length} section{sections.length === 1 ? "" : "s"} · {sections.reduce((a, s) => a + s.rows.length, 0)} rows
          </span>
        </div>
      </Card>
      {sections.map((s) => (
        <Card key={s.title} title={s.title} bodyClassName="overflow-auto">
          <div className="max-h-96 overflow-auto">
            {s.blurb && <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-500">{s.blurb}</div>}
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {s.cols.map((c) => (
                    <th key={c} className="sticky top-0 z-10 bg-slate-900 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-800/70">
                    {r.map((cell, j) => (
                      <td key={j} className={`px-3 py-1.5 align-top text-xs leading-5 text-slate-300 ${j === 0 ? "font-mono text-[11px] text-sky-300" : ""}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      {sections.length === 0 && <div className="p-6 text-center text-sm text-slate-500">no matches for “{q}”</div>}
    </div>
  );
}
