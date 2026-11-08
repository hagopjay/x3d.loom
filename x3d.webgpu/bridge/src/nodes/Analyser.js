/* Analyser (Sound level 2): Analyser provides real-time frequency and time-domain analysis information, without any signal-processing change to the audio stream which is passed unprocessed
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */

/* ---- the foundation of the Sound group (first file alphabetically, so the later Sound nodes can use it) ---------------------------------------------------------------------------------
   BR.td: the clock part of X3DTimeDependentNode, as the TimeSensor family does it: a node starts when time reaches startTime (once per new startTime), stops at stopTime (when that is after the
          start), pauses at pauseTime and resumes at resumeTime. isActive, isPaused and elapsedTime are the outputs; disabling an active node stops it.
   BR.audio: one lazily made Web Audio context shared by the group (nothing is made until a node needs it, so the headless event tests need no audio device), and a place to keep each node's audio
          graph pieces on the node (n._au). The graph is the same shape X_ITE builds: per node a source gain and a destination gain, and the processing node between them. */
BR.td = {
  state: (n) => (n._td ||= { start: 0, t0: 0, pausedAt: 0, pausedAcc: 0 }),
  tick(n, now) {
    const f = n.f, st = BR.td.state(n);
    if (!f.isActive) {
      if (f.enabled !== false && f.startTime > 0 && f.startTime > st.start && now >= f.startTime && !(f.stopTime > f.startTime && now >= f.stopTime)) {
        st.start = f.startTime; st.t0 = now; st.pausedAcc = 0; BR.fire(n, 'isActive', true); BR.fire(n, 'elapsedTime', 0); return 'start';
      }
      return null;
    }
    const stop = () => { if (f.isPaused) BR.fire(n, 'isPaused', false); BR.fire(n, 'isActive', false); BR.fire(n, 'elapsedTime', now - st.t0 - st.pausedAcc); return 'stop'; };
    if ((f.stopTime > st.start && now >= f.stopTime) || f.enabled === false) return stop();
    if (!f.isPaused) {
      if (f.pauseTime > f.resumeTime && now >= f.pauseTime && f.pauseTime >= st.start) { st.pausedAt = now; BR.fire(n, 'isPaused', true); return 'pause'; }
      BR.fire(n, 'elapsedTime', now - st.t0 - st.pausedAcc); return 'run';
    }
    if (f.resumeTime >= f.pauseTime && now >= f.resumeTime) { st.pausedAcc += now - st.pausedAt; BR.fire(n, 'isPaused', false); return 'resume'; }
    return 'paused';
  },
};
BR.audio = {
  ctx() {
    if (BR.audio._c !== undefined) return BR.audio._c;
    try { BR.audio._c = typeof AudioContext !== 'undefined' ? new AudioContext() : null; } catch (e) { BR.audio._c = null; }
    return BR.audio._c;
  },
};

BR.node('Analyser', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    fftSize: ['SFInt32', IO, 2048],
    frequencyBinCount: ['SFInt32', OUT, 1024],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    maxDecibels: ['SFFloat', IO, -30],
    metadata: ['SFNode', IO, null],
    minDecibels: ['SFFloat', IO, -100],
    pauseTime: ['SFTime', IO, 0],
    resumeTime: ['SFTime', IO, 0],
    smoothingTimeConstant: ['SFFloat', IO, 0.8],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    tailTime: ['SFTime', IO, 0],
    byteFrequencyData: ['MFInt32', OUT, []],
    byteTimeDomainData: ['MFInt32', OUT, []],
    floatFrequencyData: ['MFFloat', OUT, []],
    floatTimeDomainData: ['MFFloat', OUT, []],
  },
  /* fftSize is rounded up to a power of two and held to 32..32768 (the Web Audio limits); frequencyBinCount is half of that. The four data outputs follow the analyser node of the page's audio
     context every tick while the node is active (silence reads 0 in the byte arrays and -Infinity in the float frequency array). The field values stay as written, as in X_ITE 16.6.0.
     minDecibels, maxDecibels and smoothingTimeConstant go to the audio node (decibels held at or below 0, the pair ordered, smoothing held to 0..1). With no audio context (headless) the node
     keeps its fields, clock and frequencyBinCount and gives no data. */
  receive(n, field, v) {
    if (field === 'fftSize') BR.fire(n, 'frequencyBinCount', BR.analyser.bins(v));
    return false;
  },
  tick(n, now) {
    const what = BR.td.tick(n, now); if (!what) return;
    if (what === 'start') BR.analyser.audio(n);
    if (what === 'stop') BR.analyser.drop(n);
    if (what === 'run' || what === 'start') BR.analyser.data(n);
  },
});
BR.analyser = {
  bins: (v) => Math.min(32768, Math.max(32, 2 ** Math.ceil(Math.log2(Math.max(1, v | 0))))) / 2,
  audio(n) {                                      // the Web Audio AnalyserNode, made when the node starts
    const c = BR.audio.ctx(); if (!c || n._au) return;
    const a = c.createAnalyser(), f = n.f;
    a.fftSize = BR.analyser.bins(f.fftSize) * 2;
    const lo = Math.min(f.minDecibels, 0), hi = Math.min(f.maxDecibels, 0); a.minDecibels = Math.min(lo, hi); a.maxDecibels = Math.max(lo, hi); if (a.maxDecibels <= a.minDecibels) a.maxDecibels = a.minDecibels + 1;
    a.smoothingTimeConstant = Math.min(1, Math.max(0, f.smoothingTimeConstant));
    n._au = { a };
  },
  drop(n) { if (n._au) { try { n._au.a.disconnect(); } catch (e) { /* already disconnected */ } n._au = null; } },
  data(n) {
    const au = n._au; if (!au) return; const a = au.a, N = a.frequencyBinCount;
    const bf = new Uint8Array(N), bt = new Uint8Array(N), ff = new Float32Array(N), ft = new Float32Array(N);
    a.getByteFrequencyData(bf); a.getByteTimeDomainData(bt); a.getFloatFrequencyData(ff); a.getFloatTimeDomainData(ft);
    BR.fire(n, 'byteFrequencyData', Array.from(bf)); BR.fire(n, 'byteTimeDomainData', Array.from(bt)); BR.fire(n, 'floatFrequencyData', Array.from(ff)); BR.fire(n, 'floatTimeDomainData', Array.from(ft));
  },
};
