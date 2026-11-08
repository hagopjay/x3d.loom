/* The Hall on Babylon WebGPU: the page (not this file) decides when to start it. It calls HallBabylon.create(container) and gets back the SAI browser (window.X3DSAI.B) plus the body;
   the page loads hall.x3d through B.loadURL and drives the film through the Film TimeSensor, as it does with X_ITE. Loaded last in babylon/bundle.js. */
window.HallBabylon = (function () {
  let gpuPatched = false;
  const patchAdapter = () => {   // the plain requestAdapter() answers on machines where the high-performance hint does not (x3d.loom PR 14)
    const gpu = navigator.gpu; if (!gpu || gpuPatched) return; gpuPatched = true;
    const orig = gpu.requestAdapter.bind(gpu);
    gpu.requestAdapter = async (opts) => {
      let a = null;
      for (const o of [undefined, opts, { powerPreference: 'low-power' }, { forceFallbackAdapter: true }]) { try { a = await orig(o); } catch (e) { a = null; } if (a) { window.__adapter = a; window.__adapterVia = o === undefined ? 'plain' : JSON.stringify(o); break; } }
      return a;
    };
  };
  const SOFT = /swiftshader|llvmpipe|lavapipe|software|basic render|warp/i;
  return {
    version: BABYLON.Engine.Version,
    ns: window.X3DSAI.X3D,
    async create(container, opts) {
      opts = opts || {};
      patchAdapter();
      const q = new URLSearchParams(location.search);
      if (window.__odysseyLook) { window.__odysseyLook.installed = false; window.__odysseyLook.shadowGens = []; }
      if (window.__hallLook) window.__hallLook.installed = false;
      const canvas = document.createElement('canvas');
      canvas.className = 'bjs'; canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none';
      canvas.tabIndex = 0; canvas.setAttribute('role', 'application');
      canvas.setAttribute('aria-label', 'The Hall of the Library of PolyXandria, drawn by Babylon.js on WebGPU. Drag to orbit, scroll to zoom, right-drag to pan.');
      container.appendChild(canvas);
      const notes = window.__hallNotes = [];
      let body;
      try {
        body = new Body(canvas, { onNote: (m) => { if (/decomposed to TRS|transformed/.test(m)) return; notes.push(m); console.info('[x3d to babylon]', m); if (opts.onNote) opts.onNote(m); },
          tone: 'neutral', normalGain: 1, invertNormalY: true, ccw: true, twoSided: true, shadows: false });
        await body.init();
        if (q.get('rz') !== '0') { try { body.engine.useReverseDepthBuffer = true; } catch (e) { notes.push('reversed depth buffer not available: ' + e.message); } }   // the galaxy is 2.4 km out, the lamps 0.3 m across
        if (q.has('scale')) body.engine.setHardwareScalingLevel(1 / Math.max(0.25, +q.get('scale')));
      } catch (e) { canvas.remove(); throw e; }
      X3DSAI.setBody(body);
      window.__hallBody = body;
      const soft = SOFT.test(JSON.stringify(body.adapterInfo || {}) + (window.__adapter && window.__adapter.isFallbackAdapter ? ' software' : ''));
      if (soft) notes.push('software WebGPU adapter: correctness only, speed figures from it mean nothing');
      const info = { babylon: BABYLON.Engine.Version, adapter: body.adapterInfo, via: window.__adapterVia || null, software: soft };
      window.__timingHooks = {
        name: 'Library Hall', schema: 'x3d.hall.timing/1', engine: () => body.engine, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo,
        inside: "the page's own controls and the Babylon draw (two cascaded sun shadows, 88 PBR materials)", adaptive: false, corner: 'right',
        scene() { const vp = body.bound; const d = vp && vp.f ? vp.f.description : null; return { key: [d, !!(window.__hallLook && window.__hallLook.on)], label: [d], fields: { viewpoint: d, look: !!(window.__hallLook && window.__hallLook.on) } }; },
      };
      if (window.__timingPlace) window.__timingPlace();
      return {
        body, B: X3DSAI.B, ns: X3DSAI.X3D, canvas, info, notes,
        async ready() { await body.scene.whenReadyAsync(); },
        dispose() {
          try { body.engine.stopRenderLoop(); } catch (e) { /* already stopped */ }
          const eng = body.engine; eng.resize = () => {};
          try { body.scene.dispose(); } catch (e) { /* gone */ }
          try { eng.dispose(); } catch (e) { /* gone */ }
          canvas.remove();
        },
      };
    },
  };
})();
