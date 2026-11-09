/* Bridge kit, Babylon side. Concatenated after brain/body.js and body-cam.js (Body is a class in the bundle scope). A node the kit owns is built by its own spec.build;
   a node with no build is an event or data node the reader runs, and the body stays silent about it instead of noting "skipped". Types the kit does not own go to the stock build. */
{
  const _build = Body.prototype.build;
  Body.prototype.build = function (n, parent, chain) {
    const s = R.bridge.specs.get(n && n.type);
    if (s) return s.build ? s.build(this, n, parent, chain) : null;
    return _build.call(this, n, parent, chain);
  };
  const _changed = Body.prototype.changed;
  Body.prototype.changed = function (node, field) {
    const s = R.bridge.specs.get(node.type);
    if (s && s.changed) s.changed(this, node, field);
    return _changed.call(this, node, field);
  };
}

/* pointer drag sensors: a press on a Shape starts every drag sensor (a spec with dragStart) that is a child of the Shape's nearest group that has one; the ray is expressed in that group's
   frame as it was at the press. A press that starts a drag does not orbit the camera. */
{
  const _setWorld = Body.prototype.setWorld;
  const live = {}; R.bridge.live = (k) => (live[k] ||= new Set());     // nodes of one kind in the world on screen (key sensors), emptied when the world is replaced
  Body.prototype.setWorld = function (...a) { R.bridge.body = this; for (const s of Object.values(live)) s.clear(); this.texCache.clear(); /* node ids restart in every world: a texture cached under an old id would be handed to the new world */ return _setWorld.apply(this, a); };
  const _click = Body.prototype.click;
  Body.prototype.click = function (x, y) {          // a click under an Anchor follows it, the nearest Anchor wins
    _click.call(this, x, y);
    const hit = this.pickMesh(x, y); if (!hit || !hit.hit) return;
    for (const g of (hit.pickedMesh.metadata && hit.pickedMesh.metadata.chain) || []) if (g.type === 'Anchor') { if (g.f.load !== false) R.bridge.specs.get('Anchor').activate(this, g); break; }
  };
  const _init = Body.prototype.init;
  Body.prototype.init = async function (...a) { const r = await _init.apply(this, a); R.bridge.pointerInit(this); R.bridge.keyInit(this); return r; };
  /* key sensors: the canvas takes focus (tabindex), key down and up go to every enabled KeySensor and StringSensor of the world, losing focus lets go of held modifiers */
  R.bridge.keyInit = (body) => {
    const cv = body.canvas; if (cv.tabIndex < 0) cv.tabIndex = 0; cv.style.outline = 'none';
    const each = (fn, e) => { let used = false; for (const n of live.key || []) if (R.bridge.specs.get(n.type)[fn](n, e)) used = true; return used; };
    cv.addEventListener('keydown', (e) => { if (each('keydown', e)) e.preventDefault(); });
    cv.addEventListener('keyup', (e) => { if (each('keyup', e)) e.preventDefault(); });
    cv.addEventListener('blur', () => { for (const n of live.key || []) R.bridge.specs.get(n.type).release(n); });
  };
  R.bridge.pointerInit = (body) => {
    const cv = body.canvas, V = BABYLON.Vector3; let drag = null;
    const ray = (e, inv) => {
      const r = cv.getBoundingClientRect(), sx = body.engine.getRenderWidth() / r.width, sy = body.engine.getRenderHeight() / r.height;
      const pr = body.scene.createPickingRay((e.clientX - r.left) * sx, (e.clientY - r.top) * sy, BABYLON.Matrix.IdentityReadOnly, body.scene.activeCamera);
      const o = V.TransformCoordinates(pr.origin, inv), d = V.TransformNormal(pr.direction, inv);
      return { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z] };
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const hit = body.pickMesh(e.clientX, e.clientY); if (!hit || !hit.hit) return;
      for (const g of (hit.pickedMesh.metadata && hit.pickedMesh.metadata.chain) || []) {
        const sens = (g.f.children || []).filter((c) => { const s = R.bridge.specs.get(c.type); return s && s.dragStart && c.f.enabled !== false; });
        if (!sens.length) continue;
        const rec = body.rec.get(g.id), inv = (rec && rec.tn ? rec.tn.computeWorldMatrix(true) : BABYLON.Matrix.Identity()).clone().invert();
        const rl = ray(e, inv), hp = V.TransformCoordinates(hit.pickedPoint, inv);
        drag = { sens, inv }; cv.setPointerCapture(e.pointerId); e.stopImmediatePropagation();
        for (const s of sens) R.bridge.drag.start(s, { o: rl.o, d: rl.d, hit: [hp.x, hp.y, hp.z] });
        return;
      }
    }, true);
    cv.addEventListener('pointermove', (e) => { if (!drag) return; e.stopImmediatePropagation(); const rl = ray(e, drag.inv); for (const s of drag.sens) R.bridge.drag.move(s, { o: rl.o, d: rl.d }); }, true);
    const up = (e) => { if (!drag) return; e.stopImmediatePropagation(); const d = drag; drag = null; for (const s of d.sens) R.bridge.drag.end(s); };
    cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
  };
}

