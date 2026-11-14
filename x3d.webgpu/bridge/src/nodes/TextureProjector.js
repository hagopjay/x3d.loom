/* TextureProjector (TextureProjection level 2) and TextureProjectorParallel (TextureProjectorParallel.js): a picture projected onto the lit shapes of the scene, as X_ITE 16.6.0 does it.
   Not a Babylon light: X_ITE multiplies the DIFFUSE colour of every lit shape inside the projection volume by mix(1, picture.rgb * color, picture.a * intensity), on faces that look towards the
   projector, with no shadow and no occlusion (TextureProjection component, Texture2.glsl getTextureProjectorColor). Babylon's SpotLight.projectionTexture would add light instead (a different
   result on a dark face), so the bridge adds a MaterialPluginBase to every StandardMaterial and PBRMaterial of the scene that carries the same few lines of WGSL: the world position is multiplied by
   a matrix (world -> projector -> projection -> 0..1 texture space) built here every frame with X_ITE's own recipe, the picture is read texel by texel with textureLoad (nearest, no smoothing and no mip levels, as X_ITE shows it), the result tints diffuseColor (Standard) or
   surfaceAlbedo (PBR) before the lights are summed. Up to four projectors at a time (X_ITE's maxTextures), the first four that are on.
   Matrix, as X_ITE's TextureProjectorContainer.renderShadowMap (row vector convention, Babylon's own):
       projector space -> world   = R * T(location) * parentWorld        R: rotation from +Z to -direction, straightened to upVector (Rotation4.straighten)
       M = inverse(that) * P * bias        P: Camera.perspective(fieldOfView, near, far, w, h) (the field of view is the SHORT side) or Camera.ortho (parallel)
   nearDistance / farDistance below 0 mean "default": near 0.125, far 100000, and the depth is clamped to 0..1 so nothing is cut by depth; given, the depth is clamped to -1..2 and a point outside the
   volume is cut. A point BEHIND a perspective projector with the default distances still lands inside 0..1 on the side pictures after the divide by a negative w, so X_ITE draws a mirrored copy
   there; the bridge computes the same numbers and therefore the same thing. The picture's own first row is the bottom (X3D texture coordinates); the body's texture is already that way.
   global = FALSE: only the meshes below the parent group are projected on (the same scope rule as the lights). aspectRatio is the picture's width / height, raised when the picture is known.
   An unlit Standard material (disableLighting, what a Shape with no Material becomes) is tinted whole (X_ITE tints an unlit shape's colour); a lit one only in its diffuse colour (its emissive and specular stay, as in X_ITE). Differences kept (logged in the batch): a shape drawn by a ShaderMaterial (a textured UnlitMaterial, points, lines, volumes) is not tinted. WebGPU only (the WGSL path; a WebGL
   engine draws the scene without the projection). shadows, shadowColor, shadowIntensity and shadowMapSize are stored, nothing is shadowed (X_ITE 16.6.0 does not shadow a projector either). */
