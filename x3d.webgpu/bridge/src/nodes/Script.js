/* Script (Scripting level 1): Script contains author-programmed event behaviors for a scene.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Script', {
  component: 'Scripting', level: 1,
  container: 'children',
  defs: {
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    description: ['SFString', IO, ""],
    directOutput: ['SFBool', INIT, false],
    field: ['MFNode', IO, []],
    load: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    mustEvaluate: ['SFBool', INIT, false],
    sourceCode: ['SFString', IO, ""],
    url: ['MFString', IO, []],
  },
  // Scripting: the scene's ECMAScript. OFF unless the page sets R.bridge.allowScripts = true, because it runs code that comes with the scene, with the page's own rights.
  // <field> children declare the script's own fields; the source is the CDATA text (or sourceCode, or an "ecmascript:" url). The source runs in a scope where every field is a
  // variable: reading gives the current value, assigning an output (or inputOutput) field sends it when the handler returns. A function named like an inputOnly field (or set_name for an
  // inputOutput field) is called with (value, timestamp); initialize() runs once after load, eventsProcessed() after each batch. SFVec2f/3f/4f, SFColor and SFRotation are plain objects
  // (x y z, r g b, x y z angle) with the common vector methods; MF fields are arrays. Browser has println, print, getName, getVersion, getCurrentTime. Gaps: shutdown(), node-valued
  // fields, directOutput, external script files, the rest of the classic object methods.
  init(n) {
    if (!R.bridge.allowScripts) { n._off = true; return; }
    const fd = R.fdefsOf(n), custom = Object.keys(fd).filter((k) => !DEFS.Script[k]);
    let src = (n.f.sourceCode || '').trim();
    if (!src) { const u = (n.f.url || []).find((x) => /^\s*(ecmascript|javascript):/i.test(x)); if (u) src = u; }
    src = src.replace(/^\s*(ecmascript|javascript):/i, '');
    if (!src) return;
    const T = (type) => type.replace(/^MF/, 'SF'), isMF = (type) => type.startsWith('MF');
    const toJS = (type, v) => isMF(type) ? Array.from(typeof v[0] === 'number' ? chunkFor(T(type), v) : v || []).map((e) => toJS(T(type), e)) : one(type, v);
    const chunkFor = (t, v) => { const k = { SFVec2f: 2, SFVec3f: 3, SFVec4f: 4, SFColor: 3, SFRotation: 4 }[t]; if (!k) return Array.from(v); const o = []; for (let i = 0; i + k <= v.length; i += k) o.push(Array.from(v.slice(i, i + k))); return o; };
    const one = (type, v) => { switch (type) { case 'SFVec2f': return new SFVec2f(v[0], v[1]); case 'SFVec3f': return new SFVec3f(v[0], v[1], v[2]); case 'SFVec4f': return new SFVec4f(v[0], v[1], v[2], v[3]); case 'SFColor': return new SFColor(v[0], v[1], v[2]); case 'SFRotation': return new SFRotation(v[0], v[1], v[2], v[3]); default: return v; } };
    const arr = (type, v) => { switch (type) { case 'SFVec2f': return [v.x ?? v[0], v.y ?? v[1]]; case 'SFVec3f': return [v.x ?? v[0], v.y ?? v[1], v.z ?? v[2]]; case 'SFVec4f': return [v.x ?? v[0], v.y ?? v[1], v.z ?? v[2], v.w ?? v[3]]; case 'SFColor': return [v.r ?? v[0], v.g ?? v[1], v.b ?? v[2]]; case 'SFRotation': return [v.x ?? v[0], v.y ?? v[1], v.z ?? v[2], v.angle ?? v[3]]; default: return v; } };
    const fromJS = (type, v) => isMF(type) ? Array.from(v || []).map((e) => arr(T(type), e)) : arr(type, v);
    const cur = {}, pending = new Map(), now = () => (events.ts !== undefined ? events.ts : performance.timeOrigin / 1000 + performance.now() / 1000);
    const Browser = { name: 'x3d.webgpu bridge', version: '1', getName: () => 'x3d.webgpu bridge', getVersion: () => '1', getCurrentTime: now, println: (...a) => console.log(...a), print: (...a) => console.log(...a) };
    const scope = new Proxy({}, {
      has: (t, k) => typeof k === 'string' && (custom.includes(k) || k === 'Browser' || k in CTORS),
      get: (t, k) => { if (k === Symbol.unscopables) return undefined; if (k === 'Browser') return Browser; if (k in CTORS) return CTORS[k]; return k in cur ? cur[k] : toJS(fd[k][0], n.f[k]); },
      set: (t, k, v) => { const [type, acc] = fd[k]; cur[k] = v; if (acc === OUT || acc === IO) pending.set(k, fromJS(type, v)); else n.f[k] = fromJS(type, v); return true; },
    });
    const names = ['initialize', 'eventsProcessed', ...custom.flatMap((k) => [k, 'set_' + k])].filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
    let h;
    try { h = new Function('S', 'with (S) {\n' + src + '\n}\nreturn {' + names.map((k) => JSON.stringify(k) + ': typeof ' + k + " === 'function' ? " + k + ' : null').join(',') + '};')(scope); }
    catch (e) { n._err = String(e); console.warn('Script ' + (n.def || '') + ': ' + e); return; }
    const flush = (fire) => { for (const [k, v] of pending) { delete cur[k]; if (fire) BR.fire(n, k, v); else { n.f[k] = v; events.emit(n, k, v); } } pending.clear(); };
    const call = (fn, args, fire) => { try { fn.apply(null, args); } catch (e) { n._err = String(e); console.warn('Script ' + (n.def || '') + ': ' + e); } flush(fire); };
    n._script = { h, call, cur, toJS, fd };
    setTimeout(() => { if (h.initialize) call(h.initialize, [], true); }, 0);
  },
  receive(n, field, v) {
    const S = n._script; if (!S) return n._off ? true : false;
    const fd = S.fd[field]; if (!fd || DEFS.Script[field]) return false;
    n.f[field] = clone(v); delete S.cur[field];
    const fn = S.h[field] || S.h['set_' + field], t = events.ts;
    if (fn) S.call(fn, [S.toJS(fd[0], v), t], false);
    if (S.h.eventsProcessed) S.call(S.h.eventsProcessed, [t], false);
    return true;
  },
});

// the script's value types: plain objects with the usual vector methods
class SFVec2f { constructor(x = 0, y = 0) { this.x = x; this.y = y; } add(o) { return new SFVec2f(this.x + o.x, this.y + o.y); } subtract(o) { return new SFVec2f(this.x - o.x, this.y - o.y); } multiply(k) { return new SFVec2f(this.x * k, this.y * k); } divide(k) { return new SFVec2f(this.x / k, this.y / k); } negate() { return new SFVec2f(-this.x, -this.y); } dot(o) { return this.x * o.x + this.y * o.y; } length() { return Math.hypot(this.x, this.y); } normalize() { const l = this.length() || 1; return new SFVec2f(this.x / l, this.y / l); } toString() { return this.x + ' ' + this.y; } }
class SFVec3f { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } add(o) { return new SFVec3f(this.x + o.x, this.y + o.y, this.z + o.z); } subtract(o) { return new SFVec3f(this.x - o.x, this.y - o.y, this.z - o.z); } multiply(k) { return new SFVec3f(this.x * k, this.y * k, this.z * k); } divide(k) { return new SFVec3f(this.x / k, this.y / k, this.z / k); } negate() { return new SFVec3f(-this.x, -this.y, -this.z); } dot(o) { return this.x * o.x + this.y * o.y + this.z * o.z; } cross(o) { return new SFVec3f(this.y * o.z - this.z * o.y, this.z * o.x - this.x * o.z, this.x * o.y - this.y * o.x); } length() { return Math.hypot(this.x, this.y, this.z); } normalize() { const l = this.length() || 1; return new SFVec3f(this.x / l, this.y / l, this.z / l); } toString() { return this.x + ' ' + this.y + ' ' + this.z; } }
class SFVec4f { constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; } toString() { return [this.x, this.y, this.z, this.w].join(' '); } }
class SFColor { constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; } toString() { return this.r + ' ' + this.g + ' ' + this.b; } }
class SFRotation { constructor(x = 0, y = 0, z = 1, angle = 0) { this.x = x; this.y = y; this.z = z; this.angle = angle; } toString() { return [this.x, this.y, this.z, this.angle].join(' '); } }
const CTORS = { SFVec2f, SFVec3f, SFVec4f, SFColor, SFRotation, MFFloat: (...a) => a, MFInt32: (...a) => a, MFString: (...a) => a, MFVec3f: (...a) => a, MFVec2f: (...a) => a, MFColor: (...a) => a, MFRotation: (...a) => a };
// the script field declarations and source text come from the XML: <field name type accessType value/> children and the CDATA body
{
  const _pn = parseNode;
  parseNode = function (el, ctx) {
    const r = _pn(el, ctx);
    if (el.nodeName !== 'Script' || !r || el.getAttribute('USE')) return r;
    const node = r.node; node.fdefs = { ...DEFS.Script };
    for (const c of el.children) {
      if (c.nodeName !== 'field') continue;
      const name = c.getAttribute('name'), type = c.getAttribute('type'), acc = ACCESS[c.getAttribute('accessType')];
      if (!name || !type || !acc || /Node$/.test(type) || !PARSE[type]) { ctx.warnings.push(`Script ${node.def || ''}: field ${name || '?'} (${type}) is not supported here; ignored.`); continue; }
      node.fdefs[name] = [type, acc, null];
      const v = c.getAttribute('value');
      node.f[name] = v != null ? PARSE[type](v) : PARSE[type](type.startsWith('MF') ? '' : type === 'SFBool' ? 'false' : type === 'SFString' ? '' : '0');
    }
    if (!node.f.sourceCode) { const t = Array.from(el.childNodes).filter((x) => x.nodeType === 3 || x.nodeType === 4).map((x) => x.nodeValue).join('').trim(); if (t) node.f.sourceCode = t; }
    return r;
  };
}
