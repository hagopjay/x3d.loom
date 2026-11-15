/* ImageCubeMapTexture and GeneratedCubeMapTexture for the three.js bridge. A Shape whose Appearance holds a cube map is drawn as an environment mirror: X_ITE 16.6.0 reads a cube map texture through the
   reflection of the view on the surface in camera space, the colour of it multiplying the lit colour like any texture. The patch (patchMaterial in body-three.js) puts that reflection vector in the
   vertex shader and the cube lookup in the place of the map lookup, so any material type carries it. An ImageCubeMapTexture file is a 4:3 cross (top above the front, left front right back across, bottom
   below) or a 2:1 panorama; a GeneratedCubeMapTexture is six pictures of the world taken from the Shape's origin with the Shape itself left out (update NONE / NEXT_FRAME_ONLY / ALWAYS).
   ORI is the turn of each face image (bit 0 flip across, bit 1 flip down, bit 2 swap the axes), the six numbers measured against X_ITE with asymmetric face pictures (see the ImageCubeMapTexture fixture). */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
R.bridge.three.cube = {
  /* three.js face order: +x right, -x left, +y top, -y bottom, +z front, -z back. [column, row] of each face in the 4:3 cross. */
  CROSS: { right: [2, 1], left: [0, 1], top: [1, 0], bottom: [1, 2], front: [1, 1], back: [3, 1] },
  ORDER: ['right', 'left', 'top', 'bottom', 'front', 'back'],
  ORI: { right: 0, left: 0, top: 0, bottom: 0, front: 0, back: 0 },
  FLIP: [1, 1, 1],
  turn(src, w, op) {                                   // a canvas, turned by op
    const c = document.createElement('canvas'); c.width = w; c.height = w; const g = c.getContext('2d'); g.save();
    g.translate((op & 1) ? w : 0, (op & 2) ? w : 0); g.scale((op & 1) ? -1 : 1, (op & 2) ? -1 : 1);
    if (op & 4) { g.transform(0, 1, 1, 0, 0, 0); }
    g.drawImage(src, 0, 0); g.restore(); return c;
  },
  faces(img) {                                         // -> { right, left, top, bottom, front, back } canvases, or null
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, ar = W / H, mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, C = R.bridge.three.cube, out = {};
    if (Math.abs(ar - 4 / 3) < 0.01) {
      const w = Math.floor(W / 4), h = Math.floor(H / 3);
      for (const k of C.ORDER) { const c = mk(w, h), [ox, oy] = C.CROSS[k]; c.getContext('2d').drawImage(img, ox * w, oy * h, w, h, 0, 0, w, h); out[k] = C.ORI[k] ? C.turn(c, w, C.ORI[k]) : c; }
      return out;
    }
    if (Math.abs(ar - 2) < 0.01) {                     // equirectangular: the face looks along its own axis, the middle of the picture is the front, +Z, and the picture runs on toward +X (measured against X_ITE)
      const S = Math.min(256, Math.floor(H / 2)), src = mk(W, H), sg = src.getContext('2d'); sg.drawImage(img, 0, 0); const sd = sg.getImageData(0, 0, W, H).data;
      const dir = { right: (u, v) => [1, -v, -u], left: (u, v) => [-1, -v, u], top: (u, v) => [u, 1, v], bottom: (u, v) => [u, -1, -v], front: (u, v) => [u, -v, 1], back: (u, v) => [-u, -v, -1] };
      for (const k of C.ORDER) {
        const c = mk(S, S), g = c.getContext('2d'), o = g.createImageData(S, S);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const [dx, dy, dz] = dir[k](2 * (x + 0.5) / S - 1, 2 * (y + 0.5) / S - 1), L = Math.hypot(dx, dy, dz);
          const lon = Math.atan2(dx, dz), lat = Math.asin(dy / L), sx = Math.min(W - 1, Math.max(0, Math.floor((0.5 + lon / (2 * Math.PI)) * W))), sy = Math.min(H - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * H)));
          o.data.set(sd.subarray((sy * W + sx) * 4, (sy * W + sx) * 4 + 4), (y * S + x) * 4);
        }
        g.putImageData(o, 0, 0); out[k] = c;
      }
      return out;
    }
    return null;
  },
  empty() { const d = { data: new Uint8Array([0, 0, 0, 255]), width: 1, height: 1 }, t = new THREE.CubeTexture([d, d, d, d, d, d]); t.needsUpdate = true; return t; },
  entry(body, n) { const key = 'cube:' + n.id; let e = body.texCache.get(key); if (!e) { e = { node: n, tex: null, ready: false, users: new Set(), flip: R.bridge.three.cube.FLIP }; body.texCache.set(key, e); } return e; },
  /* the texture of a cube map node as a record {tex, ready, flip}: the image loads in, the record's users (uniform sets) are told */
  use(body, n, u) {
    const C = R.bridge.three.cube, e = C.entry(body, n); e.users.add(u);
    if (n.type === 'ImageCubeMapTexture') { if (!e.started) { e.started = true; C.loadImage(body, n, e); } }
    else if (n.type === 'ComposedCubeMapTexture') { if (!e.started) { e.started = true; C.loadComposed(body, n, e); } }
    else C.setupGenerated(body, n, e);
    return e;
  },
  tell(e) { for (const u of e.users) { u.cubeMap.value = e.ready ? e.tex : u.empty; u.cubeOn.value = e.ready ? 1 : 0; u.cubeFlip.value.fromArray(e.flip); u.cubeWorld.value = e.world ? 1 : 0; } },
  loadImage(body, n, e) {
    const C = R.bridge.three.cube, u = (n.f.url || [])[0]; e.ready = false; e.gen = (e.gen || 0) + 1; const gen = e.gen;
    if (!u || n.f.load === false) { C.tell(e); return; }
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (gen !== e.gen) return; const f = C.faces(img); if (!f) { body.note('ImageCubeMapTexture: image ' + img.naturalWidth + 'x' + img.naturalHeight + ' is neither a 4:3 cross nor a 2:1 panorama'); return; }
      if (e.tex) e.tex.dispose(); const t = new THREE.CubeTexture(C.ORDER.map((k) => f[k])); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; e.tex = t; e.ready = true; C.tell(e); body.dirty = true;
    };
    img.onerror = () => body.note('ImageCubeMapTexture: image not loaded');
    img.src = body.resolve(u, body.baseUrl);
  },
  /* ComposedCubeMapTexture: six face nodes (ImageTexture, or PixelTexture), each one picture, drawn unturned on a face of the cube */
  loadComposed(body, n, e) {
    const C = R.bridge.three.cube, f = n.f, names = { right: 'rightTexture', left: 'leftTexture', top: 'topTexture', bottom: 'bottomTexture', front: 'frontTexture', back: 'backTexture' }; e.ready = false; e.gen = (e.gen || 0) + 1; const gen = e.gen, got = {}; let left = 6;
    const done = () => { if (--left || gen !== e.gen) return; if (e.tex) e.tex.dispose(); const t = new THREE.CubeTexture(C.ORDER.map((k) => got[k])); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; e.tex = t; e.ready = true; C.tell(e); body.dirty = true; };
    for (const k of C.ORDER) {
      const tn = f[names[k]], blank = () => { const c = document.createElement('canvas'); c.width = c.height = 1; got[k] = c; done(); };
      if (!tn) { blank(); continue; }
      if (tn.type === 'PixelTexture') { const im = tn.f.image || [], w = im[0] | 0, h = im[1] | 0, c = document.createElement('canvas'); if (!(w > 0 && h > 0)) { blank(); continue; } c.width = w; c.height = h; const g = c.getContext('2d'), d = g.createImageData(w, h), nc = im[2] | 0;
        for (let i = 0; i < w * h; i++) { const v = im[3 + i] >>> 0; let r, gg, b, a = 255; if (nc === 1) r = gg = b = v & 255; else if (nc === 2) { r = gg = b = (v >> 8) & 255; a = v & 255; } else if (nc === 3) { r = (v >> 16) & 255; gg = (v >> 8) & 255; b = v & 255; } else { r = (v >>> 24) & 255; gg = (v >> 16) & 255; b = (v >> 8) & 255; a = v & 255; }
          const o = ((h - 1 - ((i / w) | 0)) * w + (i % w)) * 4; d.data.set([r, gg, b, a], o); }   // X3D image rows run bottom to top
        g.putImageData(d, 0, 0); got[k] = C.ORI[k] ? C.turn(c, w, C.ORI[k]) : c; done(); continue; }
      const u = (tn.f.url || [])[0]; if (!u) { blank(); continue; }
      const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { const w = Math.max(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = w; c.getContext('2d').drawImage(img, 0, 0, w, w); got[k] = C.ORI[k] ? C.turn(c, w, C.ORI[k]) : c; done(); };
      img.onerror = () => { body.note('ComposedCubeMapTexture: the ' + k + ' image did not load'); blank(); }; img.src = body.resolve(u, body.baseUrl);
    }
  },
  reload(body, n) { const e = body.texCache.get('cube:' + n.id); if (e && n.type === 'ImageCubeMapTexture') R.bridge.three.cube.loadImage(body, n, e); },
  /* GeneratedCubeMapTexture: a cube render target and a camera at the origin of the Shape; the pictures are taken in frame() (takePictures) */
  setupGenerated(body, n, e) {
    if (e.target) return; const size = n.f.size > 0 ? n.f.size : 128;
    e.target = new THREE.WebGLCubeRenderTarget(size, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); e.cam = new THREE.CubeCamera(0.05, 2000, e.target);
    e.tex = e.target.texture; e.ready = true; e.world = false;    e.flip = [1, 1, 1]; e.taken = false; (body.cubeGen ||= new Set()).add(e); R.bridge.three.cube.updateMode(body, n);
  },
  updateMode(body, n) { const e = body.texCache.get('cube:' + n.id); if (!e || !e.target) return; e.mode = String(n.f.update || 'NONE'); if (e.mode === 'NEXT_FRAME_ONLY') e.pending = true; },
  takePictures(body) {
    if (!body.cubeGen) return;
    for (const e of body.cubeGen) {
      const m = e.mode; if (!(m === 'ALWAYS' || (m === 'NEXT_FRAME_ONLY' && e.pending))) continue;
      const hide = []; for (const u of e.users) for (const mesh of u.meshes || []) { if (mesh.visible) { mesh.visible = false; hide.push(mesh); } }
      const o = new THREE.Vector3(); const mesh = [...e.users][0] && [...e.users][0].meshes && [...e.users][0].meshes[0]; if (mesh) { mesh.updateWorldMatrix(true, false); o.setFromMatrixPosition(mesh.matrixWorld); }
      e.cam.position.copy(o); e.cam.update(body.renderer, body.scene); for (const h of hide) h.visible = true;
      if (m === 'NEXT_FRAME_ONLY') { e.pending = false; e.node.f.update = 'NONE'; e.mode = 'NONE'; R.events.emit(e.node, 'update', 'NONE'); }
    }
  },
  /* the shader patch: reflection of the view in camera space, looked up in the cube map in place of the map lookup */
  patch(body, m, node, shape, hasTcg) {
    const C = R.bridge.three.cube, u = { cubeMap: { value: null }, cubeOn: { value: 0 }, cubeFlip: { value: new THREE.Vector3(1, 1, 1) }, cubeWorld: { value: 0 }, cubeRot: { value: new THREE.Matrix3() }, empty: C.empty(), meshes: [] };
    u.cubeMap.value = u.empty; m.userData.cubeU = u; (body.cubeMats ||= new Set()).add(m);
    body.patchMaterial(m, hasTcg ? 'cube-tc' : 'cube', (sh) => {
      Object.assign(sh.uniforms, { cubeMap: u.cubeMap, cubeOn: u.cubeOn, cubeFlip: u.cubeFlip, cubeWorld: u.cubeWorld, cubeRot: u.cubeRot });
      sh.vertexShader = (hasTcg ? 'attribute vec3 tc3;\n' : '') + 'varying vec3 vCubeDir;\n' + sh.vertexShader.replace('#include <project_vertex>', hasTcg ? '#include <project_vertex>\n vCubeDir = tc3;' : '#include <project_vertex>\n { vec3 nv = normalize( normalMatrix * normal ); vCubeDir = reflect( normalize( mvPosition.xyz ), nv ); }');
      sh.fragmentShader = 'varying vec3 vCubeDir; uniform samplerCube cubeMap; uniform float cubeOn; uniform vec3 cubeFlip; uniform float cubeWorld; uniform mat3 cubeRot;\n' +
        sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n if ( cubeOn > 0.5 ) { vec3 cd = normalize( vCubeDir ); if ( cubeWorld > 0.5 ) cd = cubeRot * cd; diffuseColor *= vec4( textureCube( cubeMap, cd * cubeFlip ).rgb, 1.0 ); }');
    });
    const e = C.use(body, node, u); C.tell(e); return u;
  },
};
R.bridge.three.changed.ImageCubeMapTexture = (body, n, field) => { if (field === 'url' || field === 'load') R.bridge.three.cube.reload(body, n); };
R.bridge.three.changed.ComposedCubeMapTexture = (body, n, field) => { if (/Texture$/.test(field)) { const e = body.texCache.get('cube:' + n.id); if (e) R.bridge.three.cube.loadComposed(body, n, e); } };
R.bridge.three.changed.GeneratedCubeMapTexture = (body, n, field) => { if (field === 'update') R.bridge.three.cube.updateMode(body, n); };
