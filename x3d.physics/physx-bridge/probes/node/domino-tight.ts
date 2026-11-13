import { runDominoes } from '../../tools/domino-sim.ts';
import { PRESETS, H, T } from '../../src/demos/dominoes-scene.ts';
for (const gap of [0.1, 0.15, 0.2, 0.3]) for (const mu of [0.1, 0.3]) {
  const run = PRESETS.line(gap); run.friction = mu; run.strokes[0].path = [[0, -0.6], [0, -0.6 + 30 * (gap * H + T)]];
  const r = await runDominoes(run, 6);
  console.log(gap, mu, 'fallen', r.fallen, r.fall.slice(0, 12).map((x) => x?.toFixed(2)).join(' '));
}
