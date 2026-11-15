/* ComposedShader for the three.js bridge. X_ITE 16.6.0 compiles the ShaderPart sources as they are (GLSL ES 3.00 in WebGL2; the author writes #version 300 es), adding the defines X3D_VERTEX_SHADER or
   X3D_FRAGMENT_SHADER, X_ITE and x3d_MaxLights, and feeds the built-in attributes and uniforms by name. THREE.RawShaderMaterial does the same thing: the source goes to WebGL2 untouched, so a shader
   that runs in X_ITE runs here. Built in: attributes x3d_Vertex, x3d_Normal, x3d_Color, x3d_TexCoord0 (aliases of the geometry's own attributes, widened by WebGL to vec4 with w = 1), uniforms
   x3d_ModelViewMatrix, x3d_ProjectionMatrix, x3d_NormalMatrix, x3d_ViewMatrix, x3d_CameraSpaceMatrix, x3d_ModelMatrix (set per mesh before every draw) and one uniform per field of the node under the
   field's name. Not built in: the x3d_ light, fog, material and texture structs, textures as fields (SFNode fields are not read), ShaderPart urls that need a fetch (data: and inline text only), the
   geometry, tessellation and compute stages, vertex attributes (FloatVertexAttribute). A source that does not compile is dropped and the Shape is drawn with its Material (isValid stays FALSE). */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
