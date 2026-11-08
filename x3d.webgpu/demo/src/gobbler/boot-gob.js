/* Gobbler 3 on Babylon WebGPU: define <x3d-canvas> before the page's own code asks for it, start the body when the element is attached, and let
   the page's unmodified common.js drive it through the SAI shim. Loaded last in the bundle. Every fallback the body takes is listed on screen (law 40). */
(() => {
  const B = X3DSAI.B, gaps = window.__gobGaps = [];
  let resolveReady, rejectReady; const ready = new Promise((a, b) => { resolveReady = a; rejectReady = b; });
  ready.catch(() => {});
  // the page calls loadURL straight away; the body needs a moment for the adapter, so the browser object waits for it
  for (const k of ['loadURL', 'replaceWorld', 'createX3DFromString']) { const o = B[k]; B[k] = async function (...a) { await ready; return o.apply(B, a); }; }
  B.getCurrentTime = () => (performance.timeOrigin + performance.now()) / 1000;   // common.js reads it for its frame readout

  const say = (msg) => {
    const d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#07060a;color:#efe8da;font:16px/1.5 system-ui,sans-serif;z-index:99';
    d.innerHTML = '<div style="max-width:36em"><h2 style="margin:0 0 .5em">The Gobbler on WebGPU needs a WebGPU browser</h2><p>' + msg + '</p><p style="opacity:.75">Chrome or Edge 113 and later, Safari 26, and Firefox 141 and later on Windows run it. On Windows with an Intel UHD 620 or similar, Chrome may need chrome://flags/#enable-unsafe-webgpu switched on. The WebGL version of this page is the one it was ported from.</p></div>';
    document.body.appendChild(d);
  };
  const chip = () => {
    let c = document.getElementById('gob-gaps');
    if (!c) {
      c = document.createElement('div'); c.id = 'gob-gaps';
      c.style.cssText = 'position:absolute;left:26px;top:56px;z-index:20;max-width:min(36em,80%);font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#f2dca8;background:rgba(8,6,10,.78);border:1px solid rgba(250,204,115,.35);border-radius:8px;padding:6px 10px;cursor:pointer';
      c.addEventListener('click', () => { c.dataset.open = c.dataset.open === '1' ? '0' : '1'; render(); });
      const st = document.getElementById('stage'); (st || document.body).appendChild(c);
    }
    return c;
  };
  const render = () => { const c = chip(), open = c.dataset.open === '1'; c.textContent = open ? 'Fallbacks (click to close):\n' + gaps.map((g) => '· ' + g).join('\n') : gaps.length + ' fallback' + (gaps.length > 1 ? 's' : '') + ' in this drawing (click)'; c.style.whiteSpace = 'pre-wrap'; };
  const onNote = (m) => { console.info('[x3d to babylon]', m); if (/transformed|decomposed to TRS/.test(m)) return; gaps.push(m); render(); };

  async function start(cv, host) {
    try {
      const q = new URLSearchParams(location.search);
      const body = new Body(cv, { onNote, tone: q.get('tone') || 'none' });   // the ported programs write their own values; Material fallbacks are not tone mapped
      await body.init();
      X3DSAI.setBody(body);
      window.__gobWebGPU = { body, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo, via: window.__adapterVia };
      if (/swiftshader|llvmpipe|software|basic render|warp/i.test(JSON.stringify(body.adapterInfo || {}) + (window.__adapter && window.__adapter.isFallbackAdapter ? ' software' : ''))) onNote('software WebGPU adapter: correctness only, speed figures from it mean nothing');
      window.__timingHooks = {
        name: 'Gobbler 3', schema: 'x3d.gobbler.timing/1', engine: () => body.engine, babylon: BABYLON.Engine.Version, adapter: body.adapterInfo,
        inside: "the page's own interface work (explorer, tour, picking) and the Babylon draw", adaptive: false, corner: 'right',
        scene() { const vp = body.bound; const d = vp && vp.f ? vp.f.description : null; return { key: [d], label: [d], fields: { viewpoint: d, tour: !!(window.PX && PX.tourOn), points: 'see scene' } }; },
      };
      if (window.__timingPlace) window.__timingPlace();
      resolveReady();
    } catch (e) {
      console.error(e); window.__gobWebGPUError = String(e && e.message || e); rejectReady(e);
      say(String(e && e.message || e));
    }
  }
  customElements.define('x3d-canvas', class extends HTMLElement {
    connectedCallback() {
      if (this._started) return; this._started = true;
      const cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none'; cv.tabIndex = 0; cv.setAttribute('role', 'application');
      cv.setAttribute('aria-label', 'Interactive 3D knowledge graph. Drag to orbit, scroll to zoom, click the bird to make it dissolve and reassemble.');
      this.appendChild(cv); start(cv, this);
    }
    get browser() { return B; }
  });
})();
