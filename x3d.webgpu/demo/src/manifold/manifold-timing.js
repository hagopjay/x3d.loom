/* Opt-in timing for the Manifold Babylon page (gate G0: the owner opened it for this demo on 7 Nov 2026, in his own words; it stays off until the "Timing" button is pressed).
   Same method and the same result block as the KANSEI page (drift-timing.js), so numbers from the two demos can be put side by side: it measures the interval between
   requestAnimationFrame callbacks for about 20 s of whatever the page is doing, throws away a short warm-up, and shows p50, p95 and p99 on screen. When the adapter offers
   timestamp-query it also records Babylon's GPU frame time (the headroom a vsync-capped interval hides). The numbers stay on this page: nothing is sent anywhere (no fetch, no beacon).
   The GPU adapter and the browser are written beside the numbers so a figure is never separated from the machine it came from. A software adapter (SwiftShader, WARP, llvmpipe)
   is labelled on screen and its numbers must not be quoted (law 40). URL knobs: ?timing=0 hides the button, ?tsec=N sets the window (default 20 s), ?twarm=N the discarded warm-up (default 2 s). */
(() => {
  const q = new URLSearchParams(location.search);
  if (q.get('timing') === '0') return;
  const SEC = Math.max(1, +(q.get('tsec') || 20)), WARM = Math.max(0, +(q.get('twarm') || 2));
  const SOFT = /swiftshader|llvmpipe|lavapipe|software|basic render|warp/i;
  const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))] : NaN; // nearest rank
  const r1 = (v) => Math.round(v * 10) / 10;
  const mk = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
  const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  let btn, panel, body, running = false, cancel = null;

  const $ = (id) => document.getElementById(id);
  function context() {
    const w = window.__manifoldWebGPU, eng = w && w.body && w.body.engine, cv = eng && eng.getRenderingCanvas && eng.getRenderingCanvas();
    const mood = document.querySelector('.mood[aria-pressed="true"]'), look = w && w.body && w.body.mf && w.body.mf.look;
    const on = (id) => { const e = $(id); return e ? !!e.checked : null; };
    return {
      mood: mood ? mood.getAttribute('data-mood') + ' ' + mood.textContent.trim() : null,
      quality_setting: $('quality') ? $('quality').value : null, quality_label: $('qualityLabel') ? $('qualityLabel').textContent : null,
      look: { lens: on('lensToggle'), grain: on('grain'), glow: look ? look.glow : null },
      layers: { traces: on('traces'), filaments: on('filaments'), veil: on('veil') },
      canvas_px: cv ? [cv.width, cv.height] : null, device_pixel_ratio: window.devicePixelRatio || 1,
      hardware_scaling: eng && eng.getHardwareScalingLevel ? eng.getHardwareScalingLevel() : null,
    };
  }
  function machine(battery) {
    const w = window.__manifoldWebGPU || {}, a = window.__adapter || null, info = (a && a.info) || {};
    const gpu = { vendor: info.vendor || (w.adapter && w.adapter.vendor) || '', architecture: info.architecture || (w.adapter && w.adapter.architecture) || '',
      device: info.device || '', description: info.description || (w.adapter && w.adapter.description) || '',
      is_fallback: !!(info.isFallbackAdapter || (a && a.isFallbackAdapter)), timestamp_query: !!(a && a.features && a.features.has && a.features.has('timestamp-query')) };
    const software = gpu.is_fallback || SOFT.test([gpu.vendor, gpu.architecture, gpu.device, gpu.description].join(' '));
    return { user_agent: navigator.userAgent, platform: navigator.platform || '', cores: navigator.hardwareConcurrency || null, memory_gb: navigator.deviceMemory || null,
      battery, webgpu_adapter_request: window.__adapterVia || null, gpu, gpu_is_software: software, babylon: w.babylon || null };
  }

  function show(lines, tone) {
    body.replaceChildren();
    for (const [text, css] of lines) body.appendChild(mk('div', css || '', text));
    panel.style.display = 'block'; panel.style.borderColor = tone === 'warn' ? '#e0a030' : 'rgba(255,255,255,.28)';
  }
  const row = (text, css) => [text, 'margin:3px 0;' + (css || '')];

  function finish(dts, gpuMs, meta) {
    const s = dts.slice().sort((x, y) => x - y), n = s.length, mean = n ? s.reduce((x, y) => x + y, 0) / n : NaN;
    const worst = s.slice(Math.max(0, n - Math.max(1, Math.ceil(n * 0.01)))), lowMean = worst.length ? worst.reduce((x, y) => x + y, 0) / worst.length : NaN;
    const ctx1 = context(), changed = JSON.stringify([meta.ctx0.mood, meta.ctx0.quality_setting, meta.ctx0.look, meta.ctx0.layers]) !== JSON.stringify([ctx1.mood, ctx1.quality_setting, ctx1.look, ctx1.layers]);
    const m = machine(meta.battery), g = gpuMs.slice().sort((x, y) => x - y);
    const res = {
      schema: 'x3d.manifold.timing/1', utc: new Date().toISOString(), window_s: SEC, warmup_s: WARM, build: window.__manifoldBuild || 'dev',
      page: Object.assign({}, ctx1, { hardware_scaling_at_start: meta.ctx0.hardware_scaling, settings_changed_during_run: changed }), machine: m,
      frames: n, fps_mean: r1(1000 / mean), ms: { p50: r1(pct(s, 50)), p95: r1(pct(s, 95)), p99: r1(pct(s, 99)), mean: r1(mean), max: r1(s[n - 1]) },
      one_percent_low_fps: r1(1000 / lowMean), frames_over_33ms: s.filter((x) => x > 33.4).length, frames_over_50ms: s.filter((x) => x > 50).length,
      gpu_frame_ms: g.length ? { samples: g.length, p50: r1(pct(g, 50)), p95: r1(pct(g, 95)), p99: r1(pct(g, 99)) } : null,
      tab_hidden_during_run: meta.hidden,
      what_this_is: 'requestAnimationFrame interval (vsync-paced), including the Babylon draw and the page\'s own update; gpu_frame_ms is Babylon\'s GPU timestamp (null where the adapter has none); nothing was uploaded',
    };
    const bad = meta.hidden || n < 30, soft = m.gpu_is_software;
    const lines = [];
    if (soft) lines.push(row('Software rasteriser: these numbers do not count. Open the page in a browser with a real GPU adapter.', 'color:#ffcf70;font-weight:600'));
    if (meta.hidden) lines.push(row('The tab was hidden during the run, so the numbers are not valid. Run again and keep this tab in front.', 'color:#ffcf70;font-weight:600'));
    else if (n < 30) lines.push(row('Only ' + n + ' frames in ' + SEC + ' s: too few to quote (the page is not running at a usable rate here).', 'color:#ffcf70;font-weight:600'));
    lines.push(row('p50 ' + res.ms.p50 + ' ms    p95 ' + res.ms.p95 + ' ms    p99 ' + res.ms.p99 + ' ms    max ' + res.ms.max + ' ms', 'font-size:13px'));
    lines.push(row(n + ' frames in ' + SEC + ' s after ' + WARM + ' s warm-up, mean ' + res.fps_mean + ' fps, 1% low ' + res.one_percent_low_fps + ' fps, over 33 ms: ' + res.frames_over_33ms + ', over 50 ms: ' + res.frames_over_50ms));
    lines.push(row(res.gpu_frame_ms ? 'GPU frame time (timestamp query): p50 ' + res.gpu_frame_ms.p50 + ' ms, p95 ' + res.gpu_frame_ms.p95 + ' ms, p99 ' + res.gpu_frame_ms.p99 + ' ms over ' + res.gpu_frame_ms.samples + ' frames' : 'GPU frame time: this adapter offers no timestamp query, so only the frame interval is shown', 'opacity:.9'));
    lines.push(row('GPU: ' + ([m.gpu.vendor, m.gpu.architecture, m.gpu.description || m.gpu.device].filter(Boolean).join(' / ') || 'not reported') + (m.gpu.is_fallback ? ' (fallback adapter)' : '') + '; adapter request: ' + (m.webgpu_adapter_request || '?'), 'opacity:.85'));
    lines.push(row('Browser: ' + navigator.userAgent, 'opacity:.7;word-break:break-all'));
    lines.push(row('Page: mood ' + (ctx1.mood || '?') + '; quality ' + (ctx1.quality_label || '?') + (changed ? ' (settings changed during the run)' : '') + '; canvas ' + (ctx1.canvas_px ? ctx1.canvas_px.join('x') : '?') + ' at ' + ctx1.device_pixel_ratio + 'x, render scale 1/' + (ctx1.hardware_scaling == null ? '?' : r1(ctx1.hardware_scaling)) + ' (Adaptive quality moves it: pick a fixed tier for comparable numbers)', 'opacity:.7'));
    lines.push(row('This is the interval between displayed frames (a 60 Hz screen caps it near 16.7 ms); the GPU frame time shows headroom where it is available. Nothing was uploaded.', 'opacity:.6;font-size:11px'));
    show(lines, soft || bad ? 'warn' : '');
    const ta = mk('textarea', 'width:100%;height:84px;margin-top:6px;background:#02060d;color:#bfe;border:1px solid rgba(255,255,255,.25);font:11px ' + MONO + ';box-sizing:border-box');
    ta.readOnly = true; ta.value = JSON.stringify(res, null, 1);
    const bar = mk('div', 'display:flex;gap:8px;margin-top:6px');
    const b = (t, fn) => { const x = mk('button', 'cursor:pointer;background:#10182a;color:#cfe;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:4px 10px;font:12px ' + MONO, t); x.onclick = fn; x.addEventListener('mousedown', (e) => e.preventDefault()); return x; };
    const cp = b('Copy numbers', async () => { try { await navigator.clipboard.writeText(ta.value); cp.textContent = 'Copied'; } catch { ta.focus(); ta.select(); cp.textContent = 'Select + copy'; } setTimeout(() => { cp.textContent = 'Copy numbers'; }, 1800); });
    bar.append(cp, b('Run again', start), b('Close', () => { panel.style.display = 'none'; }));
    body.append(ta, bar);
    window.__manifoldTimingResult = res;
    return res;
  }

  async function start() {
    if (running) { if (cancel) cancel(); return; }
    running = true;
    let battery = null; try { if (navigator.getBattery) { const b = await navigator.getBattery(); battery = { charging: b.charging, level: r1(b.level) }; } } catch { /* not offered */ }
    const meta = { hidden: document.hidden, battery, ctx0: context() }, dts = [], gpuMs = [];
    // Babylon's GPU frame time, when the adapter has timestamp-query
    const t0w = performance.now(); let inst = null, obs = null; const w = window.__manifoldWebGPU, sc = w && w.body && w.body.scene;
    try { if (sc && window.BABYLON && BABYLON.EngineInstrumentation) { inst = new BABYLON.EngineInstrumentation(w.body.engine); inst.captureGPUFrameTime = true; obs = sc.onAfterRenderObservable.add(() => { const v = inst.gpuFrameTimeCounter && inst.gpuFrameTimeCounter.current; if (v > 0 && performance.now() - t0w > WARM * 1000) gpuMs.push(v / 1e6); }); } } catch { inst = null; }
    let t0 = null, last = null, raf = 0, lastLabel = 0;
    const cleanup = () => { if (obs && sc) sc.onAfterRenderObservable.remove(obs); if (inst) { try { inst.dispose(); } catch { /* already gone */ } } document.removeEventListener('visibilitychange', onVis); };
    const done = (aborted) => { running = false; cancel = null; btn.textContent = 'Timing'; cleanup(); if (aborted) { show([row('Timing cancelled.')]); } else finish(dts, gpuMs, meta); };
    cancel = () => { cancelAnimationFrame(raf); done(true); };
    const onVis = () => { if (document.hidden) meta.hidden = true; };
    document.addEventListener('visibilitychange', onVis);
    show([row('Measuring for ' + (WARM + SEC) + ' s (' + WARM + ' s warm-up is thrown away). Keep this tab in front and leave the mouse alone, or orbit as you normally would. Press the button again to cancel.')]);
    const tick = (now) => {
      if (t0 === null) { t0 = now; }
      const el = (now - t0) / 1000;
      if (last !== null && el > WARM) dts.push(now - last);
      last = now;
      if (now - lastLabel > 250) { lastLabel = now; btn.textContent = 'Timing ' + Math.max(0, Math.ceil(WARM + SEC - el)) + ' s'; }
      if (el >= WARM + SEC) { done(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function install() {
    btn = mk('button', 'position:fixed;left:12px;bottom:12px;z-index:45;cursor:pointer;background:rgba(4,8,16,.7);color:#cfe;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:4px 12px;font:11px ' + MONO + ';letter-spacing:.08em;opacity:.6', 'Timing');
    btn.title = 'Measure frame times on this machine for about ' + SEC + ' s. Off until pressed; nothing is uploaded.';
    btn.id = 'x3d-timing-btn';
    btn.onmouseenter = () => { btn.style.opacity = '1'; }; btn.onmouseleave = () => { btn.style.opacity = '.6'; };
    btn.onclick = (e) => { e.stopPropagation(); start(); };
    panel = mk('div', 'position:fixed;left:12px;bottom:46px;z-index:45;display:none;width:min(440px,calc(100vw - 24px));max-height:70vh;overflow:auto;box-sizing:border-box;padding:10px 12px;background:rgba(4,8,16,.92);color:#cfe;border:1px solid rgba(255,255,255,.28);border-radius:8px;font:12px/1.45 ' + MONO);
    panel.id = 'x3d-timing-panel';
    body = mk('div'); panel.appendChild(body);
    for (const ev of ['keydown', 'keyup', 'pointerdown', 'wheel']) panel.addEventListener(ev, (e) => e.stopPropagation());
    document.body.append(btn, panel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
