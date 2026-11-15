// neutral timeline (read from X3D) -> Theatre.js project state and GSAP code, so an animation authored as X3D interpolators can be re-opened in either tool.
// Rotations leave the interpolator as Euler degrees (the tools' own convention) by sampling the slerp, so they are approximate; the error is returned.
import { COMPONENTS, toStateValue, sampleChannel, typeOf } from './model.js';
import { reduceKeys } from './bake.js';

// per channel: component tracks [{path:[field,comp] | [field], keys:[{t,v}]}]
export function componentTracks(tl, { fps = 60, tolDeg = 0.05 } = {}) {
  const out = [];
  for (const ch of tl.channels) {
    const comps = COMPONENTS[ch.type];
    if (ch.type !== 'SFRotation') {
      if (comps === null) out.push({ def: ch.def, field: ch.field, comp: null, keys: ch.keys.map((k) => ({ t: k.t, v: [k.v[0]] })) });
      else comps.forEach((c, i) => out.push({ def: ch.def, field: ch.field, comp: c, keys: ch.keys.map((k) => ({ t: k.t, v: [k.v[i]] })) }));
      continue;
    }
    const n = Math.max(2, Math.ceil(tl.duration * fps)), ts = [...new Set([...ch.keys.map((k) => k.t), ...Array.from({ length: n + 1 }, (_, i) => +(tl.duration * i / n).toFixed(9))])].sort((a, b) => a - b);
    const eul = ts.map((t) => { const s = toStateValue('SFRotation', sampleChannel(ch, t)); return [s.x, s.y, s.z]; });
    for (let i = 1; i < eul.length; i++) for (let c = 0; c < 3; c++) { const d = eul[i][c] - eul[i - 1][c]; eul[i][c] -= Math.round(d / 360) * 360; }   // unwrap
    ['x', 'y', 'z'].forEach((c, ci) => out.push({ def: ch.def, field: ch.field, comp: c, keys: reduceKeys('SFFloat', ts.map((t, i) => ({ t, v: [eul[i][ci]] })), tolDeg, ch.keys.map((k) => k.t).filter((t) => t > 0 && t < tl.duration)) }));
  }
  return out;
}

export function toTheatreState(tl, { sheet = 'Sheet1', ...o } = {}) {
  const tracksByObject = {}; let id = 0;
  for (const tr of componentTracks(tl, o)) {
    const obj = (tracksByObject[tr.def] ||= { trackData: {}, trackIdByPropPath: {} }), tid = 'trk' + (++id).toString().padStart(3, '0');
    obj.trackIdByPropPath[JSON.stringify(tr.comp ? [tr.field, tr.comp] : [tr.field])] = tid;
    obj.trackData[tid] = { type: 'BasicKeyframedTrack', __debugName: `${tr.def}:${tr.comp ? tr.field + '.' + tr.comp : tr.field}`,
      keyframes: tr.keys.map((k, i) => ({ id: `${tid}k${i}`, position: +k.t.toFixed(9), connectedRight: true, handles: [0.5, 0.5, 0.5, 0.5], type: 'bezier', value: +k.v[0].toPrecision(9) })) };
  }
  return { sheetsById: { [sheet]: { staticOverrides: { byObject: {} }, sequence: { subUnitsPerUnit: 30, length: tl.duration, type: 'PositionalSequence', tracksByObject } } }, definitionVersion: '0.4.0', revisionHistory: [] };
}

// GSAP source: a restState (initial values) and a build(gsap, targets) function body per component group; segments are linear (ease 'none') because that is what the interpolators are.
export function toGsapCode(tl, o = {}) {
  const tracks = componentTracks(tl, o), rest = {}, lines = [], r = (x) => +x.toPrecision(9);
  for (const tr of tracks) { const d = (rest[tr.def] ||= {}); if (tr.comp) (d[tr.field] ||= {})[tr.comp] = r(tr.keys[0].v[0]); else d[tr.field] = r(tr.keys[0].v[0]); }
  const groups = new Map(); for (const tr of tracks) { const k = tr.def + '.' + tr.field; (groups.get(k) || groups.set(k, []).get(k)).push(tr); }
  for (const [k, trs] of groups) {
    const [def, field] = [trs[0].def, trs[0].field], tgt = `targets.${def}${trs[0].comp ? '.' + field : ''}`;
    if (!trs[0].comp) { const t = trs[0], segs = []; for (let i = 0; i + 1 < t.keys.length; i++) segs.push(`{ ${field}: ${r(t.keys[i + 1].v[0])}, duration: ${r(t.keys[i + 1].t - t.keys[i].t)}, ease: 'none' }`); lines.push(`tl.to(targets.${def}, { keyframes: [${segs.join(', ')}] }, ${r(t.keys[0].t)});`); continue; }
    for (const t of trs) { const segs = []; for (let i = 0; i + 1 < t.keys.length; i++) segs.push(`{ ${t.comp}: ${r(t.keys[i + 1].v[0])}, duration: ${r(t.keys[i + 1].t - t.keys[i].t)}, ease: 'none' }`); lines.push(`tl.to(${tgt}, { keyframes: [${segs.join(', ')}] }, ${r(t.keys[0].t)});`); }
  }
  return { rest, code: `// generated from X3D timeline '${tl.name}' (${tl.duration}s)\nexport const rest = ${JSON.stringify(rest, null, 2)};\nexport const duration = ${r(tl.duration)};\nexport function build(gsap, targets) {\n  const tl = gsap.timeline({ paused: true });\n${lines.map((l) => '  ' + l).join('\n')}\n  return tl;\n}\n` };
}
