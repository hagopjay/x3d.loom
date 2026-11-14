/* StreamAudioDestination (Sound level 2): StreamAudioDestination node represents the final audio destination via a media stream.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('StreamAudioDestination', {
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
    mediaDeviceID: ['SFString', IO, ""],
    metadata: ['SFNode', IO, null],
    streamIdentifier: ['MFString', IO, []],
  },
  /* Sends the sound to a media stream: the children go through a gain stage into a MediaStreamAudioDestinationNode, and its MediaStream is published under every name in streamIdentifier in
     BR.snd.streams (a Map from name to MediaStream), where a StreamAudioSource with one of the names takes it up, and where the page can read it (a WebRTC connection, a recorder).
     enabled = false blocks the signal and isActive follows enabled, as for AudioDestination. X_ITE 16.6.0 marks this node as not supported: it makes no stream and sets no isActive; the fields are held there.
     mediaDeviceID has no meaning for a stream and is held. */
  init: BR.snd.init,
  receive(n, field, v) { if (field === 'streamIdentifier') BR.snd.publish(n, v || []); return BR.snd.receive(n, field, v); },
});

BR.snd.streams = new Map();
BR.snd.publish = (n, ids) => {
  const au = n._au; if (!au || !au.msd) return;
  for (const id of au.ids || []) if (BR.snd.streams.get(id) === au.msd.stream) BR.snd.streams.delete(id);
  au.ids = Array.from(ids, String).filter((q) => q !== ''); for (const id of au.ids) BR.snd.streams.set(id, au.msd.stream);
};
BR.snd.types.StreamAudioDestination = {
  dest: true,
  sink(c, n, au) { au.msd = c.createMediaStreamDestination(); Promise.resolve().then(() => BR.snd.publish(n, n.f.streamIdentifier || [])); return au.msd; },
};
