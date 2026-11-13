/* ChannelSplitter (Sound level 2): ChannelSplitter separates the different channels of a single audio source into a set of monophonic output channels.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ChannelSplitter', {
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
    outputs: ['MFNode', IO, []],
  },
  /* Sends the channels of its input to the nodes listed in outputs: channel i to output node i (the splitter has one output per listed node, 1 to 32). While disabled there is no splitter and
     the whole signal goes to every output node. */
  init: BR.snd.init,
  receive: BR.snd.receive,
});

BR.snd.types.ChannelSplitter = {
  wireOut(n) {
    const au = n._au, en = n.f.enabled !== false; if (!au) return;
    for (const o of au._outs || []) { try { au.out.disconnect(o._au.in); } catch (e) { /* not connected */ } }
    if (au.proc) { try { au.out.disconnect(au.proc); au.proc.disconnect(); } catch (e) { /* none */ } }
    const outs = (n.f.outputs || []).filter((o) => o && o._au && !BR.snd.types[o.type].source && !BR.snd.types[o.type].dest);
    au._outs = outs;
    if (!en) { au.proc = null; for (const o of outs) au.out.connect(o._au.in); return; }
    const num = BR.snd.clamp(outs.length, 1, 32);
    if (!au.proc || au.proc.numberOfOutputs !== num) au.proc = au.c.createChannelSplitter(num);
    au.out.connect(au.proc); outs.slice(0, 32).forEach((o, i) => au.proc.connect(o._au.in, i));
  },
};
