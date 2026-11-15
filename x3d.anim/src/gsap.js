// GSAP timeline -> neutral timeline. The caller builds the timeline over plain target objects shaped like the state tree
// (targets.Box.translation = {x,y,z}; targets.Mat.diffuseColor = {r,g,b}; a scalar field such as targets.Lamp.intensity is a number on the def object).
// GSAP (standard no-charge licence) runs headless in Node on plain objects; its own seek (tl.time) is the oracle.
import gsap from 'gsap';
import { bake } from './bake.js';

import { clone, authoredTimes } from './gsap-core.js';
// build(gsap, targets) -> gsap.core.Timeline. rest = initial state tree (also the targets GSAP animates; it is cloned, never mutated)
export function fromGsap(build, rest, { name = 'gsap', fps = 60, tol = 1, duration } = {}) {
  gsap.ticker.lagSmoothing(0); const targets = clone(rest), tl = build(gsap, targets); tl.pause(0);
  const dur = duration || tl.duration(); if (!(dur > 0)) throw new Error('GSAP timeline has zero duration');
  const evalAt = (t) => { tl.time(t, false); return clone(targets); };
  const res = bake(name, evalAt, rest, { duration: dur, fps, must: authoredTimes(tl, targets), tol });
  gsap.ticker.sleep(); return { ...res, source: { tool: 'GSAP', version: gsap.version, tweens: tl.getChildren(false, true, true, 0).length }, oracle: evalAt };
}
