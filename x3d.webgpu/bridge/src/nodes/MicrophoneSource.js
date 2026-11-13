/* MicrophoneSource (Sound level 2): MicrophoneSource captures input from a physical microphone in the real world.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('MicrophoneSource', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    description: ['SFString', IO, ""],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    streamIdentifier: ['MFString', IO, []],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    mediaDeviceID: ['SFString', IO, ""],
    metadata: ['SFNode', IO, null],
    pauseTime: ['SFTime', IO, 0],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
  },
  /* The microphone as a sound source: starts when the clock starts it, asking the browser for the microphone (mediaDeviceID picks the device); stops when the clock stops it. Without a
     microphone, or without permission, nothing plays and the error is written to the console, as in X_ITE. */
  init: BR.snd.init,
  receive: BR.snd.receive,
  tick(n, now) {
    const what = BR.td.tick(n, now), au = n._au; if (!au) return;
    if (what === 'start' || what === 'resume') BR.mic.start(n);
    else if (what === 'pause' || what === 'stop') BR.mic.stop(n);
  },
});

BR.mic = {
  start(n) {
    const au = n._au; if (!au || typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia({ audio: { deviceId: n.f.mediaDeviceID } }).then((ms) => {
      if (!n.f.isActive) { ms.getTracks().forEach((t) => t.stop()); return; }
      au.mic = au.c.createMediaStreamSource(ms); au.mic.connect(au.out);
    }).catch((e) => console.error(e.message));
  },
  stop(n) { const au = n._au; if (au && au.mic) { au.mic.disconnect(); au.mic.mediaStream.getTracks().forEach((t) => t.stop()); au.mic = null; } },
};
BR.snd.types.MicrophoneSource = { source: true, apply(n) { const au = n._au; if (au) au.out.gain.value = n.f.gain; } };
