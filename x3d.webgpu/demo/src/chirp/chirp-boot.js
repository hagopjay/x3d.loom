/* start the Babylon WebGPU body for the Chirp study, then define <x3d-canvas> so the page's own boot (X3D.getBrowser('#canvas')) goes on */
window.__chirpReady = (async () => {
  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  const host = document.getElementById('canvas');
  const say = (msg) => {
    const d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#03040a;color:#dfe8ff;font:16px/1.5 system-ui,sans-serif;z-index:99';
    d.innerHTML = '<div style="max-width:36em"><h2 style="margin:0 0 .5em">Chirp on WebGPU needs a WebGPU browser</h2><p>' + msg + '</p><p style="opacity:.75">Chrome or Edge 113 and later, Safari 26, and Firefox 141 and later on Windows run it. If your Chrome lists no adapter (some Intel laptops), open <code>chrome://flags/#enable-unsafe-webgpu</code>, set it to Enabled and relaunch. The WebGL version of this study is on the STEM shelf.</p></div>';
    document.body.appendChild(d);
  };
  try {
    const gpu = navigator.gpu;
    if (gpu && !gpu.__plainFirst) {   // the plain requestAdapter() answers on machines where the high-performance hint does not (x3d.loom PR 14)
      const orig = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (opts) => {
        let a = null;
        for (const o of [undefined, opts, { powerPreference: 'low-power' }, { forceFallbackAdapter: true }]) { try { a = await orig(o); } catch (e) { a = null; } if (a) { window.__adapter = a; window.__adapterVia = o === undefined ? 'plain' : JSON.stringify(o); break; } }
        return a;
      };
      gpu.__plainFirst = true;
    }
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(canvas);
    const q = new URLSearchParams(location.search);
    const body = new Body(canvas, { onNote: (m) => console.info('[x3d to babylon]', m), tone: q.get('tone') || 'neutral' });
    await body.init();
    X3DSAI.setBody(body);
    window.__chirpLook.pending = () => body.installChirpLook();
    host.__browser = X3DSAI.B; host.browser = X3DSAI.B;
    window.__chirpWebGPU = { body, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo, via: window.__adapterVia };
    customElements.define('x3d-canvas', class extends HTMLElement {});
  } catch (e) {
    console.error(e); window.__chirpWebGPUError = String(e && e.message || e);
    say(String(e && e.message || e));
  }
})();
