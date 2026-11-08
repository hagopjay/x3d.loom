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
  /* Sends the sound to a network stream (streamIdentifier, mediaDeviceID): X_ITE 16.6.0 marks this node as not supported and does nothing with it, not even isActive, and so does the bridge. The
     fields are held; the children are not connected anywhere. */
});

