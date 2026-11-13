// Which standing starts blow up? height, tilt, push; first NaN step and the link that went first.
import { dropDummy } from '../../tools/ragdoll-sim.ts';
for (const [h, push, tilt] of [[0.05, 0, 0], [0.05, 0, 0.4], [0.3, 0, 0], [0.3, 0, 0.4], [0.02, 0.5, 0.1], [0.5, 0, 0]] as const) {
  const r = await dropDummy(h, push, 3, tilt);
  console.log(`h ${h} push ${push} tilt ${tilt}: nan ${r.nan} maxSpeed ${r.maxLinkSpeed} rootEnd ${r.rootHeightEnd} impacts ${r.impacts}`);
}
