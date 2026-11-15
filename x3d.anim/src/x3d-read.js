// X3D (XML encoding) -> neutral timeline: follows TimeSensor.fraction_changed -> interpolator.set_fraction -> value_changed -> node.field ROUTE chains.
import { TYPE_OF_INTERPOLATOR } from './model.js';

export function parseXml(src) {   // minimal tolerant XML reader: elements, attributes, no entities beyond the five; enough for X3D scene files
  const root = { name: '#root', attrs: {}, children: [] }, stack = [root], re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:'[^']*'|"[^"]*"))*)\s*(\/?)>/g;
  const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); let m;
  while ((m = re.exec(src))) {
    if (!m[2]) continue;
    if (m[1]) { stack.pop(); continue; }
    const attrs = {}; for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/g)) attrs[a[1]] = dec(a[2] ?? a[3]);
    const el = { name: m[2], attrs, children: [] }; stack[stack.length - 1].children.push(el); if (!m[4]) stack.push(el);
  }
  return root;
}
const walk = (el, f) => { f(el); for (const c of el.children) walk(c, f); };
const nums = (s) => (s || '').split(/[\s,]+/).filter(Boolean).map(Number);

export function readTimelines(src) {
  const doc = parseXml(src), by = {}, routes = [], clocks = [];
  walk(doc, (e) => { if (e.attrs.DEF) by[e.attrs.DEF] = e; if (e.name === 'ROUTE') routes.push(e.attrs); if (e.name === 'TimeSensor') clocks.push(e); });
  const out = [];
  for (const ck of clocks) {
    if (!ck.attrs.DEF) continue; const duration = +(ck.attrs.cycleInterval ?? 1), channels = [];
    for (const r1 of routes.filter((r) => r.fromNode === ck.attrs.DEF && r.fromField === 'fraction_changed')) {
      const ip = by[r1.toNode]; const type = ip && TYPE_OF_INTERPOLATOR[ip.name]; if (!type || r1.toField !== 'set_fraction') continue;
      const key = nums(ip.attrs.key), width = type === 'SFRotation' ? 4 : type === 'SFFloat' ? 1 : type === 'SFVec2f' ? 2 : 3, kv = nums(ip.attrs.keyValue);
      if (kv.length !== key.length * width) throw new Error(`${r1.toNode}: ${key.length} keys but ${kv.length} key values of width ${width}`);
      for (const r2 of routes.filter((r) => r.fromNode === r1.toNode && r.fromField === 'value_changed')) channels.push({ def: r2.toNode, field: r2.toField.replace(/^set_/, ''), type, keys: key.map((k, i) => ({ t: k * duration, v: kv.slice(i * width, (i + 1) * width) })) });
    }
    out.push({ name: ck.attrs.DEF.replace(/^Clock_/, ''), duration, loop: ck.attrs.loop === 'true', channels });
  }
  return out;
}
