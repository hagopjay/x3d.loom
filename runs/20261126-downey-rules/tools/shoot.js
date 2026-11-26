const { chromium } = require('playwright');
(async () => {
  const [base, outdir] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('pageerror: ' + e));
  for (const [f, vp, name] of [['er-original.x3d','VP_main','orig-main'],['er-fixed.x3d','VP_main','fixed-main'],['er-original-wall.x3d','','orig-wall'],['er-fixed-wall.x3d','','fixed-wall']]) {
    await p.goto(`${base}/index.html?f=${f}&vp=${vp}`); await p.waitForFunction(() => window.done, null, { timeout: 60000 });
    const err = await p.evaluate(() => window.err); await p.screenshot({ path: `${outdir}/${name}.png` }); console.log(name, err || 'ok');
  }
  console.log('chromium', b.version()); console.log(logs.filter(l => !l.includes('X_ITE')).slice(0, 10).join('\n'));
  await b.close();
})();
