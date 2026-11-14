/* CartoonVolumeStyle (VolumeRendering level 3): CartoonVolumeStyle generates cartoon-style non-photorealistic rendering of associated volumetric data.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CartoonVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    colorSteps: ['SFInt32', IO, 4],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    orthogonalColor: ['SFColorRGBA', IO, [1, 1, 1, 1]],
    parallelColor: ['SFColorRGBA', IO, [0, 0, 0, 1]],
    surfaceNormals: ['SFNode', IO, null],
  },
  changed(body, n) { BR.volr.touch(body, n); },
});

/* X_ITE 16.6.0: the angle between the normal and the direction from the eye to the sample picks one of colorSteps bands, and the colour is orthogonalColor to parallelColor mixed in HSV with
   t = cos(band * 90 degrees / (colorSteps - 1)). The angle is measured against +vertex (the direction eye to sample), where ShadedVolumeStyle uses -vertex, so a surface whose normal points
   away from the eye (the far side of a solid) draws and the near side is dropped: replicated on purpose. Alpha comes from the voxel. */
(BR.volr ||= { styles: {} }).styles.CartoonVolumeStyle = (n, C) => {
  if (n.f.enabled === false) return null;
  const id = C.id, sn = n.f.surfaceNormals && BR.volr.is3D(n.f.surfaceNormals) ? C.tex('sn_' + id, n.f.surfaceNormals, 3) : null, steps = Math.max(1, Math.min(64, n.f.colorSteps | 0));
  return { name: 'st_' + id, lib: [`${BR.volr.hsvLib}`], fn: `${C.normalFn(id, sn)}
fn st_${id}(c: vec4f, tc: vec3f, vp: vec3f) -> vec4f {
  let sn = nrm_${id}(tc);
  if (sn.w == 0.0) { return vec4f(0.0); }
  let steps = ${C.fl(steps)};
  let stp = 1.5707963267948966 / steps;
  let cosT = min(dot(sn.xyz, normalize(vp)), 1.0);
  if (cosT < 0.0) { return vec4f(0.0); }
  var mk = 1.0;
  if (steps > 1.0) { mk = steps / (steps - 1.0); }
  let k = min(floor(acos(cosT) / stp) * mk, steps);
  return vec4f(hsv2rgb(mixHsv(rgb2hsv(${C.v3(n.f.orthogonalColor || [1, 1, 1])}), rgb2hsv(${C.v3(n.f.parallelColor || [0, 0, 0])}), cos(k * stp))), c.a);
}` };
};

(BR.volr ||= { styles: {} }).hsvLib = '\nfn rgb2hsv(c: vec3f) -> vec3f {\n  let mx = max(c.r, max(c.g, c.b));\n  let mn = min(c.r, min(c.g, c.b));\n  let d = mx - mn;\n  var h = 0.0;\n  if (d != 0.0) {\n    if (mx == c.r) { h = (c.g - c.b) / d; } else if (mx == c.g) { h = 2.0 + (c.b - c.r) / d; } else { h = 4.0 + (c.r - c.g) / d; }\n    h = h * 1.0471975511965976;\n    if (h < 0.0) { h = h + 6.283185307179586; }\n  }\n  var s = 0.0;\n  if (mx != 0.0) { s = d / mx; }\n  return vec3f(h, s, mx);\n}\nfn hsv2rgb(c: vec3f) -> vec3f {\n  let s = clamp(c.y, 0.0, 1.0);\n  let v = clamp(c.z, 0.0, 1.0);\n  if (s == 0.0) { return vec3f(v); }\n  let h6 = c.x * 3.0 / 3.141592653589793;\n  let i = floor(h6);\n  let f = h6 - i;\n  let p = v * (1.0 - s);\n  let q = v * (1.0 - s * f);\n  let t = v * (1.0 - s * (1.0 - f));\n  let k = i32(i) % 6;\n  switch (k) {\n    case 0: { return vec3f(v, t, p); }\n    case 1: { return vec3f(q, v, p); }\n    case 2: { return vec3f(p, v, t); }\n    case 3: { return vec3f(p, q, v); }\n    case 4: { return vec3f(t, p, v); }\n    default: { return vec3f(v, p, q); }\n  }\n}\nfn mixHsv(a: vec3f, b: vec3f, t: f32) -> vec3f {\n  var ha = a.x;\n  var hb = b.x;\n  if (a.y == 0.0) { ha = hb; }\n  if (b.y == 0.0) { hb = ha; }\n  let range = abs(hb - ha);\n  var h = 0.0;\n  if (range <= 3.141592653589793) { h = mix(ha, hb, t); }\n  else {\n    let st = (6.283185307179586 - range) * t;\n    if (ha < hb) { h = ha - st; } else { h = ha + st; }\n    if (h < 0.0) { h = h + 6.283185307179586; }\n    if (h > 6.283185307179586) { h = h - 6.283185307179586; }\n  }\n  return vec3f(h, mix(a.y, b.y, t), mix(a.z, b.z, t));\n}';
