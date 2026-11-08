/* Bridge kit: one registry for the nodes the bridge adds, so each node is a single file (bridge/src/nodes/<Node>.js) and nothing in the older reader files changes.
   Concatenated after brain/reader.js and its extensions inside the same bundle scope (DEFS, PARSE, FLAT, CONTAINER, IO, IN, OUT, INIT, events, receive, parseX3D, R are visible).
   A node file calls BR.node(name, spec); spec may carry:
     defs        the field table, same shape as DEFS (generated from X3DUOM 4.0 by bridge/tools/driver.py scaffold)
     container   the default containerField
     extend      { ExistingNode: { newField: [...] } } fields added to nodes other ports defined
     flat        { 'Node.field': Float32Array|Int32Array } big arrays kept as typed arrays
     init(n, world)           once per parsed world, after the ROUTEs are wired
     receive(n, field, v)     an event arrives; return true when it is handled here (the stock handler is skipped)
     tick(n, now)             once per timestamp, before the event queue drains (sensors that poll, followers that move)
     build(body, n, parent, chain)   Babylon side: make what the node draws; return the record body.rec keeps
     geometry(g, body)        Babylon side: vertex data for a geometry node, same shape Body.geometryData returns
     changed(body, n, field)  Babylon side: a field changed after build
   The kit never touches a node type it does not own, so every earlier port parses and runs as before. */
const BR = (R.bridge = { specs: new Map(), tickers: new Set(), worlds: [], version: 1 });

// field types the older readers never needed (X3DUOM names them): plain number lists, the parsers the generated tables name
const _nums = (s) => numList(s);
for (const t of ['SFVec2d', 'SFVec3d', 'SFVec4d', 'SFMatrix3f', 'SFMatrix3d', 'SFMatrix4f', 'SFMatrix4d']) {
  const k = { SFVec2d: 2, SFVec3d: 3, SFVec4d: 4, SFMatrix3f: 9, SFMatrix3d: 9, SFMatrix4f: 16, SFMatrix4d: 16 }[t];
  if (!PARSE[t]) PARSE[t] = fixed(k, new Array(k).fill(0));
}
if (!PARSE.MFVec2d) PARSE.MFVec2d = (s) => chunk(_nums(s), 2);
if (!PARSE.MFVec3d) PARSE.MFVec3d = (s) => chunk(_nums(s), 3);
if (!PARSE.MFVec4d) PARSE.MFVec4d = (s) => chunk(_nums(s), 4);
if (!PARSE.MFDouble) PARSE.MFDouble = _nums;
if (!PARSE.MFBool) PARSE.MFBool = (s) => String(s).replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean).map((t) => /^true$/i.test(t));
if (!PARSE.MFMatrix3f) PARSE.MFMatrix3f = (s) => chunk(_nums(s), 9);
if (!PARSE.MFMatrix4f) PARSE.MFMatrix4f = (s) => chunk(_nums(s), 16);
if (!PARSE.SFImage) PARSE.SFImage = (s) => _nums(String(s).replace(/0x[0-9a-f]+/gi, (h) => parseInt(h, 16)));

BR.node = function (name, spec) {
  if (BR.specs.has(name)) throw new Error('bridge: ' + name + ' is registered twice');
  BR.specs.set(name, spec);
  if (spec.defs) {
    if (DEFS[name]) throw new Error('bridge: ' + name + ' is already in the reader; extend it instead');
    DEFS[name] = spec.defs; if (!spec.defs.metadata) DEFS[name].metadata = ['SFNode', IO, null];
    // Material-like and texture-like children join a parent through the node's containerField
    CONTAINER[name] = spec.container || 'children';
  }
  for (const [t, extra] of Object.entries(spec.extend || {})) Object.assign(DEFS[t], extra);
  Object.assign(FLAT, spec.flat || {});
  return spec;
};
BR.fieldOr = (n, f, d) => (n.f[f] === undefined ? d : n.f[f]);
BR.emit = (n, field, value) => { n.f[field] = value; events.emit(n, field, value); };   // an output event raised by a bridge node

