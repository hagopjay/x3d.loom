/* Analyser (Sound level 2): Analyser provides real-time frequency and time-domain analysis information, without any signal-processing change to the audio stream which is passed unprocessed
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */

/* ---- the foundation of the Sound group (first file alphabetically, so the later Sound nodes can use it) ---------------------------------------------------------------------------------
   BR.td: the clock part of X3DTimeDependentNode, as the TimeSensor family does it: a node starts when time reaches startTime (once per new startTime), stops at stopTime (when that is after the
          start), pauses at pauseTime and resumes at resumeTime. isActive, isPaused and elapsedTime are the outputs; disabling an active node stops it.
   BR.audio: one lazily made Web Audio context shared by the group (nothing is made until a node needs it, so the headless event tests need no audio device), and a place to keep each node's audio
          graph pieces on the node (n._au). The graph is the same shape X_ITE builds: per node a source gain and a destination gain, and the processing node between them. */
BR.td = {
  state: (n) => (n._td ||= { start: 0, t0: 0, pausedAt: 0, pausedAcc: 0 }),
  end(n, now) {                                   // stop an active node now (stopTime reached, disabled, or a one-shot source ran out)
    const f = n.f, st = BR.td.state(n); if (!f.isActive) return null;
    if (f.isPaused) BR.fire(n, 'isPaused', false); BR.fire(n, 'isActive', false); BR.fire(n, 'elapsedTime', now - st.t0 - st.pausedAcc); return 'stop';
  },
  tick(n, now) {
    const f = n.f, st = BR.td.state(n);
    if (!f.isActive) {
      if (f.enabled !== false && f.startTime > 0 && f.startTime > st.start && now >= f.startTime && !(f.stopTime > f.startTime && now >= f.stopTime)) {
        st.start = f.startTime; st.t0 = now; st.pausedAcc = 0; BR.fire(n, 'isActive', true); BR.fire(n, 'elapsedTime', 0); return 'start';
      }
      return null;
    }
    const stop = () => BR.td.end(n, now);
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

/* BR.snd: the Web Audio graph of the Sound nodes, built the way X_ITE 16.6.0 builds it so the two can be compared piece by piece. Every Sound node owns n._au = { in, out, proc }:
     in   a gain stage at the node's input (X_ITE: audioDestination) that holds gain, channelCount, channelCountMode and channelInterpretation
     out  the node's output (X_ITE: audioSource); the children's outputs feed `in`, a parent takes `out`
     proc the node's own Web Audio node between the two (a BiquadFilterNode, an AnalyserNode, a ChannelSplitterNode, ...), or null
   enabled = false lets the signal pass unmodified for processing and channel nodes (in goes straight to out, gain 1, mode max, speakers) and blocks it for a destination.
   A type is described by BR.snd.types[type] = { make(c, n) -> proc, apply(n, field), dest, source, merge }. With no AudioContext (no Web Audio at all) nothing is made and the node keeps its fields. */
BR.snd = {
  types: {},
  MODE: { MAX: 'max', 'CLAMPED-MAX': 'clamped-max', CLAMPED_MAX: 'clamped-max', EXPLICIT: 'explicit' },
  INTERP: { SPEAKERS: 'speakers', DISCRETE: 'discrete' },
  clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  init(n, w) {
    const c = BR.audio.ctx(), T = BR.snd.types[n.type]; n._w = w; if (!c || !T) return;
    const au = n._au = { c, in: c.createGain(), out: c.createGain(), proc: null };
    au.in.gain.value = 0; au.out.gain.value = T.source ? 0 : 1;
    if (T.make) au.proc = T.make(c, n);
    if (T.dest) au.out.connect(c.destination);
    BR.snd.settle(n); BR.snd.wire(n);
    for (const p of w.nodes) if (p._au && p !== n && (p.f.children || []).includes(n)) BR.snd.wire(p);
    if (T.dest) n.f.isActive = n.f.enabled !== false;
  },
  /* all the input-stage fields at once, then the type's own */
  settle(n) {
    const au = n._au, f = n.f, T = BR.snd.types[n.type], en = f.enabled !== false;
    if (!au) return;
    au.in.channelCount = BR.snd.clamp(f.channelCount | 0, 1, 32);
    if (en) { au.in.gain.value = f.gain; au.in.channelCountMode = BR.snd.MODE[f.channelCountMode] || 'max'; au.in.channelInterpretation = BR.snd.INTERP[f.channelInterpretation] || 'speakers'; }
    else if (!T.dest) { au.in.gain.value = 1; au.in.channelCountMode = 'max'; au.in.channelInterpretation = 'speakers'; }
    if (T.apply) T.apply(n, null);
    au.in.disconnect();
    if (T.dest) { if (en) au.in.connect(au.out); }
    else if (T.merge || !au.proc || !en) au.in.connect(au.out);
    else au.in.connect(au.proc);
    if (au.proc && !T.merge && !T.dest) { try { au.proc.disconnect(); } catch (e) { /* none */ } au.proc.connect(au.out, T.outPort ? T.outPort(n) : 0); }
  },
  wire(n) {                                       // children's outputs into this node's input (or, for a merger, into its numbered inputs)
    const au = n._au, T = BR.snd.types[n.type]; if (!au) return;
    const kids = (n.f.children || []).filter((k) => k && k._au);
    if (au._kids) for (const [k, i] of au._kids) { try { k._au.out.disconnect(i === null ? au.in : au.proc); } catch (e) { /* not connected */ } }
    au._kids = [];
    if (T.merge) BR.snd.merger(n, kids);
    kids.forEach((k, i) => {
      if (T.merge && au.proc) { if (i < 32) { k._au.out.connect(au.proc, 0, i); au._kids.push([k, i]); } }
      else { k._au.out.connect(au.in); au._kids.push([k, null]); }
    });
  },
  merger(n, kids) {                               // ChannelMerger: one input per child, 1 to 32; none while disabled
    const au = n._au, c = au.c, en = n.f.enabled !== false;
    if (au.proc) { try { au.proc.disconnect(); } catch (e) { /* none */ } }
    if (!en) { au.proc = null; return; }
    const num = BR.snd.clamp(kids.length, 1, 32);
    if (!au.proc || au.proc.numberOfInputs !== num) au.proc = c.createChannelMerger(num);
    au.proc.connect(au.in);
  },
  receive(n, field, v) {                          // the field is stored by the stock handler afterwards, so the change is applied on the next microtask
    if (!n._au) return false;
    Promise.resolve().then(() => { const T = BR.snd.types[n.type]; if (field === 'children' || (T.merge && field === 'enabled')) BR.snd.wire(n); BR.snd.settle(n); if (field === 'enabled' && T.dest) BR.fire(n, 'isActive', n.f.enabled !== false); });
    return false;
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
  /* fftSize is rounded up to a power of two and held to 32..32768 (the Web Audio limits); frequencyBinCount is half of that. The four data outputs follow the AnalyserNode in the node's graph every tick
     while the node is active (silence reads 0 in the byte arrays and -Infinity in the float frequency array). The field values stay as written, as in X_ITE 16.6.0. minDecibels, maxDecibels and
     smoothingTimeConstant go to the audio node (decibels held at or below 0, the pair ordered, smoothing held to 0..1). With no audio context (no Web Audio) the node keeps its fields, clock and
     frequencyBinCount and gives no data. */
  init: BR.snd.init,
  receive(n, field, v) {
    if (field === 'fftSize') BR.fire(n, 'frequencyBinCount', BR.analyser.bins(v));
    return BR.snd.receive(n, field, v);
  },
  tick(n, now) {
    const what = BR.td.tick(n, now); if (!what) return;
    if (what === 'run' || what === 'start') BR.analyser.data(n);
  },
});
BR.analyser = {
  bins: (v) => Math.min(32768, Math.max(32, 2 ** Math.ceil(Math.log2(Math.max(1, v | 0))))) / 2,
  data(n) {
    const au = n._au; if (!au || !au.proc) return; const a = au.proc, N = a.frequencyBinCount;
    const bf = new Uint8Array(N), bt = new Uint8Array(N), ff = new Float32Array(N), ft = new Float32Array(N);
    a.getByteFrequencyData(bf); a.getByteTimeDomainData(bt); a.getFloatFrequencyData(ff); a.getFloatTimeDomainData(ft);
    BR.fire(n, 'byteFrequencyData', Array.from(bf)); BR.fire(n, 'byteTimeDomainData', Array.from(bt)); BR.fire(n, 'floatFrequencyData', Array.from(ff)); BR.fire(n, 'floatTimeDomainData', Array.from(ft));
  },
};
BR.snd.types.Analyser = {
  make: (c) => c.createAnalyser(),
  apply(n) {
    const a = n._au.proc, f = n.f; if (!a) return;
    a.fftSize = BR.analyser.bins(f.fftSize) * 2;
    const lo = Math.min(f.minDecibels, 0), hi = Math.min(f.maxDecibels, 0); a.minDecibels = Math.min(lo, hi); a.maxDecibels = Math.max(lo, hi);
    a.smoothingTimeConstant = BR.snd.clamp(f.smoothingTimeConstant, 0, 1);
  },
};
