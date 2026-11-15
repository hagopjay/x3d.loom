R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
/* Background and TextureBackground (19775-1 24.4.1) for the three.js bridge: the sky is a sphere of vertex colours, the ground a cap of one over its lower part, the six textures a box, all drawn first,
   without depth, around the camera (the group follows the camera, updateView). The stock Babylon body draws a flat colour; this is the real thing, compared with X_ITE 16.6.0 in fixtures/Background.x3d.
   Angles: skyAngle runs from the zenith (0) to the nadir (pi); skyColor[i] sits at skyAngle[i - 1] (skyColor[0] at the zenith) and the last colour holds to the nadir. groundAngle runs from the nadir (0) up;
   groundColor[i] sits at groundAngle[i - 1], and the last colour holds up to the horizon (X_ITE 16.6.0 draws the ground to the horizon whatever the last angle). */
R.bridge.three.backdrop = {
  /* a sphere of unit radius whose ring colours come from (angle from the pole, colour) stops; lo/hi bound the polar angle range drawn */
  sphere(stops, lo, hi, opacity) {
    const T = THREE, ang = new Set([lo, hi]); for (let i = 0; i <= 48; i++) { const a = lo + (hi - lo) * i / 48; ang.add(a); } for (const s of stops) if (s[0] > lo && s[0] < hi) ang.add(s[0]);
    const rings = [...ang].sort((a, b) => a - b), N = 48, pos = [], col = [], idx = [];
    const at = (a) => { let k = 0; while (k + 1 < stops.length && stops[k + 1][0] <= a) k++; if (k + 1 >= stops.length) return stops[k][1]; const s0 = stops[k], s1 = stops[k + 1], u = s1[0] > s0[0] ? Math.min(1, Math.max(0, (a - s0[0]) / (s1[0] - s0[0]))) : 0; return [0, 1, 2].map((i) => s0[1][i] + (s1[1][i] - s0[1][i]) * u); };
    for (const a of rings) { const c = at(a); for (let j = 0; j <= N; j++) { const t = j / N * Math.PI * 2; pos.push(Math.sin(a) * Math.cos(t), Math.cos(a), Math.sin(a) * Math.sin(t)); col.push(c[0], c[1], c[2]); } }
    for (let r = 0; r + 1 < rings.length; r++) for (let j = 0; j < N; j++) { const a = r * (N + 1) + j, b = a + N + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(Float32Array.from(pos), 3)); g.setAttribute('color', new T.BufferAttribute(Float32Array.from(col), 3)); g.setIndex(idx);
    const m = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false, transparent: opacity < 0.999, opacity });
    return new T.Mesh(g, m);
  },
  /* the six faces: for each, the direction the viewer looks to see it (d), and the right and up directions of its image as seen from inside. front -Z, back +Z, left -X, right +X, top +Y (image up toward +Z), bottom -Y (image up toward -Z) */
  FACES: { front: [[0, 0, -1], [1, 0, 0], [0, 1, 0]], back: [[0, 0, 1], [-1, 0, 0], [0, 1, 0]], left: [[-1, 0, 0], [0, 0, -1], [0, 1, 0]], right: [[1, 0, 0], [0, 0, 1], [0, 1, 0]], top: [[0, 1, 0], [1, 0, 0], [0, 0, 1]], bottom: [[0, -1, 0], [1, 0, 0], [0, 0, -1]] },
  face(name, tex, opacity) {
    const T = THREE, [d, x, y] = R.bridge.three.backdrop.FACES[name], z = [-d[0], -d[1], -d[2]];
    const m = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: tex, side: T.FrontSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false, transparent: true, opacity }));
    m.matrixAutoUpdate = false; m.matrix.makeBasis(new T.Vector3(...x), new T.Vector3(...y), new T.Vector3(...z)).setPosition(d[0], d[1], d[2]); return m;
  },
  /* the whole backdrop of a Background / TextureBackground node: a Group with the sky, the ground and the faces, in draw order */
  make(body, bg) {
    const T = THREE, BD = R.bridge.three.backdrop, g = new T.Group(), f = bg.f, op = 1 - (f.transparency || 0); let order = -1000;
    const sc = f.skyColor && f.skyColor.length ? f.skyColor : [[0, 0, 0]], sa = f.skyAngle || [];
    const sky = BD.sphere(sc.map((c, i) => [i === 0 ? 0 : sa[i - 1] === undefined ? Math.PI : sa[i - 1], c]), 0, Math.PI, op); sky.renderOrder = order++; g.add(sky);
    const gc = f.groundColor || [], ga = f.groundAngle || [];
    if (gc.length) {   // polar angle from the +Y pole: nadir is pi, so a ground angle a is pi - a, and the stops run from the nadir up
      const stops = gc.map((c, i) => [Math.PI - (i === 0 ? 0 : ga[i - 1] === undefined ? Math.PI / 2 : ga[i - 1]), c]).sort((a, b) => a[0] - b[0]);
      if (stops[0][0] > Math.PI / 2) stops.unshift([Math.PI / 2, stops[0][1]]);   // measured against X_ITE 16.6.0: the last ground colour holds out to the horizon, the ground does not stop at the last groundAngle
      const hi = Math.PI, lo = stops[0][0]; const gs = BD.sphere(stops, lo, hi, op); gs.renderOrder = order++; g.add(gs);
    }
    const names = bg.type === 'TextureBackground' ? { front: 'frontTexture', back: 'backTexture', left: 'leftTexture', right: 'rightTexture', top: 'topTexture', bottom: 'bottomTexture' } : null;
    for (const nm of Object.keys(BD.FACES)) {
      let tex = null;
      if (names) tex = body.tex(f[names[nm]]); else { const u = f[nm + 'Url']; if (u && u.length) tex = new T.TextureLoader().load(body.resolve(u[0], body.baseUrl)); }
      if (!tex) continue; if (!names) tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
      const m = BD.face(nm, tex, op); m.renderOrder = order++; g.add(m);
    }
    return g;
  },
};
