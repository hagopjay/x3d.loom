/* WaveShaper (Sound level 2): WaveShaper node represents a nonlinear distorter that applies a wave-shaping distortion curve to the signal.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('WaveShaper', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    children: ['MFNode', IO, []],
    curve: ['MFFloat', IO, []],
    description: ['SFString', IO, ""],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    oversample: ['SFString', IO, "NONE"],
    pauseTime: ['SFTime', IO, 0],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    tailTime: ['SFTime', IO, 0],
  },
  /* A distortion: curve maps the input (-1..1) to the output through the list of values, oversample NONE, 2X or 4X sets how finely the shaping is done. A curve with fewer than two values
     is two zeros, as in X_ITE 16.6.0 (Web Audio takes at least two). */
  init: BR.snd.init,
  receive: BR.snd.receive,
  tick(n, now) { BR.td.tick(n, now); },
});

BR.snd.types.WaveShaper = {
  OVER: { NONE: 'none', '2X': '2x', '4X': '4x' },
  make: (c) => c.createWaveShaper(),
  apply(n) {
    const w = n._au.proc, f = n.f; if (!w) return;
    const cv = f.curve || []; w.curve = cv.length < 2 ? new Float32Array(2) : Float32Array.from(cv);
    w.oversample = BR.snd.types.WaveShaper.OVER[f.oversample] || 'none';
  },
};
