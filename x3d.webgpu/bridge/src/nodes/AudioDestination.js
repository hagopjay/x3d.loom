/* AudioDestination (Sound level 2): AudioDestination node represents the final audio destination and is what user ultimately hears, typically from the speakers of user device.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('AudioDestination', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    maxChannelCount: ['SFInt32', IO, 2],
    mediaDeviceID: ['SFString', IO, ""],
    metadata: ['SFNode', IO, null],
  },
  /* Where a Sound graph ends: its children feed a gain stage that goes to the page's audio output. enabled = false blocks the signal (the other Sound nodes pass it through); isActive follows enabled.
     maxChannelCount is what the audio device reports. mediaDeviceID picks the output device the way X_ITE 16.6.0 does: the signal goes through a media stream into an Audio element whose sinkId is the
     device (setSinkId); an empty id is the default output and uses the context's own destination. A device that does not exist (or no setSinkId in the browser) writes the error to the console and the
     signal stays on the default output. */
  init: BR.snd.init,
  receive(n, field, v) {
    if (field === 'maxChannelCount') return true;
    if (field === 'mediaDeviceID') BR.audioDest.route(n, String(v || ''));
    return BR.snd.receive(n, field, v);
  },
});

BR.audioDest = {
  route(n, id) {
    const au = n._au; if (!au) return;
    const c = au.c, off = (a, b) => { try { a.disconnect(b); } catch (e) { /* it was not connected */ } };
    if (id === '' || typeof Audio === 'undefined' || !c.createMediaStreamDestination) {          // the default output
      if (au.ms) { off(au.out, au.ms); au.ms = null; }
      if (au.el) { au.el.pause(); au.el.srcObject = null; au.el = null; }
      off(au.out, c.destination); au.out.connect(c.destination); return;
    }
    if (!au.ms) { au.ms = c.createMediaStreamDestination(); au.el = new Audio(); au.el.srcObject = au.ms.stream; }
    const el = au.el; off(au.out, c.destination); au.out.connect(au.ms);
    const done = (el.sinkId === id || !el.setSinkId ? Promise.resolve() : el.setSinkId(id)).then(() => el.play());
    done.catch((e) => { console.error(e && e.message ? e.message : e); if (au.el === el) { off(au.out, au.ms); au.out.connect(c.destination); au.failed = id; } });
    au.sinkTry = id;
  },
};

BR.snd.types.AudioDestination = {
  dest: true,
  make(c, n) { n.f.maxChannelCount = c.destination.maxChannelCount; if (n.f.mediaDeviceID) Promise.resolve().then(() => BR.audioDest.route(n, String(n.f.mediaDeviceID))); return null; },
};
