// node --test test/engines.test.js     (NODE_PATH must reach rapier3d-compat and cannon-es: `npm install` in this folder)
// The thresholds are the measured values of results/fidelity-node.json with a small margin. Where an engine departs from the analytic answer, the test pins the departure (a documented deviation) so a
// library update that changes it shows up as a failing test, not as a silent change of every number in docs chapter 16.
const test = require('node:test'), assert = require('node:assert/strict');
const { scenes } = require('../lib/scenes'), { record } = require('../lib/record'), hash = require('../lib/hash'), { openScene, load } = require('../lib/harness');
const { cradle, sceneXml } = require('../lib/demo-scenes');
const sc = (id) => scenes.find((s) => s.id === id), M = async (id, eng) => { const s = sc(id), r = await record(s, eng); return Object.values(s.analyse(r.tr)); };

test('registry: builtin, rapier, cannon and cannon-raw are registered; an unknown name throws', async () => {
  const { BR } = await load(), E = BR.physEngines;
  assert.deepEqual(Array.from(E.list()).sort(), ['builtin', 'cannon', 'cannon-raw', 'rapier']);
  assert.throws(() => E.use('havok'), /not registered/);
  assert.equal(E.engines.rapier.version, '0.21.0'); assert.equal(require('cannon-es/package.json').version, '0.20.0');
});

for (const eng of ['builtin', 'rapier', 'cannon']) {
  test(`${eng}: drop and rest (free fall to contact at 0.983 s, rests at 0.5 m)`, async () => {
    const [apex, rest, t0] = await M('drop-bounce', eng);
    assert.ok(Math.abs(rest - 0.5) < 0.005, 'rest ' + rest); assert.ok(Math.abs(t0 - 0.983) < 0.02, 'first contact ' + t0);
    if (eng === 'cannon') assert.ok(apex > 1.18 && apex < 1.30, 'cannon-es restitution overshoot is the documented +10% (apex ' + apex + ')'); else assert.ok(Math.abs(apex - 1.125) < 0.02, 'apex ' + apex);
  });
  test(`${eng}: three-box stack rests at 0.5 / 1.5 / 2.5 with no sideways creep`, async () => {
    const [b1, b2, b3, drift] = await M('stack3', eng);
    for (const [v, w] of [[b1, 0.5], [b2, 1.5], [b3, 2.5]]) assert.ok(Math.abs(v - w) < 0.015, `${v} vs ${w}`);
    assert.ok(drift < 0.03, 'drift ' + drift);
  });
  test(`${eng}: pendulum period within 0.6% of the physical-pendulum formula, arm length held`, async () => {
    const [, err, arm, amp] = await M('pendulum-ball', eng);
    assert.ok(err < 0.6, 'period error % ' + err); assert.ok(arm < 0.001, 'arm drift ' + arm); assert.ok(amp > 0.33 && amp < 0.36, 'amplitude ' + amp);
  });
  test(`${eng}: hinge and slider limits hold (<= 1% overshoot)`, async () => {
    const [hmax] = await M('hinge-limit', eng), [smax] = await M('slider-limit', eng);
    assert.ok(hmax <= 1.01, 'hinge max angle ' + hmax); assert.ok(smax <= 1.51, 'slider max separation ' + smax);
  });
  test(`${eng}: head-on elastic billiards conserve momentum within 0.5%`, async () => {
    const [a, b, dp, de] = await M('billiards-head-on', eng);
    assert.ok(dp < 0.5, 'momentum % ' + dp);
    if (eng === 'cannon') assert.ok(de > 10 && de < 18, 'cannon-es adds the documented ~14% energy on an elastic hit (' + de + ' %)'); else assert.ok(de < 1, 'energy % ' + de);
  });
  test(`${eng}: Coulomb slope (mu 0.2, 25.6 deg ramp): acceleration within 0.3 m/s2 of g(sin - mu cos) = 3.19`, async () => {
    const [, acc] = await M('slope-mu0.2', eng);
    assert.ok(Math.abs(acc - 3.19) < (eng === 'cannon' ? 0.3 : 0.05), 'acceleration ' + acc);
  });
}