// every parsed world registers its bridge nodes: init once, then tick each timestamp
const _parse = parseX3D;
parseX3D = function (text) {
  const w = _parse(text);
  BR.worlds.push(w);
  for (const n of w.nodes) { const s = BR.specs.get(n.type); if (!s) continue; if (s.tick) BR.tickers.add(n); }
  for (const n of w.nodes) { const s = BR.specs.get(n.type); if (s && s.init) s.init(n, w); }
  return w;
};
R.parseX3D = parseX3D;

const _recv = receive;
receive = function (node, field, value) {
  const s = BR.specs.get(node.type);
  if (s && s.receive && s.receive(node, field, value) === true) return;
  return _recv(node, field, value);
};
R.receive = receive;

const _drain = events.drain;
events.drain = function () {
  if (BR.tickers.size) for (const n of BR.tickers) {
    if (n._tickTs === this.ts) continue;     // SAI sets call drain several times in one timestamp; a tick runs once per timestamp
    n._tickTs = this.ts; BR.specs.get(n.type).tick(n, this.ts);
  }
  return _drain.call(this);
};

/* key/keyValue lookup shared by the interpolators before the first key and after the last the end values hold; a zero-width span steps */
BR.lerpKeys = (k, kv, frac, mix) => {
  const N = Math.min(k.length, kv.length);
  if (!N) return null;
  if (frac <= k[0]) return clone(kv[0]);
  if (frac >= k[N - 1]) return clone(kv[N - 1]);
  let i = 0; while (i < N - 1 && frac >= k[i + 1]) i++;
  const j = Math.min(i + 1, N - 1), span = k[j] - k[i];
  return mix(kv[i], kv[j], span > 0 ? (frac - k[i]) / span : 0);
};

/* ---- shared interpolation math ---------------------------------------------------------------------------------------------------------
   keySearch: X3DInterpolatorNode's rule for set_fraction: [index0, index1, weight]; the end values hold outside the key range, a single key holds always. */
