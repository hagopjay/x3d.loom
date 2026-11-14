/* GeoCoordinate (Geospatial level 1): GeoCoordinate builds geometry as a set of geographic 3D coordinates.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written.

   This file also holds BR.geo, the maths every Geospatial node shares (the other Geo* files only call it at run time, so load order does not matter). Everything is double precision and follows
   X_ITE 16.6.0 (GeospatialComponent.js), which the tests compare against; WHY-geospatial-batch.md has the reading.
     system(geoSystem)        -> { sys:'GD'|'UTM'|'GC', a, c, lonFirst, eastFirst, zone, south }   (first match wins, unknown tokens are ignored, the default is GD with the WE ellipsoid)
     toECEF(S, v)             geographic triple -> geocentric metres      fromECEF(S, p)   the way back (in the system's own axis order)
     normal(S, p)             geodetic surface normal at a geocentric point (the ellipsoid normal, not the radial direction)
     frame(S, p)              the local frame at p as a row-vector matrix: rows east, up (normal), south, translation p       (X_ITE getStandardLocationMatrix)
     ctx(n)                   the node's geoSystem and its GeoOrigin (origin vector, rotateYUp, the origin matrix and its inverse)
     local(n, v)              a geographic triple as X_ITE draws it: geocentric minus the origin, or in the origin's east/up/south frame when rotateYUp   (getLocalCoord)
     locationMatrix(n, v)     the placement matrix GeoLocation, GeoTransform and GeoViewpoint use (getLocationMatrix)
     geoOf(n, l)              the inverse of local()
   Matrices are 16 numbers, row-vector convention (point * M, translation at 12..14), the same as Babylon's Matrix and X_ITE's Matrix4. */
