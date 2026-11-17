// ===== app.js : the game loop, the bench (Tinker, X3D, Solver, Profiler) and the optional curator provider =====
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const S = { level: defaultLevel(), base: null, sim: null, tune: { fricMul: 1, restAdd: 0, soft: 1, damp: 0.03 }, feel: {}, paused: false, slow: false, timeScale: 1,
  kernel: null, replay: [], scrub: -1, acc: 0, prof: {}, simMs: 0, renderMs: 0, fps: 60, energy: [], best: 0, mouse: { x: 0, y: 0 }, x3dDirty: true, undo: null, tab: 'play', cardT: 0, expedition: null, practiceReason: '', selectedId: null, ghostOn: true, ghostTrail: [], liveSnapshot: null, gamepadOn: false, gamepadButtons: [], droppedTime: 0, show: null, feedback: null, reducedMotion: false, effectsOn: true, soundOn: false };
S.base = cloneLevel(S.level);
S.stockLevel = cloneLevel(S.level);
try { S.best = +localStorage.getItem('floplab-best') || 0; } catch (e) {}
const view = new View($('view'));
S.show = new StuntShow({ puffs: true });
S.feedback = new StuntFeedback({ stage: $('stage'), volume: 0.2 });
S.reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
S.feedback.setReducedMotion(S.reducedMotion); view.reducedMotion = S.reducedMotion;
$('stage').classList.toggle('calm', S.reducedMotion);
if (S.reducedMotion) { view.shakeOn = false; $('shakeToggle').checked = false; }
$('reducedMotionToggle').checked = S.reducedMotion;
let stickerStamp = '';


// ---------- world lifecycle ----------
function rebuild(keep) {
  validateLevel(S.level);
  returnLive();
  const old = S.sim; S.sim = new Sim(S.level, { tune: S.tune, feel: S.feel }); const sim = S.sim;
  if (S.kernel) sim.W.kernel = S.kernel;
  sim.W.clock = () => performance.now();                        // lent to the profiler only
  if (keep && old) {
    const f = old.focus();
    if (isFinite(f.x + f.y)) { sim.hero.x = f.x; sim.hero.y = f.y + 0.4; sim.hero.px = sim.hero.x; sim.hero.py = sim.hero.y; }
    sim.cp = old.cp; sim.hall = old.hall; sim.stunts = old.stunts; sim.lastStunt = old.lastStunt;
    const got = new Set(old.W.zones.filter((z) => z.got).map((z) => z.id));
    for (const z of sim.W.zones) if (got.has(z.id)) { z.got = true; sim.stars++; }
  }
  S.expedition = new Expedition(S.level);
  if (S.practiceReason) S.expedition.invalidate(S.practiceReason);
  S.selectedId = null; S.ghostTrail = []; S.liveSnapshot = null; S.show?.resetRun(sim); S.feedback?.clear();
  view.load(sim.W); view.hover = null; view.grab = null; S.replay.length = 0; S.scrub = -1; S.energy.length = 0; S.x3dDirty = true; buildHalls(); if (S.tab === 'x3d') freshX3D(); buildMissions(); updateInspector();
}
function liveAdd(part) { // put a new part into the running world without resetting anything else
  const W = S.sim.W, L = S.level; S.sim.level = L;
  for (const s of L.bodies) if (s.part === part.id) view.addBody(W.add(s));
  for (const j of L.joints) if (j.part === part.id) W.link(Object.assign({}, j, { a: W.byId.get(j.a), b: j.b ? W.byId.get(j.b) : null }));
  for (const z of L.zones) if (z.part === part.id) { const zz = Object.assign({}, z); if (z.kind === 'water') { const n = Math.max(8, Math.round(z.w / 0.25)); zz.col = new Float64Array(n); zz.vel = new Float64Array(n); } W.zones.push(zz); view.addZone(zz); if (z.kind === 'star') S.sim.starTotal++; }
  S.replay.length = 0; S.scrub = -1; S.x3dDirty = true; if (part.kind === 'checkpoint') buildHalls();
}
function markPractice(reason) {
  returnLive(); S.practiceReason = reason;
  if (S.expedition) S.expedition.invalidate(reason);
}
function checkPart(kind, p) { if (kind) validatePart(kind, p); }
function dropPart(kind, p, x, y) {
  returnLive(); validateLevel(S.level);
  const q = Object.assign({ x: +Number(x).toFixed(2), y: +Number(y).toFixed(2) }, p);
  validatePart(kind, q);
  const candidate = cloneLevel(S.level), part = addPart(candidate, kind, q);
  validateLevel(candidate); // expansion and aggregate limits are checked before the live world changes
  S.undo = cloneLevel(S.level); S.level = candidate; markPractice('Course edited: free laboratory practice'); liveAdd(part);
  return part;
}

