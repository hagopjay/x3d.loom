// loom:sim
// Expedition: authored goals and an optional arcade ability over the unchanged XPBD model.
// Fixed-step game state only. Ghosts are sampled visual guides, never input-replay evidence.
const EXPEDITION_STEP = 1 / 60;
const EXPEDITION_GHOST_LIMIT = 2400;
function expeditionCourseKey(level) {
  // A conservative local ghost-cache partition, not a cryptographic identity or acceptance witness.
  const text = JSON.stringify(level); let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return text.length + '-' + h.toString(16).padStart(8, '0');
}

class Expedition {
  constructor(level, opt = {}) {
    this.level = level;
    this.courseKey = expeditionCourseKey(level);
    this.dashEnabled = opt.dash !== false;
    this.bestByMission = new Map(); this.completed = new Set();
    this.practiceReason = ''; this.eligible = true;
    this.missions = this.makeMissions(level);
    this.current = null; this.state = 'free'; this.time = 0; this.frame = 0;
    this.progress = 0; this.medal = null; this.dashes = 0; this.charge = true; this.cooldown = 0;
    this.trace = []; this.ghost = null; this.events = []; this.checkpoint = '';
    this.baselineDeaths = 0; this.visitedFan = false; this.fanStunt = null; this.activeStunt = null; this.fanEntryY = 0; this.fanPeakY = 0; this.flight = 0; this.finishedDistance = 0;
    this.launchSeen = false; this.goalSeen = false; this.stars = 0; this.lastFinished = null;
  }
  makeMissions(level) {
    const zones = Array.isArray(level.zones) ? level.zones : [];
    const cps = zones.filter(z => z.kind === 'checkpoint').slice().sort((a, b) => a.x - b.x);
    const named = key => cps.find(z => z.part === 'cp_' + key || z.id === 'cp_' + key || String(z.id || '').startsWith('cp_' + key + '_') || String(z.name || '').toLowerCase().includes(key));
    const nearest = zone => zone && cps.length ? cps.reduce((a, b) => Math.abs(b.x - zone.x) < Math.abs(a.x - zone.x) ? b : a) : null;
    const first = named('feel') || cps[0] || null;
    const contact = named('contact') || cps[1] || null;
    const fan = zones.find(z => z.kind === 'fan'), cannon = zones.find(z => z.kind === 'cannon');
    const cp = key => named(key) || (key === 'fields' ? nearest(fan) : key === 'cannon' ? nearest(cannon) : first);
    const hall = z => z ? z.name || 'Checkpoint' : 'Spawn';
    const exists = kind => zones.some(z => z.kind === kind);
    // Time bars are authored game design, not physical/scientific acceptance thresholds.
    return [
      { id: 'first-flight', title: 'First Flight', brief: 'Jump, then F. Stay airborne as a ragdoll for 0.8 seconds in one flop.', hall: hall(first), checkpoint: first, goal: 0.8, unit: 's airborne', limit: 45, gold: 8, silver: 18, available: true },
      { id: 'contact-run', title: 'Contact Sprint', brief: 'Reach the next route checkpoint without respawning. Jump, dash or tumble your own route.', hall: hall(first) + ' → ' + hall(contact), checkpoint: first, finish: contact, goal: 1, unit: 'route', limit: 55, gold: 7, silver: 15, available: !!first && !!contact && first !== contact },
      { id: 'collector', title: 'Constellation Run', brief: 'Collect two fresh stars in one run. Every retry resets the collectibles.', hall: 'Open course', checkpoint: first, goal: 2, unit: 'stars', limit: 100, gold: 20, silver: 45, available: zones.filter(z => z.kind === 'star').length >= 2 },
      { id: 'airmail', title: 'Air Mail', brief: 'Travel twelve metres in one flop, then get up or settle to finish the delivery.', hall: hall(cp('joints')), checkpoint: cp('joints'), goal: 12, unit: 'm delivered', limit: 75, gold: 12, silver: 30, available: true },
      { id: 'windrider', title: 'Wind Rider', brief: 'Enter a fan while limp, then rise five metres above the fan-entry height in the same flop.', hall: hall(cp('fields')), checkpoint: cp('fields'), goal: 5, unit: 'm rise', limit: 75, gold: 15, silver: 35, available: exists('fan') && !!cp('fields') },
      { id: 'bullseye', title: 'Cannon Post', brief: 'Climb into a cannon, aim and fire. The launched ragdoll must hit a bullseye.', hall: hall(cp('cannon')), checkpoint: cp('cannon'), goal: 1, unit: 'bullseye', limit: 90, gold: 18, silver: 40, available: exists('cannon') && exists('goal') && !!cp('cannon') },
    ];
  }
  fixed(dt) {
    if (!Number.isFinite(dt) || Math.abs(dt - EXPEDITION_STEP) > 1e-12) throw new Error('Expedition requires a fixed 1/60-second step.');
  }
  start(id, sim) {
    if (!sim || !sim.hero || !sim.W || typeof sim.focus !== 'function') throw new Error('A live Sim is required to start an expedition.');
    const free = id === 'free' || id === 'freeplay';
    const m = free ? null : this.missions.find(q => q.id === id);
    if (!free && (!m || !m.available)) throw new Error('That expedition is unavailable in this level.');
    this.current = m; this.state = free ? 'free' : 'active'; this.time = 0; this.frame = 0;
    this.progress = 0; this.medal = null; this.dashes = 0; this.charge = true; this.cooldown = 0;
    this.trace = []; this.events = []; this.visitedFan = false; this.fanStunt = null; this.activeStunt = null; this.fanEntryY = 0; this.fanPeakY = 0; this.flight = 0; this.finishedDistance = 0;
    this.launchSeen = false; this.goalSeen = false; this.lastFinished = sim.lastStunt;
    if (!free) {
      const c = m.checkpoint;
      if (c && typeof sim.goTo === 'function') sim.goTo(c.x, c.y - 2);
      else if (typeof sim.respawn === 'function') { const before = sim.deaths; sim.respawn(); sim.deaths = before; }
      for (const z of sim.W.zones) if (z.kind === 'star') z.got = false;
      sim.stars = 0;
    }
    this.baselineDeaths = sim.deaths || 0; this.stars = sim.stars || 0;
    this.checkpoint = m ? m.hall : 'Explore every hall';
    const previous = m ? this.bestByMission.get(m.id) : null;
    this.ghost = this.eligible && previous && previous.courseKey === this.courseKey ? previous : null;
    return this.summary();
  }
  reset(sim) { return this.start(this.current ? this.current.id : 'free', sim); }
  next(sim) {
    const index = this.current ? this.missions.indexOf(this.current) : -1;
    for (let n = 1; n <= this.missions.length; n++) {
      const m = this.missions[(index + n) % this.missions.length];
      if (m.available && !this.completed.has(m.id)) return this.start(m.id, sim);
    }
    const m = this.missions.find(q => q.available);
    return this.start(m ? m.id : 'free', sim);
  }
  invalidate(reason = 'The level or experiment changed during this run.') {
    this.eligible = false; this.practiceReason = String(reason).slice(0, 240);
    this.medal = null; this.ghost = null;
    return this.summary();
  }
  // Call only after restoring the declared stock level/settings, never merely after a retry.
  restoreEligibility() { this.eligible = true; this.practiceReason = ''; }
  beforeStep(sim, input = {}, dt = EXPEDITION_STEP) {
    this.fixed(dt); this.events.length = 0;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (sim.mode === 'hero' && sim.ground) this.charge = true;
    if (!input.dashP || !this.dashEnabled || !this.charge || this.cooldown > 0 || sim.mode !== 'hero' || sim.ground || sim.hook || sim.hero.off) return false;
    const h = sim.hero;
    let dx = Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0;
    let dy = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0;
    if (!dx && !dy) dx = sim.face < 0 ? -1 : 1;
    const length = Math.sqrt(dx * dx + dy * dy);
    h.vx = dx * 18 / length; h.vy = dy * 18 / length;
    sim.lock = Math.max(sim.lock || 0, 0.12);
    this.charge = false; this.cooldown = 0.30; this.dashes++;
    this.events.push({ type: 'dash', x: h.x, y: h.y, dx, dy });
    return true;
  }
  afterStep(sim, input = {}, dt = EXPEDITION_STEP) {
    this.fixed(dt); this.frame++;
    if (this.state !== 'active' && this.state !== 'free') return;
    this.time += dt;
    const f = sim.focus();
    if (!f || ![f.x, f.y].every(Number.isFinite)) { this.invalidate('Nonfinite game pose; run cannot earn a medal.'); this.state = 'failed'; return; }
    if (this.frame % 4 === 0) {
      this.trace.push({ t: this.time, x: f.x, y: f.y, a: Number.isFinite(f.a) ? f.a : 0, mode: sim.mode });
      if (this.trace.length > EXPEDITION_GHOST_LIMIT) this.trace.shift();
    }
    if (this.state === 'free') return;
    const m = this.current, s = sim.stunt;
    if ((sim.deaths || 0) > this.baselineDeaths) { this.state = 'failed'; this.events.push({ type: 'challenge-failed', reason: 'Respawned. Retry the route or return to free play.' }); return; }
    this.stars = Math.max(this.stars, sim.stars || 0);
    if (s && sim.mode === 'limp') {
      if (this.activeStunt !== s) { this.activeStunt = s; this.visitedFan = false; this.fanStunt = null; }
      this.flight = Math.max(this.flight, Number.isFinite(s.air) ? Math.max(0, s.air) : 0);
      if (s.cannon) { this.launchSeen = true; if (s.goal) this.goalSeen = true; }
      if (this.fanStunt !== s && sim.W.zones.some(z => z.kind === 'fan' && Math.abs(z.x - f.x) <= z.w / 2 && Math.abs(z.y - f.y) <= z.h / 2)) {
        this.visitedFan = true; this.fanStunt = s; this.fanEntryY = f.y; this.fanPeakY = f.y;
      }
      if (this.fanStunt === s) this.fanPeakY = Math.max(this.fanPeakY, f.y);
    }
    const finished = sim.lastStunt;
    if (finished && finished !== this.lastFinished) {
      this.flight = Math.max(this.flight, Number.isFinite(finished.airtime_s) ? Math.max(0, finished.airtime_s) : 0);
      this.finishedDistance = Math.max(this.finishedDistance, Number.isFinite(finished.distance_m) ? Math.max(0, finished.distance_m) : 0);
      if (finished.cannon) { this.launchSeen = true; if (finished.hit_goal) this.goalSeen = true; }
      this.lastFinished = finished;
    }
    if (m.id === 'first-flight') this.progress = Math.min(m.goal, this.flight);
    else if (m.id === 'contact-run') {
      const start = m.checkpoint ? m.checkpoint.x : 0, finish = m.finish;
      this.progress = finish ? Math.max(0, Math.min(.99, (f.x - start) / (finish.x - start || 1))) : 0;
      if (finish && Math.abs(f.x - finish.x) < 1.3 && Math.abs(f.y - (finish.y - 1.2)) < 2.8) this.progress = 1;
    } else if (m.id === 'collector') this.progress = Math.min(m.goal, this.stars);
    else if (m.id === 'airmail') this.progress = Math.min(m.goal, this.finishedDistance);
    else if (m.id === 'windrider') {
      if (s && sim.mode === 'limp' && this.fanStunt === s) this.progress = Math.max(this.progress, Math.min(m.goal, this.fanPeakY - this.fanEntryY));
    } else if (m.id === 'bullseye') this.progress = this.launchSeen && this.goalSeen ? 1 : 0;
    if (this.progress >= m.goal) this.finish();
    else if (this.time + 1e-9 >= m.limit) { this.state = 'failed'; this.events.push({ type: 'challenge-failed', reason: 'Time is up. Retry with a new approach.' }); }
  }
  finish() {
    this.state = 'complete';
    if (this.eligible) {
      const m = this.current;
      this.medal = this.time <= m.gold ? 'gold' : this.time <= m.silver ? 'silver' : 'bronze';
      this.completed.add(m.id);
      const old = this.bestByMission.get(m.id);
      if (!old || old.courseKey !== this.courseKey || this.time < old.time) this.bestByMission.set(m.id, { courseKey: this.courseKey, time: this.time, medal: this.medal, poses: this.trace.map(p => Object.assign({}, p)) });
    }
    this.events.push({ type: 'challenge-complete', medal: this.medal, practice: !this.eligible });
  }
  ghostPose(time = this.time) {
    const poses = this.ghost && this.ghost.poses;
    if (!poses || !poses.length || !Number.isFinite(time) || time < poses[0].t || time > poses[poses.length - 1].t) return null;
    let lo = 0, hi = poses.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (poses[mid].t <= time) lo = mid; else hi = mid - 1; }
    return Object.assign({}, poses[lo]);
  }
  hint() {
    if (this.state === 'free') return this.dashEnabled ? 'Explore freely. Jump + E/C gives one air dash; landing recharges it. F goes limp, Shift grapples.' : 'Explore freely. F goes limp; Shift grapples; the bench changes your experiment.';
    if (this.state === 'failed') return 'Retry resets the route and collectibles. Every hall remains open in free play.';
    if (this.state === 'complete') return this.eligible ? 'Route complete. Retry against your ghost, or follow the next chapter.' : 'Practice complete. Restore the stock challenge to earn a local medal.';
    const id = this.current.id;
    if (id === 'first-flight') return this.time < 5 ? 'Jump, then press F soon after takeoff while still rising.' : 'Press F earlier in the jump for more ragdoll airtime. The bounce pad offers an optional bigger launch.';
    if (id === 'contact-run') return 'Reach ' + (this.current.finish.name || 'the next checkpoint') + '. Try a jump and an airborne E/C burst; touching the destination finishes.';
    if (id === 'collector') return this.stars ? 'One star found. The next amber star can be reached by another route.' : 'Find amber stars; the first sits above the Feel hall’s bounce pad.';
    if (id === 'airmail') return 'Build speed, jump or grapple, then F. Travel 12 m in one flop and press F again to finish it.';
    if (id === 'windrider') return this.visitedFan ? 'Stay in the updraft while limp. Rise five metres above this flop’s fan-entry height.' : 'Move into the fan and press F: the upright hero is deliberately too heavy to float.';
    return this.launchSeen ? 'Follow the flight. Adjust angle or power on the next attempt; only a launched ragdoll can claim the target.' : 'Near the cannon press W, aim with W/S, set power with A/D, then Space to fire.';
  }
  summary() {
    const m = this.current, saved = m ? this.bestByMission.get(m.id) : null;
    const record = saved && saved.courseKey === this.courseKey ? saved : null;
    return { id: m ? m.id : 'free', title: m ? m.title : 'Free Play', state: this.state, time: this.time,
      progress: this.progress, target: m ? m.goal : 1, unit: m ? m.unit : '', medal: this.medal,
      hint: this.hint(), dashReady: this.dashEnabled && this.charge && this.cooldown <= 0, dashes: this.dashes,
      eligible: this.eligible, practiceReason: this.practiceReason, checkpoint: this.checkpoint, courseKey: this.courseKey,
      missions: this.missions.map(q => ({ id: q.id, title: q.title, brief: q.brief, hall: q.hall, goal: q.goal, unit: q.unit, available: q.available, unlocked: q.available, completed: this.completed.has(q.id), gold: q.gold, silver: q.silver, limit: q.limit })),
      ghost: this.ghostPose(), best: record ? { time: record.time, medal: record.medal } : null };
  }
}