/* geometry sets: a bridge geometry node (spec.geometry) is drawn through the same path as IndexedTriangleSet. makeMesh hands the stock code a stand-in whose type is IndexedTriangleSet and
   which remembers the real node (__src); geometryData reads the vertex data from the spec instead. The data is cached by node id, keyed on the versions of the node and its coord/normal/color/texCoord. */
{
  const specOf = (g) => { const s = R.bridge.specs.get(g.__src ? g.__src.type : g.type); return s && s.geometry ? s : null; };
  const _data = Body.prototype.geometryData;
  Body.prototype.geometryData = function (g) {
    const s = specOf(g); if (!s) return _data.call(this, g);
    const f = g.f, ver = [g, f.coord, f.normal, f.color, f.texCoord].map((x) => (x ? x.version || 0 : -1)).join('.');
    const hit = this.geoCache.get(g.id); if (hit && hit.ver === ver) return hit;
    const out = Object.assign({ ver }, s.geometry(g.__src || g, this)); this.geoCache.set(g.id, out); return out;
  };
  const _make = Body.prototype.makeMesh;
  Body.prototype.makeMesh = function (shape, g, spec, pass) {
    if (!g.__src && specOf(g)) { const gp = Object.create(g, { type: { value: 'IndexedTriangleSet' }, __src: { value: g } }); return _make.call(this, shape, gp, spec, pass); }
    return _make.call(this, shape, g, spec, pass);
  };
  Body.prototype.regeo = function (x) {            // drop the cached data and Babylon geometry of one geometry node and rebuild the shapes that use it
    this.geoCache.delete(x.id);
    for (const key of [x.id + 'c', x.id + 'n']) { const c = this.geoCache.get(key); if (c) { c.geo.dispose(); this.geoCache.delete(key); } }
    for (const r of this.rec.values()) if (r.node && r.node.type === 'Shape' && r.node.f.geometry === x && r.tn) this.rebuildShapeIn(r);
  };
  const _gc = Body.prototype.geometryChanged;
  Body.prototype.geometryChanged = function (n) {
    _gc.call(this, n);
    for (const x of this.world.nodes) if (specOf(x) && (x.f.color === n || x.f.coord === n || x.f.normal === n || x.f.texCoord === n)) this.regeo(x);
  };
}

/* line geometry: a bridge node with spec.lines(g) -> { coord (flat xyz, or null for the node's own coord), coordIndex } is drawn by the body's screen-width line path, the one IndexedLineSet uses.
   The stock code gets a stand-in whose type is IndexedLineSet. */
{
  const linesSpec = (g) => { const s = R.bridge.specs.get(g.type); return s && s.lines ? s : null; };
  const standIn = (g, s) => {
    const L = s.lines(g), coord = L.coord ? { id: g.id + 'p', type: 'Coordinate', version: g.version || 0, f: { point: L.coord } } : g.f.coord;
    return Object.create(g, { type: { value: 'IndexedLineSet' }, __src: { value: g }, f: { value: Object.assign({}, g.f, { coord, coordIndex: L.coordIndex }) } });
  };
  const _mats = Body.prototype.materialsFor;
  Body.prototype.materialsFor = function (shape, g, app) { const s = linesSpec(g); return _mats.call(this, shape, s ? standIn(g, s) : g, app); };
  const _make = Body.prototype.makeMesh;
  Body.prototype.makeMesh = function (shape, g, spec, pass) { const s = linesSpec(g); return _make.call(this, shape, s ? standIn(g, s) : g, spec, pass); };
  const _gc = Body.prototype.geometryChanged;
  Body.prototype.geometryChanged = function (n) {
    _gc.call(this, n);
    for (const x of this.world.nodes) if (linesSpec(x) && (x.f.color === n || x.f.coord === n)) this.regeo(x);
  };
}

