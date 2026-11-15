/* TextureProjector and TextureProjectorParallel (TextureProjection level 2) for the three.js bridge, as X_ITE 16.6.0 draws them (the rules are written in x3d.webgpu/bridge/src/nodes/TextureProjector.js):
   not a light. The DIFFUSE colour of every lit mesh inside the projection volume is multiplied by mix(1, picture.rgb * color, picture.a * intensity), on faces that look towards the projector, no shadow,
   no occlusion; an unlit mesh is tinted whole. Every mesh material the body makes carries a few lines of GLSL (onBeforeCompile) that read up to four projectors from shared uniforms; the picture is read
   texel by texel (nearest, no mip level, as X_ITE shows it). The matrix is X_ITE's own recipe (TextureProjectorContainer.renderShadowMap), written in three.js' column convention:
       M = BIAS * P * inverse( parentWorld * T(location) * R )      R: +Z to -direction, straightened to upVector (Rotation4.straighten); P: perspective (field of view on the SHORT side) or ortho.
   nearDistance / farDistance below 0 mean "default" (near 0.125, far 100000, depth clamped to 0..1); given, depth is clamped to -1..2 and a point outside the volume is cut. global = FALSE: only the meshes
   below the projector's parent group are projected on (a per-mesh bit mask set in onBeforeRender). Shapes drawn by a ShaderMaterial (a shader, volume) are not tinted. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, BR = R.bridge, MAX = 4;
  const arc = (from, to) => { const q = new THREE.Quaternion(), a = from.clone().normalize(), b = to.clone().normalize(), c = Math.max(-1, Math.min(1, a.dot(b))), x = new THREE.Vector3().crossVectors(a, b), len = x.length();
    if (len === 0) { if (c > 0) return q; const t = new THREE.Vector3().crossVectors(a, new THREE.Vector3(1, 0, 0)); if (t.lengthSq() === 0) t.crossVectors(a, new THREE.Vector3(0, 1, 0)); t.normalize(); return q.set(t.x, t.y, t.z, 0); }
    x.normalize(); const h = Math.acos(c) / 2, s = Math.sin(h); return q.set(x.x * s, x.y * s, x.z * s, Math.cos(h)); };
  const straighten = (q, up) => { const V = THREE.Vector3, upN = up.clone().normalize(), lx = new V(-1, 0, 0).applyQuaternion(q), lz = new V(0, 0, 1).applyQuaternion(q);
    if (Math.abs(lz.dot(upN)) >= 1) return q;
    const nx = new V().crossVectors(lz, upN).normalize();
    if (nx.dot(lx) <= -1) return q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), Math.PI));   // Babylon's "turn about local Z first, then the rotation"
    return arc(lx, nx).multiply(q); };                                                                                    // "the rotation first, then the turn that brings the X axis to Z x up"
  // X_ITE's matrices, as lists of 16 numbers that were row-major with row vectors: read as column-major they are the same transformation for column vectors
  const M4 = (v) => new THREE.Matrix4().fromArray(v);
  const frustum = (l, r, b, t, n, f) => { const rl = r - l, tb = t - b, fn = f - n; return M4([2 * n / rl, 0, 0, 0, 0, 2 * n / tb, 0, 0, (r + l) / rl, (t + b) / tb, -(f + n) / fn, -1, 0, 0, -2 * n * f / fn, 0]); };
  const perspective = (fov, n, f, w, h) => { const ratio = Math.tan(fov / 2) * n; return w > h ? frustum(-w * ratio / h, w * ratio / h, -ratio, ratio, n, f) : frustum(-ratio, ratio, -h * ratio / w, h * ratio / w, n, f); };
  const ortho = (l, r, b, t, n, f) => { const rl = r - l, tb = t - b, fn = f - n; return M4([2 / rl, 0, 0, 0, 0, 2 / tb, 0, 0, 0, 0, -2 / fn, 0, -(r + l) / rl, -(t + b) / tb, -(f + n) / fn, 1]); };
  const parallel = (n, near, far, sz) => { const fv = n.f.fieldOfView, sizeX = fv[2] - fv[0], sizeY = fv[3] - fv[1], ratio = sz.width / sz.height;
    if (ratio > sizeX / sizeY) { const c = (fv[0] + fv[2]) / 2, h = sizeY * ratio / 2; return ortho(c - h, c + h, fv[1], fv[3], near, far); }
    const c = (fv[1] + fv[3]) / 2, h = sizeX / ratio / 2; return ortho(fv[0], fv[2], c - h, c + h, near, far); };
  const BIAS = () => M4([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]);
  const size = (body, n) => { const t = n.f.texture && body.tex(n.f.texture), im = t && t.image; return im && im.width > 0 && im.height > 0 ? { width: im.width, height: im.height } : null; };

  const uniforms = (body) => {
    if (body._pjU) return body._pjU;
    const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); dummy.needsUpdate = true;
    const arr = (k) => Array.from({ length: MAX }, k), U = body._pjU = { pjM: { value: arr(() => new THREE.Matrix4()) }, pjC: { value: arr(() => new THREE.Vector4(1, 1, 1, 0)) }, pjL: { value: arr(() => new THREE.Vector4()) },
      pjP: { value: arr(() => new THREE.Vector2(0, 1)) }, pjCount: { value: 0 }, pjS: { value: 15 } };
    for (let i = 0; i < MAX; i++) U['pjT' + i] = { value: dummy };
    return U;
  };
  const FRAG = `uniform mat4 pjM[4]; uniform vec4 pjC[4]; uniform vec4 pjL[4]; uniform vec2 pjP[4]; uniform int pjCount; uniform int pjS; uniform sampler2D pjT0; uniform sampler2D pjT1; uniform sampler2D pjT2; uniform sampler2D pjT3;
varying vec3 vPjW; varying vec3 vPjN;
vec3 pjOne( sampler2D tx, int i, vec3 N ) {
  vec4 tc = pjM[ i ] * vec4( vPjW, 1.0 ); vec3 s = tc.xyz / tc.w; s.z = clamp( s.z, pjP[ i ].x, pjP[ i ].y );
  if ( any( greaterThan( abs( s - vec3( 0.5 ) ), vec3( 0.5 ) ) ) ) return vec3( 1.0 );
  if ( dot( N, pjL[ i ].xyz - vPjW ) < 0.0 ) return vec3( 1.0 );
  vec2 d = vec2( textureSize( tx, 0 ) ); vec2 uv = ( floor( clamp( s.xy * d, vec2( 0.0 ), d - 1.0 ) ) + 0.5 ) / d; vec4 T = textureLod( tx, uv, 0.0 );
  return mix( vec3( 1.0 ), T.rgb * pjC[ i ].rgb, T.a * pjC[ i ].a );
}`;
  const USE = `{ vec3 pjN = normalize( vPjN ); if ( ! gl_FrontFacing ) pjN = - pjN; vec3 pjT = vec3( 1.0 );
 if ( pjCount > 0 && ( pjS & 1 ) != 0 ) pjT *= pjOne( pjT0, 0, pjN );
 if ( pjCount > 1 && ( pjS & 2 ) != 0 ) pjT *= pjOne( pjT1, 1, pjN );
 if ( pjCount > 2 && ( pjS & 4 ) != 0 ) pjT *= pjOne( pjT2, 2, pjN );
 if ( pjCount > 3 && ( pjS & 8 ) != 0 ) pjT *= pjOne( pjT3, 3, pjN );
 diffuseColor.rgb *= pjT; }`;
  // called by makeMaterial for every mesh material (the code does nothing while no projector is on)
  const patch = (body, m) => {
    const U = uniforms(body); m.userData.pj = true;
    body.patchMaterial(m, 'proj', (sh) => {
      for (const k of Object.keys(U)) sh.uniforms[k] = U[k];
      sh.vertexShader = 'varying vec3 vPjW; varying vec3 vPjN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPjW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vPjN = mat3( modelMatrix ) * normal;');
      sh.fragmentShader = FRAG + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + USE);
    });
  };
  const frame = (body, r) => {
    const n = r.node, f = n.f, sz = size(body, n); if (!sz || f.on === false) return null;
    const V = THREE.Vector3; r.tn.updateWorldMatrix(true, false);
    const q = straighten(arc(new V(0, 0, 1), new V(-f.direction[0], -f.direction[1], -f.direction[2])), new V(f.upVector[0], f.upVector[1], f.upVector[2]));
    const t2w = r.tn.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(f.location[0], f.location[1], f.location[2])).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
    const nearGiven = f.nearDistance >= 0, farGiven = f.farDistance >= 0, near = nearGiven ? f.nearDistance : 0.125, far = farGiven ? f.farDistance : 100000;
    const P = n.type === 'TextureProjector' ? perspective(f.fieldOfView > 0 && f.fieldOfView < Math.PI ? f.fieldOfView : Math.PI / 4, near, far, sz.width, sz.height) : parallel(n, near, far, sz);
    return { r, tex: body.tex(f.texture), M: BIAS().multiply(P).multiply(t2w.clone().invert()), loc: new V(f.location[0], f.location[1], f.location[2]).applyMatrix4(r.tn.matrixWorld), near: nearGiven, far: farGiven };
  };
  const aspect = (body, n) => { const sz = size(body, n), a = sz ? sz.width / sz.height : 1; if (n.f.aspectRatio !== a) BR.emit(n, 'aspectRatio', a); };
  const update = (body) => {
    const U = body._pjU; if (!U) return;
    body.projs = (body.projs || []).filter((r) => !r.dead && r.tn.parent);
    const list = []; for (const r of body.projs) { if (list.length >= MAX) break; aspect(body, r.node); const fr = frame(body, r); if (fr) list.push(fr); }
    U.pjCount.value = list.length;
    list.forEach((p, i) => { const f = p.r.node.f; U.pjM.value[i].copy(p.M); U.pjC.value[i].set(f.color[0], f.color[1], f.color[2], f.intensity); U.pjL.value[i].set(p.loc.x, p.loc.y, p.loc.z, 1); U.pjP.value[i].set(p.near ? -1 : 0, p.far ? 2 : 1); U['pjT' + i].value = p.tex; });
    U.pjS.value = 15; const scoped = list.some((p) => p.r.node.f.global === false);
    if (scoped || body._pjScoped) {   // a mask per mesh: the projectors whose scope holds it (the hook reads it only while one is scoped)
      body._pjScoped = scoped;
      body.scene.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.userData || !o.material.userData.pj) return;
        let mask = 0; list.forEach((p, i) => { let ok = p.r.node.f.global !== false; if (!ok) for (let a = o.parent; a; a = a.parent) if (a === p.r.tn.parent) { ok = true; break; } if (ok) mask |= 1 << i; });
        o.userData.pjMask = mask;
        if (!o.userData.pjHook) { o.userData.pjHook = true; const prev = o.onBeforeRender; o.onBeforeRender = function (...a) { U.pjS.value = body._pjScoped && this.userData.pjMask !== undefined ? this.userData.pjMask : 15; if (a[4]) a[4].uniformsNeedUpdate = true; if (prev) prev.apply(this, a); }; }
      });
    }
  };
  T3.proj = { patch, update, size };
  const build = (body, n, parent, chain) => {
    const r = { node: n, chain: [n, ...chain], kids: [] }; body.rec.set(n.id, r);
    r.tn = new THREE.Group(); r.tn.name = 'proj-' + (n.def || n.id); parent.add(r.tn); uniforms(body); (body.projs ||= []).push(r); aspect(body, n); return r;
  };
  const changed = (body, n, field) => { if (field === 'texture') aspect(body, n); };
  T3.build.TextureProjector = T3.build.TextureProjectorParallel = build;
  T3.changed.TextureProjector = T3.changed.TextureProjectorParallel = changed;
}
