// The crash-test maths: the HIC-style head score from velocity samples, and the heat colour scale. Tolerances, not exact values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLD, HEAT_STOPS, HIC_WINDOW, heatColor, hicFromVelocities } from '../src/ragdoll/crashtest.ts';
import type { Vec3 } from '../src/bridge/model.ts';

const pulse = (g: number, width: number, every: number) =>
  Array.from({ length: Math.round(0.1 / every) + 1 }, (_, i) => { const t = i * every; return { t, v: [Math.min(t, width) * g * 9.81, 0, 0] as Vec3 }; });

test('HIC of a square pulse matches the textbook value within 5 %', () => {
  // a constant 50 g for 36 ms: HIC36 = 0.036 · 50^2.5 ≈ 636
  const want = HIC_WINDOW * 50 ** 2.5;
  const got = hicFromVelocities(pulse(50, 0.036, 0.001));
  assert.ok(Math.abs(got - want) / want < 0.05, `got ${got.toFixed(0)}, want ${want.toFixed(0)}`);
});

test('frame-rate samples give a lower bound, not zero', () => {
  // at 60 Hz the samples are 16.7 ms apart; at 10 Hz, 100 ms apart (wider than a window): both still read
  const want = HIC_WINDOW * 50 ** 2.5;
  for (const every of [1 / 60, 0.1]) {
    const got = hicFromVelocities(pulse(50, 0.036, every));
    assert.ok(got > 0 && got <= want * 1.05, `every ${every}: ${got.toFixed(0)}`);
  }
});

test('the heat scale runs from cold grey through the stops', () => {
  assert.deepEqual(heatColor(COLD, 0), COLD);
  for (const [g, c] of HEAT_STOPS) heatColor(COLD, g).forEach((x, i) => assert.ok(Math.abs(x - c[i]) < 1e-9));
  // the warm ramp (from the first stop on) runs light to dark: the green channel never rises. Grey to yellow brightens, by design.
  let last = 2;
  for (let g = HEAT_STOPS[0][0]; g <= 250; g += 5) { const c = heatColor(COLD, g); assert.ok(c[1] <= last + 1e-9, `green rose at ${g} g`); last = c[1]; }
});
