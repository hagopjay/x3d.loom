// X_ITE 16.x render page. The glb is an <Inline> inside a generated X3D 4.0 wrapper (/wrapper.x3d, built by
// render/x3dwrap.mjs with the shared camera as a Viewpoint). Entry point: window.__render(params).
window.__pageReady = true;

const BG_HEX = '#20242c';

// ---- statistics: walk the X3D scene X_ITE's own glTF importer produces for the glb ---------------------
function sceneStats(rootNodes) {
  const s = { shapes: 0, triangles: 0, instances: 0, instancedShapes: 0, pointVertices: 0, lineSets: 0, lights: 0, viewpoints: 0, nodeTypes: {}, geometryTypes: {} };
  const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
  const len = (a) => (a && typeof a.length === 'number' ? a.length : 0);
  const geomTriangles = (g) => {
    const t = g.getNodeTypeName();
    s.geometryTypes[t] = (s.geometryTypes[t] || 0) + 1;
    switch (t) {
      case 'IndexedTriangleSet': return len(get(g, 'index')) / 3;
      case 'TriangleSet': return len(get(get(g, 'coord'), 'point')) / 3;
      case 'IndexedFaceSet': {
        let n = 0, run = 0;
        const ci = get(g, 'coordIndex');
        for (let i = 0; i < len(ci); i++) { if (ci[i] < 0) { if (run >= 3) n += run - 2; run = 0; } else run++; }
        if (run >= 3) n += run - 2;
        return n;
      }
      case 'IndexedTriangleStripSet': {
        let n = 0, run = 0; const ci = get(g, 'index');
        for (let i = 0; i < len(ci); i++) { if (ci[i] < 0) { if (run >= 3) n += run - 2; run = 0; } else run++; }
        if (run >= 3) n += run - 2; return n;
      }
      case 'TriangleStripSet': { let n = 0; const sc = get(g, 'stripCount'); for (let i = 0; i < len(sc); i++) n += Math.max(0, sc[i] - 2); return n; }
      case 'PointSet': s.pointVertices += len(get(get(g, 'coord'), 'point')); return 0;
      case 'IndexedLineSet': case 'LineSet': s.lineSets++; return 0;
      default: return 0;
    }
  };
  const visit = (node, depth) => {
    if (!node || depth > 64) return;
    const t = node.getNodeTypeName();
    s.nodeTypes[t] = (s.nodeTypes[t] || 0) + 1;
    if (t === 'Shape') {
      s.shapes++;
      const g = get(node, 'geometry');
      if (g) s.triangles += geomTriangles(g);
      return;
    }
    if (t === 'InstancedShape') {
      // X_ITE's EXT_mesh_gpu_instancing import: one InstancedShape per instanced node
      s.shapes++;
      s.instancedShapes++;
      const n = Math.max(len(get(node, 'translations')), len(get(node, 'rotations')), len(get(node, 'scales')), 1);
      s.instances += n;
      const g = get(node, 'geometry');
      if (g) s.triangles += geomTriangles(g) * n;
      return;
    }
    if (/Light$/.test(t)) s.lights++;
    if (t === 'Viewpoint' || t === 'OrthoViewpoint') s.viewpoints++;
    const kids = get(node, 'children');
    if (kids && typeof kids.length === 'number') for (let i = 0; i < kids.length; i++) visit(kids[i], depth + 1);
  };
  for (let i = 0; i < rootNodes.length; i++) visit(rootNodes[i], 0);
  return s;
}

