import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';

/**
 * Real-browser smoke test for the bridge's open desktop checks
 * (validation/README.md, "Desktop checks still required" 1–8, minus the
 * Windows/WSL launchers, which cannot run on macOS).
 * Everything here is real: start.py serving dist/, X_ITE rendering with the
 * browser's own WebGL, MuJoCo 3.17 WASM stepping physics.
 */

const OUT=path.resolve('test-results/exports');

type V3={x:number;y:number;z:number};
const field=(page:Page,def:string,name:string)=>page.evaluate(([d,f])=>{
 const c=document.querySelector('x3d-canvas') as unknown as {browser:{currentScene:{getNamedNode(n:string):Record<string,unknown>}}};
 const v=c.browser.currentScene.getNamedNode(d)[f] as {x?:number;y?:number;z?:number;length?:number;[i:number]:number};
 if(typeof v==='object'&&v&&'x' in v)return {x:v.x,y:v.y,z:v.z};
 if(typeof v==='object'&&v&&typeof v.length==='number')return Array.from({length:v.length},(_,i)=>v[i]);
 return v;
},[def,name] as const);

/** Plan view (TopView): camera at (.5, 2.8, -.3) looking straight down, screen right = +X, screen up = -Z.
 *  A handle at local PlaneSensor coords (gx, gy) sits at world (gx, .34, -gy). X3D's default fieldOfView (π/4)
 *  spans the smaller viewport dimension. */
async function planPixel(page:Page,gx:number,gy:number){
 const box=(await page.locator('x3d-canvas').boundingBox())!;
 const k=(Math.min(box.width,box.height)/2)/((2.8-.34)*Math.tan(Math.PI/8));
 return {x:box.x+box.width/2+(gx-.5)*k,y:box.y+box.height/2-(gy-.3)*k,k};
}

/** Refine a predicted pixel to the centroid of matching pixels nearby, from a real screenshot of the WebGL canvas. */
async function refine(page:Page,guess:{x:number;y:number},kind:'cyan'|'orange',radius=45){
 const clip={x:Math.max(0,guess.x-radius),y:Math.max(0,guess.y-radius),width:radius*2,height:radius*2};
 const png=(await page.screenshot({clip})).toString('base64');
 const c=await page.evaluate(async([data,kind])=>{
  const img=new Image();img.src=`data:image/png;base64,${data}`;await img.decode();
  const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const g=cv.getContext('2d')!;g.drawImage(img,0,0);
  const d=g.getImageData(0,0,img.width,img.height).data;let sx=0,sy=0,n=0;
  for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const i=(y*img.width+x)*4,r=d[i],gg=d[i+1],b=d[i+2];
   const hit=kind==='cyan'?(gg>150&&b>150&&r<130&&gg>r+60):(r>170&&gg>60&&gg<170&&b<110&&r>gg+50);
   if(hit){sx+=x;sy+=y;n++;}}
  return {n,x:n?sx/n:0,y:n?sy/n:0,w:img.width,h:img.height};
 },[png,kind] as const);
 // Screenshot pixels may be scaled by devicePixelRatio.
 const s=c.w/(radius*2);
 return {n:c.n,x:clip.x+c.x/s,y:clip.y+c.y/s};
}

async function drag(page:Page,from:{x:number;y:number},to:{x:number;y:number}){
 await page.mouse.move(from.x,from.y);await page.mouse.down();
 for(let i=1;i<=12;i++){await page.mouse.move(from.x+(to.x-from.x)*i/12,from.y+(to.y-from.y)*i/12);await page.waitForTimeout(30);}
 await page.waitForTimeout(150);await page.mouse.up();await page.waitForTimeout(300);
}

const acks=async(page:Page)=>{await page.getByRole('button',{name:'Bindings & evidence'}).click();const t=await page.locator('aside').innerText();await page.getByRole('button',{name:'Author',exact:true}).click();return t;};

async function open(page:Page,errors:string[]){
 page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
 // The app ships no favicon; the browser's automatic /favicon.ico 404 is noted in GATE-0, not counted here.
 page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(`console: ${m.text()} @ ${m.location().url}`);});
 await page.goto('./?lab=1'); // the lab; the guided tour (front door) has its own spec
 await expect(page.getByText('MuJoCo 3.17.0 · real WASM')).toBeVisible({timeout:60_000});
 await expect(page.getByText(/X_ITE 16\.7\.0 attached/)).toBeVisible({timeout:60_000});
}

test.describe.configure({mode:'serial'});

