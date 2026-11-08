/* BufferAudioSource (Sound level 2): BufferAudioSource node represents a memory-resident audio asset that can contain one or more channels.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BufferAudioSource', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    buffer: ['MFFloat', IO, []],
    bufferDuration: ['SFTime', IO, 0],
    bufferlength: ['SFInt32', OUT, 0],
    bufferLength: ['SFInt32', IO, 0],
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    description: ['SFString', IO, ""],
    detune: ['SFFloat', IO, 0],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    length: ['SFInt32', OUT, 0],
    load: ['SFBool', IO, true],
    loop: ['SFBool', IO, false],
    loopEnd: ['SFFloat', IO, 0],
    loopStart: ['SFFloat', IO, 0],
    metadata: ['SFNode', IO, null],
    numberOfChannels: ['SFInt32', IO, 0],
    pauseTime: ['SFTime', IO, 0],
    playbackRate: ['SFFloat', IO, 1],
    resumeTime: ['SFTime', IO, 0],
    sampleRate: ['SFFloat', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    url: ['MFString', IO, []],
  },
  /* A sound held in memory: numberOfChannels (1..32) x bufferlength samples of buffer, channel after channel, at sampleRate (3000..768000). With load = TRUE (the default) the sound comes from url
     instead (fetched and decoded; the four values and bufferDuration are then filled in). bufferDuration is bufferLength / sampleRate in seconds, -1 while there is no buffer. Plays from startTime,
     stops at stopTime or when it runs out (unless loop), pauses and resumes like the other time dependent nodes (a Web Audio buffer source cannot pause, so pausing stops it and resuming starts
     again at the paused position). detune, playbackRate, loopStart and loopEnd go to the playing source. The UOM and the XSD call the length field bufferlength and make it output only; X_ITE
     16.6.0 has bufferLength, input output. Both exist here. */
  init(n, w) { BR.snd.init(n, w); n.f.bufferDuration = -1; },
  receive: BR.snd.receive,
  tick(n, now) {
    const what = BR.td.tick(n, now), au = n._au; if (!au) return;
    const st = BR.td.state(n);
    if (what === 'start') { st.pos = 0; BR.buf.play(n, 0); }
    else if (what === 'pause') { st.pos = BR.buf.pos(n); BR.buf.halt(n); }
    else if (what === 'resume') BR.buf.play(n, st.pos || 0);
    else if (what === 'stop') BR.buf.halt(n);
    else if (n.f.isActive && n._ended) { n._ended = false; BR.td.end(n, now); BR.buf.halt(n); }
  },
});

BR.buf = {
  make(n) {                                       // the AudioBuffer from the node's own samples
    const au = n._au, f = n.f; if (!au) return;
    if (f.load) { if (f.url && f.url.length && !n._loading) BR.buf.load(n); return; }
    const ch = BR.snd.clamp(f.numberOfChannels | 0, 1, 32), rate = BR.snd.clamp(f.sampleRate || 0, 3000, 768000), len = Math.max(f.bufferLength | 0, 0);
    if (!len) { au.buf = null; f.bufferDuration = -1; BR.fire(n, 'bufferDuration', -1); return; }
    const b = au.c.createBuffer(ch, len, rate), s = f.buffer || [];
    if (s.length >= len * ch) for (let i = 0; i < ch; i++) b.copyToChannel(Float32Array.from(s.slice(i * len, (i + 1) * len)), i);
    au.buf = b; BR.fire(n, 'bufferDuration', len / rate);
  },
  async load(n) {                                 // load = TRUE: fetch the first url that decodes
    const au = n._au; n._loading = true;
    try {
      for (const u of n.f.url) {
        try { const r = await fetch(BR.resolveUrl(u)); au.buf = await au.c.decodeAudioData(await r.arrayBuffer()); break; } catch (e) { /* next url */ }
      }
      const b = au.buf; if (!b) return;
      const d = new Float32Array(b.length * b.numberOfChannels); for (let i = 0; i < b.numberOfChannels; i++) d.set(b.getChannelData(i), i * b.length);
      n.f.load = true; BR.fire(n, 'numberOfChannels', b.numberOfChannels); BR.fire(n, 'sampleRate', b.sampleRate); BR.fire(n, 'bufferLength', b.length); BR.fire(n, 'buffer', Array.from(d)); BR.fire(n, 'bufferDuration', b.duration);
    } finally { n._loading = false; }
  },
  play(n, at) {
    const au = n._au; if (!au || !au.buf) return; BR.buf.halt(n);
    const s = au.c.createBufferSource(), f = n.f; s.buffer = au.buf; s.loop = !!f.loop; s.loopStart = Math.max(f.loopStart || 0, 0); s.loopEnd = Math.max(f.loopEnd || 0, 0);
    s.playbackRate.value = f.playbackRate; s.detune.value = f.detune || 0; s.connect(au.out);
    s.onended = () => { if (au.src === s) { au.src = null; n._ended = true; } };
    au.t0 = au.c.currentTime - at / (f.playbackRate || 1); au.src = s; s.start(0, at % au.buf.duration);
  },
  halt(n) { const au = n._au; if (au && au.src) { const s = au.src; au.src = null; s.onended = null; try { s.stop(); } catch (e) { /* not started */ } } },
  pos: (n) => { const au = n._au; return au && au.src ? (au.c.currentTime - au.t0) * (n.f.playbackRate || 1) : 0; },
};
BR.snd.types.BufferAudioSource = {
  source: true,
  apply(n, field) {
    const f = n.f, au = n._au; if (!au) return;
    au.out.gain.value = f.gain;
    if (field === null || ['load', 'url', 'numberOfChannels', 'sampleRate', 'bufferLength', 'buffer'].includes(field)) BR.buf.make(n);
    if (au.src) { au.src.playbackRate.value = f.playbackRate; au.src.detune.value = f.detune || 0; au.src.loop = !!f.loop; au.src.loopStart = Math.max(f.loopStart || 0, 0); au.src.loopEnd = Math.max(f.loopEnd || 0, 0); }
  },
};
