/* three.js body for the X3D reader: the drawing half the Babylon bridge keeps in demo/src/brain/body.js, body-cam.js and bridge/src/body-br.js.
   Concatenated by tools/bundle.js after the reader, the bridge kit and the node files, before demo/src/brain/sai.js; needs the global THREE (r187, WebGL2).
   The reader (parse, ROUTEs, SAI, events, sensors, interpolators, physics, audio) is shared untouched. What lives here is only what touches the engine.
   Contract with the SAI shim (sai.js): setWorld, changed, adopt, bindViewpoint, nextFrame (frameWaiters), fps, userPosition, timeSensors, canvas, engine.setHardwareScalingLevel.
   Choices, each with its reason:
   - THREE.ColorManagement is off and the output colour space is linear: X3D colours are authored numbers and X_ITE 16.6.0 writes them as they are, so the look is reproducible and the
     sRGB question stays one switch (opts.srgb) instead of a hidden default. Quality options (tone map, env light) sit on top of that, not in place of it.
   - Lights carry a factor PI: three.js (since r155) uses physical units, where a DirectionalLight of intensity 1 gives diffuse/PI. X3D wants diffuse * intensity * N.L.
   - Right-handed, Y up, counter-clockwise front faces: the same as three.js, so there is no winding flip and no handedness flag (Babylon needs both).
   - Transform keeps T C R SR S -SR -C as one matrix, so a shear survives (the Babylon body decomposes it to TRS and drops it). */
const THREE_PI = Math.PI;
/* PhysicalMaterial in X_ITE 16.6.0 (measured by the render oracle, x3d.render-oracle probes p_i*_m*_r*, centre pixel facing a DirectionalLight, X_ITE = x3d.wgpu = Blender = Castle within 5, three.js alone off):
   the light is NOT multiplied by PI (base 0.5, intensity 1, rough dielectric reads 110 = 255 * (0.5 / PI)^(1/2.2); intensity 2 reads 150 = 255 * (1 / PI)^(1/2.2): linear in intensity before the curve) and the whole result
   is written through a 1/2.2 power (white EnvironmentLight 0.5 on base 1 reads 186 = 255 * 0.5^(1/2.2); the headlit default PhysicalMaterial too). Material and UnlitMaterial are written as they are. The scene's lights carry the PI
   factor the Phong model needs, so a physical material divides its direct terms by PI here and curves the sum. The first fix (an EnvironmentLight-only curve) matched the furnace scenes and broke under a direct light. */
function xiteGamma22(shader) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directDiffuse /= PI; reflectedLight.directSpecular /= PI;')
    .replace('#include <colorspace_fragment>', 'gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));\n#include <colorspace_fragment>');
}
/* The three.js side of a bridge node, registered from this tree (src/nodes/NODE.js) without touching the Babylon node files:
   R.bridge.three.build.NODE(body, n, parent, chain) -> record, R.bridge.three.geometry.NODE(g, body) -> THREE.BufferGeometry, R.bridge.three.changed.NODE(body, n, field) */
const T3 = (R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} });

/* Three shader chunks replaced once, each with the X3D / X_ITE 16.6.0 formula it stands for. A replace that finds nothing throws, so a three.js upgrade that moves the text fails loudly here.
   1  point and spot radius: X3D has a hard edge (no light past radius) and no window function; three.js dims with 1 - (d / r)^4 squared.
   2  spot cone: X3D is full intensity inside beamWidth and a LINEAR ramp in the angle to nothing at cutOffAngle (17.4.4); three.js uses smoothstep over the cosines.
   1b attenuation: three.js light falls as d^-decay. Here decay is read as the X3D polynomial normalised by a0: 0 = flat, b > 0 = 1 / (1 + b d^2), b < 0 = 1 / (1 + |b| d); the light intensity carries 1 / a0.
   3  fog: X_ITE fog factor from the distance to the eye (not the view depth), LINEAR or EXPONENTIAL as in Fog2.glsl; FogExp2.density holds the visibility range. */
let _patched = false;
function patchThreeShaders() {
  if (_patched) return; _patched = true; const C = THREE.ShaderChunk;
  const sub = (name, from, to) => { if (!C[name].includes(from)) throw new Error('three.js shader chunk ' + name + ' changed; update patchThreeShaders in body-three.js'); C[name] = C[name].replace(from, to); };
  sub('lights_pars_begin', 'float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );', 'float distanceFalloff = decayExponent == 0.0 ? 1.0 : ( decayExponent > 0.0 ? 1.0 / ( 1.0 + decayExponent * lightDistance * lightDistance ) : 1.0 / ( 1.0 - decayExponent * lightDistance ) );');
  sub('lights_pars_begin', 'distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );', 'distanceFalloff *= step( lightDistance, cutoffDistance );');
  sub('lights_pars_begin', 'return smoothstep( coneCosine, penumbraCosine, angleCosine );', 'float aOut = acos( coneCosine ), aIn = acos( penumbraCosine ); return clamp( ( aOut - acos( clamp( angleCosine, -1.0, 1.0 ) ) ) / max( aOut - aIn, 1e-5 ), 0.0, 1.0 ) * step( coneCosine, angleCosine );');
  sub('fog_vertex', 'vFogDepth = - mvPosition.z;', 'vFogDepth = length( mvPosition.xyz );');
  sub('fog_fragment', 'float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );', 'float fogFactor = 1.0 - exp( - vFogDepth / max( fogDensity - vFogDepth, 0.001 ) );');
  sub('fog_fragment', 'float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );', 'float fogFactor = 1.0 - max( fogFar - vFogDepth, 0.0 ) / fogFar;');
}

/* Geo.geometryData: tools/bundle.js lifts it verbatim from demo/src/brain/body.js (renderer-neutral vertex data), so there is one copy of the triangulation rules */

class Body {
  constructor(canvas, opts) {
    this.canvas = canvas; this.opts = opts || {};
    this.rec = new Map(); this.geoCache = new Map(); this.textCache = new Map(); this.texCache = new Map(); this.meshesOf = new Map();
    this.notes = new Set(); this.frameTimes = []; this.stats = { frames: 0 };
    this.pose = { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: 0.7854 };
    this.fogScopes = new WeakMap(); this.localFogs = new Map(); this.worldFog = null; this.fogHooks = false;
    this.screenU = { res: { value: new THREE.Vector2(1, 1) }, ratio: { value: 1 } };   // the drawing buffer size in pixels, for the shaders that work in screen space (wide lines, hatching)
    this.tr = null; this.bound = null; this.started = false; this.lights = []; this.look = { wired: false };
  }

