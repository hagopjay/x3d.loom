// A small x-y chart for the demos: context lines (grey, 1 px, direct-labelled), reference points (hollow), measured points (gold, 8 px),
// hairline axes, a legend, hover tooltips on points and a table view. Labels are written with textContent only.
const NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface ChartLine { label: string; pts: [number, number][]; strong?: boolean; /** the highlighted series: gold, 2 px */ gold?: boolean; /** where the direct label goes */ labelAt?: 'start' | 'end' }
export interface ChartPoint { x: number; y: number; tip: string }
export interface ChartSpec {
  x: { label: string; min: number; max: number; ticks: number[]; fmt?: (v: number) => string };
  y: { label: string; min: number; max: number; ticks: number[]; fmt?: (v: number) => string };
  lines: ChartLine[];
  reference?: { label: string; pts: ChartPoint[] };
  measured: { label: string; pts: ChartPoint[]; hideLegend?: boolean };
  /** Columns for the table view: one row per measured and reference point. */
  table: { head: string[]; rows: string[][] };
  aria: string;
  /** Legend entries for the lines (default: one grey entry for PhysX sweeps). */
  lineLegend?: { label: string; gold: boolean }[];
}

const W = 280, H = 190, M = { l: 34, r: 30, t: 10, b: 30 };
const GOLD = '#d8b25a', REF = '#b8b3a6', LINE = '#5c5a55', LINE_STRONG = '#8f8b80', AXIS = '#2a2e37', INK = '#9a968b';

export function renderChart(host: HTMLElement, legendHost: HTMLElement, tableHost: HTMLElement, c: ChartSpec) {
  const X = (v: number) => M.l + ((W - M.l - M.r) * (v - c.x.min)) / (c.x.max - c.x.min);
  const Y = (v: number) => H - M.b - ((H - M.t - M.b) * (v - c.y.min)) / (c.y.max - c.y.min);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': c.aria });
  for (const t of c.y.ticks) {
    root.append(svg('line', { x1: M.l, x2: W - M.r, y1: Y(t), y2: Y(t), stroke: AXIS, 'stroke-width': 1 }));
    root.append(svg('text', { x: M.l - 4, y: Y(t) + 3, 'text-anchor': 'end', fill: INK, 'font-size': 9 }, c.y.fmt ? c.y.fmt(t) : String(t)));
  }
  for (const t of c.x.ticks) root.append(svg('text', { x: X(t), y: H - M.b + 12, 'text-anchor': 'middle', fill: INK, 'font-size': 9 }, c.x.fmt ? c.x.fmt(t) : String(t)));
  root.append(svg('text', { x: (M.l + W - M.r) / 2, y: H - 4, 'text-anchor': 'middle', fill: INK, 'font-size': 9 }, c.x.label));
  root.append(svg('text', { x: 2, y: M.t - 2, fill: INK, 'font-size': 9, 'dominant-baseline': 'hanging' }, c.y.label));
  for (const l of c.lines) {
    if (l.pts.length < 2) continue;
    const d = l.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
    root.append(svg('path', { d, fill: 'none', stroke: l.gold ? GOLD : l.strong ? LINE_STRONG : LINE, 'stroke-width': l.gold ? 2 : l.strong ? 1.5 : 1, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    if (!l.label) continue;
    const end = l.labelAt === 'end', [lx, ly] = end ? l.pts[l.pts.length - 1] : l.pts[0]; // default: the start, where the sweeps are furthest apart
    root.append(svg('text', { x: X(lx) + (end ? 3 : -3), y: Y(ly) + (end ? -3 : 3), 'text-anchor': end ? 'start' : 'end', fill: l.strong ? '#c9c4b6' : INK, 'font-size': 8 }, l.label));
  }
  const tip = svg('text', { x: M.l + 4, y: M.t + 10, fill: '#e8e3d5', 'font-size': 10, visibility: 'hidden' });
  const dot = (p: ChartPoint, ref: boolean) => {
    const g = svg('g', { tabindex: 0, role: 'img', 'aria-label': p.tip });
    // hit target larger than the mark
    g.append(svg('circle', { cx: X(p.x), cy: Y(p.y), r: 8, fill: 'transparent' }));
    g.append(ref
      ? svg('circle', { cx: X(p.x), cy: Y(p.y), r: 3.5, fill: '#14171d', stroke: REF, 'stroke-width': 1.5 })
      : svg('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: GOLD, stroke: '#14171d', 'stroke-width': 2 }));
    const show = () => { tip.textContent = p.tip; tip.setAttribute('visibility', 'visible'); };
    const hide = () => tip.setAttribute('visibility', 'hidden');
    g.addEventListener('pointerenter', show); g.addEventListener('pointerleave', hide); g.addEventListener('focus', show); g.addEventListener('blur', hide);
    root.append(g);
  };
  for (const p of c.reference?.pts ?? []) dot(p, true);
  for (const p of c.measured.pts) dot(p, false);
  root.append(tip);
  host.replaceChildren(root);
  // legend: identity never by colour alone (shape differs too)
  const item = (label: string, mark: string) => { const s = document.createElement('span'); const i = document.createElement('i'); i.style.cssText = mark; s.append(i, document.createTextNode(label)); return s; };
  legendHost.replaceChildren(
    ...(c.measured.hideLegend ? [] : [item(c.measured.label, `width:8px;height:8px;border-radius:50%;background:${GOLD}`)]),
    ...(c.reference ? [item(c.reference.label, `width:7px;height:7px;border-radius:50%;border:1.5px solid ${REF}`)] : []),
    ...(c.lineLegend ?? [{ label: 'PhysX sweeps (lines)', gold: false }]).map((x) => item(x.label, `width:14px;height:${x.gold ? 2 : 1}px;background:${x.gold ? GOLD : LINE_STRONG}`)),
  );
  const t = document.createElement('table');
  const tr = document.createElement('tr');
  for (const h of c.table.head) { const th = document.createElement('th'); th.textContent = h; tr.append(th); }
  t.append(tr);
  for (const r of c.table.rows) { const row = document.createElement('tr'); for (const v of r) { const td = document.createElement('td'); td.textContent = v; row.append(td); } t.append(row); }
  tableHost.replaceChildren(t);
}