// ---------- expedition and the learning bench ----------
function buildMissions() {
  const list = $('missions'); if (!list || !S.expedition) return; list.textContent = '';
  for (const m of S.expedition.missions) {
    const button = document.createElement('button'); button.className = 'mission'; button.disabled = !m.available;
    const title = document.createElement('strong'); title.textContent = m.title;
    const description = document.createElement('span'); description.textContent = m.brief;
    const goal = document.createElement('small'); goal.textContent = (m.hall || 'Course') + ' · ' + m.goal + ' ' + m.unit;
    button.append(title, description, goal); button.onclick = () => beginMission(m.id); list.append(button);
  }
}
function beginMission(id) {
  returnLive(); drop(); held.clear(); jumpQ = flopQ = dashQ = puffQ = false;
  try {
    // A retry is a fresh physical attempt: obstacles, motor phase and the solver clock reset.
    // Retain the campaign's local records and practice eligibility for this unchanged source.
    if (id !== 'free' && id !== 'freeplay') {
      const campaign = S.expedition;
      if (!campaign.missions.some(m => m.id === id && m.available)) throw new Error('That challenge is unavailable in this world.');
      rebuild(false);
      S.expedition = campaign;
      buildMissions();
    }
    S.expedition.start(id, S.sim); S.ghostTrail = []; view.setGhost?.([]);
    S.paused = false; $('bPause').textContent = 'Pause'; $('bPause').classList.remove('on');
    view.setCameraMode?.('follow'); $('cameraMode').value = 'follow';
    toast(id === 'free' || id === 'freeplay' ? 'FREE EXPLORATION' : 'FRESH ATTEMPT');
    updateExpedition(); $('view').focus();
  } catch (e) { toast(e.message); }
}
function updateExpedition() {
  if (!S.expedition) return; const e = S.expedition.summary();
  $('missionTitle').textContent = e.title; $('missionState').textContent = e.state === 'free' ? 'FREE EXPLORATION' : e.eligible ? e.state.toUpperCase() : 'PRACTICE · ' + e.state.toUpperCase();
  $('missionHint').textContent = e.hint; $('missionTimer').textContent = e.time.toFixed(2) + ' s';
  $('missionProgress').max = Math.max(0.001, Number(e.target) || 1); $('missionProgress').value = Math.max(0, Number(e.progress) || 0);
  $('missionValue').textContent = e.state === 'free' ? 'Choose a challenge or make your own experiment.' : Number(e.progress).toFixed(/^[sm](?: |$)/.test(e.unit) ? 1 : 0) + ' / ' + e.target + ' ' + e.unit;
  $('missionMedal').textContent = e.medal ? e.medal.toUpperCase() + ' MEDAL' : e.best ? 'BEST ' + e.best.time.toFixed(2) + ' s' : 'SESSION RECORDS';
  $('practiceNote').hidden = !e.practiceReason; $('practiceNote').textContent = e.practiceReason ? e.practiceReason + '. Restore the stock course to earn challenge medals.' : '';
  $('dashStatus').textContent = e.dashReady ? 'DASH READY · E / C' : 'DASH · LAND TO RECHARGE';
  $('missionStripTitle').textContent = e.state === 'free' ? 'Your next experiment is a leap away.' : e.title;
  $('missionStripInfo').textContent = e.state === 'free' ? 'Run · jump · hook · go limp · discover' : e.state.toUpperCase() + ' · ' + e.time.toFixed(2) + ' s · ' + $('missionValue').textContent;
  $('missionStrip').dataset.state = e.state;
  if (S.ghostOn && e.ghost) { S.ghostTrail.push(e.ghost); if (S.ghostTrail.length > 180) S.ghostTrail.shift(); view.setGhost?.(S.ghostTrail); }
  else if (!S.ghostOn) view.setGhost?.([]);
}
// Showtime is a session toy score, separate from the original challenge medals.
function updateShowtime() {
  if (!S.show) return;
  const q = S.show.summary(), prompt = q.prompt || {};
  $('showScore').textContent = Math.round(q.score || 0).toLocaleString();
  $('showMultiplier').textContent = '×' + Number(q.multiplier || 1).toFixed(1);
  $('showTitle').textContent = q.title || 'Your audience is ready';
  $('showCaption').textContent = S.scrub >= 0 ? 'POSE REVIEW · show score is frozen at the live tail' : q.caption || 'Jump, F, then Q. Finish with F to bank your chain.';
  $('showBank').textContent = Math.round(q.banked || 0).toLocaleString();
  $('showBest').textContent = Math.round(q.best || 0).toLocaleString();
  $('showCombo').textContent = q.combo || 0;
  $('crowdMeter').value = Math.max(0, Math.min(1, q.crowd || 0));
  $('crowdValue').textContent = Math.round((q.crowd || 0) * 100) + '%';
  $('puffStatus').textContent = !q.puffEnabled ? 'PUFFS OFF · classic ragdoll' : 'Q · ' + q.puffsLeft + ' / ' + q.puffMax + ' PUFFS' + (q.puffReady ? ' READY' : S.sim.mode === 'limp' ? ' · RECHARGING' : ' · FLOP FIRST');
  $('showHudScore').textContent = Math.round(q.score || 0).toLocaleString();
  $('showHudCombo').textContent = '×' + Number(q.multiplier || 1).toFixed(1) + ' · ' + (q.combo || 0) + ' tricks';
  $('showHudPuffs').textContent = !q.puffEnabled ? 'Q puffs off' : 'Q ' + q.puffsLeft + '/' + q.puffMax;
  $('showHudTitle').textContent = q.title || 'MAKE A SCENE';
  $('showPromptTitle').textContent = prompt.title || 'A little creative gravity';
  $('showPromptBrief').textContent = prompt.brief || 'Try a trick, then stand to bank it.';
  $('showPromptProgress').max = Math.max(0.001, Number(prompt.target) || 1);
  $('showPromptProgress').value = Math.max(0, Number(prompt.progress) || 0);
  $('showPromptValue').textContent = (prompt.complete ? 'COMPLETE · ' : '') + Number(prompt.progress || 0).toFixed(Number(prompt.target) < 1 ? 2 : 1) + ' / ' + (prompt.target || 1) + ' ' + (prompt.unit || '');
  const stamp = (q.stickers || []).map(a => a.id + ':' + !!a.earned).join('|');
  if (stamp !== stickerStamp) {
    stickerStamp = stamp; $('stickers').textContent = '';
    for (const a of q.stickers || []) {
      const card = document.createElement('div'); card.className = 'sticker' + (a.earned ? ' earned' : '');
      const title = document.createElement('strong'); title.textContent = (a.earned ? '★ ' : '◇ ') + a.title;
      const brief = document.createElement('span'); brief.textContent = a.brief;
      card.append(title, brief); $('stickers').append(card);
    }
  }
  const f = S.feedback?.status();
  if (f) $('audioStatus').textContent = f.soundEnabled ? 'Sound on · soft synthesized effects · ' + Math.round(f.volume * 100) + '%' : f.audioState === 'unavailable' ? 'Audio unavailable here. The show remains visual.' : 'Sound off. Enable it for boings, squeaks and tiny fanfares.';
}
async function setShowSound(enabled) {
  if (enabled) {
    const status = await S.feedback.enableSound(); S.soundOn = !!status.soundEnabled;
  } else { S.feedback.disableSound(); S.soundOn = false; }
  $('soundToggle').checked = S.soundOn; updateShowtime();
}
$('soundToggle').onchange = e => { setShowSound(e.target.checked).catch(() => { S.soundOn = false; $('soundToggle').checked = false; $('audioStatus').textContent = 'Audio could not start in this host.'; }); };
$('showVolume').oninput = e => { S.feedback.setVolume(Number(e.target.value)); updateShowtime(); };
$('effectsToggle').onchange = e => { S.effectsOn = e.target.checked; S.feedback.setEnabled(S.effectsOn); if (!S.effectsOn) S.feedback.clear(); };
function applyMotionComfort() {
  S.reducedMotion = $('reducedMotionToggle').checked || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  S.feedback.setReducedMotion(S.reducedMotion); view.reducedMotion = S.reducedMotion; view.shakeOn = !S.reducedMotion && $('shakeToggle').checked;
  $('stage').classList.toggle('calm', S.reducedMotion);
}
$('reducedMotionToggle').onchange = applyMotionComfort;
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', applyMotionComfort);
$('costumeMode').onchange = e => view.setCostume?.(e.target.value);
$('puffToggle').onchange = e => { S.show.puffEnabled = e.target.checked; updateShowtime(); };
$('showPromptNext').onclick = () => { S.show.nextPrompt(); updateShowtime(); $('view').focus(); };
$('carnivalStart').onclick = () => { $('worldRecipe').value = 'carnival'; $('worldGenerate').click(); showTab('play'); $('view').focus(); };
function worldBurst(x, y, power, color) { if (S.effectsOn && !S.reducedMotion) view.burst(x, y, power, color); }
function selectBody(body) { S.selectedId = body?.id || null; view.select?.(body || null); updateInspector(); }
function updateInspector() {
  const body = S.sim?.W.byId.get(S.selectedId), part = body && S.level.parts.find(p => p.id === body.part);
  $('partLabel').textContent = body ? body.id + ' · ' + body.role : 'Click a body to inspect its source part';
  $('partFocus').disabled = !body; $('partApply').disabled = $('partDelete').disabled = !part;
  $('partParams').disabled = !part; $('partParams').value = part ? JSON.stringify(part.p, null, 2) : '';
  $('partKind').textContent = part ? part.kind + ' · ' + part.id : body ? 'Runtime body: no editable source prefab' : 'Source identity stays separate from the drawn mesh.';
}
$('missionRetry').onclick = () => { const id = S.expedition.summary().id; beginMission(id || 'free'); };
$('missionNext').onclick = () => {
  const campaign=S.expedition, missions=campaign.missions, current=campaign.summary().id;
  const index=missions.findIndex(m=>m.id===current); let next=null;
  for(let n=1;n<=missions.length;n++) { const m=missions[(index+n)%missions.length]; if(m.available&&!campaign.completed.has(m.id)) { next=m; break; } }
  next ||= missions.find(m=>m.available);
  beginMission(next ? next.id : 'free');
};
$('missionFree').onclick = () => beginMission('free');
$('stockCourse').onclick = () => { returnLive(); S.level = cloneLevel(S.stockLevel); S.base = cloneLevel(S.stockLevel); S.tune = {fricMul:1,restAdd:0,soft:1,damp:0.03}; S.feel = {}; S.kernel = null; S.timeScale = 1; S.practiceReason = ''; rebuild(false); buildTinker(); $('kText').value = KERNEL_SOURCE; kStat('Stock solver running.'); toast('STOCK COURSE RESTORED'); };
$('ghostToggle').onchange = e => { S.ghostOn = e.target.checked; if(!S.ghostOn) view.setGhost?.([]); };
$('partFocus').onclick = () => { const b = S.sim.W.byId.get(S.selectedId); if(b) { view.frameBody?.(b); $('cameraMode').value = 'free'; } };
$('partApply').onclick = () => { try { returnLive(); const b = S.sim.W.byId.get(S.selectedId), part = b && S.level.parts.find(p=>p.id===b.part); if(!part) return; const params = JSON.parse($('partParams').value); validatePart(part.kind, params); const candidate = cloneLevel(S.level); editPart(candidate, part.id, params); validateLevel(candidate); S.undo = cloneLevel(S.level); S.level = candidate; markPractice('Selected part edited'); rebuild(true); buildTinker(); $('partStatus').textContent = 'Source part updated, world rebuilt, X3D export updated.'; } catch(e) { $('partStatus').textContent = e.message; } };
$('partDelete').onclick = () => { const b = S.sim.W.byId.get(S.selectedId); if(!b?.part) return; try { const candidate = cloneLevel(S.level); removePart(candidate,b.part); validateLevel(candidate); S.undo = cloneLevel(S.level); S.level = candidate; markPractice('Source part removed'); rebuild(true); toast('SOURCE PART REMOVED'); } catch(e) { $('partStatus').textContent = e.message; } };
$('cameraMode').onchange = e => view.setCameraMode?.(e.target.value);
$('quality').onchange = e => view.setQuality?.(e.target.value);
$('shakeToggle').onchange = e => view.shakeOn = e.target.checked && !S.reducedMotion;
$('gamepadToggle').onchange = e => { S.gamepadOn = e.target.checked; S.gamepadButtons = []; $('controllerStatus').textContent = S.gamepadOn ? 'Controller enabled; connect a gamepad and focus the course.' : 'Keyboard / touch. Gamepad is opt-in.'; };
for(const recipe of LAB_WORLDS) { const o=document.createElement('option'); o.value=recipe.id; o.textContent=recipe.title; $('worldRecipe').append(o); }
$('worldGenerate').onclick=()=>{try{const seed=Number($('worldSeed').value);if(!Number.isInteger(seed)||seed<1||seed>2147483647)throw new Error('Seed must be an integer from 1 to 2147483647');const recipe=$('worldRecipe').value,candidate=createLabWorld(recipe,seed);validateLevel(candidate);returnLive();S.undo=cloneLevel(S.level);S.level=candidate;S.base=cloneLevel(candidate);S.practiceReason='Generated recipe world: laboratory practice';rebuild(false);buildTinker();beginMission('free');$('worldNote').textContent=LAB_WORLDS.find(r=>r.id===recipe)?.brief||'';toast('WORLD READY · SEED '+seed);}catch(e){$('worldNote').textContent=e.message;}};
$('undoEdit').onclick = () => { if(!S.undo) return; const old=S.undo; S.undo=cloneLevel(S.level); S.level=old; markPractice('Undo source edit'); rebuild(true); buildTinker(); toast('SOURCE EDIT UNDONE'); };

