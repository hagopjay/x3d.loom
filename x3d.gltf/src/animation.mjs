// Animation gate: the same channels, on the same nodes, with the same times and values.
// X3D animation (TimeSensor -> interpolator -> ROUTE) reaches a glb as sampled channels (docs/learn chapter 11 section 2.1); an optimiser that resamples,
// quantizes output accessors or retargets nodes changes the motion without touching a triangle.
import { nodeKey, readFloats } from './geometry.mjs';

export function animationSummary(doc) {
  const out = [];
  for (const an of doc.getRoot().listAnimations()) {
    const channels = an.listChannels().map((ch) => {
      const s = ch.getSampler(), tn = ch.getTargetNode();
      const times = readFloats(s.getInput()), vals = readFloats(s.getOutput());
      return { target: tn ? nodeKey(tn) : null, path: ch.getTargetPath(), interpolation: s.getInterpolation(), count: times.length, t0: times[0], t1: times[times.length - 1], times, vals,
        stride: times.length ? vals.length / times.length : 0 };
    });
    out.push({ name: an.getName(), channels });
  }
  return out;
}

function sampleAt(ch, t) {   // linear (STEP honoured); enough to compare a resampled channel with its source at the source's own key times
  const { times, vals, stride } = ch, n = times.length;
  if (!n) return new Float64Array(stride);
  if (t <= times[0]) return vals.slice(0, stride);
  if (t >= times[n - 1]) return vals.slice((n - 1) * stride, n * stride);
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; times[m] <= t ? lo = m : hi = m; }
  if (ch.interpolation === 'STEP') return vals.slice(lo * stride, (lo + 1) * stride);
  const f = (t - times[lo]) / (times[hi] - times[lo]), o = new Float64Array(stride);
  for (let k = 0; k < stride; k++) o[k] = vals[lo * stride + k] * (1 - f) + vals[hi * stride + k] * f;
  return o;
}

export function compareAnimation(a, b) {
  const res = { sourceAnimations: a.length, outputAnimations: b.length, channelsSource: 0, channelsOutput: 0, matched: 0, unmatched: 0, maxValueDelta: 0, maxTimeDelta: 0, exactKeys: 0, resampled: 0 };
  res.channelsSource = a.reduce((x, an) => x + an.channels.length, 0); res.channelsOutput = b.reduce((x, an) => x + an.channels.length, 0);
  const pool = new Map();
  for (const an of b) for (const ch of an.channels) { const k = `${an.name}|${ch.target}|${ch.path}`; (pool.get(k) || pool.set(k, []).get(k)).push(ch); }
  for (const an of a) for (const ch of an.channels) {
    const k = `${an.name}|${ch.target}|${ch.path}`, cand = pool.get(k)?.shift();
    if (!cand) { res.unmatched++; continue; }
    res.matched++;
    res.maxTimeDelta = Math.max(res.maxTimeDelta, Math.abs(ch.t0 - cand.t0), Math.abs(ch.t1 - cand.t1));
    if (cand.count === ch.count && cand.stride === ch.stride) {
      res.exactKeys++;
      for (let i = 0; i < ch.times.length; i++) res.maxTimeDelta = Math.max(res.maxTimeDelta, Math.abs(ch.times[i] - cand.times[i]));
      for (let i = 0; i < ch.vals.length; i++) res.maxValueDelta = Math.max(res.maxValueDelta, Math.abs(ch.vals[i] - cand.vals[i]));
    } else {
      res.resampled++;
      for (let i = 0; i < ch.times.length; i++) { const v = sampleAt(cand, ch.times[i]); for (let q = 0; q < ch.stride; q++) res.maxValueDelta = Math.max(res.maxValueDelta, Math.abs(ch.vals[i * ch.stride + q] - v[q])); }
    }
  }
  return res;
}