BR.proj = {
  MAX: 4,
  // X_ITE Rotation4.setVectors(from, to) -> quaternion (Coin3D): shortest arc, any perpendicular axis when the two are opposed
  arc(from, to) {
    const V = BABYLON.Vector3, a = from.normalizeToNew(), b = to.normalizeToNew(), c = Math.max(-1, Math.min(1, V.Dot(a, b))), x = V.Cross(a, b), len = x.length();
    if (len === 0) {
      if (c > 0) return new BABYLON.Quaternion(0, 0, 0, 1);
      let t = V.Cross(a, new V(1, 0, 0)); if (t.lengthSquared() === 0) t = V.Cross(a, new V(0, 1, 0)); t.normalize(); return new BABYLON.Quaternion(t.x, t.y, t.z, 0);
    }
    x.normalize(); const h = Math.acos(c) / 2, s = Math.sin(h); return new BABYLON.Quaternion(x.x * s, x.y * s, x.z * s, Math.cos(h));
  },
  // X_ITE Rotation4.straighten(upVector): turn the rotation about its own Z axis until the local X axis is Z x up
  straighten(q, up) {
    const V = BABYLON.Vector3, upN = up.normalizeToNew(), lx = new V(-1, 0, 0).rotateByQuaternionToRef(q, new V()), lz = new V(0, 0, 1).rotateByQuaternionToRef(q, new V());
    if (Math.abs(V.Dot(lz, upN)) >= 1) return q;
    const nx = V.Cross(lz, upN).normalize();
    if (V.Dot(nx, lx) <= -1) return BABYLON.Quaternion.RotationAxis(new V(0, 0, 1), Math.PI).multiply(q);   // turned about the local Z first, then the rotation
    return q.multiply(BR.proj.arc(lx, nx));                                                                    // the rotation first, then the turn that brings the X axis to Z x up
  },
  frustum(l, r, b, t, n, f) {
    const rl = r - l, tb = t - b, fn = f - n;
    return BABYLON.Matrix.FromValues(2 * n / rl, 0, 0, 0, 0, 2 * n / tb, 0, 0, (r + l) / rl, (t + b) / tb, -(f + n) / fn, -1, 0, 0, -2 * n * f / fn, 0);
  },
  perspective(fov, n, f, w, h) {
    const ratio = Math.tan(fov / 2) * n;
    return w > h ? BR.proj.frustum(-w * ratio / h, w * ratio / h, -ratio, ratio, n, f) : BR.proj.frustum(-ratio, ratio, -h * ratio / w, h * ratio / w, n, f);
  },
  ortho(l, r, b, t, n, f) {
    const rl = r - l, tb = t - b, fn = f - n;
    return BABYLON.Matrix.FromValues(2 / rl, 0, 0, 0, 0, 2 / tb, 0, 0, 0, 0, -2 / fn, 0, -(r + l) / rl, -(t + b) / tb, -(f + n) / fn, 1);
  },
  BIAS: () => BABYLON.Matrix.FromValues(0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1),
  // the size of the picture in pixels; 0 x 0 until it is known
  size(body, n) {
    const t = n.f.texture; if (!t) return null;
    if (t.type === 'PixelTexture') { const im = t.f.image || [0, 0, 0]; return im[0] > 0 && im[1] > 0 ? { width: im[0], height: im[1] } : null; }
    const bt = body.tex(t); if (!bt || !bt.isReady || !bt.isReady()) return null;
    const s = bt.getSize(); return s.width > 0 && s.height > 0 ? s : null;
  },
  // one projector's data for this frame: the matrix, the colour and intensity, the location in world space, the depth clamp
  frame(body, n, parent) {
    const f = n.f, sz = BR.proj.size(body, n), bt = f.texture ? body.tex(f.texture) : null;
    if (!sz || !bt || f.on === false) return null;
    const V = BABYLON.Vector3, model = parent ? parent.computeWorldMatrix(true) : BABYLON.Matrix.Identity();
    let q = BR.proj.arc(new V(0, 0, 1), new V(-f.direction[0], -f.direction[1], -f.direction[2]));
    q = BR.proj.straighten(q, new V(f.upVector[0], f.upVector[1], f.upVector[2]));
    const t2w = BABYLON.Matrix.FromQuaternionToRef(q, new BABYLON.Matrix()).multiply(BABYLON.Matrix.Translation(f.location[0], f.location[1], f.location[2])).multiply(model);
    const nearGiven = f.nearDistance >= 0, farGiven = f.farDistance >= 0, near = nearGiven ? f.nearDistance : 0.125, far = farGiven ? f.farDistance : 100000;
    const P = n.type === 'TextureProjector' ? BR.proj.perspective(f.fieldOfView > 0 && f.fieldOfView < Math.PI ? f.fieldOfView : Math.PI / 4, near, far, sz.width, sz.height) : BR.proj.parallel(n, near, far, sz);
    const M = BABYLON.Matrix.Invert(t2w).multiply(P).multiply(BR.proj.BIAS()), loc = V.TransformCoordinates(new V(f.location[0], f.location[1], f.location[2]), model);
    return { n, tex: bt, M, color: f.color, intensity: f.intensity, loc, params: [nearGiven ? -1 : 0, farGiven ? 2 : 1], parent, global: f.global !== false };
  },
  parallel(n, near, far, sz) {
    const fv = n.f.fieldOfView, minX = fv[0], minY = fv[1], maxX = fv[2], maxY = fv[3], sizeX = maxX - minX, sizeY = maxY - minY, ratio = sz.width / sz.height;
    if (ratio > sizeX / sizeY) { const c = (minX + maxX) / 2, h = sizeY * ratio / 2; return BR.proj.ortho(c - h, c + h, minY, maxY, near, far); }
    const c = (minY + maxY) / 2, h = sizeX / ratio / 2; return BR.proj.ortho(minX, maxX, c - h, c + h, near, far);
  },
  aspect(body, n) {
    const sz = BR.proj.size(body, n), a = sz ? sz.width / sz.height : 1;
    if (n.f.aspectRatio !== a) BR.emit(n, 'aspectRatio', a);
    return !!sz;
  },
  /* one MaterialPluginBase per Standard / PBR material of a world that has a projector (the code is a no-op until a projector is on: its defines X3D_PROJ_n stay off) */
  plugin(body) {
    if (BR.proj._cls) return BR.proj._cls;
    const WG = (i) => `var projTex${i}Sampler: sampler; var projTex${i}: texture_2d<f32>;`;
    const DEF = `
fn x3dProjUV(M: mat4x4f, P: vec4f, L: vec4f, pos: vec3f, N: vec3f) -> vec4f {
  var tc: vec4f = M * vec4f(pos, 1.0);
  var stp: vec3f = tc.xyz / tc.w;
  stp.z = clamp(stp.z, P.x, P.y);
  if (any(abs(stp - vec3f(0.5)) > vec3f(0.5))) { return vec4f(0.0); }
  if (dot(N, L.xyz - pos) < 0.0) { return vec4f(0.0); }
  return vec4f(stp.x, stp.y, L.w, 0.0);
}`;
    const USE = (i) => `
#ifdef X3D_PROJ_${i + 1}
{ let r${i} = x3dProjUV(uniforms.projM${i}, uniforms.projP${i}, uniforms.projL${i}, fragmentInputs.vPositionW, normalW);
  if (r${i}.z > 0.5) { let d${i} = vec2f(textureDimensions(projTex${i})); let T${i} = textureLoad(projTex${i}, vec2i(clamp(floor(r${i}.xy * d${i}), vec2f(0.0), d${i} - vec2f(1.0))), 0); x3dTint = x3dTint * mix(vec3f(1.0), T${i}.rgb * uniforms.projC${i}.rgb, T${i}.a * uniforms.projC${i}.a); } }
#endif`;
    const TINT = '\nvar x3dTint: vec3f = vec3f(1.0);' + [0, 1, 2, 3].map(USE).join('');
    class P extends BABYLON.MaterialPluginBase {
      constructor(material) { super(material, 'X3DTextureProjector', 190, { X3D_PROJ_1: false, X3D_PROJ_2: false, X3D_PROJ_3: false, X3D_PROJ_4: false, X3D_PROJ_UNLIT: false }); this.body = null; this._enable(true); }
      getClassName() { return 'X3DTextureProjectorPlugin'; }
      isCompatible(lang) { return lang === BABYLON.ShaderLanguage.WGSL; }
      get state() { return this.body && this.body._projState; }
      prepareDefines(defines) { defines.X3D_PROJ_UNLIT = !!this._material.disableLighting; const k = this.state ? this.state.list.length : 0; for (let i = 1; i <= 4; i++) defines['X3D_PROJ_' + i] = i <= k; }
      isReadyForSubMesh() { const s = this.state; return !s || s.list.every((p) => p.tex.isReady()); }
      getSamplers(samplers) { for (let i = 0; i < 4; i++) samplers.push('projTex' + i); }
      getUniforms() { return { ubo: [0, 1, 2, 3].flatMap((i) => [{ name: 'projM' + i, size: 16, type: 'mat4' }, { name: 'projC' + i, size: 4, type: 'vec4' }, { name: 'projL' + i, size: 4, type: 'vec4' }, { name: 'projP' + i, size: 4, type: 'vec4' }]) }; }
      hasTexture(t) { const s = this.state; return !!s && s.list.some((p) => p.tex === t); }
      getActiveTextures(a) { const s = this.state; if (s) for (const p of s.list) a.push(p.tex); return a; }
      bindForSubMesh(ub, scene, engine, subMesh) {
        const s = this.state; if (!s) return;
        const meshes = this._material.getBindedMeshes ? this._material.getBindedMeshes() : [];
        s.list.forEach((p, i) => {
          let inScope = p.global; if (!inScope) inScope = meshes.some((m) => { for (let a = m.parent; a; a = a.parent) if (a === p.parent) return true; return false; });
          ub.updateMatrix('projM' + i, p.M); ub.updateFloat4('projC' + i, p.color[0], p.color[1], p.color[2], p.intensity);
          ub.updateFloat4('projL' + i, p.loc.x, p.loc.y, p.loc.z, inScope ? 1 : 0); ub.updateFloat4('projP' + i, p.params[0], p.params[1], 0, 0); ub.setTexture('projTex' + i, p.tex);
        });
      }
      getCustomCode(shaderType, lang) {
        if (shaderType !== 'fragment' || lang !== BABYLON.ShaderLanguage.WGSL) return null;
        const std = this._material instanceof BABYLON.StandardMaterial;
        const decl = [0, 1, 2, 3].map((i) => `#ifdef X3D_PROJ_${i + 1}\n${WG(i)}\n#endif`).join('\n');
        return { CUSTOM_FRAGMENT_DEFINITIONS: decl + DEF,
          [std ? 'CUSTOM_FRAGMENT_UPDATE_DIFFUSE' : 'CUSTOM_FRAGMENT_BEFORE_LIGHTS']: TINT + (std ? '\n#ifdef X3D_PROJ_UNLIT\nbaseColor = vec4f(baseColor.rgb * x3dTint, baseColor.a);\n#else\ndiffuseColor = diffuseColor * x3dTint;\n#endif' : '\nsurfaceAlbedo = surfaceAlbedo * x3dTint;') };
      }
    }
    return (BR.proj._cls = P);
  },
  /* once per body: the per-frame pass (matrices for the projectors that are on, a plugin for every material the scene has made since) */
  start(body) {
    if (body._projObs) return; body._projState = { list: [], key: '' }; body._projectors = body._projectors || [];
    const sc = body.scene, P = BR.proj.plugin(body);
    body._projObs = sc.onBeforeRenderObservable.add(() => {
      for (const m of sc.materials) if (!m._x3dProj && (m instanceof BABYLON.StandardMaterial || m instanceof BABYLON.PBRMaterial) && m.shaderLanguage === BABYLON.ShaderLanguage.WGSL) { const pl = new P(m); pl.body = body; m._x3dProj = pl; }
      const list = []; for (const r of body._projectors) { if (list.length >= BR.proj.MAX) break; BR.proj.aspect(body, r.n); const fr = BR.proj.frame(body, r.n, r.parent); if (fr) list.push(fr); }
      const key = list.map((p) => p.n.id).join(','), was = body._projState.list.length;
      body._projState = { list, key }; for (const m of sc.materials) if (m._x3dProj) m._x3dProj.body = body;
      if (list.length !== was || key !== body._projKey) { body._projKey = key; sc.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_MiscDirtyFlag | BABYLON.Constants.MATERIAL_TextureDirtyFlag); }
    });
  },
  add(body, n, parent) { BR.proj.start(body); (body._projectors ||= []).push({ n, parent }); BR.proj.aspect(body, n); },
  remove(body, n) { if (body._projectors) body._projectors = body._projectors.filter((r) => r.n !== n); },
};
BR.node('TextureProjector', {
  component: 'TextureProjection', level: 2,
  container: 'children',
  defs: {
    ambientIntensity: ['SFFloat', IO, 0],
    aspectRatio: ['SFFloat', OUT, 0],
    color: ['SFColor', IO, [1, 1, 1]],
    description: ['SFString', IO, ""],
    direction: ['SFVec3f', IO, [0, 0, 1]],
    farDistance: ['SFFloat', IO, -1],
    fieldOfView: ['SFFloat', IO, 0.7854],
    global: ['SFBool', IO, true],
    intensity: ['SFFloat', IO, 1],
    location: ['SFVec3f', IO, [0, 0, 0]],
    metadata: ['SFNode', IO, null],
    nearDistance: ['SFFloat', IO, -1],
    on: ['SFBool', IO, true],
    shadowIntensity: ['SFFloat', IO, 1],
    shadows: ['SFBool', IO, false],
    texture: ['SFNode', IO, null],
    upVector: ['SFVec3f', IO, [0, 1, 0]],
  },
  build(body, n, parent) { BR.proj.add(body, n, parent); return null; },
  changed(body, n, field) { if (field === 'texture') BR.proj.aspect(body, n); },
  dispose(body, n) { BR.proj.remove(body, n); },
});
