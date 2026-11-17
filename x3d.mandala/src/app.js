import {YANTRA,GEOMETRY_CERTIFICATE as C} from './yantra-data.js';
import {applySceneState} from './scene.js';
import {createArtwork} from './scene-package.js';
import {PulseTransport,ResonanceAudio} from './audio.js';
import {preserveExportRequirements} from './export.js';
import {sampleField} from './field.js';
import {auditTriangles,trianglesFromNativePoints} from './geometry-audit.js';

const $=id=>document.getElementById(id),transport=new PulseTransport({bpm:54}),sound=new ResonanceAudio(transport);
const settings={palette:'saffron',coupling:.72,depth:.65,front:.96,back:.28,tilt:0,layerMode:'both',quality:'high',comfort:matchMedia('(prefers-reduced-motion: reduce)').matches};
const S={transport,sound,settings,yantra:YANTRA,certificate:C,scene:null,browser:null,ready:false,pulseBeat:-100,frame:0,state:null,geometryWrites:0,error:null};window.__sri=S;
let currentScene,sceneStats,sceneXML,renderToken=0,messageUntil=0,uiAt=0;
const scientific=v=>Number(v).toExponential(2).replace('e-',' × 10⁻');
function notify(message){$('message').textContent=message;$('message').classList.add('on');messageUntil=performance.now()+3200;}
function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);}
function studio(open){$('studio').hidden=!open;$('studio-open').setAttribute('aria-expanded',String(open));}
function pause(){if(transport.state==='running')transport.pause();else transport.resume();sound.tick();updateUI();}
function resonance(){S.pulseBeat=transport.beat();notify('RESONANCE / ONE SHARED MUSICAL PHASE');}
async function toggleSound(){try{if(!sound.context)await sound.enable();else sound.setMuted(!sound.muted);updateUI();}catch(e){notify(e.message);}}
const card=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
$('certificate-stats').innerHTML=card('ACTIVE TRIANGULAR CHAMBERS',C.activeChambers)+card('RINGS / INNER → OUTER',C.activeRingCountsInnerToOuter.join(' · '))+card('FLOAT64 MAX CONCURRENCY ERROR',Number(C.float64.concurrencyR).toExponential(2)+' R')+card('FLOAT64 ACCEPTANCE BOUND','≤ '+C.bounds.float64MaxConstraintResidualR.toExponential(0)+' R')+card('100-DIGIT CONSTRUCTION ERROR',Number(C.highPrecision.concurrencyR).toExponential(2)+' R')+card('FLOAT32 QUANTIZATION ERROR',Number(C.float32Quantized.concurrencyR).toExponential(2)+' R');
$('precision-small').textContent='43 triangles · source ≤ 10⁻¹² R';$('comfort').checked=settings.comfort;
$('studio-open').onclick=()=>studio($('studio').hidden);$('studio-close').onclick=()=>studio(false);
$('certificate-open').onclick=()=>$('certificate').showModal();$('certificate-close').onclick=()=>$('certificate').close();
$('begin-sound').onclick=toggleSound;$('sound').onclick=toggleSound;$('play').onclick=pause;$('pulse').onclick=resonance;
$('focus').onclick=()=>document.body.classList.toggle('immersive');
for(const [id,key,scale] of [['depth','depth',.01],['coupling','coupling',.01],['front','front',.01],['back','back',.01],['tilt','tilt',Math.PI/180]])$(id).oninput=e=>{settings[key]=Number(e.target.value)*scale;$(id+'-value').textContent=e.target.value+(id==='tilt'?'°':'%');};
$('tempo').oninput=e=>{transport.setTempo(Number(e.target.value));$('tempo-value').textContent=transport.bpm+' BPM';sound.tick();};
$('volume').oninput=e=>{sound.setVolume(Number(e.target.value)/100);$('volume-value').textContent=e.target.value+'%';};
$('root').onchange=e=>sound.setRootHz(Number(e.target.value));$('palette').onchange=e=>settings.palette=e.target.value;
$('layers').onchange=e=>settings.layerMode=e.target.value;$('comfort').onchange=e=>settings.comfort=e.target.checked;
$('quality').onchange=async e=>{settings.quality=e.target.value;await weave();notify('NATIVE X3D / '+(settings.quality==='high'?'FINE FILIGREE':'BALANCED DETAIL'));};
function saveCertificate(){download('Sri-Yantra-Geometry-Certificate.json',JSON.stringify(C,null,2)+'\n','application/json');}
$('certificate-download').onclick=saveCertificate;$('export-certificate').onclick=saveCertificate;
$('export-score').onclick=()=>download('Resonance-Loom-score.json',JSON.stringify({schema:'resonance-score/1',settings,bpm:transport.bpm,rootHz:sound.rootHz,volume:sound.volume,beat:transport.beat(),time:transport.time(),geometrySha256:C.canonicalJsonSha256,audio:'Authored harmonic score; not a recording, checkpoint or physiological model.'},null,2)+'\n','application/json');
$('export-x3d').onclick=()=>{try{const xml=preserveExportRequirements(currentScene?.toXMLString?currentScene.toXMLString({style:'TIDY',precision:9,doublePrecision:17}):sceneXML);download('Sri-Yantra-Resonance-Loom.x3d',xml,'model/x3d+xml');notify('EXPORTED / NATIVE X3D GEOMETRY AND CURRENT APPEARANCE');}catch(e){notify(e.message);}};
function guide(){const frame=$('guide-frame');if(!frame.src&&!frame.srcdoc)frame.src='docs/FIELD-GUIDE.html';$('guide').showModal();}
$('read-guide').onclick=guide;$('guide-close').onclick=()=>$('guide').close();
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)resonance();}if(e.code==='KeyP')pause();if(e.code==='KeyM')toggleSound();if(e.code==='KeyH')document.body.classList.toggle('immersive');if(e.code==='Escape')studio(false);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){transport.pause();sound.tick();updateUI();}});
window.addEventListener('pagehide',()=>sound.dispose());
function frameView(){if(!currentScene)return;const vp=currentScene.getNamedNode('SanctuaryCamera'),wide=innerWidth>1000;vp.position=new X3D.SFVec3f(wide?-1.6:0,wide?-.15:.15,18);const extent=innerWidth<760?6.35:5.7;vp.fieldOfView=new X3D.MFFloat(-extent,-extent,extent,extent);}
window.addEventListener('resize',frameView);
async function weave(){
  const token=++renderToken,result=createArtwork({quality:settings.quality});sceneXML=result.xml;sceneStats=result.stats;
  const candidate=await S.browser.createX3DFromString(result.xml);if(token!==renderToken)return;
  await S.browser.replaceWorld(candidate);currentScene=candidate;S.scene=candidate;S.sceneStats=sceneStats;frameView();
  S.nativeAudit=auditTriangles(trianglesFromNativePoints(Array.from(candidate.getNamedNode('YantraCoordinates').point)),1e-7);
  if(!S.nativeAudit.pass)throw Error('Native-coordinate geometry witness failed its 1e-7 R tolerance.');
  $('certificate-stats').insertAdjacentHTML('beforeend',currentScene===candidate&&!$('native-audit-card')?`<div id="native-audit-card"><span>ACTUAL NATIVE X3D POINT FIELD</span><strong>${S.nativeAudit.maxResidualR.toExponential(2)} R</strong></div>`:'');
  if($('native-audit-card'))$('native-audit-card').querySelector('strong').textContent=S.nativeAudit.maxResidualR.toExponential(2)+' R';
}
function updateUI(){
  const on=!!sound.context&&!sound.muted;$('sound').textContent=on?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(on));$('begin-sound').innerHTML=on?'Sound is awake <span>♪</span>':'Awaken sound <span>♪</span>';
  const running=transport.state==='running';$('play').textContent=running?'Ⅱ':'▶';$('play').setAttribute('aria-label',running?'Pause audiovisual transport':'Resume audiovisual transport');
  $('transport-label').textContent=(running?'A quiet field':'Held in stillness')+' / '+(on?'harmonics on':'sound off');
  const beat=transport.beat();document.querySelectorAll('.beat-lights i').forEach((el,i)=>el.classList.toggle('on',i===Math.floor(beat)%4&&running));
  $('clock-label').textContent=transport.bpm+' BPM · '+(transport.clock==='audio'?'AUDIO CLOCK':'VISUAL CLOCK')+' · X_ITE '+(S.browser?.version??'16.8.0');
  $('diagnostics').textContent=`ENGINE         X_ITE ${S.browser?.version??'—'}\nGEOMETRY       Native X3D / ${sceneStats?.shapes??0} shapes\nCANONICAL      9 triangles / ${C.activeChambers} chambers\nCOORD WRITES   ${S.geometryWrites}\nSYNTH FIELD    64 authored oscillators\nCOHERENCE      ${(S.state?.coherence??0).toFixed(4)}\nBEAT / CLOCK   ${beat.toFixed(3)} / ${transport.clock}\nSCHEDULED      ${sound.stats().scheduledNotes} plucks\nACTIVE VOICES  ${sound.stats().activeVoices}\nAUDIO STATE    ${sound.stats().contextState}\nDETAIL         ${settings.quality}\nX3D SIZE       ${((sceneStats?.bytes??0)/1024).toFixed(0)} KiB`;
}
function render(now){
  const state=sampleField(transport.time(),transport.beat(),{...settings,pulseBeat:S.pulseBeat});S.state=state;
  sound.setTexture(state);sound.tick();
  if(currentScene)applySceneState(currentScene,X3D,{...state,motion:settings.comfort?0:1,yantraFrontOpacity:settings.front,yantraBackOpacity:settings.back,layerMode:settings.layerMode,tilt:settings.tilt});
  S.frame++;if(now-uiAt>120){updateUI();uiAt=now;}if(now>messageUntil)$('message').classList.remove('on');requestAnimationFrame(render);
}
try{
  await Promise.race([customElements.whenDefined('x3d-canvas'),new Promise((_,reject)=>setTimeout(()=>reject(Error('X_ITE did not initialize. Reload in a WebGL 2 browser.')),20000))]);S.browser=$('sanctuary').browser;
  S.browser.setBrowserOption('Multisampling',4);S.browser.setBrowserOption('MaximumFrameRate',60);S.browser.setBrowserOption('ContentScale',Math.min(devicePixelRatio||1,1.5));
  await weave();S.ready=true;$('loading').hidden=true;requestAnimationFrame(render);
}catch(e){S.error=e.message;$('loading-text').textContent='X3D COULD NOT START / '+e.message;console.error(e);}
