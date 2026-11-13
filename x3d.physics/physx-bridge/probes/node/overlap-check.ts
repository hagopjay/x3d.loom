// Do any two castle stones overlap at the start? (axis-aligned boxes after the 90° turns; a few mm of tolerance)
import { buildBarrage, defaultBarrage } from '../../src/ragdoll/barrage-scene.ts';
const { ir, idx } = buildBarrage(defaultBarrage());
const box = (i: number) => { const b = ir.bodies[i], s = b.shapes[0].geom as { size: number[] }, turned = Math.abs(b.pose.q[1]) > 0.5; const hx = (turned ? s.size[2] : s.size[0]) / 2, hz = (turned ? s.size[0] : s.size[2]) / 2; return [b.pose.p[0] - hx, b.pose.p[0] + hx, b.pose.p[1] - s.size[1] / 2, b.pose.p[1] + s.size[1] / 2, b.pose.p[2] - hz, b.pose.p[2] + hz]; };
let n = 0; const B = idx.blocks.map(box);
for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j], e = 0.005; if (a[0] < b[1] - e && b[0] < a[1] - e && a[2] < b[3] - e && b[2] < a[3] - e && a[4] < b[5] - e && b[4] < a[5] - e) n++; }
console.log('overlapping stone pairs:', n, 'of', B.length, 'stones');
