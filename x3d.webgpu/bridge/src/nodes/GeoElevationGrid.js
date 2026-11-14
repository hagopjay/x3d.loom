/* GeoElevationGrid (Geospatial level 1): GeoElevationGrid is a geometry node defining a rectangular height field, with default values for a 1m by 1m square at height 0.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoElevationGrid', {
  component: 'Geospatial', level: 1,
  container: 'geometry',
  defs: {
    ccw: ['SFBool', INIT, true],
    color: ['SFNode', IO, null],
    colorPerVertex: ['SFBool', INIT, true],
    creaseAngle: ['SFDouble', INIT, 0],
    geoGridOrigin: ['SFVec3d', INIT, [0, 0, 0]],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    height: ['MFDouble', INIT, [0, 0]],
    metadata: ['SFNode', IO, null],
    normal: ['SFNode', IO, null],
    normalPerVertex: ['SFBool', INIT, true],
    set_height: ['MFDouble', IN, []],
    solid: ['SFBool', INIT, true],
    texCoord: ['SFNode', IO, null],
    xDimension: ['SFInt32', INIT, 0],
    xSpacing: ['SFDouble', INIT, 1.0],
    yScale: ['SFFloat', IO, 1],
    zDimension: ['SFInt32', INIT, 0],
    zSpacing: ['SFDouble', INIT, 1.0],
  },
  /* X_ITE 16.6.0: the grid point (x, z) is (zSpacing * z, xSpacing * x, height * yScale) + geoGridOrigin in latitude / longitude order (xSpacing * x, zSpacing * z for longitude_first and
     easting_first), so x runs east and z runs north (local -Z with rotateYUp) and the spacing is in DEGREES in GD, metres in UTM. yScale multiplies only the height, not the origin's elevation.
     Every point is converted on its own (BR.geo.local), so the surface follows the ellipsoid. Fewer than 2 x 2 points draws nothing; a short height list is padded with 0. Each cell is two
     triangles (i1, i3, i2) and (i1, i4, i3) with i1 = (x, z), i2 = (x, z+1), i3 = (x+1, z+1), i4 = (x+1, z): counter-clockwise seen from above, so ccw TRUE shows the top. Normals: the face
     normal of each triangle, negated when ccw is FALSE; with normalPerVertex, the sum of the normals of all triangles at the vertex that are within creaseAngle of this one (strictly: cos of the
     angle between them > cos(creaseAngle)), unweighted, so the default creaseAngle 0 stays faceted. Texture coordinates (x / (xDimension - 1), z / (zDimension - 1)); colours per vertex or per
     cell. set_height rebuilds the grid. */
  geometry(g) {
    const f = g.f, xd = f.xDimension | 0, zd = f.zDimension | 0, G = BR.geo;
    if (xd < 2 || zd < 2) return { pos: new Float32Array(0), nrm: new Float32Array(0), col: null, uv: null, idx: new Uint32Array(0) };
    const C = G.ctx(g), std = !(C.S.lonFirst || C.S.eastFirst) || C.S.sys === 'GC', H = f.height || [], O = f.geoGridOrigin, P = new Float64Array(xd * zd * 3);
    for (let z = 0; z < zd; z++) for (let x = 0; x < xd; x++) {
      const i = x + z * xd, h = (H[i] ?? 0) * f.yScale, p = std ? [f.zSpacing * z, f.xSpacing * x, h] : [f.xSpacing * x, f.zSpacing * z, h];
      const l = G.local(g, [p[0] + O[0], p[1] + O[1], p[2] + O[2]]); P[i * 3] = l[0]; P[i * 3 + 1] = l[1]; P[i * 3 + 2] = l[2];
    }
    const nT = (xd - 1) * (zd - 1) * 2, tri = new Uint32Array(nT * 3), face = new Uint32Array(nT);
    let t = 0;
    for (let z = 0; z < zd - 1; z++) for (let x = 0; x < xd - 1; x++) {
      const i1 = x + z * xd, i2 = x + (z + 1) * xd, i3 = x + 1 + (z + 1) * xd, i4 = x + 1 + z * xd, cell = x + z * (xd - 1);
      tri.set([i1, i3, i2], t * 3); face[t++] = cell; tri.set([i1, i4, i3], t * 3); face[t++] = cell;
    }
    const nc = nT * 3, pos = new Float32Array(nc * 3), idx = new Uint32Array(nc), nrm = new Float32Array(nc * 3), ccw = f.ccw !== false, perV = f.normalPerVertex !== false;
    const fn = new Array(nT), nl = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    for (let k = 0; k < nT; k++) {
      const a = tri[k * 3] * 3, b = tri[k * 3 + 1] * 3, c = tri[k * 3 + 2] * 3;
      const u = [P[c] - P[b], P[c + 1] - P[b + 1], P[c + 2] - P[b + 2]], w = [P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]];
      const n = nl([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]); fn[k] = ccw ? n : [-n[0], -n[1], -n[2]];
    }
    const UN = f.normal && f.normal.f.vector, CO = f.color && f.color.f.color, cw = f.color && f.color.type === 'ColorRGBA' ? 4 : 3, TC = f.texCoord && f.texCoord.f.point, tcw = BR.tcWidth(f.texCoord);
    const col = CO ? new Float32Array(nc * 3) : null, uv = new Float32Array(nc * 2), cper = f.colorPerVertex !== false;
    const byV = new Map();                                      // vertex -> the triangle corners that meet there
    if (perV && !UN) for (let k = 0; k < nT; k++) for (let j = 0; j < 3; j++) { const v = tri[k * 3 + j]; (byV.get(v) || byV.set(v, []).get(v)).push(k); }
    const cc = Math.cos(Math.min(Math.max(f.creaseAngle || 0, 0), Math.PI));
    for (let k = 0; k < nT; k++) for (let j = 0; j < 3; j++) {
      const c = k * 3 + j, v = tri[c], x = v % xd, z = (v / xd) | 0;
      pos[c * 3] = P[v * 3]; pos[c * 3 + 1] = P[v * 3 + 1]; pos[c * 3 + 2] = P[v * 3 + 2];
      if (ccw) { idx[c] = c; } else { idx[k * 3] = k * 3; idx[k * 3 + 1] = k * 3 + 2; idx[k * 3 + 2] = k * 3 + 1; }
      let n;
      if (UN) { const i = (perV ? v : face[k]) * 3; n = [UN[i], UN[i + 1], UN[i + 2]]; }
      else if (!perV || cc >= 1) n = fn[k];
      else { let s = [0, 0, 0]; for (const q of byV.get(v)) { const d = fn[q][0] * fn[k][0] + fn[q][1] * fn[k][1] + fn[q][2] * fn[k][2]; if (d > cc) { s[0] += fn[q][0]; s[1] += fn[q][1]; s[2] += fn[q][2]; } } n = nl(s); }
      nrm[c * 3] = n[0]; nrm[c * 3 + 1] = n[1]; nrm[c * 3 + 2] = n[2];
      if (col) { const i = (cper ? v : face[k]) * cw; col[c * 3] = CO[i]; col[c * 3 + 1] = CO[i + 1]; col[c * 3 + 2] = CO[i + 2]; }
      if (TC) { uv[c * 2] = TC[v * tcw]; uv[c * 2 + 1] = TC[v * tcw + 1]; } else { uv[c * 2] = x / (xd - 1); uv[c * 2 + 1] = z / (zd - 1); }
    }
    return { pos, nrm, col, uv, idx };
  },
  receive(n, field, v) { if (field !== 'set_height') return false; BR.emit(n, 'height', v); return true; },
  changed(body, n, field) { if (field === 'height' || field === 'yScale' || field === 'ccw' || field === 'colorPerVertex' || field === 'normalPerVertex') body.regeo(n); },
});
