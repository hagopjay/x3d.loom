import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';

/** The guided tour (front door): real physics, plain-language narration, package export, planet-scale drawings. */
test('tour: live physics talks, explains contact, exports a package, shows the path to planet scale',async({page,browserName})=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 await page.goto('./');
 await expect(page.getByRole('heading',{level:1})).toContainText('how things');
 await expect(page.getByText(/I own the motion and the forces/)).toBeVisible({timeout:60_000});
 await expect(page.locator('x3d-canvas')).toBeVisible();
 await page.getByRole('button',{name:/Play/}).click();
 // The default goal presses the tip into the ball: the narration and gauges must say so.
 await expect(page.getByText(/Contact: the tip presses with/)).toBeVisible({timeout:20_000});
 await expect(page.getByText(/MuJoCo → X3D {2}pose/).first()).toBeVisible({timeout:10_000});
 // Moving the ball rebuilds the world (model.replace), visibly explained.
 await page.getByLabel('Ball position').fill('0.7');
 await expect(page.getByText(/rebuilt the world as version 2/)).toBeVisible({timeout:10_000});
 await expect(page.getByText(/world v2/)).toBeVisible();
 // The experiment package downloads and is a ZIP.
 const dir=path.resolve('test-results/exports',browserName);mkdirSync(dir,{recursive:true});
 const [dl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Download what you just made/}).click()]);
 const f=path.join(dir,'tour-'+dl.suggestedFilename());await dl.saveAs(f);expect(readFileSync(f).subarray(0,2).toString()).toBe('PK');
 // Planet scale: phase map with "you are here", cost chart with a table view, architecture drawing.
 await page.locator('#scale').scrollIntoViewIfNeeded();
 await expect(page.getByRole('img',{name:/Six phases from one laptop to planet scale/})).toBeVisible();
 await expect(page.getByText('YOU ARE HERE')).toBeVisible();
 await page.getByRole('button',{name:'Show the numbers'}).click();
 await expect(page.getByRole('cell',{name:'20,000',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:/Three architecture drawings/})).toBeVisible();
 // Links onward.
 await expect(page.getByRole('link',{name:/Open the full lab/})).toHaveAttribute('href','?lab=1');
 expect(errors).toEqual([]);
});

test('tour: phone width has no sideways scroll',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('./');await expect(page.getByText(/I own the motion/)).toBeVisible({timeout:60_000});
 const [sw,iw]=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
 expect(sw).toBeLessThanOrEqual(iw);
});
