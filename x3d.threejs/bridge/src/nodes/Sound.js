/* Sound for the three.js bridge: where the audio listener and the spatial sources are. The graphs, the signal and every field are the shared ones (BR.snd in x3d.webgpu/bridge/src/nodes/Analyser.js,
   one Web Audio context on the page); only the placement touches the engine: a SpatialSound or ListenerPointSource gets an Object3D under its parent in build(), and once a frame (updateView) the
   node's world pose is taken through the view matrix of the camera that draws and handed to the panner or the listener, as X_ITE does it (the listener at the origin of view space looking down -z). */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge;
  BR.snd.space.anchor = (body, n, parent) => {
    const S = (body._space ||= { world: null, list: new Set() });
    if (S.world !== body.world) { S.world = body.world; S.list.clear(); }
    const a = new THREE.Group(); a.name = (n.def || n.type) + '-snd'; parent.add(a); n._anchor = a;
    const T = BR.snd.types[n.type]; if (T && T.pose) T.pose(n);
    S.list.add(n); return a;
  };
  BR.snd.space.update = (body, n) => {
    const a = n._anchor, cam = body.cam, T = BR.snd.types[n.type]; if (!a || !cam || !T || !T.place) return;
    cam.updateMatrixWorld(true); a.updateWorldMatrix(true, false);
    const M = new THREE.Matrix4().multiplyMatrices(cam.matrixWorldInverse, a.matrixWorld), P = new THREE.Vector3().applyMatrix4(M);
    T.place(n, P, (x, y, z) => new THREE.Vector3(x, y, z).transformDirection(M));
  };
  BR.snd.types.ListenerPointSource.pose = (n) => {
    const a = n._anchor; if (!a) return; const p = n.f.position, o = n.f.orientation, ax = new THREE.Vector3(o[0], o[1], o[2]);
    a.position.set(p[0], p[1], p[2]); if (ax.lengthSq() > 0) a.quaternion.setFromAxisAngle(ax.normalize(), o[3]); else a.quaternion.identity();
  };
  T3.sound = { update(body) { const S = body._space; if (!S || S.world !== body.world) return; for (const n of S.list) BR.snd.space.update(body, n); } };
  for (const t of Object.keys(BR.snd.types)) { const sp = BR.specs.get(t); T3.build[t] = (body, n, parent) => (sp && sp.build ? sp.build(body, n, parent) : null); }
  for (const t of ['Sound', 'Analyser', 'SpatialSound', 'ListenerPointSource']) if (!T3.build[t]) T3.build[t] = (body, n, parent) => { const sp = BR.specs.get(t); return sp && sp.build ? sp.build(body, n, parent) : null; };
}
