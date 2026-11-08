/* The Babylon body for the Material Odyssey film page.  The page (not this file) decides when to start it: it calls OdysseyBabylon.create(container) when the visitor picks the
   Babylon engine, gets back a browser object that speaks the subset of the X3D scene access interface the page's X_ITE adapter already uses, and drives the film through it.
   Loaded after sai.js, as the last part of babylon/bundle.js. */
window.OdysseyBabylon = (function () {
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
  return {
    version: BABYLON.Engine.Version,
    /* the SAI value types of this bundle; window.X3D is handed back to X_ITE by the page's loader, so the adapter takes the types from here */
    ns: window.X3DSAI.X3D,
    async create(container, opts) {
      opts = opts || {};
      patchAdapter();
      if (window.__odysseyLook) { window.__odysseyLook.installed = false; window.__odysseyLook.shadowGens = []; }   // a second start (the visitor switched away and back) installs the look again
      const canvas = document.createElement('canvas');
      canvas.className = 'bjs'; canvas.style.cssText = 'touch-action:none;outline:none';   // the page's CSS places it in the 2.39:1 picture rectangle, as it does X_ITE's element
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'A Material Odyssey, drawn by Babylon.js on WebGPU');
      container.appendChild(canvas);
      let body;
      try {
        body = new Body(canvas, { onNote: (m) => { (window.__odysseyNotes ||= []).push(m); console.info('[x3d to babylon]', m); }, tone: 'neutral', normalGain: 1, invertNormalY: true, ccw: true, twoSided: true });
        await body.init();
      } catch (e) { canvas.remove(); throw e; }
      X3DSAI.setBody(body);
      const info = { babylon: BABYLON.Engine.Version, adapter: body.adapterInfo, via: window.__adapterVia || null };
      return {
        body, B: X3DSAI.B, ns: X3DSAI.X3D, canvas, info,
        /* a seek writes set_fraction to 124 interpolators; the reader lets an output fire once per timestamp, so each seek starts a new one */
        newTimestamp() { R.events.begin(R.events.ts + 1e-6); },
        async ready() { await body.scene.whenReadyAsync(); },
        queue() { return body.engine._device ? body.engine._device.queue : null; },
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
