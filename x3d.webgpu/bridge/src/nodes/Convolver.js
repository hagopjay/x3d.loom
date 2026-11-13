/* Convolver (Sound level 2): Convolver performs a linear convolution on a given AudioBuffer, often used to achieve a reverberation effect.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Convolver', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    buffer: ['MFFloat', IO, []],
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
    metadata: ['SFNode', IO, null],
    normalize: ['SFBool', IO, false],
    numberOfChannels: ['SFInt32', IO, 0],      // X_ITE 16.6.0 has it; the 4.0 UOM and XSD do not list it
    pauseTime: ['SFTime', IO, 0],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    tailTime: ['SFTime', IO, 0],
  },
  /* Convolution reverb: buffer holds the impulse response, numberOfChannels (1..32; Web Audio takes 1, 2 or 4) channels one after the other, at the audio context's own sample rate;
     normalize scales the response. Empty buffer = one silent sample. */
  init: BR.snd.init,
  receive: BR.snd.receive,
  tick(n, now) { BR.td.tick(n, now); },
});

BR.snd.types.Convolver = {
  make: (c) => c.createConvolver(),
  apply(n) {
    const au = n._au, f = n.f, v = au.proc; if (!v) return;
    const ch = BR.snd.clamp(f.numberOfChannels | 0, 1, 32), b = f.buffer || [], len = Math.max(Math.floor(b.length / ch), 1);
    try {
      const ab = au.c.createBuffer(ch, len, au.c.sampleRate);
      if (b.length >= len * ch) for (let i = 0; i < ch; i++) ab.copyToChannel(Float32Array.from(b.slice(i * len, (i + 1) * len)), i);
      v.buffer = ab;
    } catch (e) { /* Web Audio refuses 3 or more than 4 channels: the old response stays */ }
    v.normalize = !!f.normalize;
  },
};