// ---------- input ----------
const held = new Set(); let jumpQ = false, flopQ = false, dashQ = false, puffQ = false;
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  ShiftLeft: 'hook', ShiftRight: 'hook', KeyX: 'hook', KeyJ: 'hook', KeyF: 'flop', KeyQ: 'puff', KeyE: 'dash', KeyC: 'dash' };
const DROPS = [['crates', { cols: 1, rows: 1 }, 'Crate'], ['ball', {}, 'Ball'], ['dominoes', { count: 8 }, 'Dominoes'], ['jelly', { cols: 4, rows: 3 }, 'Jelly'], ['spring', {}, 'Bounce pad'], ['fan', { h: 8 }, 'Fan'], ['ring', {}, 'Ring'], ['pendulum', { length: 5 }, 'Wrecker']];
const typing = (e) => /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target?.tagName || '') || !!e.target?.isContentEditable;
function press(k) { if (k === 'jump' && !held.has(k)) jumpQ = true; if (k === 'flop' && !held.has(k)) flopQ = true; if (k === 'dash' && !held.has(k)) dashQ = true; if (k === 'puff' && !held.has(k)) puffQ = true; held.add(k); }
addEventListener('keydown', (e) => {
  if (typing(e) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = KEYMAP[e.code];
  if (k) { press(k); e.preventDefault(); return; }
  if (e.code === 'KeyP') togglePause(); else if (e.code === 'Period') stepOnce(); else if (e.code === 'KeyR') { returnLive(); S.sim.respawn(); } else if (e.code === 'KeyM') { setShowSound(!S.soundOn).catch(() => {}); }
  else if (/^Digit[1-8]$/.test(e.code)) { const d = DROPS[+e.code.slice(5) - 1]; try { dropPart(d[0], d[1], S.mouse.x, S.mouse.y); } catch (er) { toast(er.message); } }
  else if ((e.code === 'Delete' || e.code === 'Backspace') && view.hover && view.hover.part) { const id = view.hover.part; if (S.level.parts.some((p) => p.id === id)) { const candidate = cloneLevel(S.level); removePart(candidate, id); validateLevel(candidate); S.undo = cloneLevel(S.level); S.level = candidate; markPractice('Source part removed'); rebuild(true); toast('REMOVED ' + id.toUpperCase()); } e.preventDefault(); }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) held.delete(k); });
addEventListener('blur', () => { held.clear(); jumpQ = flopQ = dashQ = puffQ = false; S.gamepadButtons = []; drop(); });
for (const b of document.querySelectorAll('#touch button')) {
  const k = b.dataset.k; b.addEventListener('pointerdown', (e) => { press(k); b.setPointerCapture(e.pointerId); e.preventDefault(); });
  const up = () => held.delete(k); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
}
function readInput() {
  const i = { x: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0), y: (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0), jump: held.has('jump'), jumpP: jumpQ, hook: held.has('hook'), flopP: flopQ, dashP: dashQ, puffP: puffQ };
  jumpQ = flopQ = dashQ = puffQ = false;
  if (S.gamepadOn && document.hasFocus() && document.activeElement === $('view') && navigator.getGamepads) {
    let pad=null; try { pad=Array.from(navigator.getGamepads()).find(Boolean); } catch(e) { S.gamepadOn=false; $('gamepadToggle').checked=false; $('controllerStatus').textContent='Gamepad access unavailable in this host. Keyboard / touch remain active.'; }
    if(pad) { const axis=v=>Math.abs(v||0)>.22?Math.sign(v):0, buttons=[0,1,2,5,3].map(k=>!!pad.buttons[k]?.pressed); i.x ||= axis(pad.axes[0]); i.y ||= -axis(pad.axes[1]); i.jump ||= buttons[0]; i.jumpP ||= buttons[0]&&!S.gamepadButtons[0]; i.flopP ||= buttons[1]&&!S.gamepadButtons[1]; i.dashP ||= buttons[2]&&!S.gamepadButtons[2]; i.hook ||= buttons[3]; i.puffP ||= buttons[4]&&!S.gamepadButtons[4]; S.gamepadButtons=buttons; $('controllerStatus').textContent='Controller: left stick move · A jump · B flop · X dash · Y puff · RB hook'; }
    else { S.gamepadButtons=[]; $('controllerStatus').textContent='Gamepad enabled; none connected. Keyboard / touch still work.'; }
  } else S.gamepadButtons=[];
  return i;
}
// mouse: hover, drag, zoom
const cv = $('view'); let panPointer = null, pendingGrab = null;
cv.addEventListener('pointermove', e => {
  if(panPointer) { const a=view.worldAt(panPointer.x,panPointer.y),b=view.worldAt(e.clientX,e.clientY); view.pan?.(a.x-b.x,a.y-b.y); panPointer={x:e.clientX,y:e.clientY}; return; }
  S.mouse=view.worldAt(e.clientX,e.clientY);
  if(pendingGrab && Math.hypot(e.clientX-pendingGrab.x,e.clientY-pendingGrab.y)>5) {
    const sim=S.sim; let body=pendingGrab.body; pendingGrab=null; markPractice('Body dragged: direct physics intervention');
    if(body===sim.hero && sim.mode==='hero') { sim.flop(sim.hero.vx,sim.hero.vy,'you were grabbed'); body=sim.rag.chest; }
    view.grab=sim.W.link({type:'rope',a:body,ax:S.mouse.x,ay:S.mouse.y,bx:S.mouse.x,by:S.mouse.y,rest:0,comp:.015/body.mass,temp:true});
  }
  if(view.grab) { view.grab.lbx=S.mouse.x; view.grab.lby=S.mouse.y; }
  else view.hover=S.sim.W.pick(S.mouse.x,S.mouse.y);
});
cv.addEventListener('pointerdown', e => {
  cv.focus({preventScroll:true});
  if(e.altKey||e.button===1) { panPointer={x:e.clientX,y:e.clientY}; cv.setPointerCapture(e.pointerId); $('cameraMode').value='free';e.preventDefault();return; }
  S.mouse=view.worldAt(e.clientX,e.clientY);const body=S.sim.W.pick(S.mouse.x,S.mouse.y);selectBody(body);
  if(S.scrub>=0) return;
  if(body&&body.im>0) { pendingGrab={body,x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId); }
});
const drop=()=>{panPointer=null;pendingGrab=null;if(!view.grab)return;const i=S.sim.W.joints.indexOf(view.grab);if(i>=0)S.sim.W.joints.splice(i,1);view.grab=null;};
cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);
cv.addEventListener('wheel', (e) => { view.zoom = clamp(view.zoom * Math.exp(e.deltaY * 0.0012), 0.4, 3.2); e.preventDefault(); }, { passive: false });

// Sound is opt-in through StuntFeedback; no automatic audio context is created.