BR.keySearch = (key, f) => {
  const N = key.length;
  if (!N) return null;
  if (N === 1) return [0, 0, 0];
  if (f <= key[0]) return [0, 1, 0];
  if (f >= key[N - 1]) return [N - 2, N - 1, 1];
  let i = 0; while (i < N - 2 && f >= key[i + 1]) i++;
  const span = key[i + 1] - key[i];
  return [i, i + 1, span > 0 ? (f - key[i]) / span : 0];
};
{
  const vsub = (a, b) => a.map((x, i) => x - b[i]), vscale = (a, s) => a.map((x) => x * s), vlen = (a) => Math.hypot(...a);
  /* Catmull-Rom tangents for a Hermite spline over n-vectors (SplinePositionInterpolator, ...2D, SplineScalarInterpolator as 1-vectors):
     T[i] = (P[i+1] - P[i-1]) / 2 unless keyVelocity is given; closed wraps the ends; the key spacing scales the two sides (F-); normalizeVelocity rescales given velocities by the path length. */
  BR.splineGen = (closed, key, kv, kvel, normalize) => {
    const n = key.length, T0 = [], T1 = [];
    if (n < 2) { const z = (kv[0] || [0]).map(() => 0); return { T0: [z], T1: [z] }; }
    const Z = () => kv[0].map(() => 0); let T = [];
    if (!kvel.length) {
      T.push(closed ? vscale(vsub(kv[1], kv[kv.length - 2]), 0.5) : Z());
      for (let i = 1; i < kv.length - 1; i++) T.push(vscale(vsub(kv[i + 1], kv[i - 1]), 0.5));
      T.push(T[0].slice());
    } else {
      T = kvel.map((v) => v.slice());
      if (normalize) {
        let D = 0; for (let i = 0; i < kv.length - 1; i++) D += vlen(vsub(kv[i], kv[i + 1]));
        for (let i = 0; i < T.length - 1; i++) { const m = vlen(T[i]); if (m) T[i] = vscale(T[i], D / m); }
      }
    }
    const Fm = [], Fp = [];
    if (closed) { const a = n - 1, b = n - 2, d = key[1] - key[0] + key[a] - key[b]; Fm.push(2 * (key[1] - key[0]) / d); Fp.push(2 * (key[a] - key[b]) / d); }
    else { Fm.push(1); Fp.push(1); }
    for (let i = 1; i < n - 1; i++) { const d = key[i + 1] - key[i - 1]; Fm.push(2 * (key[i + 1] - key[i]) / d); Fp.push(2 * (key[i] - key[i - 1]) / d); }
    Fm.push(Fm[0]); Fp.push(Fp[0]);
    for (let i = 0; i < T.length; i++) { T0.push(vscale(T[i], Fp[i] ?? 1)); T1.push(vscale(T[i], Fm[i] ?? 1)); }
    return { T0, T1 };
  };
  BR.splineAt = (sp, i0, i1, t, kv) => {      // cubic Hermite basis on P[i0], P[i1], T0[i0], T1[i1]
    const t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h01 = -2 * t3 + 3 * t2, h10 = t3 - 2 * t2 + t, h11 = t3 - t2;
    return kv[i0].map((_, c) => h00 * kv[i0][c] + h01 * kv[i1][c] + h10 * sp.T0[i0][c] + h11 * sp.T1[i1][c]);
  };
  /* the node-level driver for the three spline nodes: pads keyValue/keyVelocity to the key count, caches the tangents until a field changes, returns the interpolated vector */
  BR.splineNode = (n, frac, wrap, unwrap) => {
    const f = n.f, key = f.key; if (!key.length) return null;
    let kv = Array.from(f.keyValue, wrap); if (!kv.length) return null;
    const dflt = kv[kv.length - 1].map(() => 0);
    while (kv.length < key.length) kv.push(kv[kv.length - 1].slice());
    let kvel = Array.from(f.keyVelocity, wrap); if (kvel.length) while (kvel.length < key.length) kvel.push(dflt.slice());
    const stamp = [f.keyValue, f.keyVelocity, f.key, f.closed, f.normalizeVelocity];
    if (!n._sp || n._spStamp.some((x, i) => x !== stamp[i])) { n._sp = BR.splineGen(f.closed, key, kv, kvel, f.normalizeVelocity); n._spStamp = stamp; n._spKv = kv; }
    const ks = BR.keySearch(key, frac); if (!ks) return null;
    return unwrap(BR.splineAt(n._sp, ks[0], ks[1], ks[2], n._spKv));
  };
  BR.wrap1 = (x) => [x]; BR.unwrap1 = (a) => a[0]; BR.wrapN = (v) => Array.from(v); BR.unwrapN = (a) => a;

  /* quaternions [x, y, z, w]: log / exp / spline for SQUAD, and a slerp that goes the short way round (the reader's quat.slerp falls back to a normalised lerp very near parallel) */
  const qmul = quat.mul, qdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], qneg = (a) => a.map((x) => -x), qinv = (a) => [-a[0], -a[1], -a[2], a[3]];
  const qlog = (q) => { const v = Math.hypot(q[0], q[1], q[2]), m = Math.hypot(v, q[3]); if (v < 1e-12) return [0, 0, 0, Math.log(m)]; const k = Math.acos(clamp(q[3] / m, -1, 1)) / v; return [q[0] * k, q[1] * k, q[2] * k, Math.log(m)]; };
  const qexp = (q) => { const v = Math.hypot(q[0], q[1], q[2]), e = Math.exp(q[3]); if (v < 1e-12) return [0, 0, 0, e]; const k = e * Math.sin(v) / v; return [q[0] * k, q[1] * k, q[2] * k, e * Math.cos(v)]; };
  const qslerp = (a, b, t, short = true) => {
    let c = qdot(a, b); if (short && c < 0) { c = -c; b = qneg(b); }
    if (c >= 1) return a.slice();
    const w = Math.acos(c), s = Math.sin(w); if (s < 1e-12) return a.map((x, i) => x + (b[i] - x) * t);
    const s0 = Math.sin((1 - t) * w) / s, s1 = Math.sin(t * w) / s; return a.map((x, i) => x * s0 + b[i] * s1);
  };
  const qnorm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
  const qspline = (q0, q1, q2) => {            // the control quaternion s_i of SQUAD: q1 * exp(-(log(q1^-1 q0) + log(q1^-1 q2)) / 4), neighbours put in q1's hemisphere
    if (qdot(q0, q1) < 0) q0 = qneg(q0); if (qdot(q2, q1) < 0) q2 = qneg(q2);
    const i = qinv(q1), a = qlog(qmul(i, q0)), b = qlog(qmul(i, q2));
    return qnorm(qmul(q1, qexp(a.map((x, k) => -(x + b[k]) / 4))));
  };
  BR.squadGen = (closed, key, kv) => {
    const n = key.length, s = [];
    if (n > 1) {
      s.push(closed ? qspline(kv[n - 2], kv[0], kv[1]) : kv[0].slice());
      for (let i = 1; i < n - 1; i++) s.push(qspline(kv[i - 1], kv[i], kv[i + 1]));
      s.push(closed ? qspline(kv[n - 2], kv[n - 1], kv[1]) : kv[n - 1].slice());
    } else if (n) s.push(kv[0].slice());
    return s;
  };
  BR.squadAt = (s, i0, i1, t, kv) => qslerp(qslerp(kv[i0], kv[i1], t), qslerp(s[i0], s[i1], t), 2 * t * (1 - t));
  BR.q = { fromRot: (r) => quat.fromAxisAngle(r, r[3]), toRot: (q) => quat.toAxisAngle(q), slerp: qslerp };
}

