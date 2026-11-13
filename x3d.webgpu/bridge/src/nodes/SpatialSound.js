/* SpatialSound (Sound level 2): The SpatialSound node controls the 3D spatialization of sound playback by a child AudioClip or MovieTexture node.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SpatialSound', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    children: ['MFNode', IO, []],
    coneInnerAngle: ['SFFloat', IO, 6.2832],
    coneOuterAngle: ['SFFloat', IO, 6.2832],
    coneOuterGain: ['SFFloat', IO, 0],
    description: ['SFString', IO, ""],
    direction: ['SFVec3f', IO, [0, 0, 1]],
    distanceModel: ['SFString', IO, "INVERSE"],
    dopplerEnabled: ['SFBool', IO, false],
    enabled: ['SFBool', IO, true],
    enableHRTF: ['SFBool', IO, false],
    gain: ['SFFloat', IO, 1],
    intensity: ['SFFloat', IO, 1],
    location: ['SFVec3f', IO, [0, 0, 0]],
    maxDistance: ['SFFloat', IO, 10000],
    metadata: ['SFNode', IO, null],
    priority: ['SFFloat', IO, 0],
    referenceDistance: ['SFFloat', IO, 1],
    rolloffFactor: ['SFFloat', IO, 1],
    spatialize: ['SFBool', INIT, true],
  },
  /* A sound with a place: its children play through a Web Audio panner (equal power, or HRTF with enableHRTF) put at location and pointing along direction, both taken through the node's
     parents and the camera once per frame. intensity (0..1) times gain is the level; the cone angles (radians in the file, degrees in Web Audio, 0..360), coneOuterGain, distanceModel
     (LINEAR, INVERSE, EXPONENTIAL), rolloffFactor, maxDistance and referenceDistance go to the panner. spatialize = FALSE (set at load) bypasses the panner. dopplerEnabled and priority are held
     (Web Audio dropped doppler; there is only one voice per node). */
  init: BR.snd.init,
  receive: BR.snd.receive,
  build(body, n, parent) { BR.snd.space.anchor(body, n, parent); return null; },
});

BR.snd.types.SpatialSound = {
  own: true, dist: { LINEAR: 'linear', INVERSE: 'inverse', EXPONENTIAL: 'exponential' },
  make: (c) => c.createPanner(),
  pose(n) { if (n._anchor) n._anchor.position.set(n.f.location[0], n.f.location[1], n.f.location[2]); },
  place(n, P, dir) {
    const p = n._au && n._au.proc; if (!p) return; const F = dir(n.f.direction[0], n.f.direction[1], n.f.direction[2]);
    p.positionX.value = P.x; p.positionY.value = P.y; p.positionZ.value = P.z; p.orientationX.value = F.x; p.orientationY.value = F.y; p.orientationZ.value = F.z;
  },
  apply(n) {
    const au = n._au, f = n.f, p = au.proc, g = au.in, k = BR.snd.clamp, deg = (r) => r * 180 / Math.PI; if (!p) return;
    BR.snd.types.SpatialSound.pose(n);
    if (!au._set) { au._set = true; g.channelCount = 2; g.channelCountMode = 'explicit'; g.channelInterpretation = 'speakers'; g.connect(p); p.connect(au.out); au.out.gain.value = 1; }
    g.gain.value = k(f.intensity, 0, 1) * f.gain;
    p.coneOuterGain = k(f.coneOuterGain, 0, 1); p.coneInnerAngle = k(deg(f.coneInnerAngle), 0, 360); p.coneOuterAngle = k(deg(f.coneOuterAngle), 0, 360);
    p.distanceModel = BR.snd.types.SpatialSound.dist[f.distanceModel] || 'inverse';
    p.rolloffFactor = p.distanceModel === 'linear' ? Math.min(Math.max(f.rolloffFactor, 0), 1) : Math.max(f.rolloffFactor, 0);
    try { p.maxDistance = Math.max(f.maxDistance, 0); } catch (e) { /* Web Audio wants a maximum above 0: the old one stays */ }
    p.refDistance = Math.max(f.referenceDistance, 0); p.panningModel = f.enableHRTF ? 'HRTF' : 'equalpower';
    const on = f.enabled !== false; au.out.disconnect(); if (on) au.out.connect(au.c.destination);
    g.disconnect(); if (f.spatialize === false) { if (on) g.connect(au.c.destination); } else g.connect(p);
  },
};
