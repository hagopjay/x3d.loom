# rigid-engines: Rapier and cannon-es behind X3D RigidBodyPhysics

Two JavaScript physics engines, **Rapier 0.21.0** (WASM, `@dimforge/rapier3d-compat`) and **cannon-es 0.20.0**, plugged into the `RigidBodyCollection` of the x3d.loom bridges (Babylon `x3d.webgpu/bridge`, three.js `x3d.threejs/bridge`) through one adapter that works with the built-in engine unchanged. Every number below is tied to its rig; none is a claim about other hardware.

Rig for every number: Chromium 153.0.8010.12 (SwiftShader), Node v22.23.4, X_ITE 16.6.0 (Ammo/Bullet), three r187, Rapier 0.21.0, cannon-es 0.20.0. Raw results: `results/*.json`. Id prefix for this work: **ENG** (docs ch. 13 section 10: H-ENG hypotheses, N-ENG numbers, D-ENG decisions).

## Wire it in (no edit to a bridge file)

```html
<script type="module">
  import RAPIER from '@dimforge/rapier3d-compat'; import * as CANNON from 'cannon-es';
  await RAPIER.init(); window.__physLibs = { RAPIER, CANNON };        // either one is optional
</script>
<script src="bridge.bundle.js"></script>                              <!-- the bridge as built today -->
<script src="engines.js"></script><script src="engine-rapier.js"></script><script src="engine-cannon.js"></script>
<script>
  __bridge.physEngines.use('rapier', { contactMode: 'frame' });       // 'builtin' (default) | 'rapier' | 'cannon' | 'cannon-raw'
</script>
```

`engines.js` replaces ONE function, `BR.phys.tick`, and keeps the original as `BR.phys.builtinTick`. Switching back to `'builtin'` restores the original behaviour. A scene needs no script and no change: RigidBody / CollidableShape / joints / CollisionSensor are read as before, so a ROUTE from `RigidBody.position` to a Transform works with any engine.

Options: `use(name, { contactMode })`. `contactMode: 'last'` reports the contacts of the last 1/240 s sub-step of a tick (original behaviour); `'frame'` merges the contacts of every sub-step of the tick (the fix for the CollisionSensor impact lottery, table N-ENG-6). `E.rapierOpts = { sub: 4 }` runs 4 Rapier sub-steps per 1/240 s step (stiff chains, N-ENG-9). `E.rapierPgs(n)` sets `numInternalPgsIterations`.

Engine contract (`BR.physEngines.register(name, engine)`): `create(ctx) -> { step(h), pushFrom(B), contacts(), setGravity(g), jointState(J), dispose() }`; a node an engine cannot take goes into `ctx.notes` (shown in `BR.physEngines.notes`), never dropped silently.

## Results

Analytic scenes (Node, `results/fidelity-node.json`; each scene is a plain X3D 4.0 file in `fixtures/`):

| Scene (analytic answer) | built-in | Rapier | cannon-es (patched) | cannon-es raw | X_ITE 16.6.0, first / repeat run |
|---|---|---|---|---|---|
| Drop, bounce 0.5: apex above contact (1.125 m) | 1.125 | 1.121 | 1.235 | 1.235 | 0.784 / 0.522 |
| Three-box stack: top box height (2.5 m) | 2.490 | 2.498 | 2.500 | 2.500 | 2.500 / 2.500 |
| Slope, mu 0.2: acceleration (3.19 m/s2) | 3.20 | 3.20 | 3.43 | 0 (sticks) | 4.09 / 4.50 |
| Pendulum: period error vs physical-pendulum formula | 0.27 % | 0.19 % | 0.44 % | 0.44 % | 1.56 % / 5.83 % |
| Hinge, limit 1.0 rad: max angle | 1.000 | 1.000 | 1.008 | 1.008 | 3.121 / 3.132 (limit never applied) |
| Slider, limit 1.5 m: max separation | 1.500 | 1.500 | 1.505 | 1.505 | 1.500 / 1.499 |
| Elastic head-on hit: energy error | 0.39 % | 0.38 % | 14.02 % | 14.02 % | 9.55 % / 3.06 % |

