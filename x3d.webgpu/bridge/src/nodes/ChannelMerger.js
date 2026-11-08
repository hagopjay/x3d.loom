/* ChannelMerger (Sound level 2): ChannelMerger unites different input channels into a single output channel.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ChannelMerger', {
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
    metadata: ['SFNode', IO, null],
  },
  /* Joins its children into one multichannel signal: one input per child (1 to 32; a child past the 32nd is not connected), child i becomes channel i. While disabled there is no merger and the
     children pass straight through. */
  init: BR.snd.init,
  receive: BR.snd.receive,
});

BR.snd.types.ChannelMerger = { merge: true };
