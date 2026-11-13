// usage: node probes/run-joints.mjs [browser]  -- joints-and-sensors.x3d on PhysX (bridge) and Bullet (X_ITE), with SAI probes on every output
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium'] = process.argv;
const B = { chromium, firefox, webkit }[which];
const browser = await B.launch(which === 'chromium' ? { channel: 'chromium' } : {});
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1400, height: 900 } });
const logs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); }); page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'sidebyside.html?scene=scenes/joints-and-sensors.x3d');
await page.waitForFunction(() => window.__sbs?.ready || window.__sbs?.error, null, { timeout: 60000 });
const err = await page.evaluate(() => window.__sbs.error); if (err) { console.log('ERROR', err, logs); process.exit(1); }
await page.evaluate(() => {
  const S = window.__sbs, sc = S.bridge.scene;
  const P = window.__probe = { events: {}, samples: [], contactSample: null, lamp: [] };
  const watch = (def, field) => sc.getNamedNode(def).addFieldCallback('probe-' + field, field, () => { const k = def + '.' + field; P.events[k] = (P.events[k] ?? 0) + 1; });
  for (const [d, f] of [['SeesawHinge', 'angle'], ['FlipperHinge', 'angle'], ['FlipperMotor', 'motor1Angle'], ['WheelAxle', 'hinge2AngleRate'], ['Launcher', 'separation'], ['Cardan', 'body2Axis'], ['Pendulum', 'body1AnchorPoint'], ['BenchSensor', 'contacts'], ['BenchSensor', 'isActive'], ['ContactLamp', 'on']]) watch(d, f);
  sc.getNamedNode('ContactLamp').addFieldCallback('lamp', 'on', (v) => P.lamp.push([+S.bridge.stats.simTime.toFixed(3), v]));
  sc.getNamedNode('BenchSensor').addFieldCallback('cs', 'contacts', (v) => { if (!P.contactSample && v.length) { const c = v[0]; P.contactSample = { n: v.length, body1: c.body1?.getNodeName(), body2: c.body2?.getNodeName(), geometry1: c.geometry1?.getNodeName(), geometry2: c.geometry2?.getNodeName(), position: [c.position.x, c.position.y, c.position.z], normal: [c.contactNormal.x, c.contactNormal.y, c.contactNormal.z], depth: c.depth, bounce: c.bounce, frictionCoefficients: [c.frictionCoefficients.x, c.frictionCoefficients.y], appliedParameters: Array.from(c.appliedParameters) }; } });
  const v3 = (f) => [f.x, f.y, f.z].map((x) => +x.toFixed(4));
  P.sample = () => {
    const n = (d) => sc.getNamedNode(d), bt = (d) => S.btScene.getNamedNode(d);
    P.samples.push({ t: +S.bridge.stats.simTime.toFixed(3), wall: +((performance.now() - S.startWall) / 1000).toFixed(3),
      seesaw: +n('SeesawHinge').angle.toFixed(4), flipper: +n('FlipperHinge').angle.toFixed(4), flipperMotor: +n('FlipperMotor').motor1Angle.toFixed(4),
      wheelRate: +n('WheelAxle').hinge2AngleRate.toFixed(3), launcher: +n('Launcher').separation.toFixed(4),
      pendulumAnchorGap: +Math.hypot(n('Pendulum').body1AnchorPoint.x - n('Pendulum').body2AnchorPoint.x, n('Pendulum').body1AnchorPoint.y - n('Pendulum').body2AnchorPoint.y, n('Pendulum').body1AnchorPoint.z - n('Pendulum').body2AnchorPoint.z).toExponential(2),
      elevator: v3(n('ElevatorBody').position), cube: v3(n('CubeBody').position), marbleB: v3(n('MarbleBBody').position), marbleC: v3(n('MarbleCBody').position), rod: v3(n('RodBody').position),
      bullet: { cube: v3(bt('CubeBody').position), marbleB: v3(bt('MarbleBBody').position), marbleC: v3(bt('MarbleCBody').position), rod: v3(bt('RodBody').position), flipper: v3(bt('FlipperBody').position), wheelAngle: +bt('WheelBody').orientation.angle.toFixed(3) },
      pxElevatorY: (() => { const b = S.bridge, i = b.readResult.bodyNodes.findIndex((x) => x.getNodeName() === 'ElevatorBody'), st = b.lastState; return st ? +st[i * 13 + 1].toFixed(4) : null; })(),
      lampOn: n('ContactLamp').on, physicsUsPerStep: Math.round(S.bridge.stats.physicsMsPerStep * 1000) });
  };
});
await page.screenshot({ path: `evidence/p2-joints-${which}-t0.png` });
await page.keyboard.press('Space');
const t0 = Date.now(); let fired = { flipper: null, launcher: null };
while (Date.now() - t0 < 5000) {
  await page.waitForTimeout(100);
  const el = Date.now() - t0;
  if (el > 1500 && !fired.flipper) fired.flipper = await page.evaluate(() => { window.__sbs.bridge.setField('FlipperMotor', 'axis1Torque', 0.08); return window.__sbs.bridge.stats.simTime; });
  if (el > 2000 && !fired.launcher) fired.launcher = await page.evaluate(() => { const S = window.__sbs; S.bridge.setField('Launcher', 'sliderForce', 3); S.btScene.getNamedNode('Launcher').sliderForce = 3; S.btScene.getNamedNode('FlipperMotor').axis1Torque = 0.08; return S.bridge.stats.simTime; });
  await page.evaluate(() => window.__probe.sample());
  if (el > 2300 && el < 2500) await page.screenshot({ path: `evidence/p2-joints-${which}-mid.png` });
}
await page.keyboard.press('Space');
await page.screenshot({ path: `evidence/p2-joints-${which}-end.png` });
const out = await page.evaluate(() => ({ probe: window.__probe, stats: window.__sbs.bridge.stats, report: { notes: window.__sbs.bridge.report.notes, lostAuthored: window.__sbs.bridge.report.lostAuthored, summary: window.__sbs.bridge.report.summary } }));
out.fired = fired;
writeFileSync(`evidence/p2-joints-${which}.json`, JSON.stringify({ browser: which, version: browser.version(), ...out, consoleErrors: logs }, null, 1));
const S = out.probe.samples, last = S[S.length - 1];
const max = (f) => Math.max(...S.map(f)), min = (f) => Math.min(...S.map(f));
console.log(which, browser.version(), 'stats', JSON.stringify(out.stats));
console.log('fired', fired, 'events', JSON.stringify(out.probe.events));
console.log('seesaw angle range', min((s) => s.seesaw), max((s) => s.seesaw), '| flipper range', min((s) => s.flipper), max((s) => s.flipper), '| flipper motor angle at end', last.flipperMotor, 'hinge', last.flipper);
console.log('wheel rate end', last.wheelRate, '| launcher sep max', max((s) => s.launcher), '| pendulum anchor gap max', max((s) => +s.pendulumAnchorGap));
console.log('elevator y range', min((s) => s.elevator[1]), max((s) => s.elevator[1]), '| cube-platform gap in PhysX', min((s) => s.cube[1] - s.pxElevatorY).toFixed(4), max((s) => s.cube[1] - s.pxElevatorY).toFixed(4), '(rest 0.026) | X3D platform minus PhysX platform', min((s) => s.elevator[1] - s.pxElevatorY).toFixed(4), max((s) => s.elevator[1] - s.pxElevatorY).toFixed(4));
console.log('marbleB max y', max((s) => s.marbleB[1]), '| marbleC max y', max((s) => s.marbleC[1]), '| bullet cube y range', min((s) => s.bullet.cube[1]), max((s) => s.bullet.cube[1]), '| bullet marbleC max y', max((s) => s.bullet.marbleC[1]), '| bullet rod', last.bullet.rod, 'physx rod', last.rod);
console.log('lamp', JSON.stringify(out.probe.lamp.slice(0, 6)), 'contact sample', JSON.stringify(out.probe.contactSample));
console.log('notes', out.report.notes.length, JSON.stringify(out.report.notes.map((n) => n.def + '.' + n.field + ': ' + n.status)), '\nlostAuthored', JSON.stringify(out.report.lostAuthored.map((l) => l.def + '.' + l.field)), '\nconsole', logs.slice(0, 6));
await browser.close();
