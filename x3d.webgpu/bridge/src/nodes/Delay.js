/* Delay (Sound level 2): Delay causes a time delay between the arrival of input data and subsequent propagation to the output.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Delay', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    children: ['MFNode', IO, []],
    delayTime: ['SFTime', IO, 0],
    description: ['SFString', IO, ""],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    maxDelayTime: ['SFTime', IO, 1],
    metadata: ['SFNode', IO, null],
    pauseTime: ['SFTime', IO, 0],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    tailTime: ['SFTime', IO, 0],
  },
  /* A delay line: delayTime seconds (held to 0..maxDelayTime), maxDelayTime the longest it can be made. A new maxDelayTime builds a new Web Audio delay (that is how Web Audio does it). Web Audio
     takes a maximum above 0 and below 180 s; X_ITE 16.6.0 throws outside that, the bridge holds it to 0.001..179.999. */
  init: BR.snd.init,
  receive: BR.snd.receive,
  tick(n, now) { BR.td.tick(n, now); },
});

BR.snd.types.Delay = {
  apply(n) {
    const au = n._au, f = n.f, max = BR.snd.clamp(Math.max(f.maxDelayTime, 0), 0.001, 179.999);
    if (!au.proc || au._max !== max) { if (au.proc) { try { au.proc.disconnect(); } catch (e) { /* none */ } } au._max = max; au.proc = au.c.createDelay(max); }
    au.proc.delayTime.value = BR.snd.clamp(f.delayTime, 0, Math.max(f.maxDelayTime, 0));
  },
};