window.__render = async function (p) {
  const notes = [];
  const out = { engine: 'xite', notes };
  const canvas = document.createElement('x3d-canvas');
  canvas.style.width = p.size + 'px';
  canvas.style.height = p.size + 'px';
  for (const [k, v] of Object.entries({ splashScreen: 'false', notifications: 'false', contextMenu: 'false', timings: 'false', contentScale: '1', update: 'auto' })) canvas.setAttribute(k, v);
  document.body.appendChild(canvas);
  const browser = canvas.browser;
  out.version = browser.version;

  // ---- colour / quality: simplest consistent defaults ------------------------------------------------
  const opt = { ToneMapping: 'NONE', Dashboard: false, Rubberband: false, ContextMenu: false, SplashScreen: false, Notifications: false, Timings: false, EnableInlineViewpoints: false, Antialiased: true, ContentScale: 1 };
  for (const [k, v] of Object.entries(opt)) { try { browser.setBrowserOption(k, v); } catch (e) { notes.push(`setBrowserOption ${k} failed: ${e.message}`); } }
  const readOpt = {};
  for (const k of ['ToneMapping', 'ColorSpace', 'DisplayColorSpace', 'Exposure', 'Antialiased', 'Multisampling', 'ContentScale', 'Shading', 'TextureQuality', 'PrimitiveQuality', 'LogarithmicDepthBuffer', 'OrderIndependentTransparency']) { try { readOpt[k] = browser.getBrowserOption(k); } catch { /* absent */ } }
  out.colour = {
    toneMapping: readOpt.ToneMapping,
    colorSpace: readOpt.ColorSpace,
    displayColorSpace: readOpt.DisplayColorSpace,
    exposure: readOpt.Exposure,
    clear: `Background skyColor = ${BG_HEX} written as sRGB components (see x3dwrap.mjs)`,
    browserOptions: readOpt,
  };

  // X_ITE neither rejects loadURL() nor reports isLoaded when an Inline's file (or one of its buffers/textures)
  // cannot be fetched: it logs console.error("Couldn't load URL ...") and the promise never settles. Turn that
  // log line into a rejection so a failed load fails fast instead of waiting for the 60 s timeout.
  let loadFailure = null;
  const failed = new Promise((_, reject) => {
    const orig = console.error;
    console.error = function (...a) {
      const m = a.map(String).join(' ');
      if (/Couldn't load URL/.test(m) && !loadFailure) { loadFailure = m.split('\n')[0]; reject(new Error('X_ITE: ' + loadFailure)); }
      return orig.apply(this, a);
    };
  });
  failed.catch(() => {}); // avoid unhandled-rejection noise when nothing fails
  const t0 = performance.now();
  await Promise.race([browser.loadURL(new X3D.MFString(p.wrapperUrl)), failed]);
  const scene = browser.currentScene;
  const sensor = scene.getNamedNode('LOADED');
  let waited = 0;
  // loadURL() resolves when the Inline has finished (or failed); give the LoadSensor a few frames to report
  while (!sensor.isLoaded && waited < 30) { await browser.nextFrame(); waited++; }
  const loadMs = performance.now() - t0;
  out.xite = { loadSensorIsLoaded: !!sensor.isLoaded, framesWaitedForLoadSensor: waited };
  if (!sensor.isLoaded) throw new Error('X_ITE: LoadSensor never reported isLoaded for the Inline');

  // ---- lighting record -------------------------------------------------------------------------------
  const nav = browser.activeNavigationInfo;
  out.lighting = {
    source: p.hasLights ? 'glb' : 'fallback',
    glbLights: p.declaredLights,
    headlight: nav ? nav.headlight : null,
    ambient: p.hasLights ? null : 'EnvironmentLight(intensity 0.2) with a uniform mid-grey diffuse cube map (six 1x1 PNG faces); NavigationInfo headlight on (X_ITE default headlight: white directional, intensity 1)',
  };

  // ---- settle ----------------------------------------------------------------------------------------
  const t1 = performance.now();
  for (let i = 0; i < 3; i++) await browser.nextFrame();
  out.settleMs = performance.now() - t1;
  out.loadMs = loadMs;

  // ---- stats: parse the same glb again with X_ITE's importer (the Inline's internal scene is not reachable
  //      through the public API) and count what that scene contains --------------------------------------
  try {
    const t2 = performance.now();
    const parsed = await browser.createX3DFromURL(new X3D.MFString(p.glbUrl));
    const st = sceneStats(parsed.rootNodes);
    out.stats = { meshes: st.shapes, triangles: st.triangles, instancedShapes: st.instancedShapes, instances: st.instances, points: st.pointVertices, lineSets: st.lineSets, lights: st.lights, nodeTypes: st.nodeTypes, geometryTypes: st.geometryTypes, via: 'second X_ITE parse of the glb (createX3DFromURL), Shape.geometry walked through the public API; Shape visits counted once each, InstancedShape = geometry x max(len(translations|rotations|scales))' };
    out.xite.statsParseMs = performance.now() - t2;
  } catch (e) {
    out.stats = { meshes: null, triangles: null, note: `stats parse failed: ${e.message}` };
    notes.push(`X_ITE stats unavailable: ${e.message}`);
  }
  out.decoders = {
    draco: { calls: null, note: 'not countable from outside X_ITE; see assetsFetched' },
    meshopt: { calls: null, note: 'not countable from outside X_ITE; see assetsFetched' },
    ktx2: { calls: null, note: 'not countable from outside X_ITE; see assetsFetched' },
  };
  out.decoderConfig = {
    assetsBase: 'script-relative: /nm/x_ite/dist/assets/lib/ (draco_decoder_gltf.js, meshopt_decoder.js, libktx.js, libktx.wasm)',
  };
  return out;
};
