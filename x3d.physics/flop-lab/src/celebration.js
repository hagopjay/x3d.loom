// Presentation only. No Sim reference, source writes, or use of its random stream.
// new StuntFeedback({stage}); emit(show.events) once after each live fixed step;
// render(displayDt,{paused}) once per display frame. clear() on world replacement.
// Sound starts OFF. Call enableSound() directly from an explicit user gesture;
// inspect its returned status().soundEnabled rather than assuming audio exists.
// The browser/OS reduced-motion preference is always honored, in addition to
// setReducedMotion(true). Neither effects nor audio change game or physics time.
class StuntFeedback {
  constructor({ stage, canvas, reducedMotion = false, volume = 0.2 } = {}) {
    this.stage = stage || canvas?.parentElement || null;
    this.canvas = canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    this.ownsCanvas = !canvas; this.ctx = null; this.enabled = true; this.userReducedMotion = !!reducedMotion;
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.2;
    this.particles = []; this.popups = []; this.seen = new Set(); this.seenOrder = [];
    this.serial = 0; this.time = 0; this.lastCaption = ''; this.width = 1; this.height = 1;
    this.audio = null; this.master = null; this.soundEnabled = false; this.audioUnavailable = false;
    this.voices = new Set(); this.lastSound = -1e9; this.paused = false; this.disposed = false;
    this.motionQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.motionChange = () => { if (this.reducedMotion) this.particles.length = 0; };
    this.motionQuery?.addEventListener?.('change', this.motionChange);
    this.visibilityChange = () => { if (this.hidden) this.clear(); };
    if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', this.visibilityChange);
    if (this.canvas) {
      this.canvas.className = 'stunt-feedback'; this.canvas.setAttribute?.('aria-hidden', 'true');
      Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '11' });
      try { this.ctx = this.canvas.getContext('2d'); } catch (_) { this.ctx = null; }
      if (this.ownsCanvas && this.stage) this.stage.append(this.canvas);
    }
  }
  get reducedMotion() { return this.userReducedMotion || !!this.motionQuery?.matches; }
  get hidden() { return typeof document !== 'undefined' && document.hidden === true; }
  setReducedMotion(value) { this.userReducedMotion = !!value; if (this.reducedMotion) this.particles.length = 0; return this.status(); }
  setEnabled(value) { this.enabled = !!value; if (!this.enabled) { this.particles.length = 0; this.popups.length = 0; this.erase(); } return this.status(); }
  setVolume(value) {
    if (Number.isFinite(value)) this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.audio) this.master.gain.setValueAtTime(this.volume * 0.2, this.audio.currentTime);
    return this.status();
  }
  async enableSound() {
    if (this.disposed) return this.status();
    try {
      const Context = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!Context) { this.audioUnavailable = true; this.soundEnabled = false; return this.status(); }
      if (!this.audio) {
        this.audio = new Context(); this.master = this.audio.createGain();
        this.master.gain.value = this.volume * 0.2; this.master.connect(this.audio.destination);
      }
      if (this.audio.state === 'suspended') await this.audio.resume();
      this.audioUnavailable = this.audio.state === 'closed';
      this.soundEnabled = this.audio.state === 'running';
      if (this.soundEnabled) this.motif('ready');
    } catch (_) { this.audioUnavailable = true; this.soundEnabled = false; }
    return this.status();
  }
  disableSound() { this.soundEnabled = false; this.stopVoices(); return this.status(); }
  status() {
    return { enabled: this.enabled, reducedMotion: this.reducedMotion, soundEnabled: this.soundEnabled && this.audio?.state === 'running',
      audioState: this.audioUnavailable ? 'unavailable' : !this.soundEnabled ? 'off' : this.audio?.state === 'running' ? 'running' : 'suspended',
      volume: this.volume, particles: this.particles.length, popups: this.popups.length, voices: this.voices.size, lastCaption: this.lastCaption };
  }
  // Local integer hash supplies decorative variation only; it never consumes game RNG.
  random(seed) { let s = seed >>> 0 || 104729; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  classify(type) {
    type = String(type || '').toLowerCase();
    if (/bank|cash|finish/.test(type)) return 'bank';
    if (/achievement|sticker|badge/.test(type)) return 'sticker';
    if (/goal|complete|challenge/.test(type)) return /fail/.test(type) ? 'miss' : 'goal';
    if (/flip|spin/.test(type)) return 'flip';
    if (/puff/.test(type)) return 'puff';
    if (/bonk|impact/.test(type)) return 'bonk';
    if (/combo|ovation/.test(type)) return 'combo';
    if (/respawn|bust|fail|drop/.test(type)) return 'miss';
    return 'trick';
  }
  caption(event, kind, seed) {
    const pool = {
      bank: ['STICK THE NON-LANDING!', 'APPLAUSE, SOMEHOW.', 'THAT COUNTS AS A PLAN.'],
      sticker: ['A VERY SPECIFIC TALENT.', 'CERTIFIED SILLY.', 'PUT THAT ON THE FRIDGE.'],
      goal: ['SPECIAL DELIVERY!', 'EXACTLY AS REHEARSED.', 'THE CROWD UNDERSTANDS NOTHING.'],
      flip: ['ROTATIONAL NONSENSE!', 'ONE MORE SIDE OF YOU.', 'THE FLOOR CAN WAIT.'],
      puff: ['A TINY CHANGE OF PLANS.', 'PROFESSIONAL AIR BISCUIT.', 'PFFFFT. WITH PURPOSE.'],
      bonk: ['GENTLE MEETING. LOUD MINUTES.', 'FLOOR CONSULTANT.', 'A DIGNIFIED BOOP.'],
      combo: ['COMMIT TO THE BIT!', 'THE PLOT THICKENS!', 'NOW IT IS A ROUTINE.'],
      miss: ['AN EXCELLENT REHEARSAL.', 'THE NEXT ONE IS THE ONE.', 'DIGNITY REGENERATES.'],
      trick: ['THAT WAS A CHOICE!', 'EXTREMELY INTENTIONAL.', 'PLEASE CONTINUE THE NONSENSE.']
    };
    // Authored short event titles lead; the quip is a deterministic decorative subtitle.
    const supplied = event.title || event.label || event.name;
    const title = supplied ? String(supplied).replace(/[\r\n\t]/g, ' ').slice(0, 52) : kind === 'bank' ? 'STUNT BANKED' : kind === 'puff' ? 'PUFF!' : kind === 'bonk' ? 'BONK!' : kind === 'flip' ? 'FLIP!' : kind === 'sticker' ? 'NEW STICKER' : kind === 'goal' ? 'TA-DA!' : kind === 'miss' ? 'AGAIN? ABSOLUTELY.' : 'SHOWTIME!';
    return { title, quip: pool[kind][seed % pool[kind].length] };
  }
  emit(events) {
    if (this.disposed || this.hidden || !Array.isArray(events)) return;
    // A stale enormous caller batch cannot make presentation unbounded.
    for (const event of events.slice(0, 16)) {
      if (!event || typeof event !== 'object') continue;
      const type = String(event.type || 'trick').slice(0, 80);
      const identity = event.seq ?? event.id;
      const key = identity === undefined ? null : type + ':' + String(identity).slice(0, 100);
      if (key && this.seen.has(key)) continue;
      if (key) {
        this.seen.add(key); this.seenOrder.push(key);
        if (this.seenOrder.length > 512) this.seen.delete(this.seenOrder.shift());
      }
      const serial = ++this.serial, kind = this.classify(type), message = this.caption(event, kind, serial);
      this.lastCaption = message.title + ' · ' + message.quip;
      if (this.enabled) {
        // Keep the latest two small cards; show text even with motion suppressed.
        const points = Number.isFinite(event.points) ? event.points : Number.isFinite(event.score) ? event.score : null;
        const multiplier = Number.isFinite(event.multiplier) ? Math.max(1, Math.min(99, event.multiplier)) : null;
        this.popups.push({ ...message, kind, t: 0, life: kind === 'bank' || kind === 'sticker' ? 2.35 : 1.55, points, multiplier });
        if (this.popups.length > 2) this.popups.shift();
        if (!this.reducedMotion) this.burst(kind, serial);
      }
      this.motif(kind);
    }
  }
  burst(kind, seed) {
    const rng = this.random(seed * 104729), count = kind === 'bank' || kind === 'goal' || kind === 'sticker' ? 48 : kind === 'puff' ? 12 : 20;
    const palette = ['#ffcb66', '#7fffd0', '#ff7cae', '#76dfff', '#c9b1ff'];
    for (let n = 0; n < count; n++) {
      const a = rng() * Math.PI * 2, speed = 32 + rng() * 125;
      this.particles.push({ x: this.width * (0.37 + rng() * 0.26), y: this.height * 0.35,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 45, a, spin: (rng() - 0.5) * 9,
        t: 0, life: 0.55 + rng() * 0.9, size: 2 + rng() * 4, color: palette[n % palette.length], round: kind === 'puff' });
    }
    if (this.particles.length > 200) this.particles.splice(0, this.particles.length - 200);
  }
  motif(kind) {
    if (!this.soundEnabled || !this.audio || this.audio.state !== 'running' || this.hidden || this.volume <= 0) return;
    const now = this.audio.currentTime;
    // At most one motif per 90ms, no future sound queue, at most twelve voices.
    if (now - this.lastSound < 0.09) return;
    this.lastSound = now;
    if (kind === 'bank' || kind === 'goal' || kind === 'sticker') {
      const notes = kind === 'sticker' ? [659, 784, 659, 988] : [392, 494, 587, 784];
      notes.forEach((hz, i) => this.tone(hz, hz * 1.015, 0.13, i * 0.065, 'triangle', 0.16));
    } else if (kind === 'flip' || kind === 'combo') {
      [523, 659, 784].forEach((hz, i) => this.tone(hz, hz, 0.095, i * 0.045, 'sine', 0.14));
    } else if (kind === 'puff') this.tone(680, 170, 0.19, 0, 'sine', 0.18);
    else if (kind === 'bonk') { this.tone(185, 82, 0.13, 0, 'triangle', 0.20); this.tone(410, 150, 0.07, 0, 'sine', 0.08); }
    else if (kind === 'miss') this.tone(294, 196, 0.18, 0, 'sine', 0.11);
    else if (kind === 'ready') this.tone(523, 659, 0.12, 0, 'sine', 0.12);
    else this.tone(392, 440, 0.08, 0, 'sine', 0.10);
  }
  tone(from, to, duration, delay, shape, gain) {
    if (!this.audio || !this.master || this.voices.size >= 12) return;
    try {
      const oscillator = this.audio.createOscillator(), envelope = this.audio.createGain(), at = this.audio.currentTime + delay;
      oscillator.type = shape; oscillator.frequency.setValueAtTime(from, at);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration);
      envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(envelope); envelope.connect(this.master); this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(at); oscillator.stop(at + duration + 0.015);
    } catch (_) { /* Feedback must never interrupt the game. */ }
  }
  stopVoices() { for (const voice of this.voices) { try { voice.stop(); } catch (_) {} } this.voices.clear(); }
  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.stage?.getBoundingClientRect?.() || this.canvas.getBoundingClientRect?.();
    const width = Math.max(1, Math.min(4096, Math.round(rect?.width || 1))), height = Math.max(1, Math.min(2160, Math.round(rect?.height || 1)));
    const dpr = Math.min(1.5, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    if (width !== this.width || height !== this.height || this.dpr !== dpr) {
      this.width = width; this.height = height; this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  erase() { if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height); }
  render(dt, { paused = false } = {}) {
    if (this.disposed) return;
    this.paused = !!paused;
    if (this.hidden || this.paused) { this.clear(); return; }
    // No catch-up of old celebrations after a background tab or a long pause.
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0;
    this.time += dt; this.resize(); this.erase();
    this.popups = this.popups.filter(p => (p.t += dt) < p.life);
    this.particles = this.particles.filter(p => {
      p.t += dt; if (p.t >= p.life || this.reducedMotion) return false;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 155 * dt; p.a += p.spin * dt; return true;
    });
    if (!this.enabled || !this.ctx) return;
    const g = this.ctx;
    for (const p of this.particles) {
      g.save(); g.globalAlpha = Math.min(1, (p.life - p.t) * 3); g.fillStyle = p.color;
      g.translate(p.x, p.y); g.rotate(p.a);
      if (p.round) { g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.75);
      g.restore();
    }
    this.popups.forEach((p, i) => this.drawCard(g, p, i));
  }
  drawCard(g, p, index) {
    const big = p.kind === 'bank' || p.kind === 'sticker' || p.kind === 'goal';
    const width = Math.min(this.width - 28, big ? 362 : 320), height = big ? 82 : 68;
    if (width < 80) return;
    const progress = p.t / p.life, ease = this.reducedMotion ? 1 : Math.min(1, p.t / 0.13);
    const x = this.width / 2, y = this.height * 0.32 + index * (height + 9) - (this.reducedMotion ? 0 : (1 - ease) * 12);
    const color = p.kind === 'bonk' ? '#ff8dbb' : p.kind === 'puff' ? '#abdfff' : big ? '#ffce72' : '#98ffda';
    g.save(); g.globalAlpha = progress > 0.8 ? (1 - progress) / 0.2 : ease;
    g.translate(x, y); g.fillStyle = '#081c32ed'; g.strokeStyle = color; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-width / 2 + 10, -height / 2); g.lineTo(width / 2, -height / 2 + 5);
    g.lineTo(width / 2 - 5, height / 2 - 2); g.lineTo(-width / 2, height / 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = color; g.fillRect(-width / 2 + 9, -height / 2 + 10, 3, height - 20);
    const title = p.title.toUpperCase(), usable = width - 40;
    let size = big ? 20 : 17;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 ' + size + 'px "Segoe UI",sans-serif';
    while (size > 10 && g.measureText(title).width > usable) { size--; g.font = '800 ' + size + 'px "Segoe UI",sans-serif'; }
    g.fillText(title, 3, big ? -15 : -10, usable);
    g.fillStyle = '#d7e7f7'; g.font = '9px ui-monospace,monospace';
    g.fillText(p.quip, 3, big ? 8 : 11, usable);
    if (big) {
      const score = p.points === null ? 'DIGNITY: OPTIONAL' : '+' + Math.round(p.points).toLocaleString() + ' STYLE';
      g.fillStyle = color; g.font = '700 9px ui-monospace,monospace';
      g.fillText(score + (p.multiplier && p.multiplier > 1 ? '  ×' + p.multiplier.toFixed(1) : ''), 3, 26, usable);
    }
    g.restore();
  }
  clear() {
    this.particles.length = 0; this.popups.length = 0; this.seen.clear(); this.seenOrder.length = 0;
    this.stopVoices(); this.erase(); this.lastSound = -1e9;
  }
  dispose() {
    this.clear(); this.disposed = true; this.soundEnabled = false;
    this.motionQuery?.removeEventListener?.('change', this.motionChange);
    if (typeof document !== 'undefined') document.removeEventListener?.('visibilitychange', this.visibilityChange);
    if (this.audio && this.audio.state !== 'closed') this.audio.close().catch?.(() => {});
    if (this.ownsCanvas) this.canvas?.remove?.();
  }
}
