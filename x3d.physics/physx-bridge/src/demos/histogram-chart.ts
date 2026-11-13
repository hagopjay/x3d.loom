// The Galton histogram: one bar per bin (gold, 2 px gaps, rounded data end on the baseline side up), the binomial expectation as hollow
// markers on a thin line, hairline axes, a legend, a hover tooltip per bin (hit area the full column) and a table view.
const NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}
const W = 280, H = 170, M = { l: 28, r: 6, t: 14, b: 22 };
const GOLD = '#d8b25a', REF = '#c9c4b6', AXIS = '#2a2e37', INK = '#9a968b';

export function renderHistogram(host: HTMLElement, legend: HTMLElement, table: HTMLElement, counts: number[], expected: number[], labels: string[]) {
  const n = counts.length, top = Math.max(4, ...counts, ...expected) * 1.1;
  const step = (W - M.l - M.r) / n, bw = Math.max(2, step - 2);
  const X = (i: number) => M.l + i * step + 1, Y = (v: number) => H - M.b - ((H - M.t - M.b) * v) / top;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Beads per bin against the binomial expectation' });
  const ticks = [0, Math.round(top / 2), Math.round(top * 0.9)].filter((v, i, a) => a.indexOf(v) === i);
  for (const t of ticks) {
    root.append(svg('line', { x1: M.l, x2: W - M.r, y1: Y(t), y2: Y(t), stroke: AXIS, 'stroke-width': 1 }));
    root.append(svg('text', { x: M.l - 4, y: Y(t) + 3, 'text-anchor': 'end', fill: INK, 'font-size': 9 }, String(t)));
  }
  const tip = svg('text', { x: M.l, y: 10, fill: '#e8e3d5', 'font-size': 10, visibility: 'hidden' });
  counts.forEach((c, i) => {
    const h = H - M.b - Y(c), r = Math.min(4, bw / 2, h);
    // a bar with its top corners rounded (the data end), square on the baseline
    if (c > 0) root.append(svg('path', { d: `M${X(i)},${H - M.b}V${Y(c) + r}Q${X(i)},${Y(c)} ${X(i) + r},${Y(c)}H${X(i) + bw - r}Q${X(i) + bw},${Y(c)} ${X(i) + bw},${Y(c) + r}V${H - M.b}Z`, fill: GOLD }));
    if (n <= 17) root.append(svg('text', { x: X(i) + bw / 2, y: H - M.b + 12, 'text-anchor': 'middle', fill: INK, 'font-size': 8 }, labels[i]));
    const hit = svg('rect', { x: X(i) - 1, y: M.t, width: step, height: H - M.t - M.b, fill: 'transparent', tabindex: 0, 'aria-label': `bin ${labels[i]}: ${c} beads, expected ${expected[i].toFixed(1)}` });
    const show = () => { tip.textContent = `bin ${labels[i]}: ${c} beads · binomial expects ${expected[i].toFixed(1)}`; tip.setAttribute('visibility', 'visible'); };
    hit.addEventListener('pointerenter', show); hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', () => tip.setAttribute('visibility', 'hidden')); hit.addEventListener('blur', () => tip.setAttribute('visibility', 'hidden'));
    root.append(hit);
  });
  const pts = expected.map((e, i) => [X(i) + bw / 2, Y(e)]);
  root.append(svg('path', { d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(''), fill: 'none', stroke: REF, 'stroke-width': 1, 'pointer-events': 'none' }));
  for (const [x, y] of pts) root.append(svg('circle', { cx: x, cy: y, r: 3, fill: '#14171d', stroke: REF, 'stroke-width': 1.5, 'pointer-events': 'none' }));
  root.append(svg('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: '#4a4e57', 'stroke-width': 1 }));
  root.append(tip);
  host.replaceChildren(root);
  const item = (label: string, css: string) => { const s = document.createElement('span'); const i = document.createElement('i'); i.style.cssText = css; s.append(i, document.createTextNode(label)); return s; };
  legend.replaceChildren(item('beads in each bin (PhysX)', `width:9px;height:9px;border-radius:2px;background:${GOLD}`), item('Binomial(n, ½) × beads', `width:7px;height:7px;border-radius:50%;border:1.5px solid ${REF}`));
  const t = document.createElement('table');
  const head = document.createElement('tr');
  for (const h of ['bin', 'beads', 'expected']) { const th = document.createElement('th'); th.textContent = h; head.append(th); }
  t.append(head);
  counts.forEach((c, i) => { const tr = document.createElement('tr'); for (const v of [labels[i], String(c), expected[i].toFixed(1)]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); } t.append(tr); });
  table.replaceChildren(t);
}
