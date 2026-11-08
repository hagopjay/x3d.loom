/* Start the Babylon WebGPU body, give the page its lens, then load the page's own app.js (which asks X3D.getBrowser(canvas) at load time).
   Also: the on-screen notices (law 40) and the opt-in timing panel lives in manifold-timing.js (gate G0). */

/* the page's lens switch now drives Babylon's DefaultRenderingPipeline (bloom, vignette, grain, chromatic aberration); the old lens read X_ITE's WebGL frame and cannot read a WebGPU swap chain */
window.ManifoldLens = Object.freeze({
  create() { return { hdr: true, render(src, o) { const b = window.__mfBody; if (b) { b.mf.look.glow = o.glow; b.mf.look.grain = !!o.grain; } } }; },
});

(async () => {
  const canvas = document.getElementById('scene');
  const fail = (msg) => {
    const d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#02040a;color:#cfe;font:16px/1.5 system-ui,sans-serif;z-index:99';
    d.innerHTML = '<div style="max-width:36em"><h2 style="margin:0 0 .5em">This page needs WebGPU</h2><p></p>' +
      '<p style="opacity:.85">On Windows, Chrome may block an integrated GPU: open <b>chrome://flags/#enable-unsafe-webgpu</b>, set it to Enabled and relaunch. Edge, a Mac, or another machine also work.</p>' +
      '<p style="opacity:.75">Chrome or Edge 113 and later, Safari 26, and Firefox 141 and later on Windows run it. The WebGL version of this demo is the page it was ported from.</p></div>';
    d.querySelector('p').textContent = msg;
    document.body.appendChild(d);
  };
  const notices = [];
  const showNotices = () => {
    let el = document.getElementById('mfNotice');
    if (!el) {
      el = document.createElement('div'); el.id = 'mfNotice';
      el.style.cssText = 'position:fixed;right:36px;top:84px;text-align:right;max-width:min(30em,60vw);padding:6px 10px;border-radius:8px;background:rgba(4,8,16,.62);color:#9fb7c9;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;z-index:5;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = notices.join(' · ');
  };
  try {
    const body = new ManifoldBody(canvas, { onNote: (m) => { notices.push(m); showNotices(); console.info('[manifold]', m); } });
    await body.init();
    X3DSAI.setBody(body);
    window.__mfBody = body;
    const a = body.adapterInfo;
    window.__manifoldWebGPU = { body, babylon: BABYLON.Engine.Version, adapter: a };
    notices.push('Babylon ' + BABYLON.Engine.Version + ' on WebGPU', 'adapter: ' + ([a.vendor, a.architecture, a.description].filter(Boolean).join(' ') || 'name hidden by the browser'),
      'look: Babylon bloom, grain, vignette (the original canvas lens is not ported; the lens switch toggles these)');
    showNotices();
    window.__manifoldBuild = '__BUILD_ID__';                                       // the builder writes the bundle hash here
    window.__adapter = body.adapter; window.__adapterVia = body.adapterInfo.hint;   // read by manifold-timing.js
    const s = document.createElement('script'); s.src = 'src/app.js'; s.onerror = () => fail('src/app.js did not load.');
    document.head.appendChild(s);
  } catch (e) {
    console.error(e); window.__manifoldWebGPUError = String(e && e.message || e);
    fail(String(e && e.message || e));
  }
})();
