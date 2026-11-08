/* OscillatorSource (Sound level 2): OscillatorSource node represents an audio source generating a periodic waveform, providing a constant tone.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('OscillatorSource', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    description: ['SFString', IO, ""],
    detune: ['SFFloat', IO, 0],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    frequency: ['SFFloat', IO, 440],
    gain: ['SFFloat', IO, 1],
    streamIdentifier: ['MFString', IO, []],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    pauseTime: ['SFTime', IO, 0],
    periodicWave: ['SFNode', IO, null],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
  },
  /* A tone generator: starts an oscillator when the clock starts it (and a new one after a pause), frequency in Hz (0 or more), detune in cents, the wave from periodicWave (the default wave is
     a square one). Stopping fades the tone out over 30 ms. gain is the source's output level. */
  init: BR.snd.init,
  receive: BR.snd.receive,
  tick(n, now) {
    const what = BR.td.tick(n, now), au = n._au; if (!au) return;
    if (what === 'start' || what === 'resume') BR.osc.start(n);
    else if (what === 'pause' || what === 'stop') BR.osc.stop(n);
  },
});

BR.osc = {
  wave: (n) => (n.f.periodicWave && n.f.periodicWave.type === 'PeriodicWave' ? n.f.periodicWave : null),
  TYPES: { SINE: 'sine', SQUARE: 'square', SAWTOOTH: 'sawtooth', TRIANGLE: 'triangle', CUSTOM: 'custom' },
  type(n) {                                       // the oscillator's wave type, or the custom wave
    const o = n._au && n._au.osc; if (!o) return;
    const w = BR.osc.wave(n), t = w ? BR.osc.TYPES[w.f.type] || 'square' : 'square';
    if (t === 'custom') { const pw = w.createPeriodicWave && w.createPeriodicWave(); if (pw) o.setPeriodicWave(pw); } else o.type = t;
  },
  refresh(n) { for (const x of n._w ? n._w.nodes : []) if (x.type === 'OscillatorSource' && BR.osc.wave(x) === n) BR.osc.type(x); },
  start(n) {
    const au = n._au, f = n.f; BR.osc.stop(n, true);
    const o = au.osc = au.c.createOscillator();
    au.out.gain.cancelScheduledValues(0); au.out.gain.value = f.gain;
    o.detune.value = f.detune; o.frequency.value = Math.max(f.frequency, 0); BR.osc.type(n); o.connect(au.out); o.start();
  },
  stop(n, hard) {                                 // 30 ms exponential fade out, then stop (immediately when a new tone replaces it)
    const au = n._au; if (!au || !au.osc) return; const o = au.osc, t = au.c.currentTime;
    if (hard) { try { o.stop(); o.disconnect(); } catch (e) { /* not started */ } return; }
    au.out.gain.setValueAtTime(au.out.gain.value, t); au.out.gain.exponentialRampToValueAtTime(1e-3, t + 0.03); try { o.stop(t + 0.03); } catch (e) { /* not started */ }
  },
};
BR.snd.types.OscillatorSource = {
  source: true,
  apply(n, field) {
    const au = n._au, f = n.f, o = au.osc; if (!au) return;
    if (!f.isActive || field === 'gain') au.out.gain.value = f.gain;
    if (o) { o.detune.value = f.detune; o.frequency.value = Math.max(f.frequency, 0); BR.osc.type(n); }
  },
};
