// Speed: a pile of N bodies (half spheres r 0.4, half boxes 0.7) dropped in a 5 x n x 5 grid onto a ground, 3 s of sim at 60 Hz ticks (720 sub-steps of 1/240 s). Wall ms per sub-step, in Node and in Chromium.
const fs = require('fs'), path = require('path'), { head, tail, col, rb, GROUND } = require('../lib/scenes'), { record } = require('../lib/record'), { withHost } = require('../lib/browser-host');
const pile = (N) => { let b = ''; for (let i = 0; i < N; i++) { const x = (i % 5) * 1.1 - 2.2, z = (Math.floor(i / 5) % 5) * 1.1 - 2.2, y = 1 + Math.floor(i / 25) * 1.1 + (i % 7) * 0.01; b += rb('P' + i, [x, y, z], i % 2 ? '<Box size="0.7 0.7 0.7"/>' : '<Sphere radius="0.4"/>', 'mass="1"'); }
  return { id: 'pile' + N, T: 3, probes: ['P0'], xml: head('pile') + `<RigidBodyCollection DEF="W" gravity="0 -9.8 0">${col('bounce="0.1" appliedParameters=\'"BOUNCE" "FRICTION_COEFFICIENT-2"\' frictionCoefficients="0.5 0.5"')}${GROUND()}${b}</RigidBodyCollection>` + tail }; };
(async () => {
  const sizes = [25, 100, 250], engines = ['builtin', 'rapier', 'cannon'], out = { steps: 720 };
  for (const N of sizes) { out['N' + N] = { node: {}, chromium: {} }; for (const e of engines) { const best = []; for (let k = 0; k < 3; k++) best.push((await record(pile(N), e)).ms); out['N' + N].node[e] = +(Math.min(...best) / 720).toFixed(3); console.log('node', N, e, out['N' + N].node[e], 'ms/step (best of 3)'); } }
  await withHost(async (run, ver) => { out._chromium = ver;
    for (const N of sizes) for (const e of engines) { const best = []; for (let k = 0; k < 3; k++) { const sc = pile(N); const r = await run(sc.xml, sc.probes, sc.T, e); best.push(r.ms); } out['N' + N].chromium[e] = +(Math.min(...best) / 720).toFixed(3); console.log('chromium', N, e, out['N' + N].chromium[e], 'ms/step (best of 3)'); } });
  fs.writeFileSync(path.join(__dirname, '..', 'results', 'speed.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
