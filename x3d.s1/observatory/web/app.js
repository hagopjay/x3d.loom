/* Offline Decision Observatory. This UI never holds credentials or calls a model. */
'use strict';

const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];
const ui = {catalog:null, report:null, sequence:0, sourceSequence:0, abort:null, debounce:null, sceneURI:null, sceneId:null, rendererChecks:0};
const ROUTE_NAMES = {suspected_ok:'Advisory only',escalate_oracle:'Seek exact evidence',defer_human:'Defer to a person',resolve_by_code:'Resolve by code'};
const SHORT_ROUTES = {suspected_ok:'Advisory',escalate_oracle:'Exact check',defer_human:'Human review',resolve_by_code:'Exact code'};

function element(tag, className, text) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=String(text);
  return node;
}
function json(value) { return JSON.stringify(value,null,2); }
function numeric(value) { return Number.isFinite(value)?value.toFixed(2):'—'; }
function detail(value) { return typeof value==='string'?value:json(value); }
function label(value) { return String(value??'—').replace(/_/g,' '); }
function bytes(n) { return Number.isFinite(n)?n.toLocaleString()+' bytes':'— bytes'; }
function error(message) {
  $('error').hidden=!message;
  $('error').textContent=message||'';
  if(message){$('run-state').textContent='The rehearsal could not finish.';$('run-state').classList.remove('busy');}
}
async function request(path, options={}) {
  const response=await fetch(path,{cache:'no-cache',...options});
  let value;
  try{value=await response.json();}catch{throw new Error('The local server returned a response that is not JSON. Start this folder with server.py.');}
  if(!response.ok)throw new Error(value.error||'Local request failed ('+response.status+').');
  return value;
}
function allowedURI(uri) {
  if(!ui.catalog?.scenes.some(item=>item.uri===uri))throw new Error('The preview URI is not in the authored specimen catalogue.');
  const url=new URL(uri,location.href);
  if(url.origin!==location.origin||!/^\/scenes\/[a-z0-9-]+\.x3d$/.test(url.pathname)||url.search||url.hash)throw new Error('Only the local authored X3D specimen set can be previewed.');
  return url.pathname;
}
function validateReport(report) {
  if(!report||report.schema!=='x3d.s1.rehearsal/1'||report.mode!=='synthetic'||report.acceptance_eligible!==false||report.model_calls!==0)throw new Error('The response is not an offline, ineligible rehearsal record.');
  if(!report.candidate||!Array.isArray(report.required_witnesses)||!Array.isArray(report.observations)||!report.advisory)throw new Error('The rehearsal response is incomplete.');
  if(report.required_witnesses.some(item=>item.status!=='not_run'))throw new Error('A rehearsal cannot present a required production witness as completed.');
  allowedURI(report.candidate.uri);
}
function updateReadings() {
  $('probability-value').value=Number($('probability').value).toFixed(2);
  $('threshold-value').value=Number($('threshold').value).toFixed(2);
  $$('.presets [data-p]').forEach(button=>button.classList.toggle('on',Math.abs(Number(button.dataset.p)-Number($('probability').value))<.0001));
}
function inputs() {return {scene_id:$('scenario').value,profile_id:$('profile').value,p:Number($('probability').value),threshold:Number($('threshold').value)};}
function setBusy(on) {
  document.body.classList.toggle('loading',on);
  $('run-state').classList.toggle('busy',on);
  $('rehearse').disabled=on;
  if(on)$('run-state').textContent='Inspecting locally · no model call…';
}
function setSceneDescription() {
  const item=ui.catalog?.scenes.find(scene=>scene.id===$('scenario').value);
  $('scenario-description').textContent=item?.description||'';
}
function deferRehearsal() {
  updateReadings();
  clearTimeout(ui.debounce);
  ui.debounce=setTimeout(()=>rehearse(),180);
}
async function rehearse() {
  if(!ui.catalog)return;
  clearTimeout(ui.debounce);
  const sequence=++ui.sequence;
  ui.abort?.abort();ui.abort=new AbortController();
  setBusy(true);error('');setSceneDescription();
  const value=inputs();
  try{
    const report=await request('/api/rehearse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:ui.abort.signal});
    if(sequence!==ui.sequence)return;
    validateReport(report);
    ui.report=report;
    render(report);
    const query=new URLSearchParams({scene:value.scene_id,profile:value.profile_id,p:String(value.p),threshold:String(value.threshold)});
    history.replaceState(null,'',location.pathname+'?'+query.toString()+location.hash);
    $('run-state').textContent='Rehearsal complete · zero model calls.';
    $('export-top').disabled=$('export-detail').disabled=false;
  }catch(reason){
    if(sequence!==ui.sequence||reason.name==='AbortError')return;
    error(reason.message||String(reason));
  }finally{if(sequence===ui.sequence)setBusy(false);}
}
function render(report) {
  const candidate=report.candidate,advisory=report.advisory,answer=advisory.answer,route=advisory.route;
  $('scene-title').textContent=candidate.title;
  $('candidate-hash').textContent=candidate.sha256?.slice(0,16)||'unavailable';
  $('candidate-hash').title=candidate.sha256||'';
  $('candidate-bytes').textContent=bytes(candidate.bytes);
  $('exact-count').textContent=report.summary.exact_count;
  $('gap-count').textContent=report.summary.outstanding_count+'/'+report.summary.required_count;
  $('route-short').textContent=SHORT_ROUTES[route.outcome]||label(route.outcome);
  $('question-text').textContent=advisory.question?.text||'Synthetic investigation-order question';
  $('answer-choice').textContent=label(answer.choice);
  $('answer-probability').textContent='p '+numeric(answer.p);
  $('advisory-p').textContent=numeric(answer.p);
  $('advisory-confidence').textContent=numeric(answer.confidence);
  $('route-label').textContent=ROUTE_NAMES[route.outcome]||label(route.outcome);
  $('route-reason').textContent=route.reason||'A typed advisory cannot satisfy a witness requirement.';
  $('route-card').dataset.outcome=route.outcome;
  $('required-token').textContent=String(report.required_witnesses.length).padStart(2,'0');
  $('receipt-hash').textContent='REHEARSAL '+(report.receipt_sha256?.slice(0,16)||'—');
  $('receipt-hash').title=report.receipt_sha256||'';
  renderObservations(report);
  renderQueue(report.required_witnesses);
  renderInvariant(report.noninterference);
  $('slice-text').textContent=json(report.state_slice);
  $('receipt-text').textContent=json(report);
  renderBindings(report.bindings||{});
  renderScene(candidate);
}
function renderObservations(report) {
  const nodes=report.observations.map(item=>{
    const card=element('article','observation '+(item.status==='fail'?'fail':'pass'));
    const icon=element('span','observation-icon',item.status==='fail'?'!':'✓');icon.setAttribute('aria-hidden','true');
    const body=element('div');
    const top=element('div','observation-top');
    top.append(element('h3','',item.label||label(item.id)),element('span','observation-status',item.status==='fail'?'FINDINGS':'OBSERVED'));
    body.append(top,element('p','',detail(item.detail??'')),element('p','observation-scope',item.scope||''));
    if(item.findings?.length){const findings=element('details','finding-details');findings.append(element('summary','',item.findings.length+' finding(s) · inspect'));findings.append(element('pre','code-block',json(item.findings)));body.append(findings);}
    card.append(icon,body);return card;
  });
  $('observations').replaceChildren(...nodes);
  const exact=(report.exact_answers||[]).filter(item=>item.class==='D');
  $('exact-detail-count').textContent='('+exact.length+')';
  $('exact-answers').replaceChildren(...exact.map(item=>{
    const row=element('tr');
    const value=item.noul!==undefined?String(item.noul):item.choice!==undefined?label(item.choice):item.score!==undefined?String(item.score):'See receipt';
    row.append(element('td','',item.id),element('td','',value),element('td','',item.source||'exact'));return row;
  }));
}
function renderQueue(witnesses) {
  $('witness-queue').replaceChildren(...witnesses.map(item=>{
    const node=element('li');const body=element('div');const heading=element('div','witness-top');
    heading.append(element('strong','',item.label||label(item.id)),element('span','witness-status','NOT RUN'));
    body.append(heading,element('p','',item.reason||'The required instrument has not run.'));
    if(Number.isFinite(item.priority)){const priority=element('p','queue-priority','Teaching priority '+item.priority.toFixed(2));priority.title=item.priority_scope||'Authored unitless teaching weight; not measured risk or latency.';body.append(priority);}
    node.append(body);return node;
  }));
}
function renderInvariant(invariant={}) {
  const passed=invariant.checked===true&&invariant.requirements_unchanged===true&&invariant.acceptance_eligible_unchanged===true;
  const card=document.querySelector('.invariant-card');
  if(card)card.classList.toggle('failure',!passed);
  $('invariant-symbol').textContent=passed?'=':'!';
  $('invariant-title').replaceChildren(document.createTextNode(passed?'Same obligations.':'Inspect the boundary.'),document.createElement('br'),document.createTextNode(passed?'Different advice.':'An invariant failed.'));
  $('invariant-detail').textContent=passed?'The synthetic probability sweep preserved the required witness set, its outstanding status, and acceptance ineligibility. This checks the local planner.':'The local counterfactual check did not establish unchanged obligations. Inspect the receipt before using the rehearsal.';
  $('invariant-cases').textContent=(invariant.cases??'—')+' counterfactuals';
  $('invariant-state').textContent=passed?'UNCHANGED':'REVIEW';
}
function renderBindings(bindings) {
  $('bindings').replaceChildren(...Object.entries(bindings).map(([key,value])=>{
    const row=element('div');row.append(element('dt','',label(key.replace(/_sha256$/,''))),element('dd','',value));return row;
  }));
}
async function renderScene(candidate) {
  const uri=allowedURI(candidate.uri);
  if(ui.sceneURI===uri)return;
  ui.sceneURI=uri;ui.sceneId=candidate.id;
  const sourceSequence=++ui.sourceSequence;
  $('source-text').textContent='Reading the local authored specimen…';
  $('scene').setAttribute('src',uri);
  $('reset-view').disabled=false;
  checkRenderer();
  try{
    const response=await fetch(uri,{cache:'no-cache'});
    if(!response.ok)throw new Error('Could not load the authored scene source.');
    const source=await response.text();
    if(sourceSequence===ui.sourceSequence)$('source-text').textContent=source;
  }catch(reason){if(sourceSequence===ui.sourceSequence)$('source-text').textContent=reason.message;}
}
function checkRenderer() {
  try{
    const browser=$('scene').browser;
    if(browser&&typeof browser.getContext==='function'){
      const available=Boolean(browser.getContext());
      $('renderer-state').textContent=available?'X_ITE · preview only':'WebGL unavailable';
      $('preview-fallback').hidden=available;
      $('reset-view').disabled=!available;
      return;
    }
  }catch{}
  if(++ui.rendererChecks<30)setTimeout(checkRenderer,500);
  else{$('renderer-state').textContent='Preview unavailable';$('preview-fallback').hidden=false;$('reset-view').disabled=true;}
}
function selectTab(name,{focus=false}={}) {
  for(const button of $$('[role=tab]')){
    const selected=button.dataset.tab===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;$('panel-'+button.dataset.tab).hidden=!selected;
    if(selected&&focus)button.focus();
  }
}
function exportReport() {
  if(!ui.report)return;
  const blob=new Blob([json(ui.report)+'\n'],{type:'application/json'}),uri=URL.createObjectURL(blob),anchor=element('a');
  anchor.href=uri;anchor.download='Loom-rehearsal-'+ui.report.candidate.id+'-'+ui.report.receipt_sha256.slice(0,8)+'.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(uri),5000);
}
async function start() {
  try{
    const catalog=await request('/api/catalog');
    if(catalog.offline!==true||catalog.model_calls!==0||!Array.isArray(catalog.scenes)||!catalog.scenes.length||!Array.isArray(catalog.profiles)||!catalog.profiles.length)throw new Error('The local catalogue is not an offline specimen catalogue.');
    ui.catalog=catalog;
    for(const scene of catalog.scenes)allowedURI(scene.uri);
    $('scenario').replaceChildren(...catalog.scenes.map(item=>{const option=element('option','',item.title);option.value=item.id;return option;}));
    $('profile').replaceChildren(...catalog.profiles.map(item=>{const option=element('option','',item.label);option.value=item.id;return option;}));
    const query=new URLSearchParams(location.search);
    if(catalog.scenes.some(item=>item.id===query.get('scene')))$('scenario').value=query.get('scene');
    if(catalog.profiles.some(item=>item.id===query.get('profile')))$('profile').value=query.get('profile');
    for(const [key,id]of [['p','probability'],['threshold','threshold']]){const value=Number(query.get(key));if(query.has(key)&&Number.isFinite(value)&&value>=Number($(id).min)&&value<=Number($(id).max))$(id).value=value;}
    $$('#controls select,#controls input,#controls button').forEach(node=>node.disabled=false);
    updateReadings();setSceneDescription();
    await rehearse();
  }catch(reason){error(reason.message||String(reason));$('scenario-description').textContent='Run python3 server.py from 04-observatory, then open its printed local address.';}
}

$('probability').addEventListener('input',deferRehearsal);
$('threshold').addEventListener('input',deferRehearsal);
$('scenario').addEventListener('change',rehearse);
$('profile').addEventListener('change',rehearse);
$('rehearse').addEventListener('click',rehearse);
$$('[data-p]').forEach(button=>button.addEventListener('click',()=>{$('probability').value=button.dataset.p;updateReadings();rehearse();}));
$$('[role=tab]').forEach((button,index,buttons)=>{
  button.addEventListener('click',()=>selectTab(button.dataset.tab));
  button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();selectTab(buttons[next].dataset.tab,{focus:true});});
});
$('export-top').addEventListener('click',exportReport);$('export-detail').addEventListener('click',exportReport);
$('help-open').addEventListener('click',()=>$('help-dialog').showModal());$('help-close').addEventListener('click',()=>$('help-dialog').close());
$('help-dialog').addEventListener('click',event=>{if(event.target===$('help-dialog')){const rect=$('help-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('help-dialog').close();}});
$('reset-view').addEventListener('click',()=>{
  try{const browser=$('scene').browser,view=browser.getActiveViewpoint();view.transitionStop();view.resetUserOffsets();view.update();browser.addBrowserEvent();}catch{$('run-state').textContent='Drag the preview to orbit; choose another specimen to reload its authored camera.';}
});
start();
