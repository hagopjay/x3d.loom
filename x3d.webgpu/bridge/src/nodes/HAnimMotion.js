/* HAnimMotion (HAnim level 2): frame by frame playback of motion data (BVH style channels) onto the joints of the HAnimHumanoid that lists the motion in `motions`.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written and follows X_ITE 16.6.0 where the standard is silent (see bridge/knowledge/HANIM-FINDINGS.md):
     channels      "N chan chan ..., N chan ..." one group per entry of `joints`; names Xposition .. Zscale, the number is the channel count of the group. Rotation channels are Euler angles in
                   degrees, composed in the order the channels appear (a group with fewer than three rotation channels is padded with the missing axes in X Y Z order)
     values        frameCount x (all channels) numbers; frameCount = floor(values / channels), written to the output field frameCount
     playback      a TimeSensor-like cycle of (frameCount - 1) * frameDuration seconds over the fraction range startFrame .. endFrame, started at load and by enabled TRUE, driving the joints
                   through a linear (position, scale) or slerp (rotation) interpolation between the frames; frameIndex poses the joints at one frame while the motion is not playing
   Joints are found by name among the humanoid's `joints` list ("HumanoidRoot" is also humanoid_root, a joint named IGNORED is skipped). */
{
const H = (BR.hanim ||= {});

// the gl-matrix Euler to quaternion formulas (MIT), one per axis order: the order a BVH channel list has is the order the rotations compose in
H.euler = (x, y, z, order) => {
  x /= 2; y /= 2; z /= 2;
  const sx = Math.sin(x), sy = Math.sin(y), sz = Math.sin(z), cx = Math.cos(x), cy = Math.cos(y), cz = Math.cos(z);
  switch (order) {
    case 'ZYX': return [sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
    case 'YXZ': return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
    case 'ZXY': return [sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz];
    case 'YZX': return [sx * cy * cz + cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz - sx * sy * sz];
    case 'XZY': return [sx * cy * cz - cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz + sx * sy * sz];
    default: return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz];      // XYZ
  }
};
const fract = (x) => x - Math.floor(x), clampN = (x, a, b) => Math.min(Math.max(x, a), b);
const words = (s) => String(s).replace(/^[\s,]+|[\s,]+$/g, '').split(/[\s,]+/).filter((w) => w.length);
H.motionJoints = (s) => String(s).replace(/^[\s,]+|[\s,]+$/g, '').split(/[\s,]+/);      // an empty string is one empty name, as the reference does
H.motionChannels = (s) => String(s).replace(/^[\s,\d]+|[\s,\d]+$/g, '').split(/[\s,]+\d+[\s,]+/).map((g) => words(g));

/* the animation tables: per joint { translation, rotation, scale } each { k: [key], v: [value] } (rotation values are quaternions x y z w); frameCount */
H.motionTables = (n) => {
  const chan = H.motionChannels(n.f.channels), vals = n.f.values, total = chan.reduce((a, c) => a + c.length, 0);
  const fc = Math.floor(total ? vals.length / total : 0), tabs = chan.map(() => ({}));
  for (let frame = 0, v = 0; frame < fc; frame++) {
    const key = frame / (fc - 1);
    for (let j = 0; j < chan.length; j++) {
      let P = [0, 0, 0], pc = false, E = [0, 0, 0], ord = '', S = [1, 1, 1], sc = false;
      for (const c of chan[j]) {
        const ax = 'XYZ'.indexOf(c[0]), kind = c.slice(1);
        if (ax >= 0 && kind === 'position') { pc = true; P[ax] = vals[v++]; }
        else if (ax >= 0 && kind === 'rotation') { ord += c[0]; E[ax] = vals[v++] * Math.PI / 180; }
        else if (ax >= 0 && kind === 'scale') { sc = true; S[ax] = vals[v++]; }
        else v++;
      }
      const t = tabs[j];
      if (pc) { const a = (t.translation ||= { k: [], v: [] }); a.k.push(key); a.v.push(P); }
      if (ord.length) {
        const a = (t.rotation ||= { k: [], v: [] });
        if (ord.length < 3) { for (const o of 'XYZ') if (!ord.includes(o)) ord += o; }
        else if (ord.length > 3) ord = ord.slice(0, 3);
        a.k.push(key); a.v.push(H.euler(E[0], E[1], E[2], ord));
      }
      if (sc) { const a = (t.scale ||= { k: [], v: [] }); a.k.push(key); a.v.push(S); }
    }
  }
  return { fc, tabs };
};
H.motionSample = (tab, name, f) => {
  const ks = BR.keySearch(tab.k, f); if (!ks) return null;
  const a = tab.v[ks[0]], b = tab.v[ks[1]], w = ks[2];
  if (name === 'rotation') return BR.q.toRot(BR.q.slerp(a, b, w));
  return a.map((x, i) => x + (b[i] - x) * w);
};

/* the joints a motion drives: the humanoid that lists it (and has not switched it off in motionsEnabled), joints found by name */
H.motionTarget = (n) => {
  const h = n._hm.h; if (!h) return null;
  const i = h.f.motions.indexOf(n), en = h.f.motionsEnabled || [];
  if (i < 0 || (i < en.length && !en[i])) return null;
  const idx = new Map();
  for (const j of h.f.joints) if (j && j.type === 'HAnimJoint') idx.set(String(j.f.name).trim(), j);
  idx.delete('IGNORED'); idx.set('HumanoidRoot', idx.get('humanoid_root'));
  return idx;
};

H.motionApply = (n, frac) => {
  const st = n._hm; st.lastFrac = frac;
  const idx = H.motionTarget(n); if (!idx || !st.tabs) return;
  const names = H.motionJoints(n.f.joints), en = n.f.channelsEnabled || [];
  for (let j = 0; j < st.tabs.length; j++) {
    if (j < en.length && !en[j]) continue;
    const jn = idx.get(names[j]); if (!jn) continue;
    for (const name of ['translation', 'rotation', 'scale']) {
      const tab = st.tabs[j][name]; if (!tab) continue;
      const v = H.motionSample(tab, name, frac); if (v) receive(jn, name, v);
    }
  }
};

// the TimeSensor range of the motion: fraction at start, first and last fraction of the play range
const range = (n) => {
  const st = n._hm, fc = st.fc, f = n.f;
  const a = clampN(f.startFrame, 0, fc), b = clampN(f.endFrame, 0, fc);
  st.startFrame = Math.min(a, b); st.endFrame = Math.max(a, b);
  st.r1 = fc > 1 ? st.startFrame / (fc - 1) : 0; st.r2 = fc > 1 ? st.endFrame / (fc - 1) : 0;
};
const cycleInterval = (n) => (n._hm.fc > 1 ? (n._hm.fc - 1) * Math.max(n.f.frameDuration, 0) : 0);
const setRange = (n, fraction0, first, last, now) => {            // TimeSensor.setRange without the start offset
  const st = n._hm, ci = cycleInterval(n);
  st.first = clampN(first, 0, 1); st.last = clampN(last, 0, 1); st.scale = st.last - st.first; st.interval = ci * st.scale;
  st.fraction = fract(fraction0); st.cycle = now - (st.fraction - st.first) * ci;
};
const getFraction = (st, time) => st.first + (st.interval ? fract((time - st.cycle) / st.interval) : 0) * st.scale;
const emit = (n, field, v) => { n.f[field] = v; events.emit(n, field, v); };

H.motionRebuild = (n, now) => {
  const st = n._hm, t = H.motionTables(n);
  st.tabs = t.tabs; st.fc = t.fc; st.lastFrac = 0;
  // the reference resets these three here: values written in the file for frameIndex, startFrame and endFrame are overwritten at load
  n.f.frameIndex = 0; n.f.startFrame = 0; n.f.endFrame = Math.max(t.fc - 1, 0); range(n); st.r0 = 0;
  emit(n, 'frameIndex', 0); emit(n, 'startFrame', 0); emit(n, 'endFrame', n.f.endFrame); emit(n, 'frameCount', t.fc);
};
const poseFrame = (n) => {      // frameIndex changed: remember the fraction, and pose the joints when the motion is not playing
  const st = n._hm, fc = st.fc, fraction = fc > 1 ? clampN(n.f.frameIndex, 0, fc) / (fc - 1) : 0;
  st.r0 = fraction;
  if (!st.active) H.motionApply(n, fraction);
};
const start = (n, now) => {
  const st = n._hm; if (st.active || !n.f.frameIncrement) return;
  st.active = true; setRange(n, st.r0, st.r1, st.r2, now);
  st.t0 = now; emit(n, 'cycleTime', now); emit(n, 'elapsedTime', 0);
  H.motionApply(n, st.fraction);
};
const stop = (n) => { n._hm.active = false; };

BR.node('HAnimMotion', {
  component: 'HAnim', level: 2,
  container: 'motions',
  defs: {
    channels: ['SFString', IO, ''],
    channelsEnabled: ['MFBool', IO, []],
    cycleTime: ['SFTime', OUT, 0],
    description: ['SFString', IO, ''],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    endFrame: ['SFInt32', IO, 0],
    frameCount: ['SFInt32', OUT, 0],
    frameDuration: ['SFTime', IO, 0.1],
    frameIncrement: ['SFInt32', IO, 1],
    frameIndex: ['SFInt32', IO, 0],
    joints: ['SFString', IO, ''],
    loa: ['SFInt32', IO, -1],
    loop: ['SFBool', IO, false],
    metadata: ['SFNode', IO, null],
    name: ['SFString', IO, ''],
    next: ['SFBool', IN, false],
    previous: ['SFBool', IN, false],
    startFrame: ['SFInt32', IO, 0],
    values: ['MFFloat', IO, []],
  },
  init(n, world) {
    n._hm = { h: world.nodes.find((x) => x.type === 'HAnimHumanoid' && x.f.motions.includes(n)) || null, active: false, started: false, fc: 0, lastFrac: 0, r0: 0, r1: 0, r2: 0, stopped: false };
    H.motionRebuild(n, 0);
  },
  receive(n, field, v) {
    const st = n._hm; if (!st) return false;
    const now = events.ts || (performance.timeOrigin + performance.now()) / 1000;
    switch (field) {
      case 'channels': case 'values': n.f[field] = Array.isArray(v) || typeof v === 'string' ? v : Array.from(v); events.emit(n, field, n.f[field]); H.motionRebuild(n, now); return true;
      case 'joints': case 'channelsEnabled': return false;
      case 'enabled':
        n.f.enabled = !!v; events.emit(n, 'enabled', !!v);
        if (v) { st.stopped = false; start(n, now); } else { if (st.active) stop(n); st.stopped = true; }
        return true;
      case 'loop': n.f.loop = !!v; events.emit(n, 'loop', !!v); if (v && n.f.enabled && !st.stopped && n.f.frameIncrement) start(n, now); return true;
      case 'frameIncrement': n.f.frameIncrement = v | 0; events.emit(n, 'frameIncrement', v | 0); if (!n.f.frameIncrement) stop(n); else if (n.f.loop && n.f.enabled && !st.stopped) start(n, now); return true;
      case 'frameDuration':
        n.f.frameDuration = +v; events.emit(n, 'frameDuration', +v);
        if (st.active) { const fr = st.fraction; setRange(n, fr, st.r1, st.r2, now); }
        return true;
      case 'startFrame': case 'endFrame':
        n.f[field] = v | 0; events.emit(n, field, v | 0); range(n);
        if (st.active) { setRange(n, st.r0, st.r1, st.r2, now); st.fraction = getFraction(st, now); H.motionApply(n, st.fraction); }
        return true;
      case 'frameIndex': n.f.frameIndex = v | 0; events.emit(n, 'frameIndex', v | 0); poseFrame(n); return true;
      case 'next': case 'previous': {
        if (!v) return true;
        const dir = field === 'next' ? 1 : -1, fc = st.fc, idx = (fc > 1 ? Math.floor(st.lastFrac * (fc - 1)) : 0) + n.f.frameIncrement * dir;
        let to;
        if (idx > st.endFrame) { if (!n.f.loop) return true; to = st.startFrame; }
        else if (idx < st.startFrame) { if (!n.f.loop) return true; to = st.endFrame; }
        else to = idx;
        n.f.frameIndex = to; events.emit(n, 'frameIndex', to); poseFrame(n);
        return true;
      }
    }
    return false;
  },
  tick(n, now) {
    const st = n._hm; if (!st) return;
    if (!st.started) { st.started = true; if (n.f.enabled && n.f.frameIncrement && st.tabs) start(n, now); return; }     // the reference starts every enabled motion at load
    if (!st.active) return;
    emit(n, 'elapsedTime', now - st.t0);
    if (now - st.cycle >= st.interval) {
      if (n.f.loop && st.interval) { st.cycle += st.interval * Math.floor((now - st.cycle) / st.interval); emit(n, 'cycleTime', now); st.fraction = getFraction(st, now); }
      else { st.fraction = st.last; H.motionApply(n, st.fraction); stop(n); return; }
    } else st.fraction = getFraction(st, now);
    H.motionApply(n, st.fraction);
  },
});
}
