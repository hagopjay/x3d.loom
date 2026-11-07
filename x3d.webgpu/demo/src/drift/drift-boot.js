/* start the Babylon WebGPU body, then define <x3d-canvas> so the page's own boot (await customElements.whenDefined('x3d-canvas'), then #canvas.browser) goes on */
(async () => {
  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  const host = document.getElementById('canvas');
  const say = (msg) => {
    const d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#07080d;color:#efe8da;font:16px/1.5 system-ui,sans-serif;z-index:99';
    d.innerHTML = '<div style="max-width:36em"><h2 style="margin:0 0 .5em">KANSEI on WebGPU needs a WebGPU browser</h2><p>' + msg + '</p><p style="opacity:.75">Chrome or Edge 113 and later, Safari 26, and Firefox 141 and later on Windows run it. On Windows with an Intel UHD 620 or similar, Chrome may need chrome://flags/#enable-unsafe-webgpu switched on. The WebGL version of this game is the page it was ported from.</p></div>';
    document.body.appendChild(d);
  };
  try {
    // the plain requestAdapter() answers on machines where the high-performance hint does not (see x3d.loom PR 14): Babylon asks with its own options, so try the plain call first
    const gpu = navigator.gpu;
    if (gpu && !gpu.__plainFirst) {
      const orig = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (opts) => {
        let a = null;
        for (const o of [undefined, opts, { powerPreference: 'low-power' }, { forceFallbackAdapter: true }]) { try { a = await orig(o); } catch (e) { a = null; } if (a) { window.__adapter = a; window.__adapterVia = o === undefined ? 'default' : JSON.stringify(o); break; } }
        return a;
      };
      gpu.__plainFirst = true;
    }
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(canvas);
    const q = new URLSearchParams(location.search);
    const body = new Body(canvas, { onNote: (m) => console.info('[x3d to babylon]', m), tone: q.get('tone') || 'aces', lightScale: +(q.get('ls') || 2.2), pbrEnv: +(q.get('env') || 0), shadows: q.get('shadows') !== '0' });
    await body.init();
    if (q.get('revz') !== '0') body.engine.useReverseDepthBuffer = true; // a 0.25 m near plane and a 9 km far plane in one frame
    X3DSAI.setBody(body);
    body.noNav = true;
    host.browser = X3DSAI.B;
    window.__driftWebGPU = { body, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo, via: window.__adapterVia };
    customElements.define('x3d-canvas', class extends HTMLElement {});
  } catch (e) {
    console.error(e); window.__driftWebGPUError = String(e && e.message || e);
    say(String(e && e.message || e));
  }
})();
