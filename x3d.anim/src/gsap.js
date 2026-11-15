// GSAP timeline -> neutral timeline. The caller builds the timeline over plain target objects shaped like the state tree
// (targets.Box.translation = {x,y,z}; targets.Mat.diffuseColor = {r,g,b}; a scalar field such as targets.Lamp.intensity is a number on the def object).
// GSAP (standard no-charge licence) runs headless in Node on plain objects; its own seek (tl.time) is the oracle.
import gsap from 'gsap';
import { bake } from './bake.js';

const clone = (v) => (typeof v === 'number' ? v : Object.fromEntries(Object.entries(v).filter(([k]) => k[0] !== '_').map(([k, x]) => [k, clone(x)])));   // GSAP hangs its own _gsap record on every target
function tweenTimes(tl, out = new Set(), base = 0) {   // every tween start and end in the (nested) timeline: those instants stay keys
  for (const c of tl.getChildren(false, true, true, 0)) { const s = base + c.startTime(), e = s + c.duration() / (c.timeScale() || 1); out.add(+s.toFixed(9)); out.add(+e.toFixed(9)); if (c.getChildren && c.getChildren(false, true, true).length) tweenTimes(c, out, s); }
  return out;
}
// build(gsap, targets) -> gsap.core.Timeline. rest = initial state tree (also the targets GSAP animates; it is cloned, never mutated)
export function fromGsap(build, rest, { name = 'gsap', fps = 60, tol = 1, duration } = {}) {
  gsap.ticker.lagSmoothing(0); const targets = clone(rest), tl = build(gsap, targets); tl.pause(0);
  const dur = duration || tl.duration(); if (!(dur > 0)) throw new Error('GSAP timeline has zero duration');
  const evalAt = (t) => { tl.time(t, false); return clone(targets); };
  const res = bake(name, evalAt, rest, { duration: dur, fps, must: [...tweenTimes(tl)].filter((t) => t >= 0 && t <= dur), tol });
  gsap.ticker.sleep(); return { ...res, source: { tool: 'GSAP', version: gsap.version, tweens: tl.getChildren(false, true, true, 0).length }, oracle: evalAt };
}
