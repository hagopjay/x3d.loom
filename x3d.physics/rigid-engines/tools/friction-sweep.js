// Critical slope angle of a 1 m cube with Coulomb mu: slides above atan(mu). Per engine: the smallest angle (1 degree steps) at which the cube is faster than 0.1 m/s after 2 s, and the speed there vs analytic.
const fs = require('fs'), path = require('path'), { head, tail, col, shape, g } = require('../lib/scenes'), { openScene } = require('../lib/harness');
const sc = (deg, mu) => { const th = deg * Math.PI / 180, n = [-Math.sin(th), Math.cos(th)];
  return head('slope') + `<RigidBodyCollection DEF="W" gravity="0 -${g} 0">${col(`bounce="0" frictionCoefficients="${mu} ${mu}" appliedParameters='"FRICTION_COEFFICIENT-2"'`)}<RigidBody DEF="G" position="0 0 0" orientation="0 0 1 ${th}" mass="1" fixed="true">${shape('<Box size="60 1 60"/>')}</RigidBody><RigidBody DEF="C" position="${n[0]} ${n[1] + 0.002} 0" orientation="0 0 1 ${th}" mass="1">${shape('<Box size="1 1 1"/>')}</RigidBody></RigidBodyCollection>` + tail; };
(async () => {
  const out = {};
  for (const mu of [0.2, 0.5]) {
    out[mu] = { analytic_deg: +(Math.atan(mu) * 180 / Math.PI).toFixed(1) };
    for (const eng of ['builtin', 'rapier', 'cannon', 'cannon-raw']) {
      let crit = null;
      for (let deg = 3; deg <= 75; deg++) {
        const s = await openScene(sc(deg, mu), eng); for (let i = 0; i < 120; i++) s.advance(1 / 60);
        const v = s.node('C').f.linearVelocity, th = deg * Math.PI / 180, sp = -(v[0] * Math.cos(th) + v[1] * Math.sin(th));
        if (sp > 0.1) { crit = deg; break; }
      }
      out[mu][eng] = crit; console.log('mu', mu, eng.padEnd(10), 'slides from', crit, 'deg; analytic', out[mu].analytic_deg);
    }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'results', 'friction-sweep.json'), JSON.stringify(out, null, 1));
})();
