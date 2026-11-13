/* PeriodicWave (Sound level 2): PeriodicWave defines a periodic waveform that can be used to shape the output of an Oscillator.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PeriodicWave', {
  component: 'Sound', level: 2,
  container: 'periodicWave',
  defs: {
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    optionsImag: ['MFFloat', IO, []],
    optionsReal: ['MFFloat', IO, []],
    type: ['SFString', IO, "SQUARE"],
  },
  /* A waveform for an OscillatorSource: type SINE, SQUARE (the default), SAWTOOTH, TRIANGLE or CUSTOM; CUSTOM is built from optionsReal and optionsImag (the cosine and sine terms, at least
     two each). createPeriodicWave() is what the oscillator calls (kept on the node, as in X_ITE 16.6.0); its arrays are real and imag. */
  init(n) {
    n.real = new Float32Array(2); n.imag = new Float32Array(2);
    n.createPeriodicWave = () => {
      const c = BR.audio.ctx(), re = n.f.optionsReal || [], im = n.f.optionsImag || [], len = Math.max(re.length, im.length, 2);
      if (n.real.length !== len) { n.real = new Float32Array(len); n.imag = new Float32Array(len); }
      n.real.set(re); n.imag.set(im);
      return c ? c.createPeriodicWave(n.real, n.imag) : null;
    };
  },
  receive(n, field) { if (field === 'type' || field === 'optionsReal' || field === 'optionsImag') Promise.resolve().then(() => BR.osc.refresh(n)); return false; },
});

