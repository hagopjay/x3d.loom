/* ChannelSelector (Sound level 2): ChannelSelector selects a single channel output from all input channels.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ChannelSelector', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    channelCount: ['SFInt32', IO, 0],
    channelCountMode: ['SFString', IO, "MAX"],
    channelInterpretation: ['SFString', IO, "SPEAKERS"],
    channelSelection: ['SFInt32', IO, 0],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    metadata: ['SFNode', IO, null],
  },
  /* Passes on one channel of its input: channelSelection 0 to 31 (held to that range) picks the output of a ChannelSplitter. */
  init: BR.snd.init,
  receive: BR.snd.receive,
});

BR.snd.types.ChannelSelector = {
  outPort: (n) => BR.snd.clamp(n.f.channelSelection | 0, 0, 31),
  apply(n) {                                      // a splitter with sel + 1 outputs; output sel goes on
    const au = n._au, sel = BR.snd.clamp(n.f.channelSelection | 0, 0, 31);
    if (!au.proc || au.proc.numberOfOutputs !== sel + 1) { if (au.proc) { try { au.proc.disconnect(); } catch (e) { /* none */ } } au.proc = au.c.createChannelSplitter(sel + 1); }
  },
};
