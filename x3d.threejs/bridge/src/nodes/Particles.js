/* ParticleSystems for the three.js bridge: ParticleSystem with its emitters (PointEmitter, ConeEmitter, VolumeEmitter, PolylineEmitter, SurfaceEmitter, ExplosionEmitter) and physics (ForcePhysicsModel,
   WindPhysicsModel, BoundedPhysicsModel). The emitter shapes, the triangle readers and the sprite choices are the shared ones of the Babylon bridge (BR.ps, x3d.webgpu/bridge/src/nodes/ParticleSystem.js);
   here the particles are simulated on the CPU in the emitter's local space (so a moving Transform carries them) and drawn as one THREE.Points per system: POINT is a dot a few pixels wide, the other
   geometry types are camera facing sprites whose size is in world units (the point size is the quad's size over tan(fov / 2), attenuated by the depth). The colour ramp runs over the particle's life
   (ColorRGBA keeps its alpha); a quad, triangle or sprite particle is lit like a surface (emissive + diffuse x headlight), as X_ITE 16.6.0 draws it; no fade at the end of life without a ramp. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, PS = BR.ps;
  const mask = (body, type) => {   // the dot, triangle or square a particle is drawn with
    const key = 'psmask3:' + type; if (body.texCache.has(key)) return body.texCache.get(key);
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.fillStyle = '#fff';
    if (type === 'TRIANGLE') { c.beginPath(); c.moveTo(S / 2, 3); c.lineTo(S - 3, S - 3); c.lineTo(3, S - 3); c.closePath(); c.fill(); }
    else if (type === 'QUAD' || type === 'LINE') c.fillRect(0, 0, S, S);
    else { const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(type === 'POINT' ? 0.85 : 0.55, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, S, S); }
    const t = new THREE.CanvasTexture(cv); body.texCache.set(key, t); return t;
  };
  const stub = () => ({ x: 0, y: 0, z: 0, copyFromFloats(x, y, z) { this.x = x; this.y = y; this.z = z; } });
  const physics = (body, n) => {   // the models of the system, as the Babylon body has them: wind pulls the velocity toward the wind, a bound reflects what leaves it
    const models = n.f.physics || [], em = n.f.emitter, mass = Math.max((em && em.f.mass) || 0, 0) || 1, force = [0, 0, 0];
    for (const m of models) if (m.type === 'ForcePhysicsModel' && m.f.enabled !== false) for (let k = 0; k < 3; k++) force[k] += m.f.force[k] / mass;
    const bounds = models.filter((m) => m.type === 'BoundedPhysicsModel').map((m) => ({ m, g: m.f.geometry, r: undefined, box: null }));
    for (const b of bounds) { if (!b.g) continue; if (b.g.type === 'Sphere') b.r = b.g.f.radius; else if (b.g.type === 'Box') { const s = b.g.f.size; b.box = { lo: s.map((v) => -v / 2), hi: s.map((v) => v / 2) }; } else { const flat = []; for (const t of PS.tris(body, b.g)) for (const v of t) flat.push(...v); const bx = PS.box(flat); if (bx) b.box = bx; } }
    let t0 = 0;
    return { force, step(parts, dt) {
      t0 += dt; const wm = models.find((m) => m.type === 'WindPhysicsModel' && m.f.enabled !== false); let wind = null;
      if (wm) { const d = PS.unit(wm.f.direction) || [1, 0, 0], g = 1 + (wm.f.gustiness || 0) * Math.sin(t0 * 1.7) * Math.sin(t0 * 0.43 + 1), sp = Math.max(0, wm.f.speed) * g; wind = d.map((v) => v * sp); }
      for (const p of parts) {
        if (wind) { const k = Math.min(1, 0.8 * dt / mass); p.d[0] += (wind[0] - p.d[0]) * k; p.d[1] += (wind[1] - p.d[1]) * k; p.d[2] += (wind[2] - p.d[2]) * k;
          const tb = wm.f.turbulence || 0; if (tb > 0) for (let q = 0; q < 3; q++) p.d[q] += (PS.rnd() - 0.5) * tb * dt * 4; }
        for (const b of bounds) {
          if (b.m.f.enabled === false) continue;
          if (b.r !== undefined) { const L = Math.hypot(...p.p); if (L > b.r && L > 0) { const nn = p.p.map((v) => v / L), vn = p.d[0] * nn[0] + p.d[1] * nn[1] + p.d[2] * nn[2]; if (vn > 0) { for (let q = 0; q < 3; q++) p.d[q] -= 2 * vn * nn[q]; } for (let q = 0; q < 3; q++) p.p[q] = nn[q] * b.r; } }
          else if (b.box) for (let q = 0; q < 3; q++) { if (p.p[q] < b.box.lo[q]) { p.p[q] = b.box.lo[q]; p.d[q] = Math.abs(p.d[q]); } else if (p.p[q] > b.box.hi[q]) { p.p[q] = b.box.hi[q]; p.d[q] = -Math.abs(p.d[q]); } }
        }
      }
    } };
  };
  const drop = (body, r) => { if (r.points) { r.points.geometry.dispose(); r.points.material.dispose(); } if (r.tn) r.tn.removeFromParent(); body.psys = (body.psys || []).filter((x) => x !== r); };
  const build = (body, n, parent, chain) => {
    const f = n.f, r = { node: n, chain: [n, ...chain], kids: [], parts: [], acc: 0 }; body.rec.set(n.id, r);
    const tn = new THREE.Group(); tn.name = 'ps-' + (n.def || n.id); parent.add(tn); r.tn = tn;
    if (f.visible === false) tn.visible = false;
    if (!f.emitter) return r;
    const cap = Math.max(1, Math.min(20000, f.maxParticles | 0)), em = f.emitter, L = Math.max(0.05, f.particleLifetime), v = Math.min(1, Math.max(0, f.lifetimeVariation));
    r.cap = cap; r.burst = em.type === 'ExplosionEmitter'; r.life = [L * (1 - v), L * (1 + v)]; r.shape = PS.shape(body, n); r.phys = physics(body, n);
    const ap = f.appearance, mat = ap && ap.f.material, tex = ap && ap.f.texture, type = String(f.geometryType || 'QUAD').toUpperCase(), sz = f.particleSize || [0.02, 0.02];
    const t = tex && tex.type !== 'MultiTexture' ? body.texFor(tex, ap && ap.f.textureTransform) : null;
    const lit = type !== 'POINT' && type !== 'LINE' && (() => { const ni = body.world && body.world.nodes.find((x) => x.type === 'NavigationInfo'); return !ni || ni.f.headlight !== false; })();
    const tint = mat ? (() => { const e = mat.f.emissiveColor || [0, 0, 0], d = mat.f.diffuseColor || [0.8, 0.8, 0.8]; return (e[0] || e[1] || e[2]) || lit ? [0, 1, 2].map((i) => Math.min(1, e[i] + (lit ? d[i] : 0))) : d; })() : [1, 1, 1], tr = mat ? 1 - (mat.f.transparency || 0) : 1;
    r.tint = tint; r.tr = tr;
    const ramp = f.color, keys = f.colorKey || [], cs = ramp && ramp.f.color, w = ramp && ramp.type === 'ColorRGBA' ? 4 : 3;
    r.grad = null; if (cs && cs.length >= w) { const nC = cs.length / w; r.grad = []; for (let i = 0; i < nC; i++) r.grad.push({ k: Math.min(1, Math.max(0, keys.length === nC ? keys[i] : i / Math.max(1, nC - 1))), c: [cs[i * w] * tint[0], cs[i * w + 1] * tint[1], cs[i * w + 2] * tint[2], (w === 4 ? cs[i * w + 3] : 1) * tr] }); r.grad.sort((a, b) => a.k - b.k); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 4), 4)); g.setDrawRange(0, 0);
    const dots = type === 'POINT', pm = new THREE.PointsMaterial({ size: dots ? (BR.pointSize || 3) : 1, sizeAttenuation: !dots, vertexColors: true, transparent: true, depthWrite: false, map: t || mask(body, type === 'GEOMETRY' ? 'SPRITE' : type) });
    r.world = f.particleSize || [0.02, 0.02]; r.dots = dots; r.size = sz[0];
    r.points = new THREE.Points(g, pm); r.points.frustumCulled = false; r.points.userData.particles = r; tn.add(r.points);
    (body.psys ||= []).push(r);
    BR.emit(n, 'isActive', !!(f.enabled && f.createParticles));
    return r;
  };
  const colorAt = (r, a) => {   // a = age / life
    if (!r.grad) return [r.tint[0], r.tint[1], r.tint[2], r.tr];
    const G = r.grad; if (a <= G[0].k) return G[0].c; for (let i = 1; i < G.length; i++) if (a <= G[i].k) { const u = (a - G[i - 1].k) / Math.max(1e-9, G[i].k - G[i - 1].k); return G[i - 1].c.map((x, q) => x + (G[i].c[q] - x) * u); } return G[G.length - 1].c;
  };
  const step = (body, r, dt) => {
    const n = r.node, f = n.f, em = f.emitter; if (!r.points) return;
    const on = f.enabled !== false && em.f.on !== false;
    if (r.burst) { if (!r.fired && on) { r.fired = true; for (let i = 0; i < r.cap; i++) spawn(r); } }
    else if (on && f.createParticles) { r.acc += dt * r.cap / ((r.life[0] + r.life[1]) / 2); while (r.acc >= 1 && r.parts.length < r.cap) { spawn(r); r.acc -= 1; } r.acc = Math.min(r.acc, 1); }
    const F = r.phys.force; for (const p of r.parts) { p.age += dt; p.d[0] += F[0] * dt; p.d[1] += F[1] * dt; p.d[2] += F[2] * dt; p.p[0] += p.d[0] * dt; p.p[1] += p.d[1] * dt; p.p[2] += p.d[2] * dt; }
    r.phys.step(r.parts, dt); r.parts = r.parts.filter((p) => p.age < p.life);
    const pos = r.points.geometry.attributes.position, col = r.points.geometry.attributes.color; let i = 0;
    for (const p of r.parts) { pos.setXYZ(i, p.p[0], p.p[1], p.p[2]); const c = colorAt(r, p.age / p.life); col.setXYZW(i, c[0], c[1], c[2], c[3]); i++; }
    pos.needsUpdate = col.needsUpdate = true; r.points.geometry.setDrawRange(0, i);
    if (!r.dots) { const cam = body.cam, fov = cam && cam.isPerspectiveCamera ? Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) : 1; r.points.material.size = r.size / fov; }
  };
  const spawn = (r) => {
    const a = stub(), d = stub(); r.shape.startPositionFunction(null, a); r.shape.startDirectionFunction(null, d);
    r.parts.push({ p: [a.x, a.y, a.z], d: [d.x, d.y, d.z], age: 0, life: r.life[0] + PS.rnd() * (r.life[1] - r.life[0]) });
  };
  T3.particles = { update(body) {
    const now = performance.now(), dt = Math.min(0.1, (now - (body._psT || now)) / 1000); body._psT = now; if (!body.psys || !body.psys.length) return;
    body.psys = body.psys.filter((r) => r.tn.parent); for (const r of body.psys) step(body, r, dt);
  } };
  T3.build.ParticleSystem = build;
  T3.changed.ParticleSystem = (body, n, field) => {
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'visible') r.tn.visible = n.f.visible !== false;
    else if (['enabled', 'createParticles'].includes(field)) BR.emit(n, 'isActive', !!(n.f.enabled && n.f.createParticles));
    else if (['maxParticles', 'particleLifetime', 'lifetimeVariation', 'particleSize', 'geometryType', 'emitter', 'physics', 'colorKey', 'color', 'appearance'].includes(field)) {
      const parent = r.tn.parent, chain = r.chain.slice(1); drop(body, r); const nr = build(body, n, parent, chain); for (const pr of body.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; }
    }
  };
  for (const t of ['PointEmitter', 'ConeEmitter', 'VolumeEmitter', 'PolylineEmitter', 'SurfaceEmitter', 'ExplosionEmitter', 'ForcePhysicsModel', 'WindPhysicsModel', 'BoundedPhysicsModel']) if (!T3.build[t]) T3.build[t] = () => null;
}