// ---------- the loop ----------
let toastT = 0;
function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('show'); toastT = 1.6; }
function tick() {
  if(S.scrub>=0) return;
  const sim = S.sim, W = sim.W, t0 = performance.now(), input = readInput();
  try {
    const dashed = S.expedition?.beforeStep(sim,input,1/60);
    const puffed = S.show?.beforeStep(sim,input,1/60);
    if (dashed) S.show?.noteDash(sim);
    if (puffed && S.expedition?.state === 'active') {
      S.practiceReason = 'Puff assist used: this challenge is practice'; S.expedition.invalidate(S.practiceReason);
    }
    sim.step(input, 1 / 60); S.expedition?.afterStep(sim,input,1/60); S.show?.afterStep(sim,input,1/60);
  } catch (e) { solverFailed(e); return; }
  S.feedback?.emit(S.show?.events || []);
  for(const event of S.expedition?.events || []) { if(event.type==='dash') { worldBurst(event.x,event.y,1.4,PAL.cyan); } else if(event.type==='challenge-complete') { toast('CHALLENGE COMPLETE'); } else if(event.type==='challenge-failed') toast('RETRY · '+(event.reason||'CHALLENGE ENDED')); }
  const f = sim.focus(); if (!isFinite(f.x + f.y)) { solverFailed(new Error('a position became NaN')); return; }
  S.simMs += (performance.now() - t0 - S.simMs) * 0.08;
  for (const p of PHASES) S.prof[p] = (S.prof[p] || 0) + (W.prof[p] - (S.prof[p] || 0)) * 0.08;
  for (const e of sim.fx) {
    if (e.type === 'bonk') { worldBurst(e.x, e.y, 0.4 + e.speed * 0.09, PAL.pink); if (!S.reducedMotion && view.shakeOn) view.shake = Math.min(0.5, view.shake + e.speed * 0.012); }
    else if (e.type === 'star') { worldBurst(e.x, e.y, 2.2, PAL.amber); toast('★ ' + sim.stars + ' OF ' + sim.starTotal); }
    else if (e.type === 'goal') { worldBurst(e.x, e.y, 5, PAL.mint); toast('BULLSEYE +500'); }
    else if (e.type === 'boom') { if (!S.reducedMotion && view.shakeOn) view.shake = 0.6; }
    else if (e.type === 'checkpoint') toast(e.name.toUpperCase()); else if (e.type === 'stunt') showCard(e.stunt);
  }
  S.replay.push({ s: W.snapshot(), mode: sim.mode, stunt: sim.stunt ? Object.assign({}, sim.stunt) : null });
  if (S.replay.length > 600) S.replay.shift();
  if (W.frame % 3 === 0) { const en = W.energy(); S.energy.push(en); if (S.energy.length > 200) S.energy.shift(); }
}
function solverFailed(e) {
  const custom = !!S.kernel; S.kernel = null; rebuild(true);
  kStat((custom ? 'Your solver failed: ' : 'The solver failed: ') + e.message + '. The stock solver is running again; your text is still here to fix.', 'bad'); toast('SOLVER RESET');
}
function togglePause() { if(S.scrub>=0) returnLive(); S.paused = !S.paused; $('bPause').textContent = S.paused ? 'Play' : 'Pause'; $('bPause').classList.toggle('on', S.paused); }
function stepOnce() { if (!S.paused) togglePause(); if (S.scrub < 0) tick(); }
let last = performance.now(), hudT = 0;
function frame(t) {
  const dtR = Math.min(0.1, (t - last) / 1000); last = t; S.fps += (1 / Math.max(dtR, 1e-3) - S.fps) * 0.05;
  if (!S.paused && S.scrub < 0) { S.acc += dtR * S.timeScale * (S.slow ? 0.25 : 1); let n = 0; while (S.acc >= 1 / 60 && n < 4) { tick(); S.acc -= 1 / 60; n++; } if (n === 4) { S.droppedTime += S.acc; S.acc = 0; } }
  S.reducedMotion = S.feedback.reducedMotion; view.reducedMotion = S.reducedMotion; view.shakeOn = !S.reducedMotion && $('shakeToggle').checked;
  const r0 = performance.now(); view.draw(S.sim, dtR); S.feedback?.render(dtR, { paused: S.paused || S.scrub >= 0 }); S.renderMs += (performance.now() - r0 - S.renderMs) * 0.08;
  if (toastT > 0 && (toastT -= dtR) <= 0) $('toast').classList.remove('show');
  if (S.cardT > 0 && (S.cardT -= dtR) <= 0) $('card').hidden = true;
  if ((hudT += dtR) > 0.1) { hudT = 0; hud(); updateExpedition(); updateShowtime(); if (S.tab === 'profile') drawProfile(); }
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
function hud() {
  const sim = S.sim, W = sim.W, h = sim.hero;
  $('hall').textContent = sim.hall; $('stars').textContent = '★ ' + sim.stars + '/' + sim.starTotal;
  $('stat').textContent = `${S.fps.toFixed(0)} fps · sim ${S.simMs.toFixed(2)} ms · ${W.active.length} bodies`;
  const m = $('meter'), p = $('prompt'); let mt = '', pt = '';
  if (sim.mode === 'limp') { const s = sim.stunt; mt = `LIMP  air ${s.air.toFixed(1)} s · ${s.spins.toFixed(1)} spins · ${s.bonks} bonks · ${s.dist.toFixed(1)} m`; pt = 'Q: puff · A D: twist · F: stand and bank your chain'; }
  else if (sim.mode === 'cannon') { mt = `CANNON  ${sim.cannon.angle.toFixed(0)}° · ${sim.cannon.power.toFixed(0)} m/s`; pt = 'W S: aim · A D: power · Space: fire · F: climb out'; }
  else {
    for (const z of W.zones) {
      if (z.kind === 'cannon' && Math.abs(z.x - h.x) < 1.3 && Math.abs(z.y - h.y) < 1.8) pt = 'W: climb into the cannon';
      else if (z.kind === 'ring' && !sim.hook && Math.hypot(z.x - h.x, z.y - h.y) < sim.feel.hookRange) pt = 'Hold Shift: hook the ring · W S: reel · Space: let go';
      else if (z.kind === 'fan' && Math.abs(z.x - h.x) < z.w / 2 && Math.abs(z.y - h.y) < z.h / 2) pt = 'Too heavy upright. F: go limp and ride the wind';
    }
  }
  const renderInfo=view.stats?.(); if(renderInfo) $('rendererScope').textContent=(renderInfo.renderer==='canvas2d'?'Canvas2D fallback · same simulation, alternate projection':renderInfo.renderer==='webgl'?'WebGL presentation · '+(renderInfo.quality||'balanced')+' quality':'Renderer unavailable')+' · render time is CPU submission, not GPU elapsed time.';
  m.hidden = !mt; m.textContent = mt; p.hidden = !pt; p.textContent = pt;
  const b = view.hover, ins = $('inspect');
  if (b && !b.off) { ins.hidden = false; ins.textContent = `${b.id} · ${b.role}${b.im ? ' · ' + b.mass + ' kg' : b.kin ? ' · motor-driven' : ' · fixed'}\nspeed ${Math.hypot(b.vx, b.vy).toFixed(2)} m/s · spin ${b.om.toFixed(2)} rad/s${b.part && S.level.parts.some((q) => q.id === b.part) ? '\npart ' + b.part + ' (Del removes)' : ''}`; ins.style.whiteSpace = 'pre'; } else ins.hidden = true;
}
function showCard(st) {
  if (st.score > S.best) { S.best = st.score; try { localStorage.setItem('floplab-best', String(S.best)); } catch (e) {} }
  const rows = [['distance', st.distance_m + ' m'], ['air time', st.airtime_s + ' s'], ['spins', st.spins], ['bonks', st.bonks], ['hardest hit', st.hardest_hit_mps + ' m/s'], ['peak speed', st.peak_speed_mps + ' m/s'], ['peak height', st.peak_height_m + ' m']];
  if (st.hit_goal) rows.push(['bullseye', '+500']);
  $('card').innerHTML = `<h3>${st.score} CLASSIC PTS</h3><div class="why">${esc(st.why)} · classic best ${S.best}. Showtime banks a separate style chain.</div><table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table><button id="cardAsk">Ask the curator why</button>`;
  $('card').hidden = false; S.cardT = 10; $('cardAsk').onclick = () => { showTab('curator'); ask('Explain my last flop: where did the points come from, and what one change would score more?'); };
}
function buildHalls() {
  const el = $('halls'); el.textContent = '';
  for (const z of S.sim.W.zones) if (z.kind === 'checkpoint') { const b = document.createElement('button'); b.textContent = z.name; b.onclick = () => { markPractice('Hall teleport'); S.sim.goTo(z.x, z.y - 2); S.sim.hall = z.name; b.blur(); }; el.append(b); }
}
$('bPause').onclick = () => { togglePause(); $('view').focus(); }; $('bStep').onclick = () => { stepOnce(); $('view').focus(); };
$('bSlow').onclick = () => { S.slow = !S.slow; $('bSlow').classList.toggle('on', S.slow); };
$('bReset').onclick = () => { markPractice('Course reset'); S.level = cloneLevel(S.base); rebuild(false); toast('LEVEL RESET'); };

// ---------- tabs ----------
function showTab(t) {
  S.tab = t; for (const b of document.querySelectorAll('#tabs button')) { b.setAttribute('aria-selected', String(b.dataset.t === t)); b.tabIndex=b.dataset.t===t?0:-1; }
  for (const p of document.querySelectorAll('.pane')) p.classList.toggle('show', p.id === 'p-' + t);
  if (t === 'x3d' && S.x3dDirty) freshX3D();
}
for (const b of document.querySelectorAll('#tabs button')) { b.onclick = () => showTab(b.dataset.t); b.id='tab-'+b.dataset.t; b.setAttribute('aria-controls','p-'+b.dataset.t); $('p-'+b.dataset.t).setAttribute('role','tabpanel'); $('p-'+b.dataset.t).setAttribute('aria-labelledby',b.id); b.addEventListener('keydown',e=>{const all=[...document.querySelectorAll('#tabs button')],i=all.indexOf(b);let n;if(e.key==='ArrowRight')n=(i+1)%all.length;else if(e.key==='ArrowLeft')n=(i+all.length-1)%all.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=all.length-1;else return;e.preventDefault();showTab(all[n].dataset.t);all[n].focus();}); }

// ---------- Tinker ----------
const SLIDERS = [
  ['World gravity', 0, 60, 0.5, () => S.level.physics.gravity, (v) => { S.level.physics.gravity = v; S.sim.W.P.gy = -v; }, 'm/s²'],
  ['Time scale', 0.1, 2, 0.05, () => S.timeScale, (v) => (S.timeScale = v), '×'],
  ['Substeps', 1, 24, 1, () => S.level.physics.substeps, (v) => { S.level.physics.substeps = v; S.sim.W.P.substeps = v; }, ''],
  ['Iterations', 1, 6, 1, () => S.level.physics.iters, (v) => { S.level.physics.iters = v; S.sim.W.P.iters = v; }, ''],
  ['Friction', 0, 2, 0.05, () => S.tune.fricMul, (v) => { S.tune.fricMul = v; S.sim.W.P.fricMul = v; }, '×'],
  ['Extra bounce', -0.3, 0.9, 0.05, () => S.tune.restAdd, (v) => { S.tune.restAdd = v; S.sim.W.P.restAdd = v; }, ''],
  ['Spring softness', -2, 2, 0.1, () => Math.log10(S.tune.soft), (v) => { S.tune.soft = Math.pow(10, v); S.sim.W.P.soft = S.tune.soft; }, 'log×'],
  ['Air drag', 0, 1, 0.01, () => S.tune.damp, (v) => { S.tune.damp = v; S.sim.W.P.damp = v; }, '/s'],
  ['Hero run speed', 3, 18, 0.2, () => S.sim.feel.run, (v) => { S.feel.run = v; S.sim.feel.run = v; }, 'm/s'],
  ['Hero jump speed', 6, 28, 0.2, () => S.sim.feel.jumpV, (v) => { S.feel.jumpV = v; S.sim.feel.jumpV = v; }, 'm/s'],
];
function buildTinker() {
  const box = $('sliders'); box.textContent = '';
  SLIDERS.forEach(([name, min, max, step, get, set, unit], i) => {
    const row = document.createElement('label'); row.className = 'sl'; row.innerHTML = `<span>${name}</span><input type="range" id="sl${i}" min="${min}" max="${max}" step="${step}"><output></output>`;
    const inp = row.querySelector('input'), out = row.querySelector('output'), show = () => (out.textContent = (+inp.value).toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0) + (unit ? ' ' + unit : ''));
    inp.value = get(); show(); inp.oninput = () => { markPractice('Tuning changed'); set(+inp.value); show(); S.x3dDirty = true; }; box.append(row);
  });
  const tg = $('toggles'); tg.textContent = '';
  for (const [k, name] of [['contacts', 'Contacts'], ['joints', 'Joints'], ['velocity', 'Velocities'], ['pairs', 'Broad-phase pairs'], ['trail', 'Flight trail'], ['centers','Centres of mass']]) {
    const l = document.createElement('label'); l.className = 'tg'; l.innerHTML = `<input type="checkbox" id="ov-${k}" ${view.overlay[k] ? 'checked' : ''}>${name}`; l.querySelector('input').onchange = (e) => (view.overlay[k] = e.target.checked); tg.append(l);
  }
  const bl = document.createElement('label'); bl.className = 'tg'; bl.innerHTML = `<input type="checkbox" id="ov-bloom" checked>Glow`; bl.querySelector('input').onchange = (e) => (view.bloomOn = e.target.checked); tg.append(bl);
  const dr = $('drops'); dr.textContent = '';
  DROPS.forEach(([kind, p, name], i) => { const b = document.createElement('button'); b.textContent = `${i + 1} ${name}`; b.onclick = () => { const f = S.sim.focus(); try { dropPart(kind, p, f.x + 3 * S.sim.face, f.y + (kind === 'ring' || kind === 'pendulum' ? 5 : 1.5)); } catch (e) { toast(e.message); } }; dr.append(b); });
}

