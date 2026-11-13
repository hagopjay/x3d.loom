// ---------- the Babylon engine: the same odyssey.x3d, drawn by Babylon.js 9 on WebGPU through our own X3D reader ----------
// The reader (x3d.webgpu/demo/src/brain/reader.js) parses the file, runs the TimeSensor and the ROUTEs and keeps the field values; the body (body.js, drift-ext.js, odyssey-ext.js)
// turns them into Babylon meshes, PBR materials and lights; sai.js answers the page with the subset of the scene access interface this adapter uses. The adapter is the X_ITE adapter's
// twin on purpose: both play the file by writing to the same nodes (Film, the 124 interpolators, DroneCam), so the two engines run the same film by the same means.
const BJS = { url: '__BJS_URL__', sri: '__BJS_SRI__', version: '__BJS_VERSION__', bundle: 'babylon/bundle.js' };
let bjsLoading = null;
function loadScript(src, attrs) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = false;
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v) s.setAttribute(k, v);
    s.onload = () => res(); s.onerror = () => rej(new Error(src.split('/').pop() + ' failed to load')); document.head.appendChild(s);
  });
}
function loadBabylon() {
  if (window.OdysseyBabylon) return Promise.resolve(window.OdysseyBabylon);
  return bjsLoading || (bjsLoading = (async () => {
    const prev = window.X3D;                                   // the bundle's scene-access types are also called X3D; X_ITE keeps its own
    try {
      await loadScript(BJS.url, { integrity: BJS.sri, crossorigin: 'anonymous' });
      await loadScript(BJS.bundle);
    } finally { if (prev) window.X3D = prev; else delete window.X3D; }
    return window.OdysseyBabylon;
  })().catch((e) => { bjsLoading = null; throw e; }));
}
function BabylonAdapter() {
  let api = null, inst = null, br = null, XNS = null, scene = null, Film = null, targets = [], cam = null, free = null;
  let tHeld = 0, playing = false, startT = 0, pend = 0, need = 0, hold = false;
  const ring = new Float64Array(240); let ri = 0, rc = 0, lastF = 0, info = {};
  const now = () => br.getCurrentTime();
  const ad = {
    kind: 'babylon', label: 'Babylon',
    async init(t, play, onProgress) {
      onProgress && onProgress(0.06, 'Loading Babylon.js ' + BJS.version);
      api = await loadBabylon(); XNS = api.ns;
      onProgress && onProgress(0.2, 'Starting the Babylon WebGPU body');
      stage.style.background = '#0a0806';
      inst = await api.create(stage, {}); br = inst.B;
      br.setBrowserOption('ContentScale', xScale(S.quality));
      if (window.__odysseyLook && !Q.has('look')) window.__odysseyLook.on = !!LS.get('look', true);   // the visitor's last choice, unless the address says otherwise
      onProgress && onProgress(0.3, 'Babylon is reading odyssey.x3d');
      const t0 = performance.now();
      await br.loadURL(new XNS.MFString(FILMS.x3d));
      info.load_ms = performance.now() - t0;
      scene = br.currentScene;
      Film = scene.getNamedNode('Film'); Film.enabled = false;
      targets = (S.film.x3d && S.film.x3d.film_interpolators || []).map((n) => scene.getNamedNode(n));
      cam = scene.getNamedNode('DroneCam');
      for (const n of scene.rootNodes) if (n && n.getNodeTypeName && n.getNodeTypeName() === 'NavigationInfo') { try { n.transitionType = new XNS.MFString('TELEPORT'); } catch (e) {} }
      info.version = inst.info.babylon; info.adapter = inst.info.adapter || {};
      // the render loop is ours: the body draws while the film plays, while the visitor flies, and for a few frames after anything changes
      inst.body.engine.stopRenderLoop();
      inst.body.opts.onFrame = () => {
        const n = performance.now(); if (lastF) { ring[ri] = n - lastF; ri = (ri + 1) % ring.length; if (rc < ring.length) rc++; } lastF = n;
        if (ad.onFirstFrame && inst.body.stats.frames > 2) { const f = ad.onFirstFrame; ad.onFirstFrame = null; f(); }
      };
      inst.body.engine.runRenderLoop(() => {
        if (hold || !inst) return;
        if (playing || fly.active || need > 0) { inst.body.frame(); if (!playing && !fly.active) need--; }
      });
      ad.seek(t);
      need = 12;
      // every pipeline is compiled before the first frame: the film should not stutter on a material the camera meets for the first time
      onProgress && onProgress(0.5, 'Compiling the materials and lights');
      const c0 = performance.now();
      await Promise.race([inst.ready(), new Promise((r) => setTimeout(r, 120000))]);
      info.ready_ms = performance.now() - c0;
      if (play) ad.play();
      return ad;
    },
    time() {
      if (!playing || pend) return tHeld;
      let t = now() - startT; t = ((t % S.L) + S.L) % S.L; return t;
    },
    play() { if (playing) return; playing = true; ad.restart(); },
    pause() { if (!playing) return; const t = ad.time(); playing = false; pend = 0; Film.enabled = false; ad.seek(t); },
    // a TimeSensor ignores set_startTime while it is active, so the film clock is stopped first and restarted (at the held time) two frames later: the same dance as the X_ITE adapter
    restart() {
      Film.enabled = false; const g = ++pend;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (g !== pend || !playing) return;
        const n0 = now(); Film.startTime = n0 - tHeld; Film.stopTime = 0; Film.enabled = true; startT = n0 - tHeld; pend = 0;
      }));
    },
    seek(t) {
      t = Math.max(0, Math.min(S.L - 1e-3, t)); tHeld = t;
      if (playing) Film.enabled = false;
      inst.newTimestamp();                                       // the reader lets an output fire once per timestamp; a scrub writes the same outputs again
      const f = t / S.L;
      for (const n of targets) if (n) n.set_fraction = f;
      need = Math.max(need, 4);
      if (playing) ad.restart();
    },
    playing() { return playing; },
    resize() { need = Math.max(need, 3); },
    kick() { need = Math.max(need, 6); },
    async setQuality(q) { br.setBrowserOption('ContentScale', xScale(q)); need = Math.max(need, 6); },
    setLook(on) { if (window.__odysseyLook && window.__odysseyLook.apply) { window.__odysseyLook.apply(!!on); LS.set('look', !!on); need = Math.max(need, 6); } },
    look() { return !!(window.__odysseyLook && window.__odysseyLook.on); },
    cameraPose() {
      const p = cam.position, o = cam.orientation, s = Math.sin(o.angle / 2), n = Math.hypot(o.x, o.y, o.z) || 1;
      return { pos: [p.x, p.y, p.z], q: [o.x / n * s, o.y / n * s, o.z / n * s, Math.cos(o.angle / 2)], fov: cam.fieldOfView };
    },
    flyBegin() {
      if (!free) { free = scene.createNode('Viewpoint'); free.description = 'Viewer at the sticks'; scene.rootNodes.push(free); }
      ad.flyApply(); free.set_bind = true;
    },
    flyApply() {
      if (!free) return;
      const q = fly.q, w = Math.max(-1, Math.min(1, q[3])), a = 2 * Math.acos(w), s = Math.sqrt(1 - w * w) || 1;
      free.position = new XNS.SFVec3f(fly.pos[0], fly.pos[1], fly.pos[2]);
      free.orientation = s < 1e-6 ? new XNS.SFRotation(0, 0, 1, 0) : new XNS.SFRotation(q[0] / s, q[1] / s, q[2] / s, a);
      free.fieldOfView = fly.fov;
    },
    flyEnd() { cam.set_bind = true; need = Math.max(need, 6); },
    badge() { return `Babylon.js ${info.version || ''} · WebGPU · ${ad.look() ? 'look on' : 'as authored'}`; },
    hud() {
      const s = ad.perf(), sh = SHOTS[shotIndexAt(ad.time())], o = inst.body.odysseyInfo(), a = info.adapter || {};
      return [`Babylon.js ${info.version || ''} · WebGPU · ${[a.vendor, a.architecture, a.description].filter(Boolean).join(' / ') || 'adapter n/a'}`,
        `fps ${s.fps.toFixed(1)}  frame p50 ${s.p50.toFixed(2)}  p95 ${s.p95.toFixed(2)}  p99 ${s.p99.toFixed(2)} ms`,
        `film driven by TimeSensor Film (${playing ? 'running' : 'held'}), 124 interpolators, 289 ROUTEs, 0 Script`,
        `${o.active} of ${o.meshes} meshes drawn · ${o.lights} lights, at most ${o.scope ? o.scope.perMeshMax : '?'} on any one shape · look ${o.look ? 'on' : 'off'}`,
        `${inst.canvas.width}×${inst.canvas.height} px · t ${ad.time().toFixed(2)} s · ${sh ? sh.name.split(' ')[0] : ''}`].join('\n');
    },
    perf() {
      const c = rc, a = Array.from(ring.subarray(0, c)).sort((x, y) => x - y), q = (p) => c ? a[Math.min(c - 1, Math.max(0, Math.ceil(p * c) - 1))] : 0;
      const mean = c ? a.reduce((x, y) => x + y, 0) / c : 0;
      return { fps: mean ? 1000 / mean : 0, p50: q(0.5), p95: q(0.95), p99: q(0.99), n: c };
    },
    perfReset() { rc = 0; ri = 0; lastF = 0; },
    describe() { return Object.assign({ engine: 'Babylon', babylon: info.version, adapter: info.adapter, load_ms: Math.round(info.load_ms || 0), ready_ms: Math.round(info.ready_ms || 0), size: [inst.canvas.width, inst.canvas.height] }, inst.body.odysseyInfo()); },
    benchInfo() { const a = info.adapter || {}; return `Babylon.js ${info.version} · WebGPU · ${[a.vendor, a.architecture, a.description].filter(Boolean).join(' / ') || 'adapter n/a'} · ${inst.canvas.width}×${inst.canvas.height} px · look ${ad.look() ? 'on' : 'off'}`; },
    async bench(dt, onFrame) {
      const was = playing; ad.pause(); const tBack = tHeld; hold = false;
      const rows = SHOTS.map((s) => ({ shot: s.name, t0: s.t0, t1: s.t1, kind: s.kind, ms: [] }));
      const times = []; for (let t = 0; t < S.L - 1e-9; t += dt) times.push(t);
      const w0 = performance.now(), q = inst.queue();
      // one frame = scrub, the body's next frame (events, then draw), then the GPU queue drained
      const drawn = async () => { await br.nextFrame(); if (q && q.onSubmittedWorkDone) await q.onSubmittedWorkDone(); };
      ad.seek(0); await drawn(); await drawn();
      for (let i = 0; i < times.length; i++) {
        const a = performance.now(); ad.seek(times[i]); await drawn(); const b = performance.now();
        rows[shotIndexAt(times[i])].ms.push(b - a); onFrame && onFrame(i + 1, times.length, times[i]);
      }
      const pct = (s, p) => s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))] : 0;
      const all = [];
      const out = rows.filter((r) => r.ms.length).map((r) => { const s = r.ms.slice().sort((x, y) => x - y); all.push(...s); const mean = s.reduce((x, y) => x + y, 0) / s.length;
        return { shot: r.shot, kind: r.kind, frames: s.length, wall_ms_p50: +pct(s, 0.5).toFixed(2), wall_ms_p95: +pct(s, 0.95).toFixed(2), fps_equiv: +(1000 / mean).toFixed(2), gpu_ms_p50: null, draw_calls: null, triangles: null }; });
      all.sort((x, y) => x - y); const mean = all.reduce((x, y) => x + y, 0) / all.length;
      ad.seek(tBack); if (was) ad.play();
      return { engine: 'Babylon', dt, frames: all.length, wall_s: +((performance.now() - w0) / 1000).toFixed(2), rows: out,
        total: { wall_ms_p50: +pct(all, 0.5).toFixed(2), wall_ms_p95: +pct(all, 0.95).toFixed(2), fps_equiv: +(1000 / mean).toFixed(2), gpu_ms_p50: null },
        method: 'scrub (set_fraction to all 124 Film targets), then the body\'s next frame and the WebGPU queue drained (onSubmittedWorkDone), timed wall to wall; no GPU timestamp queries' };
    },
    async renderAt(t, n) { ad.pause(); ad.seek(t); need = Math.max(need, n); for (let i = 0; i < Math.max(2, n); i++) await br.nextFrame(); return {}; },
    release() {},
    dispose() { try { Film.enabled = false; } catch (e) {} try { inst.dispose(); } catch (e) {} inst = null; br = null; },
  };
  return ad;
}
