import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ locale: 'en-US' });
await page.goto('http://127.0.0.1:5181/sidebyside.html?scene=scenes/experiments/ode-only-fields.x3d');
await page.waitForFunction(() => window.__sbs?.ready || window.__sbs?.error);
console.log(JSON.stringify(await page.evaluate(() => { const r = window.__sbs.bridge.report; const sc = window.__sbs.bridge.scene; const n = sc.getNamedNode('Surface'); return { surf: r.nodes.find((x) => x.def === 'Surface')?.fields?.slipFactors, box: r.nodes.find((x) => x.def === 'BoxBody')?.fields?.finiteRotationAxis, raw: { slip: [n.slipFactors.x, n.slipFactors.y, 'z' in n.slipFactors, 'angle' in n.slipFactors, typeof n.slipFactors.length], fra: String(sc.getNamedNode('BoxBody').finiteRotationAxis) }, err: window.__sbs.error, lost: r.lostAuthored.map((l) => l.def + '.' + l.field) }; })));
await browser.close();
