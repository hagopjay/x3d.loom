// The CollisionSensor lottery. A bouncy sphere (bounce 0.9, so it never rests) is dropped from 24 slightly different heights, so the impact lands on a different sub-step of the 1/240 s grid and
// a different 1/60 s frame. For each: did the sensor report isActive = true during the first impact? Counted from the events, as a page would hear them.
const fs = require('fs'), path = require('path'), { head, tail, col, rb, GROUND, shape } = require('../lib/scenes'), { openScene } = require('../lib/harness'), { withBrowser } = require('../lib/xite');
const hs = Array.from({ length: 24 }, (_, i) => +(3 + i * 0.0137).toFixed(4));
const xml = (h) => head('impact') + `<CollisionSensor DEF="CS"><CollisionCollection containerField="collider" bounce="0.9"><CollidableShape DEF="GS" containerField="collidables"><Shape containerField="shape"><Box size="40 1 40"/></Shape></CollidableShape><CollidableShape DEF="BS" containerField="collidables"><Shape containerField="shape"><Sphere radius="0.5"/></Shape></CollidableShape></CollisionCollection></CollisionSensor>`
  + `<RigidBodyCollection DEF="W" gravity="0 -9.8 0">${col('bounce="0.9" minBounceSpeed="0" appliedParameters=\'"BOUNCE"\'')}<RigidBody DEF="G" position="0 -0.5 0" mass="1" fixed="true"><CollidableShape USE="GS" containerField="geometry"/></RigidBody><RigidBody DEF="S" position="0 ${h} 0" mass="1"><CollidableShape USE="BS" containerField="geometry"/></RigidBody></RigidBodyCollection>` + tail;
// the sphere reaches the ground at sqrt(2 (h - 0.5) / g) ~ 0.8 s; look at 0 .. 1.3 s (the first bounce only reaches 0.81 of the drop height, so it is airborne by then)
async function ours(eng, mode, h) {
  const s = await openScene(xml(h), eng, { contactMode: mode }), cs = s.node('CS'); let on = 0, prev = false;
  for (let i = 0; i < 78; i++) { s.advance(1 / 60); const a = !!cs.f.isActive; if (a && !prev) on++; prev = a; }     // a rising isActive seen after a tick: what a page hears
  return on;
}
(async () => {
  const out = { heights: hs, T_s: 1.3 };
  const rows = [['builtin', 'last'], ['rapier', 'last'], ['rapier', 'frame'], ['cannon', 'last'], ['cannon', 'frame']];
  for (const [e, m] of rows) { const k = e + '/' + m; const r = []; for (const h of hs) r.push(await ours(e, m, h)); out[k] = { detected: r.filter((x) => x > 0).length, of: hs.length, per_height: r }; console.log(k.padEnd(14), 'impact seen in', out[k].detected, 'of', hs.length); }
  const { chromium } = require('playwright');
  await withBrowser(async (b, base) => {
    const pg = await b.newPage(); await pg.goto(base); await pg.waitForFunction(() => window.X3D && window.rec); const r = [];
    for (const h of hs) r.push(await pg.evaluate(async (x) => { const B = X3D.getBrowser(document.getElementById('c')); await B.loadComponents(B.getProfile('Full'), B.getComponent('RigidBodyPhysics')); const sc = await B.createX3DFromString(x); let on = 0, off = 0;
      sc.getNamedNode('CS').getField('isActive').addFieldCallback('t', (v) => { if (v) on++; else off++; }); await B.replaceWorld(sc); const t0 = performance.now(); await new Promise((res) => { const l = () => (performance.now() - t0 > 1300 ? res() : requestAnimationFrame(l)); l(); }); return { on, off, fps: 0 }; }, xml(h)));
    out['xite'] = { detected: r.filter((x) => x.on > 0).length, of: hs.length, per_height: r.map((x) => x.on) }; console.log('xite'.padEnd(14), 'impact seen in', out.xite.detected, 'of', hs.length, '(X_ITE 16.6.0, Chromium ' + b.version() + ')');
  });
  fs.writeFileSync(path.join(__dirname, '..', 'results', 'sensor-impact.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
