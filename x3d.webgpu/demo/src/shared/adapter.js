/* One WebGPU adapter request that does not give up early. Babylon asks navigator.gpu.requestAdapter() with its own options (the high-performance
   hint); on some machines only the plain call, the low-power hint or the software adapter answers (x3d.loom PR 14, playbook 4.1). This wraps the
   call so the plain request goes first, then the caller's options, low-power, then the fallback adapter, and records which one answered
   (window.__adapter, window.__adapterVia) so a page can say so on screen and the Timing panel can name the GPU. Loaded before the body starts. */
(() => {
  const gpu = navigator.gpu;
  if (!gpu || gpu.__plainFirst) return;
  const orig = gpu.requestAdapter.bind(gpu);
  gpu.requestAdapter = async (opts) => {
    let a = null;
    for (const o of [undefined, opts, { powerPreference: 'low-power' }, { forceFallbackAdapter: true }]) {
      try { a = await orig(o); } catch (e) { a = null; }
      if (a) { window.__adapter = a; window.__adapterVia = o === undefined ? 'default' : JSON.stringify(o); break; }
    }
    return a;
  };
  gpu.__plainFirst = true;
})();
