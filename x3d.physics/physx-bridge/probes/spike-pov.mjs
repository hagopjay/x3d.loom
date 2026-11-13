// Spike: a first-person camera from the humanoid's eyes. A Viewpoint added under the skull HAnimSegment (where an H-Anim eye site
// would carry it) rides the head as the bridge writes joint rotations. Measures the head's spin during a fall (nausea check).
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage({ locale: 'en-US', viewport: { width: 1500, height: 950 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://127.0.0.1:5181/ragdoll.html');
await p.waitForFunction(() => window.__demo?.ready);
await p.evaluate(() => {
  const X3D = window.X3D, sc = window.__demo.bridge.scene, skull = sc.getNamedNode('hanim_skull');
  const vp = sc.createNode('Viewpoint');
  vp.description = 'His eyes'; vp.position = new X3D.SFVec3f(0.0044, 1.775, 0.16); vp.orientation = new X3D.SFRotation(0, 1, 0, Math.PI); vp.fieldOfView = 1.1;
  const kids = skull.children; const list = []; for (let i = 0; i < kids.length; i++) list.push(kids[i]); list.push(vp);
  skull.children = new X3D.MFNode(...list);
  vp.set_bind = true;
  window.__pov = vp; window.__spin = [];
  const S = window.__rag, skullLink = S.links.find((l) => l.segment === 'skull').index;
  window.__demo.bridge.onState((e) => { const o = skullLink * 13; window.__spin.push(Math.hypot(e.state[o + 10], e.state[o + 11], e.state[o + 12])); });
  window.__rag.auto = false; // keep our camera
});
await p.screenshot({ path: 'evidence/spike-pov-top.webp' });
await p.locator('#canvas').click({ position: { x: 5, y: 5 } });
await p.keyboard.press('2');
for (const t of [500, 1100, 1800, 3000]) { await p.waitForTimeout(t === 500 ? 500 : t - [500, 1100, 1800, 3000][[500, 1100, 1800, 3000].indexOf(t) - 1]); await p.screenshot({ path: `evidence/spike-pov-${t}ms.png` }); }
const spin = await p.evaluate(() => { const s = window.__spin.filter(Number.isFinite).sort((a, b) => a - b); return { samples: s.length, medianRadS: +s[Math.floor(s.length / 2)].toFixed(2), p90RadS: +s[Math.floor(s.length * 0.9)].toFixed(2), maxRadS: +s[s.length - 1].toFixed(2) }; });
console.log(JSON.stringify({ spin, errors }));
await b.close();
