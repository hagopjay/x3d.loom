R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
/* TextureProperties for the three.js bridge. The Babylon bridge gets it from the Drift reader extension (demo/src/drift/drift-ext.js), which the three.js bundle does not load, so the node is defined here
   with all the fields of 19775-1 18.4.3, and ImageTexture / PixelTexture / MovieTexture get the textureProperties child. */
{
  Object.assign(R.DEFS, {
    TextureProperties: {
      anisotropicDegree: ['SFFloat', IO, 1], borderColor: ['SFColorRGBA', IO, [0, 0, 0, 0]], borderWidth: ['SFInt32', IO, 0], boundaryModeS: ['SFString', IO, 'REPEAT'], boundaryModeT: ['SFString', IO, 'REPEAT'], boundaryModeR: ['SFString', IO, 'REPEAT'],
      generateMipMaps: ['SFBool', IO, false], magnificationFilter: ['SFString', IO, 'FASTEST'], minificationFilter: ['SFString', IO, 'FASTEST'], textureCompression: ['SFString', IO, 'FASTEST'], texturePriority: ['SFFloat', IO, 0], metadata: ['SFNode', IO, null],
    },
  });
  R.CONTAINER.TextureProperties = 'textureProperties';
  for (const t of ['ImageTexture', 'PixelTexture', 'MovieTexture']) if (R.DEFS[t] && !R.DEFS[t].textureProperties) R.DEFS[t].textureProperties = ['SFNode', IO, null];
}

/* TextureCoordinateGenerator (19775-1 18.4.7), the formulas of the Babylon bridge's body-br.js (which the three.js bundle does not load) on three.js buffers. The object-space modes (COORD, SPHERE-LOCAL,
   SPHERE-REFLECT-LOCAL, NOISE) are made once when the geometry is built; the camera-space modes (SPHERE, CAMERASPACENORMAL, CAMERASPACEPOSITION, CAMERASPACEREFLECTIONVECTOR, COORD-EYE, SPHERE-REFLECT, NOISE-EYE)
   from the model-view matrix before each frame in which the camera or the mesh moved (Body.updateView). s and t are used for a 2D texture. */
R.bridge.three.tcg = {
  CAM: /^(SPHERE|CAMERASPACENORMAL|CAMERASPACEPOSITION|CAMERASPACEREFLECTIONVECTOR|COORD-EYE|SPHERE-REFLECT|NOISE-EYE)$/,
  LOCAL: /^(COORD|SPHERE-LOCAL|SPHERE-REFLECT-LOCAL|NOISE)$/,
  perlin(x, y) {   // the 2D value noise of X_ITE 16.6.0's Perlin2.glsl; the GPU's float32 sin gives other hash values, so the pattern is of the same kind, not the same pixels
    const fr = (v) => v - Math.floor(v), rnd = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453), r3 = (a, b, l, t) => rnd(rnd(rnd(a, b), l), t);
    const fx = Math.floor(x), fy = Math.floor(y), c = r3(fx, fy, 1, 0), cx = r3(fx + 1, fy, 1, 0), cy = r3(fx, fy + 1, 1, 0), cxy = r3(fx + 1, fy + 1, 1, 0);
    const dx = -0.5 * Math.cos(fr(x) * Math.PI) + 0.5, dy = -0.5 * Math.cos(fr(y) * Math.PI) + 0.5;
    return ((c + (cx - c) * dx) * (1 - dy) + (cy + (cxy - cy) * dx) * dy) * 2 - 1;
  },
  fill(mode, params, uv, i, p, n, t3) {   // p, n: position and unit normal in the space of the mode
    const reflect = () => { const l = Math.hypot(p[0], p[1], p[2]) || 1, e = [p[0] / l, p[1] / l, p[2] / l], d = e[0] * n[0] + e[1] * n[1] + e[2] * n[2]; return [e[0] - 2 * d * n[0], e[1] - 2 * d * n[1], e[2] - 2 * d * n[2]]; };
    const sphereMap = (r) => { const m = 2 * Math.sqrt(r[0] * r[0] + r[1] * r[1] + (r[2] + 1) * (r[2] + 1)) || 1; uv[i * 2] = r[0] / m + 0.5; uv[i * 2 + 1] = r[1] / m + 0.5; };
    if (t3) {   // the three numbers of the mode, for a cube map lookup (a 2D map keeps the two in uv)
      let d = null; switch (mode) { case 'CAMERASPACENORMAL': case 'SPHERE': case 'SPHERE-LOCAL': d = n; break; case 'CAMERASPACEPOSITION': case 'COORD-EYE': case 'COORD': d = p; break; case 'CAMERASPACEREFLECTIONVECTOR': case 'SPHERE-REFLECT': case 'SPHERE-REFLECT-LOCAL': d = reflect(); break; }
      if (d) { t3[i * 3] = d[0]; t3[i * 3 + 1] = d[1]; t3[i * 3 + 2] = d[2]; }
    }
    switch (mode) {
      case 'SPHERE': case 'SPHERE-LOCAL': uv[i * 2] = n[0] * 0.5 + 0.5; uv[i * 2 + 1] = n[1] * 0.5 + 0.5; break;
      case 'NOISE': case 'NOISE-EYE': { const g = (k) => params[k] || 0, a = p[0] * g(0) + g(3), b = p[1] * g(1) + g(4), c = p[2] * g(2) + g(5); uv[i * 2] = R.bridge.three.tcg.perlin(a, b); uv[i * 2 + 1] = R.bridge.three.tcg.perlin(b, c); break; }
      case 'CAMERASPACENORMAL': uv[i * 2] = n[0]; uv[i * 2 + 1] = n[1]; break;
      case 'CAMERASPACEPOSITION': case 'COORD-EYE': case 'COORD': uv[i * 2] = p[0]; uv[i * 2 + 1] = p[1]; break;
      case 'CAMERASPACEREFLECTIONVECTOR': { const r = reflect(); uv[i * 2] = r[0]; uv[i * 2 + 1] = r[1]; break; }
      case 'SPHERE-REFLECT': case 'SPHERE-REFLECT-LOCAL': sphereMap(reflect()); break;
      default: uv[i * 2] = 0; uv[i * 2 + 1] = 0;
    }
  },
  /* the uv attribute of a BufferGeometry from its positions and normals; mv = a THREE.Matrix4 (model-view) for the camera-space modes, null for the object-space ones */
  make(geo, mode, params, mv, want3) {   // want3: the mesh shows a cube map, which reads the three numbers (tc3); the others keep to uv
    const pos = geo.attributes.position, nr = geo.attributes.normal, n = pos.count, uv = geo.attributes.uv && geo.attributes.uv.count === n ? geo.attributes.uv : new THREE.BufferAttribute(new Float32Array(n * 2), 2);
    const nm = mv ? new THREE.Matrix3().getNormalMatrix(mv) : null, v = new THREE.Vector3(), w = new THREE.Vector3(), t3 = !want3 ? null : geo.attributes.tc3 && geo.attributes.tc3.count === n ? geo.attributes.tc3 : new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i); w.fromBufferAttribute(nr, i); if (mv) { v.applyMatrix4(mv); w.applyMatrix3(nm); } w.normalize();
      R.bridge.three.tcg.fill(mode, params, uv.array, i, [v.x, v.y, v.z], [w.x, w.y, w.z], t3 && t3.array);
    }
    uv.needsUpdate = true; if (geo.attributes.uv !== uv) geo.setAttribute('uv', uv); if (t3) { t3.needsUpdate = true; if (geo.attributes.tc3 !== t3) geo.setAttribute('tc3', t3); }
  },
};