/* points: a bridge node with spec.points(g) -> flat xyz is drawn as a point cloud in the Material's emissive colour (unlit). WebGPU has no point size, so each point is one pixel. */
{
  const pointsSpec = (g) => { const s = R.bridge.specs.get(g.type); return s && s.points ? s : null; };
  const _mats = Body.prototype.materialsFor;
  Body.prototype.materialsFor = function (shape, g, app) {
    if (!pointsSpec(g)) return _mats.call(this, shape, g, app);
    const mat = app && app.f.material; return [{ kind: 'points', mat, deps: [g, mat].filter(Boolean) }];
  };
  const _make = Body.prototype.makeMesh;
  Body.prototype.makeMesh = function (shape, g, spec, pass) {
    const s = pointsSpec(g); if (!s) return _make.call(this, shape, g, spec, pass);
    const P = s.points(g), mesh = new BABYLON.Mesh((shape.def || 'points') + '-pts', this.scene), vd = new BABYLON.VertexData();
    vd.positions = P; vd.indices = Uint32Array.from({ length: P.length / 3 }, (_, i) => i); vd.applyToMesh(mesh, false);
    const m = new BABYLON.StandardMaterial('pts-' + shape.id, this.scene), c = spec.mat ? (spec.mat.f.emissiveColor || [1, 1, 1]) : [1, 1, 1];
    m.disableLighting = true; m.emissiveColor.set(c[0], c[1], c[2]); m.pointsCloud = true; m.pointSize = 3; m.backFaceCulling = false;
    mesh.material = m; return mesh;
  };
}

/* texture coordinates from a TextureCoordinateGenerator: made once per geometry build from positions and normals (object space; the camera is the identity) */
{
  const _data = Body.prototype.geometryData;
  Body.prototype.geometryData = function (g) {
    const d = _data.call(this, g), T = (g.f || {}).texCoord;
    if (!T || T.type !== 'TextureCoordinateGenerator' || !d || !d.pos) return d;
    const key = (T.version || 0) + '/' + T.f.mode; if (d._gen === key) return d;
    let nrm = d.nrm;
    if (!nrm) { nrm = new Float32Array(d.pos.length); BABYLON.VertexData.ComputeNormals(d.pos, d.idx, nrm); }
    const n = d.pos.length / 3, uv = new Float32Array(n * 2), mode = String(T.f.mode || 'SPHERE').toUpperCase();
    const fromNormal = /^(SPHERE|SPHERE-LOCAL|CAMERASPACENORMAL|SPHERE-REFLECT|SPHERE-REFLECT-LOCAL|CAMERASPACEREFLECTIONVECTOR)$/.test(mode);
    if (!fromNormal && !/^(COORD|COORD-EYE|CAMERASPACEPOSITION)$/.test(mode)) this.note('TextureCoordinateGenerator mode ' + mode + ' is not made (uv left at 0)');
    for (let i = 0; i < n; i++) {
      if (fromNormal) { uv[i * 2] = nrm[i * 3] * 0.5 + 0.5; uv[i * 2 + 1] = nrm[i * 3 + 1] * 0.5 + 0.5; }
      else if (/^(COORD|COORD-EYE|CAMERASPACEPOSITION)$/.test(mode)) { uv[i * 2] = d.pos[i * 3]; uv[i * 2 + 1] = d.pos[i * 3 + 1]; }
    }
    d.uv = uv; d._gen = key; return d;
  };
}