test('renders with real WebGL, runs physics, drags, recompiles, exports and re-imports',async({page,browserName},info)=>{
 const errors:string[]=[];const evidence:Record<string,unknown>={browser:browserName,version:page.context().browser()?.version()};
 await open(page,errors);

 // 1. Real WebGL context inside X_ITE, and the canvas is not blank.
 const gl=await page.evaluate(()=>{
  const host=document.querySelector('x3d-canvas')!;const cv=(host.shadowRoot??host).querySelector('canvas') as HTMLCanvasElement|null;
  if(!cv)return null;const ctx=(cv.getContext('webgl2')??cv.getContext('webgl')) as WebGLRenderingContext|null;if(!ctx)return {canvas:true,context:false};
  const ext=ctx.getExtension('WEBGL_debug_renderer_info');
  return {canvas:true,context:true,version:ctx.getParameter(ctx.VERSION),renderer:ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):ctx.getParameter(ctx.RENDERER),size:[cv.width,cv.height]};
 });
 evidence.webgl=gl;expect(gl?.context,'X_ITE WebGL context').toBe(true);
 const shot=await page.locator('x3d-canvas').screenshot();
 const distinct=await page.evaluate(async b64=>{const img=new Image();img.src=`data:image/png;base64,${b64}`;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d')!;g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height).data;const s=new Set<number>();for(let i=0;i<d.length;i+=4*97)s.add((d[i]>>3)<<10|(d[i+1]>>3)<<5|(d[i+2]>>3));return s.size;},shot.toString('base64'));
 evidence.renderedColourBuckets=distinct;expect(distinct,'rendered scene has many colours (not blank)').toBeGreaterThan(20);
 await info.attach('workshop.png',{body:shot,contentType:'image/png'});

 // 2. Run physics: simulation time advances and the arm moves in the X3D scene.
 const before=await field(page,'BodyLower','translation') as V3;
 await page.getByRole('button',{name:'Run physics'}).click();
 await expect(page.getByRole('button',{name:'Pause physics'})).toBeVisible();
 await page.waitForTimeout(2500);
 const simText=await page.getByText(/^\d+\.\d{3} s$/).first().innerText();
 const simTime=parseFloat(simText);evidence.simTimeAfterRun=simTime;expect(simTime).toBeGreaterThan(.5);
 const after=await field(page,'BodyLower','translation') as V3;
 const moved=Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z);evidence.lowerLinkMoved_m=moved;expect(moved).toBeGreaterThan(.01);

 // 3. Drag the cyan target in plan view → acknowledged x3d target.set reaches the controller.
 await page.getByRole('button',{name:'Plan view'}).click();await page.waitForTimeout(2500);
 const tgt=await field(page,'TargetHandle','translation') as V3;
 const tPred=await planPixel(page,tgt.x,tgt.y);const tHit=await refine(page,tPred,'cyan');
 evidence.targetPixel={predicted:[tPred.x,tPred.y],refined:[tHit.x,tHit.y],pixels:tHit.n};
 const tFrom=tHit.n>8?tHit:tPred;
 const targetBefore=await field(page,'JointTargets','value') as number[];
 await drag(page,tFrom,{x:tFrom.x-.18*tPred.k,y:tFrom.y-.12*tPred.k});
 await expect.poll(async()=>JSON.stringify(await field(page,'JointTargets','value'))).not.toBe(JSON.stringify(targetBefore));
 evidence.jointTargets={before:targetBefore,after:await field(page,'JointTargets','value')};
 expect(await acks(page)).toMatch(/x3d → target\.set: accepted/);
 // The target sits 0.10 m from the obstacle centre: prove the drag hit the target, not the obstacle (no recompile).
 await expect(page.getByText(/rev 1 ·/)).toBeVisible();

 // 4. Drag and release the orange obstacle → staged edit, then model.replace compiles a new revision and resets.
 const obs=await field(page,'ObstacleHandle','translation') as V3;
 const oPred=await planPixel(page,obs.x,obs.y);const oHit=await refine(page,oPred,'orange',70);
 evidence.obstaclePixel={predicted:[oPred.x,oPred.y],refined:[oHit.x,oHit.y],pixels:oHit.n};
 const oFrom=oHit.n>8?oHit:oPred;
 await drag(page,oFrom,{x:oFrom.x-.15*oPred.k,y:oFrom.y-.1*oPred.k});
 await expect(page.getByText(/rev 2 ·/)).toBeVisible();
 const obsInput=Number(await page.getByLabel('Obstacle X').inputValue());evidence.obstacleXAfterDrag=obsInput;
 expect(Math.abs(obsInput-obs.x)).toBeGreaterThan(.05);
 expect(await acks(page)).toMatch(/x3d → model\.replace: accepted/);
 await expect(page.getByRole('button',{name:'Run physics'})).toBeVisible(); // recompile pauses/resets

 // 5. Export the X3D scene and the experiment ZIP.
 const dir=path.join(OUT,browserName);mkdirSync(dir,{recursive:true});
 const [x3dDl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'X3D scene ↓'}).click()]);
 const x3dPath=path.join(dir,x3dDl.suggestedFilename());await x3dDl.saveAs(x3dPath);
 const [zipDl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Experiment package ↓'}).click()]);
 const zipPath=path.join(dir,zipDl.suggestedFilename());await zipDl.saveAs(zipPath);
 const x3d=readFileSync(x3dPath,'utf8');expect(x3d).toContain('x3d-mujoco/0.1');
 expect(readFileSync(zipPath).subarray(0,2).toString()).toBe('PK');
 evidence.exports={x3d:path.relative(process.cwd(),x3dPath),zip:path.relative(process.cwd(),zipPath)};

 // 6. Change the model in the UI, then re-import each export and check the authored obstacle comes back.
 for(const file of [x3dPath,zipPath]){
  await page.getByLabel('Obstacle X').fill('0.3');await page.getByRole('button',{name:'Compile authored model'}).click();
  await expect(page.getByLabel('Obstacle X')).toHaveValue('0.3');
  await page.getByLabel('Import X3D or experiment package').setInputFiles(file);
  await expect(page.getByText(/Imported supported X3D annotations/).first()).toBeVisible();
  expect(Number(await page.getByLabel('Obstacle X').inputValue())).toBeCloseTo(obsInput,6);
 }

 // 7. Measure a 5 s trial, pin a baseline, export both records.
 await page.getByRole('button',{name:'Measure 5 s'}).click();
 await expect(page.getByText(/Saved experiment · \d+ physical steps/)).toBeVisible({timeout:60_000});
 await page.getByRole('button',{name:'Pin baseline'}).click();
 const [trialDl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Both trial records ↓'}).click()]);
 const trialPath=path.join(dir,trialDl.suggestedFilename());await trialDl.saveAs(trialPath);
 const trials=JSON.parse(readFileSync(trialPath,'utf8'));expect(trials.current.metrics.steps).toBeGreaterThan(100);expect(trials.baseline).toBeTruthy();

 // 8. No unexpected console errors.
 evidence.consoleErrors=errors;
 writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2));
 expect(errors).toEqual([]);
});

