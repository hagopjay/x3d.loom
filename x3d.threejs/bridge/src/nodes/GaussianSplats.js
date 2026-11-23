/* GaussianSplats (X3D 4.1, component GaussianSplats level 1) for the three.js bridge. The node's own arrays are the truth: positions (MFVec3f), scales (MFVec3f, linear metres),
   orientations (MFQuaternion x y z w), opacities (MFFloat 0..1) and sphericalHarmonicsDegree0Coef0 (MFVec3f, colour = 0.5 + 0.28209479 * coef). Higher harmonics are not drawn (a note says so).
   Two drawers: (1) Spark (sparkjs.dev, MIT) when the host page hands the module over as window.SPARK or new Body(canvas, { spark }): real sorted anisotropic splats; (2) without it, one THREE.Points
   sized from the splat scales, so the world still loads with no extra dependency. A dense companion file may be named in the node's metadata: <MetadataString name="splatFile" value='"hero.spz"'/>
   (read against the file that holds the node). With Spark present that file is drawn in place of the inline arrays, which then serve as the preview and the fallback; the X3D file stays valid 4.1.
   Colour: the bridge writes display values with colour management off (as X3D browsers do), so Spark's encodeLinear flag is pinned false; otherwise every splat colour gets pow(2.2) and the scene
   goes dark (measured on Atlas splats: 13.3 dB against the source view before the pin). */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, SH_C0 = 0.28209479177387814;
  const spark = (body) => (body.opts && body.opts.spark) || (typeof window !== 'undefined' && window.SPARK) || null;
  const metaString = (n, name) => {   // MetadataString `name` directly in the metadata field or inside a MetadataSet there
    const seen = new Set(), walk = (m) => { if (!m || seen.has(m)) return null; seen.add(m); if (Array.isArray(m)) { for (const x of m) { const v = walk(x); if (v != null) return v; } return null; }
      if (!m.f) return null; if (m.type === 'MetadataString' && m.f.name === name) { const v = m.f.value; return Array.isArray(v) ? v[0] : v; } return walk(m.f.value) ?? walk(m.f.metadata); };
    return walk(n.f.metadata);
  };
  const ensureRenderer = (body, SP) => {   // one SparkRenderer per body, colour flag pinned (see the head of this file)
    if (body._spark && body._spark.parent) return body._spark;
    const sr = new SP.SparkRenderer({ renderer: body.renderer }); let pinned = 0;
    const pin = (o) => { if (o && o.uniforms && o.uniforms.encodeLinear) { Object.defineProperty(o.uniforms.encodeLinear, 'value', { get: () => false, set() {}, configurable: true }); pinned++; } };
    pin(sr); pin(sr.material); for (const k of Object.keys(sr)) { try { pin(sr[k]); } catch (e) { /* not an object with uniforms */ } }
    if (!pinned) body.note('three.js body: GaussianSplats: Spark colour flag not found, splats may draw dark');
    body.scene.add(sr); body._spark = sr; return sr;
  };
  const drop = (body, r) => { if (r.mesh) { r.mesh.removeFromParent(); if (r.mesh.dispose) r.mesh.dispose(); if (r.mesh.geometry && r.mesh.geometry.dispose) r.mesh.geometry.dispose(); } if (r.tn) r.tn.removeFromParent(); body.splats = (body.splats || []).filter((x) => x !== r); };
  const build = (body, n, parent, chain) => {
    const f = n.f, r = { node: n, chain: [n, ...chain], kids: [] }; body.rec.set(n.id, r);
    const tn = new THREE.Group(); tn.name = 'splats-' + (n.def || n.id); parent.add(tn); r.tn = tn; if (f.visible === false) tn.visible = false;
    const P = f.positions || [], S = f.scales || [], Q = f.orientations || [], O = f.opacities || [], C = f.sphericalHarmonicsDegree0Coef0 || [], count = (P.length / 3) | 0;
    r.count = count; r.drawer = 'none';
    for (const [name, arr, w] of [['scales', S, 3], ['orientations', Q, 4], ['opacities', O, 1], ['sphericalHarmonicsDegree0Coef0', C, 3]]) if (arr.length && arr.length / w !== count) body.note('three.js body: GaussianSplats ' + (n.def || '') + ': ' + name + ' has ' + (arr.length / w) + ' entries for ' + count + ' positions');
    if (Object.keys(f).some((k) => /^sphericalHarmonicsDegree[123]/.test(k) && f[k] && f[k].length)) body.note('three.js body: GaussianSplats ' + (n.def || '') + ': harmonics above degree 0 are not drawn');
    const SP = spark(body), file = metaString(n, 'splatFile');
    const live = (x) => { let o = x.tn; while (o && o.parent) o = o.parent; return o === body.scene; };   // records of a world that was replaced hang off a root that left the scene
    body.splats = (body.splats || []).filter((x) => { if (live(x)) return true; if (x.mesh && x.mesh.dispose) { try { x.mesh.dispose(); } catch (e) { /* already gone */ } } return false; }); body.splats.push(r);
    if (SP && file) {
      let url = file; try { url = new URL(file, n.base || document.baseURI).href; } catch (e) { /* keep as written */ }
      ensureRenderer(body, SP); const mesh = new SP.SplatMesh({ url }); r.mesh = mesh; r.drawer = 'spark-file'; r.file = url; tn.add(mesh);
      r.ready = Promise.resolve(mesh.initialized).then(() => { r.fileCount = mesh.packedSplats ? mesh.packedSplats.numSplats : null; }, (e) => { body.note('three.js body: GaussianSplats: ' + file + ' did not load (' + (e && e.message || e) + '), drawing the inline arrays'); tn.remove(mesh); r.mesh = null; inline(body, r, SP, tn, P, S, Q, O, C, count); });
      return r;
    }
    inline(body, r, SP, tn, P, S, Q, O, C, count); return r;
  };
  const inline = (body, r, SP, tn, P, S, Q, O, C, count) => {
    if (!count) return;
    const col = (i) => C.length >= (i + 1) * 3 ? [0, 1, 2].map((k) => Math.min(1, Math.max(0, 0.5 + SH_C0 * C[i * 3 + k]))) : [0.5, 0.5, 0.5];
    if (SP && SP.PackedSplats) {
      ensureRenderer(body, SP); const ps = new SP.PackedSplats({ maxSplats: count }), c = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion(), k = new THREE.Color();
      for (let i = 0; i < count; i++) { c.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); S.length ? s.set(S[i * 3], S[i * 3 + 1], S[i * 3 + 2]) : s.set(0.01, 0.01, 0.01); Q.length ? q.set(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]).normalize() : q.identity(); const rgb = col(i); k.setRGB(rgb[0], rgb[1], rgb[2]); ps.pushSplat(c, s, q, O.length ? O[i] : 1, k); }
      const mesh = new SP.SplatMesh({ packedSplats: ps }); r.mesh = mesh; r.drawer = 'spark-inline'; tn.add(mesh); r.ready = Promise.resolve(mesh.initialized); return;
    }
    const g = new THREE.BufferGeometry(), cols = new Float32Array(count * 4), sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) { const rgb = col(i); cols.set([rgb[0], rgb[1], rgb[2], O.length ? O[i] : 1], i * 4); sizes[i] = S.length ? 2 * Math.cbrt(Math.abs(S[i * 3] * S[i * 3 + 1] * S[i * 3 + 2])) : 0.02; }
    g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3)); g.setAttribute('color', new THREE.BufferAttribute(cols, 4)); g.setAttribute('psize', new THREE.BufferAttribute(sizes, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { k: { value: 500 } },
      vertexShader: 'attribute vec4 color; attribute float psize; uniform float k; varying vec4 vc; void main() { vc = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(k * psize * projectionMatrix[1][1] / max(1e-4, -mv.z), 1.0, 64.0); }',
      fragmentShader: 'varying vec4 vc; void main() { vec2 d = gl_PointCoord - 0.5; float a = exp(-8.0 * dot(d, d)) * vc.a; if (a < 0.02) discard; gl_FragColor = vec4(vc.rgb, a); }' });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.onBeforeRender = (rd) => { m.uniforms.k.value = rd.getDrawingBufferSize(new THREE.Vector2()).y / 2; };
    r.mesh = pts; r.drawer = 'points'; tn.add(pts); r.ready = Promise.resolve();
    body.note('three.js body: GaussianSplats ' + (r.node.def || '') + ': drawn as points (no Spark module handed to the bridge)');
  };
  T3.build.GaussianSplats = build;
  T3.changed.GaussianSplats = (body, n, field) => {
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'visible') { r.tn.visible = n.f.visible !== false; return; }
    if (['positions', 'scales', 'orientations', 'opacities', 'sphericalHarmonicsDegree0Coef0', 'metadata'].includes(field)) { const parent = r.tn.parent, chain = r.chain.slice(1); drop(body, r); const nr = build(body, n, parent, chain); for (const pr of body.rec.values()) if (pr.kids) { const i = pr.kids.indexOf(r); if (i >= 0) pr.kids[i] = nr; } }
  };
}
