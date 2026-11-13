/* Opt-in timing for the Babylon WebGPU pages (KANSEI, Neural Canvas). Off until the "Timing" button is pressed. It then measures the interval
   between requestAnimationFrame callbacks for about 20 s of whatever the page is doing, shows p50, p95 and p99 on screen and keeps the numbers
   on this page: nothing is sent anywhere (no fetch, no beacon). The GPU adapter and the browser are recorded beside the numbers so a figure is
   never separated from the machine it came from. A software adapter (SwiftShader, WARP, llvmpipe) is labelled on screen and its numbers must
   not be quoted (law 40: a fallback must say so).
   URL knobs: ?timing=0 hides the button, ?tsec=N sets the window (default 20 s), ?twarm=N the discarded warm-up (default 2 s).

   The page's boot file says what it is by setting window.__timingHooks once the body is up:
     { name, schema, engine() -> the Babylon engine, babylon: version string, adapter: body.adapterInfo,
       scene() -> { key: [..] (a change means the scene changed during the run), label: [..] (shown), fields: {..} (copied into the result) },
       inside: 'what the interval contains', adaptive: true when the page moves its own render scale, corner: 'left' | 'right' }
   window.__x3dBuild (set by the page builders) names the bundle that made the numbers. */
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

  function context(h) {
    const eng = h.engine && h.engine(), cv = eng && eng.getRenderingCanvas && eng.getRenderingCanvas();
    const s = (h.scene && h.scene()) || {};
    return { key: s.key || [], label: s.label || [], fields: s.fields || {}, canvas_px: cv ? [cv.width, cv.height] : null, device_pixel_ratio: window.devicePixelRatio || 1,
      hardware_scaling: eng && eng.getHardwareScalingLevel ? eng.getHardwareScalingLevel() : null };
  }
  function machine(h, battery) {
    const a = window.__adapter || null, info = (a && a.info) || {}, ai = h.adapter || {};
    const gpu = { vendor: info.vendor || ai.vendor || '', architecture: info.architecture || ai.architecture || '',
      device: info.device || '', description: info.description || ai.description || '',
      is_fallback: !!(info.isFallbackAdapter || (a && a.isFallbackAdapter)), timestamp_query: !!(a && a.features && a.features.has && a.features.has('timestamp-query')) };
    const software = gpu.is_fallback || SOFT.test([gpu.vendor, gpu.architecture, gpu.device, gpu.description].join(' '));
    return { user_agent: navigator.userAgent, platform: navigator.platform || '', cores: navigator.hardwareConcurrency || null, memory_gb: navigator.deviceMemory || null,
      battery, webgpu_adapter_request: window.__adapterVia || null, gpu, gpu_is_software: software, babylon: h.babylon || null };
  }

  function show(lines, tone) {
    body.replaceChildren();
    for (const [text, css] of lines) body.appendChild(mk('div', css || '', text));
    panel.style.display = 'block'; panel.style.borderColor = tone === 'warn' ? '#e0a030' : 'rgba(239,232,218,.28)';
  }
  const row = (text, css) => [text, 'margin:3px 0;' + (css || '')];

  function finish(h, dts, meta) {
    const s = dts.slice().sort((x, y) => x - y), n = s.length, mean = n ? s.reduce((x, y) => x + y, 0) / n : NaN;
    const worst = s.slice(Math.max(0, n - Math.max(1, Math.ceil(n * 0.01)))), lowMean = worst.length ? worst.reduce((x, y) => x + y, 0) / worst.length : NaN;
    const ctx1 = context(h), sceneChanged = JSON.stringify(meta.ctx0.key) !== JSON.stringify(ctx1.key);
    const m = machine(h, meta.battery);
    const res = {
      schema: h.schema || 'x3d.timing/1', app: h.name || null, utc: new Date().toISOString(), window_s: SEC, warmup_s: WARM, build: window.__x3dBuild || 'dev',
      page: Object.assign({}, ctx1.fields, { canvas_px: ctx1.canvas_px, device_pixel_ratio: ctx1.device_pixel_ratio, hardware_scaling: ctx1.hardware_scaling,
        hardware_scaling_at_start: meta.ctx0.hardware_scaling, scene_changed_during_run: sceneChanged }), machine: m,
      frames: n, fps_mean: r1(1000 / mean), ms: { p50: r1(pct(s, 50)), p95: r1(pct(s, 95)), p99: r1(pct(s, 99)), mean: r1(mean), max: r1(s[n - 1]) },
      one_percent_low_fps: r1(1000 / lowMean), frames_over_33ms: s.filter((x) => x > 33.4).length, frames_over_50ms: s.filter((x) => x > 50).length,
      tab_hidden_during_run: meta.hidden,
      what_this_is: 'requestAnimationFrame interval (vsync-paced), includes ' + (h.inside || 'the page and the Babylon draw') + '; not GPU-only time; nothing was uploaded',
    };
    const bad = meta.hidden || n < 30, soft = m.gpu_is_software;
    const lines = [];
    if (soft) lines.push(row('Software rasteriser: these numbers do not count. Open the page in a browser with a real GPU adapter.', 'color:#ffcf70;font-weight:600'));
    if (meta.hidden) lines.push(row('The tab was hidden during the run, so the numbers are not valid. Run again and keep this tab in front.', 'color:#ffcf70;font-weight:600'));
    else if (n < 30) lines.push(row('Only ' + n + ' frames in ' + SEC + ' s: too few to quote (the page is not running at a usable rate here).', 'color:#ffcf70;font-weight:600'));
    lines.push(row('p50 ' + res.ms.p50 + ' ms    p95 ' + res.ms.p95 + ' ms    p99 ' + res.ms.p99 + ' ms    max ' + res.ms.max + ' ms', 'font-size:13px'));
    lines.push(row(n + ' frames in ' + SEC + ' s after ' + WARM + ' s warm-up, mean ' + res.fps_mean + ' fps, 1% low ' + res.one_percent_low_fps + ' fps, over 33 ms: ' + res.frames_over_33ms + ', over 50 ms: ' + res.frames_over_50ms));
    lines.push(row('GPU: ' + ([m.gpu.vendor, m.gpu.architecture, m.gpu.description || m.gpu.device].filter(Boolean).join(' / ') || 'not reported') + (m.gpu.is_fallback ? ' (fallback adapter)' : '') + '; adapter request: ' + (m.webgpu_adapter_request || '?'), 'opacity:.85'));
    lines.push(row('Browser: ' + navigator.userAgent, 'opacity:.7;word-break:break-all'));
    lines.push(row('Scene: ' + (ctx1.label.filter(Boolean).join(' / ') || '?') + (sceneChanged ? ' (changed during the run)' : '') + '; canvas ' + (ctx1.canvas_px ? ctx1.canvas_px.join('x') : '?') + ' at ' + ctx1.device_pixel_ratio + 'x, render scale 1/' + (ctx1.hardware_scaling == null ? '?' : r1(ctx1.hardware_scaling)) + (h.adaptive ? ' (the page\'s adaptive quality moves it)' : ''), 'opacity:.7'));
    lines.push(row('This is the interval between displayed frames (a 60 Hz screen caps it near 16.7 ms), including ' + (h.inside || 'the page and the Babylon draw') + '. It is not GPU-only time. Nothing was uploaded.', 'opacity:.6;font-size:11px'));
    show(lines, soft || bad ? 'warn' : '');
    const ta = mk('textarea', 'width:100%;height:84px;margin-top:6px;background:#0b0d14;color:#efe8da;border:1px solid rgba(239,232,218,.25);font:11px ' + MONO + ';box-sizing:border-box');
    ta.readOnly = true; ta.value = JSON.stringify(res, null, 1);
    const bar = mk('div', 'display:flex;gap:8px;margin-top:6px');
    const b = (t, fn) => { const x = mk('button', 'cursor:pointer;background:#1b1f2e;color:#efe8da;border:1px solid rgba(239,232,218,.35);border-radius:6px;padding:4px 10px;font:12px ' + MONO, t); x.onclick = fn; x.tabIndex = -1; x.addEventListener('mousedown', (e) => e.preventDefault()); return x; };
    const cp = b('Copy numbers', async () => { try { await navigator.clipboard.writeText(ta.value); cp.textContent = 'Copied'; } catch { ta.focus(); ta.select(); cp.textContent = 'Select + copy'; } setTimeout(() => { cp.textContent = 'Copy numbers'; }, 1800); });
    bar.append(cp, b('Run again', start), b('Close', () => { panel.style.display = 'none'; }));
    body.append(ta, bar);
    window.__timingResult = res;
    return res;
  }

  // the page's boot file picks the corner (a page with its own controls in the lower left asks for the right)
  function place(h) {
    if (!btn) return;
    const side = h && h.corner === 'right' ? 'right' : 'left', other = side === 'right' ? 'left' : 'right';
    for (const e of [btn, panel]) { e.style[side] = '10px'; e.style[other] = 'auto'; }
  }

  async function start() {
    if (running) { if (cancel) cancel(); return; }
    const h = window.__timingHooks;
    if (!h) { show([row('The page has not finished starting. Try again in a moment.')]); return; }
    place(h);
    running = true;
    let battery = null; try { if (navigator.getBattery) { const b = await navigator.getBattery(); battery = { charging: b.charging, level: r1(b.level) }; } } catch { /* not offered */ }
    const meta = { hidden: document.hidden, battery, ctx0: context(h) }, dts = [];
    let t0 = null, last = null, raf = 0, lastLabel = 0;
    const done = (aborted) => { running = false; cancel = null; btn.textContent = 'Timing'; if (aborted) { show([row('Timing cancelled.')]); } else finish(h, dts, meta); };
    cancel = () => { cancelAnimationFrame(raf); done(true); };
    const onVis = () => { if (document.hidden) meta.hidden = true; };
    document.addEventListener('visibilitychange', onVis);
    show([row('Measuring for ' + (WARM + SEC) + ' s (' + WARM + ' s warm-up is thrown away). Keep this tab in front and use the page as you normally would. Press the button again to cancel.')]);
    const tick = (now) => {
      if (t0 === null) { t0 = now; }
      const el = (now - t0) / 1000;
      if (last !== null && el > WARM) dts.push(now - last);
      last = now;
      if (now - lastLabel > 250) { lastLabel = now; btn.textContent = 'Timing ' + Math.max(0, Math.ceil(WARM + SEC - el)) + ' s'; }
      if (el >= WARM + SEC) { document.removeEventListener('visibilitychange', onVis); done(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function install() {
    btn = mk('button', 'position:fixed;left:10px;bottom:10px;z-index:45;cursor:pointer;background:rgba(11,13,20,.72);color:#efe8da;border:1px solid rgba(239,232,218,.3);border-radius:999px;padding:4px 12px;font:11px ' + MONO + ';letter-spacing:.08em;opacity:.55', 'Timing');
    btn.title = 'Measure frame times on this machine for about ' + SEC + ' s. Off until pressed; nothing is uploaded.';
    btn.id = 'x3d-timing-btn';
    btn.onmouseenter = () => { btn.style.opacity = '1'; }; btn.onmouseleave = () => { btn.style.opacity = '.55'; };
    btn.onclick = (e) => { e.stopPropagation(); start(); };
    btn.tabIndex = -1; btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep keyboard focus on the page: Space must not press this button again
    panel = mk('div', 'position:fixed;left:10px;bottom:44px;z-index:45;display:none;width:min(430px,calc(100vw - 20px));max-height:70vh;overflow:auto;box-sizing:border-box;padding:10px 12px;background:rgba(11,13,20,.92);color:#efe8da;border:1px solid rgba(239,232,218,.28);border-radius:8px;font:12px/1.45 ' + MONO);
    panel.id = 'x3d-timing-panel';
    body = mk('div'); panel.appendChild(body);
    for (const ev of ['keydown', 'keyup', 'pointerdown']) panel.addEventListener(ev, (e) => e.stopPropagation());
    document.body.append(btn, panel);
  }
  window.__timingPlace = () => place(window.__timingHooks); // a boot file calls this right after it sets the hooks
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