test('narrow layout: no horizontal overflow, viewport and controls reachable',async({page,browserName})=>{
 const errors:string[]=[];await page.setViewportSize({width:390,height:844});await open(page,errors);
 const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
 const vp=(await page.locator('x3d-canvas').boundingBox())!;
 const dir=path.join(OUT,browserName);mkdirSync(dir,{recursive:true});
 await page.screenshot({path:path.join(dir,'narrow.webp'),fullPage:true});
 writeFileSync(path.join(dir,'narrow.json'),JSON.stringify({...m,canvas:vp},null,2));
 expect(m.scroll,'page must not scroll sideways at 390 px').toBeLessThanOrEqual(m.inner);
 expect(vp.width).toBeGreaterThan(300);expect(vp.x+vp.width).toBeLessThanOrEqual(390+1);
 await page.getByRole('button',{name:'Run physics'}).scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Run physics'}).click();
 await expect(page.getByRole('button',{name:'Pause physics'})).toBeVisible();
 expect(errors).toEqual([]);
});

test('keyboard: controls reachable by Tab, operable by Enter/arrows, visible focus',async({page,browserName})=>{
 const errors:string[]=[];await open(page,errors);
 const seen:string[]=[];let runFocused=false;
 for(let i=0;i<40&&!runFocused;i++){
  // WebKit only tabs to buttons with Alt+Tab unless "Press Tab to highlight each item" is on; Playwright's WebKit follows the macOS default.
  await page.keyboard.press(browserName==='webkit'?'Alt+Tab':'Tab');
  const label=await page.evaluate(()=>{const a=document.activeElement as HTMLElement|null;return a?`${a.tagName}:${a.getAttribute('aria-label')??a.textContent?.trim().slice(0,30)}`:'';});
  seen.push(label);runFocused=label==='BUTTON:Run physics';
 }
 const dir=path.join(OUT,browserName);mkdirSync(dir,{recursive:true});
 const outline=await page.evaluate(()=>getComputedStyle(document.activeElement!).outlineStyle);
 writeFileSync(path.join(dir,'keyboard.json'),JSON.stringify({tabOrder:seen,focusOutline:outline},null,2));
 expect(runFocused,'Run physics reachable by keyboard').toBe(true);
 expect(outline).not.toBe('none');
 await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Pause physics'})).toBeVisible();
 // Target slider: keyboard alternative to dragging the cyan sphere.
 const slider=page.getByLabel('Shoulder bridge target');await slider.focus();const v0=Number(await slider.inputValue());
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await expect.poll(async()=>Number(await slider.inputValue())).toBeGreaterThan(v0);
 // Obstacle: keyboard alternative to dragging the orange sphere (number field + compile button).
 await page.getByLabel('Obstacle X').focus();await page.keyboard.press('ArrowDown');
 await page.getByRole('button',{name:'Compile authored model'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByText(/rev 2 ·/)).toBeVisible();
 expect(errors).toEqual([]);
});
