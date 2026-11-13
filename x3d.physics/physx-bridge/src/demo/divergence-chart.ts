// The race plot: distance between each PhysX marble and its Bullet ghost against time since that marble was dropped.
// One highlighted series (the mean, gold, 2 px), each marble as recessive context (1 px grey); hairline axes; crosshair + tooltip;
// a table view. Labels are written with textContent only.
const NS = 'http://www.w3.org/2000/svg';
const W = 270, H = 150, M = { l: 34, r: 8, t: 8, b: 22 };

export interface Series { t: number[]; d: number[] } // seconds since drop, metres

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}
const nice = (x: number) => { const p = 10 ** Math.floor(Math.log10(x || 1)), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

/** Mean over the marbles that have a sample at each 0.1 s bin. */
export function meanSeries(all: Series[], dt = 0.1): Series {
  const bins = new Map<number, number[]>();
  for (const s of all) s.t.forEach((t, i) => { const k = Math.round(t / dt); bins.set(k, [...(bins.get(k) ?? []), s.d[i]]); });
  const ks = [...bins.keys()].sort((a, b) => a - b);
  return { t: ks.map((k) => k * dt), d: ks.map((k) => bins.get(k)!.reduce((a, b) => a + b, 0) / bins.get(k)!.length) };
}

export function renderDivergence(host: HTMLElement, table: HTMLElement, all: Series[]) {
  const mean = meanSeries(all);
  const tMax = Math.max(1, ...all.flatMap((s) => s.t)), dMax = nice(Math.max(0.01, ...all.flatMap((s) => s.d)) * 100) / 100;
  const x = (t: number) => M.l + ((W - M.l - M.r) * t) / tMax, y = (d: number) => H - M.b - ((H - M.t - M.b) * d) / dMax;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Distance between each PhysX marble and its Bullet ghost over time' });
  // axes and grid (hairline, recessive)
  for (let i = 0; i <= 4; i++) {
    const d = (dMax * i) / 4;
    root.append(svg('line', { x1: M.l, x2: W - M.r, y1: y(d), y2: y(d), stroke: '#2a2e37', 'stroke-width': 1 }));
    root.append(svg('text', { x: M.l - 4, y: y(d) + 3, 'text-anchor': 'end', fill: '#9a968b', 'font-size': 9 }, `${+(d * 100).toFixed(1)}`));
  }
  for (let i = 0; i <= 4; i++) { const t = (tMax * i) / 4; root.append(svg('text', { x: x(t), y: H - 8, 'text-anchor': 'middle', fill: '#9a968b', 'font-size': 9 }, `${+t.toFixed(1)} s`)); }
  root.append(svg('text', { x: 2, y: M.t + 2, fill: '#9a968b', 'font-size': 9, 'dominant-baseline': 'hanging' }, 'cm'));
  const path = (s: Series) => s.t.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(s.d[i]).toFixed(1)}`).join('');
  for (const s of all) if (s.t.length > 1) root.append(svg('path', { d: path(s), fill: 'none', stroke: '#5c5a55', 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  if (mean.t.length > 1) root.append(svg('path', { d: path(mean), fill: 'none', stroke: '#d8b25a', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  // crosshair + tooltip (snaps to the nearest 0.1 s bin; values lead, labels follow)
  const hair = svg('line', { y1: M.t, y2: H - M.b, stroke: '#e8e3d5', 'stroke-width': 1, visibility: 'hidden' });
  const tip = svg('text', { x: 0, y: M.t + 10, fill: '#e8e3d5', 'font-size': 10, visibility: 'hidden' });
  const hit = svg('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: 'transparent', tabindex: 0 });
  const show = (px: number) => {
    if (!mean.t.length) return;
    const t = ((px - M.l) / (W - M.l - M.r)) * tMax;
    let i = 0; for (let k = 1; k < mean.t.length; k++) if (Math.abs(mean.t[k] - t) < Math.abs(mean.t[i] - t)) i = k;
    const n = all.filter((s) => s.t.some((tt) => Math.abs(tt - mean.t[i]) < 0.051)).length;
    hair.setAttribute('x1', String(x(mean.t[i]))); hair.setAttribute('x2', String(x(mean.t[i]))); hair.setAttribute('visibility', 'visible');
    tip.textContent = `${(mean.d[i] * 100).toFixed(1)} cm mean · ${n} marbles · ${mean.t[i].toFixed(1)} s`;
    tip.setAttribute('x', String(Math.min(x(mean.t[i]) + 4, W - 150))); tip.setAttribute('visibility', 'visible');
  };
  hit.addEventListener('pointermove', (e) => { const r = root.getBoundingClientRect(); show(((e.clientX - r.left) / r.width) * W); });
  hit.addEventListener('pointerleave', () => { hair.setAttribute('visibility', 'hidden'); tip.setAttribute('visibility', 'hidden'); });
  hit.addEventListener('focus', () => show(x(mean.t[mean.t.length - 1] ?? 0)));
  root.append(hair, tip, hit);
  host.replaceChildren(root);
  // table view: per second, mean and max distance
  const rows: HTMLTableRowElement[] = [];
  const head = document.createElement('tr');
  for (const h of ['since drop', 'mean', 'max', 'marbles']) { const th = document.createElement('th'); th.textContent = h; head.append(th); }
  rows.push(head);
  for (let s = 0; s <= Math.floor(tMax); s++) {
    const vals = all.map((ser) => { let best = -1; ser.t.forEach((t, i) => { if (Math.abs(t - s) < 0.06) best = ser.d[i]; }); return best; }).filter((v) => v >= 0);
    if (!vals.length) continue;
    const tr = document.createElement('tr');
    for (const v of [`${s} s`, `${(100 * vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)} cm`, `${(100 * Math.max(...vals)).toFixed(1)} cm`, String(vals.length)]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    rows.push(tr);
  }
  const t = document.createElement('table'); t.append(...rows);
  table.replaceChildren(t);
}
