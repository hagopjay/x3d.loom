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
  /* A sound coming from a media stream: when the node starts it takes the stream that BR.snd.streams holds under one of the names in streamIdentifier (a StreamAudioDestination publishes its stream
     there; a page can add a stream of its own, for instance from WebRTC or getUserMedia: BR.snd.streams.set('name', mediaStream)) and plays it through gain; while the stream is not there yet it keeps
     looking every frame as long as the node is active; pause and stop let go of it. X_ITE 16.6.0 marks this node as not supported: only the clock runs there (isActive, isPaused, elapsedTime), no sound. */
  init: BR.snd.init,
  receive(n, field, v) { const r = BR.snd.receive(n, field, v); if (field === 'streamIdentifier' && n._au && n._au.src) BR.stream.drop(n); return r; },
  tick(n, now) {
    const what = BR.td.tick(n, now), au = n._au; if (!au) return;
    if (what === 'pause' || what === 'stop') BR.stream.drop(n);
    else if (n.f.isActive && !n.f.isPaused && !au.src) BR.stream.take(n);
  },
});

BR.stream = {
  take(n) {
    const au = n._au; for (const id of n.f.streamIdentifier || []) {
      const ms = BR.snd.streams && BR.snd.streams.get(String(id)); if (!ms || !ms.getAudioTracks().length) continue;
      try { au.src = au.c.createMediaStreamSource(ms); au.src.connect(au.out); } catch (e) { au.src = null; console.error(e.message); }
      return;
    }
  },
  drop(n) { const au = n._au; if (au && au.src) { try { au.src.disconnect(); } catch (e) { /* none */ } au.src = null; } },
};
BR.snd.types.StreamAudioSource = { source: true, apply(n) { const au = n._au; if (au) au.out.gain.value = n.f.gain; } };
