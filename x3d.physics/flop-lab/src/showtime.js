// loom:sim
// Showtime is an authored arcade judge over the unchanged physical solver.
// API: new StuntShow({puffs:true}); resetRun(sim) after rebuilding the Sim.
// Tick order: expedition.beforeStep; show.beforeStep; if dash really fired,
// show.noteDash(sim); sim.step; expedition.afterStep; show.afterStep.
// beforeStep returns true only for an applied puff. App may mark medals practice.
// summary() is JSON-safe. Events last one live tick; seq never resets in-session.
// No wall-clock, random presentation effects, source mutation or replay restore.
const SHOW_STEP = 1 / 60;
const SHOW_PUFF_MAX = 3, SHOW_PUFF_COOLDOWN = 0.35, SHOW_PUFF_DV = 6;
const SHOW_PROMPTS = [
  { id: 'debut', title: 'The Wobbly Debut', brief: 'Jump, F while rising, then recover. Bank 0.35 seconds of limp airtime.', target: 0.35, unit: 's airborne', field: 'air' },
  { id: 'delivery', title: 'Express Biscuit Delivery', brief: 'Carry one flop six metres, then F again to bank it.', target: 6, unit: 'm travelled', field: 'distance' },
  { id: 'puff', title: 'Pocket Weather System', brief: 'While limp, press Q for a directional puff; recover to bank it.', target: 1, unit: 'puff', field: 'puffs' },
  { id: 'rotation', title: 'The Spin Cycle', brief: 'Hold A or D while limp. Complete one net full turn and recover.', target: 1, unit: 'full turn', field: 'flips' },
  { id: 'variety', title: 'Three-Course Tumble', brief: 'Combine three different trick families in one banked flop.', target: 3, unit: 'families', field: 'variety' },
  { id: 'bonks', title: 'Bonk Appétit', brief: 'Meet two different objects while travelling, then recover.', target: 2, unit: 'moving bonks', field: 'bonks' },
  { id: 'finale', title: 'The Grand Wobble', brief: 'Build variety and bank a 1,000-point stunt. Style points are an authored game toy.', target: 1000, unit: 'style points', field: 'score' },
];
const SHOW_STICKERS = [
  { id: 'debut', title: 'Certified Wobbler', brief: 'Bank your first scored flop.' },
  { id: 'air-chair', title: 'Chairperson of the Air', brief: 'Bank at least 0.8 seconds of limp airtime.' },
  { id: 'pinwheel', title: 'Laundry Astronaut', brief: 'Bank a full net chest rotation.' },
  { id: 'bonks', title: 'Professional Floor Consultant', brief: 'Bank two distinct travelling bonks.' },
  { id: 'soggy', title: 'Distinguished Wet Biscuit', brief: 'Bank a water-entry stunt.' },
  { id: 'variety', title: 'Department of Everything', brief: 'Bank four trick families together.' },
  { id: 'puffin', title: 'Puffin in Disguise', brief: 'Use all three puffs in one banked flop.' },
  { id: 'thousand', title: 'Extremely Qualified Noodle', brief: 'Bank a 1,000-point stunt.' },
  { id: 'encore', title: 'Please Remain Unseated', brief: 'Complete three different spotlight prompts.' },
];

