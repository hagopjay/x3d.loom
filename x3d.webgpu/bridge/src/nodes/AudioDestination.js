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
     maxChannelCount is what the audio device reports. mediaDeviceID would pick the output device (setSinkId); there is no Audio element in the bridge's graph, so the default device is used (gap). */
  init: BR.snd.init,
  receive(n, field, v) { if (field === 'maxChannelCount') return true; return BR.snd.receive(n, field, v); },
});

BR.snd.types.AudioDestination = {
  dest: true,
  make(c, n) { n.f.maxChannelCount = c.destination.maxChannelCount; return null; },
};
