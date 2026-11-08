/* DynamicsCompressor (Sound level 2): DynamicsCompressor node implements a dynamics compression effect, lowering volume of loudest parts of signal and raising volume of softest parts.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('DynamicsCompressor', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    attack: ['SFTime', IO, 0.003],
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    knee: ['SFFloat', IO, 30],
    metadata: ['SFNode', IO, null],
    pauseTime: ['SFTime', IO, 0],
    ratio: ['SFFloat', IO, 12],
    reduction: ['SFFloat', OUT, 0],
    release: ['SFTime', IO, 0.25],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    tailTime: ['SFTime', IO, 0],
    threshold: ['SFFloat', IO, -24],
  },
  /* A compressor: attack 0..1 s, knee 0..40 dB, ratio 1..20, release 0..1 s, threshold -100..0 dB (each held to its range). reduction is the gain reduction in dB, sent every tick while the
     node is active. */
  init: BR.snd.init,
  receive: BR.snd.receive,
  tick(n, now) { const w = BR.td.tick(n, now); if (n.f.isActive && n._au && n._au.proc) BR.fire(n, 'reduction', n._au.proc.reduction); },
});

BR.snd.types.DynamicsCompressor = {
  make: (c) => c.createDynamicsCompressor(),
  apply(n) {
    const d = n._au.proc, f = n.f, k = BR.snd.clamp; if (!d) return;
    d.attack.value = k(f.attack, 0, 1); d.knee.value = k(f.knee, 0, 40); d.ratio.value = k(f.ratio, 1, 20); d.release.value = k(f.release, 0, 1); d.threshold.value = k(f.threshold, -100, 0);
  },
};