class StuntShow {
  constructor(opt = {}) {
    this.puffEnabled = opt.puffs !== false;
    this.events = []; this.seq = 0; this.clock = 0;
    this.banked = 0; this.best = 0; this.bankCount = 0; this.lastBank = null;
    this.stickers = new Set(); this.promptDone = new Set(); this.promptIndex = 0;
    this.promptBank = 0; this.promptProgress = 0; this.promptComplete = false;
    this.crowd = 0; this.caption = 'The floor has been expecting you.';
    this.stats = { banks: 0, flops: 0, tricks: 0, puffs: 0, lostChains: 0, prompts: 0 };
    this.world = null; this.chain = null; this.pendingSetup = new Map();
    this.puffsLeft = 0; this.puffCooldown = 0; this.lastFrame = -1;
    this.preparedFrame = -1; this.lastFinished = null; this.deaths = 0;
  }
  fixed(dt) {
    if (!Number.isFinite(dt) || Math.abs(dt - SHOW_STEP) > 1e-12) throw new Error('StuntShow requires a fixed 1/60-second step.');
  }
  resetRun(sim) {
    if (!sim || !sim.W || typeof sim.focus !== 'function') throw new Error('StuntShow requires a live Sim.');
    this.world = sim.W; this.chain = null; this.pendingSetup.clear();
    this.puffsLeft = 0; this.puffCooldown = 0; this.events.length = 0;
    this.lastFrame = Number.isSafeInteger(sim.W.frame) ? sim.W.frame : -1;
    this.preparedFrame = -1; this.lastFinished = sim.lastStunt;
    this.deaths = sim.deaths || 0; this.promptProgress = 0;
    this.promptComplete = false; this.promptBank = this.bankCount;
    return this.summary();
  }
  event(type, title, text, extra = {}) {
    const e = Object.assign({ seq: ++this.seq, type, title, text: String(text || '').slice(0, 100) }, extra);
    this.events.push(e);
    if (this.events.length > 16) this.events.shift();
    this.caption = e.text || e.title;
    return e;
  }
  startChain(sim) {
    const f = sim.focus();
    if (!f || ![f.x, f.y, f.a === undefined ? 0 : f.a].every(Number.isFinite)) return;
    this.chain = { stunt: sim.stunt, x0: f.x, y0: f.y, x: f.x, y: f.y, lastA: f.a || 0,
      rotation: 0, air: 0, distance: 0, flips: 0, bonks: 0, puffs: 0, raw: 0,
      combo: 0, multiplier: 1, score: 0, families: new Set(), counts: new Map(),
      bonkPartners: new Set(), lastBonkTime: -99, lastBonkX: f.x, lastBonkY: f.y,
      zones: new Set(), activated: false, wet: false, fan: false };
    this.stats.flops++; this.puffsLeft = SHOW_PUFF_MAX; this.puffCooldown = 0;
    // Setup tricks require a genuinely observed event just before this flop.
    for (const [kind, token] of this.pendingSetup) if (this.clock - token.time <= 2)
      this.award(kind, token.title, token.points, token.family, f);
    this.pendingSetup.clear();
    if (sim.stunt && sim.stunt.cannon) this.award('cannon', 'Special Delivery!', 120, 'launch', f);
    this.event('flop', 'A Wild Noodle Appears', 'A small wobble. Enormous possibilities.', { x: f.x, y: f.y });
  }
  setup(kind, title, points, family, sim) {
    const f = sim.focus();
    if (this.chain && sim.mode === 'limp') this.award(kind, title, points, family, f);
    else this.pendingSetup.set(kind, { time: this.clock, title, points, family });
  }
  noteDash(sim) {
    if (sim && sim.W === this.world && sim.mode === 'hero' && !sim.hero.off && !sim.ground)
      this.setup('dash', 'Express Noodle', 70, 'launch', sim);
  }
  award(key, title, base, family, f) {
    const c = this.chain;
    if (!c || !Number.isFinite(base) || base <= 0) return false;
    const repeats = c.counts.get(key) || 0;
    if (repeats >= 1 || c.combo >= 24) return false;
    c.counts.set(key, repeats + 1); c.families.add(family); c.combo++;
    c.multiplier = Math.min(4, 1 + Math.floor(c.families.size / 2));
    c.raw += base; c.score = Math.min(99999, Math.round(c.raw * c.multiplier));
    this.crowd = Math.min(1, this.crowd + 0.055 + base / 5000); this.stats.tricks++;
    this.event(key.includes('bonk') ? 'bonk-trick' : key.includes('flip') ? 'flip-trick' : 'trick', title,
      '+' + base + ' · ' + c.families.size + ' families · ×' + c.multiplier,
      { points: base, score: c.score, multiplier: c.multiplier, combo: c.combo, x: f && f.x, y: f && f.y, trick: key });
    return true;
  }
  beforeStep(sim, input = {}, dt = SHOW_STEP) {
    this.fixed(dt);
    if (this.world !== sim.W || sim.W.frame < this.lastFrame) this.resetRun(sim);
    if (this.preparedFrame === sim.W.frame) return false;
    this.preparedFrame = sim.W.frame; this.events.length = 0;
    this.clock += dt; this.puffCooldown = Math.max(0, this.puffCooldown - dt);
    this.crowd = Math.max(0, this.crowd - dt * 0.018);
    for (const [kind, token] of this.pendingSetup) if (this.clock - token.time > 2) this.pendingSetup.delete(kind);
    if (sim.mode === 'limp' && sim.stunt && (!this.chain || this.chain.stunt !== sim.stunt)) this.startChain(sim);
    if (!input.puffP || !this.puffEnabled || this.puffsLeft <= 0 || this.puffCooldown > 0 ||
      sim.mode !== 'limp' || !this.chain || !sim.stunt || !Array.isArray(sim.ragList)) return false;
    const bodies = sim.ragList.filter(b => !b.off);
    if (!bodies.length || bodies.some(b => ![b.x, b.y, b.vx, b.vy].every(Number.isFinite))) return false;
    let dx = Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0;
    let dy = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0;
    if (!dx && !dy) { dx = sim.face < 0 ? -0.45 : 0.45; dy = 1; }
    const size = Math.sqrt(dx * dx + dy * dy), dvx = dx * SHOW_PUFF_DV / size, dvy = dy * SHOW_PUFF_DV / size;
    for (const b of bodies) { b.vx += dvx; b.vy += dvy; }
    this.puffsLeft--; this.puffCooldown = SHOW_PUFF_COOLDOWN;
    this.chain.puffs++; this.stats.puffs++;
    const f = sim.focus();
    this.award('puff-' + this.chain.puffs, ['Pocket Weather!', 'Second Opinion!', 'Final Puff of Wisdom!'][this.chain.puffs - 1],
      [55, 30, 15][this.chain.puffs - 1], 'puff', f);
    this.event('puff', 'Pffft!', this.puffsLeft ? this.puffsLeft + ' puffs remain in this flop.' : 'Weather budget fully spent.',
      { x: f.x, y: f.y, dx: dvx / SHOW_PUFF_DV, dy: dvy / SHOW_PUFF_DV, remaining: this.puffsLeft });
    return true;
  }
  afterStep(sim, input = {}, dt = SHOW_STEP) {
    this.fixed(dt);
    if (this.world !== sim.W || sim.W.frame < this.lastFrame) { this.resetRun(sim); return; }
    if (sim.W.frame === this.lastFrame) return; // Observing one tick twice earns nothing.
    this.lastFrame = sim.W.frame;
    const f = sim.focus();
    if (!f || ![f.x, f.y, f.vx === undefined ? 0 : f.vx, f.vy === undefined ? 0 : f.vy, f.a === undefined ? 0 : f.a].every(Number.isFinite)) {
      this.chain = null; this.puffsLeft = 0; this.pendingSetup.clear(); this.caption = 'The judge needs finite coordinates.'; return;
    }
    if ((sim.deaths || 0) > this.deaths) {
      if (this.chain) { this.stats.lostChains++; this.event('chain-lost', 'An Unscheduled Intermission', 'The floor requests another audition.', { x: f.x, y: f.y }); }
      this.deaths = sim.deaths || 0; this.chain = null; this.puffsLeft = 0;
      this.pendingSetup.clear(); this.lastFinished = sim.lastStunt; return;
    }
    if (sim.mode === 'limp' && sim.stunt && (!this.chain || this.chain.stunt !== sim.stunt)) this.startChain(sim);
    for (const e of sim.fx || []) {
      if (e.type === 'spring') this.setup('spring', 'Boing Credentials', 80, 'launch', sim);
      else if (e.type === 'hook' && sim.hook) this.setup('hook', 'Suspension of Disbelief', 90, 'grapple', sim);
    }
    const c = this.chain;
    if (c && sim.mode === 'limp' && sim.stunt === c.stunt) {
      c.x = f.x; c.y = f.y; c.distance = Math.max(c.distance, Math.abs(f.x - c.x0));
      let touching = false;
      for (let i = 0; i < (sim.W.nc || 0); i++) {
        const q = sim.W.contacts[i];
        if (q && ((q.a.role === 'rag') !== (q.b.role === 'rag'))) { touching = true; break; }
      }
      const wet = sim.ragList.some(b => !b.off && b.wet > 0);
      if (!touching && !wet) c.air += dt;
      if (!c.activated && (c.air >= 0.12 || Math.sqrt(f.vx * f.vx + f.vy * f.vy) > 2)) {
        c.activated = true; this.award('flop', 'Deliberate Lack of Dignity', 25, 'flop', f);
      }
      for (const [n, seconds] of [0.35, 0.8, 1.5, 2.5].entries())
        if (c.air + 1e-9 >= seconds) this.award('air-' + n, ['Air Biscuit', 'Frequent Flopper', 'Cloud Consultant', 'Out of Office'][n], [50, 80, 110, 150][n], 'air', f);
      const da = (f.a || 0) - c.lastA;
      if (Number.isFinite(da) && Math.abs(da) < Math.PI) c.rotation += da;
      c.lastA = f.a || 0;
      const turns = Math.min(3, Math.floor((Math.abs(c.rotation) + 1e-8) / (2 * Math.PI)));
      while (c.flips < turns) { c.flips++; this.award('flip-' + c.flips, ['Spin Cycle', 'Double Laundry', 'Tumble Dryer Supreme'][c.flips - 1], [160, 110, 70][c.flips - 1], 'rotation', f); }
      for (const e of sim.W.events || []) {
        if (!e.a || !e.b || (e.a.role === 'rag') === (e.b.role === 'rag') || !Number.isFinite(e.speed) || e.speed <= 5 || c.air < .12) continue;
        const other = e.a.role === 'rag' ? e.b : e.a, partner = String(other.id || 'unidentified');
        const travelled = Math.sqrt((f.x - c.lastBonkX) ** 2 + (f.y - c.lastBonkY) ** 2);
        if (c.bonks >= 3 || c.bonkPartners.has(partner) || this.clock - c.lastBonkTime < .25 || travelled < 1.2) continue;
        c.bonkPartners.add(partner); c.lastBonkTime = this.clock; c.lastBonkX = f.x; c.lastBonkY = f.y; c.bonks++;
        this.award('bonk-' + c.bonks, ['Bonk Appétit', 'A Second Opinion', 'Peer-Reviewed Bonk'][c.bonks - 1], [80, 55, 30][c.bonks - 1], 'bonk', f);
      }
      if (wet && !c.wet) { c.wet = true; this.award('water', 'Distinguished Wet Biscuit', 100, 'water', f); }
      for (const z of sim.W.zones || []) {
        if (z.kind === 'fan' && !c.fan && f.vy > 1 && Math.abs(z.x - f.x) <= z.w / 2 && Math.abs(z.y - f.y) <= z.h / 2) {
          c.fan = true; this.award('fan', 'Air Traffic Noodle', 100, 'field', f);
        }
        if (z.kind === 'goal' && !c.zones.has(z.id) && Math.sqrt((f.x - z.x) ** 2 + (f.y - z.y) ** 2) < z.w / 2 && c.air >= .12) {
          c.zones.add(z.id); this.award('goal-' + Math.min(3, c.zones.size), 'Noodle Through the Needle', [160, 100, 60][Math.min(2, c.zones.size - 1)], 'target', f);
        }
      }
    }
    if (sim.lastStunt && sim.lastStunt !== this.lastFinished) {
      this.lastFinished = sim.lastStunt;
      if (this.chain && sim.mode === 'hero') this.bank(sim);
    }
    if (sim.mode !== 'limp' && this.chain) { this.chain = null; this.puffsLeft = 0; }
    if (!this.promptComplete) this.promptProgress = this.promptValue(this.chain);
  }
  promptValue(c) {
    if (!c) return 0;
    const field = SHOW_PROMPTS[this.promptIndex].field;
    return Math.max(0, Math.min(SHOW_PROMPTS[this.promptIndex].target, field === 'variety' ? c.families.size : c[field] || 0));
  }
  sticker(id, f) {
    if (this.stickers.has(id)) return;
    const s = SHOW_STICKERS.find(q => q.id === id); if (!s) return;
    this.stickers.add(id); this.event('sticker', s.title, s.brief, { id, x: f.x, y: f.y });
  }
  bank(sim) {
    const c = this.chain, f = sim.focus();
    if (!c || c.score <= 0) return;
    this.banked = Math.min(999999999, this.banked + c.score); this.best = Math.max(this.best, c.score);
    this.bankCount++; this.stats.banks++;
    this.lastBank = { score: c.score, combo: c.combo, multiplier: c.multiplier, air: +c.air.toFixed(3),
      distance: +c.distance.toFixed(3), flips: c.flips, bonks: c.bonks, puffs: c.puffs, variety: c.families.size,
      families: Array.from(c.families), serial: this.bankCount };
    this.event('bank', c.score >= 1000 ? 'ABSOLUTELY UNNECESSARY!' : 'Dignity Traded Successfully!',
      c.score + ' style points safely banked.', { score: c.score, multiplier: c.multiplier, x: f.x, y: f.y });
    this.sticker('debut', f);
    if (c.air >= .8) this.sticker('air-chair', f);
    if (c.flips) this.sticker('pinwheel', f);
    if (c.bonks >= 2) this.sticker('bonks', f);
    if (c.wet) this.sticker('soggy', f);
    if (c.families.size >= 4) this.sticker('variety', f);
    if (c.puffs >= 3) this.sticker('puffin', f);
    if (c.score >= 1000) this.sticker('thousand', f);
    if (!this.promptComplete && this.bankCount > this.promptBank && this.promptValue(c) >= SHOW_PROMPTS[this.promptIndex].target) {
      this.promptProgress = SHOW_PROMPTS[this.promptIndex].target; this.promptComplete = true;
      this.promptDone.add(SHOW_PROMPTS[this.promptIndex].id); this.stats.prompts = this.promptDone.size;
      this.event('prompt-complete', 'Spotlight Complete!', SHOW_PROMPTS[this.promptIndex].title, { id: SHOW_PROMPTS[this.promptIndex].id, x: f.x, y: f.y });
      if (this.promptDone.size >= 3) this.sticker('encore', f);
    }
    this.crowd = Math.min(1, this.crowd + .12);
  }
  selectPrompt(id) {
    const index = SHOW_PROMPTS.findIndex(q => q.id === id);
    if (index < 0) throw new Error('Unknown spotlight prompt: ' + id);
    this.promptIndex = index; this.promptBank = this.bankCount; this.promptProgress = 0; this.promptComplete = false;
    return this.summary();
  }
  nextPrompt() { return this.selectPrompt(SHOW_PROMPTS[(this.promptIndex + 1) % SHOW_PROMPTS.length].id); }
  summary() {
    const c = this.chain, prompt = SHOW_PROMPTS[this.promptIndex];
    return { active: !!c, score: c ? c.score : 0, banked: this.banked, best: this.best,
      combo: c ? c.combo : 0, multiplier: c ? c.multiplier : 1, crowd: this.crowd,
      title: c ? c.families.size >= 4 ? 'International Incident of Wobble' : c.combo >= 3 ? 'The Plot Thickens' : 'A Promising Wobble' : 'Open Mic, Open Floor',
      caption: this.caption, puffReady: this.puffEnabled && !!c && this.puffsLeft > 0 && this.puffCooldown <= 0,
      puffsLeft: this.puffsLeft, puffMax: SHOW_PUFF_MAX, puffCooldown: this.puffCooldown, puffEnabled: this.puffEnabled,
      lastBank: this.lastBank ? Object.assign({}, this.lastBank, { families: this.lastBank.families.slice() }) : null,
      stickers: SHOW_STICKERS.map(s => Object.assign({}, s, { earned: this.stickers.has(s.id) })),
      prompt: Object.assign({}, prompt, { progress: this.promptProgress, complete: this.promptComplete }),
      prompts: SHOW_PROMPTS.map(p => ({ id: p.id, title: p.title, complete: this.promptDone.has(p.id) })),
      events: this.events.map(e => Object.assign({}, e)), stats: Object.assign({}, this.stats) };
  }
}
