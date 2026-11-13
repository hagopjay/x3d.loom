/** DOM component integration checks with real WASM. Canvas/WebGL and downloads are explicitly substituted. */
import assert from 'node:assert/strict';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://workbench.test/'});
const win=dom.window;
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Event','MouseEvent','KeyboardEvent','DOMParser','localStorage']) Object.defineProperty(globalThis,key,{value:key==='window'?win:key==='document'?win.document:win[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
win.HTMLCanvasElement.prototype.getContext=function(){return null;}; // no fake WebGL success
win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
win.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
const timers=new Set();
globalThis.requestAnimationFrame=cb=>{const id=setTimeout(()=>{timers.delete(id);cb(performance.now());},16);timers.add(id);return id;};
globalThis.cancelAnimationFrame=id=>{clearTimeout(id);timers.delete(id);};
const downloads=[];
URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test-download';};URL.revokeObjectURL=()=>{};
win.HTMLAnchorElement.prototype.click=function(){};
const browserErrors=[],originalError=console.error;
console.error=(...args)=>{const text=args.map(String).join(' ');if(!text.includes('Error creating WebGL context'))browserErrors.push(text);};
await build({entryPoints:['src/App.tsx'],outfile:'.ui-test-bundle.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'wasm-test-data',setup(b){b.onResolve({filter:/\.wasm\?url$/},args=>({path:resolve('node_modules/@mujoco/mujoco/mujoco.wasm'),namespace:'wasm'}));b.onLoad({filter:/.*/,namespace:'wasm'},async args=>({contents:`export default ${JSON.stringify('data:application/wasm;base64,'+(await readFile(args.path)).toString('base64'))}`,loader:'js'}));}}]});
const React=await import('react');const {createRoot}=await import('react-dom/client');const {default:App}=await import('../.ui-test-bundle.mjs');
const root=createRoot(document.getElementById('root'));root.render(React.createElement(App));
const report={generatedAt:new Date().toISOString(),environment:'Node + jsdom + React, actual MuJoCo WASM; no real browser or GPU',substitutions:['Canvas returns null, exercising the WebGL-unavailable fallback','Native dialog open/close is a DOM attribute shim','Object URLs and anchor download activation are captured; no real browser downloads'],checks:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,timeout=15000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('Timed out waiting for UI state');await sleep(20);}await sleep(10);}
const text=()=>document.body.textContent;
const btn=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
async function click(t){const b=btn(t);assert.ok(b,`Missing button ${t}`);assert.equal(b.disabled,false);b.click();await sleep(30);}
function select(label,value){const el=document.querySelector(`select[aria-label="${label}"]`);assert.ok(el,label);el.value=value;el.dispatchEvent(new win.Event('change',{bubbles:true}));}
async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'fail',error:String(e.stack??e)});originalError('FAIL '+name+': '+e.message);}}
try{
await check('startup initializes WASM, applies the arm and attaches feedback',async()=>{await wait(()=>document.querySelector('select[aria-label="Controller mode"]')?.value==='feedback');assert.ok(text().includes('MuJoCo 3.17.0 / WASM'));assert.ok(text().includes('WebGL unavailable'));return {fallbackVisible:true,controller:'feedback'};});
await check('measured run renders chart and real contact result',async()=>{await click('Measure 5 s');await wait(()=>!!btn('Pin as baseline'));assert.ok(text().includes('2,500 ticks'));assert.ok(text().includes('Peak contacts: 1'));assert.ok(document.querySelector('svg[aria-label="Measured trajectory comparison"]'));await click('Pin as baseline');return {ticks:2500,contacts:1};});
await check('navigation preserves measured runs and pinned baseline',async()=>{await click('Learn');assert.ok(text().includes('Check your experimental instincts'));await click('Workspace');assert.ok(text().includes('Amber: baseline'));assert.ok(btn('Clear baseline'));return {preserved:true};});
await check('Apply reattaches bundled feedback and preserves the pinned baseline',async()=>{select('Controller mode','off');await sleep(30);await click('▶ Apply & run');await wait(()=>document.querySelector('select[aria-label="Controller mode"]')?.value==='feedback');await click('Measure 5 s');await wait(()=>!!btn('Pin as baseline'));assert.ok(text().includes('Amber: baseline'));return {baselineSurvivedCompile:true};});
await check('trial download contains actual samples and recipe',async()=>{await click('Trial JSON ↓');const data=JSON.parse(await downloads.at(-1).text());assert.equal(data.run.samples.length,2501);assert.equal(data.run.controllerImplementation.recipe,'arm-joint-pd-v1');assert.ok(data.baseline);return {samples:data.run.samples.length};});
await check('cartpole mode offers disturbance and a measured recovery',async()=>{select('Starter model','cartpole');await wait(()=>!!btn('Disturb +0.08 rad'));assert.equal(document.querySelector('select[aria-label="Controller mode"]').value,'feedback');await click('Measure 5 s');await wait(()=>!!btn('Pin as baseline'));await click('Trial JSON ↓');const data=JSON.parse(await downloads.at(-1).text());assert.equal(data.run.start.disturbance_rad,.08);assert.ok(Math.abs(data.run.metrics.finalQpos[1])<.001);return {finalPoleRad:data.run.metrics.finalQpos[1]};});
await check('invalid editor input preserves compiled model and recovers after correction',async()=>{
 const ta=document.querySelector('textarea');assert.ok(!!ta);const source=ta.value;
 const setter=Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype,'value').set;
 setter.call(ta,'<mujoco><worldbody><geom type="invalid_shape"/></worldbody></mujoco>');ta.dispatchEvent(new win.Event('input',{bubbles:true}));
 await wait(()=>text().includes('Draft differs from the running model'));await click('▶ Apply & run');await wait(()=>text().includes('MJCF compile error'));
 await click('Observation JSON ↓');const packet=JSON.parse(await downloads.at(-1).text());assert.equal(packet.model.compiled_source_xml,source);
 setter.call(ta,source);ta.dispatchEvent(new win.Event('input',{bubbles:true}));await sleep(30);await click('▶ Apply & run');await wait(()=>!text().includes('Draft differs from the running model'));
 return {preservedCompiledSource:true};
});
await check('command palette opens, selects navigation and closes',async()=>{await click('Commands Ctrl K');assert.ok(document.querySelector('dialog[open]'));const input=document.querySelector('input[aria-label="Search commands"]');assert.ok(input);const command=[...document.querySelectorAll('dialog button')].find(b=>b.querySelector('span')?.textContent==='Reference');assert.ok(!!command);command.click();await sleep(30);assert.ok(!document.querySelector('dialog[open]'));return {openedAndClosed:true};});
await check('unhandled console errors are absent apart from the expected WebGL fallback',()=>{assert.deepEqual(browserErrors,[]);return {unexpectedErrors:0};});
}finally{root.unmount();for(const t of timers)clearTimeout(t);dom.window.close();console.error=originalError;await rm('.ui-test-bundle.mjs',{force:true});}
report.summary={passed:report.checks.filter(c=>c.status==='pass').length,failed:report.checks.filter(c=>c.status==='fail').length};await writeFile('validation/ui-dom-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));process.exitCode=report.summary.failed?1:0;
