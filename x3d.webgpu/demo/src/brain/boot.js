/* start the Babylon WebGPU body, then let the page's own code take over (it asks X3D.getBrowser('#stage') and waits for it) */
(async () => {
  const canvas = document.getElementById('stage');
  const say = (msg) => {
    const d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#02040a;color:#cfe;font:16px/1.5 system-ui,sans-serif;z-index:99';
    d.innerHTML = '<div style="max-width:34em"><h2 style="margin:0 0 .5em">This page needs WebGPU</h2><p>' + msg + '</p><p style="opacity:.75">Chrome or Edge 113 and later, Safari 26, and Firefox 141 and later on Windows run it. On Windows with an Intel UHD 620 or similar, Chrome may need chrome://flags/#enable-unsafe-webgpu switched on. The WebGL version of this demo is the page it was ported from.</p></div>';
    document.body.appendChild(d);
  };
  try {
    const body = new Body(canvas, { onNote: (m) => console.info('[x3d to babylon]', m) });
    await body.init();
    X3DSAI.setBody(body);
    window.__brainWebGPU = { body, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo };
    window.__timingHooks = {
      name: 'Neural Canvas', schema: 'x3d.neural.timing/1', engine: () => body.engine, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo,
      inside: "the page's own interface work (HUD, picking, tour) and the Babylon draw", adaptive: false, corner: 'right',
      scene() {
        const st = window.__loom && window.__loom.state ? window.__loom.state : {};
        const hidden = Object.keys(st.sw || {}).filter((k) => st.sw[k] === -1).sort();
        return { key: [st.kind || null, st.lookId || null], label: [st.kind, st.lookId, st.cam],
          fields: { kind: st.kind || null, look: st.lookId || null, camera: st.cam || null, glow: st.glow == null ? null : !!st.glow, clip: st.clip == null ? null : !!st.clip, layers_hidden: hidden } };
      },
    };
    if (window.__timingPlace) window.__timingPlace();
  } catch (e) {
    console.error(e); window.__brainWebGPUError = String(e && e.message || e);
    say(String(e && e.message || e));
  }
})();
