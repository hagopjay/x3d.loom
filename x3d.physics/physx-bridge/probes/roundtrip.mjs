// Compare the bridge reader's SceneModel (X3D text -> X_ITE -> reader) with toModel(buildIR(machine)) body by body.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ locale: 'en-US' });
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'machine.html');
await page.waitForFunction(() => window.__mm?.ready || window.__mm?.error, null, { timeout: 60000 });
await page.keyboard.press('Tab');
await page.waitForFunction(() => window.__mm.mode === 'run' && window.__mm.bridge.lastState, null, { timeout: 60000 });
const r = await page.evaluate(() => {
  const S = window.__mm, read = S.bridge.model, ref = S.toModel(S.buildIR(S.machine));
  const A = read.collections[0], B = ref.collections[0];
  const d = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
  const diffs = [];
  const byDef = new Map(A.bodies.map((b) => [b.def, b]));
  for (const rb of B.bodies) {
    const ab = byDef.get(rb.def);
    if (!ab) { diffs.push({ def: rb.def, issue: 'missing in reader' }); continue; }
    const issues = [];
    if (d(ab.pose.p, rb.pose.p) > 1e-5) issues.push(['pose.p', ab.pose.p, rb.pose.p]);
    const qd = Math.min(d(ab.pose.q, rb.pose.q), d(ab.pose.q.map((x) => -x), rb.pose.q)); if (qd > 1e-5) issues.push(['pose.q', ab.pose.q, rb.pose.q]);
    if (ab.fixed !== rb.fixed || ab.kinematic !== rb.kinematic) issues.push(['fixed/kinematic', [ab.fixed, ab.kinematic], [rb.fixed, rb.kinematic]]);
    if (Math.abs(ab.mass - rb.mass) > 1e-9) issues.push(['mass', ab.mass, rb.mass]);
    if (ab.shapes.length !== rb.shapes.length) issues.push(['shapes', ab.shapes.length, rb.shapes.length]);
    else ab.shapes.forEach((as, i) => {
      const rs = rb.shapes[i];
      if (d(as.local.p, rs.local.p) > 1e-5) issues.push([`shape${i}.local.p`, as.local.p, rs.local.p]);
      const sq = Math.min(d(as.local.q, rs.local.q), d(as.local.q.map((x) => -x), rs.local.q)); if (sq > 1e-5) issues.push([`shape${i}.local.q`, as.local.q, rs.local.q]);
      if (as.geom.kind !== rs.geom.kind) issues.push([`shape${i}.kind`, as.geom.kind, rs.geom.kind]);
      else if (as.geom.kind === 'box' && d(as.geom.half, rs.geom.half) > 1e-6) issues.push([`shape${i}.half`, as.geom.half, rs.geom.half]);
      else if (as.geom.kind === 'sphere' && Math.abs(as.geom.radius - rs.geom.radius) > 1e-6) issues.push([`shape${i}.r`, as.geom.radius, rs.geom.radius]);
      else if ((as.geom.kind === 'mesh' || as.geom.kind === 'convex') && (as.geom.points.length !== rs.geom.points.length || d(as.geom.points, rs.geom.points) > 1e-4)) issues.push([`shape${i}.points`, as.geom.points.length, rs.geom.points.length]);
    });
    if (issues.length) diffs.push({ def: rb.def, issues });
  }
  const jd = []; B.joints.forEach((rj, k) => { const aj = A.joints.find((j) => j.def === rj.def); if (!aj) jd.push([rj.def, 'missing']); else if (aj.body1 !== rj.body1 || aj.body2 !== rj.body2) jd.push([rj.def, 'bodies', [aj.body1, aj.body2], [rj.body1, rj.body2]]); });
  return { readerBodies: A.bodies.length, refBodies: B.bodies.length, surface: [A.surface, B.surface], diffs, jointDiffs: jd };
});
writeFileSync('evidence/p3-roundtrip.json', JSON.stringify(r, null, 1));
console.log('bodies', r.readerBodies, r.refBodies, 'body diffs', r.diffs.length, 'joint diffs', r.jointDiffs.length);
console.log(JSON.stringify(r.diffs.slice(0, 6), null, 0).slice(0, 2500));
console.log('surface', JSON.stringify(r.surface).slice(0, 600));
await browser.close();