test('cannon-raw sticks: unpatched cannon-es friction holds the box on the ramp (the bug the adapter patch fixes)', async () => {
  const [, acc] = await M('slope-mu0.2', 'cannon-raw'); assert.ok(acc < 0.1, 'acceleration ' + acc);
});

test('rapier holds the hinge and slider at the limit after impact (stopBounce 0)', async () => {
  const [, h3] = await M('hinge-limit', 'rapier'), [, s3] = await M('slider-limit', 'rapier');
  assert.ok(h3 > 0.98, 'hinge at 3 s ' + h3); assert.ok(s3 > 1.49, 'slider at 3 s ' + s3);
});

// determinism: bit-identical positions run to run, and for any pacing of the frames (the bridge steps a fixed 1/240 s grid)
for (const id of ['drop-bounce', 'stack3', 'pendulum-ball']) for (const eng of ['builtin', 'rapier', 'cannon']) {
  test(`determinism ${id} / ${eng}: two runs equal, and equal at 60 Hz and under 40 ms / 8.3 ms jitter`, async () => {
    const s = sc(id), a = await record(s, eng), b = await record(s, eng), j = await record(s, eng, { pattern: 'jitter' });
    assert.equal(hash(a.tr), hash(b.tr)); assert.equal(hash(a.tr, true), hash(j.tr, true));
  });
}

test('sensor frame mode: a CollisionSensor reports the first impact in 24 of 24 drops on the same grid (builtin last-substep reports it in 6)', async () => {
  const { head, tail, col } = require('../lib/scenes'), hs = Array.from({ length: 24 }, (_, i) => +(3 + i * 0.0137).toFixed(4));
  const xml = (h) => head('impact') + `<CollisionSensor DEF="CS"><CollisionCollection containerField="collider" bounce="0.9"><CollidableShape DEF="GS" containerField="collidables"><Shape containerField="shape"><Box size="40 1 40"/></Shape></CollidableShape><CollidableShape DEF="BS" containerField="collidables"><Shape containerField="shape"><Sphere radius="0.5"/></Shape></CollidableShape></CollisionCollection></CollisionSensor>`
    + `<RigidBodyCollection DEF="W" gravity="0 -9.8 0">${col('bounce="0.9" minBounceSpeed="0" appliedParameters=\'"BOUNCE"\'')}<RigidBody DEF="G" position="0 -0.5 0" mass="1" fixed="true"><CollidableShape USE="GS" containerField="geometry"/></RigidBody><RigidBody DEF="S" position="0 ${h} 0" mass="1"><CollidableShape USE="BS" containerField="geometry"/></RigidBody></RigidBodyCollection>` + tail;
  const seen = async (eng, mode, h) => { const s = await openScene(xml(h), eng, { contactMode: mode }), cs = s.node('CS'); let on = 0, prev = false; for (let i = 0; i < 78; i++) { s.advance(1 / 60); const a = !!cs.f.isActive; if (a && !prev) on++; prev = a; } return on > 0; };
  for (const eng of ['rapier', 'cannon']) { let n = 0; for (const h of hs) if (await seen(eng, 'frame', h)) n++; assert.equal(n, 24, eng + ' frame mode saw ' + n + ' of 24'); }
  let b = 0; for (const h of hs) if (await seen('builtin', 'last', h)) b++; assert.ok(b < 24, 'the built-in last-substep mode misses impacts (saw ' + b + ' of 24)');
});

test('rapier sub-steps: the cradle passes the impulse to the last ball with 4 sub-steps per tick but not with 1', async () => {
  const run = async (sub) => { const c = cradle(), s = await openScene(sceneXml(c, 'live'), 'rapier'); s.BR.physEngines.rapierOpts = { sub }; const b = s.node('B_ball4'); let mx = -9, mn = 9; for (let i = 0; i < 480; i++) { s.advance(1 / 60); const y = b.f.position[1]; mx = Math.max(mx, y); mn = Math.min(mn, y); } return mx - mn; };
  const r1 = await run(1), r4 = await run(4); assert.ok(r1 < 0.3, 'sub 1 rise ' + r1); assert.ok(r4 > 0.55 && r4 < 0.75, 'sub 4 rise ' + r4);
});