BR.geo ||= {};
{
  const G = BR.geo, D2R = Math.PI / 180, K0 = 0.9996, E0 = 5e5, N0 = 1e7;
  // reference ellipsoids: [a, 1/f] (X_ITE's table; two-axis bodies as [a, c, true]); an unknown code falls back to WE. X_ITE has a typo for URANUS (a = 2555000); the right value is used here.
  const EL = {
    AA: [6377563.396, 299.3249646], AM: [6377340.189, 299.3249646], AN: [6378160, 298.25], BN: [6377483.865, 299.1528128], BR: [6377397.155, 299.1528128], CC: [6378206.4, 294.9786982],
    CD: [6378249.145, 293.465], EA: [6377276.345, 300.8017], EB: [6377298.556, 300.8017], EC: [6377301.243, 300.8017], ED: [6377295.664, 300.8017], EE: [6377304.063, 300.8017],
    EF: [6377309.613, 300.8017], FA: [6378155, 298.3], HE: [6378200, 298.3], HO: [6378270, 297], ID: [6378160, 298.247], IN: [6378388, 297], KA: [6378245, 298.3], RF: [6378137, 298.257222101],
    SA: [6378160, 298.25], WD: [6378135, 298.26], WE: [6378137, 298.257223563],
    MERCURY: [2439700, 2439700, true], VENUS: [6051800, 6051800, true], MOON: [1738140, 1735970, true], MARS: [3395428, 3377678, true], JUPITER: [71492000, 66854000, true],
    SATURN: [60268000, 54364000, true], URANUS: [25559000, 24973000, true], NEPTUNE: [24764000, 24341000, true], PLUTO: [1153000, 1153000, true],
  };
  const SYS = { GD: 'GD', GDC: 'GD', UTM: 'UTM', GC: 'GC', GCC: 'GC', GS: 'GC' };
  G.system = (gs) => {
    const t = Array.from(gs || []).map(String);
    let sys = 'GD', ell = 'WE', zone = 1, south = false;
    for (const s of t) if (SYS[s]) { sys = SYS[s]; break; }
    for (const s of t) if (EL[s]) { ell = s; break; }
    for (const s of t) { const m = /^Z(\d+)$/.exec(s); if (m) { zone = +m[1]; break; } }
    for (const s of t) if (s === 'S') south = true;
    const e = EL[ell], a = e[0], c = e[2] ? e[1] : a * (1 - 1 / e[1]);
    return { sys, a, c, lonFirst: t.includes('longitude_first'), eastFirst: t.includes('easting_first'), zone, south, key: t.join(' ') };
  };
  const ecc2 = (S) => 1 - (S.c / S.a) * (S.c / S.a);
  const geodetic = (S, lat, lon, h) => {     // radians -> geocentric
    const e2 = ecc2(S), s = Math.sin(lat), N = S.a / Math.sqrt(1 - e2 * s * s), c2a2 = 1 - e2;
    return [(N + h) * Math.cos(lat) * Math.cos(lon), (N + h) * Math.cos(lat) * Math.sin(lon), (N * c2a2 + h) * s];
  };
  const inverse = (S, p) => {                // geocentric -> [lat, lon, h] in radians / metres (iteration; the exact pole is handled, X_ITE's pole branch is a bug and is not copied)
    const e2 = ecc2(S), P = Math.hypot(p[0], p[1]), lon = Math.atan2(p[1], p[0]);
    if (P < 1e-9) return [p[2] >= 0 ? Math.PI / 2 : -Math.PI / 2, lon, Math.abs(p[2]) - S.c];   // on the pole the longitude is whatever the rounding left (atan2 of the tiny x, y), which keeps a key at (90, 90, 0) at (90, 90, 0)
    let lat = Math.atan2(p[2], P * (1 - e2)), N = S.a;
    for (let i = 0; i < 30; i++) { const s = Math.sin(lat); N = S.a / Math.sqrt(1 - e2 * s * s); const nl = Math.atan2(p[2] + e2 * N * s, P); const d = Math.abs(nl - lat); lat = nl; if (d < 1e-14) break; }
    const s = Math.sin(lat); N = S.a / Math.sqrt(1 - e2 * s * s);
    const h = Math.abs(lat) < 1.4 ? P / Math.cos(lat) - N : Math.abs(p[2]) / Math.abs(s) - N * (1 - e2);
    return [lat, lon, h];
  };
  const utmToGeodetic = (S, northing, easting) => {   // Snyder 8-17..8-25, the series X_ITE uses; returns radians
    let south = S.south;
    if (northing < 0) { south = !south; northing = -northing; }
    if (south) northing -= N0;
    const x = easting - E0, e2 = ecc2(S), ep2 = e2 / (1 - e2), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const A = K0 * S.a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256), mu = northing / A;
    const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1), C1 = ep2 * c * c, T1 = t * t, N1 = S.a / Math.sqrt(1 - e2 * s * s), R1 = S.a * (1 - e2) / (1 - e2 * s * s) ** 1.5, D = x / (N1 * K0);
    const lat = phi1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = (S.zone * 6 - 183) * D2R + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
    return [lat, lon];
  };
  const geodeticToUtm = (S, lat, lon) => {            // Snyder 8-9..8-13; [northing, easting]
    const e2 = ecc2(S), ep2 = e2 / (1 - e2), s = Math.sin(lat), c = Math.cos(lat), t = Math.tan(lat), N = S.a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c;
    const A = (lon - (S.zone * 6 - 183) * D2R) * c;
    const M = S.a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * lat - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat) - (35 * e2 ** 3 / 3072) * Math.sin(6 * lat));
    const x = K0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
    const y = K0 * (M + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    return [y + (S.south ? N0 : 0), x + E0];
  };
  G.toECEF = (S, v) => {
    if (S.sys === 'GC') return [v[0], v[1], v[2]];
    if (S.sys === 'UTM') { const [n, e] = S.eastFirst ? [v[1], v[0]] : [v[0], v[1]]; const [lat, lon] = utmToGeodetic(S, n, e); return geodetic(S, lat, lon, v[2]); }
    const [lat, lon] = S.lonFirst ? [v[1], v[0]] : [v[0], v[1]];
    return geodetic(S, lat * D2R, lon * D2R, v[2]);
  };
  G.fromECEF = (S, p) => {
    if (S.sys === 'GC') return [p[0], p[1], p[2]];
    const [lat, lon, h] = inverse(S, p);
    if (S.sys === 'UTM') { const [n, e] = geodeticToUtm(S, lat, lon); return S.eastFirst ? [e, n, h] : [n, e, h]; }
    return S.lonFirst ? [lon / D2R, lat / D2R, h] : [lat / D2R, lon / D2R, h];
  };
  G.normal = (S, p) => { const [lat, lon] = inverse(S, p); return [Math.cos(lon) * Math.cos(lat), Math.sin(lon) * Math.cos(lat), Math.sin(lat)]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l ? [a[0] / l, a[1] / l, a[2] / l] : a; };
  const ID = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const mul = (a, b) => {                              // a * b, row vectors: apply a first, then b
    const o = new Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c]; o[r * 4 + c] = s; }
    return o;
  };
  const inv = (m) => {                                 // general 4x4 inverse (Gauss-Jordan)
    const a = m.slice(), b = ID();
    for (let i = 0; i < 4; i++) {
      let p = i; for (let r = i + 1; r < 4; r++) if (Math.abs(a[r * 4 + i]) > Math.abs(a[p * 4 + i])) p = r;
      if (p !== i) for (let c = 0; c < 4; c++) { [a[i * 4 + c], a[p * 4 + c]] = [a[p * 4 + c], a[i * 4 + c]]; [b[i * 4 + c], b[p * 4 + c]] = [b[p * 4 + c], b[i * 4 + c]]; }
      const d = a[i * 4 + i]; if (!d) return ID();
      for (let c = 0; c < 4; c++) { a[i * 4 + c] /= d; b[i * 4 + c] /= d; }
      for (let r = 0; r < 4; r++) if (r !== i) { const f = a[r * 4 + i]; if (f) for (let c = 0; c < 4; c++) { a[r * 4 + c] -= f * a[i * 4 + c]; b[r * 4 + c] -= f * b[i * 4 + c]; } }
    }
    return b;
  };
  G.mul = mul; G.inv = inv; G.identity = ID;
  G.frame = (S, p) => {                                // east, up, south at the geocentric point p (X_ITE getStandardLocationMatrix)
    const y = G.normal(S, p);
    let x = cross([0, 0, 1], y); if (x[0] === 0 && x[1] === 0 && x[2] === 0) x = [1, 0, 0];
    let z = cross(x, y); x = norm(x); z = norm(z);
    return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1];
  };
  /* the node's context: its own system and its GeoOrigin. The origin vector uses the GeoOrigin's own geoSystem, the orientation uses the consumer's ellipsoid (X_ITE does the same). Cached on the
     node and keyed on what it depends on, so a run time change of the GeoOrigin (or of a field of it) gives a new context at the next call. */
  G.ctx = (n) => {
    const f = n.f, o = f.geoOrigin, S = G.system(f.geoSystem);
    const key = S.key + '|' + (o ? [Array.from(o.f.geoCoords).join(','), o.f.rotateYUp, Array.from(o.f.geoSystem || []).join(' ')].join('|') : '');
    if (n._geoCtx && n._geoCtx.key === key) return n._geoCtx;
    let origin = [0, 0, 0], rot = false, M = null, Mi = null;
    if (o) {
      origin = G.toECEF(G.system(o.f.geoSystem), o.f.geoCoords); rot = !!o.f.rotateYUp;
      M = G.frame(S, origin); Mi = inv(M);
    }
    return (n._geoCtx = { key, S, origin, rot, M, Mi });
  };
  const pt = (m, p) => [p[0] * m[0] + p[1] * m[4] + p[2] * m[8] + m[12], p[0] * m[1] + p[1] * m[5] + p[2] * m[9] + m[13], p[0] * m[2] + p[1] * m[6] + p[2] * m[10] + m[14]];
  const dir = (m, p) => [p[0] * m[0] + p[1] * m[4] + p[2] * m[8], p[0] * m[1] + p[1] * m[5] + p[2] * m[9], p[0] * m[2] + p[1] * m[6] + p[2] * m[10]];
  G.pt = pt; G.dir = dir;
  G.local = (n, v) => {
    const C = G.ctx(n), g = G.toECEF(C.S, v);
    return C.rot ? pt(C.Mi, g) : [g[0] - C.origin[0], g[1] - C.origin[1], g[2] - C.origin[2]];
  };
  G.geoOf = (n, l) => {
    const C = G.ctx(n);
    return G.fromECEF(C.S, C.rot ? pt(C.M, l) : [l[0] + C.origin[0], l[1] + C.origin[1], l[2] + C.origin[2]]);
  };
  G.locationMatrix = (n, v) => {
    const C = G.ctx(n), m = G.frame(C.S, G.toECEF(C.S, v));
    if (C.rot) return mul(m, C.Mi);
    m[12] -= C.origin[0]; m[13] -= C.origin[1]; m[14] -= C.origin[2]; return m;
  };
  G.upAt = (n, l) => {                                 // up vector at a local point, in local axes (X_ITE getGeoUpVector)
    const C = G.ctx(n);
    if (C.rot) return dir(C.Mi, G.normal(C.S, pt(C.M, l)));
    return G.normal(C.S, [l[0] + C.origin[0], l[1] + C.origin[1], l[2] + C.origin[2]]);
  };
  /* the nodes of a world that hold a given GeoOrigin; the owner calls this to learn who to redraw */
  G.users = (world, origin) => (world ? world.nodes.filter((x) => x.f && x.f.geoOrigin === origin) : []);
  /* a GeoCoordinate seen as a plain coordinate list (flat local metres), cached on the node under its own version and the context key; what the geometry code reads in place of f.point */
  G.view = (c) => {
    const C = G.ctx(c), P = c.f.point || [], key = (c.version || 0) + '|' + C.key + '|' + P.length;
    if (c._geoView && c._geoView.key === key) return c._geoView;
    const out = new Float32Array(P.length - (P.length % 3));
    for (let i = 0; i + 2 < P.length; i += 3) { const l = G.local(c, [P[i], P[i + 1], P[i + 2]]); out[i] = l[0]; out[i + 1] = l[1]; out[i + 2] = l[2]; }
    return (c._geoView = { type: 'Coordinate', id: c.id, def: c.def, version: key, key, f: { point: out } });
  };
  G.coordOf = (c) => (c && c.type === 'GeoCoordinate' ? G.view(c) : c);        // the coordinate node a consumer should read points from
}
BR.node('GeoCoordinate', {
  component: 'Geospatial', level: 1,
  container: 'coord',
  defs: {
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    metadata: ['SFNode', IO, null],
    point: ['MFVec3d', IO, []],
  },
  /* An X3DCoordinateNode whose points are geographic. The geometry nodes read the local metres through BR.geo.coordOf (the body wraps geometryData, picking and the line code the same way);
     a change of point redraws every geometry that holds the node. A GeoOrigin change reaches it through GeoOrigin's own `changed`. */
  flat: { 'GeoCoordinate.point': Float64Array },      // the point list stays flat and 64-bit: geographic values need the digits (6e6 m with a millimetre)
  changed(body, n) { body.geometryChanged(n); },
});
