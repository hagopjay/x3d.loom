/* start the Babylon WebGPU body, then let the page's own code take over (it asks X3D.getBrowser('#stage') and waits for it) */
(async () => {
  const canvas = document.getElementById('stage');
  const say = (msg) => {
    const d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#02040a;color:#cfe;font:16px/1.5 system-ui,sans-serif;z-index:99';
    d.innerHTML = '<div style="max-width:34em"><h2 style="margin:0 0 .5em">This page needs WebGPU</h2><p>' + msg + '</p><p style="opacity:.75">Chrome or Edge 113 and later, Safari 26, and Firefox 141 and later on Windows run it. The WebGL version of this demo is the page it was ported from.</p></div>';
    document.body.appendChild(d);
  };
  try {
    const body = new Body(canvas, { onNote: (m) => console.info('[x3d to babylon]', m) });
    await body.init();
    X3DSAI.setBody(body);
    window.__brainWebGPU = { body, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo };
  } catch (e) {
    console.error(e); window.__brainWebGPUError = String(e && e.message || e);
    say(String(e && e.message || e));
  }
})();
