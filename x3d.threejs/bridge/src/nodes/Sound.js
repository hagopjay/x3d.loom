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
    T.place(n, P, (x, y, z) => new THREE.Vector3(x, y, z).transformDirection(M), M);
  };
  BR.snd.types.ListenerPointSource.pose = (n) => {
    const a = n._anchor; if (!a) return; const p = n.f.position, o = n.f.orientation, ax = new THREE.Vector3(o[0], o[1], o[2]);
    a.position.set(p[0], p[1], p[2]); if (ax.lengthSq() > 0) a.quaternion.setFromAxisAngle(ax.normalize(), o[3]); else a.quaternion.identity();
  };
  T3.sound = { update(body) { const S = body._space; if (!S || S.world !== body.world) return; for (const n of S.list) BR.snd.space.update(body, n); } };
  for (const t of Object.keys(BR.snd.types)) { const sp = BR.specs.get(t); T3.build[t] = (body, n, parent) => (sp && sp.build ? sp.build(body, n, parent) : null); }
  for (const t of ['Sound', 'Analyser', 'SpatialSound', 'ListenerPointSource']) if (!T3.build[t]) T3.build[t] = (body, n, parent) => { const sp = BR.specs.get(t); return sp && sp.build ? sp.build(body, n, parent) : null; };
}

