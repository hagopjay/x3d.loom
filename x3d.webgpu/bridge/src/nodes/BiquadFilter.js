/* BiquadFilter (Sound level 2): BiquadFilter node is an AudioNode processor implementing common low-order filters.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BiquadFilter', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    detune: ['SFFloat', IO, 0],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    frequency: ['SFFloat', IO, 350],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    pauseTime: ['SFTime', IO, 0],
    qualityFactor: ['SFFloat', IO, 1],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    tailTime: ['SFTime', IO, 0],
    type: ['SFString', IO, "LOWPASS"],
  },
  /* A filter: lowpass by default, frequency 350 Hz, Q 1. type is one of the eight Web Audio filter types (anything else reads as lowpass), frequency is held at 0 or more, qualityFactor to
     0.0001..1000, detune in cents. The clock fields start and stop the node as for every time dependent node. */
  init: BR.snd.init,
  receive: BR.snd.receive,
  tick(n, now) { BR.td.tick(n, now); },
});

BR.snd.types.BiquadFilter = {
  TYPES: { LOWPASS: 'lowpass', HIGHPASS: 'highpass', BANDPASS: 'bandpass', LOWSHELF: 'lowshelf', HIGHSHELF: 'highshelf', PEAKING: 'peaking', NOTCH: 'notch', ALLPASS: 'allpass' },
  make: (c) => c.createBiquadFilter(),
  apply(n) {
    const b = n._au.proc, f = n.f; if (!b) return;
    b.detune.value = f.detune; b.type = BR.snd.types.BiquadFilter.TYPES[f.type] || 'lowpass';
    b.frequency.value = Math.max(f.frequency, 0); b.Q.value = BR.snd.clamp(f.qualityFactor, 0.0001, 1000);
  },
};