/* MultiTexture: the textures are drawn over each other on a canvas texture; texture i meets the result so far by mode[i], moved by the TextureTransform of stage i (the Appearance's
   MultiTextureTransform, or one TextureTransform for all stages). MovieTexture: a Babylon VideoTexture on the node's <video> element. */
{
  // 3x3 affine as [a b c d e f] (x' = a x + c y + e, y' = b x + d y + f); tc' = T + C + R S (tc - C)
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const inv = (m) => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
  const ttMatrix = (t) => { const f = t.f, c = f.center || [0, 0], s = f.scale || [1, 1], r = f.rotation || 0, T = f.translation || [0, 0], co = Math.cos(r), si = Math.sin(r);
    return mul(mul(mul([1, 0, 0, 1, T[0] + c[0], T[1] + c[1]], [co, si, -si, co, 0, 0]), [s[0], 0, 0, s[1], 0, 0]), [1, 0, 0, 1, -c[0], -c[1]]); };
  const _tex = Body.prototype.tex;
  Body.prototype.tex = function (node) {
    if (node && node.type === 'MovieTexture') {
      const hit = this.texCache.get(node.id); if (hit) return hit;
      if (!node._video) return null;
      const t = new BABYLON.VideoTexture('mov-' + node.id, node._video, this.scene, false, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE, { autoPlay: false, loop: false, muted: true });
      this.texCache.set(node.id, t); return t;
    }
    if (!node || node.type !== 'MultiTexture') return _tex.call(this, node);
    const hit = this.texCache.get(node.id); if (hit) return hit;
    const body = this, SZ = 256, dt = new BABYLON.DynamicTexture('mt-' + node.id, { width: SZ, height: SZ }, this.scene, true);
    const imgs = [], ctx = dt.getContext();
    const app = this.world.nodes.find((x) => x.type === 'Appearance' && x.f.texture === node), tt = app && app.f.textureTransform;
    const stageTT = (i) => !tt ? null : tt.type === 'MultiTextureTransform' ? (tt.f.textureTransform || [])[i] || null : tt;
    const OPS = { REPLACE: 'source-over', MODULATE: 'multiply', MODULATE2X: 'multiply', MODULATE4X: 'multiply', ADD: 'lighter' };
    const P = [SZ, 0, 0, -SZ, 0, SZ];                                   // uv -> canvas pixels (v up)
    dt.redraw = () => {
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillRect(0, 0, SZ, SZ);
      imgs.forEach((im, i) => {
        if (!im.complete || !im.naturalWidth) return;
        const mode = String((node.f.mode || [])[i] || 'MODULATE').toUpperCase(), op = OPS[mode];
        if (!op && i) body.note('MultiTexture mode ' + mode + ' drawn as MODULATE');
        ctx.globalCompositeOperation = i === 0 ? 'source-over' : op || 'multiply';
        const t = stageTT(i);
        if (t) {                                                        // canvas(px) = image(Q px) with Q = P M P^-1; the image is placed by Q^-1 and tiled
          const Q = mul(mul(P, ttMatrix(t)), inv(P)), D = inv(Q), pat = ctx.createPattern(im, 'repeat');
          pat.setTransform(new DOMMatrix([D[0] * SZ / im.naturalWidth, D[1] * SZ / im.naturalWidth, D[2] * SZ / im.naturalHeight, D[3] * SZ / im.naturalHeight, D[4], D[5]]));
          ctx.fillStyle = pat; ctx.fillRect(0, 0, SZ, SZ);
        } else ctx.drawImage(im, 0, 0, SZ, SZ);
        const extra = mode === 'MODULATE2X' ? 1 : mode === 'MODULATE4X' ? 3 : 0;
        for (let k = 0; k < extra && i; k++) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(ctx.canvas, 0, 0); }
      });
      ctx.globalCompositeOperation = 'source-over'; dt.update();
    };
    for (const t of node.f.texture || []) {
      const u = t.f.url && t.f.url[0]; if (!u) continue;
      const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = dt.redraw; im.src = this.resolve(u, this.baseUrl); imgs.push(im);
    }
    dt.redraw(); this.texCache.set(node.id, dt); return dt;
  };
}

