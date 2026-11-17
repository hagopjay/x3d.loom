// ===== view.js : the three.js bridge. Reads the same level data the physics reads and draws it as a neon blueprint. =====
const PAL = { bg: 0x071426, grid: 0x14314b, grid2: 0x235373, cyan: 0x54ddff, amber: 0xffc65c, pink: 0xff63ab, mint: 0x8bffc7, ink: 0xe5f0ff };
const DEPTH = { static: 2.4, crate: 0.9, domino: 1.0, ball: 0.5, plank: 1.6, chain: 0.14, hazard: 0.8, jelly: 0.6, spring: 2.0, peg: 1.6, lift: 1.8, cloth: 0.5, hero: 0.5, rag: 0.2 };
function viewExtent(b) { const c = Math.abs(Math.cos(b.a || 0)), s = Math.abs(Math.sin(b.a || 0)); return b.shape === 'box' ? { x: c * b.hw + s * b.hh, y: s * b.hw + c * b.hh } : { x: b.r + s * (b.hl || 0), y: b.r + c * (b.hl || 0) }; }

class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.cx = 0; this.cy = 2; this.zoom = 1; this.dist = 24; this.shake = 0; this.shakeOn = true;
    this.cameraMode = 'follow'; this.quality = 'balanced'; this.selected = null; this.hover = null; this.grab = null;
    this.costume = 'party'; this.reducedMotion = false;
    this.clock = 0; this.bloomOn = true; this.bloomStatus = 'loading'; this.ghostPoints = []; this.fallbackTrail = []; this.world = null;
    this.overlay = { contacts: false, joints: false, velocity: false, pairs: false, trail: true, centers: false };
    this.geo = new Map(); this.mat = new Map(); this.meshes = new Map(); this.zoneObjs = []; this.frameStats = null;
    try { this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
    catch (error) {
      this.failed = true; this.failureReason = 'WebGL context unavailable'; this.bloomStatus = 'unavailable';
      try { this.fallbackCtx = canvas.getContext('2d'); } catch (_) { this.fallbackCtx = null; }
      const note = document.createElement('div'); note.className = 'renderer-fallback';
      note.textContent = this.fallbackCtx ? 'CANVAS 2D FALLBACK · same simulation, alternate view · WebGL unavailable' : '3D preview unavailable · X3D source and laboratory controls remain accessible';
      Object.assign(note.style, { position: 'absolute', left: '16px', bottom: '64px', maxWidth: 'calc(100% - 32px)', padding: '8px 12px', background: '#0a2038e8', color: '#a2c9e5', font: '10px/1.6 monospace', letterSpacing: '.04em', pointerEvents: 'none', zIndex: 8 });
      canvas.parentElement?.append(note); this.fallbackNote = note; return;
    }
    const r = this.renderer; r.info.autoReset = false; r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2; r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(PAL.bg); this.scene.fog = new THREE.Fog(PAL.bg, 65, 380);
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
    this.level = new THREE.Group(); this.scene.add(this.level);
    this.scene.add(new THREE.HemisphereLight(0xa9dbff, 0x162343, 2));
    const key = new THREE.DirectionalLight(0xffe3b8, 2.6); key.position.set(-8, 12, 18); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x40b9ff, 1.8); fill.position.set(10, 3, -12); this.scene.add(fill);
    const mk = (c, n) => { const g = new THREE.GridHelper(600, n, c, c); g.rotation.x = Math.PI / 2; g.position.z = -1.3; g.material.fog = true; this.scene.add(g); return g; };
    mk(PAL.grid, 600); mk(PAL.grid2, 120).position.z = -1.29;
    const starPoints = []; let seed = 14071;
    for (let i = 0; i < 280; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed / 4294967296; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const y = seed / 4294967296; starPoints.push(x * 520 - 150, y * 100 - 25, -20 - (i % 5) * 5); }
    this.scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPoints, 3)), new THREE.PointsMaterial({ color: 0x73aac8, size: 0.075, transparent: true, opacity: 0.5, depthWrite: false })));
    // debug lines: one buffer, rebuilt every frame
    this.dbgMax = 24000; const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.dbgMax * 3), 3)); dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.dbgMax * 3), 3));
    this.dbg = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true })); this.dbg.renderOrder = 10; this.dbg.frustumCulled = false; this.scene.add(this.dbg); this.dn = 0;
    // trail of the limp dummy's chest
    this.trailN = 0; const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0.7 })); this.trail.frustumCulled = false; this.scene.add(this.trail);
    this.rope = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: PAL.amber })); this.rope.frustumCulled = false; this.scene.add(this.rope);
    this.rings = []; for (let i = 0; i < 8; i++) { const m = new THREE.LineLoop(this.circleGeo(1, 28), new THREE.LineBasicMaterial({ color: PAL.pink, transparent: true })); m.visible = false; this.scene.add(m); this.rings.push({ m, t: 1 }); }
    this.ghost = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(2400 * 3), 3)), new THREE.LineBasicMaterial({ color: PAL.mint, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.geometry.setDrawRange(0, 0); this.ghost.frustumCulled = false; this.scene.add(this.ghost);
    this.composer = null; this.ray = new THREE.Raycaster();
    this.initBloom();
  }
  setCameraMode(mode) {
    if (!['follow', 'free', 'overview'].includes(mode)) return false;
    this.cameraMode = mode; this.freeX = this.cx; this.freeY = this.cy;
    if (mode === 'follow') this.zoom = 1;
    return true;
  }
  // Costumes and expressions are presentation only: no body, mass or joint changes.
  setCostume(value) {
    if (!['pilot', 'party', 'noodle'].includes(value)) return false;
    this.costume = value; return true;
  }
  expression(sim) {
    const f = sim.focus(), speed = Math.hypot(f?.vx || 0, f?.vy || 0);
    return { speed, surprised: sim.mode === 'limp' || speed > 15,
      blink: !this.reducedMotion && this.clock % 4.7 < .11,
      bonk: !this.reviewing && sim.mode === 'limp' && (sim.stunt?.bonkCd || 0) > .07 };
  }
  mascot(body, depth) {
    const root = new THREE.Group(), size = body.role === 'hero' ? 1 : .46;
    root.position.set(0, body.role === 'hero' ? .31 : 0, depth / 2 + .03);
    root.scale.setScalar(size);
    const white = new THREE.MeshBasicMaterial({ color: 0xfff8db }), black = new THREE.MeshBasicMaterial({ color: 0x182640 });
    const eyes = [], pupils = [];
    for (const x of [-.11, .11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.096, 10, 8), white); eye.scale.z = .28; eye.position.set(x, .055, 0); root.add(eye); eyes.push(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), black); pupil.scale.z = .3; pupil.position.set(x + .025, .055, .028); root.add(pupil); pupils.push(pupil);
    }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(.065, 10, 8), black); mouth.position.set(.025, -.11, .005); mouth.scale.set(1, .35, .3); root.add(mouth);
    const pilot = new THREE.Mesh(new THREE.TorusGeometry(.255, .026, 6, 20), new THREE.MeshBasicMaterial({ color: 0x54ddff })); pilot.scale.y = .55; pilot.position.set(0, .05, -.005); root.add(pilot);
    const party = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.16, .37, 10), new THREE.MeshStandardMaterial({ color: 0xff63ab, emissive: 0x381329, roughness: .5 })); cone.position.y = .34; party.add(cone);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8bffc7 })); pom.position.y = .55; party.add(pom); root.add(party);
    const noodle = new THREE.Group();
    for (const side of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .3, 5), new THREE.MeshBasicMaterial({ color: 0x8bffc7 })); stalk.position.set(side * .14, .28, 0); stalk.rotation.z = -side * .3; noodle.add(stalk);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 6), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xffc65c : 0xb79bff })); tip.position.set(side * .19, .43, 0); noodle.add(tip);
    }
    root.add(noodle); root.userData = { eyes, pupils, mouth, pilot, party, noodle }; return root;
  }
  updateMascot(mesh, sim) {
    const face = mesh.userData.face; if (!face) return;
    const e = this.expression(sim), d = face.userData;
    for (let i = 0; i < 2; i++) { d.eyes[i].scale.y = e.blink ? .12 : 1; d.pupils[i].scale.y = e.blink ? .12 : 1; d.pupils[i].position.x = (i ? .11 : -.11) + Math.min(.04, e.speed * .002); }
    d.mouth.scale.set(e.bonk ? 1.3 : e.surprised ? .7 : 1, e.surprised ? 1.4 : .32, .3);
    d.pilot.visible = this.costume === 'pilot'; d.party.visible = this.costume === 'party'; d.noodle.visible = this.costume === 'noodle';
    d.noodle.rotation.z = this.reducedMotion ? 0 : Math.sin(this.clock * 10) * Math.min(.12, e.speed * .004);
  }
  pan(dx, dy) {
    if (!Number.isFinite(dx + dy)) return;
    if (this.cameraMode !== 'free') this.setCameraMode('free');
    this.freeX += dx; this.freeY += dy;
  }
  select(body) { this.selected = body || null; }
  frameBody(body) {
    if (!body || !Number.isFinite(body.x + body.y)) return;
    this.select(body); this.setCameraMode('free'); this.freeX = body.x; this.freeY = body.y;
    const extent = viewExtent(body); this.zoom = clamp(Math.max(extent.x, extent.y) / 4, .4, 1.4);
  }
  setQuality(value) {
    if (!['low', 'balanced', 'high'].includes(value)) return false;
    this.quality = value;
    if (this.renderer) this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, value === 'high' ? 2 : value === 'low' ? 1 : 1.25));
    if (this.composer?.setPixelRatio) this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.resize(true); return true;
  }
  setGhost(points) {
    if (!Array.isArray(points)) points = [];
    this.ghostPoints = points.slice(-2400).map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p).filter(p => p && Number.isFinite(p.x + p.y));
    if (this.ghost) {
      const position = this.ghost.geometry.attributes.position;
      for (let i = 0; i < this.ghostPoints.length; i++) { const p = this.ghostPoints[i]; position.setXYZ(i, p.x, p.y, .6); }
      position.needsUpdate = true; this.ghost.geometry.setDrawRange(0, this.ghostPoints.length);
    }
  }
  stats() {
    return { renderer: this.failed ? this.fallbackCtx ? 'canvas2d' : 'unavailable' : 'webgl', available: !this.failed || !!this.fallbackCtx,
      quality: this.quality, camera: this.cameraMode, bloom: !this.bloomOn || this.quality === 'low' ? 'disabled' : this.bloomStatus,
      drawCalls: this.frameStats?.calls ?? null, triangles: this.frameStats?.triangles ?? null, lines: this.frameStats?.lines ?? null,
      geometries: this.renderer?.info.memory.geometries ?? null, textures: this.renderer?.info.memory.textures ?? null,
      pixelRatio: this.renderer?.getPixelRatio() ?? this.fallbackDpr ?? 1, bodies: this.world?.bodies.filter(b => !b.off).length ?? this.meshes.size, ghostSamples: this.ghostPoints.length,
      pairOverlayLimit: 2048, debugLineVertexLimit: 24000,
      scope: 'Display counters only; these do not establish physical correctness or a Loom render witness.' };
  }
  updateCamera(sim, dtReal, focusOverride) {
    const f = focusOverride || sim.focus(), sp = Math.hypot(f.vx || 0, f.vy || 0), k = 1 - Math.exp(-dtReal * 5);
    let tx = f.x + clamp((f.vx || 0) * .35, -5, 5), ty = Math.max(f.y + 1.6, -4), distance = 22 + Math.min(sp, 40) * .42;
    if (this.cameraMode === 'free') { tx = this.freeX ?? this.cx; ty = this.freeY ?? this.cy; distance = 22; }
    else if (this.cameraMode === 'overview' && this.bounds) {
      const b = this.bounds; tx = (b.minx + b.maxx) / 2; ty = (b.miny + b.maxy) / 2;
      distance = Math.max((b.maxy - b.miny + 8) / .68, (b.maxx - b.minx + 12) / (.68 * Math.max(.4, (this.w || 800) / (this.h || 600))));
    }
    this.cx += (tx - this.cx) * k; this.cy += (ty - this.cy) * k;
    this.dist += (Math.max(7, distance * this.zoom) - this.dist) * (1 - Math.exp(-dtReal * 2.5));
    this.shake *= Math.exp(-dtReal * 9);
    if (this.cam) { const sh = this.shakeOn && !this.reducedMotion ? this.shake : 0; this.cam.position.set(this.cx + .6 + Math.sin(this.clock * 61) * sh, this.cy + 1.2 + Math.cos(this.clock * 53) * sh, this.dist); this.cam.lookAt(this.cx, this.cy - .4, 0); }
  }
  drawFallback(sim, dtReal, focusOverride) {
    const c = this.fallbackCtx; if (!c) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.w = w; this.h = h; this.fallbackDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (this.canvas.width !== Math.round(w * this.fallbackDpr) || this.canvas.height !== Math.round(h * this.fallbackDpr)) { this.canvas.width = Math.round(w * this.fallbackDpr); this.canvas.height = Math.round(h * this.fallbackDpr); }
    c.setTransform(this.fallbackDpr, 0, 0, this.fallbackDpr, 0, 0); this.clock += dtReal; this.updateCamera(sim, dtReal, focusOverride);
    this.fallbackScale = h / Math.max(6, this.dist * .68);
    const X = x => w / 2 + (x - this.cx) * this.fallbackScale, Y = y => h / 2 - (y - this.cy) * this.fallbackScale, sc = this.fallbackScale;
    c.fillStyle = '#071426'; c.fillRect(0, 0, w, h); c.strokeStyle = '#183a53'; c.lineWidth = .5; c.beginPath();
    const step = sc < 7 ? 10 : sc < 20 ? 5 : 1;
    for (let x = Math.floor((this.cx - w / 2 / sc) / step) * step; X(x) < w; x += step) { c.moveTo(X(x), 0); c.lineTo(X(x), h); }
    for (let y = Math.floor((this.cy - h / 2 / sc) / step) * step; Y(y) > 0; y += step) { c.moveTo(0, Y(y)); c.lineTo(w, Y(y)); } c.stroke();
    if (this.ghostPoints.length > 1) { c.strokeStyle = '#8bffc766'; c.beginPath(); this.ghostPoints.forEach((p, i) => i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y))); c.stroke(); }
    if (sim.mode === 'limp' && this.overlay.trail && sim.rag?.chest) { this.fallbackTrail.push({ x: sim.rag.chest.x, y: sim.rag.chest.y }); if (this.fallbackTrail.length > 600) this.fallbackTrail.shift(); }
    else if (!this.keepTrail) this.fallbackTrail.length = 0;
    if (this.fallbackTrail.length > 1) { c.strokeStyle = '#ffc65c88'; c.beginPath(); this.fallbackTrail.forEach((p, i) => i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y))); c.stroke(); }
    for (const z of sim.W.zones) {
      c.strokeStyle = z.kind === 'goal' ? '#ff63ab' : z.kind === 'star' ? '#ffc65c' : '#8bffc766'; c.fillStyle = '#17365788';
      if (z.kind === 'label') { if (sc > 10) { c.fillStyle = '#91b5d1'; c.font = 'bold 15px system-ui'; c.fillText(z.title || '', X(z.x), Y(z.y)); } continue; }
      if (z.kind === 'star' && z.got) continue;
      if (['water', 'fan', 'goal'].includes(z.kind)) { c.fillRect(X(z.x - z.w / 2), Y(z.y + z.h / 2), z.w * sc, z.h * sc); c.strokeRect(X(z.x - z.w / 2), Y(z.y + z.h / 2), z.w * sc, z.h * sc); }
      else if (['ring', 'star', 'cannon', 'checkpoint'].includes(z.kind)) { c.beginPath(); c.arc(X(z.x), Y(z.y), (z.kind === 'checkpoint' ? .15 : .4) * sc, 0, Math.PI * 2); c.stroke(); }
    }
    for (const b of sim.W.bodies) {
      const extent = viewExtent(b);
      if (b.off || X(b.x + extent.x) < 0 || X(b.x - extent.x) > w || Y(b.y + extent.y) > h || Y(b.y - extent.y) < 0) continue;
      c.save(); c.translate(X(b.x), Y(b.y)); c.rotate(-b.a); const color = ROLE_COLOR[b.role] || '#54ddff'; c.fillStyle = color + (b.im ? '38' : '18'); c.strokeStyle = color; c.lineWidth = b === this.selected ? 2.5 : 1.25; c.beginPath();
      if (b.shape === 'box') c.rect(-b.hw * sc, -b.hh * sc, b.hw * 2 * sc, b.hh * 2 * sc);
      else if (b.shape === 'ball') c.arc(0, 0, b.r * sc, 0, Math.PI * 2);
      else { const r = b.r * sc, hl = b.hl * sc; c.moveTo(-r, -hl); c.arc(0, -hl, r, Math.PI, 0); c.lineTo(r, hl); c.arc(0, hl, r, 0, Math.PI); c.closePath(); }
      c.fill(); c.stroke();
      if (b.role === 'hero' || b.id === 'RAG_head') {
        const u = (b.role === 'hero' ? 1 : .46) * sc, fy = b.role === 'hero' ? -.31 * sc : 0, e = this.expression(sim);
        c.save(); c.translate(0, fy); c.fillStyle = '#fff8db';
        for (const x of [-.11, .11]) { c.beginPath(); c.ellipse(x*u, -.055*u, .096*u, (e.blink ? .015 : .096)*u, 0, 0, TAU); c.fill(); }
        c.fillStyle = '#182640'; for (const x of [-.11, .11]) { c.beginPath(); c.ellipse((x+.025)*u, -.055*u, .045*u, (e.blink ? .01 : .045)*u, 0, 0, TAU); c.fill(); }
        c.beginPath(); c.ellipse(.025*u,.11*u,(e.surprised ? .045 : .065)*u,(e.surprised ? .09 : .02)*u,0,0,TAU); c.fill();
        if (this.costume === 'party') { c.fillStyle = '#ff63ab'; c.beginPath(); c.moveTo(-.16*u,-.15*u); c.lineTo(0,-.55*u); c.lineTo(.16*u,-.15*u); c.closePath(); c.fill(); c.fillStyle='#8bffc7'; c.beginPath(); c.arc(0,-.55*u,.06*u,0,TAU);c.fill(); }
        else if (this.costume === 'pilot') { c.strokeStyle='#54ddff';c.lineWidth=Math.max(1,.027*u);c.strokeRect(-.24*u,-.16*u,.48*u,.22*u); }
        else { c.strokeStyle='#8bffc7';c.lineWidth=Math.max(1,.025*u);for (const side of [-1,1]) {c.beginPath();c.moveTo(side*.11*u,-.15*u);c.lineTo(side*.2*u,-.42*u);c.stroke();c.fillStyle=side<0?'#ffc65c':'#b79bff';c.beginPath();c.arc(side*.2*u,-.42*u,.07*u,0,TAU);c.fill();} }
        c.restore();
      }
      c.restore();
      if (this.overlay.velocity && b.im) { c.strokeStyle = '#ffc65c'; c.beginPath(); c.moveTo(X(b.x), Y(b.y)); c.lineTo(X(b.x + b.vx * .12), Y(b.y + b.vy * .12)); c.stroke(); }
      if (this.overlay.centers || b === this.selected) { c.fillStyle = '#fff0c4'; c.fillRect(X(b.x) - 2, Y(b.y) - 2, 4, 4); }
    }
    if (this.overlay.joints || sim.hook || this.grab) for (const j of sim.W.joints) {
      if (j.a.off || j.b?.off || (!this.overlay.joints && j !== sim.hook && j !== this.grab)) continue;
      const ca = Math.cos(j.a.a), sa = Math.sin(j.a.a), ax = j.a.x + ca * j.lax - sa * j.lay, ay = j.a.y + sa * j.lax + ca * j.lay;
      let bx = j.lbx, by = j.lby; if (j.b) { const cb = Math.cos(j.b.a), sb = Math.sin(j.b.a); bx = j.b.x + cb * j.lbx - sb * j.lby; by = j.b.y + sb * j.lbx + cb * j.lby; }
      c.strokeStyle = '#ac97d8'; c.beginPath(); c.moveTo(X(ax), Y(ay)); c.lineTo(X(bx), Y(by)); c.stroke();
    }
    if (this.overlay.contacts) for (let i = 0; i < sim.W.nc; i++) { const p = sim.W.contacts[i], len = .25 + Math.min(1.2, p.ln * 60); c.strokeStyle = '#ff63ab'; c.beginPath(); c.moveTo(X(p.px), Y(p.py)); c.lineTo(X(p.px + p.nx * len), Y(p.py + p.ny * len)); c.stroke(); c.fillStyle = '#fff'; c.fillRect(X(p.px) - 1.5, Y(p.py) - 1.5, 3, 3); }
    if (this.overlay.pairs) { c.strokeStyle = '#54ddff55'; for (const b of sim.W.active || []) c.strokeRect(X(b.minx), Y(b.maxy), (b.maxx - b.minx) * sc, (b.maxy - b.miny) * sc); c.beginPath(); for (let i = 0; i < Math.min(sim.W.np || 0, 4096); i += 2) { const a = sim.W.pairs[i], b = sim.W.pairs[i + 1]; c.moveTo(X(a.x), Y(a.y)); c.lineTo(X(b.x), Y(b.y)); } c.stroke(); }
    c.fillStyle = '#92b4d0'; c.font = '11px monospace'; c.textAlign = 'right'; c.fillText('CANVAS 2D  /  ' + this.cameraMode.toUpperCase(), this.canvas.clientWidth - 16, 24); c.textAlign = 'left';
  }
  async initBloom() {
    try {
      const base = './vendor/three/examples/jsm/postprocessing/';
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(['EffectComposer.js', 'RenderPass.js', 'UnrealBloomPass.js', 'OutputPass.js'].map((f) => import(base + f)));
      const c = new EffectComposer(this.renderer); c.addPass(new RenderPass(this.scene, this.cam));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.35, 0.38); c.addPass(this.bloom); c.addPass(new OutputPass());
      this.composer = c; this.bloomStatus = 'active'; this.resize(true);
    } catch (e) { this.composer = null; this.bloomStatus = 'unavailable'; }
  }
  circleGeo(r, n) { const p = []; for (let i = 0; i < n; i++) p.push(Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r, 0); return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
  material(hex, kind) {
    const key = kind + hex; let m = this.mat.get(key); if (m) return m;
    const c = new THREE.Color(hex);
    if (kind === 'fill') m = new THREE.MeshStandardMaterial({ color: new THREE.Color(PAL.bg).lerp(c, 0.46), emissive: c.clone().multiplyScalar(.045), metalness: .45, roughness: .38 });
    else if (kind === 'side') m = new THREE.MeshStandardMaterial({ color: new THREE.Color(PAL.bg).lerp(c, 0.23), emissive: c.clone().multiplyScalar(.025), metalness: .6, roughness: .6 });
    else m = new THREE.LineBasicMaterial({ color: c });
    this.mat.set(key, m); return m;
  }
  bodyGeo(b, D) {
    const key = b.shape === 'box' ? `b${b.hw}_${b.hh}_${D}` : b.shape === 'ball' ? `c${b.r}_${D}` : `p${b.r}_${b.hl}_${D}`;
    let g = this.geo.get(key); if (g) return g;
    let fill;
    if (b.shape === 'box') fill = new THREE.BoxGeometry(b.hw * 2, b.hh * 2, D);
    else if (b.shape === 'ball') { fill = new THREE.CylinderGeometry(b.r, b.r, D, 28); fill.rotateX(Math.PI / 2); }
    else { const s = new THREE.Shape(); s.absarc(0, b.hl, b.r, 0, Math.PI, false); s.absarc(0, -b.hl, b.r, Math.PI, TAU, false); s.closePath(); fill = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 10 }); fill.translate(0, 0, -D / 2); }
    const edges = new THREE.EdgesGeometry(fill, 30);
    if (b.shape === 'ball') { const p = Array.from(edges.attributes.position.array); p.push(0, 0, D / 2, b.r, 0, D / 2); edges.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
    g = { fill, edges }; this.geo.set(key, g); return g;
  }
  addBody(b) {
    if (this.bounds && !b.off && Number.isFinite(b.x + b.y)) { const e = viewExtent(b); this.bounds.minx = Math.min(this.bounds.minx, b.x - e.x); this.bounds.maxx = Math.max(this.bounds.maxx, b.x + e.x); this.bounds.miny = Math.max(-15, Math.min(this.bounds.miny, b.y - e.y)); this.bounds.maxy = Math.max(this.bounds.maxy, b.y + e.y); }
    if (this.failed) { this.meshes.set(b, null); return null; }
    const hex = ROLE_COLOR[b.role] || '#3fd0ff', D = DEPTH[b.role] ?? 0.8, g = this.bodyGeo(b, D), grp = new THREE.Group();
    grp.add(new THREE.Mesh(g.fill, this.material(hex, b.im === 0 && !b.kin ? 'side' : 'fill')));
    grp.add(new THREE.LineSegments(g.edges, this.material(hex, 'edge')));
    if (b.role === 'hero' || b.id === 'RAG_head') { const face = this.mascot(b,D); grp.userData.face = face; grp.add(face); }
    if (b.role === 'rag') grp.position.z = /2$/.test(b.id) ? -0.17 : /1$/.test(b.id) ? 0.17 : 0;
    grp.userData.z = grp.position.z; this.level.add(grp); this.meshes.set(b, grp); return grp;
  }
  label(z) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = '#54ddff'; c.font = '600 78px "Arial Narrow", system-ui, sans-serif'; c.textBaseline = 'top'; c.fillText(z.title || '', 8, 10);
    c.fillRect(8, 108, 150, 4);
    c.fillStyle = '#abc8de'; c.font = '34px system-ui, sans-serif';
    const words = String(z.text || '').split(' '); let line = '', y = 130;
    for (const w of words) { if (c.measureText(line + w).width > 1000) { c.fillText(line, 8, y); line = ''; y += 42; } line += w + ' '; } c.fillText(line, 8, y);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.position.set(z.x + 1.5, z.y, -1.2); return m;
  }
  addZone(z) {
    if (this.failed) return;
    let o = null; const line = (geo, hex, op = 1) => new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: hex, transparent: op < 1, opacity: op }));
    if (z.kind === 'label') o = this.label(z);
    else if (z.kind === 'fan') {
      o = new THREE.Group(); o.add(line(new THREE.EdgesGeometry(new THREE.BoxGeometry(z.w, z.h, 1.6)), PAL.mint, 0.25));
      const n = 14, p = new Float32Array(n * 6); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const dashes = line(g, PAL.mint, 0.8); dashes.frustumCulled = false; o.add(dashes); o.userData.dash = { p, g, n }; o.position.set(z.x, z.y, 0);
    } else if (z.kind === 'water') {
      const n = z.col.length; o = new THREE.Group();
      const g = new THREE.PlaneGeometry(z.w, z.h, n - 1, 1); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1f6fff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const top = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: PAL.cyan }));
      m.position.z = 0.9; top.position.z = 0.9; top.frustumCulled = false; o.add(m, top); o.position.set(z.x, z.y, 0); o.userData.water = { g, lg, n };
    } else if (z.kind === 'ring') { o = new THREE.Group(); o.add(new THREE.LineLoop(this.circleGeo(0.42, 24), new THREE.LineBasicMaterial({ color: PAL.amber })), new THREE.LineLoop(this.circleGeo(0.26, 24), new THREE.LineBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0.5 }))); o.position.set(z.x, z.y, 0); }
    else if (z.kind === 'goal') { o = new THREE.Group(); const r = z.w / 2; for (let i = 1; i <= 4; i++) o.add(new THREE.LineLoop(this.circleGeo((r * i) / 4, 40), new THREE.LineBasicMaterial({ color: i % 2 ? PAL.pink : PAL.ink }))); o.position.set(z.x, z.y, 0); }
    else if (z.kind === 'star') { o = line(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.42)), PAL.amber); o.position.set(z.x, z.y, 0); }
    else if (z.kind === 'checkpoint') { o = line(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.08, 4, 0.08)), PAL.mint, 0.6); o.position.set(z.x, z.y, -0.9); const f = line(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.5, 0.02)), PAL.mint, 0.8); f.position.set(0.5, 1.7, 0); o.add(f); }
    else if (z.kind === 'cannon') {
      o = new THREE.Group(); const brl = new THREE.Group(); const tube = new THREE.CylinderGeometry(0.62, 0.72, 2.6, 16, 1, true); tube.rotateZ(-Math.PI / 2); tube.translate(0.7, 0, 0);
      brl.add(new THREE.Mesh(tube, this.material('#ff4fa3', 'fill')), line(new THREE.EdgesGeometry(tube, 20), PAL.pink)); o.add(brl);
      const base = new THREE.CylinderGeometry(0.9, 0.9, 1.3, 20); base.rotateX(Math.PI / 2); o.add(line(new THREE.EdgesGeometry(base, 30), PAL.pink, 0.7));
      const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3)); const arc = new THREE.Line(ag, new THREE.LineDashedMaterial({ color: PAL.pink, dashSize: 0.3, gapSize: 0.3, transparent: true, opacity: 0.7 })); arc.frustumCulled = false; o.add(arc);
      o.position.set(z.x, z.y, 0); o.userData.cannon = { brl, ag, arc };
    }
    if (o) { o.userData.zone = z; this.level.add(o); this.zoneObjs.push(o); }
  }
  load(W) {
    this.world = W; this.selected = null; this.setGhost([]); this.fallbackTrail.length = 0;
    const active = W.bodies.filter(b => !b.off && Number.isFinite(b.x + b.y));
    this.bounds = active.length ? { minx: Math.min(...active.map(b => b.x - viewExtent(b).x)), maxx: Math.max(...active.map(b => b.x + viewExtent(b).x)), miny: Math.max(-15, Math.min(...active.map(b => b.y - viewExtent(b).y))), maxy: Math.max(...active.map(b => b.y + viewExtent(b).y)) } : { minx: -10, maxx: 10, miny: -5, maxy: 10 };
    if (this.failed) { this.meshes.clear(); for (const b of W.bodies) this.addBody(b); return; }
    // Rebuild owns its old visual resources; body caches are shared only inside a loaded level.
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.level.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { materials.add(m); if (m.map) textures.add(m.map); } });
    for (const g of this.geo.values()) { geometries.add(g.fill); geometries.add(g.edges); }
    for (const m of this.mat.values()) materials.add(m);
    for (const t of textures) t.dispose(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
    this.geo.clear(); this.mat.clear(); this.scene.remove(this.level); this.level = new THREE.Group(); this.scene.add(this.level); this.meshes.clear(); this.zoneObjs = []; this.trailN = 0; this.trail.visible = false; this.trail.geometry.setDrawRange(0, 0);
    for (const r of this.rings) { r.t = 1; r.m.visible = false; }
    for (const b of W.bodies) this.addBody(b); for (const z of W.zones) this.addZone(z);
    // One restrained architectural frame per hall, not per physics body.
    for (const z of W.zones.filter(q => q.kind === 'checkpoint').slice(0, 24)) {
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(23, 17, .15)), new THREE.LineBasicMaterial({ color: 0x2e688b, transparent: true, opacity: .23 }));
      frame.position.set(z.x + 9, 3, -4.5); this.level.add(frame);
    }
  }
  resize(force) {
    if (this.failed) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    if (!force && w === this.w && h === this.h) return; this.w = w; this.h = h;
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); if (this.composer) this.composer.setSize(w, h);
  }
  worldAt(clientX, clientY) { // screen point -> point on the z = 0 plane
    if (this.failed) { const r = this.canvas.getBoundingClientRect(), sc = this.fallbackScale || (r.height || 600) / 16; return { x: this.cx + (clientX - r.left - r.width / 2) / sc, y: this.cy - (clientY - r.top - r.height / 2) / sc }; }
    const r = this.canvas.getBoundingClientRect(), v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.cam); const o = this.ray.ray.origin, d = this.ray.ray.direction, t = -o.z / d.z; return { x: o.x + d.x * t, y: o.y + d.y * t };
  }
  seg(x1, y1, x2, y2, r, g, b, z = 1.3) {
    if (this.dn + 2 > this.dbgMax) return; const p = this.dbg.geometry.attributes.position.array, c = this.dbg.geometry.attributes.color.array, o = this.dn * 3;
    p[o] = x1; p[o + 1] = y1; p[o + 2] = z; p[o + 3] = x2; p[o + 4] = y2; p[o + 5] = z; c[o] = r; c[o + 1] = g; c[o + 2] = b; c[o + 3] = r; c[o + 4] = g; c[o + 5] = b; this.dn += 2;
  }
  burst(x, y, size, hex) { if (this.failed) return; const r = this.rings.find((q) => q.t >= 1) || this.rings[0]; r.t = 0; r.size = size; r.m.position.set(x, y, 1); r.m.material.color.setHex(hex); r.m.visible = true; }
  draw(sim, dtReal, focusOverride) {
    if (this.failed) { this.drawFallback(sim, dtReal, focusOverride); return; }
    const W = sim.W; this.clock += dtReal; this.resize();
    for (const [b, m] of this.meshes) { m.visible = !b.off; if (b.off) continue; m.position.x = b.x; m.position.y = b.y; m.rotation.z = b.a; this.updateMascot(m,sim); }
    const hm = this.meshes.get(sim.hero); if (hm) { hm.scale.x = sim.face; hm.rotation.z = clamp(-sim.hero.vx * 0.012, -0.12, 0.12); }
    // zones
    for (const o of this.zoneObjs) {
      const z = o.userData.zone;
      if (z.kind === 'star') { o.visible = !z.got; o.rotation.y = this.clock * 2; o.position.y = z.y + Math.sin(this.clock * 2 + z.x) * 0.12; }
      else if (z.kind === 'ring') { o.rotation.y = Math.sin(this.clock * 1.5 + z.x) * 0.6; const s = sim.hook && sim.hook.ring === z ? 1.35 : 1; o.scale.setScalar(s); }
      else if (z.kind === 'goal') o.rotation.z = this.clock * 0.3;
      else if (z.kind === 'fan') {
        const d = o.userData.dash, f = Math.hypot(z.fx, z.fy) || 1, ux = z.fx / f, uy = z.fy / f, L = Math.abs(ux) > Math.abs(uy) ? z.w : z.h, Wd = Math.abs(ux) > Math.abs(uy) ? z.h : z.w;
        for (let i = 0; i < d.n; i++) { const t = ((this.clock * f * 0.012 + i * 0.37) % 1) * L - L / 2, s = ((i * 0.618) % 1 - 0.5) * Wd * 0.9, o6 = i * 6;
          d.p[o6] = ux * t - uy * s; d.p[o6 + 1] = uy * t + ux * s; d.p[o6 + 2] = 0.6; d.p[o6 + 3] = ux * (t + 0.5) - uy * s; d.p[o6 + 4] = uy * (t + 0.5) + ux * s; d.p[o6 + 5] = 0.6; }
        d.g.attributes.position.needsUpdate = true;
      } else if (z.kind === 'water') {
        const wd = o.userData.water, pos = wd.g.attributes.position.array, lp = wd.lg.attributes.position.array;
        for (let i = 0; i < wd.n; i++) { const y = z.h / 2 + z.col[i]; pos[i * 3 + 1] = y; lp[i * 3] = pos[i * 3]; lp[i * 3 + 1] = y; lp[i * 3 + 2] = 0; }
        wd.g.attributes.position.needsUpdate = true; wd.lg.attributes.position.needsUpdate = true;
      } else if (z.kind === 'cannon') {
        const cd = o.userData.cannon, a = z.angle * DEG; cd.brl.rotation.z = a; const p = cd.ag.attributes.position.array, vx = Math.cos(a) * z.power, vy = Math.sin(a) * z.power, g = W.P.gy;
        for (let i = 0; i < 40; i++) { const t = i * 0.07; p[i * 3] = Math.cos(a) * 1.5 + vx * t; p[i * 3 + 1] = Math.sin(a) * 1.5 + 0.4 + vy * t + 0.5 * g * t * t; p[i * 3 + 2] = 0; }
        cd.ag.attributes.position.needsUpdate = true; cd.arc.computeLineDistances(); cd.arc.visible = sim.mode === 'cannon' && sim.cannon === z;
      }
    }
    // rope, trail, bursts
    const rp = this.rope.geometry.attributes.position.array;
    if (sim.hook) { rp[0] = sim.hero.x; rp[1] = sim.hero.y + 0.2; rp[2] = 0; rp[3] = sim.hook.lbx; rp[4] = sim.hook.lby; rp[5] = 0; this.rope.geometry.attributes.position.needsUpdate = true; this.rope.visible = true; } else this.rope.visible = false;
    if (sim.mode === 'limp' && this.overlay.trail) { const tp = this.trail.geometry.attributes.position.array, c = sim.rag.chest;
      if (this.trailN < 600) { tp[this.trailN * 3] = c.x; tp[this.trailN * 3 + 1] = c.y; tp[this.trailN * 3 + 2] = 0.3; this.trailN++; } else { tp.copyWithin(0, 3); tp[1797] = c.x; tp[1798] = c.y; tp[1799] = 0.3; }
      this.trail.geometry.setDrawRange(0, this.trailN); this.trail.geometry.attributes.position.needsUpdate = true; this.trail.visible = true;
    } else if (sim.mode !== 'limp' && this.trail.visible && !this.keepTrail) { this.trailFade = (this.trailFade || 0) + dtReal; if (this.trailFade > 2.5) { this.trail.visible = false; this.trailN = 0; this.trailFade = 0; } }
    if (sim.mode === 'limp' && sim.stunt && sim.stunt.t < 0.05) { this.trailN = 0; this.trailFade = 0; }
    for (const r of this.rings) if (r.t < 1) { r.t += dtReal * 2.4; const s = 0.2 + r.t * r.size; r.m.scale.set(s, s, 1); r.m.material.opacity = Math.max(0, 1 - r.t); if (r.t >= 1) r.m.visible = false; }
    // debug overlays
    this.dn = 0; const ov = this.overlay;
    if (ov.pairs) { for (const b of W.active) { const im = b.im > 0; if (!im && b.maxx - b.minx > 8) continue; const r = im ? 0.25 : 0.1, g = im ? 0.8 : 0.3, bl = 1; this.seg(b.minx, b.miny, b.maxx, b.miny, r, g, bl); this.seg(b.maxx, b.miny, b.maxx, b.maxy, r, g, bl); this.seg(b.maxx, b.maxy, b.minx, b.maxy, r, g, bl); this.seg(b.minx, b.maxy, b.minx, b.miny, r, g, bl); }
      for (let i = 0; i < Math.min(W.np, 4096); i += 2) { const a = W.pairs[i], b = W.pairs[i + 1]; if (a.im === 0 && a.maxx - a.minx > 8 || b.im === 0 && b.maxx - b.minx > 8) continue; this.seg(a.x, a.y, b.x, b.y, 1, 0.76, 0.24); } }
    if (ov.contacts) for (let k = 0; k < W.nc; k++) { const c = W.contacts[k], L = 0.25 + Math.min(1.2, c.ln * 60); this.seg(c.px, c.py, c.px + c.nx * L, c.py + c.ny * L, 1, 0.31, 0.64); this.seg(c.px - 0.06, c.py, c.px + 0.06, c.py, 1, 1, 1); this.seg(c.px, c.py - 0.06, c.px, c.py + 0.06, 1, 1, 1); }
    if (ov.joints) for (const j of W.joints) { const A = j.a, B = j.b; if (A.off || (B && B.off)) continue; const ca = Math.cos(A.a), sa = Math.sin(A.a), ax = A.x + ca * j.lax - sa * j.lay, ay = A.y + sa * j.lax + ca * j.lay; let bx = j.lbx, by = j.lby;
      if (B) { const cb = Math.cos(B.a), sb = Math.sin(B.a); bx = B.x + cb * j.lbx - sb * j.lby; by = B.y + sb * j.lbx + cb * j.lby; }
      if (j.type === 'hinge') { this.seg(A.x, A.y, ax, ay, 0.49, 1, 0.7); if (B) this.seg(B.x, B.y, bx, by, 0.49, 1, 0.7); this.seg(ax - 0.07, ay - 0.07, ax + 0.07, ay + 0.07, 1, 1, 1); this.seg(ax - 0.07, ay + 0.07, ax + 0.07, ay - 0.07, 1, 1, 1); } else this.seg(ax, ay, bx, by, 0.72, 0.6, 1); }
    if (ov.velocity) for (const b of W.active) { if (b.im === 0) continue; const s = 0.12; if (Math.abs(b.vx) + Math.abs(b.vy) > 0.3) this.seg(b.x, b.y, b.x + b.vx * s, b.y + b.vy * s, 1, 0.76, 0.24); }
    if (ov.centers) for (const b of W.active) { this.seg(b.x - .09, b.y, b.x + .09, b.y, .55, 1, .78); this.seg(b.x, b.y - .09, b.x, b.y + .09, .55, 1, .78); }
    for (const [b, chosen] of [[this.hover, false], [this.selected, true]]) if (b && !b.off) {
      const e = (b.shape === 'box' ? Math.hypot(b.hw, b.hh) : b.r + (b.hl || 0)) + .12;
      for (let i = 0; i < 20; i++) { const a0 = (i / 20) * TAU, a1 = ((i + .65) / 20) * TAU; this.seg(b.x + Math.cos(a0) * e, b.y + Math.sin(a0) * e, b.x + Math.cos(a1) * e, b.y + Math.sin(a1) * e, 1, chosen ? .78 : 1, chosen ? .3 : 1); }
      if (chosen) { this.seg(b.x - .16, b.y, b.x + .16, b.y, 1, .78, .3); this.seg(b.x, b.y - .16, b.x, b.y + .16, 1, .78, .3); this.seg(b.x, b.y, b.x + b.vx * .15, b.y + b.vy * .15, 1, .78, .3); }
    }
    if (this.grab) this.seg(this.grab.a.x, this.grab.a.y, this.grab.lbx, this.grab.lby, 1, 1, 1);
    this.dbg.geometry.setDrawRange(0, this.dn); this.dbg.geometry.attributes.position.needsUpdate = true; this.dbg.geometry.attributes.color.needsUpdate = true;
    this.updateCamera(sim, dtReal, focusOverride);
    this.renderer.info.reset();
    if (this.composer && this.bloomOn && this.quality !== 'low') this.composer.render(); else this.renderer.render(this.scene, this.cam);
    this.frameStats = { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, lines: this.renderer.info.render.lines };
  }
}