/* ---- followers (Followers component) ------------------------------------------------------------------------------------------------------
   T converts a node value to an array and back: scalars become [x], vectors stay arrays. Chaser: the 60-stage buffer with a cosine step response over `duration`;
   Damper: `order` cascaded exponential filters with time constant `tau`. Both are driven by the timestamp (tick), not by a frame count, so a slow frame does not slow them. */
BR.T1 = { toA: (v) => [v], fromA: (a) => a[0] };
BR.TN = { toA: (v) => Array.from(v), fromA: (a) => a.slice() };
{
  const lerp = (a, b, w) => a.map((x, i) => x + (b[i] - x) * w), dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i])), cp = (a) => a.slice();
  const setActive = (n, on) => { const st = n._fl; if (st.active === on) return; st.active = on; n.f.isActive = on; events.emit(n, 'isActive', on); };
  const out = (T, n, a) => { n.f.value_changed = T.fromA(a); events.emit(n, 'value_changed', n.f.value_changed); };
  BR.chaserSpec = (T) => ({
    init(n) {
      const f = n.f, iv = T.toA(f.initialValue), id = T.toA(f.initialDestination);
      const st = (n._fl = { buf: [cp(id)], prev: cp(iv), dest: cp(id), endTime: null, active: false });
      for (let i = 1; i < 60; i++) st.buf.push(cp(iv));
      if (dist(id, iv) < 1e-8) f.value_changed = T.fromA(id); else { st.active = true; f.isActive = true; }
    },
    receive(n, field, v) {
      const st = n._fl; if (!st) return false;
      if (field === 'set_value') { if (!st.active) st.endTime = events.ts; const a = T.toA(v); st.buf = st.buf.map(() => cp(a)); st.prev = cp(a); out(T, n, a); setActive(n, true); return true; }
      if (field === 'set_destination') { st.dest = T.toA(v); if (!st.active) st.endTime = events.ts; setActive(n, true); return true; }
      return false;
    },
    tick(n, now) {
      const st = n._fl; if (!st || !st.active) return;
      if (st.endTime === null) st.endTime = now;
      const NB = 60, dur = Math.max(n.f.duration, 1e-9), stepTime = dur / NB;
      const resp = (t) => (t <= 0 ? 0 : t >= dur ? 1 : 0.5 - 0.5 * Math.cos((t / dur) * Math.PI));
      let fr = (now - st.endTime) / stepTime;
      if (fr >= 1) {
        const s = Math.floor(fr); fr -= s;
        if (s < NB) {
          st.prev = cp(st.buf[NB - s]);
          for (let i = NB - 1; i >= s; --i) st.buf[i] = cp(st.buf[i - s]);
          for (let i = 0; i < s; ++i) st.buf[i] = lerp(st.dest, st.buf[s], i / s);
        } else { st.prev = cp(s === NB ? st.buf[0] : st.dest); for (let i = 0; i < NB; ++i) st.buf[i] = cp(st.dest); }
        st.endTime += s * stepTime;
      }
      let o = lerp(st.prev, st.buf[NB - 1], resp((NB - 1 + fr) * stepTime));
      for (let i = NB - 2; i >= 0; --i) { const r = resp((i + fr) * stepTime); o = o.map((x, c) => x + (st.buf[i][c] - st.buf[i + 1][c]) * r); }
      out(T, n, o);
      if (dist(o, st.dest) < 1e-8) setActive(n, false);
    },
  });
  BR.damperSpec = (T) => ({
    init(n) {
      const f = n.f, iv = T.toA(f.initialValue), id = T.toA(f.initialDestination), order = clamp(f.order, 0, 5);
      const st = (n._fl = { buf: [cp(id)], active: false, last: null });
      for (let i = 1; i <= order; i++) st.buf.push(cp(iv));
      if (dist(id, iv) < (f.tolerance < 0 ? 1e-4 : f.tolerance)) f.value_changed = T.fromA(id); else { st.active = true; f.isActive = true; }
    },
    receive(n, field, v) {
      const st = n._fl; if (!st) return false;
      if (field === 'set_value') { const a = T.toA(v); for (let i = 1; i < st.buf.length; i++) st.buf[i] = cp(a); if (!st.active) st.last = events.ts; out(T, n, a); setActive(n, true); return true; }
      if (field === 'set_destination') { st.buf[0] = T.toA(v); if (!st.active) st.last = events.ts; setActive(n, true); return true; }
      return false;
    },
    tick(n, now) {
      const st = n._fl; if (!st || !st.active) return;
      const f = n.f, want = clamp(f.order, 0, 5) + 1, tol = f.tolerance < 0 ? 1e-4 : f.tolerance;
      while (st.buf.length < want) st.buf.push(cp(st.buf[st.buf.length - 1])); st.buf.length = want;
      let order = want - 1;
      if (f.tau) {
        const dt = st.last == null ? 1 / 60 : Math.max(0, now - st.last); st.last = now; const alpha = Math.exp(-dt / f.tau);
        for (let i = 0; i < order; i++) st.buf[i + 1] = lerp(st.buf[i], st.buf[i + 1], alpha);
        out(T, n, st.buf[order]);
        if (dist(st.buf[order], st.buf[0]) >= tol) return;
      } else { out(T, n, st.buf[0]); order = 0; }
      for (let i = 1; i < st.buf.length; i++) st.buf[i] = cp(st.buf[order]);
      setActive(n, false);
    },
  });
}

/* every node can carry a metadata child (19775-1 7.2.2 X3DNode.metadata): add the field to the older tables that lack it */
for (const t of Object.keys(DEFS)) if (!DEFS[t].metadata) DEFS[t].metadata = ['SFNode', IO, null];
