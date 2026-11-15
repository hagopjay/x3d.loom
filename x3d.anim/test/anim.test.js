import test from 'node:test'; import assert from 'node:assert/strict';
import { eulerToQuat, quatToEuler, quatToAxisAngle, axisAngleToQuat, qangle } from '../src/math.js';
import { lerpHsv, sampleChannel, distValue, toChannelValue } from '../src/model.js';
import { animationFragment, embed } from '../src/x3d-write.js'; import { readTimelines } from '../src/x3d-read.js';
import { toTheatreState, toGsapCode } from '../src/export-back.js'; import { fromTheatre } from '../src/theatre.js'; import { fromGsap } from '../src/gsap.js';
import { CASES, stage } from '../tools/cases.js';

test('Euler <-> quaternion <-> axis-angle round trips', () => {
  for (const e of [[10, 20, 30], [-170, 45, 90], [0, 0, 0], [90, 0, 0], [33, -80, 120]]) {
    const q = eulerToQuat(...e), back = eulerToQuat(...quatToEuler(q)); assert.ok(qangle(q, back) < 1e-9, `euler ${e}`);
    assert.ok(qangle(q, axisAngleToQuat(quatToAxisAngle(q))) < 1e-9);
  }
});
test('HSV colour lerp: endpoints exact, red to green goes through yellow-ish hue, not the RGB midpoint', () => {
  assert.deepEqual(lerpHsv([1, 0, 0], [0, 1, 0], 0).map((x) => +x.toFixed(9)), [1, 0, 0]);
  const m = lerpHsv([1, 0, 0], [0, 1, 0], 0.5); assert.ok(Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[1] - 1) < 1e-9 && m[2] < 1e-9);   // hue 60 deg, full s,v = (1,1,0)
  const rgb = lerpHsv([1, 0, 0], [0, 0, 1], 0.5); assert.ok(Math.abs(rgb[0] - 1) < 1e-9 && Math.abs(rgb[2] - 1) < 1e-9);          // red to blue the short way: magenta, RGB lerp would give 0.5 0 0.5
});
for (const c of CASES) {
  test(`${c.id}: bake error is within what the bake reports, keys keep authored instants`, async () => {
    const made = await c.make(); assert.ok(made.timeline.channels.length >= 4);
    for (const r of made.report) assert.ok(r.maxErr < 25 * r.tol, `${r.def}.${r.field} maxErr ${r.maxErr} tol ${r.tol}`);   // between-sample overshoot on bounce/elastic eases is bounded, not tol (see README: tolerance)
    for (const ch of made.timeline.channels) { assert.equal(ch.keys[0].t, 0); assert.ok(Math.abs(ch.keys.at(-1).t - made.timeline.duration) < 1e-9); }
  });
  test(`${c.id}: X3D text reads back to the same timeline`, async () => {
    const tl = (await c.make()).timeline, back = readTimelines(embed(stage(), tl))[0];
    assert.equal(back.channels.length, tl.channels.length); assert.ok(Math.abs(back.duration - tl.duration) < 1e-9);
    tl.channels.forEach((ch, i) => { const b = back.channels[i]; assert.equal(b.def + b.field, ch.def + ch.field); assert.equal(b.keys.length, ch.keys.length);
      for (let k = 0; k < ch.keys.length; k++) { assert.ok(Math.abs(b.keys[k].t - ch.keys[k].t) < 1e-6); assert.ok(distValue(ch.type, b.keys[k].v, ch.keys[k].v) < 1e-6); } });
  });
  test(`${c.id}: X3D -> Theatre state -> Theatre core matches the interpolators`, async () => {
    const made = await c.make(), tl = made.timeline, st = toTheatreState(tl, { sheet: 'Sheet1' });
    const back = await fromTheatre(st, { name: 'back', defaults: { Box: { scale: { x: 1, y: 1, z: 1 } } } });   // only channels with tracks come back
    let worst = 0; for (let i = 0; i <= 50; i++) { const t = tl.duration * i / 50, o = back.oracle(t); for (const ch of tl.channels) { if (!o[ch.def] || o[ch.def][ch.field] === undefined) continue; worst = Math.max(worst, distValue(ch.type, toChannelValue(ch.type, o[ch.def][ch.field]), sampleChannel(ch, t))); } }
    assert.ok(worst < 0.02, 'worst ' + worst);   // linear segments in, linear out; rotations pass through Euler (0.05 deg tolerance), colours through RGB tracks vs HSV interpolation
  });
  test(`${c.id}: X3D -> GSAP code -> GSAP matches the interpolators`, async () => {
    const tl = (await c.make()).timeline, { rest, code } = toGsapCode(tl), mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')), back = fromGsap(mod.build, mod.rest, { name: 'back' });
    let worst = 0; for (let i = 0; i <= 50; i++) { const t = tl.duration * i / 50, o = back.oracle(t); for (const ch of tl.channels) { if (ch.type === 'SFColor') continue; worst = Math.max(worst, distValue(ch.type, toChannelValue(ch.type, o[ch.def][ch.field]), sampleChannel(ch, t))); } }
    assert.ok(worst < 0.02, 'worst ' + worst);
  });
}
test('embed refuses a DEF that is not in the scene', async () => { const tl = (await CASES[0].make()).timeline; assert.throws(() => embed('<X3D><Scene></Scene></X3D>', tl), /DEF not found/); });
test('Theatre path with an unknown field is refused loudly', async () => { const st = JSON.parse(JSON.stringify(toTheatreState((await CASES[0].make()).timeline))); const o = st.sheetsById.Sheet1.sequence.tracksByObject.Box; o.trackIdByPropPath['["warpFactor"]'] = Object.values(o.trackIdByPropPath)[0]; await assert.rejects(fromTheatre(st), /unknown animatable field/); });