/* ---- Sound (Sound level 1, the classic X3D sound) and AudioClip -------------------------------------------------------------------------------------------------------------------------
   The shared reader holds only the field tables of these two; the audio is defined here, the way X_ITE 16.6.0 builds it (Sound.js in x_ite.js, read 27 Nov 2026), so the two can be compared
   signal for signal. Graph of a Sound: in (intensity 0..1, two channels, explicit) -> splitter -> four gains (front left and right straight, back left and right crossed) -> merger -> out;
   with spatialize = FALSE: in -> one stereo gain -> out. Once a frame the loudness is set from the listener's place between two ellipsoids (minBack/minFront: full level inside; maxBack/maxFront:
   silent outside; a straight line between, measured along the ray from the listener through the sound's location), and the pan from the direction to the sound in view space:
   left = 1 - pan^2, right = 1 - (1 - pan)^2 (19775-1 16.2.2.3 as X_ITE reads it). The sound plays its source field and, as in X_ITE, any sound children. */
{
  const BR = R.bridge, k = BR.snd.clamp, V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  BR.node('Sound', {
    extend: { Sound: { enabled: ['SFBool', IO, true], description: ['SFString', IO, ''], children: ['MFNode', IO, []] } },
    init: BR.snd.init, receive: BR.snd.receive,
    build(body, n, parent) { BR.snd.space.anchor(body, n, parent); return null; },
  });
  const S0 = BR.snd.types.Sound = {
    own: true,
    make(c, n) {
      const g = (v) => { const x = c.createGain(); x.gain.value = v; return x; };
      const S = n._snd = { stereo: g(0), split: c.createChannelSplitter(2), fl: g(0), fr: g(0), bl: g(0), br: g(0), merge: c.createChannelMerger(2), gain: 0, pan: 0.5, rot: 0 };
      S.split.connect(S.fl, 0); S.split.connect(S.fr, 1); S.split.connect(S.br, 0); S.split.connect(S.bl, 1);
      S.fl.connect(S.merge, 0, 0); S.fr.connect(S.merge, 0, 1); S.bl.connect(S.merge, 0, 0); S.br.connect(S.merge, 0, 1);
      return S.merge;
    },
    apply(n) {
      const au = n._au, f = n.f, S = n._snd, off = (a, b) => { try { a.disconnect(b); } catch (e) { /* it was not connected */ } }; if (!au || !S) return;
      if (!au._set) { au._set = true; au.in.channelCount = 2; au.in.channelCountMode = 'explicit'; au.in.channelInterpretation = 'speakers'; S.stereo.connect(au.out); S.merge.connect(au.out); }
      au.in.gain.value = k(f.intensity, 0, 1);
      off(au.in, S.split); off(au.in, S.stereo); au.in.connect(f.spatialize === false ? S.stereo : S.split);
      const on = f.enabled !== false; au.out.gain.value = on ? 1 : 0; off(au.out, au.c.destination); if (on) au.out.connect(au.c.destination);
      S0.source(n);
    },
    source(n) {   // the source field joins the children at the input; looked at again every frame because the source node may be made after this one
      const au = n._au, s = n.f.source && n.f.source._au ? n.f.source : null; if (!au || au._srcN === s) return;
      if (au._srcN && au._srcN._au) { try { au._srcN._au.out.disconnect(au.in); } catch (e) { /* it was not connected */ } }
      au._srcN = s; if (s) s._au.out.connect(au.in);
    },
    /* the ellipsoid with the sound at one focus is squeezed to a unit sphere; the listener (the origin of view space) is taken into that space. distance < 1 means inside. p is the point,
       back in view space, where the line from the listener towards the sound first meets the ellipsoid (behind the listener when the listener is inside). */
    ellipsoid(M, f, back, front) {
      const T = THREE, loc = V3(f.location);
      if (back === 0 || front === 0) return { distance: 1, p: loc.applyMatrix4(M) };   // X_ITE reads a stale matrix here; the sound's own place is used
      const a = (back + front) / 2, e = a - back, b = Math.sqrt(a * a - e * e), d = V3(f.direction);
      const q = d.lengthSq() > 0 ? new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize()) : new T.Quaternion();
      const sm = M.clone().multiply(new T.Matrix4().makeTranslation(loc.x, loc.y, loc.z)).multiply(new T.Matrix4().makeRotationFromQuaternion(q)).multiply(new T.Matrix4().makeTranslation(0, 0, e)).multiply(new T.Matrix4().makeScale(b, b, a));
      const viewer = new T.Vector3().setFromMatrixPosition(sm.clone().invert()), nrm = new T.Vector3(0, 0, -e / a).sub(viewer).normalize();
      const bq = 2 * viewer.dot(nrm), core = bq * bq - 4 * (viewer.lengthSq() - 1), t = core >= 0 ? Math.min((-bq + Math.sqrt(core)) / 2, (-bq - Math.sqrt(core)) / 2) : 0;
      return { distance: viewer.length(), p: viewer.clone().addScaledVector(nrm, t).applyMatrix4(sm) };
    },
    pan(M, f) {
      if (f.spatialize === false) return { pan: 0.5, rotation: 0 };
      const T = THREE, d = V3(f.direction), ok = d.lengthSq() > 0; if (ok) d.normalize();
      const x = ok && Math.abs(d.y) < 1 ? new T.Vector3(0, 1, 0).cross(d).normalize() : new T.Vector3(1, 0, 0).applyQuaternion(ok ? new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d) : new T.Quaternion());   // X_ITE: the rotation z -> direction, straightened to the y axis, applied to x
      const L = V3(f.location).applyMatrix4(M).normalize(); x.transformDirection(M);
      return { pan: 1 - Math.acos(k(L.x, -1, 1)) / Math.PI, rotation: Math.acos(k(x.x, -1, 1)) / Math.PI };
    },
    place(n, P, dir, M) {
      const S = n._snd, f = n.f; if (!S || !M) return; S0.source(n);
      const max = S0.ellipsoid(M, f, Math.max(f.maxBack, 0), Math.max(f.maxFront, 0)); let g = 0, pan = 0.5, rot = 0;
      if (max.distance < 1) {
        const min = S0.ellipsoid(M, f, Math.max(f.minBack, 0), Math.max(f.minFront, 0)), pr = S0.pan(M, f); pan = pr.pan; rot = pr.rotation;
        g = min.distance < 1 ? 1 : Math.min(max.p.length() / max.p.distanceTo(min.p), 1);
      }
      const pl = 1 - pan * pan, pr = 1 - (1 - pan) * (1 - pan);
      S.stereo.gain.value = g; S.fl.gain.value = g * (1 - rot) * pl; S.fr.gain.value = g * (1 - rot) * pr; S.bl.gain.value = g * rot * pl; S.br.gain.value = g * rot * pr;
      S.gain = g; S.pan = pan; S.rot = rot;
    },
  };
  if (!R.bridge.three.build.Sound) R.bridge.three.build.Sound = (body, n, parent) => BR.specs.get('Sound').build(body, n, parent);

  /* AudioClip: the first url that decodes is held as an AudioBuffer and played by a buffer source from startTime to stopTime (the clock is BR.td, the one the other sound sources use), again
     and again with loop, at pitch times the recorded speed; duration_changed is the length in seconds (-1 until it is known). gain is the source's level (X3D 4.0). */
  BR.node('AudioClip', {
    extend: { AudioClip: { enabled: ['SFBool', IO, true], gain: ['SFFloat', IO, 1], pauseTime: ['SFTime', IO, 0], resumeTime: ['SFTime', IO, 0], isPaused: ['SFBool', OUT, false], elapsedTime: ['SFTime', OUT, 0],
                           duration_changed: ['SFTime', OUT, -1], load: ['SFBool', IO, true] } },
    init: BR.snd.init, receive: BR.snd.receive,
    tick(n, now) {
      const what = BR.td.tick(n, now), au = n._au, C = BR.clip; if (!au) return; const st = BR.td.state(n);
      if (what === 'start') { st.pos = 0; C.play(n, 0); } else if (what === 'pause') { st.pos = C.pos(n); C.halt(n); } else if (what === 'resume') C.play(n, st.pos || 0); else if (what === 'stop') C.halt(n);
      else if (n.f.isActive && n._ended) { n._ended = false; BR.td.end(n, now); C.halt(n); }
    },
  });
  BR.clip = {
    async load(n) {
      const au = n._au, urls = (n.f.url || []).slice(), key = JSON.stringify(urls); if (!au || au._url === key) return; au._url = key; let b = null;
      for (const u of urls) { try { const r = await fetch(BR.resolveUrl(u)); b = await au.c.decodeAudioData(await r.arrayBuffer()); break; } catch (e) { /* the next url */ } }
      if (au._url !== key) return;   // the url changed while this one was loading
      au.buf = b; BR.fire(n, 'duration_changed', b ? b.duration : -1); if (b && n.f.isActive && !au.src) BR.clip.play(n, 0);
    },
    play(n, at) {
      const au = n._au, f = n.f; if (!au) return; BR.clip.halt(n); if (!au.buf) return;
      const s = au.c.createBufferSource(), rate = f.pitch > 0 ? f.pitch : 1; s.buffer = au.buf; s.loop = !!f.loop; s.playbackRate.value = rate; s.connect(au.out);
      s.onended = () => { if (au.src === s) { au.src = null; n._ended = true; } };
      au.t0 = au.c.currentTime - at / rate; au.src = s; s.start(0, at % au.buf.duration);
    },
    halt(n) { const au = n._au; if (au && au.src) { const s = au.src; au.src = null; s.onended = null; try { s.stop(); s.disconnect(); } catch (e) { /* not started */ } } },
    pos: (n) => { const au = n._au; return au && au.src ? (au.c.currentTime - au.t0) * (n.f.pitch > 0 ? n.f.pitch : 1) : 0; },
  };
  BR.snd.types.AudioClip = {
    source: true,
    apply(n) { const au = n._au, f = n.f; if (!au) return; au.out.gain.value = f.gain; if (f.load !== false) BR.clip.load(n); if (au.src) { au.src.playbackRate.value = f.pitch > 0 ? f.pitch : 1; au.src.loop = !!f.loop; } },
  };
}
