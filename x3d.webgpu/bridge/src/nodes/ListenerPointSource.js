/* ListenerPointSource (Sound level 2): ListenerPointSource node represents position and orientation of a person listening to virtual sound in the audio scene, and provides single or multiple sound ch
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ListenerPointSource', {
  component: 'Sound', level: 2,
  container: 'children',
  defs: {
    description: ['SFString', IO, ""],
    dopplerEnabled: ['SFBool', IO, false],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    interauralDistance: ['SFFloat', IO, 0],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    orientation: ['SFRotation', IO, [0, 0, 1, 0]],
    pauseTime: ['SFTime', IO, 0],
    position: ['SFVec3f', IO, [0, 0, 0]],
    resumeTime: ['SFTime', IO, 0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    trackCurrentView: ['SFBool', IO, false],
  },
  /* Where the audio listener is: position and orientation of this node in the scene (through its parents' transforms), handed to Web Audio in the camera's space once per frame. With
     trackCurrentView the listener sits at the camera (the origin of view space, looking down -z). enabled = false leaves the listener alone. interauralDistance, gain and dopplerEnabled are
     held (Web Audio has no use for them). */
  build(body, n, parent) { BR.snd.space.anchor(body, n, parent); BR.snd.types.ListenerPointSource.pose(n); return null; },
  changed(body, n) { BR.snd.types.ListenerPointSource.pose(n); BR.snd.types.ListenerPointSource.track(n); },
  init(n, w) { BR.snd.types.ListenerPointSource.track(n); },
  receive(n) { Promise.resolve().then(() => { BR.snd.types.ListenerPointSource.pose(n); BR.snd.types.ListenerPointSource.track(n); }); return false; },
});

BR.snd.types.ListenerPointSource = {
  place(n, P, dir) {
    if (n.f.enabled === false || n.f.trackCurrentView) return;
    const c = BR.audio.ctx(); if (!c) return; const L = n._lis = c.listener, F = dir(0, 0, -1), U = dir(0, 1, 0);
    L.positionX.value = P.x; L.positionY.value = P.y; L.positionZ.value = P.z; L.forwardX.value = F.x; L.forwardY.value = F.y; L.forwardZ.value = F.z; L.upX.value = U.x; L.upY.value = U.y; L.upZ.value = U.z;
  },
  pose(n) {
    const a = n._anchor; if (!a) return; const p = n.f.position, o = n.f.orientation;
    a.position.set(p[0], p[1], p[2]); a.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(o[0], o[1], o[2]).normalize(), o[3]);
  },
  track(n) {
    if (n.f.enabled === false || !n.f.trackCurrentView) return; const c = BR.audio.ctx(); if (!c) return; const L = n._lis = c.listener;
    L.positionX.value = 0; L.positionY.value = 0; L.positionZ.value = 0; L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  },
};