R.bridge.three.shader = {
  UNI: {   // field type -> a function from the reader's value to a uniform value
    SFFloat: (v) => v, SFDouble: (v) => v, SFTime: (v) => v, SFInt32: (v) => v | 0, SFBool: (v) => !!v,
    SFVec2f: (v) => new THREE.Vector2(...v), SFVec2d: (v) => new THREE.Vector2(...v), SFVec3f: (v) => new THREE.Vector3(...v), SFVec3d: (v) => new THREE.Vector3(...v), SFColor: (v) => new THREE.Vector3(...v),
    SFVec4f: (v) => new THREE.Vector4(...v), SFVec4d: (v) => new THREE.Vector4(...v), SFColorRGBA: (v) => new THREE.Vector4(...v), SFRotation: (v) => new THREE.Vector4(...v),
    SFMatrix3f: (v) => { const m = new THREE.Matrix3(); m.elements = v.slice(0, 9); return m; }, SFMatrix4f: (v) => { const m = new THREE.Matrix4(); m.elements = v.slice(0, 16); return m; },
    MFFloat: (v) => v.slice(), MFInt32: (v) => v.slice(), MFBool: (v) => v.map((x) => (x ? 1 : 0)),
    MFVec2f: (v) => v.map((a) => new THREE.Vector2(...a)), MFVec3f: (v) => v.map((a) => new THREE.Vector3(...a)), MFColor: (v) => v.map((a) => new THREE.Vector3(...a)), MFVec4f: (v) => v.map((a) => new THREE.Vector4(...a)),
  },
  source(part) {   // the text of a ShaderPart: inline text or a data: url (a url that is a file name would need a fetch)
    const u = (part.f.url || [])[0]; if (u == null) return null; let t = String(u);
    const m = /^data:[^,]*,/.exec(t); if (m) { const head = m[0]; t = t.slice(head.length); if (/;base64/.test(head)) t = atob(t); else { try { t = decodeURIComponent(t); } catch (e) { /* as is */ } } return t; }
    return /\n|void\s+main/.test(t) ? t : null;
  },
  withDefines(src, type) {   // X_ITE puts its defines after the #version line, as the first thing the source says
    const d = '#define X3D_' + type + '_SHADER\n#define X_ITE\n#define x3d_MaxLights 8\n', m = /^((?:\s|\/\*[\s\S]*?\*\/|\/\/.*\n)*#version[^\n]*\n)/.exec(src);
    return m ? m[1] + d + src.slice(m[1].length) : d + src;
  },
  compiles(body, vs, fs) {   // a throw-away compile on the renderer's context: three.js would only log a failure
    const gl = body.renderer.getContext(); let ok = true, log = '';
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { ok = false; log += gl.getShaderInfoLog(sh) + ' '; } gl.deleteShader(sh); }
    return { ok, log: log.trim() };
  },
  /* -> a RawShaderMaterial for the node, or null (and a note) */
  make(body, cs, side) {
    const S = R.bridge.three.shader, parts = cs.f.parts || [], by = {};
    for (const p of parts) { const t = String(p.f.type || 'VERTEX').toUpperCase(), src = S.source(p); if (src != null && !by[t]) by[t] = src; }
    if (!by.VERTEX || !by.FRAGMENT) { body.note('ComposedShader ' + (cs.def || '') + ': a vertex and a fragment part with the source in the node or a data: url are needed; drawn with its Material'); return null; }
    const vs = S.withDefines(by.VERTEX, 'VERTEX'), fs = S.withDefines(by.FRAGMENT, 'FRAGMENT'), c = S.compiles(body, vs, fs);
    if (!c.ok) { body.note('ComposedShader ' + (cs.def || '') + ' did not compile: ' + c.log); return null; }
    const u = { x3d_ModelViewMatrix: { value: new THREE.Matrix4() }, x3d_ProjectionMatrix: { value: new THREE.Matrix4() }, x3d_NormalMatrix: { value: new THREE.Matrix3() }, x3d_ViewMatrix: { value: new THREE.Matrix4() }, x3d_CameraSpaceMatrix: { value: new THREE.Matrix4() }, x3d_ModelMatrix: { value: new THREE.Matrix4() } };
    // three.js puts its own #define lines first, which a #version line may not follow: for an ES 3.00 source it writes the #version line itself (glslVersion) and the source's own is taken out
    const v3 = /^\s*#version\s+300\s+es\s*$/m, es3 = v3.test(vs) && v3.test(fs), cut = (x) => (es3 ? x.replace(v3, '') : x);
    const m = new THREE.RawShaderMaterial({ vertexShader: cut(vs), fragmentShader: cut(fs), uniforms: u, side, glslVersion: es3 ? THREE.GLSL3 : null }); m.userData.x3dShader = cs;
    S.setFields(cs, u);
    return m;
  },
  setFields(cs, u, only) {
    const S = R.bridge.three.shader, base = new Set(['language', 'parts', 'activate', 'isSelected', 'isValid', 'metadata']);
    for (const [k, d] of Object.entries(cs.fdefs || {})) {
      if (base.has(k) || (only && only !== k)) continue; const fn = S.UNI[d[0]]; if (!fn || cs.f[k] == null) continue;
      try { const v = fn(cs.f[k]); if (u[k]) u[k].value = v; else u[k] = { value: v }; } catch (e) { /* a field the table cannot carry */ }
    }
  },
  /* the geometry's attributes under the names X_ITE gives them */
  alias(geo) {
    const a = geo.attributes, set = (n, s) => { if (a[s] && a[n] !== a[s]) geo.setAttribute(n, a[s]); };
    set('x3d_Vertex', 'position'); set('x3d_Normal', 'normal'); set('x3d_Color', 'color'); set('x3d_TexCoord0', 'uv');
  },
  beforeRender(mesh, cam) {   // the matrices of this mesh for this draw
    const m = mesh.material; if (!m || !m.userData || !m.userData.x3dShader) return; const u = m.uniforms;
    u.x3d_ModelMatrix.value.copy(mesh.matrixWorld); u.x3d_ViewMatrix.value.copy(cam.matrixWorldInverse); u.x3d_CameraSpaceMatrix.value.copy(cam.matrixWorld);
    u.x3d_ModelViewMatrix.value.multiplyMatrices(cam.matrixWorldInverse, mesh.matrixWorld); u.x3d_ProjectionMatrix.value.copy(cam.projectionMatrix); u.x3d_NormalMatrix.value.getNormalMatrix(u.x3d_ModelViewMatrix.value);
  },
  /* the events X_ITE raises when the node has been compiled and chosen: isValid, then isSelected */
  announce(cs, ok) { if (cs._announced === ok) return; cs._announced = ok; for (const f of ['isValid', 'isSelected']) { cs.f[f] = ok; R.events.emit(cs, f, ok); } },
};
R.bridge.three.changed.ComposedShader = (body, n, field) => {
  const S = R.bridge.three.shader;
  if (field === 'activate') { if (n.f.activate) { for (const m of body.meshesOf.get(n.id) || []) body.rebuildShape(m.userData.shape); } return; }
  for (const m of body.meshesOf.get(n.id) || []) { const mt = m.material; if (mt && mt.userData && mt.userData.x3dShader === n) S.setFields(n, mt.uniforms, field); }
};
R.bridge.three.changed.ShaderPart = (body, n, field) => { for (const cs of body.world.nodes) if (cs.type === 'ComposedShader' && (cs.f.parts || []).includes(n)) for (const m of body.meshesOf.get(cs.id) || []) body.rebuildShape(m.userData.shape); };