/* TwoSidedMaterial: two passes of the same geometry, front faces then back faces, each with its own colours */
{
  const _mats = Body.prototype.materialsFor;
  Body.prototype.materialsFor = function (shape, g, app) {
    const mat = app && app.f.material;
    if (!mat || mat.type !== 'TwoSidedMaterial') return _mats.call(this, shape, g, app);
    return [false, true].map((back) => ({ kind: 'twosided', mat, back, deps: [mat] }));
  };
  const _mm = Body.prototype.makeMaterial;
  Body.prototype.makeMaterial = function (shape, g, spec, mesh) {
    if (spec.kind !== 'twosided') return _mm.call(this, shape, g, spec, mesh);
    const f = spec.mat.f, sep = f.separateBackColor, B = spec.back && sep;
    const src = { f: { diffuseColor: B ? f.backDiffuseColor : f.diffuseColor, emissiveColor: B ? f.backEmissiveColor : f.emissiveColor, transparency: B ? f.backTransparency : f.transparency } };
    const m = new BABYLON.StandardMaterial('two-' + (spec.back ? 'back-' : 'front-') + shape.id, this.scene);
    m.specularColor.set(0, 0, 0); m.backFaceCulling = true;
    m.sideOrientation = spec.back ? BABYLON.Material.ClockWiseSideOrientation : BABYLON.Material.CounterClockWiseSideOrientation;
    this.refreshPhong(m, src); m._two = spec.back ? 'back' : 'front';
    return m;
  };
}

/* FillProperties: filled=false hides the fill; hatched=true lays a line pattern over the surface (the geometry's own texture coordinates) */
{
  const _bs = Body.prototype.buildShape;
  Body.prototype.buildShape = function (n, parent, chain) {
    const r = _bs.call(this, n, parent, chain), fp = n.f.appearance && n.f.appearance.f.fillProperties;
    if (fp && r.meshes && r.meshes.length) this.applyFill(r, fp);
    return r;
  };
  Body.prototype.applyFill = function (r, fp) {
    const f = fp.f, extra = [];
    for (const m of r.meshes) {
      if (f.filled === false) m.visibility = 0;          // not drawn but still picked, as X_ITE 16.6.0 does
      if (f.hatched !== false) {
        const SZ = 32, dt = new BABYLON.DynamicTexture('hatch-' + fp.id, { width: SZ, height: SZ }, this.scene, true), c = dt.getContext(), col = f.hatchColor || [1, 1, 1];
        const style = Math.max(1, Math.min(19, f.hatchStyle | 0)); if (style > 6) this.note('FillProperties hatchStyle ' + style + ' drawn as style 6');
        c.clearRect(0, 0, SZ, SZ); c.strokeStyle = `rgb(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)})`; c.lineWidth = 3;
        const line = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
        const H = style === 1 || style === 5, V = style === 2 || style === 5, U = style === 3 || style >= 6, D = style === 4 || style >= 6;
        if (H) line(0, SZ / 2, SZ, SZ / 2); if (V) line(SZ / 2, 0, SZ / 2, SZ);
        if (U) { line(0, SZ, SZ, 0); line(-SZ / 2, SZ / 2, SZ / 2, -SZ / 2); line(SZ / 2, SZ * 1.5, SZ * 1.5, SZ / 2); }
        if (D) { line(0, 0, SZ, SZ); line(SZ / 2, -SZ / 2, SZ * 1.5, SZ / 2); line(-SZ / 2, SZ / 2, SZ / 2, SZ * 1.5); }
        dt.hasAlpha = true; dt.update(); dt.wrapU = dt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; dt.uScale = dt.vScale = 6;
        const o = m.clone(m.name + '-hatch'); o.parent = m.parent; o.isPickable = false;
        const hm = new BABYLON.StandardMaterial('hatchmat-' + fp.id, this.scene);
        hm.diffuseTexture = dt; hm.useAlphaFromDiffuseTexture = true; hm.disableLighting = true; hm.emissiveColor.set(1, 1, 1); hm.backFaceCulling = false; hm.zOffset = -2; hm.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        o.material = hm; o.metadata = { hatch: true }; o.isVisible = true; extra.push(o);
      }
    }
    r.hatch = extra;
  };
}

/* FogCoordinate: a shape whose geometry has a fogCoord gets its fog overlay (BR.fog.coord) */
{
  const _bs = Body.prototype.buildShape;
  Body.prototype.buildShape = function (n, parent, chain) { const r = _bs.call(this, n, parent, chain); BR.fog.coord(this, n, r); return r; };
}

{ // a rebuilt Shape also drops its hatch overlay meshes
  const _rb = Body.prototype.rebuildShapeIn;
  Body.prototype.rebuildShapeIn = function (r) { (r.hatch || []).forEach((m) => m.dispose(false, true)); r.hatch = []; return _rb.call(this, r); };
}

