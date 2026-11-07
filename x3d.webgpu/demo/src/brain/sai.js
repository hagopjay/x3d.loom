/* A small Scene Access Interface over the reader's nodes and the Babylon body.
   It speaks the subset of X_ITE's browser API that the Neural Canvas page uses (getNamedNode, rootNodes, createNode, addRoute, createX3DFromString,
   field get/set with SFColor / SFVec3f / SFRotation / MFString values, addFieldCallback, set_bind, whichChoice, children), so the page's own code runs unchanged.
   Nothing here draws; every change goes to the body through R.hooks.changed. */

(function () {
  class SFColor { constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; } getTypeName() { return 'SFColor'; } toString() { return `${this.r} ${this.g} ${this.b}`; } }
  class SFColorRGBA { constructor(r = 0, g = 0, b = 0, a = 1) { this.r = r; this.g = g; this.b = b; this.a = a; } getTypeName() { return 'SFColorRGBA'; } }
  class SFVec2f { constructor(x = 0, y = 0) { this.x = x; this.y = y; } getTypeName() { return 'SFVec2f'; } toString() { return `${this.x} ${this.y}`; } }
  class SFVec3f { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } getTypeName() { return 'SFVec3f'; } toString() { return `${this.x} ${this.y} ${this.z}`; } }
  class SFVec4f { constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; } getTypeName() { return 'SFVec4f'; } }
  class SFRotation { constructor(x = 0, y = 0, z = 1, angle = 0) { this.x = x; this.y = y; this.z = z; this.angle = angle; } getTypeName() { return 'SFRotation'; } toString() { return `${this.x} ${this.y} ${this.z} ${this.angle}`; } }
  class MFList extends Array { getTypeName() { return this._t; } }
  const mf = (t, a) => { const l = new MFList(); l._t = t; for (const x of a) l.push(x); return l; };
  function MFColor(...a) { return mf('MFColor', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }
  function MFColorRGBA(...a) { return mf('MFColorRGBA', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }
  function MFVec3f(...a) { return mf('MFVec3f', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }
  function MFVec2f(...a) { return mf('MFVec2f', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }
  function MFFloat(...a) { return mf('MFFloat', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }
  function MFInt32(...a) { return mf('MFInt32', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }
  function MFString(...a) { return mf('MFString', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }
  function MFNode(...a) { return mf('MFNode', a.length === 1 && Array.isArray(a[0]) ? a[0] : a); }

  const wrappers = new WeakMap(), rawOf = new WeakMap();
  let BODY = null, WORLD = null, MAINSCENE = null;

  const isTyped = (v) => ArrayBuffer.isView(v);
  function toSAI(type, v) {
    switch (type) {
      case 'SFColor': return new SFColor(v[0], v[1], v[2]);
      case 'SFVec2f': return new SFVec2f(v[0], v[1]);
      case 'MFVec2f': return mf('MFVec2f', Array.from(v, (c) => new SFVec2f(c[0], c[1])));
      case 'SFVec3f': return new SFVec3f(v[0], v[1], v[2]);
      case 'SFVec4f': return new SFVec4f(v[0], v[1], v[2], v[3]);
      case 'SFRotation': return new SFRotation(v[0], v[1], v[2], v[3]);
      case 'MFColor': { const o = []; if (isTyped(v)) for (let i = 0; i + 2 < v.length; i += 3) o.push(new SFColor(v[i], v[i + 1], v[i + 2])); else for (const c of v) o.push(new SFColor(c[0], c[1], c[2])); return mf('MFColor', o); }
      case 'MFVec3f': { const o = []; if (isTyped(v)) for (let i = 0; i + 2 < v.length; i += 3) o.push(new SFVec3f(v[i], v[i + 1], v[i + 2])); else for (const c of v) o.push(new SFVec3f(c[0], c[1], c[2])); return mf('MFVec3f', o); }
      case 'SFColorRGBA': return new SFColorRGBA(v[0], v[1], v[2], v[3]);
      case 'MFColorRGBA': { const o = []; for (const c of v) o.push(new SFColorRGBA(c[0], c[1], c[2], c[3])); return mf('MFColorRGBA', o); }
      case 'MFString': return mf('MFString', v);
      case 'MFFloat': case 'MFInt32': case 'MFTime': return Array.from(v);
      case 'SFNode': return v ? wrap(v) : null;
      case 'MFNode': return mfNode(v);
      default: return v;
    }
  }
  const flat3 = (a) => { const o = []; for (const c of a) o.push(c.r ?? c.x ?? c[0], c.g ?? c.y ?? c[1], c.b ?? c.z ?? c[2]); return o; };
  function fromSAI(type, v, cur) {
    switch (type) {
      case 'SFColor': return Array.isArray(v) ? v : [v.r, v.g, v.b];
      case 'SFVec2f': return [v.x, v.y];
      case 'SFVec3f': return Array.isArray(v) ? v : [v.x, v.y, v.z];
      case 'SFVec4f': return [v.x, v.y, v.z, v.w];
      case 'SFColorRGBA': return Array.isArray(v) ? v : [v.r, v.g, v.b, v.a];
      case 'MFColorRGBA': return Array.from(v, (c) => [c.r, c.g, c.b, c.a]);
      case 'MFVec2f': return Array.from(v, (c) => [c.x, c.y]);
      case 'SFRotation': return Array.isArray(v) ? v : [v.x, v.y, v.z, v.angle];
      case 'MFColor': case 'MFVec3f': { const f = flat3(v); if (isTyped(cur)) return Float32Array.from(f); const o = []; for (let i = 0; i + 2 < f.length; i += 3) o.push([f[i], f[i + 1], f[i + 2]]); return o; }
      case 'MFString': return Array.from(v, String);
      case 'MFFloat': case 'MFInt32': case 'MFTime': return isTyped(cur) ? (cur instanceof Int32Array ? Int32Array.from(v) : Float32Array.from(v)) : Array.from(v);
      case 'SFNode': return v ? unwrap(v) : null;
      case 'MFNode': return Array.from(v, unwrap);
      case 'SFBool': return !!v;
      case 'SFFloat': case 'SFTime': case 'SFDouble': case 'SFInt32': return Number(v);
      case 'SFString': return String(v);
      default: return v;
    }
  }
  function unwrap(p) { return (p && rawOf.get(p)) || p; }

  const METHODS = new Set(['getNodeName', 'getNodeTypeName', 'addFieldCallback', 'removeFieldCallback', 'getTypeName', 'getType', 'getName', 'dispose', 'valueOf', 'toString']);
  function wrap(raw) {
    let p = wrappers.get(raw); if (p) return p;
    const target = {};
    p = new Proxy(target, {
      get(_t, prop) {
        if (typeof prop === 'symbol') return undefined;
        switch (prop) {
          case 'getNodeName': return () => raw.def || '';
          case 'getNodeTypeName': return () => raw.type;
          case 'getTypeName': return () => 'SFNode';
          case 'addFieldCallback': return (key, field, fn) => { ((raw.cbs ||= {})[field] ||= new Map()).set(key, fn); };
          case 'removeFieldCallback': return (field, key) => { raw.cbs && raw.cbs[field] && raw.cbs[field].delete(key); };
          case 'valueOf': case 'toString': return () => `[${raw.type}${raw.def ? ' ' + raw.def : ''}]`;
        }
        const fd = R.fdefsOf(raw)[prop];
        if (!fd) return undefined;
        const v = raw.f[prop];
        if (fd[0] === 'MFNode') return mfNode(v, raw);
        return toSAI(fd[0], v);
      },
      set(_t, prop, value) {
        const fd = R.fdefsOf(raw)[prop];
        if (!fd) throw new Error(`${raw.type} has no field ${prop}`);
        if (prop === 'children' && fd[0] === 'MFNode') { raw.f.children = Array.from(value, unwrap); raw.version = (raw.version || 0) + 1; R.hooks.changed(raw, 'children'); return true; }
        const v = fromSAI(fd[0], value, raw.f[prop]);
        R.receive(raw, prop, v);
        return true;
      },
      has(_t, prop) { return !!R.fdefsOf(raw)[prop] || METHODS.has(prop); },
    });
    wrappers.set(raw, p); rawOf.set(p, raw);
    return p;
  }
  /* live MFNode over a raw array (a node's children, or the scene's roots): push enters the body */
  function mfNode(arr, owner) {
    return new Proxy(arr, {
      get(t, prop) {
        if (prop === 'getTypeName') return () => 'MFNode';
        if (prop === 'length') return t.length;
        if (typeof prop === 'string' && /^\d+$/.test(prop)) return t[+prop] ? wrap(t[+prop]) : undefined;
        if (prop === 'push') return (...ns) => { for (const n of ns) { const r = unwrap(n); t.push(r); if (BODY) BODY.adopt(r, owner || null); } return t.length; };
        if (prop === Symbol.iterator) return function* () { for (const x of t) yield wrap(x); };
        if (typeof prop === 'string' && typeof Array.prototype[prop] === 'function') return (...a) => Array.prototype[prop].apply(t.map(wrap), a);
        return t[prop];
      },
    });
  }
  const mfNodeFor = (raw, field) => mfNode(raw.f[field], raw);
  // node.children must hand out a live list owned by the node
  const origToSAI = toSAI;

  /* an output event that the page listens to: set the field, call the callbacks, send it down the ROUTEs */
  function fire(node, field, value) {
    node.f[field] = value;
    const cb = node.cbs && node.cbs[field];
    if (cb) { const fd = R.fdefsOf(node)[field], sv = toSAI(fd ? fd[0] : '', value); for (const fn of cb.values()) { try { fn(sv); } catch (e) { console.error(e); } } }
    const rs = node.out && node.out[field];
    if (rs) for (const r of rs) { R.events.queue.push(r, value); }
    R.events.drain();
  }
  R.hooks.fire = fire;
  R.hooks.changed = (node, field) => { if (BODY) BODY.changed(node, field); const cb = node.cbs && node.cbs[field]; if (cb) { const fd = R.fdefsOf(node)[field], sv = toSAI(fd ? fd[0] : '', node.f[field]); for (const fn of cb.values()) { try { fn(sv); } catch (e) { console.error(e); } } } };
  R.hooks.bind = (node, on) => { if (BODY) BODY.bindViewpoint(node, on); };

  /* ------------------------------------------------------------------ scenes */
  function makeScene(world, isMain) {
    const sc = {
      _world: world,
      get rootNodes() { return mfNode(world.children, null); },
      addRootNode(n) { const r = unwrap(n); world.children.push(r); if (BODY && sc === MAINSCENE) BODY.adopt(r, null); },
      addComponent() {},
      getNamedNode(name) { const n = world.defs.get(name) || (MAINSCENE && MAINSCENE._world.defs.get(name)); if (!n) throw new Error(`Node named '${name}' not found.`); return wrap(n); },
      createNode(type) {
        const def = R.DEFS[type]; if (!def) throw new Error(`Unknown node type ${type}`);
        const n = { type, def: null, f: {}, id: 1e6 + (makeScene.k = (makeScene.k || 0) + 1), out: null };
        for (const [name, [t, , d]] of Object.entries(def)) n.f[name] = t === 'MFNode' ? [] : R.clone(d);
        world.nodes.push(n);
        return wrap(n);
      },
      addRoute(a, fa, b, fb) {
        const A = unwrap(a), Bn = unwrap(b), from = R.resolveField(A, fa, 'out'), to = R.resolveField(Bn, fb, 'in');
        if (!from || !to) throw new Error(`Bad route ${A.type}.${fa} to ${Bn.type}.${fb}`);
        const have = (A.out && A.out[from]) || [];
        if (have.some((r) => r.to === Bn && r.toField === to)) return;
        const r = { from: A, fromField: from, to: Bn, toField: to, label: `${A.def || A.type}.${from} → ${Bn.def || Bn.type}.${to}`, discrete: /^(SFBool|SFTime|SFInt32|SFString)$/.test(R.fieldType(A, from)) };
        ((A.out ||= {})[from] ||= []).push(r); (world.routes ||= []).push(r);
      },
    };
    return sc;
  }

  const gz = async (buf) => { const ds = new DecompressionStream('gzip'); const st = new Blob([buf]).stream().pipeThrough(ds); return new Response(st).text(); };
  /* the single-file build carries its scenes, data and textures as base64 in window.__VFS (keys are paths relative to the page); no request is made for them */
  const b64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const relOf = (url) => String(url).replace(location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, ''), '');
  const vfsBytes = (url) => { const v = window.__VFS; const k = v && relOf(url); return k && v[k] ? b64(v[k]) : null; };
  async function fetchWorldText(url) {
    let u = vfsBytes(url);
    if (!u) { const res = await fetch(url); if (!res.ok) throw new Error(`${res.status} for ${url}`); u = new Uint8Array(await res.arrayBuffer()); }
    if (u[0] === 0x1f && u[1] === 0x8b) return gz(u);
    return new TextDecoder().decode(u);
  }
  const B = {
    version: 'Babylon ' + (typeof BABYLON !== 'undefined' ? BABYLON.Engine.Version : '?') + ' WebGPU',
    currentScene: null,
    setBrowserOption(k, v) { if (k === 'ContentScale' && BODY) { BODY.engine.setHardwareScalingLevel(1 / Math.max(0.25, v)); } B._opts = B._opts || {}; B._opts[k] = v; },
    addBrowserCallback() {},
    baseURL: '',
    getComponent() { return {}; },
    async loadComponents() {},
    async createX3DFromURL(mfs) {
      const url = new URL(String(mfs[0]), location.href).href;
      const text = await fetchWorldText(url);
      return B.createX3DFromString(text, url);
    },
    async replaceWorld(sc) {
      const world = sc._world;
      MAINSCENE = sc; B.currentScene = sc; WORLD = world;
      BODY.timeSensors = world.nodes.filter((n) => n.type === 'TimeSensor');
      BODY.setWorld(world, sc._base || location.href, (u, base) => vfsResolve(new URL(u, base).href));
    },
    getCurrentFrameRate() { return BODY ? BODY.fps() : 0; },
    nextFrame() { return new Promise((res) => { (BODY.frameWaiters ||= []).push(res); }); },
    getActiveLayer() { return { getViewpoint: () => ({ get description() { return BODY.bound ? BODY.bound.f.description : ''; }, getUserPosition: () => BODY.userPosition() }) }; },
    async loadURL(mfs) {
      const url = new URL(String(mfs[0]), location.href).href;
      const text = await fetchWorldText(url);
      const world = R.parseX3D(text);
      const sc = makeScene(world, true); sc._base = url; for (const n of world.nodes) n.base = url;
      MAINSCENE = sc; B.currentScene = sc; WORLD = world;
      BODY.timeSensors = world.nodes.filter((n) => n.type === 'TimeSensor');
      BODY.setWorld(world, url, (u, base) => vfsResolve(new URL(u, base).href));
      if (world.warnings.length) console.info('[x3d reader]', world.warnings.slice(0, 8).join(' | '));
      return sc;
    },
    async createX3DFromString(xml, baseUrl) {
      const world = R.parseX3D(xml);
      const sc = makeScene(world, false);
      sc._base = baseUrl || B.baseURL || location.href;
      for (const n of world.nodes) n.base = sc._base;
      // nodes the imported scene owns: its timers run with the body's, and its roots join the main scene when pushed
      if (BODY) { BODY.timeSensors = (BODY.timeSensors || []).concat(world.nodes.filter((n) => n.type === 'TimeSensor')); }
      if (MAINSCENE) for (const [k, v] of world.defs) if (!MAINSCENE._world.defs.has(k)) MAINSCENE._world.defs.set(k, v);
      return sc;
    },
  };
  // nodes with MFNode children: wrap must return a live list owned by the node
  const baseToSAI = toSAI;
  function vfsResolve(url) { const v = window.__VFS, k = v && relOf(url); return k && v[k] && /\.png$/i.test(k) ? 'data:image/png;base64,' + v[k] : url; }

  const X3D = {
    SFColor, SFVec2f, SFVec3f, SFVec4f, SFRotation, SFColorRGBA, MFColor, MFColorRGBA, MFVec3f, MFVec2f, MFFloat, MFInt32, MFString, MFNode, X3DConstants: {},
    getBrowser(sel) { const c = document.querySelector(sel); return c && c.__browser ? c.__browser : null; },
  };
  window.X3DSAI = { X3D, B, wrap, unwrap, setBody(b) { BODY = b; const c = b.canvas; c.__browser = B; c.browser = B; }, vfsResolve, vfsBytes };
  window.X3D = X3D;
})();