// ---------- X3D ----------
function xStat(s, cls) { const e = $('xStat'); e.textContent = s; e.className = 'status ' + (cls || ''); }
function freshX3D() { const t = toX3D(S.level); $('xText').value = t; S.x3dDirty = false; xStat(`${S.level.bodies.length} RigidBody · ${S.level.joints.length} joints · ${S.level.zones.length} sensors · ${S.level.parts.length} parts · ${(t.length / 1024).toFixed(0)} KB`); }
$('xFresh').onclick = freshX3D;
$('xApply').onclick = () => {
  try { const L = fromX3D($('xText').value); validateLevel(L); buildWorld(L); markPractice('Imported X3D source'); S.undo = cloneLevel(S.level); S.level = L; S.base = cloneLevel(L); rebuild(true); buildTinker();
    xStat(`Applied supported slice: ${L.bodies.length} bodies, ${L.joints.length} joints, ${L.zones.length} sensors. Reset returns to this file. Custom XPBD metadata is not a native-physics parity claim.`, 'good'); } catch (e) { xStat(e.message, 'bad'); }
};
$('xCopy').onclick = async () => { const t = $('xText'); try { await navigator.clipboard.writeText(t.value); xStat('Copied. Paste into a .x3d file.', 'good'); } catch (e) { t.focus(); t.select(); xStat('Selected. Press Ctrl+C or Cmd+C to copy.'); } };

// ---------- Solver ----------
function kStat(s, cls) { const e = $('kStat'); e.textContent = s; e.className = 'status ' + (cls || ''); }
function compileAny(src) {
  try { return compileKernel(src); } catch (e) { if (!(e instanceof EvalError)) throw e; }
  const key = '__flopk' + Date.now(), s = document.createElement('script');       // viewers that forbid eval: try an inline script instead
  window.__flopMath = { sin, cos, hyp };
  s.textContent = `window.${key}=(function(){const { sin, cos, hyp } = window.__flopMath;\n${src}\n;return { integrate, solveContact, friction, updateVelocity, bounce, substep };})();`;
  document.head.append(s); s.remove(); const k = window[key]; delete window[key];
  if (!k) throw new Error('this viewer does not allow live code, or the code has a syntax error');
  return k;
}
function smoke(k) { // 0.5 s on a tiny scene before the game trusts new solver code
  const L = newLevel(); addPart(L, 'platform', { x: 0, y: 0, w: 12, h: 1 }); addPart(L, 'crates', { x: 0, y: 0, rows: 2 }); addPart(L, 'pendulum', { x: 3, y: 5, length: 3, links: 3 }); addPart(L, 'ball', { x: -3, y: 3 });
  const W = buildWorld(L); W.kernel = k; for (let i = 0; i < 30; i++) W.step(1 / 60);
  if (W.bodies.some((b) => !isFinite(b.x + b.y + b.a))) throw new Error('it produced NaN within half a second');
}
function applyKernel(src, label) {
  try { const k = compileAny(src); smoke(k); const stock = src.trim() === KERNEL_SOURCE.trim(); markPractice(stock ? 'Solver reset during a session' : 'Custom solver running'); S.kernel = stock ? null : k; S.sim.W.kernel = stock ? KERNEL : k;
    kStat(stock ? 'Stock solver running.' : `Applied${label ? ': ' + label : ''}. The game is running your solver. The curator's experiments use it too.`, 'good'); return true;
  } catch (e) { kStat('Not applied: ' + e.message, 'bad'); return false; }
}
const after = (src, fn, find, put) => { const i = src.indexOf('function ' + fn + '('), j = src.indexOf(find, i); if (i < 0 || j < 0) throw new Error('patch point not found'); return src.slice(0, j) + put + src.slice(j + find.length); };
const BREAKS = [
  ['Friction off', 'no friction pass: everything is ice', (s) => after(s, 'substep', 'for (let k = 0; k < W.nc; k++) friction(W, W.contacts[k], h);', '/* friction pass removed */')],
  ['One corner at a time', 'face contacts solved corner by corner: watch the crate tower in Hall 6', (s) => after(after(s, 'solveContact', 'if (c.twin === 2) return;', ''), 'solveContact', 'm = c.twin === 1 ? c.mate : null', 'm = null')],
  ['Explicit Euler', 'position moved with the OLD velocity: swings gain energy (Profiler, Energy)', (s) => after(after(s, 'integrate', 'b.x += b.vx * h; b.y += b.vy * h; b.a += b.om * h;', ''), 'integrate', 'if (b.im > 0) {', 'b.px = b.x; b.py = b.y; b.pa = b.a; b.x += b.vx * h; b.y += b.vy * h; b.a += b.om * h;\n  if (b.im > 0) {').replace('  b.px = b.x; b.py = b.y; b.pa = b.a;      // remember where we were\n', '')],
  ['Super bounce', 'every fast contact returns 1.1 times its speed', (s) => after(s, 'wanted', '-c.e * c.vn0', '-1.1 * c.vn0')],
];
function buildSolver() {
  $('kText').value = KERNEL_SOURCE; const el = $('breaks'); el.textContent = '';
  for (const [name, what, patch] of BREAKS) { const b = document.createElement('button'); b.textContent = 'Break it: ' + name; b.title = what; b.onclick = () => { try { const src = patch(KERNEL_SOURCE); $('kText').value = src; applyKernel(src, what); } catch (e) { kStat(e.message, 'bad'); } }; el.append(b); }
}
$('kApply').onclick = () => applyKernel($('kText').value);
$('kReset').onclick = () => { $('kText').value = KERNEL_SOURCE; applyKernel(KERNEL_SOURCE); };
$('kText').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { applyKernel($('kText').value); e.preventDefault(); } });

