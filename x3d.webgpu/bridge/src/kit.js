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
