/* StreamAudioSource (Sound level 2): StreamAudioSource operates as an audio source whose media is received from a MediaStream obtained using the WebRTC or Media Capture and Streams APIs.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('StreamAudioSource', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    description: ['SFString', IO, ""],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    pauseTime: ['SFTime', IO, 0],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    streamIdentifier: ['MFString', IO, []],
  },
  /* A sound coming from a network stream (streamIdentifier): X_ITE 16.6.0 marks this node as not supported. Only the clock of every time dependent node runs (isActive, isPaused,
     elapsedTime); no sound is made. */
  tick(n, now) { BR.td.tick(n, now); },
});