Friction ramp (angle where a box starts to slide, `results/friction-sweep.json`): mu 0.2 analytic 11.3 deg: 12 / 12 / 12 / **45** (built-in / Rapier / cannon patched / cannon raw); mu 0.5 analytic 26.6 deg: 27 / 27 / 25 / **45**.

Determinism (`results/determinism.json`, 21 runs = 7 scenes x 3 engines): every run repeatable bit for bit in one process (21 of 21); final state identical between 60 Hz ticks and a 40 ms / 8.3 ms jitter pattern on the same sim clock (21 of 21); positions bit-identical between Node 22 and Chromium 153 (maximum difference 0 m in 21 of 21); the whole trace including orientation matches in 9 of 21, the rest differ by at most 1.1e-16 in the axis-angle orientation (host acos/atan2 in two V8 builds). X_ITE 16.6.0 repeats poorly (apex 0.784 vs 0.522 m on the same scene).

Speed (`results/speed.json`, wall ms per 1/240 s sub-step, best of 3, pile of N bodies, half spheres half boxes):

| N | built-in, Chromium | Rapier, Chromium | cannon, Chromium | built-in, Node | Rapier, Node | cannon, Node |
|---|---|---|---|---|---|---|
| 25 | 0.387 | 0.462 | 0.313 | 1.361 | 0.187 | 0.361 |
| 100 | 1.883 | 0.842 | 0.733 | 4.748 | 0.543 | 0.755 |
| 250 | 3.966 | 1.642 | 2.142 | 15.989 | 1.593 | 2.574 |

Chromium numbers are the ones to trust (the bridge runs there); Node's V8 inflates the pure-JS built-in engine.

CollisionSensor impact (`results/sensor-impact.json`): a bouncy sphere dropped from 24 heights spaced so the impact lands on different sub-steps. First impact reported as `isActive`: built-in `last` 6 of 24, Rapier `last` 11 of 24, cannon `last` 5 of 24, X_ITE 16.6.0 4 of 24; Rapier `frame` **24 of 24**, cannon `frame` **24 of 24**.

## Known findings (each is reproduced by a test)

- **cannon-es friction is in the wrong unit** (`cannon-raw`): its Gauss-Seidel solver returns an impulse, but the friction bound is a force and is applied per contact point, so at 1/240 s a box sticks until 45 deg whatever mu is. The adapter wraps the solver (`bound = mu * m_reduced * |g.n| * dt / points`); `cannon-raw` keeps the stock behaviour for comparison.
- cannon-es restitution adds energy (+14 % in an elastic hit, apex +10 %); a bounce-1 chain gains it per contact (cradle, below).
- Rapier at one step per 1/240 s passes an impulse through a resting chain poorly: the cradle's last ball rises 0.22 m with a 0.71 m lift; with 4 sub-steps 0.65 m (built-in 0.62 m); `numInternalPgsIterations` and solver iterations did not help in any combination tried (1..8, 10..20), `contact_natural_frequency` neither.
- The built-in engine has no collider for `Cone` (finder lacks `bottomRadius`): all 10 cones of the 40-body avalanche demo fall through the funnel. Reported, not edited here.
- X_ITE 16.6.0: no hinge limits are ever applied, the step is frame-rate dependent, results are not repeatable (docs ch. 13 section 9).

## Run it

```
npm install
export NODE_PATH=$PWD/node_modules:/path/to/playwright
node --test test/engines.test.js               # 32 tests, about 1 minute
node tools/fidelity-node.js                    # results/fidelity-node.json
node tools/fidelity-xite.js                    # results/fidelity-xite.json  (needs playwright + vendored X_ITE)
node tools/determinism.js    node tools/speed.js    node tools/sensor-impact.js    node tools/friction-sweep.js
node tools/emit-fixtures.js                    # fixtures/*.x3d + index.json
node tools/record-demo.js OUT_DIR              # the script-free replays of the demo page
```

Joint coverage: BallJoint, SingleAxisHingeJoint (limits), SliderJoint (limits), MotorJoint torque (Rapier and cannon), UniversalJoint / DoubleAxisHingeJoint (locked twist only; angle limits and motors are listed in `notes`). Shapes: Box, Sphere, Cylinder, Cone (Rapier native, cannon as a 12-segment cylinder).
