/* ImageCubeMapTexture (CubeMapTexturing level 2): ImageCubeMapTexture is a texture node that defines a cubic environment map source as a single file format that contains multiple images, one for each side.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ImageCubeMapTexture', {
  component: 'CubeMapTexturing', level: 2,
  container: 'texture',
  defs: {
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    description: ['SFString', IO, ""],
    load: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    textureProperties: ['SFNode', INIT, null],
    url: ['MFString', IO, []],
  },
  /* One image in the layout X_ITE 16.6.0 reads: a 4:3 cross (left front right back across, top above and bottom below the front) or a 2:1 panorama. A Shape that has the cube map as its texture is
     drawn as an environment mirror: the cube is sampled with the reflection of the view on the surface (like a TextureCoordinateGenerator of mode CAMERASPACEREFLECTIONVECTOR in X_ITE). Not read: KTX2,
     DDS. Gaps: the Material is added to the reflection, not multiplied with it; the reflection is of the world, so it turns with the world, not with the camera; the face images are not turned
     to the orientation of X_ITE's (flat colours cannot show it); a panorama's orientation is not compared. */
  build() { return null; },
  changed(body, n, field) { if (field === 'url' || field === 'load') BR.cube.reload(body, n); },
});
BR.cube ||= {};
Object.assign(BR.cube, {
  FACES: { px: [2, 1], py: [1, 0], pz: [3, 1], nx: [0, 1], ny: [1, 2], nz: [1, 1] },       // X3D right, top, back, left, bottom, front, in the cross (column, row)
  canvasFaces(img) {                                  // -> six canvases in the order of Babylon's cube [px, py, pz, nx, ny, nz], or null
    const W = img.naturalWidth, H = img.naturalHeight, ar = W / H, mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const order = ['px', 'py', 'pz', 'nx', 'ny', 'nz'];
    if (Math.abs(ar - 4 / 3) < 0.01) {
      const w = Math.floor(W / 4), h = Math.floor(H / 3);
      return order.map((k) => { const c = mk(w, h), [ox, oy] = BR.cube.FACES[k]; c.getContext('2d').drawImage(img, ox * w, oy * h, w, h, 0, 0, w, h); return c; });
    }
    if (Math.abs(ar - 2) < 0.01) {                    // equirectangular: the middle of the picture looks along -z, the left edge to the right of it going round
      const S = Math.min(256, Math.floor(H / 2)), src = mk(W, H), sg = src.getContext('2d'); sg.drawImage(img, 0, 0); const sd = sg.getImageData(0, 0, W, H).data;
      const dir = { px: (u, v) => [1, -v, -u], nx: (u, v) => [-1, -v, u], py: (u, v) => [u, 1, v], ny: (u, v) => [u, -1, -v], pz: (u, v) => [u, -v, 1], nz: (u, v) => [-u, -v, -1] };
      return order.map((k) => {
        const c = mk(S, S), g = c.getContext('2d'), out = g.createImageData(S, S);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const [dx, dy, dz] = dir[k](2 * (x + 0.5) / S - 1, 2 * (y + 0.5) / S - 1), L = Math.hypot(dx, dy, dz);
          const lon = Math.atan2(dx, -dz), lat = Math.asin(dy / L), sx = Math.min(W - 1, Math.max(0, Math.floor((0.5 + lon / (2 * Math.PI)) * W))), sy = Math.min(H - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * H)));
          out.data.set(sd.subarray((sy * W + sx) * 4, (sy * W + sx) * 4 + 4), (y * S + x) * 4);
        }
        g.putImageData(out, 0, 0); return c;
      });
    }
    return null;
  },
  entry(body, n) { const key = 'cube:' + n.id; let e = body.texCache.get(key); if (!e) { e = { tex: null, mats: [], node: n }; body.texCache.set(key, e); } return e; },
  load(body, n) {                                     // the image -> a Babylon cube texture; every material waiting for it gets it
    const e = BR.cube.entry(body, n), u = (n.f.url || [])[0];
    if (e.tex) { e.tex.dispose(); e.tex = null; }
    for (const m of e.mats) m.reflectionTexture = null;
    if (!u || n.f.load === false) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cs = BR.cube.canvasFaces(img); if (!cs) { body.note('ImageCubeMapTexture: image ' + img.naturalWidth + 'x' + img.naturalHeight + ' is neither a 4:3 cross nor a 2:1 panorama'); return; }
      const t = BABYLON.CubeTexture.CreateFromImages(cs.map((c) => c.toDataURL('image/png')), body.scene, true);
      t.coordinatesMode = BABYLON.Texture.CUBIC_MODE; e.tex = t;
      for (const m of e.mats) m.reflectionTexture = t;
    };
    img.onerror = () => body.note('ImageCubeMapTexture: image not loaded');
    img.src = body.resolve(u, body.baseUrl);
  },
  reload(body, n) { if (body.texCache.get('cube:' + n.id)) BR.cube.load(body, n); },
  apply(body, mat, node, mesh) {                      // a material that mirrors the cube map
    if (node.type === 'GeneratedCubeMapTexture') return BR.cube.generated(body, mat, node, mesh);
    const e = BR.cube.entry(body, node); e.mats.push(mat);
    if (e.tex) mat.reflectionTexture = e.tex; else if (!e.loading) { e.loading = true; BR.cube.load(body, node); }
  },
});
