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
    this.rec = new Map(); this.geoCache = new Map(); this.texCache = new Map(); this.meshesOf = new Map();
    this.notes = new Set(); this.frameTimes = []; this.stats = { frames: 0 };
    this.pose = { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: 0.7854 };
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
    this.cam = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);
    this.scene.add(this.cam);
    this.headlight = new THREE.DirectionalLight(0xffffff, THREE_PI); this.headlight.position.set(0, 0, 1); this.headlight.target.position.set(0, 0, -1);
    this.cam.add(this.headlight, this.headlight.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0); this.scene.add(this.ambient);
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
    this.clearWorld();
    this.world = world; this.baseUrl = baseUrl; this.resolve = resolve || ((u) => u);
    this.root = new THREE.Group(); this.root.name = 'x3d-root'; this.scene.add(this.root);
    for (const n of world.children) this.build(n, this.root, []);
    this.applyBackground(); this.applyNavigation(); this.applyFog();
    const first = world.nodes.find((n) => n.type === 'Viewpoint');   // 19775-1 23.4.1: the first Viewpoint in the file is bound at load (the Babylon stock body does this in body-br.js)
    if (first) { this.started = false; this.bindViewpoint(first, true); }
  }
  clearWorld() {
    if (!this.root) return;
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
    this.scene.remove(this.root); this.scene.fog = null;
    this.rec.clear(); this.geoCache.clear(); this.lights = []; this.billboards = []; this.lods = []; this.clips = []; this.clipDirty = false; this.bound = null; this.viewpoints = []; this.root = null;
  }

  build(n, parent, chain) {
    if (!n) return null;
    switch (n.type) {
      case 'Group': case 'Switch': case 'Transform': case 'Billboard': case 'LOD': case 'Anchor': case 'Collision': case 'StaticGroup': return this.buildGroup(n, parent, chain);   // Anchor, Collision and StaticGroup draw as plain groups (the link, the collision test and the freezing are the SAI's and the navigation's business)
      case 'ClipPlane': (this.clips ||= []).push({ node: n, parent }); this.clipDirty = true; return null;
      case 'Shape': return this.buildShape(n, parent, chain);
      case 'Viewpoint': { const r = { node: n, parent, tn: parent }; this.rec.set(n.id, r); (this.viewpoints ||= []).includes(n) || this.viewpoints.push(n); this.vpParent ||= new Map(); this.vpParent.set(n, parent); return r; }
      case 'DirectionalLight': case 'PointLight': case 'SpotLight': return this.buildLight(n, parent);
      case 'NavigationInfo': case 'Background': case 'Fog': case 'WorldInfo': case 'TimeSensor': case 'ScalarInterpolator': case 'PositionInterpolator': case 'OrientationInterpolator': case 'ColorInterpolator': return null;
      default: { const fn = T3.build[n.type]; if (!fn) this.note('three.js body: skipped <' + n.type + '>'); else return fn(this, n, parent, chain); return null; }
    }
  }
  buildGroup(n, parent, chain) {
    const o = new THREE.Group(); o.name = n.def || n.type; parent.add(o);
    const r = { node: n, tn: o, kids: [], chain: [n, ...chain] }; this.rec.set(n.id, r);
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
  applySwitch(n) { const r = this.rec.get(n.id); if (r) r.kids.forEach((k, i) => { if (k && k.tn) k.tn.visible = i === n.f.whichChoice; }); }

  /* ---------------------------------------------------------------- shapes */
  buildShape(n, parent, chain) {
    const f = n.f, g = f.geometry, app = f.appearance, r = { node: n, meshes: [], chain: [n, ...chain] }; this.rec.set(n.id, r);
    const o = new THREE.Group(); o.name = 'shape-' + (n.def || n.id); parent.add(o); r.tn = o;
    if (!g) return r;
    const pl = this.pointLine(g, app);   // lines and points: unlit, drawn in the Material's emissiveColor (or the Color node), not as triangles
    const geo = pl ? pl.geo : this.threeGeometry(g); if (!geo) return r;
    const mat = pl ? pl.mat : this.makeMaterial(n, g, app);
    const mesh = pl ? new (pl.points ? THREE.Points : THREE.LineSegments)(geo, mat) : new THREE.Mesh(geo, mat); mesh.userData = { shape: n, chain: r.chain }; o.add(mesh); r.meshes.push(mesh);
    for (const dep of [app && app.f.material, app && app.f.texture, app && app.f.textureTransform, g]) if (dep) (this.meshesOf.get(dep.id) || this.meshesOf.set(dep.id, []).get(dep.id)).push(mesh);
    if (f.visible === false) o.visible = false;
    return r;
  }
  threeGeometry(g) {
    const f = g.f, T = THREE;
    switch (g.type) {
      case 'Box': return new T.BoxGeometry(f.size[0], f.size[1], f.size[2]);
      case 'Sphere': { const g2 = new T.SphereGeometry(f.radius, 48, 32); g2.rotateY(-Math.PI / 2); return g2; }   // X3D: u = 0 at -Z and grows toward -X (X_ITE QuadSphereOptions); three.js starts at -X and grows toward +Z
      case 'Cylinder': return this.x3dRound(new T.CylinderGeometry(f.radius, f.radius, f.height, 48, 1, false));
      case 'Cone': return this.x3dRound(new T.ConeGeometry(f.bottomRadius, f.height, 48, 1, f.bottom === false));
      case 'IndexedFaceSet': case 'IndexedTriangleSet': {
        let d = this.geometryData(g);
        if (g.type === 'IndexedFaceSet') { const x = R.bridge.ifsExtras(g, d); if (x.nrm || x.col) d = { ...d, nrm: x.nrm || d.nrm, col: x.col || d.col }; }   // Normal node, creaseAngle, per-face colour: see Geometry.js
        return this.dataGeometry(d);
      }
      default: {
        const fn = T3.geometry[g.type]; if (fn) return fn(g, this);
        const sp = R.bridge.specs.get(g.type);   // a node of the shared bridge with a geometry() hook returns plain vertex data {pos, nrm, uv, col, idx}: the same hook the Babylon body reads, wrapped here in a BufferGeometry
        if (sp && sp.geometry) { const d = sp.geometry(g, this); return d && d.pos && d.pos.length ? this.dataGeometry(d) : null; }
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
  geometryData(g) { return Geo.geometryData.call(this, g); }
  /* IndexedLineSet, LineSet (spec.lines) and Polyline2D draw as LineSegments, PointSet (and spec.points) as Points. 19775-1 12.2.2: with no Material they are white and unlit; with one, emissiveColor
     is the colour, and a Color node replaces it. X_ITE draws both one pixel wide (line width and point size are not exposed in WebGL2 beyond that: LineProperties is a gap, see README). */
  pointLine(g, app) {
    const T = THREE, sp = R.bridge.specs.get(g.type), isPts = g.type === 'PointSet' || !!(sp && sp.points), isLine = g.type === 'IndexedLineSet' || !!(sp && sp.lines);
    if (!isPts && !isLine) return null;
    const geo = new T.BufferGeometry(); let colors = null;
    if (isPts) {
      const P = sp && sp.points ? sp.points(g) : g.f.coord && g.f.coord.f.point; if (!P || !P.length) return null;
      geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(P), 3));
      const C = g.f.color && g.f.color.f.color; if (C && C.length >= P.length) { colors = Float32Array.from(C.subarray ? C.subarray(0, P.length) : C.slice(0, P.length)); }
    } else {
      const L = sp && sp.lines ? sp.lines(g) : null, P = L && L.coord ? L.coord : g.f.coord && g.f.coord.f.point, ci = L ? L.coordIndex : g.f.coordIndex; if (!P || !P.length) return null;
      const C = g.f.color && g.f.color.f.color, perV = g.f.colorPerVertex !== false, pos = [], col = [];
      let run = 0;
      for (const r2 of R.bridge.runs(ci)) {
        for (let k = 0; k + 1 < r2.length; k++) for (const v of [r2[k], r2[k + 1]]) {
          pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
          if (C) { const c = (perV ? v : run) * 3; col.push(C[c], C[c + 1], C[c + 2]); }
        }
        run++;
      }
      if (!pos.length) return null;
      geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(pos), 3)); if (C && col.length) colors = Float32Array.from(col);
    }
    if (colors) geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    const mat = isPts ? new T.PointsMaterial({ size: 1, sizeAttenuation: false }) : new T.LineBasicMaterial();
    this.refreshPlain(mat, app && app.f.material, !!colors); return { geo, mat, points: isPts };
  }
  refreshPlain(m, mat, hasColors) {
    const e = mat && (mat.f.emissiveColor || (mat.f.baseColor && [0, 0, 0])) || [1, 1, 1];
    m.color.setRGB(hasColors ? 1 : e[0], hasColors ? 1 : e[1], hasColors ? 1 : e[2]); m.vertexColors = hasColors; m.fog = true;
    m.opacity = mat ? 1 - (mat.f.transparency || 0) : 1; m.transparent = m.opacity < 0.999; m.needsUpdate = true;
  }
  dataGeometry(d) {
    const T = THREE, geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(d.pos), 3)); geo.setIndex(new T.BufferAttribute(Uint32Array.from(d.idx), 1));
    if (d.nrm) geo.setAttribute('normal', new T.BufferAttribute(Float32Array.from(d.nrm), 3)); else geo.computeVertexNormals();
    if (d.uv) geo.setAttribute('uv', new T.BufferAttribute(Float32Array.from(d.uv), 2));
    if (d.col) geo.setAttribute('color', new T.BufferAttribute(Float32Array.from(d.col), 3));
    return geo;
  }
  /* a geometry node's own fields changed (the shared bridge nodes call this as body.regeo(node)): drop its cached data and give every mesh that draws it a fresh BufferGeometry */
  regeo(n) {
    this.geoCache.delete(n.id);
    for (const m of this.meshesOf.get(n.id) || []) {
      const app = m.userData.shape.f.appearance, pl = (m.isLineSegments || m.isPoints) ? this.pointLine(n, app) : null, g = pl ? pl.geo : this.threeGeometry(n);
      if (g) { m.geometry.dispose(); m.geometry = g; if (pl) { m.material.dispose(); m.material = pl.mat; } }
    }
  }

  /* ImageTexture (url) and PixelTexture (image: width height components pixels...; rows run bottom to top, as X3D images do, so flipY stays off for the data texture). */
  tex(node) {
    if (!node) return null; const hit = this.texCache.get(node.id); if (hit) return hit; let t = null;
    if (node.type === 'PixelTexture') {
      const im = node.f.image || [], w = im[0] | 0, h = im[1] | 0, k = im[2] | 0; if (!(w > 0 && h > 0 && k >= 1 && k <= 4)) return null;
      const d = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) { const v = im[3 + i] >>> 0; let r, g, b, a = 255;
        if (k === 1) r = g = b = v & 255; else if (k === 2) { r = g = b = (v >> 8) & 255; a = v & 255; } else if (k === 3) { r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255; } else { r = (v >>> 24) & 255; g = (v >> 16) & 255; b = (v >> 8) & 255; a = v & 255; }
        d.set([r, g, b, a], i * 4); }
      t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    } else {
      if (!node.f.url || !node.f.url.length) return null;
      t = new THREE.TextureLoader().load(this.resolve(node.f.url[0], this.baseUrl));
    }
    t.wrapS = node.f.repeatS === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = node.f.repeatT === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    this.texCache.set(node.id, t); return t;
  }
  /* TextureTransform: the matrix of 19775-1 18.4.5 (-C S R C T, not the Transform order), set as the 3x3 uv matrix of a copy of the texture (the copy shares the image, so one texture can carry two transforms) */
  texFor(texN, ttN) {
    const t = this.tex(texN); if (!t || !ttN) return t; const f = ttN.f, c = f.center, r = f.rotation, s = f.scale, tr = f.translation, M = THREE.Matrix3;
    const T = (x, y) => new M().set(1, 0, x, 0, 1, y, 0, 0, 1), S = (x, y) => new M().set(x, 0, 0, 0, y, 0, 0, 0, 1), Rm = (a) => new M().set(Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1);
    const m = new M().multiplyMatrices(T(-c[0], -c[1]), S(s[0], s[1])).multiply(Rm(r)).multiply(T(c[0], c[1])).multiply(T(tr[0], tr[1]));   // the product as 19775-1 writes it, -C S R C T, taken as a column-vector matrix: found by trying the order and sign variants against X_ITE (50.1 dB; the T C R S -C order of Transform gives 21.3 dB)
    const u = t.clone(); u.userData.copyOf = true; u.matrixAutoUpdate = false; u.matrix.copy(m); u.needsUpdate = true; return u;
  }
  /* Material -> MeshPhongMaterial (the Phong model X3D and X_ITE share); PhysicalMaterial -> MeshPhysicalMaterial (the glTF model, linear colours) */
  makeMaterial(shape, g, app) {
    const T = THREE, mat = app && app.f.material, texN = app && app.f.texture, side = g.f.solid === true ? T.FrontSide : T.DoubleSide;
    let m;
    if (mat && mat.type === 'PhysicalMaterial') { m = new T.MeshPhysicalMaterial({ side }); this.refreshPBR(m, mat); m.map = this.texFor(mat.f.baseTexture, app && app.f.textureTransform); }
    else if (mat && mat.type === 'Material') { m = new T.MeshPhongMaterial({ side, specular: 0 }); this.refreshPhong(m, mat); m.map = this.texFor(texN, app && app.f.textureTransform); }
    else if (mat && mat.type === 'UnlitMaterial') { m = new T.MeshBasicMaterial({ side }); this.refreshUnlit(m, mat); m.map = this.texFor(texN, app && app.f.textureTransform); }   // 19775-1 4.0: no lighting, emissiveColor is the colour
    else { m = new T.MeshBasicMaterial({ side, color: 0xffffff }); m.map = this.texFor(texN, app && app.f.textureTransform); }   // no Material: unlit, white, texture as is (19775-1 12.2.2)
    if (g.f.color || (g.f.colorPerVertex !== undefined && g.type.startsWith('Indexed') && g.f.color)) m.vertexColors = true;
    return m;
  }
  refreshPhong(m, mat) {
    const f = mat.f; m.color.setRGB(f.diffuseColor[0], f.diffuseColor[1], f.diffuseColor[2]); m.emissive.setRGB(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.specular.setRGB(f.specularColor[0], f.specularColor[1], f.specularColor[2]); m.shininess = Math.max(f.shininess * 128 * (this.opts.shininessScale || 4), 1e-3);   // X_ITE evaluates Phong with the reflection vector; Blinn-Phong (three.js) needs about 4x the exponent for the same highlight width
    m.opacity = 1 - f.transparency; m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent; m.needsUpdate = true;
  }
  refreshUnlit(m, mat) { const e = mat.f.emissiveColor || [1, 1, 1]; m.color.setRGB(e[0], e[1], e[2]); m.opacity = 1 - (mat.f.transparency || 0); m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent; m.needsUpdate = true; }
  refreshPBR(m, mat) {
    const f = mat.f; m.color.setRGB(f.baseColor[0], f.baseColor[1], f.baseColor[2]); m.metalness = f.metallic; m.roughness = f.roughness; m.emissive.setRGB(f.emissiveColor[0], f.emissiveColor[1], f.emissiveColor[2]);
    m.opacity = 1 - f.transparency; m.transparent = m.opacity < 0.999; m.depthWrite = !m.transparent;
  }

  /* ---------------------------------------------------------------- lights */
  applyNavigation() { const nav = this.world.nodes.find((n) => n.type === 'NavigationInfo'); this.headlight.visible = !nav || nav.f.headlight !== false; }
  /* A light is a child of the object of its parent group, so every Transform above it moves and turns it with no refresh (the Babylon body does the same with a TransformNode).
     DirectionalLight: direction; PointLight: location, radius (hard edge, see patchShaders), attenuation; SpotLight: the same plus direction, beamWidth, cutOffAngle. */
  buildLight(n, parent) {
    const T = THREE, l = n.type === 'DirectionalLight' ? new T.DirectionalLight(0xffffff, THREE_PI) : n.type === 'SpotLight' ? new T.SpotLight(0xffffff, THREE_PI) : new T.PointLight(0xffffff, THREE_PI);
    l.name = (n.def || n.type) + '-light'; l.userData.node = n; parent.add(l); if (l.target) parent.add(l.target);
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
    const fg = this.world.nodes.find((n) => n.type === 'Fog'); if (!fg || !(fg.f.visibilityRange > 0)) { this.scene.fog = null; return; }
    const c = fg.f.color, col = new THREE.Color(c[0], c[1], c[2]), t = String(fg.f.fogType).toUpperCase();
    this.scene.fog = t === 'EXPONENTIAL' ? new THREE.FogExp2(col, fg.f.visibilityRange) : new THREE.Fog(col, 0, fg.f.visibilityRange);
      }
  applyBackground() {
    const bg = this.world.nodes.find((x) => x.type === 'Background'); if (!bg) { this.scene.background = new THREE.Color(0, 0, 0); return; }
    const c = bg.f.skyColor[0] || [0, 0, 0], last = bg.f.skyColor[bg.f.skyColor.length - 1] || c, g = bg.f.groundColor && bg.f.groundColor.length ? bg.f.groundColor[bg.f.groundColor.length - 1] : last;
    this.scene.background = new THREE.Color((last[0] + g[0]) / 2 * 0.6 + c[0] * 0.4, (last[1] + g[1]) / 2 * 0.6 + c[1] * 0.4, (last[2] + g[2]) / 2 * 0.6 + c[2] * 0.4);   // same flat approximation as the Babylon body, so the two stay comparable
  }

  /* --------------------------------------------------------------- changes */
  changed(node, field) {
    const t = node.type;
    if (t === 'Switch' && field === 'whichChoice') this.applySwitch(node);
    else if (t === 'Transform' && field !== 'children') { const r = this.rec.get(node.id); if (r && r.tn) { this.applyTransform(node, r.tn); } }
    else if ((t === 'Group' || t === 'Switch' || t === 'Transform') && field === 'children') this.rebuildGroup(node);
    else if (t === 'Material') for (const m of this.meshesOf.get(node.id) || []) { if (m.isLineSegments || m.isPoints) this.refreshPlain(m.material, node, !!m.geometry.attributes.color); else this.refreshPhong(m.material, node); }
    else if (t === 'PhysicalMaterial') for (const m of this.meshesOf.get(node.id) || []) this.refreshPBR(m.material, node);
    else if (t === 'UnlitMaterial') for (const m of this.meshesOf.get(node.id) || []) this.refreshUnlit(m.material, node);
    else if (t === 'DirectionalLight' || t === 'PointLight' || t === 'SpotLight') { const l = this.lights.find((x) => x.userData.node === node); if (l) { this.refreshLight(l); this.refreshAmbient(); } }
    else if (t === 'Fog') this.applyFog();
    else if (t === 'ClipPlane') this.clipDirty = true;
    else if (t === 'TextureTransform') for (const m of this.meshesOf.get(node.id) || []) { const ap = m.userData.shape.f.appearance, mat = ap && ap.f.material, tex = mat && mat.type === 'PhysicalMaterial' ? mat.f.baseTexture : ap && ap.f.texture; const old = m.material.map; m.material.map = this.texFor(tex, node); m.material.needsUpdate = true; if (old && old.userData.copyOf) old.dispose(); }
    else if (t === 'Background') this.applyBackground();
    else if (t === 'NavigationInfo') this.applyNavigation();
    else if (t === 'Viewpoint') this.viewpointChanged(node, field);
    else if (t === 'Coordinate' || t === 'Color' || t === 'Normal' || t === 'TextureCoordinate') this.geometryChanged(node);
    const sp = R.bridge.specs.get(t); if (sp && sp.geometry && sp.changed) sp.changed(this, node, field);   // the geometry nodes of the shared bridge keep their own change hooks
    if (T3.changed[t]) T3.changed[t](this, node, field);
  }
  geometryChanged(n) {
    for (const r of [...this.rec.values()]) if (r.node && r.node.type === 'Shape' && r.node.f.geometry && ['coord', 'color', 'normal', 'texCoord'].some((k) => r.node.f.geometry.f[k] === n)) {
      this.geoCache.delete(r.node.f.geometry.id); const parent = r.tn.parent, vis = r.tn.visible; this.disposeObj(r.tn); const nr = this.buildShape(r.node, parent, r.chain.slice(1));
      for (const pr of this.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; }
      nr.tn.visible = vis;
    }
  }
  disposeObj(o) { o.removeFromParent(); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
  rebuildGroup(node) {
    const r = this.rec.get(node.id); if (!r) return;
    for (const k of r.kids) this.disposeRec(k);
    r.kids = node.f.children.map((c) => this.build(c, r.tn, r.chain)); if (node.type === 'Switch') this.applySwitch(node); this.clipDirty = true;
  }
  disposeRec(k) { if (!k) return; (k.kids || []).forEach((x) => this.disposeRec(x)); if (k.tn && k.node && k.node.type !== 'Viewpoint') this.disposeObj(k.tn); if (k.node) this.rec.delete(k.node.id); }
  adopt(node, parentNode) {
    const pr = parentNode ? this.rec.get(parentNode.id) : null, cr = this.build(node, pr ? pr.tn : this.root, pr ? pr.chain : []);
    if (pr && pr.kids && cr) pr.kids.push(cr); return cr;
  }

  /* ---------------------------------------------------------------- camera */
  vpPose(vp) {
    const f = vp.f, par = (this.vpParent && this.vpParent.get(vp)) || null;
    let pos = f.position.slice(), q = R.quat.fromAxisAngle(f.orientation, f.orientation[3]), center = f.centerOfRotation.slice();
    if (par && par !== this.root) {
      par.updateWorldMatrix(true, false); const M = par.matrixWorld, P = new THREE.Vector3(...pos).applyMatrix4(M), C = new THREE.Vector3(...center).applyMatrix4(M);
      const sc = new THREE.Vector3(), rq = new THREE.Quaternion(), tr = new THREE.Vector3(); M.decompose(tr, rq, sc);
      pos = [P.x, P.y, P.z]; center = [C.x, C.y, C.z]; q = R.quat.mul([rq.x, rq.y, rq.z, rq.w], q);
    }
    return { pos, q: R.quat.norm(q), center, fov: f.fieldOfView };
  }
  applyCamera() {
    const c = this.cam, p = this.pose; c.position.set(p.pos[0], p.pos[1], p.pos[2]); c.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);   // a Viewpoint looks down -Z with +Y up, as a three.js camera does
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1, aspect = w / h;
    c.fov = THREE.MathUtils.radToDeg(aspect >= 1 ? p.fov : 2 * Math.atan(Math.tan(p.fov / 2) / aspect));   // X3D fieldOfView is the angle across the smaller side of the view
    c.aspect = aspect; const d = Math.hypot(p.pos[0] - p.center[0], p.pos[1] - p.center[1], p.pos[2] - p.center[2]);
    c.near = Math.max(0.3, Math.min(2, d * 0.004)); c.far = Math.max(2000, d * 12); c.updateProjectionMatrix();
  }
  bindViewpoint(vp, on) {
    if (!on) { vp.f.isBound = false; return; }
    const prev = this.bound; if (prev && prev !== vp) { prev.f.isBound = false; R.events.emit(prev, 'isBound', false); }
    this.bound = vp; vp.f.isBound = true; R.events.emit(vp, 'isBound', true); vp.f.bindTime = (performance.timeOrigin + performance.now()) / 1000;
    const nav = this.world && this.world.nodes.find((n) => n.type === 'NavigationInfo');
    const tt = nav ? String(nav.f.transitionType[0] || 'LINEAR').toUpperCase() : 'LINEAR', dur = nav ? Math.max(nav.f.transitionTime || 1, 0.05) : 1, to = this.vpPose(vp);
    if (!prev || tt === 'TELEPORT' || !this.started) { this.pose = to; this.tr = null; this.started = true; this.applyCamera(); return; }
    this.tr = { from: { pos: this.pose.pos.slice(), q: this.pose.q.slice(), center: this.pose.center.slice(), fov: this.pose.fov }, to, t0: performance.now(), dur: dur * 1000 };
  }
  viewpointChanged(vp, field) {
    if (vp !== this.bound) return; const to = this.vpPose(vp);
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
  setupInput() {
    const cv = this.canvas; let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag = [e.clientX, e.clientY]; this.orbit(dx, dy); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
  }
  orbit(dx, dy) {
    this.tr = null; const p = this.pose, c = new THREE.Vector3(...p.center), off = new THREE.Vector3(...p.pos).sub(c), up = new THREE.Vector3(0, 1, 0);
    off.applyAxisAngle(up, -dx * 0.008); const right = new THREE.Vector3().crossVectors(up, off).normalize(); off.applyAxisAngle(right, -dy * 0.008);
    const pos = c.clone().add(off), m = new THREE.Matrix4().lookAt(pos, c, up), q = new THREE.Quaternion().setFromRotationMatrix(m);
    this.pose = { ...p, pos: [pos.x, pos.y, pos.z], q: [q.x, q.y, q.z, q.w] }; this.applyCamera();
  }
  zoom(f) { const p = this.pose; this.tr = null; this.pose = { ...p, pos: [0, 1, 2].map((i) => p.center[i] + (p.pos[i] - p.center[i]) * f) }; this.applyCamera(); }

  /* ------------------------------------------------------------ frame loop */
  frame() {
    const now = (performance.timeOrigin + performance.now()) / 1000;
    if (this.world) { R.events.begin(now); for (const n of this.timeSensors || []) R.tickTimeSensor(n, now); R.events.drain(); this.stepTransition(); }
    this.updateView(); this.renderer.render(this.scene, this.cam); this.stats.frames++;
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
    for (let i = (this.billboards || []).length - 1; i >= 0; i--) {
      const r = this.billboards[i]; if (!r.tn.parent) { this.billboards.splice(i, 1); continue; }
      const L = toLocal(r.tn), d = L.p.clone(); if (d.lengthSq() < 1e-12) continue; d.normalize();
      const ax = r.node.f.axisOfRotation, q = r.tn.quaternion;
      if (!ax[0] && !ax[1] && !ax[2]) {
        let x = new V().crossVectors(L.up, d); if (x.lengthSq() < 1e-10) x = new V().crossVectors(new V(1, 0, 0), d); x.normalize();
        q.setFromRotationMatrix(new T.Matrix4().makeBasis(x, new V().crossVectors(d, x), d));
      } else {
        const a = new V(ax[0], ax[1], ax[2]).normalize(), p = d.clone().sub(a.clone().multiplyScalar(a.dot(d)));
        if (p.lengthSq() < 1e-10) { q.identity(); continue; }
        p.normalize(); q.setFromAxisAngle(a, Math.atan2(new V(0, 0, 1).cross(p).dot(a), p.z));
      }
      r.tn.updateMatrixWorld(true);
    }
    /* LOD: the level is the number of ranges at or below the distance from the eye to the LOD's centre, measured in the LOD's own frame; children[level] is the one shown (X_ITE and the Babylon body agree) */
    for (const r of this.lods || []) {
      if (!r.tn.parent) continue; const c = r.node.f.center, rg = r.node.f.range, L = toLocal(r.tn);
      const d = Math.hypot(L.p.x - c[0], L.p.y - c[1], L.p.z - c[2]); let lv = 0; while (lv < rg.length && d >= rg[lv]) lv++;
      lv = Math.min(lv, r.kids.length - 1);
      if (lv !== r.level) { r.level = lv; r.kids.forEach((k, i) => { if (k && k.tn) k.tn.visible = i === lv; }); }
    }
    /* ClipPlane: the plane (a b c d) of 19775-1 is in the frame of the node's parent group and keeps the half space where a x + b y + c z + d >= 0, which is three.js's own rule */
    if (this.clipDirty) { this.clipDirty = false; for (const cl of this.clips) { cl.meshes = []; cl.parent.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) cl.meshes.push(o); }); } this.renderer.localClippingEnabled = this.clips.length > 0; }
    for (const cl of this.clips || []) {
      const f = cl.node.f, pl = f.plane, n = new V(pl[0], pl[1], pl[2]), len = n.length() || 1;
      const plane = new T.Plane(n.divideScalar(len), pl[3] / len).applyMatrix4(cl.parent.matrixWorld);
      for (const m of cl.meshes) { const mt = m.material; if (!mt) continue; if (f.enabled === false) { if (mt.clippingPlanes && mt.clippingPlanes.length) { mt.clippingPlanes = []; } } else { mt.clippingPlanes = [plane]; } }
    }
  }
  fps() { const t = this.frameTimes; return t.length > 2 ? 1000 * (t.length - 1) / (t[t.length - 1] - t[0]) : 0; }
  shot() { this.updateView(); this.renderer.render(this.scene, this.cam); return this.renderer.domElement.toDataURL('image/png'); }
}
