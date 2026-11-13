/* LoadSensor (Networking level 3): LoadSensor generates events as watchList child nodes are either loaded or fail to load.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('LoadSensor', {
  component: 'Networking', level: 3,
  container: 'children',
  defs: {
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    isActive: ['SFBool', OUT, false],
    isLoaded: ['SFBool', OUT, false],
    loadTime: ['SFTime', OUT, 0],
    metadata: ['SFNode', IO, null],
    progress: ['SFFloat', OUT, 0],
    timeOut: ['SFTime', IO, 0],
  },
  // NetworkSensor: watches the children that carry a url (textures, Inline, audio, ...). isActive from the first count until all are loaded, one failed, or timeOut passed;
  // progress = loaded / total; loadTime when all loaded. The count rules are X_ITE 16.6.0's (an aborted sensor still reports isLoaded when the last child later completes).
  init(n) {
    const L = n._ls = { objs: [], aborted: false, timer: 0 };
    const set = (f, v) => { if (JSON.stringify(n.f[f]) !== JSON.stringify(v)) BR.fire(n, f, v); };
    const now = () => performance.timeOrigin / 1000 + performance.now() / 1000;
    const setTimeOut = () => {
      if (!n.f.isActive) return; clearTimeout(L.timer); L.aborted = false;
      if (n.f.timeOut > 0) L.timer = setTimeout(() => { clearTimeout(L.timer); L.aborted = true; if (n.f.enabled) count(); }, n.f.timeOut * 1000);
    };
    const count = () => {
      const u = L.objs;
      if (!u.length) { set('isActive', false); set('isLoaded', false); set('progress', 0); return; }
      const complete = u.filter((o) => o.state === 'complete').length, failed = u.filter((o) => o.state === 'failed').length, loaded = complete === u.length, progress = complete / u.length;
      if (L.aborted || failed || loaded) { clearTimeout(L.timer); set('isActive', false); set('isLoaded', loaded); set('progress', progress); if (loaded) BR.fire(n, 'loadTime', now()); }
      else if (n.f.isActive) set('progress', progress);
      else { set('isActive', true); set('progress', progress); setTimeOut(); }
    };
    const load = (o) => {
      const urls = (o.node.f.url || []).slice(); o.state = 'loading';
      const next = () => {
        if (!urls.length) { o.state = 'failed'; return count(); }
        const u = BR.resolveUrl(urls.shift());
        if (o.node.type === 'ImageTexture') { const im = new Image(); im.onload = () => { o.state = 'complete'; count(); }; im.onerror = next; im.src = u; }
        else fetch(u).then((r) => { if (r.ok) { o.state = 'complete'; count(); } else next(); }, next);
      };
      next();
    };
    setTimeout(() => {
      if (!n.f.enabled) return;
      L.objs = (n.f.children || []).filter((c) => c.f && Array.isArray(c.f.url)).map((node) => ({ node, state: 'loading' }));
      count(); for (const o of L.objs) load(o);
    }, 0);
  },
});
