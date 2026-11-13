/* x3d.mol body: draws an XMolReader model with Babylon.js (WebGPU first, WebGL2 fallback). Look, not data: materials, the studio
   environment, lights beyond the file's, bloom, ambient occlusion and depth of field are declared here and listed in body.effects so a page
   can say exactly which ones ran. Right-handed scene so X3D coordinates are used as written. */
(function (root) {
  "use strict";
  const B = root.BABYLON;
  const lin = (c) => Math.pow(Math.max(0, Math.min(1, c)), 2.2);
  const PL = [[90, [0, 0.3255, 0.8392]], [70, [0.396, 0.796, 0.953]], [50, [1, 0.859, 0.0745]], [0, [1, 0.49, 0.2706]]];
  const SSC = { H: [0.93, 0.33, 0.52], E: [0.97, 0.78, 0.25], "-": [0.55, 0.66, 0.78], n: [0.25, 0.75, 0.70] };
  const CHAIN = [[0.45, 0.75, 1], [1, 0.62, 0.35], [0.55, 0.9, 0.55], [0.95, 0.5, 0.85], [0.95, 0.9, 0.4], [0.6, 0.6, 1], [0.4, 0.9, 0.85], [1, 0.45, 0.45]];
  const hsv = (h, s, v) => { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; };
  const ramp = (stops, x) => { for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) { const a = stops[i - 1], b = stops[i], u = (x - a[0]) / (b[0] - a[0]); return a[1].map((v, k) => v + (b[1][k] - v) * u); } return stops[stops.length - 1][1]; };
  const SMOOTH = [[0, [1, 0.49, 0.27]], [50, [1, 0.86, 0.07]], [70, [0.4, 0.8, 0.95]], [90, [0, 0.33, 0.84]], [100, [0, 0.2, 0.7]]];
  const SEQ = [[0, [0.05, 0.1, 0.35]], [0.5, [0.2, 0.7, 0.65]], [1, [0.98, 0.93, 0.4]]];

  /* per-residue colour tables for the schemes the page offers */
  function residueColors(model, scheme) {
    const m = model.meta, n = m.residues.length, out = new Float32Array(n * 3);
    const chains = m.chains, chainOf = m.residues.map((r) => chains.indexOf(r.split(":")[0]));
    const ss = m.ss[0], conf = m.plddt || null, bf = m.bfactor || null;
    let bmin = 0, bmax = 1;
    if (bf) { bmin = Math.min(...bf); bmax = Math.max(...bf) || 1; }
    const first = {}, last = {};
    chainOf.forEach((c, i) => { if (first[c] === undefined) first[c] = i; last[c] = i; });
    for (let i = 0; i < n; i++) {
      let c;
      const nuc = ss[i] === "n";
      if (scheme === "plddt" && conf) c = (PL.find(([lo]) => conf[i] >= lo) || PL[3])[1];
      else if (scheme === "plddt-smooth" && conf) c = ramp(SMOOTH, conf[i]);
      else if (scheme === "ss") c = SSC[ss[i]];
      else if (scheme === "chain") c = CHAIN[chainOf[i] % CHAIN.length];
      else if (scheme === "rainbow") c = nuc ? SSC.n : hsv(0.66 * (1 - (i - first[chainOf[i]]) / Math.max(1, last[chainOf[i]] - first[chainOf[i]])), 0.8, 0.98);
      else if (scheme === "bfactor" && bf) c = ramp(SEQ, (bf[i] - bmin) / (bmax - bmin || 1));
      else c = SSC[ss[i]] || SSC["-"];
      out.set(c, i * 3);
    }
    return out;
  }

  function studioEnv(scene) {
    const faces = [], S = 64;
    const mk = (draw) => { const c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"); draw(g, S); return c.toDataURL("image/png"); };
    const side = (warm) => mk((g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, "#5a6b86"); gr.addColorStop(0.5, warm ? "#f1e2cf" : "#c9d8ee"); gr.addColorStop(0.62, "#2a2f3a"); gr.addColorStop(1, "#06080c");
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.fillStyle = warm ? "#fff6e6" : "#e8f3ff"; g.fillRect(s * 0.18, s * 0.12, s * 0.64, s * 0.2);          // soft box
    });
    const top = mk((g, s) => { g.fillStyle = "#1b2433"; g.fillRect(0, 0, s, s); g.fillStyle = "#ffffff"; g.fillRect(s * 0.25, s * 0.25, s * 0.5, s * 0.5); });
    const bot = mk((g, s) => { g.fillStyle = "#07090d"; g.fillRect(0, 0, s, s); });
    // order for CubeTexture files: px, py, pz, nx, ny, nz
    faces.push(side(true), top, side(false), side(true), bot, side(false));
    const t = new B.CubeTexture("", scene, null, false, faces, null, null, undefined, false, null, true);
    return t;
  }

  async function create(canvas, opts) {
    opts = opts || {};
    let engine, backend = "webgl2";
    const wantGPU = opts.webgpu !== false && !!navigator.gpu;
    if (wantGPU) {
      try {
        if (await B.WebGPUEngine.IsSupportedAsync) {
          engine = new B.WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true, stencil: true });
          await engine.initAsync();
          backend = "webgpu";
        }
      } catch (e) { console.warn("WebGPU engine failed, falling back to WebGL2:", e); engine = null; }
    }
    if (!engine) engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true }, true);
    const scene = new B.Scene(engine);
    scene.useRightHandedSystem = true;
    scene.clearColor = new B.Color4(0.012, 0.017, 0.03, 1);
    const cam = new B.ArcRotateCamera("cam", -1.0, 1.15, 120, B.Vector3.Zero(), scene);
    cam.attachControl(canvas, true);
    cam.wheelDeltaPercentage = 0.012; cam.pinchDeltaPercentage = 0.012; cam.panningSensibility = 600; cam.minZ = 0.3; cam.inertia = 0.88;
    const body = { engine, scene, camera: cam, backend, effects: {}, model: null, layers: {}, cinema: false, meshes: [], notes: [] };
    // sky: a vertical gradient on an inverted sphere that follows the camera (look, not data); fog gives far parts depth
    try {
      const tex = new B.DynamicTexture("skytex", { width: 4, height: 256 }, scene, false), g = tex.getContext();
      const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#02040a"); gr.addColorStop(0.42, "#0b1a36"); gr.addColorStop(0.52, "#16294a"); gr.addColorStop(0.6, "#0a1428"); gr.addColorStop(1, "#020308");
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256); tex.update();
      const sky = B.MeshBuilder.CreateSphere("sky", { diameter: 1600, segments: 12, sideOrientation: B.Mesh.BACKSIDE }, scene), sm = new B.StandardMaterial("skym", scene);
      sm.emissiveTexture = tex; sm.disableLighting = true; sm.backFaceCulling = false; sm.diffuseColor = B.Color3.Black(); sm.specularColor = B.Color3.Black(); sm.fogEnabled = false;
      sky.material = sm; sky.infiniteDistance = true; sky.isPickable = false; body.sky = sky; body.effects.sky = true;
    } catch (e) { body.effects.sky = false; }
    scene.fogMode = B.Scene.FOGMODE_EXP2; scene.fogColor = new B.Color3(0.02, 0.035, 0.07); scene.fogDensity = 0.004;
    // lights: the file's three directional lights plus a soft hemispheric fill
    const hemi = new B.HemisphericLight("hemi", new B.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.35; hemi.diffuse = new B.Color3(0.55, 0.65, 0.9); hemi.groundColor = new B.Color3(0.18, 0.12, 0.08);
    body.lights = [];
    // environment (look): generated studio cube, never a fetched file
    try { scene.environmentTexture = studioEnv(scene); scene.environmentIntensity = 0.9; body.effects.studioEnvironment = true; }
    catch (e) { body.effects.studioEnvironment = false; body.notes.push("studio environment skipped: " + e.message); }
    // motes
    try {
      const dot = new B.DynamicTexture("dot", 64, scene, false); const g = dot.getContext();
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); dot.update();
      const ps = new B.ParticleSystem("motes", 450, scene);
      ps.particleTexture = dot; ps.emitter = B.Vector3.Zero(); ps.minSize = 0.15; ps.maxSize = 0.7; ps.minLifeTime = 14; ps.maxLifeTime = 26; ps.emitRate = 24;
      ps.color1 = new B.Color4(0.5, 0.7, 1, 0.55); ps.color2 = new B.Color4(1, 0.8, 0.5, 0.4); ps.colorDead = new B.Color4(0, 0, 0, 0);
      ps.minEmitBox = new B.Vector3(-60, -60, -60); ps.maxEmitBox = new B.Vector3(60, 60, 60);
      ps.direction1 = new B.Vector3(-0.3, -0.2, -0.3); ps.direction2 = new B.Vector3(0.3, 0.4, 0.3); ps.minEmitPower = 0.1; ps.maxEmitPower = 0.5;
      ps.blendMode = B.ParticleSystem.BLENDMODE_ADD; ps.preWarmCycles = 120; ps.preWarmStepOffset = 4; ps.start();
      body.motes = ps; body.effects.motes = true;
    } catch (e) { body.effects.motes = false; }
    // post effects
    const q = opts.quality || "high";
    try {
      const pipe = new B.DefaultRenderingPipeline("pipe", true, scene, [cam]);
      pipe.samples = q === "low" ? 1 : 4; pipe.fxaaEnabled = q === "low";
      pipe.bloomEnabled = q !== "low"; if (pipe.bloomEnabled) { pipe.bloomThreshold = 0.82; pipe.bloomWeight = 0.42; pipe.bloomKernel = 48; pipe.bloomScale = 0.5; }
      pipe.imageProcessingEnabled = true;
      const ip = pipe.imageProcessing; ip.toneMappingEnabled = true;
      ip.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL !== undefined ? B.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL : B.ImageProcessingConfiguration.TONEMAPPING_ACES;
      ip.contrast = 1.18; ip.exposure = 1.05; ip.vignetteEnabled = true; ip.vignetteWeight = 2.2; ip.vignetteStretch = 0.4; ip.vignetteColor = new B.Color4(0, 0.01, 0.03, 0);
      pipe.sharpenEnabled = q !== "low"; if (pipe.sharpenEnabled) pipe.sharpen.edgeAmount = 0.25;
      pipe.grainEnabled = q === "high"; if (pipe.grainEnabled) { pipe.grain.intensity = 4; pipe.grain.animated = true; }
      pipe.depthOfFieldEnabled = false;
      body.pipeline = pipe; body.effects.bloom = pipe.bloomEnabled; body.effects.msaa = pipe.samples; body.effects.toneMapping = "KHR_PBR_NEUTRAL";
    } catch (e) { body.notes.push("rendering pipeline skipped: " + e.message); body.effects.pipeline = false; }
    if (q !== "low") {
      try {
        const ssao = new B.SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 1 }, [cam]);
        ssao.radius = 5; ssao.totalStrength = 1.15; ssao.base = 0.12; ssao.maxZ = 400; ssao.expensiveBlur = false; ssao.samples = 8;
        body.ssao = ssao; body.effects.ssao = true;
      } catch (e) { body.effects.ssao = false; body.notes.push("SSAO2 skipped: " + e.message); }
    }
    try { body.glow = new B.GlowLayer("glow", scene, { mainTextureSamples: q === "low" ? 1 : 2 }); body.glow.intensity = 0.9; body.glow.customEmissiveColorSelector = null; body.effects.glow = true; }
    catch (e) { body.effects.glow = false; }

    const root3 = new B.TransformNode("molecule", scene), sites = new B.TransformNode("sites", scene);
    sites.parent = root3;
    body.root = root3; body.sitesNode = sites;
    const mat = (name, rough, clear) => {
      const m = new B.PBRMaterial(name, scene);
      m.albedoColor = new B.Color3(1, 1, 1); m.metallic = 0.0; m.roughness = rough; m.backFaceCulling = false; m.twoSidedLighting = true;
      if (clear) { m.clearCoat.isEnabled = true; m.clearCoat.intensity = 0.4; m.clearCoat.roughness = 0.1; }
      m.environmentIntensity = 0.9; return m;
    };
    body.matCartoon = mat("cartoon", 0.4, true); body.matSticks = mat("sticks", 0.35, false);

    body.setModel = function (model) {
      for (const m of body.meshes) m.dispose();
      for (const c of sites.getChildren().slice()) c.dispose();
      body.meshes = []; body.model = model;
      const n = model.meta.residues.length;
      body.resVerts = [];
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const md of model.meshes) {
        const mesh = new B.Mesh(md.def, scene); mesh.parent = root3;
        const vd = new B.VertexData(); vd.positions = md.positions; vd.normals = md.normals; vd.indices = md.indices;
        const nv = md.positions.length / 3, col = new Float32Array(nv * 4);
        for (let i = 0; i < nv; i++) { col[i * 4] = lin(md.colors[i * 3]); col[i * 4 + 1] = lin(md.colors[i * 3 + 1]); col[i * 4 + 2] = lin(md.colors[i * 3 + 2]); col[i * 4 + 3] = 1; }
        vd.colors = col; vd.applyToMesh(mesh, true);
        mesh.material = md.def === "LigandSticks" || md.def === "BaseRungs" ? body.matSticks : body.matCartoon;
        mesh.isPickable = true;
        // vertex lists per residue (CSR) for highlighting
        const rid = md.attrs.resid, counts = new Uint32Array(n + 1);
        for (let i = 0; i < nv; i++) counts[rid[i] + 1]++;
        for (let i = 0; i < n; i++) counts[i + 1] += counts[i];
        const order = new Uint32Array(nv), cur = counts.slice();
        for (let i = 0; i < nv; i++) order[cur[rid[i]]++] = i;
        mesh.metadata = { def: md.def, resid: rid, fileColors: col.slice(), colors: col, start: counts, order, lit: [] };
        body.meshes.push(mesh);
        if (md.def.startsWith("Cartoon") || md.def.startsWith("Nucleic")) for (let i = 0; i < md.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], md.positions[i + k]); hi[k] = Math.max(hi[k], md.positions[i + k]); }
      }
      const ctr = lo.map((v, k) => (v + hi[k]) / 2), rad = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
      body.center = new B.Vector3(ctr[0], ctr[1], ctr[2]); body.radius = rad; scene.fogDensity = 0.17 / Math.max(20, rad);
      // sites: zinc spheres, bonds, cages
      body.zincMeshes = []; body.siteBonds = [];
      const glowSet = [];
      for (const z of model.zinc) {
        const s = B.MeshBuilder.CreateSphere(z.def, { diameter: z.radius * 2, segments: 24 }, scene); s.parent = sites; s.position.set(z.pos[0], z.pos[1], z.pos[2]);
        const m = new B.PBRMaterial("zn", scene); m.albedoColor = new B.Color3(0.78, 0.86, 0.96); m.metallic = 1; m.roughness = 0.16; m.emissiveColor = new B.Color3(0.12, 0.2, 0.34);
        s.material = m; s.metadata = { site: z.tag }; body.zincMeshes.push(s); glowSet.push(s);
      }
      for (const b of model.bonds) {
        const a = new B.Vector3(...b.a), c = new B.Vector3(...b.b), len = B.Vector3.Distance(a, c);
        const cyl = B.MeshBuilder.CreateCylinder(b.def, { height: len, diameter: b.radius * 2, tessellation: 12, cap: B.Mesh.NO_CAP }, scene);
        cyl.parent = sites; cyl.position = a.add(c).scale(0.5);
        const dir = c.subtract(a).normalize(), y = new B.Vector3(0, 1, 0), ax = B.Vector3.Cross(y, dir);
        cyl.rotationQuaternion = ax.length() < 1e-6 ? (dir.y > 0 ? B.Quaternion.Identity() : B.Quaternion.RotationAxis(new B.Vector3(1, 0, 0), Math.PI)) : B.Quaternion.RotationAxis(ax.normalize(), Math.acos(Math.max(-1, Math.min(1, dir.y))));
        const m = new B.PBRMaterial("bond", scene);
        if (b.glow) { m.albedoColor = new B.Color3(1, 0.78, 0.35); m.emissiveColor = new B.Color3(1.0, 0.55, 0.12); m.roughness = 0.35; glowSet.push(cyl); }
        else { m.albedoColor = new B.Color3(0.45, 0.5, 0.55); m.alpha = 0.45; m.roughness = 0.6; }
        cyl.material = m; body.siteBonds.push(cyl);
      }
      for (const c of model.cages) {
        const p = c.points, vd = new B.VertexData();
        vd.positions = p; vd.indices = [0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3];
        const normals = []; B.VertexData.ComputeNormals(p, vd.indices, normals); vd.normals = normals;
        const cm = new B.Mesh(c.def, scene); cm.parent = sites; vd.applyToMesh(cm);
        const m = new B.StandardMaterial("cage", scene); m.emissiveColor = new B.Color3(0.25, 0.55, 1.0); m.alpha = 0.16; m.backFaceCulling = false; m.disableLighting = true;
        cm.material = m; cm.isPickable = false;
        const wire = B.MeshBuilder.CreateLineSystem(c.def + "_edges", { lines: [[0, 1, 2, 0], [0, 3, 1], [2, 3]].map((ix) => ix.map((k) => new B.Vector3(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]))) }, scene);
        wire.parent = sites; wire.color = new B.Color3(0.45, 0.75, 1); wire.isPickable = false;
      }
      if (body.glow) { try { for (const m of glowSet) body.glow.addIncludedOnlyMesh(m); } catch (e) { /* older layer API: glow stays global */ } }
      // camera
      body.frame(true);
      if (body.motes) { body.motes.emitter = body.center.clone(); body.motes.minEmitBox = new B.Vector3(-rad * 1.6, -rad * 1.6, -rad * 1.6); body.motes.maxEmitBox = new B.Vector3(rad * 1.6, rad * 1.6, rad * 1.6); }
      body.setLights(model);
      body.setLayer("sites", body.layers.sites !== false); body.setLayer("sticks", body.layers.sticks !== false); body.setLayer("nucleic", body.layers.nucleic !== false);
      return { center: ctr, radius: rad };
    };
    body.setLights = function (model) {
      for (const l of body.lights) l.dispose();
      body.lights = [];
      for (const l of model.lights) {
        const d = new B.DirectionalLight(l.name, new B.Vector3(l.dir[0], l.dir[1], l.dir[2]), scene);
        d.intensity = l.intensity * 0.9; d.diffuse = new B.Color3(l.color[0], l.color[1], l.color[2]); d.specular = d.diffuse; body.lights.push(d);
      }
    };
    body.frame = function (instant) {
      const to = { target: body.center.clone(), radius: Math.max(36, body.radius * 2.15), alpha: -1.0, beta: 1.15 };
      body.tween(to, instant ? 0 : 900);
      cam.lowerRadiusLimit = 5; cam.upperRadiusLimit = Math.max(300, body.radius * 8); cam.maxZ = Math.max(2000, body.radius * 30);
    };
    body.focusSite = function (tag) {
      const z = body.model.zinc.find((s) => s.tag === tag); if (!z) return;
      body.tween({ target: new B.Vector3(z.pos[0], z.pos[1], z.pos[2]), radius: 16 }, 1100);
    };
    body.focusCore = function (minPlddt) {
      const m = body.model.meta; if (!m.plddt) return body.frame(false);
      let c = [0, 0, 0], n = 0; for (let i = 0; i < m.plddt.length; i++) if (m.plddt[i] >= minPlddt) { c[0] += m.ca[i * 3]; c[1] += m.ca[i * 3 + 1]; c[2] += m.ca[i * 3 + 2]; n++; }
      if (!n) return body.frame(false); c = c.map((v) => v / n); let r = 0;
      for (let i = 0; i < m.plddt.length; i++) if (m.plddt[i] >= minPlddt) r = Math.max(r, Math.hypot(m.ca[i * 3] - c[0], m.ca[i * 3 + 1] - c[1], m.ca[i * 3 + 2] - c[2]));
      body.tween({ target: new B.Vector3(c[0], c[1], c[2]), radius: Math.max(30, r * 2.6) }, 1000);
    };
    body.focusResidue = function (i, radius) {
      const ca = body.model.meta.ca;
      body.tween({ target: new B.Vector3(ca[i * 3], ca[i * 3 + 1], ca[i * 3 + 2]), radius: radius || 28 }, 900);
    };
    let tw = null;
    body.tween = function (to, ms) {
      const from = { target: cam.target.clone(), radius: cam.radius, alpha: cam.alpha, beta: cam.beta };
      if (!ms) { cam.setTarget(to.target || from.target); cam.radius = to.radius ?? from.radius; cam.alpha = to.alpha ?? from.alpha; cam.beta = to.beta ?? from.beta; return; }
      const t0 = performance.now(); tw = to;
      const step = () => {
        if (tw !== to) return;
        const u = Math.min(1, (performance.now() - t0) / ms), e = u * u * (3 - 2 * u);
        if (to.target) cam.setTarget(B.Vector3.Lerp(from.target, to.target, e));
        if (to.radius !== undefined) cam.radius = from.radius + (to.radius - from.radius) * e;
        if (to.alpha !== undefined) cam.alpha = from.alpha + (to.alpha - from.alpha) * e;
        if (to.beta !== undefined) cam.beta = from.beta + (to.beta - from.beta) * e;
        if (u < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    body.setScheme = function (name) {
      const model = body.model; if (!model) return;
      const table = name === "file" ? null : residueColors(model, name);
      for (const mesh of body.meshes) {
        const md = mesh.metadata, rid = md.resid, nv = rid.length, col = md.colors;
        if (!table) col.set(md.fileColors);
        else for (let i = 0; i < nv; i++) {
          const r = rid[i] * 3;
          if (mesh.metadata.def === "LigandSticks") { col[i * 4] = md.fileColors[i * 4]; col[i * 4 + 1] = md.fileColors[i * 4 + 1]; col[i * 4 + 2] = md.fileColors[i * 4 + 2]; continue; }
          col[i * 4] = lin(table[r]); col[i * 4 + 1] = lin(table[r + 1]); col[i * 4 + 2] = lin(table[r + 2]);
        }
        md.base = col.slice();
        mesh.updateVerticesData(B.VertexBuffer.ColorKind, col);
        md.lit = [];
      }
      body.scheme = name;
    };
    /* highlights: residue index -> [r,g,b] (display colours); previous highlights are restored first */
    body.highlight = function (map) {
      for (const mesh of body.meshes) {
        const md = mesh.metadata; if (!md.base) md.base = md.colors.slice();
        const col = md.colors;
        for (const v of md.lit) { col[v * 4] = md.base[v * 4]; col[v * 4 + 1] = md.base[v * 4 + 1]; col[v * 4 + 2] = md.base[v * 4 + 2]; }
        md.lit = [];
        for (const [r, c] of map) {
          for (let k = md.start[r]; k < md.start[r + 1]; k++) { const v = md.order[k]; md.lit.push(v); col[v * 4] = lin(c[0]) * 1.3; col[v * 4 + 1] = lin(c[1]) * 1.3; col[v * 4 + 2] = lin(c[2]) * 1.3; }
        }
        mesh.updateVerticesData(B.VertexBuffer.ColorKind, col);
      }
    };
    body.setLayer = function (name, on) {
      body.layers[name] = on;
      if (name === "sites") sites.setEnabled(on);
      for (const m of body.meshes) {
        if (name === "sticks" && m.metadata.def === "LigandSticks") m.setEnabled(on);
        if (name === "nucleic" && (m.metadata.def.startsWith("Nucleic") || m.metadata.def === "BaseRungs")) m.setEnabled(on);
      }
    };
    body.setCinema = function (on) {
      body.cinema = on;
      if (body.pipeline) {
        try {
          body.pipeline.depthOfFieldEnabled = on;
          if (on) { const d = body.pipeline.depthOfField; d.focusDistance = cam.radius * 1000; d.fStop = 2.2; d.focalLength = 60; d.lensSize = 30; body.pipeline.depthOfFieldBlurLevel = B.DepthOfFieldEffectBlurLevel.Medium; body.effects.depthOfField = true; }
          body.pipeline.chromaticAberrationEnabled = on; if (on) body.pipeline.chromaticAberration.aberrationAmount = 4;
        } catch (e) { body.notes.push("depth of field skipped: " + e.message); body.effects.depthOfField = false; }
      }
    };
    scene.onBeforeRenderObservable.add(() => {
      const dt = engine.getDeltaTime() / 1000;
      if (body.cinema) {
        cam.alpha += dt * 0.12;
        if (body.pipeline && body.pipeline.depthOfFieldEnabled) body.pipeline.depthOfField.focusDistance = cam.radius * 1000;
      }
    });
    body.pick = function (x, y) {
      const p = scene.pick(x, y, (m) => m.isPickable && m.metadata && m.metadata.resid);
      if (!p || !p.hit || p.faceId < 0) return null;
      const md = p.pickedMesh.metadata, idx = p.pickedMesh.getIndices();
      return { resid: md.resid[idx[p.faceId * 3]], mesh: md.def, point: p.pickedPoint };
    };
    body.project = function (pos) {
      const w = engine.getRenderWidth(), h = engine.getRenderHeight();
      const v = B.Vector3.Project(new B.Vector3(pos[0], pos[1], pos[2]), B.Matrix.Identity(), scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
      const k = canvas.clientWidth / w;
      return { x: v.x * k, y: v.y * k, z: v.z, visible: v.z > 0 && v.z < 1 };
    };
    body.arc = function (a, b, color) {
      if (body.arcMesh) { body.arcMesh.dispose(); body.arcMesh = null; }
      if (!a || !b) return;
      const A = new B.Vector3(...a), Bv = new B.Vector3(...b), mid = A.add(Bv).scale(0.5), out = mid.subtract(body.center);
      const lift = Math.max(6, B.Vector3.Distance(A, Bv) * 0.35), c = mid.add(out.length() > 1e-3 ? out.normalize().scale(lift) : new B.Vector3(0, lift, 0));
      const pts = []; for (let i = 0; i <= 32; i++) { const t = i / 32; pts.push(A.scale((1 - t) * (1 - t)).add(c.scale(2 * t * (1 - t))).add(Bv.scale(t * t))); }
      const tube = B.MeshBuilder.CreateTube("paearc", { path: pts, radius: 0.22, tessellation: 8 }, scene);
      const m = new B.StandardMaterial("arc", scene); m.emissiveColor = new B.Color3(...color); m.disableLighting = true; tube.material = m; tube.isPickable = false; tube.parent = root3;
      body.arcMesh = tube;
      if (body.glow) { try { body.glow.addIncludedOnlyMesh(tube); } catch (e) { /* global glow */ } }
    };
    body.screenshot = function () { return new Promise((res) => { scene.onAfterRenderObservable.addOnce(() => canvas.toBlob(res, "image/png")); scene.render(); }); };
    body.info = function () {
      const gl = engine.getGlInfo ? engine.getGlInfo() : {};
      return { backend, renderer: gl.renderer || (root.__adapter && root.__adapter.info ? [root.__adapter.info.vendor, root.__adapter.info.architecture].filter(Boolean).join(" ") : ""), vendor: gl.vendor || "",
        adapterVia: root.__adapterVia || "", babylon: B.Engine.Version, effects: body.effects, notes: body.notes };
    };
    engine.runRenderLoop(() => scene.render());
    root.addEventListener("resize", () => engine.resize());
    return body;
  }
  root.XMolBody = { create, residueColors, PL, CHAIN };
})(typeof window !== "undefined" ? window : globalThis);