// ---------- Profiler ----------
const PHCOL = { broad: '#3fd0ff', fields: '#7dffb2', integrate: '#b79bff', narrow: '#ffc23d', joints: '#ff9e5e', contacts: '#ff4fa3', velocity: '#f6f1e1', water: '#1f6fff' };
const PHNAME = { broad: 'broad phase', fields: 'wind + water forces', integrate: 'integrate', narrow: 'narrow phase', joints: 'joints', contacts: 'contacts + friction', velocity: 'velocities + bounce', water: 'water surface' };
function drawProfile() {
  const W = S.sim.W, c = $('flame').getContext('2d'), tw = 760; let tot = 0; for (const p of PHASES) tot += S.prof[p] || 0;
  c.clearRect(0, 0, tw, 60); let x = 0; const scale = tw / Math.max(tot, 1e-6);
  for (const p of PHASES) { const w = (S.prof[p] || 0) * scale; c.fillStyle = PHCOL[p]; c.fillRect(x, 0, Math.max(0, w - 1), 60); x += w; }
  $('legend').innerHTML = PHASES.map((p) => `<span><i style="background:${PHCOL[p]}"></i>${PHNAME[p]} ${(S.prof[p] || 0).toFixed(2)}</span>`).join('');
  const st = W.stats;
  $('counts').innerHTML = [['physics per fixed step', S.simMs.toFixed(2) + ' ms'], ['CPU render submission', S.renderMs.toFixed(2) + ' ms'], ['bodies awake / all', W.active.length + ' / ' + W.bodies.length], ['joints', W.joints.length],
    ['pair tests, sweep and prune', st.tests + ' (all pairs: ' + st.brute + ')'], ['pairs kept', st.pairs], ['contacts', st.contacts], ['substeps × iterations', W.P.substeps + ' × ' + W.P.iters], ['solver', S.kernel ? 'yours' : 'stock'], ['discarded catch-up time', S.droppedTime.toFixed(2) + ' s'], ['renderer', view.stats?.().renderer || 'unknown'], ['draw calls', view.stats?.().drawCalls ?? 'not measured'], ['triangles', view.stats?.().triangles ?? 'not measured']]
    .map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  // energy
  const e = $('energy').getContext('2d'), E = S.energy; e.clearRect(0, 0, 760, 240);
  if (E.length > 2) {
    const e0 = E[0].ke + E[0].pe; let lo = 0, hi = 1; for (const s of E) { hi = Math.max(hi, s.ke, s.ke + s.pe - e0); lo = Math.min(lo, s.ke + s.pe - e0); }
    const Y = (v) => 228 - ((v - lo) / (hi - lo)) * 216, X = (i) => (i / 199) * 760;
    e.strokeStyle = '#1d3a6b'; e.lineWidth = 1; e.beginPath(); e.moveTo(0, Y(0)); e.lineTo(760, Y(0)); e.stroke();
    const plot = (fn, col) => { e.strokeStyle = col; e.lineWidth = 2.5; e.beginPath(); E.forEach((s, i) => (i ? e.lineTo(X(i), Y(fn(s))) : e.moveTo(X(i), Y(fn(s))))); e.stroke(); const l = E[E.length - 1]; e.fillStyle = col; e.beginPath(); e.arc(X(E.length - 1), Y(fn(l)), 5, 0, TAU); e.fill(); };
    plot((s) => s.ke + s.pe - e0, '#3fd0ff'); plot((s) => s.ke, '#ffc23d');
    const l = E[E.length - 1];
    $('elegend').innerHTML = `<span style="color:#ffc23d">kinetic ${l.ke.toFixed(0)} J</span> · <span style="color:#3fd0ff">total, change over the window ${(l.ke + l.pe - e0).toFixed(0)} J</span> · scale ${lo.toFixed(0)} to ${hi.toFixed(0)} J`;
  }
  $('detStat').dataset.h = W.hash(); if (!$('detStat').dataset.run) $('detStat').textContent = 'pose fingerprint ' + W.hash() + ' at step ' + W.frame;
  const sc = $('scrub'); sc.max = Math.max(0, S.replay.length - 1); if (S.scrub < 0) { sc.value = sc.max; $('scrubStat').textContent = (S.replay.length / 60).toFixed(1) + ' s recorded'; }
}
$('bDet').onclick = () => {
  const mk = () => { const s = new Sim(cloneLevel(S.level), { headless: true, tune: S.tune }); if (S.kernel) s.W.kernel = S.kernel; return s; };
  const a = mk(), b = mk(); let same = 0; const n = 240; for (let i = 0; i < n; i++) { a.step(NOINPUT, 1 / 60); b.step(NOINPUT, 1 / 60); if (a.W.hash() === b.W.hash()) same++; }
  const el = $('detStat'); el.dataset.run = '1'; el.className = 'status ' + (same === n ? 'good' : 'bad');
  el.textContent = `${same} of ${n} pose fingerprints agree between two fresh runs (final ${a.W.hash()}). Same engine, same browser: this does not show agreement across browsers.`;
};
function returnLive() {
  if(S.scrub>=0 && S.sim && S.liveSnapshot) S.sim.W.restore(S.liveSnapshot,false);
  S.scrub=-1; S.liveSnapshot=null; S.acc=0; view.reviewing=false;
}
$('scrub').oninput = e => { const i=+e.target.value,r=S.replay[i]; if(!r) return; drop(); held.clear(); jumpQ=flopQ=dashQ=puffQ=false; if(S.scrub<0) S.liveSnapshot=S.sim.W.snapshot(); S.scrub=i; view.reviewing=true; S.sim.W.restore(r.s,true); $('scrubStat').textContent=((S.replay.length-1-i)/60).toFixed(2)+' s ago · pose review only; physics overlays hidden; live controller state retained'; };
$('bLive').onclick = () => { returnLive(); $('scrubStat').textContent='Returned to the retained live state.'; };
$('bFrom').onclick = () => { returnLive(); $('scrubStat').textContent='Returned to live. Historical poses cannot resume full controller state.'; };

// ---------- optional curator provider; built-in commands work without a model ----------
let sample = null, toolsOK = false, ctl = null, busy = false; const turns = [];
const RULES = `You are the Curator of Flop Lab, a playable physics museum. The visitor plays a crash-test hero in a 2.5D side-scrolling course; pressing F turns the hero into a ragdoll (11 bodies, 10 hinges). You are the lab partner: you build things, run experiments, and explain what the physics engine just did.

World facts. Units: metres, kilograms, seconds, degrees for part angles. x runs right, y runs up. The engine is a custom 2D compliant position solver written in this page, using substeps and sweep-and-prune broad phase. It does not implement the full accumulated-multiplier XPBD formulation. The editable level uses an explicitly supported X3D 4.0 slice plus custom Flop Lab metadata; native-engine physics parity is not implied. Read the CURRENT checkpoints, labels and source parts in LAB STATE; never assume museum floors or halls apply to a generated world. Showtime toy scores are separate from Expedition medals. Q puffs are authored arcade velocity changes, not simulated muscle forces.

Parts you can build (kind: meaning; defaults):
${Object.entries(PREFABS).filter(([k]) => k !== 'label' && k !== 'checkpoint').map(([k, v]) => `- ${k}: ${v.doc}; defaults ${JSON.stringify(v.d)}`).join('\n')}

Tools. build: add, edit or remove parts and set physics, several operations in one call. experiment: run the level headless many times while one number varies, and get a table back (the visitor sees a chart). act: fire the cannon, move the visitor, toggle overlays. You get only a few tool rounds per answer, so batch: one build call with all operations, one experiment call with all values.

How to answer. Be brief and concrete: 2 to 6 short sentences, plain words, numbers with units. Only state numbers that are in LAB STATE or came back from a tool in this answer; never invent a measurement. When you build, put it where the visitor asked, or about 3 m in front of the hero (hero.face is the direction), on the floor under them, and say what you built and where. When an experiment answers the question, name the best row and one caveat (for example the spinner's phase at launch, or that a headless run starts every body from rest). If asked why something happened, reason from the telemetry: speeds, contacts, friction (mu times the normal push), hinge limits, compliance, substeps. You may use **bold** and \`code\`. No headings, no tables.`;
function brief() {
  const sim = S.sim, W = sim.W, f = sim.focus();
  const parts = S.level.parts.filter((p) => !['label', 'checkpoint', 'star'].includes(p.kind)).map((p) => p.id + ' ' + p.kind + ' ' + JSON.stringify(p.p));
  return { hero: { x: +f.x.toFixed(1), y: +f.y.toFixed(1), mode: sim.mode, face: sim.face, hall: sim.hall, on_ground: !!sim.ground }, stars: sim.stars + '/' + sim.starTotal,
    checkpoints: W.zones.filter(z => z.kind === 'checkpoint').map(z => ({name:z.name,x:z.x,y:z.y})), labels: W.zones.filter(z => z.kind === 'label').map(z => ({title:z.title,text:z.text,x:z.x,y:z.y})), showtime: S.show?.summary(), physics: S.level.physics, tune: S.tune, time_scale: S.timeScale, solver_code: S.kernel ? 'edited by the visitor' : 'stock', pointing_at: view.hover ? view.hover.id : null,
    last_flop: sim.lastStunt, earlier_flops: sim.stunts.slice(-4, -1).map((s) => ({ why: s.why, score: s.score, distance_m: s.distance_m, hit_goal: s.hit_goal })), best_score: S.best,
    profile: { physics_cpu_ms_per_fixed_step: +S.simMs.toFixed(2), bodies: W.active.length, joints: W.joints.length, contacts: W.stats.contacts, pair_tests: W.stats.tests, all_pairs: W.stats.brute }, parts };
}
function md(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>'); }
function addMsg(cls, html, before) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; const log = $('log'); if (before && before.parentNode === log) log.insertBefore(d, before); else log.append(d); log.scrollTop = log.scrollHeight; return d; }
let bubble = null;
const trace = (name, text) => addMsg('tool', `<b>${name}</b> ${esc(text)}`, bubble);