/* OrthoViewpoint: the camera goes orthographic while one is bound. The pose gets an `ortho` record ({ f: fieldOfView, near, far, scale }), applyCamera sets the Babylon camera's mode and its
   left/right/top/bottom from it, and the user's zoom changes the record's scale (moving along the view axis changes nothing in an orthographic view). */
{
  const B = Body.prototype, ORTHO = (v) => v && v.type === 'OrthoViewpoint';
  const _pose = B.vpPose;
  B.vpPose = function (vp) { const p = _pose.call(this, vp); if (ORTHO(vp)) { p.fov = 0.7854; p.ortho = { f: Array.from(vp.f.fieldOfView), near: vp.f.nearDistance, far: vp.f.farDistance, scale: 1 }; } return p; };
  const _bind = B.bindViewpoint;
  B.bindViewpoint = function (vp, on) {
    const prev = this.bound; _bind.call(this, vp, on);
    if (on && (ORTHO(vp) || ORTHO(prev))) { this.tr = null; this.pose = this.vpPose(vp); this.started = true; this.applyCamera(); }
  };
  const _apply = B.applyCamera;
  B.applyCamera = function () {
    _apply.call(this);
    const c = this.cam, o = this.pose && this.pose.ortho, C = BABYLON.Camera;
    if (!o) { if (c.mode !== C.PERSPECTIVE_CAMERA) c.mode = C.PERSPECTIVE_CAMERA; return; }
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1, ratio = (w * c.viewport.width) / (h * c.viewport.height), f = o.f, s = o.scale || 1;
    const x0 = (f[0] ?? -1) * s, y0 = (f[1] ?? -1) * s, x1 = (f[2] ?? 1) * s, y1 = (f[3] ?? 1) * s, sx = x1 - x0, sy = y1 - y0;
    c.mode = C.ORTHOGRAPHIC_CAMERA;
    if (ratio > sx / sy) { const cx = (x0 + x1) / 2, hw = sy * ratio / 2; c.orthoLeft = cx - hw; c.orthoRight = cx + hw; c.orthoBottom = y0; c.orthoTop = y1; }
    else { const cy = (y0 + y1) / 2, hh = sx / ratio / 2; c.orthoLeft = x0; c.orthoRight = x1; c.orthoBottom = cy - hh; c.orthoTop = cy + hh; }
    c.minZ = o.near > 0 ? o.near : 0.1; c.maxZ = o.far > 0 ? o.far : 1e4;
  };
  const _zoom = B.zoom;
  B.zoom = function (k) { const o = this.pose && this.pose.ortho; if (!o) return _zoom.call(this, k); o.scale = Math.min(50, Math.max(0.02, (o.scale || 1) * k)); this.applyCamera(); };
  const _pan = B.pan;
  B.pan = function (dx, dy) {
    const p = this.pose, c = this.cam, o = p && p.ortho; if (!o) return _pan.call(this, dx, dy);
    const u = (c.orthoTop - c.orthoBottom) / (this.canvas.clientHeight || 1), up = R.quat.rotate(p.q, [0, 1, 0]), right = R.quat.rotate(p.q, [1, 0, 0]);
    const t = R.v3.add(R.v3.scale(right, -dx * u), R.v3.scale(up, dy * u)); p.pos = R.v3.add(p.pos, t); p.center = R.v3.add(p.center, t); this.applyCamera();
  };
  const _sw = B.setWorld;
  B.setWorld = function (...a) {          // an OrthoViewpoint that comes first in the file is bound at load (the stock body binds nothing at load; a first Viewpoint stays as it was)
    const r = _sw.apply(this, a), w = this.world, first = w && w.nodes.find((n) => n.type === 'Viewpoint' || n.type === 'OrthoViewpoint');
    if (ORTHO(first)) this.bindViewpoint(first, true);
    return r;
  };
}

/* the page's viewpoint list: body.viewpointList() -> [{ node, path, text }] for the loaded world, with the viewer where the camera is (ViewpointGroup proximity) */
Body.prototype.viewpointList = function () { return this.world ? R.bridge.viewpoints(this.world, this.pose ? this.pose.pos : null) : []; };

/* Layers: a world that goes away takes its layer cameras with it */
{
  const _cw = Body.prototype.clearWorld;
  Body.prototype.clearWorld = function () { if (this._layers) { for (const it of this._layers.items) if (it) it.cam.dispose(); this._layers = null; this.scene.activeCameras = []; } return _cw.call(this); };
}