  async init() {
    patchThreeShaders();
    THREE.ColorManagement.enabled = !!this.opts.srgb;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.outputColorSpace = this.opts.srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.engine = { setHardwareScalingLevel: (l) => { r.setPixelRatio((window.devicePixelRatio || 1) / l); this.fit(); }, getRenderWidth: () => r.domElement.width, getRenderHeight: () => r.domElement.height };
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0.003, 0.005, 0.012);
    this.cam = this.camP = new THREE.PerspectiveCamera(45, 1, 0.5, 4000); this.camO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1e4);   // camO is drawn with while an OrthoViewpoint is bound (applyCamera swaps this.cam)
    this.scene.add(this.cam, this.camO);
    this.headlight = new THREE.DirectionalLight(0xffffff, THREE_PI); this.headlight.layers.mask = 0xffffffff; this.headlight.position.set(0, 0, 1); this.headlight.target.position.set(0, 0, -1);
    this.cam.add(this.headlight, this.headlight.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0); this.ambient.layers.mask = 0xffffffff; this.scene.add(this.ambient);   // lights reach every layer
    this.setTone(this.opts.tone === undefined ? 'none' : this.opts.tone);
    this.setupInput(); this.fit();
    new ResizeObserver(() => this.fit()).observe(this.canvas);
    const loop = () => { this.frame(); this._raf = requestAnimationFrame(loop); }; loop();
    this.adapterInfo = { renderer: r.getContext().getParameter(r.getContext().VERSION) };
    return this;
  }
  fit() { const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height; this.renderer.setSize(w, h, false); this.applyCamera(); }
  setTone(kind) {
    const T = THREE; this.renderer.toneMapping = kind === 'neutral' ? T.NeutralToneMapping : kind === 'aces' ? T.ACESFilmicToneMapping : kind === 'standard' ? T.ReinhardToneMapping : T.NoToneMapping;
    this.tone = kind;
  }
  note(msg) { if (!this.notes.has(msg)) { this.notes.add(msg); if (this.opts.onNote) this.opts.onNote(msg); } }

  /* ----------------------------------------------------------------- world */
  setWorld(world, baseUrl, resolve) {
    this.clearWorld(); R.bridge.three.pointer.reset(); R.bridge.body = this;   // the shared bridge nodes reach the body through this (receive hooks call body.regeo)
    this.world = world; this.baseUrl = baseUrl; this.resolve = resolve || ((u) => u);
    this.root = new THREE.Group(); this.root.name = 'x3d-root'; this.scene.add(this.root);
    for (const n of world.children) this.build(n, this.root, []);
    this.applyBackground(); this.applyNavigation(); this.applyFog();
    const first = (this.viewpoints || []).find((n) => n.type === 'Viewpoint' || n.type === 'OrthoViewpoint' || n.type === 'GeoViewpoint');   // 19775-1 23.4.1: the first Viewpoint in the file is bound at load (the Babylon stock body does this in body-br.js)
    if (first) { this.started = false; this.bindViewpoint(first, true); }
  }
  clearWorld() {
    if (!this.root) return;
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
    this.envNode = null; this.envCube && this.envCube.dispose(); this.envCube = null; this.envGen = (this.envGen || 0) + 1; this.scene.environment = null; this.scene.environmentIntensity = 1; this.psys = []; this.projs = []; this._pjScoped = false; this.hums = []; this._hrecs = []; this._hanimDirty = false; R.bridge.three.layers.clear(this); this.scene.remove(this.root); this.scene.fog = this.worldFog = null; this.fogHooks = false; this.fogScopes = new WeakMap(); this.localFogs = new Map(); this.tcgMeshes = [];
    for (const r of this.inlines || []) { r.dead = true; r.gen++; r.world = null; } this.inlines = new Set(); this.inlineLoads = 0;
    if (this.cubeGen) for (const e of this.cubeGen) if (e.target) e.target.dispose(); this.cubeGen = new Set(); this.cubeMats = new Set(); if (this.cubeEmpty) { this.cubeEmpty.dispose(); this.cubeEmpty = null; }
    for (const tc of this.textCache.values()) if (tc && tc.map && tc.map.dispose) tc.map.dispose();
    for (const v of this.texCache.values()) { if (v && v.dispose) v.dispose(); else if (v && v.tex && v.tex.dispose) v.tex.dispose(); if (v && v.target && v.target.dispose) v.target.dispose(); }
    this.textCache.clear(); this.texCache.clear(); this.meshesOf.clear(); this.pose.geo = null;
    this.rec.clear(); this.geoCache.clear(); this.lights = []; this.billboards = []; this.lods = []; this.clips = []; this.clipDirty = false; this.bound = null; this.viewpoints = []; this.root = null;
  }

  build(n, parent, chain) {
    if (!n) return null;
    if (chain && chain.length > 400) { this.note('three.js body: <' + n.type + '> is nested more than 400 deep (a USE that contains itself?), not built'); return null; }
    switch (n.type) {
      case 'Group': case 'Switch': case 'Transform': case 'Billboard': case 'LOD': case 'Anchor': case 'Collision': case 'StaticGroup': return this.buildGroup(n, parent, chain);   // Anchor, Collision and StaticGroup draw as plain groups (the link, the collision test and the freezing are the SAI's and the navigation's business)
      case 'ClipPlane': (this.clips ||= []).push({ node: n, parent }); this.clipDirty = true; return null;
      case 'Shape': return this.buildShape(n, parent, chain);
      case 'Inline': return this.buildInline(n, parent, chain);
      case 'Viewpoint': case 'OrthoViewpoint': { const r = { node: n, parent, tn: parent }; this.rec.set(n.id, r); (this.viewpoints ||= []).includes(n) || this.viewpoints.push(n); this.vpParent ||= new Map(); this.vpParent.set(n, parent); return r; }
      case 'DirectionalLight': case 'PointLight': case 'SpotLight': return this.buildLight(n, parent);
      case 'NavigationInfo': case 'Background': case 'TextureBackground': case 'Fog': case 'WorldInfo': case 'TimeSensor': case 'ScalarInterpolator': case 'PositionInterpolator': case 'OrientationInterpolator': case 'ColorInterpolator': return null;
      default: { const fn = T3.build[n.type]; if (!fn) this.note('three.js body: skipped <' + n.type + '>'); else return fn(this, n, parent, chain); return null; }
    }
  }
  /* Inline: the file is fetched (gzip too), parsed by the SAI shim and its roots built under this node's group. load FALSE (or a url change) unloads it and load TRUE loads again; the urls are tried in
     order and a relative one is read against the file that holds the Inline (n.base). A file that includes itself (directly or through others) is refused, as is a nesting deeper than 8, more than 512 loads
     in one world and a file bigger than 32 MB (128 MB once unzipped). An Inline that is cleared, rebuilt or unloaded while its file is on the way is dropped with the TimeSensors and DEFs that the parse
     added to the page. The textures and urls inside the inline file are still read against the main file (a gap). The inline file's own Viewpoint and lights are built where they are drawn, its fog
     and background are ignored, as for the main file. */
  buildInline(n, parent, chain) {
    const o = new THREE.Group(); o.name = n.def || 'Inline'; parent.add(o); const r = { node: n, tn: o, kids: [], chain: [n, ...chain], loaded: false, gen: 0 }; this.rec.set(n.id, r); (this.inlines ||= new Set()).add(r);
    if (n.f.visible === false) o.visible = false;
    if (n.f.load !== false) this.loadInline(n, r);
    return r;
  }
  async fetchText(url, max) {
    const res = await fetch(url); if (!res.ok) throw new Error(res.status + ' for ' + url);
    if (+res.headers.get('content-length') > max) throw new Error('the file is larger than ' + max + ' bytes');
    const u = new Uint8Array(await res.arrayBuffer()); if (u.length > max) throw new Error('the file is larger than ' + max + ' bytes');
    if (!(u[0] === 0x1f && u[1] === 0x8b)) return new TextDecoder().decode(u);
    const rd = new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).body.getReader(), parts = []; let total = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; total += value.length; if (total > max * 4) { rd.cancel(); throw new Error('the unzipped file is larger than ' + max * 4 + ' bytes'); } parts.push(value); }
    return new TextDecoder().decode(await new Blob(parts).arrayBuffer());
  }
  async loadInline(n, r) {
    if (r.dead || r.loaded || r.loading) return; const urls = n.f.url || []; if (!urls.length) return;
    if (r.chain.filter((x) => x.type === 'Inline').length > 8) { this.note('Inline ' + (n.def || '') + ': nested more than 8 deep, not loaded'); return; }
    if ((this.inlineLoads = (this.inlineLoads || 0) + 1) > 512) { this.note('Inline: more than 512 loads in one world, ' + (n.def || '') + ' not loaded'); return; }
    r.loading = true; const my = ++r.gen, stale = () => r.dead || r.gen !== my || n.f.load === false, errs = [];
    try {
      for (const u of urls) {
        try {
          const url = this.resolve(u, n.base || this.baseUrl);
          if (r.chain.some((x) => x !== n && x.type === 'Inline' && x._inlineUrl === url)) throw new Error('the file includes itself');
          n._inlineUrl = url; const text = await this.fetchText(url, 32e6); if (stale()) return;
          const sc = await X3DSAI.B.createX3DFromString(text, url); if (stale()) { this.releaseWorld(sc._world); return; }   // the parse has put the file's TimeSensors and DEFs on the page: taken off again
          r.world = sc._world; r.defKeys = this.defsOf(r.world); this.inlines.add(r);
          try { for (const root of r.world.children) r.kids.push(this.build(root, r.tn, r.chain)); } catch (e) { this.unloadInline(r, true); throw e; }
          r.loaded = true; this.clipDirty = true; return;
        } catch (e) { errs.push(String(e && e.message || e)); }
      }
      this.note('Inline ' + (n.def || '') + ' did not load: ' + errs.join(' | '));
    } finally { if (r.gen === my) r.loading = false; }
  }
  defsOf(world) { const cur = X3DSAI.B.currentScene, out = []; if (cur && cur._world) for (const [k, v] of world.defs) if (cur._world.defs.get(k) === v) out.push(k); return out; }   // the DEFs the parse added to the page
  releaseWorld(world) {
    if (!world) return; const set = new Set(world.nodes); this.timeSensors = (this.timeSensors || []).filter((t) => !set.has(t));
    const cur = X3DSAI.B.currentScene; if (cur && cur._world) for (const k of this.defsOf(world)) cur._world.defs.delete(k);
  }
  unloadInline(r, keepGen) {
    if (!keepGen) r.gen++; for (const k of r.kids) this.disposeRec(k); r.kids = []; if (r.world) this.releaseWorld(r.world); r.world = null; r.loaded = false; r.loading = false; r.defKeys = null; this.clipDirty = true;
  }
  /* every node of the page: the main file's and those of the Inline files that are loaded (the scans for the users of a texture, a font, a fog coordinate look here) */
  allNodes() { const out = this.world ? this.world.nodes.slice() : []; for (const r of this.inlines || []) if (r.world) for (const x of r.world.nodes) out.push(x); return out; }
  buildGroup(n, parent, chain) {
    const o = new THREE.Group(); o.name = n.def || n.type; parent.add(o);
    const r = { node: n, tn: o, kids: [], chain: [n, ...chain] }; this.rec.set(n.id, r); o.userData.node = n;   // the pointer layer finds the object of a group from its node
    if (n.type === 'Transform') this.applyTransform(n, o);
    if (n.type === 'Billboard') (this.billboards ||= []).push(r);   // turned toward the eye every frame (updateView)
    if (n.type === 'LOD') { (this.lods ||= []).push(r); r.level = -1; }
    for (const c of n.f.children) r.kids.push(this.build(c, o, r.chain));
    if (n.type === 'Switch') this.applySwitch(n);
    if (n.f.visible === false) o.visible = false;
    return r;
  }
  /* X3D 4.0 Transform: P' = T C R SR S -SR -C P. three.js Matrix4 is column-major and multiplies on the left, so the product reads in the same order as the standard. */
  applyTransform(n, o) {
    const f = n.f, M = THREE.Matrix4, V = THREE.Vector3, Q = THREE.Quaternion;
    const t = (v) => new M().makeTranslation(v[0], v[1], v[2]), q = (a) => new M().makeRotationFromQuaternion(new Q(...R.quat.fromAxisAngle(a, a[3])));
    const sr = f.scaleOrientation, c = f.center, srInv = [sr[0], sr[1], sr[2], -sr[3]];
    const m = new M().multiplyMatrices(t(f.translation), t(c)).multiply(q(f.rotation)).multiply(q(sr)).multiply(new M().makeScale(f.scale[0], f.scale[1], f.scale[2])).multiply(q(srInv)).multiply(t([-c[0], -c[1], -c[2]]));
    o.matrixAutoUpdate = false; o.matrix.copy(m); o.matrixWorldNeedsUpdate = true;
  }
  applySwitch(n) { const r = this.rec.get(n.id); if (r) r.kids.forEach((k, i) => { if (k && k.tn && k.node.type !== 'Viewpoint' && k.node.type !== 'OrthoViewpoint') k.tn.visible = i === n.f.whichChoice && k.node.f.visible !== false; }); }   // a Viewpoint child's object is its parent's: leave it alone

  /* ---------------------------------------------------------------- shapes */
  buildShape(n, parent, chain) {
    const body = this;
    const f = n.f, g = f.geometry, app = f.appearance, r = { node: n, meshes: [], chain: [n, ...chain] }; this.rec.set(n.id, r);
    const o = new THREE.Group(); o.name = 'shape-' + (n.def || n.id); parent.add(o); r.tn = o;
    if (!g) return r;
    const pl = this.pointLine(g, app);   // lines and points: unlit, drawn in the Material's emissiveColor (or the Color node), not as triangles
    const geo = (pl ? pl.geo : this.threeGeometry(g)) || this.emptyGeometry();   // an empty node keeps its mesh so a later event (regeo) can fill it
    this.clipDirty = true;
    const mat = pl ? pl.mat : this.makeMaterial(n, g, app), two = !pl && app && app.f.material && app.f.material.type === 'TwoSidedMaterial';
    const mesh = pl ? (pl.wide ? new THREE.Mesh(geo, mat) : new (pl.points ? THREE.Points : THREE.LineSegments)(geo, mat)) : new THREE.Mesh(geo, mat); mesh.userData = { shape: n, chain: r.chain, wide: !!(pl && pl.wide) }; o.add(mesh); r.meshes.push(mesh);
    const all = [mesh];
    if (two && g.f.solid !== true) {   // TwoSidedMaterial draws the back faces as a second mesh on the same geometry, in the back colours; solid TRUE culls them (X_ITE 16.6.0 does the same)
      const bm = this.makeMaterial(n, g, app, true), back = new THREE.Mesh(geo, bm); back.userData = { shape: n, chain: r.chain, back: true }; o.add(back); r.meshes.push(back); all.push(back);
    }
    for (const m of all) if (m.material.userData && m.material.userData.cubeU) m.material.userData.cubeU.meshes = all;
    if (!pl && app && app.f.fillProperties) this.applyFill(r, app.f.fillProperties, o);
    for (const m of all) { this.hookFog(m); if (m.material.userData && m.material.userData.vol3) { const hf = m.onBeforeRender; m.onBeforeRender = function (rd, sc, cam, ...a) { hf.call(this, rd, sc, cam, ...a); R.bridge.three.vol3.before(body, this, cam); }; } if (m.material.userData && m.material.userData.x3dShader) { R.bridge.three.shader.alias(geo); m.onBeforeRender = (r, sc, cam) => R.bridge.three.shader.beforeRender(m, cam); } }
    for (const m of all) if (geo.userData.tcg) (this.tcgMeshes ||= []).push(m);
    for (const dep of [...((app && app.f.shaders) || []), app && app.f.material, app && app.f.texture, app && app.f.textureTransform, app && app.f.lineProperties, app && app.f.fillProperties, g, g.f.texCoord]) if (dep) for (const m of all) (this.meshesOf.get(dep.id) || this.meshesOf.set(dep.id, []).get(dep.id)).push(m);
    if (f.visible === false) o.visible = false;
    return r;
  }
  threeGeometry(g) { const geo = this.threeGeometry0(g); return geo && R.bridge.three.vol3 ? R.bridge.three.vol3.geometry(this, g, geo) : geo; }   // + the (s, t, r, q) of a volume texture (nodes/Texturing3D.js)
  threeGeometry0(g) {
    const f = g.f, T = THREE;
    switch (g.type) {
      case 'Box': return new T.BoxGeometry(f.size[0], f.size[1], f.size[2]);
      case 'Sphere': { const g2 = new T.SphereGeometry(f.radius, 48, 32); g2.rotateY(-Math.PI / 2); return g2; }   // X3D: u = 0 at -Z and grows toward -X (X_ITE QuadSphereOptions); three.js starts at -X and grows toward +Z
      case 'Cylinder': {
        const cg = new T.CylinderGeometry(f.radius, f.radius, f.height, 48, 1, false);
        if (f.top === false || f.bottom === false) {   // CylinderGeometry's groups are 0 side, 1 top, 2 bottom: the caps asked away are cut from the index, the others keep their group (x3dRound finds the cap vertices through it)
          const keep = [], groups = [], idx = cg.index;
          for (const gr of cg.groups) if (gr.materialIndex === 0 || (gr.materialIndex === 1 && f.top !== false) || (gr.materialIndex === 2 && f.bottom !== false)) { groups.push({ start: keep.length, count: gr.count, materialIndex: gr.materialIndex }); for (let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx.getX(i)); }
          cg.setIndex(keep); cg.clearGroups(); for (const gr of groups) cg.addGroup(gr.start, gr.count, gr.materialIndex);
        }
        return this.x3dRound(cg);
      }
      case 'Cone': return this.x3dRound(new T.ConeGeometry(f.bottomRadius, f.height, 48, 1, f.bottom === false));
      case 'IndexedFaceSet': case 'IndexedTriangleSet': {
        let d = this.geometryData(g);
        if (g.type === 'IndexedFaceSet') { const x = R.bridge.ifsExtras(g, d); if (x.nrm || x.col) d = { ...d, nrm: x.nrm || d.nrm, col: x.col || d.col }; }   // Normal node, creaseAngle, per-face colour: see Geometry.js
        return this.dataGeometry(d, g);
      }
      default: {
        const fn = T3.geometry[g.type]; if (fn) return fn(g, this);
        const sp = R.bridge.specs.get(g.type);   // a node of the shared bridge with a geometry() hook returns plain vertex data {pos, nrm, uv, col, idx}: the same hook the Babylon body reads, wrapped here in a BufferGeometry
        if (sp && sp.geometry) { const d = sp.geometry(g, this); return d && d.pos && d.pos.length ? this.dataGeometry(d, g) : null; }
        this.note('three.js body: skipped geometry <' + g.type + '>'); return null;
      }
    }
  }
  /* Cylinder and Cone: X_ITE's side has u = 0 at -Z and grows toward -X (CylinderOptions: normal = (-sin, -cos)); three.js starts at +Z and grows toward +X, so the geometry is turned by PI.
     X_ITE's cap images are planar: top (u, v) = (0.5 + x / 2R, 0.5 - z / 2R), bottom (0.5 + x / 2R, 0.5 + z / 2R); three.js maps them transposed, so the cap uv are rewritten from the turned positions. */
  x3dRound(geo) {
    geo.rotateY(Math.PI); const uv = geo.attributes.uv, pos = geo.attributes.position, idx = geo.index, cap = new Set();
    for (const gr of geo.groups) if (gr.materialIndex > 0) for (let i = gr.start; i < gr.start + gr.count; i++) cap.add(idx.getX(i));   // a rim vertex is shared by two triangles: visit each once
    let R = 0; for (const v of cap) R = Math.max(R, Math.hypot(pos.getX(v), pos.getZ(v)));
    for (const v of cap) { const top = pos.getY(v) > 0; uv.setXY(v, 0.5 + pos.getX(v) / (2 * R), 0.5 + (top ? -1 : 1) * pos.getZ(v) / (2 * R)); }
    return geo;
  }
  geometryData(g) { const d = Geo.geometryData.call(this, T3.geo.sub(g)); return R.bridge.three.vol3 ? R.bridge.three.vol3.augment(this, g, d) : d; }   // a GeoCoordinate is read as local metres (nodes/Geo.js)
  /* IndexedLineSet, LineSet (spec.lines) and Polyline2D draw as LineSegments, PointSet (and spec.points) as Points. 19775-1 12.2.2: with no Material they are white and unlit; with one, emissiveColor
     is the colour, and a Color node replaces it. X_ITE draws both one pixel wide (line width and point size are not exposed in WebGL2 beyond that: LineProperties is a gap, see README). */
  pointLine(g, app) {
    const T = THREE, sp = R.bridge.specs.get(g.type), isPts = g.type === 'PointSet' || !!(sp && sp.points), isLine = g.type === 'IndexedLineSet' || !!(sp && sp.lines);
    if (!isPts && !isLine) return null;
    const geo = new T.BufferGeometry(); let colors = null;
    if (isPts) {
      const P = sp && sp.points ? sp.points(g) : g.f.coord && g.f.coord.f.point;
      if (P && P.length) {
        geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(P), 3));
        const C = g.f.color && g.f.color.f.color, cw = g.f.color && g.f.color.type === 'ColorRGBA' ? 4 : 3, np = P.length / 3;   // ColorRGBA: stride 4, alpha is not drawn
        if (C && C.length >= np * cw) { colors = new Float32Array(np * 3); for (let i = 0; i < np; i++) { colors[i * 3] = C[i * cw]; colors[i * 3 + 1] = C[i * cw + 1]; colors[i * 3 + 2] = C[i * cw + 2]; } }
      } else geo.setAttribute('position', new T.BufferAttribute(new Float32Array(0), 3));
    } else {
      const L = sp && sp.lines ? sp.lines(g) : null, P = (L && L.coord ? L.coord : g.f.coord && g.f.coord.f.point) || [], ci = (L ? L.coordIndex : g.f.coordIndex) || [];
      const C = g.f.color && g.f.color.f.color, cw = g.f.color && g.f.color.type === 'ColorRGBA' ? 4 : 3, perV = g.f.colorPerVertex !== false, pos = [], col = [];   // IndexedLineSet has no colorIndex in the reader: colours follow coordIndex (per vertex) or the polyline number
      let run = 0;
      for (const r2 of R.bridge.runs(ci)) {
        for (let k = 0; k + 1 < r2.length; k++) for (const v of [r2[k], r2[k + 1]]) {
          pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
          if (C) { const c = (perV ? v : run) * cw; col.push(C[c], C[c + 1], C[c + 2]); }
        }
        run++;
      }
      geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(pos), 3)); if (C && col.length && col.every((x) => x !== undefined)) colors = Float32Array.from(col);
    }
    const lp = app && app.f.lineProperties, lw = lp && lp.f.applied !== false ? lp.f.linewidthScaleFactor : 0;   // 19775-1 12.2.3: X_ITE 16.6.0 draws a line linewidthScaleFactor pixels wide (when applied)
    if (isLine && lw > 1 && geo.attributes.position.count) { const w = this.wideLines(geo, colors, lw); this.refreshPlain(w.mat, app && app.f.material, !!colors); return w; }
    if (colors) geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = isPts ? new T.PointsMaterial({ size: 1, sizeAttenuation: false }) : new T.LineBasicMaterial();
    this.refreshPlain(mat, app && app.f.material, !!colors); return { geo, mat, points: isPts };
  }
  /* WebGL draws lines one pixel wide, so a wider line is a quad per segment, widened in the vertex shader to `width` pixels across (butt ends, no joins). One corner = the segment end it sits at, the other end, and the side. */
  wideLines(lg, colors, width) {
    const T = THREE, P = lg.attributes.position.array, n = P.length / 6, pos = new Float32Array(n * 12), oth = new Float32Array(n * 12), side = new Float32Array(n * 4), col = colors ? new Float32Array(n * 12) : null, idx = [];
    for (let i = 0; i < n; i++) {
      const a = P.subarray(i * 6, i * 6 + 3), b = P.subarray(i * 6 + 3, i * 6 + 6);
      [[a, b, -1], [a, b, 1], [b, a, 1], [b, a, -1]].forEach(([p, q, sd], k) => { const v = i * 4 + k; pos.set(p, v * 3); oth.set(q, v * 3); side[v] = sd; if (col) col.set(colors.subarray(i * 6 + (k < 2 ? 0 : 3), i * 6 + (k < 2 ? 3 : 6)), v * 3); });
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2);
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('other', new T.BufferAttribute(oth, 3)); geo.setAttribute('side', new T.BufferAttribute(side, 1)); if (col) geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setIndex(idx);
    const mat = new T.ShaderMaterial({ uniforms: { res: this.screenU.res, ratio: this.screenU.ratio, width: { value: width }, diffuse: { value: new T.Color(1, 1, 1) }, opacity: { value: 1 } }, vertexColors: !!col, side: T.DoubleSide,
      vertexShader: 'uniform vec2 res; uniform float ratio; uniform float width; attribute vec3 other; attribute float side; varying vec3 vCol;\nvoid main() { vec4 a = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ), b = projectionMatrix * modelViewMatrix * vec4( other, 1.0 );\n vec2 d = b.xy / b.w * res * 0.5 - a.xy / a.w * res * 0.5; d = length( d ) < 1e-6 ? vec2( 1.0, 0.0 ) : normalize( d );\n gl_Position = vec4( a.xy + vec2( -d.y, d.x ) * side * width * ratio / res * a.w, a.z, a.w );\n#ifdef USE_COLOR\n vCol = color;\n#else\n vCol = vec3( 1.0 );\n#endif\n}',
      fragmentShader: 'uniform vec3 diffuse; uniform float opacity; varying vec3 vCol;\nvoid main() { gl_FragColor = vec4( diffuse * vCol, opacity );\n#include <colorspace_fragment>\n}' });
    mat.userData.width = width; return { geo, mat, points: false, wide: true };
  }
  refreshPlain(m, mat, hasColors) {
    const e = mat && (mat.f.emissiveColor || (mat.f.baseColor && [0, 0, 0])) || [1, 1, 1];
    if (m.isShaderMaterial) { m.uniforms.diffuse.value.setRGB(hasColors ? 1 : e[0], hasColors ? 1 : e[1], hasColors ? 1 : e[2]); m.uniforms.opacity.value = mat ? 1 - (mat.f.transparency || 0) : 1; m.transparent = m.uniforms.opacity.value < 0.999; return; }
    m.color.setRGB(hasColors ? 1 : e[0], hasColors ? 1 : e[1], hasColors ? 1 : e[2]); m.vertexColors = hasColors; m.fog = true;
    m.opacity = mat ? 1 - (mat.f.transparency || 0) : 1; m.transparent = m.opacity < 0.999; m.needsUpdate = true;
  }
  /* FillProperties (19775-1 12.2.4): filled FALSE draws no fill; hatched TRUE lays one of the 19 hatch patterns over the shape in hatchColor. X_ITE 16.6.0 (Hatch.glsl) reads the 32 x 32 mask
     in screen space, one texel per pixel, so the pattern does not follow the surface: an overlay mesh on the same geometry with a shader that reads the fragment position. */
  applyFill(r, fp, o) {
    const f = fp.f, T = THREE; if (f.filled === false) for (const m of r.meshes) m.visible = false;
    if (f.hatched === false) return;
    const col = f.hatchColor || [1, 1, 1], style = Math.max(1, Math.min(19, f.hatchStyle | 0)), bits = Uint8Array.from(atob(R.bridge.HATCH[style - 1]), (ch) => ch.charCodeAt(0)), d = new Uint8Array(32 * 32 * 4);
    for (let k = 0; k < 1024; k++) if (bits[k >> 3] >> (k & 7) & 1) d.set([Math.round(col[0] * 255), Math.round(col[1] * 255), Math.round(col[2] * 255), 255], k * 4);
    const tx = new T.DataTexture(d, 32, 32, T.RGBAFormat); tx.magFilter = tx.minFilter = T.NearestFilter; tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.generateMipmaps = false; tx.needsUpdate = true;
    const mat = new T.ShaderMaterial({ uniforms: { res: this.screenU.res, hatch: { value: tx } }, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: 'uniform sampler2D hatch; uniform vec2 res;\nvoid main() { vec2 t = vec2( gl_FragCoord.x, res.y - gl_FragCoord.y ) / 32.0; gl_FragColor = texture2D( hatch, t );\n#include <colorspace_fragment>\n}' });
    const ov = new T.Mesh(r.meshes[0].geometry, mat); ov.userData = { hatchOf: r.meshes[0] }; o.add(ov); r.meshes[0].userData.hatch = ov;
  }
  mapMeshes(node) { return this.matMeshes(node).filter((m) => !(m.userData.shape.f.geometry && m.userData.shape.f.geometry.type === 'Text')); }   // a Text's map is its glyph atlas, a shader's material has none: a texture change leaves both alone
  matMeshes(node) { return [...(this.meshesOf.get(node.id) || [])].filter((m) => !(m.material && m.material.userData && (m.material.userData.x3dShader || m.material.userData.vol3))); }   // a ComposedShader mesh has no colour fields to refresh
  isPlain(m) { return m.isLineSegments || m.isPoints || !!m.userData.wide; }   // a line, a point cloud, or a line drawn as screen-space quads
  emptyGeometry() { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3)); return geo; }
  dataGeometry(d, g) {
    const T = THREE, geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(d.pos), 3)); geo.setIndex(new T.BufferAttribute(Uint32Array.from(d.idx), 1));
    if (d.nrm) geo.setAttribute('normal', new T.BufferAttribute(Float32Array.from(d.nrm), 3)); else geo.computeVertexNormals();
    if (d.uv) geo.setAttribute('uv', new T.BufferAttribute(Float32Array.from(d.uv), 2));
    if (d.uvw) geo.setAttribute('uvw', new T.BufferAttribute(Float32Array.from(d.uvw), 4));
    if (d.col) geo.setAttribute('color', new T.BufferAttribute(Float32Array.from(d.col), 3));
    const fc = g && g.f && g.f.fogCoord;   // FogCoordinate: the fog amount of each vertex (0 clear, 1 fully fogged), read by the material patch of makeMaterial; vertices past the end of depth are 0
    if (fc) { const dp = fc.f.depth || [], n = d.pos.length / 3, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.min(1, Math.max(0, dp[i] || 0)); geo.setAttribute('fogCoord', new T.BufferAttribute(a, 1)); }
    const tg = g && g.f && g.f.texCoord;
    if (tg && tg.type === 'TextureCoordinateGenerator') {   // coordinates made from the geometry: object-space modes now, camera-space ones first as object space and then again in updateView
      const mode = String(tg.f.mode || 'SPHERE').toUpperCase(), tc = R.bridge.three.tcg, params = tg.f.parameter || [];
      if (!tc.CAM.test(mode) && !tc.LOCAL.test(mode)) this.note('TextureCoordinateGenerator mode ' + mode + ' is not made (uv left at 0)');
      tc.make(geo, mode, params, null); if (tc.CAM.test(mode)) geo.userData.tcg = { mode, params };
    }
    return geo;
  }
  /* a geometry node's own fields changed (the shared bridge nodes call this as body.regeo(node)): drop its cached data and give every mesh that draws it a fresh BufferGeometry */
  regeo(n) {
    this.geoCache.delete(n.id);
    for (const m of this.meshesOf.get(n.id) || []) {
      const app = m.userData.shape.f.appearance, pl = this.isPlain(m) ? this.pointLine(n, app) : null;
      if (pl && !!pl.wide !== !!m.userData.wide) { this.rebuildShape(m.userData.shape); return; }   // thin <-> wide: a different kind of mesh
      const g = (pl ? pl.geo : this.threeGeometry(n)) || this.emptyGeometry();
      if (n.type === 'Text' && !pl && m.material && !m.material.isShaderMaterial) { const tc = this.textCache.get(n.id); if (tc) { m.material.map = tc.map; m.material.needsUpdate = true; } }
      m.geometry.dispose(); m.geometry = g; m.userData.tcgKey = null; if (m.material.userData && m.material.userData.x3dShader) R.bridge.three.shader.alias(g); if (m.userData.hatch) m.userData.hatch.geometry = g; if (pl) { m.material.dispose(); m.material = pl.mat; }
      if (g.userData.tcg && !(this.tcgMeshes || []).includes(m)) (this.tcgMeshes ||= []).push(m);
      this.clipDirty = true;
    }
  }

  /* ImageTexture (url) and PixelTexture (image: width height components pixels...; rows run bottom to top, as X3D images do, so flipY stays off for the data texture). */
  tex(node) {
    if (!node || /^(Image|Generated|Composed)CubeMapTexture$/.test(node.type)) return null; const hit = this.texCache.get(node.id); if (hit) return hit; let t = null;   // a cube map is not a 2D map: makeMaterial patches the shader
    if (node.type === 'MultiTexture') return this.multiTex(node);
    if (node.type === 'PixelTexture') {
      const im = node.f.image || [], w = im[0] | 0, h = im[1] | 0, k = im[2] | 0; if (!(w > 0 && h > 0 && k >= 1 && k <= 4)) return null;
      const d = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) { const v = im[3 + i] >>> 0; let r, g, b, a = 255;
        if (k === 1) r = g = b = v & 255; else if (k === 2) { r = g = b = (v >> 8) & 255; a = v & 255; } else if (k === 3) { r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255; } else { r = (v >>> 24) & 255; g = (v >> 16) & 255; b = (v >> 8) & 255; a = v & 255; }
        d.set([r, g, b, a], i * 4); }
      t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
      this.smallImage(t, node, w, h);
    } else {
      if (!node.f.url || !node.f.url.length) return null;
      t = new THREE.TextureLoader().load(this.resolve(node.f.url[0], this.baseUrl), (tx) => this.smallImage(tx, node, tx.image.width, tx.image.height));
    }
    t.wrapS = node.f.repeatS === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = node.f.repeatT === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    this.texProps(t, node);
    this.texCache.set(node.id, t); return t;
  }
  /* X_ITE 16.6.0 samples an image smaller than 16 x 16 with hard texels (nearest, no mipmaps) unless a TextureProperties asks otherwise; a copy made for a TextureTransform follows (texFor) */
  smallImage(t, node, w, h) {
    if (node.f.textureProperties || Math.max(w, h) >= 16) return; const set = (x) => { x.generateMipmaps = false; x.minFilter = x.magFilter = THREE.NearestFilter; x.needsUpdate = true; };
    set(t); t.userData.tiny = true; for (const c of t.userData.clones || []) set(c);
  }
  /* TextureProperties (19775-1 18.4.3) on a texture: the boundary modes replace repeatS / repeatT, the filters pick nearest or linear sampling, generateMipMaps false drops the mipmap part of the
     minification filter. Only the NEAREST_PIXEL names give hard texels; FASTEST, DEFAULT and NICEST are linear (NICEST and DEFAULT mipmapped when generateMipMaps asks). */
  texProps(t, node) {
    const tp = node.f.textureProperties; if (!tp) return; const T = THREE, U = (v) => String(v || '').toUpperCase(), f = tp.f;
    const wrap = (m) => { m = U(m); return m === 'MIRRORED_REPEAT' ? T.MirroredRepeatWrapping : m.startsWith('CLAMP') ? T.ClampToEdgeWrapping : T.RepeatWrapping; };   // CLAMP and CLAMP_TO_BOUNDARY have no border colour here: they clamp to the edge, as X_ITE does
    t.wrapS = wrap(f.boundaryModeS); t.wrapT = wrap(f.boundaryModeT);
    const mag = U(f.magnificationFilter); t.magFilter = mag === 'NEAREST_PIXEL' ? T.NearestFilter : T.LinearFilter;   // measured against X_ITE 16.6.0: only NEAREST_PIXEL gives hard texels, FASTEST (the default) is smooth
    const mip = f.generateMipMaps === true, mn = U(f.minificationFilter);
    const MIN = { NEAREST_PIXEL: [T.NearestFilter, T.NearestFilter], FASTEST: [T.LinearMipmapLinearFilter, T.LinearFilter], AVG_PIXEL: [T.LinearFilter, T.LinearFilter],
      NEAREST_PIXEL_NEAREST_MIPMAP: [T.NearestMipmapNearestFilter, T.NearestFilter], NEAREST_PIXEL_AVG_MIPMAP: [T.NearestMipmapLinearFilter, T.NearestFilter],
      AVG_PIXEL_NEAREST_MIPMAP: [T.LinearMipmapNearestFilter, T.LinearFilter], AVG_PIXEL_AVG_MIPMAP: [T.LinearMipmapLinearFilter, T.LinearFilter], NICEST: [T.LinearMipmapLinearFilter, T.LinearFilter], DEFAULT: [T.LinearMipmapLinearFilter, T.LinearFilter] };
    const [withMip, without] = MIN[mn] || MIN.DEFAULT; t.generateMipmaps = mip; t.minFilter = mip ? withMip : without;
    t.anisotropy = Math.max(1, f.anisotropicDegree || 1); t.needsUpdate = true;
  }
  /* the summed ADD stages of a MultiTexture are added to the texture colour before the light is applied, without the clip at 1 a canvas would give: diffuse * (stages so far + ADD stages), through the same uv as the map (X_ITE 16.6.0: whites burn out, a canvas sum would stay at 1) */
  addStage(m, add) {
    this.patchMaterial(m, 'mt-add', (sh) => { sh.uniforms.addMap = { value: add }; sh.fragmentShader = 'uniform sampler2D addMap;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n diffuseColor.rgb += diffuse * texture2D( addMap, vMapUv ).rgb;\n#endif'); });
  }
  /* shader patches of one material, chained (a material can carry the ADD stage and a FogCoordinate): each has its key so the program cache tells the combinations apart */
  patchMaterial(m, key, fn) {
    const prev = m.onBeforeCompile; (m.userData.keys ||= []).push(key);
    m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); fn(sh); }; m.customProgramCacheKey = () => m.userData.keys.join('|');
  }
  /* MultiTexture: the textures are drawn over each other on a canvas texture (the Babylon body does the same); texture i meets the result so far by mode[i], moved by the TextureTransform of stage i
     (the Appearance's MultiTextureTransform, or one TextureTransform for all stages). The first stage is drawn as it is. */
  multiTex(node) {
    const body = this, SZ = 256, cv = document.createElement('canvas'); cv.width = cv.height = SZ; const ctx = cv.getContext('2d'), dt = new THREE.CanvasTexture(cv); dt.wrapS = dt.wrapT = THREE.RepeatWrapping;
    const cv2 = document.createElement('canvas'); cv2.width = cv2.height = SZ; const ctx2 = cv2.getContext('2d'), dt2 = dt.userData.add = new THREE.CanvasTexture(cv2); dt2.wrapS = dt2.wrapT = THREE.RepeatWrapping;   // the ADD stages, summed: X_ITE 16.6.0 adds them to the lit colour, not to the texture colour
    const imgs = [], app = this.allNodes().find((x) => x.type === 'Appearance' && x.f.texture === node);
    const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];   // [a b c d e f]: x' = a x + c y + e
    const inv = (m) => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
    const ttM = (t) => { const f = t.f, c = f.center || [0, 0], s = f.scale || [1, 1], r = f.rotation || 0, T = f.translation || [0, 0], co = Math.cos(r), si = Math.sin(r);
      return mul(mul(mul([1, 0, 0, 1, T[0] + c[0], T[1] + c[1]], [co, si, -si, co, 0, 0]), [s[0], 0, 0, s[1], 0, 0]), [1, 0, 0, 1, -c[0], -c[1]]); };
    const OPS = { REPLACE: 'source-over', MODULATE: 'multiply', MODULATE2X: 'multiply', MODULATE4X: 'multiply', ADD: 'lighter' }, P = [SZ, 0, 0, -SZ, 0, SZ];   // P: uv -> canvas pixels (v up)
    const ctx0 = ctx, redraw = dt.userData.redraw = () => {
      const tt = app && app.f.textureTransform, stageTT = (i) => !tt ? null : tt.type === 'MultiTextureTransform' ? (tt.f.textureTransform || [])[i] || null : tt;
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillRect(0, 0, SZ, SZ);
      ctx2.globalCompositeOperation = 'source-over'; ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, SZ, SZ); let adds = 0;
      imgs.forEach((im, i) => {
        if (!im.complete || !im.naturalWidth) return;
        const mode = String((node.f.mode || [])[i] || 'MODULATE').toUpperCase(), op = OPS[mode], ctx = i && mode === 'ADD' ? ctx2 : ctx0, cv = ctx.canvas; if (ctx === ctx2) adds++;
        if (!op && i) body.note('MultiTexture mode ' + mode + ' drawn as MODULATE');
        ctx.globalCompositeOperation = i === 0 || ctx === ctx2 && adds === 1 ? 'source-over' : op || 'multiply';
        ctx.imageSmoothingEnabled = Math.max(im.naturalWidth, im.naturalHeight) >= 16;   // an image under 16 x 16 is magnified with hard texels (X_ITE 16.6.0 shows a 2 x 1 image as two flat halves), a larger one smoothly
        const t = stageTT(i);
        if (t && t.type === 'TextureTransform') { const Q = mul(mul(P, ttM(t)), inv(P)), D = inv(Q), pat = ctx.createPattern(im, 'repeat');   // canvas(px) = image(Q px) with Q = P M P^-1: the image is placed by Q^-1 and tiled
          pat.setTransform(new DOMMatrix([D[0] * SZ / im.naturalWidth, D[1] * SZ / im.naturalWidth, D[2] * SZ / im.naturalHeight, D[3] * SZ / im.naturalHeight, D[4], D[5]])); ctx.fillStyle = pat; ctx.fillRect(0, 0, SZ, SZ); }
        else ctx.drawImage(im, 0, 0, SZ, SZ);
        const extra = mode === 'MODULATE2X' ? 1 : mode === 'MODULATE4X' ? 3 : 0;
        for (let k = 0; k < extra && i; k++) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(cv, 0, 0); }
      });
      ctx0.globalCompositeOperation = 'source-over'; dt.needsUpdate = true; dt2.needsUpdate = true; dt.userData.hasAdd = adds > 0;
    };
    for (const t of node.f.texture || []) { const u = t.f.url && t.f.url[0]; if (!u) continue; const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = redraw; im.src = this.resolve(u, this.baseUrl); imgs.push(im); }
    redraw(); this.texCache.set(node.id, dt); return dt;
  }
  /* TextureTransform: the matrix of 19775-1 18.4.5 (-C S R C T, not the Transform order), set as the 3x3 uv matrix of a copy of the texture (the copy shares the image, so one texture can carry two transforms) */
  texFor(texN, ttN) {
    const t = this.tex(texN); if (!t || !ttN || ttN.type !== 'TextureTransform' || texN.type === 'MultiTexture') return t; const f = ttN.f, c = f.center, r = f.rotation, s = f.scale, tr = f.translation, M = THREE.Matrix3;
    const T = (x, y) => new M().set(1, 0, x, 0, 1, y, 0, 0, 1), S = (x, y) => new M().set(x, 0, 0, 0, y, 0, 0, 0, 1), Rm = (a) => new M().set(Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1);
    const m = new M().multiplyMatrices(T(-c[0], -c[1]), S(s[0], s[1])).multiply(Rm(r)).multiply(T(c[0], c[1])).multiply(T(tr[0], tr[1]));   // the product as 19775-1 writes it, -C S R C T, taken as a column-vector matrix: found by trying the order and sign variants against X_ITE (50.1 dB; the T C R S -C order of Transform gives 21.3 dB)
    const u = t.clone(); u.userData.copyOf = true; (t.userData.clones ||= []).push(u); u.matrixAutoUpdate = false; u.matrix.copy(m); u.needsUpdate = true; return u;
  }
  /* Material -> MeshPhongMaterial (the Phong model X3D and X_ITE share); PhysicalMaterial -> MeshPhysicalMaterial (the glTF model, linear colours) */
  makeMaterial(shape, g, app, back) {
    if (!back && app && R.bridge.three.vol3 && R.bridge.vol.is3D(app.f.texture) && !['Text'].includes(g.type)) return R.bridge.three.vol3.material(this, shape, g, app);
    const T = THREE, mat = app && app.f.material, texN = app && app.f.texture, side = back ? T.BackSide : g.f.solid === true || (mat && mat.type === 'TwoSidedMaterial') ? T.FrontSide : T.DoubleSide;
    let m;
    for (const cs of app ? (app.f.shaders || []) : []) { if (!cs || cs.type !== 'ComposedShader') continue; const sm = R.bridge.three.shader.make(this, cs, side); R.bridge.three.shader.announce(cs, !!sm); if (sm) return sm; }   // the first shader that compiles takes the place of the Material (19775-1 31.4.1: the browser uses the first it supports)   // a shader that compiles takes the place of the Material; one that does not leaves the Material
    const vc = !!g.f.color;   // a Color node replaces diffuseColor (19775-1 12.2.2): the material colour is white so the vertex colour is not multiplied by it
    if (mat && mat.type === 'TwoSidedMaterial') { m = new T.MeshPhongMaterial({ side, specular: 0 }); this.refreshPhong(m, this.twoSrc(mat, !!back)); m.map = this.texFor(texN, app && app.f.textureTransform); }
    else if (mat && mat.type === 'PhysicalMaterial') { m = new T.MeshPhysicalMaterial({ side }); m.onBeforeCompile = xiteGamma22; m.customProgramCacheKey = () => 'xite-gamma22'; this.refreshPBR(m, mat); m.map = this.texFor(mat.f.baseTexture, app && app.f.textureTransform); }
    else if (mat && mat.type === 'Material') { m = new T.MeshPhongMaterial({ side, specular: 0 }); this.refreshPhong(m, mat); m.map = this.texFor(texN, app && app.f.textureTransform); }
    else if (mat && mat.type === 'UnlitMaterial') { m = new T.MeshBasicMaterial({ side }); this.refreshUnlit(m, mat); m.map = this.texFor(mat.f.emissiveTexture || texN, app && app.f.textureTransform); }   // 19775-1 4.0: no lighting, emissiveColor (times emissiveTexture when the material has one) is the colour
    else { m = new T.MeshBasicMaterial({ side, color: 0xffffff }); m.map = this.texFor(texN, app && app.f.textureTransform); }   // no Material: unlit, white, texture as is (19775-1 12.2.2)
    if (g.type === 'Text') { const tc = this.textCache.get(g.id); m.map = tc ? tc.map : null; m.alphaTest = 0.01; m.alphaToCoverage = true; if (texN) this.note('Text: a texture on a Text is not drawn'); m.needsUpdate = true; }   // the glyph atlas is the map: its alpha cuts the quads to the letters
    R.bridge.three.proj.patch(this, m);   // TextureProjector: a few lines that read the projectors' uniforms
    if (g.f.fogCoord) this.patchMaterial(m, 'fogcoord', (sh) => {   // X_ITE: colour = mix(fogColor, colour, 1 - depth) in place of the distance law; only where a fog covers the mesh
      sh.vertexShader = 'attribute float fogCoord; varying float vFogCoord;\n' + sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n vFogCoord = fogCoord;');
      sh.fragmentShader = 'varying float vFogCoord;\n' + sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( vFogCoord, 0.0, 1.0 ) );\n#endif'); });
    const mt = texN && texN.type === 'MultiTexture' && this.texCache.get(texN.id);
    if (mt && mt.userData.add) this.addStage(m, mt.userData.add);
    if (vc) { m.vertexColors = true; if (mat && mat.type === 'Material') this.refreshPhong(m, mat); else if (mat && mat.type === 'PhysicalMaterial') this.refreshPBR(m, mat); else if (mat && mat.type === 'TwoSidedMaterial') this.refreshPhong(m, this.twoSrc(mat, !!back)); }
    if (texN && /^(Image|Generated|Composed)CubeMapTexture$/.test(texN.type)) R.bridge.three.cube.patch(this, m, texN, shape, !!(g.f.texCoord && g.f.texCoord.type === 'TextureCoordinateGenerator'));
    return m;
  }
  /* TwoSidedMaterial: the fields refreshPhong reads, from the front set or (separateBackColor) the back set */
  twoSrc(mat, back) { const f = mat.f, B = back && f.separateBackColor; return { f: { diffuseColor: B ? f.backDiffuseColor : f.diffuseColor, emissiveColor: B ? f.backEmissiveColor : f.emissiveColor, transparency: B ? f.backTransparency : f.transparency, specularColor: B ? f.backSpecularColor : f.specularColor, shininess: B ? f.backShininess : f.shininess } }; }
  refreshPhong(m, mat) {
    const f = mat.f, vc = m.vertexColors; m.color.setRGB(vc ? 1 : f.diffuseColor[0], vc ? 1 : f.diffuseColor[1], vc ? 1 : f.diffuseColor[2]); m.emissive.setRGB(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.specular.setRGB(f.specularColor[0], f.specularColor[1], f.specularColor[2]); m.shininess = Math.max(f.shininess * 128 * (this.opts.shininessScale || 4), 1e-3);   // X_ITE evaluates Phong with the reflection vector; Blinn-Phong (three.js) needs about 4x the exponent for the same highlight width
    m.opacity = 1 - f.transparency; m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent; m.needsUpdate = true;
  }
  refreshUnlit(m, mat) { const e = mat.f.emissiveColor || [1, 1, 1]; m.color.setRGB(e[0], e[1], e[2]); m.opacity = 1 - (mat.f.transparency || 0); m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent; m.needsUpdate = true; }
  refreshPBR(m, mat) {
    const f = mat.f, vc = m.vertexColors; m.color.setRGB(vc ? 1 : f.baseColor[0], vc ? 1 : f.baseColor[1], vc ? 1 : f.baseColor[2]); m.metalness = f.metallic; m.roughness = f.roughness; m.emissive.setRGB(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.opacity = 1 - f.transparency; m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent;
  }

  /* ---------------------------------------------------------------- lights */
  applyNavigation() { const nav = this.world.nodes.find((n) => n.type === 'NavigationInfo'); this.headlight.visible = !nav || nav.f.headlight !== false; }
  /* A light is a child of the object of its parent group, so every Transform above it moves and turns it with no refresh (the Babylon body does the same with a TransformNode).
     DirectionalLight: direction; PointLight: location, radius (hard edge, see patchShaders), attenuation; SpotLight: the same plus direction, beamWidth, cutOffAngle. */
  buildLight(n, parent) {
    const T = THREE, l = n.type === 'DirectionalLight' ? new T.DirectionalLight(0xffffff, THREE_PI) : n.type === 'SpotLight' ? new T.SpotLight(0xffffff, THREE_PI) : new T.PointLight(0xffffff, THREE_PI);
    l.name = (n.def || n.type) + '-light'; l.layers.mask = 0xffffffff; l.userData.node = n; parent.add(l); if (l.target) parent.add(l.target);
    this.lights.push(l); this.refreshLight(l); this.refreshAmbient();
    const r = { node: n, tn: l, light: l, kids: [] }; this.rec.set(n.id, r); return r;
  }
  refreshLight(l) {
    const n = l.userData.node, f = n.f, c = f.color; l.color.setRGB(c[0], c[1], c[2]); l.visible = f.on !== false;
    if (n.type === 'DirectionalLight') {
      const d = new THREE.Vector3(...f.direction).normalize(); l.position.copy(d).multiplyScalar(-50); l.target.position.set(0, 0, 0); l.intensity = f.intensity * THREE_PI; return;
    }
    const a = f.attenuation || [1, 0, 0], loc = new THREE.Vector3(...f.location); l.position.copy(loc); l.distance = f.radius > 0 ? f.radius : 0;
    // 19775-1 17.2.2.4: 1 / max(a0 + a1 d + a2 d^2, 1). Normalised by a0 the light keeps one of two shapes (patchShaders): 1 / (1 + b d^2) when a1 = 0, 1 / (1 + |b| d) when a2 = 0.
    // Both terms at once have no counterpart: the quadratic form is fitted to agree at d = radius (or 10 without one), a logged difference.
    const a0 = Math.max(a[0], 1e-6); l.intensity = f.intensity * THREE_PI / a0;
    if (a[1] === 0 && a[2] === 0) l.decay = 0;
    else if (a[1] === 0) l.decay = a[2] / a0;
    else if (a[2] === 0) l.decay = -a[1] / a0;
    else { const d = f.radius > 0 ? f.radius : 10; l.decay = Math.max((a[1] * d + a[2] * d * d) / a0 / (d * d), 1e-6); }
    if (n.type === 'SpotLight') {
      const cut = Math.min(Math.PI / 2 - 1e-3, Math.max(f.cutOffAngle, 1e-3)), beam = Math.min(f.beamWidth, cut), d = new THREE.Vector3(...f.direction).normalize();
      l.angle = cut; l.penumbra = 1 - beam / cut; l.target.position.copy(loc).add(d);
    }
  }
  refreshAmbient() {   // Ia * ambientIntensity(light) * material ambientIntensity (default 0.2) * diffuse; the AmbientLight multiplies by the diffuse colour, the 0.2 is folded in (gap: per material value)
    this.lights = this.lights.filter((l) => l.parent); let r = 0, g = 0, b = 0;
    for (const l of this.lights) { const n = l.userData.node; if (n.f.on === false) continue; r += n.f.ambientIntensity * n.f.color[0]; g += n.f.ambientIntensity * n.f.color[1]; b += n.f.ambientIntensity * n.f.color[2]; }
    this.ambient.color.setRGB(r, g, b); this.ambient.intensity = 0.2 * THREE_PI;
  }
  /* Fog: the first Fog node of the world. X_ITE 16.6.0 (Fog2.glsl): LINEAR  f = max(range - d, 0) / range, EXPONENTIAL  f = exp(-d / max(range - d, 0.001)), d = distance from the eye;
     colour = mix(fogColor, colour, f). three.js fog uses view depth and smoothstep, so patchShaders replaces both formulas; FogExp2.density carries the range. */
  applyFog() {
    const fg = this.world.nodes.find((n) => n.type === 'Fog'); if (!fg || !(fg.f.visibilityRange > 0)) { this.scene.fog = this.worldFog = null; return; }
    this.scene.fog = this.worldFog = this.makeFog(fg);
  }
  makeFog(fg) { const c = fg.f.color, col = new THREE.Color(c[0], c[1], c[2]), t = String(fg.f.fogType).toUpperCase(); return t === 'EXPONENTIAL' || t === 'EXPONENTIAL2' ? new THREE.FogExp2(col, fg.f.visibilityRange) : new THREE.Fog(col, 0, fg.f.visibilityRange); }
  /* LocalFog (19775-1 41.4.3) is a child node: it fogs the geometry of the group it sits in, nothing outside; the nearest group above a mesh that holds an enabled LocalFog with a range decides, else the world Fog.
     three.js has one fog per scene, so each mesh sets scene.fog just before it is drawn (Object3D.onBeforeRender) and the frame puts the world fog back. Its fields are read at every draw, so enabled, colour, range and type changes show at once. */
  fogFor(obj) {
    for (let p = obj.parent; p; p = p.parent) { const l = this.fogScopes.get(p); if (l) { const n = l.find((x) => x.f.enabled !== false && x.f.visibilityRange > 0); if (n) return this.localFog(n); } }
    return this.worldFog || null;
  }
  localFog(n) {
    const want = this.makeFog(n), have = this.localFogs.get(n.id);
    if (have && have.isFogExp2 === !!want.isFogExp2) { have.color.copy(want.color); if (have.isFogExp2) have.density = want.density; else have.far = want.far; return have; }
    this.localFogs.set(n.id, want); return want;
  }
  hookFog(m) { const body = this; m.onBeforeRender = function () { if (body.fogHooks) body.scene.fog = body.fogFor(this); }; }
  /* Background / TextureBackground: see src/nodes/Background.js. The first one in the file is drawn (set_bind between several is not ported: NODES.md). */
  applyBackground() {
    if (this.bgGroup) { this.bgGroup.removeFromParent(); this.bgGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.bgGroup = null; }
    this.scene.background = new THREE.Color(0, 0, 0);   // a world with no Background is black (19775-1 24.4.1)
    const bg = this.world.nodes.find((x) => x.type === 'Background' || x.type === 'TextureBackground'); if (!bg) return;
    this.bgGroup = R.bridge.three.backdrop.make(this, bg); this.scene.add(this.bgGroup);
  }

  /* --------------------------------------------------------------- changes */
  changed(node, field) {
    const t = node.type;
    if ((t === 'Material' || t === 'PhysicalMaterial' || t === 'UnlitMaterial') && R.bridge.three.vol3) R.bridge.three.vol3.changedMaterial(this, node);   // a volume mesh keeps its colours in uniforms
    if (t === 'Inline') {
      for (const r of this.inlines || []) {   // every use of the node (DEF and USE) answers
        if (r.node !== node || r.dead) continue;
        if (field === 'load') { if (node.f.load !== false) this.loadInline(node, r); else this.unloadInline(r); }
        else if (field === 'url') { this.unloadInline(r); if (node.f.load !== false) this.loadInline(node, r); }
        else if (field === 'visible') r.tn.visible = node.f.visible !== false;
      }
      return;
    }
    if (t === 'Switch' && field === 'whichChoice') this.applySwitch(node);
    else if (t === 'Transform' && field !== 'children') { const r = this.rec.get(node.id); if (r && r.tn) { this.applyTransform(node, r.tn); } }
    else if (field === 'children' && this.rec.get(node.id) && this.rec.get(node.id).kids) this.rebuildGroup(node);   // Group, Switch, Transform, Billboard, LOD, Anchor, Collision, StaticGroup
    else if (t === 'Material') for (const m of this.matMeshes(node)) { if (this.isPlain(m)) this.refreshPlain(m.material, node, !!m.geometry.attributes.color); else this.refreshPhong(m.material, node); }
    else if (t === 'PhysicalMaterial') for (const m of this.matMeshes(node)) { if (this.isPlain(m)) this.refreshPlain(m.material, node, !!m.geometry.attributes.color); else this.refreshPBR(m.material, node); }
    else if (t === 'UnlitMaterial') for (const m of this.matMeshes(node)) { if (this.isPlain(m)) this.refreshPlain(m.material, node, !!m.geometry.attributes.color); else this.refreshUnlit(m.material, node); }
    else if (t === 'DirectionalLight' || t === 'PointLight' || t === 'SpotLight') { const l = this.lights.find((x) => x.userData.node === node); if (l) { this.refreshLight(l); this.refreshAmbient(); } }
    else if (t === 'Fog') this.applyFog();
    else if (t === 'ClipPlane') this.clipDirty = true;
    else if (t === 'TwoSidedMaterial') for (const m of this.matMeshes(node)) this.refreshPhong(m.material, this.twoSrc(node, !!m.userData.back));
    else if (t === 'TextureProperties') { for (const tn of this.allNodes()) if (tn.f && tn.f.textureProperties === node) this.retex(tn); }
    else if (t === 'TextureCoordinateGenerator') { for (const g of new Set([...(this.meshesOf.get(node.id) || [])].map((m) => m.userData.shape.f.geometry))) this.regeo(g); }
    else if (t === 'LineProperties' || t === 'FillProperties') { for (const sh of new Set([...(this.meshesOf.get(node.id) || [])].map((m) => m.userData.shape))) this.rebuildShape(sh); }
    else if (t === 'MultiTextureTransform') this.redrawMulti(node);
    else if (t === 'FogCoordinate') { for (const g of this.allNodes()) if (g.f && g.f.fogCoord === node) this.regeo(g); }
    else if (t === 'TextureTransform') { this.redrawMulti(node); for (const m of this.mapMeshes(node)) { const ap = m.userData.shape.f.appearance, mat = ap && ap.f.material, tex = mat && mat.type === 'PhysicalMaterial' ? mat.f.baseTexture : ap && ap.f.texture; const old = m.material.map; m.material.map = this.texFor(tex, node); m.material.needsUpdate = true; if (old && old.userData.copyOf) old.dispose(); } }
    else if (t === 'Background' || t === 'TextureBackground') this.applyBackground();
    else if (t === 'NavigationInfo') this.applyNavigation();
    else if (t === 'Viewpoint' || t === 'OrthoViewpoint') this.viewpointChanged(node, field);
    else if (t === 'Coordinate' || t === 'Color' || t === 'Normal' || t === 'TextureCoordinate') this.geometryChanged(node);
    const sp = R.bridge.specs.get(t); if (sp && (sp.geometry || sp.lines || sp.points) && sp.changed) sp.changed(this, node, field);   // the geometry nodes of the shared bridge keep their own change hooks
    if (T3.changed[t]) T3.changed[t](this, node, field);
  }
  geometryChanged(n) {
    for (const r of [...this.rec.values()]) if (r.node && r.node.type === 'Shape' && r.node.f.geometry && ['coord', 'color', 'normal', 'texCoord'].some((k) => r.node.f.geometry.f[k] === n)) this.rebuildShape(r.node);
  }
  rebuildShape(shape) {   // the Shape's objects are made again from its nodes, in the same place in its parent
    const r = this.rec.get(shape.id); if (!r) return; if (shape.f.geometry) this.geoCache.delete(shape.f.geometry.id);
    const parent = r.tn.parent, vis = r.tn.visible; this.tcgMeshes = (this.tcgMeshes || []).filter((m) => !r.meshes.includes(m));
    for (const [id, l] of this.meshesOf) { const k = l.filter((m) => !r.meshes.includes(m)); if (k.length) this.meshesOf.set(id, k); else this.meshesOf.delete(id); }
    this.disposeObj(r.tn); const nr = this.buildShape(shape, parent, r.chain.slice(1));
    for (const pr of this.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; }
    nr.tn.visible = vis;
  }
  /* a TextureProperties changed: the texture is made again (its copies carrying a TextureTransform too) and set on the meshes that show it */
  retex(texN) {
    const old = this.texCache.get(texN.id); this.texCache.delete(texN.id); if (old) old.dispose();
    for (const m of this.mapMeshes(texN)) { const ap = m.userData.shape.f.appearance, prev = m.material.map; m.material.map = this.texFor(texN, ap && ap.f.textureTransform); m.material.needsUpdate = true; if (prev && prev.userData.copyOf) prev.dispose(); }
  }
  /* a TextureTransform, or the MultiTextureTransform that holds it, changed: the MultiTextures drawn through it are composed again */
  redrawMulti(tt) {
    for (const a of this.allNodes()) { const x = a.type === 'Appearance' && a.f.texture; if (!x || x.type !== 'MultiTexture') continue; const at = a.f.textureTransform; if (at === tt || (at && at.f.textureTransform && [].concat(at.f.textureTransform).includes(tt))) { const dt = this.texCache.get(x.id); if (dt && dt.userData.redraw) dt.userData.redraw(); } }
  }
  disposeObj(o) { o.removeFromParent(); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { R.bridge.three.cube.drop(this, x.material); x.material.dispose(); } }); }
  rebuildGroup(node) {
    const r = this.rec.get(node.id); if (!r) return;
    for (const k of r.kids) this.disposeRec(k);
    this.clips = (this.clips || []).filter((cl) => cl.parent !== r.tn);   // the ClipPlanes of this group are built again below
    r.kids = node.f.children.map((c) => this.build(c, r.tn, r.chain)); if (node.type === 'Switch') this.applySwitch(node); if (node.type === 'LOD') r.level = -1; this.clipDirty = true;
  }
  disposeRec(k) {
    if (!k) return; k.dead = true; (k.kids || []).forEach((x) => this.disposeRec(x)); if (k.world) { this.releaseWorld(k.world); k.world = null; } if (this.inlines) this.inlines.delete(k);
    if (k.tn && k.node && k.node.type !== 'Viewpoint' && k.node.type !== 'OrthoViewpoint') this.disposeObj(k.tn); if (k.node && this.rec.get(k.node.id) === k) this.rec.delete(k.node.id);   // a USE'd node has one entry: only its own record is taken out
  }
  adopt(node, parentNode) {
    const pr = parentNode ? this.rec.get(parentNode.id) : null, cr = this.build(node, pr ? pr.tn : this.root, pr ? pr.chain : []);
    if (pr && pr.kids && cr) pr.kids.push(cr); return cr;
  }

  /* ---------------------------------------------------------------- camera */
  viewpointList() { return this.world ? R.bridge.viewpoints(this.world, this.pose ? this.pose.pos : null) : []; }   // the page's viewpoint list with the ViewpointGroup rules (nodes/Geo.js)
  vpPose(vp) {
    if (vp.type === 'GeoViewpoint') return T3.geo.pose(this, vp);
    const f = vp.f, par = (this.vpParent && this.vpParent.get(vp)) || null;
    let pos = f.position.slice(), q = R.quat.fromAxisAngle(f.orientation, f.orientation[3]), center = f.centerOfRotation.slice();
    if (par && par !== this.root) {
      par.updateWorldMatrix(true, false); const M = par.matrixWorld, P = new THREE.Vector3(...pos).applyMatrix4(M), C = new THREE.Vector3(...center).applyMatrix4(M);
      const sc = new THREE.Vector3(), rq = new THREE.Quaternion(), tr = new THREE.Vector3(); M.decompose(tr, rq, sc);
      pos = [P.x, P.y, P.z]; center = [C.x, C.y, C.z]; q = R.quat.mul([rq.x, rq.y, rq.z, rq.w], q);
    }
    if (vp.type === 'OrthoViewpoint') return { pos, q: R.quat.norm(q), center, fov: 0.7854, ortho: { f: Array.from(f.fieldOfView), near: f.nearDistance, far: f.farDistance, scale: 1 } };   // 19775-1 23.3.8: fieldOfView = minX minY maxX maxY, the view's width and height in the units of the space
    return { pos, q: R.quat.norm(q), center, fov: f.fieldOfView };
  }
  applyCamera() {
    const c = this.poseCamera(this.pose, this.camP, this.camO, (this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1));
    if (c !== this.cam) { this.cam = c; c.add(this.headlight, this.headlight.target); }   // the headlight rides on whichever camera draws
  }
  /* a pose onto the perspective camera or, for an OrthoViewpoint, the orthographic one; returns the one used. The layers and viewports (nodes/Layering.js) pose cameras of their own the same way */
  poseCamera(p, camP, camO, aspect) {
    const o = p.ortho, c = o ? camO : camP;
    c.position.set(p.pos[0], p.pos[1], p.pos[2]); c.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);   // a Viewpoint looks down -Z with +Y up, as a three.js camera does
    if (o) {   // the box fieldOfView is kept whole: the longer side of the canvas shows more of the world, as the Babylon body does
      const f = o.f, s = o.scale || 1, x0 = (f[0] ?? -1) * s, y0 = (f[1] ?? -1) * s, x1 = (f[2] ?? 1) * s, y1 = (f[3] ?? 1) * s, sx = x1 - x0, sy = y1 - y0;
      if (aspect > sx / sy) { const cx = (x0 + x1) / 2, hw = sy * aspect / 2; c.left = cx - hw; c.right = cx + hw; c.bottom = y0; c.top = y1; }
      else { const cy = (y0 + y1) / 2, hh = sx / aspect / 2; c.left = x0; c.right = x1; c.bottom = cy - hh; c.top = cy + hh; }
      c.near = o.near > 0 ? o.near : 0.1; c.far = o.far > 0 ? o.far : 1e4; c.updateProjectionMatrix(); return c;
    }
    c.fov = THREE.MathUtils.radToDeg(aspect >= 1 ? p.fov : 2 * Math.atan(Math.tan(p.fov / 2) / aspect));   // X3D fieldOfView is the angle across the smaller side of the view
    c.aspect = aspect; const d = Math.hypot(p.pos[0] - p.center[0], p.pos[1] - p.center[1], p.pos[2] - p.center[2]);
    c.near = Math.max(0.3, Math.min(2, d * 0.004)); c.far = Math.max(2000, d * 12); if (p.geo) { c.near = p.geo.near; c.far = p.geo.far; } c.updateProjectionMatrix(); return c;
  }
  bindViewpoint(vp, on) {
    if (!on) { vp.f.isBound = false; return; }
    const prev = this.bound; if (prev && prev !== vp) { prev.f.isBound = false; R.events.emit(prev, 'isBound', false); }
    this.vpKey = null; this.bound = vp; vp.f.isBound = true; R.events.emit(vp, 'isBound', true); vp.f.bindTime = (performance.timeOrigin + performance.now()) / 1000;
    const nav = this.world && this.world.nodes.find((n) => n.type === 'NavigationInfo');
    const tt = nav ? String(nav.f.transitionType[0] || 'LINEAR').toUpperCase() : 'LINEAR', dur = nav ? Math.max(nav.f.transitionTime || 1, 0.05) : 1, to = this.vpPose(vp);
    if (!prev || tt === 'TELEPORT' || !this.started || to.ortho || this.pose.ortho || to.geo || this.pose.geo) {   // a move into or out of an orthographic view is a cut
      this.pose = to; this.tr = null; this.started = true; this.applyCamera(); return; }
    this.tr = { from: { pos: this.pose.pos.slice(), q: this.pose.q.slice(), center: this.pose.center.slice(), fov: this.pose.fov }, to, t0: performance.now(), dur: dur * 1000 };
  }
  viewpointChanged(vp, field) {
    if (vp !== this.bound) return; const to = this.vpPose(vp);
    if (to.ortho && ['fieldOfView', 'nearDistance', 'farDistance', 'position', 'orientation', 'centerOfRotation'].includes(field)) { to.ortho.scale = (this.pose.ortho && this.pose.ortho.scale) || 1; this.pose = to; this.tr = null; this.applyCamera(); return; }
    if (field === 'fieldOfView') { if (this.tr) this.tr.to.fov = to.fov; else { this.pose.fov = to.fov; this.applyCamera(); } }
    else if (['position', 'orientation', 'centerOfRotation'].includes(field)) { this.pose = to; this.tr = null; this.applyCamera(); }
  }
  stepTransition() {
    const t = this.tr; if (!t) return; const s = (performance.now() - t.t0) / t.dur;
    if (s >= 1) { this.pose = { pos: t.to.pos.slice(), q: t.to.q.slice(), center: t.to.center.slice(), fov: t.to.fov }; this.tr = null; this.applyCamera(); return; }
    const e = s * s * (3 - 2 * s), L = (a, b) => a + (b - a) * e;
    this.pose = { pos: [0, 1, 2].map((i) => L(t.from.pos[i], t.to.pos[i])), center: [0, 1, 2].map((i) => L(t.from.center[i], t.to.center[i])), q: R.quat.slerp(t.from.q, t.to.q, e), fov: L(t.from.fov, t.to.fov) };
    this.applyCamera();
  }
  userPosition() { const p = this.pose.pos; return { x: p[0], y: p[1], z: p[2] }; }
  /* EXAMINE: drag orbits about the centre of rotation, the wheel dollies. Pointer sensors, picking and the other navigation types are not ported yet (NODES.md). */
  setupInput() { R.bridge.three.pointer.init(this); }
  orbit(dx, dy) {
    this.tr = null; const p = this.pose, c = new THREE.Vector3(...p.center), off = new THREE.Vector3(...p.pos).sub(c), up = new THREE.Vector3(0, 1, 0);
    off.applyAxisAngle(up, -dx * 0.008); const right = new THREE.Vector3().crossVectors(up, off).normalize(); off.applyAxisAngle(right, -dy * 0.008);
    const pos = c.clone().add(off), m = new THREE.Matrix4().lookAt(pos, c, up), q = new THREE.Quaternion().setFromRotationMatrix(m);
    this.pose = { ...p, pos: [pos.x, pos.y, pos.z], q: [q.x, q.y, q.z, q.w] }; this.applyCamera();
  }
  zoom(f) { const p = this.pose; this.tr = null; if (p.ortho) { p.ortho.scale = Math.min(50, Math.max(0.02, (p.ortho.scale || 1) * f)); this.applyCamera(); return; }   // moving along the view axis changes nothing in an orthographic view: the zoom scales the box
     this.pose = { ...p, pos: [0, 1, 2].map((i) => p.center[i] + (p.pos[i] - p.center[i]) * f) }; this.applyCamera(); }

  /* ------------------------------------------------------------ frame loop */
  frame() {
    const now = (performance.timeOrigin + performance.now()) / 1000;
    if (this.world) { R.events.begin(now); for (const n of this.timeSensors || []) R.tickTimeSensor(n, now); R.events.drain(); this.stepTransition(); }
    this.updateView(); this.renderAll(); if (this.fogHooks) this.scene.fog = this.worldFog; this.stats.frames++;
    this.frameTimes.push(performance.now()); if (this.frameTimes.length > 30) this.frameTimes.shift();
    if (this.frameWaiters && this.frameWaiters.length) { const w = this.frameWaiters; this.frameWaiters = []; w.forEach((f) => f()); }
    if (this.opts.onFrame) this.opts.onFrame(this);
  }
  /* Per-frame state that depends on the camera: Billboard turning, LOD level, ClipPlane planes in world space. Called before every render (frame and shot). */
  updateView() {
    if (!this.world) return;
    const T = THREE, V = T.Vector3; this.scene.updateMatrixWorld(true); this.cam.updateMatrixWorld(true);
    const eye = this.cam.getWorldPosition(new V()), up = new V(0, 1, 0).transformDirection(this.cam.matrixWorld);
    const toLocal = (o) => { const inv = new T.Matrix4().copy(o.parent ? o.parent.matrixWorld : new T.Matrix4()).invert(); return { inv, p: eye.clone().applyMatrix4(inv), up: up.clone().transformDirection(inv) }; };
    /* 19775-1 Billboard: with axisOfRotation 0 0 0 the node's +Z points at the eye and its +Y follows the viewer's up; with an axis it turns about that axis only */
    this.billboards = (this.billboards || []).filter((r) => r.tn.parent);   // a record whose group left the scene is dropped
    for (const r of this.billboards) {   // parent first, so a Billboard inside a Billboard sees its parent's new turn
      const L = toLocal(r.tn), d = L.p.clone(); if (d.lengthSq() < 1e-12) continue; d.normalize();
      const ax = r.node.f.axisOfRotation, q = r.tn.quaternion;
      if (!ax[0] && !ax[1] && !ax[2]) {
        let x = new V().crossVectors(L.up, d); if (x.lengthSq() < 1e-10) x = new V().crossVectors(new V(1, 0, 0), d); x.normalize();
        q.setFromRotationMatrix(new T.Matrix4().makeBasis(x, new V().crossVectors(d, x), d));
      } else {
        const a = new V(ax[0], ax[1], ax[2]).normalize(), p = d.clone().sub(a.clone().multiplyScalar(a.dot(d)));
        if (p.lengthSq() < 1e-10) q.identity(); else { p.normalize(); q.setFromAxisAngle(a, Math.atan2(new V(0, 0, 1).cross(p).dot(a), p.z)); }
      }
      r.tn.updateMatrixWorld(true);
    }
    /* LOD: the level is the number of ranges at or below the distance from the eye to the LOD's centre, measured in the LOD's own frame; children[level] is the one shown (X_ITE and the Babylon body agree).
       A Viewpoint child shares its parent's object and is left alone; a child with visible FALSE stays hidden. */
    for (const r of this.lods || []) {
      if (!r.tn.parent) continue; const c = r.node.f.center, rg = r.node.f.range, L = toLocal(r.tn);
      const d = Math.hypot(L.p.x - c[0], L.p.y - c[1], L.p.z - c[2]); let lv = 0; while (lv < rg.length && d >= rg[lv]) lv++;
      lv = Math.min(lv, r.kids.length - 1);
      if (lv !== r.level) { r.level = lv; r.kids.forEach((k, i) => { if (k && k.tn && k.node.type !== 'Viewpoint' && k.node.type !== 'OrthoViewpoint') k.tn.visible = i === lv && k.node.f.visible !== false; }); }
    }
    this.renderer.getDrawingBufferSize(this.screenU.res.value);
    if (this.bgGroup) { const R0 = this.cam.far * 0.5; this.bgGroup.position.copy(eye); this.bgGroup.scale.setScalar(R0); }   // the backdrop rides on the camera and fills it to the far plane
    this.screenU.ratio.value = this.renderer.getPixelRatio();
    /* TextureCoordinateGenerator, camera-space modes: the uv of every vertex from the model-view matrix, redone in a frame in which the camera or the mesh moved */
    this.tcgMeshes = (this.tcgMeshes || []).filter((m) => m.parent && m.geometry.userData.tcg);
    for (const m of this.tcgMeshes) {
      const mv = new T.Matrix4().multiplyMatrices(this.cam.matrixWorldInverse, m.matrixWorld), key = mv.elements.join(',') + m.geometry.userData.tcg.mode; if (m.userData.tcgKey === key) continue; m.userData.tcgKey = key;
      R.bridge.three.tcg.make(m.geometry, m.geometry.userData.tcg.mode, m.geometry.userData.tcg.params, mv, !!(m.material.userData && m.material.userData.cubeU));
    }
    /* ClipPlane: the plane (a b c d) of 19775-1 is in the frame of the node's parent group and keeps the half space where a x + b y + c z + d >= 0, which is three.js's own rule.
       Every enabled plane that applies to a mesh is set on its material (three.js intersects them); a disabled one adds nothing. Entries whose group left the scene are dropped. */
    const attached = (o) => { while (o.parent) o = o.parent; return o === this.scene; };
    const clips = (this.clips = (this.clips || []).filter((cl) => attached(cl.parent)));
    if (this.clipDirty) { this.clipDirty = false; for (const cl of clips) { cl.meshes = []; cl.parent.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) cl.meshes.push(o); }); } this.renderer.localClippingEnabled = clips.length > 0; }
    if (clips.length) {
      const planesOf = new Map();
      for (const cl of clips) {
        const f = cl.node.f, pl = f.plane, n = new V(pl[0], pl[1], pl[2]), len = n.length() || 1;
        const plane = new T.Plane(n.divideScalar(len), pl[3] / len).applyMatrix4(cl.parent.matrixWorld);
        for (const m of cl.meshes) { const mt = m.material; if (!mt) continue; const l = planesOf.get(mt) || planesOf.set(mt, []).get(mt); if (f.enabled !== false) l.push(plane); }
      }
      for (const [mt, l] of planesOf) mt.clippingPlanes = l;
    }
    if (this.cubeMats) for (const m of this.cubeMats) m.userData.cubeU.cubeRot.value.setFromMatrix4(this.cam.matrixWorld);   // view space -> world space for the cube maps that hold pictures of the world
    R.bridge.three.cube.takePictures(this);
    { const vp = this.bound, par = vp && vp.type !== 'GeoViewpoint' && this.vpParent && this.vpParent.get(vp);   // a bound Viewpoint inside a Transform that moves after load: the camera follows its parent (X_ITE does)
      if (par && par !== this.root) { const key = par.matrixWorld.elements.join(','); if (this.vpKey && this.vpKey !== key) { const to = this.vpPose(vp); if (to.ortho) to.ortho.scale = (this.pose.ortho && this.pose.ortho.scale) || 1; if (this.tr) this.tr.to = to; else { this.pose = to; this.applyCamera(); } } this.vpKey = key; } else this.vpKey = null; }
    R.bridge.three.hanim.update(this);   // the skins of the humanoids (CPU skinning, after the joints' matrices)
    R.bridge.three.proj.update(this);   // the projectors' matrices and scope masks
    if (R.bridge.three.particles) R.bridge.three.particles.update(this);   // the CPU particle systems
    if (R.bridge.three.sound) R.bridge.three.sound.update(this);   // the audio listener and spatial sources, in the view space of the camera
    R.bridge.three.layers.update(this);   // the cameras, bits, rectangles of the layers and viewports, then the layouts
  }
  /* One picture: the world alone, or, with a LayerSet or a world Viewport (nodes/Layering.js), one pass per entry of this.passes in order: each through its own camera, its own rectangle of the canvas
     and its own layer bit, the depth buffer cleared in the rectangle between two passes so a later layer is in front. The first pass clears the whole canvas. */
  renderAll() {
    const r = this.renderer, ps = this.passes;
    if (!ps || !ps.length) { r.render(this.scene, this.cam); return; }
    const W = this.canvas.clientWidth || 1, H = this.canvas.clientHeight || 1, ac = r.autoClear; r.autoClear = false;
    r.setScissorTest(false); r.setViewport(0, 0, W, H); r.clear(true, true, true);
    ps.forEach((p, i) => {
      const x = p.vp[0] * W, y = p.vp[1] * H, w = p.vp[2] * W, h = p.vp[3] * H; r.setViewport(x, y, w, h); r.setScissor(x, y, w, h); r.setScissorTest(!(p.vp[2] >= 1 && p.vp[3] >= 1));
      if (i) r.clearDepth();
      if (this.headlight.parent !== p.cam) p.cam.add(this.headlight, this.headlight.target);   // the headlight rides on the camera that draws (a pass camera is in the scene, so its children are drawn)
      const bg = this.scene.background; if (i) this.scene.background = null;   // the Background is the world's: a later pass paints over the pictures before it
      r.render(this.scene, p.cam);
      this.scene.background = bg;
    });
    this.cam.add(this.headlight, this.headlight.target); r.setScissorTest(false); r.setViewport(0, 0, W, H); r.autoClear = ac;
  }
  fps() { const t = this.frameTimes; return t.length > 2 ? 1000 * (t.length - 1) / (t[t.length - 1] - t[0]) : 0; }
  shot() { this.updateView(); this.renderAll(); if (this.fogHooks) this.scene.fog = this.worldFog; return this.renderer.domElement.toDataURL('image/png'); }
}
