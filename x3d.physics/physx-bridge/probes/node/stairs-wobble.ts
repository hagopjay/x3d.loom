// Sweep the page's random push wobble (and push strength, character) to find starts that blow up.
import { stairs } from '../../tools/stairs-sim.ts';
for (const ch of ['dummy', 'cartoon'] as const) for (const push of [1, 2.5, 5]) for (const wob of [-0.3, -0.15, 0, 0.15, 0.3]) {
  const r = await stairs(push, ch, 0, 0, process.env.BOOM !== "0", wob);
  if (r.nan || r.maxLinkSpeed > 40 || r.ouch.total > 50000) console.log('BAD', ch, push, wob, 'nan', r.nan, 'vmax', r.maxLinkSpeed.toFixed(1), 'ouch', r.ouch.total);
  else process.stdout.write('.');
}
console.log(' done');