async function runExperiment(o) {
  const scenario = ['cannon', 'drop', 'observe'].includes(o.scenario) ? o.scenario : 'observe';
  let values = Array.isArray(o.values) ? o.values.map(Number).filter(isFinite) : [];
  if (!values.length && o.vary && isFinite(+o.from) && isFinite(+o.to)) { const n = clamp(Math.round(+o.steps || 9), 2, 16); for (let i = 0; i < n; i++) values.push(+(+o.from + ((+o.to - +o.from) * i) / (n - 1)).toFixed(3)); }
  if (o.vary && !values.length) throw new Error('give values, or from, to and steps');
  values = values.slice(0, 16); const f = S.sim.focus(), rows = [];
  const base = { scenario, seconds: +o.seconds || 6, watch: o.watch ? String(o.watch) : undefined, poke: o.poke && o.poke.part ? { part: String(o.poke.part), vx: +o.poke.vx || 0, vy: +o.poke.vy || 0, spin: +o.poke.spin || 0 } : undefined,
    x: isFinite(+o.x) ? +o.x : f.x, y: isFinite(+o.y) ? +o.y : f.y - 0.7, vx: +o.vx || 0, vy: +o.vy || 0, tune: S.tune, kernel: S.kernel || undefined, clock: () => performance.now() };
  const list = o.vary ? values : [undefined];
  for (const v of list) { rows.push(runTrial(S.level, Object.assign({}, base, o.vary ? { vary: String(o.vary), value: v } : {}))); await new Promise((r) => setTimeout(r, 0)); }
  const slim = rows.map((r) => { const q = Object.assign({}, r); delete q.why; delete q.hash; delete q.bodies; delete q.seconds; if (q.goal_miss_m === null) delete q.goal_miss_m; return q; });
  showExperiment(o.vary, scenario, slim);
  return { scenario, varied: o.vary || null, seconds_each: base.seconds, rows: slim, note: 'Headless runs: fresh copy of the nearby level, same solver settings, launch at t=0.' };
}
const SHORT = { goal_miss_m: 'miss m', hit_goal: 'hit', distance_m: 'dist m', airtime_s: 'air s', peak_kinetic_J: 'peak KE J' };
function showExperiment(vary, scenario, rows) {
  const key = scenario === 'cannon' ? 'goal_miss_m' : rows[0].fallen !== undefined ? 'fallen' : rows[0].score !== undefined ? 'score' : 'peak_kinetic_J', lowBest = key === 'goal_miss_m';
  const ys = rows.map((r) => +r[key]), bi = ys.indexOf(lowBest ? Math.min(...ys) : Math.max(...ys));
  const cols = ['value', key, ...['hit_goal', 'distance_m', 'airtime_s', 'score', 'of'].filter((k) => k !== key && rows[0][k] !== undefined)].filter((k) => rows[0][k] !== undefined);
  const el = addMsg('tool', `<b>experiment</b> ${esc(vary || scenario)} → ${esc(key.replace(/_/g, ' '))} (${lowBest ? 'lower' : 'higher'} is better)<canvas width="720" height="300"></canvas><table><tr>${cols.map((c) => `<th>${esc(c === 'value' ? String(vary || '').split('.').pop() : SHORT[c] || c.replace(/_/g, ' '))}</th>`).join('')}</tr>${rows.map((r, i) => `<tr class="${i === bi ? 'best' : ''}">${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</table>`, bubble);
  if (rows.length < 2) { el.querySelector('canvas').remove(); return; }
  const c = el.querySelector('canvas').getContext('2d'), xs = rows.map((r) => +r.value), x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys, 1e-9), y0 = Math.min(0, ...ys);
  const X = (v) => 60 + ((v - x0) / (x1 - x0 || 1)) * 630, Y = (v) => 250 - ((v - y0) / (y1 - y0 || 1)) * 220;
  c.font = '22px "IBM Plex Mono", monospace'; c.fillStyle = '#86a2d0'; c.strokeStyle = '#1d3a6b'; c.lineWidth = 1;
  for (const v of [y0, y1]) { c.beginPath(); c.moveTo(60, Y(v)); c.lineTo(690, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(String(+v.toFixed(1)), 54, Y(v) + 7); }
  c.textAlign = 'center'; c.fillText(String(x0), X(x0), 284); c.fillText(String(x1), X(x1), 284);
  c.strokeStyle = '#3fd0ff'; c.lineWidth = 3; c.beginPath(); rows.forEach((r, i) => (i ? c.lineTo(X(xs[i]), Y(ys[i])) : c.moveTo(X(xs[i]), Y(ys[i])))); c.stroke();
  rows.forEach((r, i) => { c.fillStyle = i === bi ? '#7dffb2' : r.hit_goal ? '#ffc23d' : '#3fd0ff'; c.beginPath(); c.arc(X(xs[i]), Y(ys[i]), i === bi ? 9 : 6, 0, TAU); c.fill(); });
  c.fillStyle = '#7dffb2'; c.textAlign = X(xs[bi]) > 560 ? 'right' : 'left'; c.fillText(`${xs[bi]} → ${ys[bi]}`, X(xs[bi]) + (X(xs[bi]) > 560 ? -14 : 14), Math.max(24, Y(ys[bi]) - 12));
}
function runBuild(o) {
  returnLive(); validateLevel(S.level);
  const ops=Array.isArray(o.ops)?o.ops.slice(0,12):[]; if(!ops.length) throw new Error('ops must be a non-empty array');
  const snap=cloneLevel(S.level),done=[],errors=[],added=[]; let work=cloneLevel(S.level),tune={...S.tune},scale=S.timeScale,structural=false;
  for(const op of ops) {
    try {
      const p={...(op.params||{})},candidate=cloneLevel(work),nextTune={...tune}; let part=null,nextScale=scale,kind=String(op.kind||'');
      if(op.op==='add') { if(!Number.isFinite(p.x)||!Number.isFinite(p.y)) throw new Error('add needs finite params.x and params.y'); validatePart(kind,p); part=addPart(candidate,kind,p,op.id?String(op.id):undefined); }
      else if(op.op==='edit') { const before=candidate.parts.find(q=>q.id===String(op.id)); if(!before) throw new Error('no part '+op.id); validatePart(before.kind,{...before.p,...p}); editPart(candidate,String(op.id),p); }
      else if(op.op==='remove') { if(!candidate.parts.some(q=>q.id===String(op.id))) throw new Error('no part '+op.id); removePart(candidate,String(op.id)); }
      else if(op.op==='physics') {
        for(const [k,v] of Object.entries(p)) {
          if(!Number.isFinite(v)) throw new Error('physics parameters must be finite numbers');
          if(k==='gravity') candidate.physics.gravity=clamp(v,0,60);
          else if(k==='substeps') candidate.physics.substeps=clamp(Math.round(v),1,24);
          else if(k==='iters') candidate.physics.iters=clamp(Math.round(v),1,6);
          else if(k==='friction') nextTune.fricMul=clamp(v,0,3);
          else if(k==='bounce') nextTune.restAdd=clamp(v,-.5,1);
          else if(k==='softness') nextTune.soft=clamp(v,.01,100);
          else if(k==='time_scale') nextScale=clamp(v,.1,2);
          else throw new Error('physics has gravity, substeps, iters, friction, bounce, softness, time_scale');
        }
      } else throw new Error('op must be add, edit, remove or physics');
      validateLevel(candidate); work=candidate; tune=nextTune; scale=nextScale;
      if(part) { added.push(part); done.push('added '+part.id+' ('+kind+') at x='+p.x+', y='+p.y); }
      else { structural=true; done.push(op.op+' '+(op.id||JSON.stringify(p))); }
    } catch(e) { errors.push((op.op||'?')+' '+(op.id||op.kind||'')+': '+e.message); }
  }
  if(done.length) { markPractice('Lab partner changed the course'); S.undo=snap; S.level=work; S.tune=tune; S.timeScale=scale; if(structural) { rebuild(true); buildTinker(); } else for(const part of added) liveAdd(part); }
  const line=trace('build',done.concat(errors.map(e=>'FAILED '+e)).join(' · '));
  if(done.length) { const u=document.createElement('button'); u.textContent='Undo'; u.style.marginLeft='8px'; u.onclick=()=>{if(S.undo){const back=S.undo;S.undo=null;S.level=back;markPractice('Undo source edit');rebuild(true);buildTinker();u.disabled=true;}};line.append(u); }
  return {done,errors};
}
function runAct(o) {
  returnLive(); markPractice('Lab partner intervention');
  const sim = S.sim, a = String(o.action); let msg;
  if (a === 'fire_cannon') {
    const part = S.level.parts.find((p) => p.kind === 'cannon'); if (!part) throw new Error('this level has no cannon');
    const ch = {}; if (isFinite(+o.angle)) ch.angle = clamp(+o.angle, 5, 88); if (isFinite(+o.power)) ch.power = clamp(+o.power, 8, 48);
    if (Object.keys(ch).length) { const candidate=cloneLevel(S.level); validatePart(part.kind,{...part.p,...ch}); editPart(candidate,part.id,ch); validateLevel(candidate); S.level=candidate; rebuild(true); }
    const s2 = S.sim, z = s2.W.zones.find((q) => q.kind === 'cannon'); if (s2.mode === 'limp') s2.stand(); s2.hero.off = true; s2.launchFrom(z); msg = `fired at ${z.angle}°, ${z.power} m/s`;
  } else if (a === 'go_to_hall') { const z = sim.W.zones.filter((q) => q.kind === 'checkpoint').find((q) => q.name.toLowerCase().includes(String(o.hall || '').toLowerCase())); if (!z) throw new Error('no hall named ' + o.hall); sim.goTo(z.x, z.y - 2); sim.hall = z.name; msg = 'moved the visitor to ' + z.name; }
  else if (a === 'overlay') { const k = String(o.overlay); if (!(k in view.overlay)) throw new Error('overlays: ' + Object.keys(view.overlay).join(', ')); view.overlay[k] = o.on !== false; const cb = $('ov-' + k); if (cb) cb.checked = view.overlay[k]; msg = k + ' overlay ' + (view.overlay[k] ? 'on' : 'off'); }
  else if (a === 'slow_motion') { S.slow = o.on !== false; $('bSlow').classList.toggle('on', S.slow); msg = 'slow motion ' + (S.slow ? 'on' : 'off'); }
  else if (a === 'flop') { if (sim.mode === 'hero') sim.flop(sim.hero.vx, sim.hero.vy, 'the curator let go for you'); msg = 'hero is limp'; }
  else if (a === 'reset_level') { S.level = cloneLevel(S.base); rebuild(false); msg = 'level reset'; }
  else throw new Error('actions: fire_cannon, go_to_hall, overlay, slow_motion, flop, reset_level');
  trace('act', msg); return { ok: msg };
}
const TOOLS = [
  { name: 'build', description: 'Change the level. ops is a list run in order: {op:"add", kind, params:{x,y,...}} adds a part and returns its id; {op:"edit", id, params} changes a part; {op:"remove", id}; {op:"physics", params:{gravity, substeps, iters, friction, bounce, softness, time_scale}}. Returns {done:[...], errors:[...]}. Adding keeps the world running; edit, remove and physics rebuild it.',
    inputSchema: { type: 'object', properties: { ops: { type: 'array', items: { type: 'object', properties: { op: { type: 'string', enum: ['add', 'edit', 'remove', 'physics'] }, kind: { type: 'string' }, id: { type: 'string' }, params: { type: 'object' } }, required: ['op'] } } }, required: ['ops'] }, execute: (i) => runBuild(i) },
  { name: 'experiment', description: 'Run the level headless, once per value, and return a table. scenario "cannon" fires a ragdoll from the cannon (rows: distance_m, airtime_s, spins, bonks, peak_height_m, hit_goal, goal_miss_m, score); "drop" releases a ragdoll at x,y with vx,vy (default: where the hero is); "observe" just runs, with watch (a part id: rows get fallen, of, moved_m) and optional poke {part, vx, vy, spin}. vary names the number that changes: "cannon.angle", "cannon.power", "physics.gravity", "physics.substeps", "tune.fricMul", "tune.restAdd", "tune.soft", or "<partId>.<param>". Give values (up to 16) or from, to, steps. Every row also has energy_start_J, energy_end_J, peak_kinetic_J, ms_per_step.',
    inputSchema: { type: 'object', properties: { scenario: { type: 'string', enum: ['cannon', 'drop', 'observe'] }, vary: { type: 'string' }, values: { type: 'array', items: { type: 'number' } }, from: { type: 'number' }, to: { type: 'number' }, steps: { type: 'number' }, seconds: { type: 'number' }, watch: { type: 'string' },
      poke: { type: 'object', properties: { part: { type: 'string' }, vx: { type: 'number' }, vy: { type: 'number' }, spin: { type: 'number' } } }, x: { type: 'number' }, y: { type: 'number' }, vx: { type: 'number' }, vy: { type: 'number' } }, required: ['scenario'] }, execute: (i) => { trace('experiment', 'running ' + (i.vary || i.scenario) + '…'); return runExperiment(i); } },
  { name: 'act', description: 'Do something in the live game. action: "fire_cannon" (optional angle in degrees and power in m/s are saved to the cannon first), "go_to_hall" (hall: part of its name, e.g. "cannon"), "overlay" (overlay: contacts | joints | velocity | pairs | trail, on: true/false), "slow_motion" (on), "flop", "reset_level". Returns {ok}.',
    inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['fire_cannon', 'go_to_hall', 'overlay', 'slow_motion', 'flop', 'reset_level'] }, angle: { type: 'number' }, power: { type: 'number' }, hall: { type: 'string' }, overlay: { type: 'string' }, on: { type: 'boolean' } }, required: ['action'] }, execute: (i) => runAct(i) },
];
function setBusy(b) { busy = b; $('send').disabled = b; $('stop').hidden = !b; for (const c of document.querySelectorAll('#chips button')) c.disabled = b; }
const COPY = { rate_limited: 'Claude is busy or at its usage limit. Try again in a little while.', session_expired: 'Sign in to Claude again, then retry.', refused: 'Claude declined that one. Try asking differently.', prompt_too_large: 'That was too much to send at once.', empty_completion: 'Claude had nothing to say to that. Try a more specific ask.' };
const GONE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);
async function ask(text) {
  text = String(text || '').trim(); if (!text || busy) return;
  addMsg('you', esc(text));
  if (!sample) { await offline(text); return; }
  turns.push({ role: 'user', content: text }); bubble = addMsg('ai', 'Thinking…'); setBusy(true); ctl = new AbortController();
  const hist = turns.slice(-9, -1), input = [{ role: 'user', content: RULES }, ...hist, { role: 'user', content: 'LAB STATE, read just now:\n' + JSON.stringify(brief()) + '\n\nVISITOR: ' + text }];
  const opts = { modelTier: 'quick', effort: 'high', cache: false, signal: ctl.signal, onText: ({ text: t }) => { bubble.innerHTML = md(t); $('log').scrollTop = $('log').scrollHeight; } };
  if (toolsOK) opts.tools = TOOLS;
  try {
    const res = await sample(input, opts); bubble.innerHTML = md(res.text) + (res.truncated ? '\n(cut short)' : ''); turns.push({ role: 'assistant', content: res.text });
    $('who').textContent = res.modelApplied ? 'Curator: connected host sample provider' + (toolsOK ? ' · can build, test and act' : ' · can explain only in this viewer') : `Curator: connected host provider (${res.modelTierApplied || 'host-selected'} tier)`;
  } catch (e) {
    const code = e && e.code; if (e && e.text && code !== 'refused') { bubble.innerHTML = md(e.text) + '\n(interrupted)'; turns.push({ role: 'assistant', content: e.text }); } else { bubble.remove(); turns.pop(); }
    if (GONE.has(code)) { sample = null; whoOffline(); addMsg('ai', 'Claude is not available in this view, so I am running on built-in commands. The buttons below still work.'); }
    else if (code !== 'cancelled') addMsg('ai', COPY[code] || 'Claude could not answer just now. Try again.');
  } finally { setBusy(false); bubble = null; }
}
async function offline(text) { // no model: a few built-in commands so the bench still works
  bubble = null; setBusy(true);
  try {
    if (/angle|bullseye|sweep|cannon/i.test(text)) { const r = await runExperiment({ scenario: 'cannon', vary: 'cannon.angle', from: 20, to: 75, steps: 12 }); const best = r.rows.slice().sort((a, b) => a.goal_miss_m - b.goal_miss_m)[0];
      runAct({ action: 'fire_cannon', angle: best.value }); addMsg('ai', md(`Built-in sweep: 12 angles from 20° to 75°. Closest to the bullseye was **${best.value}°**, missing the centre by ${best.goal_miss_m} m${best.hit_goal ? ' (a hit)' : ''}. I set the cannon to it and fired. The live shot can differ: the spinner is at a different point of its turn.`)); }
    else if (/flop|score|why/i.test(text)) { const s = S.sim.lastStunt; addMsg('ai', s ? md(`Last flop (${s.why}): **${s.score} points**. 12 per metre × ${s.distance_m} m, 60 per second in the air × ${s.airtime_s} s, 120 per spin × ${s.spins}, 35 per bonk × ${s.bonks}, 6 × peak speed ${s.peak_speed_mps} m/s${s.hit_goal ? ', plus 500 for the bullseye' : ''}. Spins pay best: go limp while already turning, or twist with A and D in the air.`) : 'No flop yet. Press F, or walk into the wrecking ball in Hall 2.'); }
    else if (/domino/i.test(text)) { const r = await runExperiment({ scenario: 'observe', watch: 'dominoes_1', vary: 'dominoes_1.spacing', values: [0.5, 0.8, 1.1, 1.4, 1.7], poke: { part: 'dominoes_1', spin: -6 } }); addMsg('ai', md(`Built-in test: I pushed the first domino at five spacings. A 1.5 m domino can only reach about its own height, so the chain breaks once the gap passes that. The table shows how many fell at each spacing.`)); }
    else { const m = /(?:add|drop|build)\s+(?:an?\s+)?(\w+)/i.exec(text), kind = m && Object.keys(PREFABS).find((k) => k.startsWith(m[1].toLowerCase().replace(/s$/, '')));
      if (kind) { const f = S.sim.focus(); runBuild({ ops: [{ op: 'add', kind, params: { x: +(f.x + 3 * S.sim.face).toFixed(1), y: +(f.y + 1).toFixed(1) } }] }); addMsg('ai', `Dropped a ${kind} in front of you.`); }
      else addMsg('ai', 'The local command parser understands: "sweep the cannon angle", "explain my last flop", "test the dominoes", or "add" plus a part name (' + Object.keys(PREFABS).slice(0, 12).join(', ') + '…).'); }
  } catch (e) { addMsg('ai', 'That did not work: ' + esc(e.message)); } finally { setBusy(false); }
}
function whoOffline() { $('who').textContent = 'LOCAL LAB PARTNER · built-in commands · no model calls'; }
const CHIPS = [['Find the bullseye angle', 'Sweep the cannon angle, find the one that lands closest to the bullseye, set it, and fire it so I can watch.'], ['Explain my last flop', 'Explain my last flop: where did the points come from, and what one change would score more?'],
  ['Build me a launcher', 'Build something right in front of me that will throw me high when I go limp on it. Tell me how to use it.'], ['What is this hall teaching?', 'What is the hall I am standing in teaching, and what should I try here to see it?'], ['Break the dominoes', 'Test how far apart the dominoes in dominoes_1 can stand before the chain stops, and tell me why.']];
for (const [name, text] of CHIPS) { const b = document.createElement('button'); b.textContent = name; b.onclick = () => ask(text); $('chips').append(b); }
$('ask').addEventListener('submit', (e) => { e.preventDefault(); const q = $('q'); ask(q.value); q.value = ''; });
$('stop').onclick = () => ctl && ctl.abort();
addMsg('ai', md('This lab partner starts with built-in commands; no model API is required. This museum is one X3D file and a small physics engine you can read and rewrite.\n\nRun right, press **F** to go limp, drag anything with the mouse. Ask me to **build** ("put a seesaw and a heavy ball here"), to **test** ("which cannon angle hits the bullseye?") or to **explain** ("why did the tower fall?").'));
(async () => {
  try { sample = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { sample = null; }
  if (!sample) { whoOffline(); return; }
  const lim = await sample.limits().catch(() => null); toolsOK = !!(lim && lim.tools);
  $('who').textContent = 'Curator: connected host sample provider' + (toolsOK ? ' · can build, test and act' : ' · can explain only in this viewer') + ' · your first message asks permission';
})();

// ---------- go ----------
rebuild(false); buildTinker(); buildSolver(); showTab('play'); hud(); updateExpedition(); updateShowtime();
window.__flop = { lab: { Sim, defaultLevel, NOINPUT, runTrial }, compileKernel, S, view, ask, runExperiment, runBuild, runAct, applyKernel, toX3D, fromX3D, BREAKS, KERNEL_SOURCE, tick };
requestAnimationFrame(frame);
