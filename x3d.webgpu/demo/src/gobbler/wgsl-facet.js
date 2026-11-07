/* FacetShader: the gold facets of the head, their fire, and the scatter of the facets while the head is apart. Term-for-term from the GLSL in gobbler3.x3d (FacetShader). */
gobRegister('facet', {
  key: 'a2e1db0e-7e920071', kind: 'mesh', attrs: ['position', 'color', 'tc0'],
  uniforms: { phase: 'f32', time: 'f32', scan: 'f32', glow: 'f32', light0: 'vec3f', light1: 'vec3f', light2: 'vec3f', light3: 'vec3f' },
  notes: 'no clip z bias in this program. flat vFacet takes the FIRST vertex of the triangle on WebGPU (GL: the last), it is one corner of the facet either way. '
       + 'dpdx/dpdy give the same magnitudes as dFdx/dFdy, dpdy has the opposite sign (window y is down), which flips the cross product, and the GLSL already flips N toward the viewer. '
       + 'fwidth(bmin) is computed at the top of main (WGSL wants derivatives in uniform control flow), the GLSL calls it under branches and before a discard. '
       + 'smoothstep(0.0, -0.2, x) and smoothstep(0.13, 0.05, x) have edge0 > edge1, which WGSL rejects for constant edges: smoothstepR is the same Hermite formula with the edges as arguments. '
       + 'pow(x, 2.0) with a negative x (strip, hor, sc) is undefined in WGSL (exp2(log2(x) * y) is NaN on most backends): written as the square x * x, which is what the GLSL means.',
  vs: `
attribute position: vec3f;
attribute color: vec4f;
attribute tc0: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform phase: f32;
uniform time: f32;
uniform light0: vec3f;
uniform light1: vec3f;
uniform light2: vec3f;
uniform light3: vec3f;
varying vView: vec3f;
varying vObj: vec3f;
flat varying vL0: vec3f;
flat varying vL1: vec3f;
flat varying vL2: vec3f;
flat varying vL3: vec3f;
flat varying vFacet: vec3f;
varying vColor: vec4f;
varying vBary: vec3f;
fn pcg3(v0: vec3u) -> vec3u {
  var v = v0 * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> vec3u(16u);
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
fn rnd3i(q: vec3i) -> vec3f { return vec3f(pcg3(vec3u(q + vec3i(4096)))) * (1.0 / 4294967296.0); }
fn qpos(p: vec3f) -> vec3i { return vec3i(floor(p * 100.0 + 0.5)); }
fn scatter(p: vec3f) -> vec4f {
  let q = qpos(p);
  let r = rnd3i(q);
  let g = (rnd3i(q + vec3i(37, 71, 13)) - 0.5) * 3.4;
  let u = clamp((p.x - -2.75) / (4.79 - -2.75), 0.0, 1.0);
  let jit = (r.x - 0.5) * 0.04;
  let l0 = 0.14 + 0.16 * (1.0 - u) + jit;
  let l1 = l0 + 0.2;
  let b0 = 0.6 + 0.12 * u + jit;
  let b1 = min(0.95, b0 + 0.2);
  if (uniforms.phase <= l0 || uniforms.phase >= b1) { return vec4f(p, 0.0); }
  var e: f32;
  var hold: f32;
  if (uniforms.phase < l1) { e = smoothstep(l0, l1, uniforms.phase); hold = 0.0; }
  else if (uniforms.phase <= b0) { e = 1.0; hold = (uniforms.phase - l1) / max(1e-4, b0 - l1); }
  else { e = 1.0 - smoothstep(b0, b1, uniforms.phase); hold = 1.0; }
  let s = select(0.0, sin(3.14159265 * e), e < 1.0);
  const c: f32 = 0.97030;
  const sn: f32 = -0.24188;
  let d = vec2f((p.x - 0.45) * 1.6, (p.y + 0.75) * 1.5);
  let tgt = vec3f(2.5 + d.x * c - d.y * sn + g.x * 0.36, -0.9 + d.x * sn + d.y * c + g.y * 0.36, 1.2 * p.z + g.z * 0.9);
  let curl = vec3f(0.0, 0.6 * sin(2.1 * p.x + 0.5), 0.6 * cos(1.7 * p.y));
  let drift = vec3f(0.3 + 0.1 * sin(3.0 * p.y), 0.12 * sin(2.0 * p.x), 0.15 * cos(2.0 * p.y));
  let live = 0.07 * e * vec3f(sin(uniforms.time * 0.9 + r.y * 6.283), cos(uniforms.time * 0.7 + r.z * 6.283), sin(uniforms.time * 0.5 + r.x * 6.283));
  return vec4f(p + (tgt - p) * e + curl * s + drift * hold * e + live, e);
}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let s = scatter(vertexInputs.position);
  let mv = uniforms.worldView * vec4f(s.xyz, 1.0);
  vertexOutputs.vView = mv.xyz;
  vertexOutputs.vL0 = (uniforms.worldView * vec4f(uniforms.light0, 1.0)).xyz;
  vertexOutputs.vL1 = (uniforms.worldView * vec4f(uniforms.light1, 1.0)).xyz;
  vertexOutputs.vL2 = (uniforms.worldView * vec4f(uniforms.light2, 1.0)).xyz;
  vertexOutputs.vL3 = (uniforms.worldView * vec4f(uniforms.light3, 1.0)).xyz;
  vertexOutputs.vObj = vertexInputs.position;
  vertexOutputs.vFacet = vertexInputs.position;
  vertexOutputs.vColor = vertexInputs.color;
  vertexOutputs.vBary = vec3f(1.0 - vertexInputs.tc0.x - vertexInputs.tc0.y, vertexInputs.tc0.xy);
  vertexOutputs.position = uniforms.projection * mv;
}`,
  fs: `
uniform phase: f32;
uniform time: f32;
uniform scan: f32;
uniform glow: f32;
varying vView: vec3f;
varying vObj: vec3f;
flat varying vL0: vec3f;
flat varying vL1: vec3f;
flat varying vL2: vec3f;
flat varying vL3: vec3f;
flat varying vFacet: vec3f;
varying vColor: vec4f;
varying vBary: vec3f;
fn pcg3(v0: vec3u) -> vec3u {
  var v = v0 * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> vec3u(16u);
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
fn rnd3i(q: vec3i) -> vec3f { return vec3f(pcg3(vec3u(q + vec3i(4096)))) * (1.0 / 4294967296.0); }
fn qpos(p: vec3f) -> vec3i { return vec3i(floor(p * 100.0 + 0.5)); }
fn h1(p0: vec3f) -> f32 { var p = fract(p0 * 0.3183099 + 0.1); p = p * 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
fn vnoise(x: vec3f) -> f32 {
  let i = floor(x);
  var f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3f(1.0, 0.0, 0.0)), f.x), mix(h1(i + vec3f(0.0, 1.0, 0.0)), h1(i + vec3f(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h1(i + vec3f(0.0, 0.0, 1.0)), h1(i + vec3f(1.0, 0.0, 1.0)), f.x), mix(h1(i + vec3f(0.0, 1.0, 1.0)), h1(i + vec3f(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
fn smoothstepR(e0: f32, e1: f32, x: f32) -> f32 { let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
fn burnD() -> f32 { return select(1.0 - clamp((uniforms.phase - 0.77) / 0.2, 0.0, 1.0), clamp((uniforms.phase - 0.07) / 0.2, 0.0, 1.0), uniforms.phase < 0.6); }
fn burnEdge(p: vec3f, d: f32) -> f32 {
  let u = clamp((p.x - -2.75) / (4.79 - -2.75), 0.0, 1.0);
  let n = vnoise(p * 1.1 + 1.7) * 0.32 + vnoise(p * 3.0 + vec3f(3.1, 3.1 - uniforms.time * 0.6, 3.1)) * 0.1;
  return select(u, 1.0 - u, uniforms.phase < 0.6) * 0.75 + n - d * 1.55 + 0.1;
}
fn mx3(c: vec3f) -> f32 { return max(max(c.r, c.g), c.b); }
fn mn3(c: vec3f) -> f32 { return min(min(c.r, c.g), c.b); }
// One coloured point light on a gold facet: a soft diffuse wash in the facet's own hue, and a highlight that keeps the light's colour.
fn pointLit(Lp: vec3f, LC: vec3f, N: vec3f, R: vec3f, tint: vec3f) -> vec3f {
  let Lv = Lp - fragmentInputs.vView;
  let dl = length(Lv);
  let Ld = Lv / dl;
  let att = 1.2 / (1.0 + 0.0075 * dl * dl);
  let dif = max(dot(N, Ld), 0.0);
  let rd = max(dot(R, Ld), 0.0);
  let sp = pow(rd, 30.0) * 1.7 + pow(rd, 7.0) * 0.28;
  return LC * att * (tint * dif * 0.55 + mix(tint, vec3f(1.0), 0.5) * sp);
}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let vView = fragmentInputs.vView;
  let vObj = fragmentInputs.vObj;
  let vL0 = fragmentInputs.vL0;
  let vL1 = fragmentInputs.vL1;
  let vL2 = fragmentInputs.vL2;
  let vL3 = fragmentInputs.vL3;
  let vFacet = fragmentInputs.vFacet;
  let vColor = fragmentInputs.vColor;
  let vBary = fragmentInputs.vBary;
  // derivatives first, in uniform control flow, before any branch or discard
  let dVdx = dpdx(vView);
  let dVdy = dpdy(vView);
  let bmin = min(min(vBary.x, vBary.y), vBary.z);
  let fwbmin = abs(dpdx(bmin)) + abs(dpdy(bmin));
  var N = normalize(cross(dVdx, dVdy));      // flat, per facet
  let V = normalize(-vView);
  var NdV = dot(N, V);
  if (NdV < 0.0) { N = -N; NdV = -NdV; }
  // One set of random numbers per facet, keyed on the facet's own colour (constant across the facet).
  let cq = vec4i(floor(vColor * 1000.0 + 0.5));
  let fr = rnd3i(cq.xyz + vec3i(cq.w, 2 * cq.w, 3 * cq.w));
  let fr2 = rnd3i(cq.zxy + vec3i(91, 17, 53));
  let fid = fr.x;
  // The click: a fire front crosses the head in a few broad arcs, nape first. It reaches each facet as ONE value
  // (keyed on the facet's corner vFacet plus a per-facet jitter, not on the pixel), so facets go one by one with
  // straight edges: gold, then charred dark, then ignited (deep red to ember, flickering), then the facet burns
  // down to its centre. The cut is an inset copy of the facet (barycentrics), so it stays a straight-edged triangle,
  // with a white-hot rim 1.6 pixels wide and a ramp from white-hot at the cut through ember to deep red inside.
  let d = burnD();
  var edge = 1.0;
  var cut = 1.0;
  var rimHot = 0.0;
  var inner = 1.0;
  if (d > 0.0) {
    edge = burnEdge(vFacet, d) + (fr2.y - 0.5) * 0.07;
    let inset = smoothstepR(0.0, -0.2, edge) * 0.3334;
    if (inset > 0.0) {
      let px = (bmin - inset) / max(fwbmin, 1e-5);     // pixels inside the cut
      if (px < 0.0 || inset > 0.333) { discard; }
      cut = clamp(px, 0.0, 1.0);
      rimHot = 1.0 - smoothstep(1.6 * 0.6, 1.6, px);
      inner = clamp((bmin - inset) / max(0.3334 - inset, 1e-3), 0.0, 1.0);   // 0 at the cut, 1 at the centre
    }
  }
  let charW = smoothstepR(0.13, 0.05, edge);
  let heat = clamp(1.0 - edge / 0.05, 0.0, 1.0);
  let coreW = smoothstep(0.0, 0.25, heat);
  // Gold: Fresnel over a procedural studio (key softbox, strip light, horizon line, top fill).
  let base = vColor.rgb;
  let tint = base / max(mx3(base), 1e-3);                      // the facet's own hue at full value
  let hiHue = mix(tint, vec3f(1.0, 0.86, 0.58), 0.5);          // highlights stay in hue, never white or grey
  let flesh = clamp((base.r - base.g - 0.22) * 3.0, 0.0, 1.0);
  let Ne = normalize(N + (fr - 0.5) * 0.22);                   // a mosaic of facets
  let R = reflect(-V, Ne);
  let key = smoothstep(0.62, 0.96, dot(R, normalize(vec3f(-0.45, 0.6, 0.66))));
  let key2 = smoothstep(0.82, 0.98, dot(R, normalize(vec3f(0.55, 0.5, 0.67))));
  let stx = (R.x - 0.72) * 5.0;
  let strip = exp(-(stx * stx)) * smoothstep(-0.4, 0.4, R.y);
  let fill = smoothstep(0.55, 1.0, dot(R, normalize(vec3f(0.25, -0.25, 0.93))));
  let hrx = R.y * 5.5 + 0.35;
  let hor = exp(-(hrx * hrx));
  let top = smoothstep(0.3, 1.0, R.y);
  let env = vec3f(1.0, 0.88, 0.66) * (key * 2.1 + key2 * 1.3) + vec3f(1.0, 0.7, 0.4) * (strip * 0.9 + fill * 0.28)
          + vec3f(0.95, 0.6, 0.3) * hor * 0.5 + vec3f(0.5, 0.4, 0.3) * top * 0.25 + vec3f(0.035, 0.026, 0.02);
  let F0 = clamp(base * vec3f(1.2, 1.0, 0.72) * (0.75 + 0.5 * fid), vec3f(0.0), vec3f(1.0));
  let F = F0 + (hiHue - F0) * pow(1.0 - NdV, 5.0);            // grazing light goes to the facet's hue, not to white
  let metal = F * env;
  let L = normalize(vec3f(-0.5, 0.6, 0.62));
  let dif = max(dot(N, L), 0.0);
  let spec = pow(max(dot(N, normalize(L + V)), 0.0), 70.0);
  let skin = base * (0.3 + 0.7 * dif) + mix(base, vec3f(1.0, 0.86, 0.58), 0.5) * spec * 0.7 + base * strip * 0.45
           + vec3f(0.9, 0.3, 0.15) * pow(1.0 - NdV, 2.5) * 0.9;  // snood and wattle: lit from within, an ember rim
  var col = mix(metal, skin, flesh);
  let lit = pointLit(vL0, vec3f(1.0, 0.8, 0.42), N, R, hiHue) + pointLit(vL1, vec3f(1.0, 0.36, 0.09), N, R, hiHue) + pointLit(vL2, vec3f(0.12, 0.78, 1.0), N, R, hiHue) + pointLit(vL3, vec3f(0.66, 0.28, 1.0), N, R, hiHue);
  col += lit * 0.5 * (1.0 - 0.35 * flesh);
  let rim = pow(1.0 - NdV, 3.0);                             // Hokie maroon to ember at the edges
  col += mix(vec3f(0.55, 0.08, 0.17), vec3f(1.0, 0.46, 0.12), clamp(0.55 + vObj.y * 0.28, 0.0, 1.0)) * rim * 0.85;
  let Np = normalize(N + (fr2 - 0.5) * 0.3);
  let glint = pow(max(dot(reflect(-V, Np), normalize(vec3f(-0.45, 0.65, 0.6))), 0.0), 160.0);
  let flash = step(0.9, fid) * pow(0.5 + 0.5 * sin(uniforms.time * (1.1 + 2.0 * fid) + fid * 40.0), 40.0);
  col += mix(hiHue, vec3f(1.0, 0.95, 0.85), 0.35) * (glint * 1.5 + flash * 1.3) * (1.0 - 0.6 * flesh) * uniforms.glow;
  let scx = (vObj.x * 0.85 + vObj.y * 0.3 - uniforms.scan) * 2.4;
  let sc = exp(-(scx * scx));   // the energy scan
  col += (vec3f(1.0, 0.66, 0.26) * 0.45 + vec3f(1.0, 0.86, 0.6) * rim * 0.9) * sc * uniforms.glow;
  // No facet goes dead: saturation stays at 0.42 or more, along the facet's own hue, at the same value.
  let vmax = mx3(col);
  let sat = (vmax - mn3(col)) / max(vmax, 1e-4);
  let st = 1.0 - mn3(tint);
  let floorCol = vmax * (1.0 - min(1.0, 0.42 / max(st, 0.42)) * (1.0 - tint));
  col = mix(col, floorCol, clamp((0.42 - sat) / 0.42, 0.0, 1.0));
  // The fire, per facet: charred near-black ahead of the front, then the facet ignites. Its colour runs char, deep
  // red, ember, white-hot toward the cut, with a fine fast flicker inside, and a white-hot rim at the cut itself.
  col = mix(col, vec3f(0.07, 0.012, 0.012) + col * 0.08, charW * 0.92);
  if (heat > 0.0) {
    let fl = 0.7 + 0.7 * vnoise(vObj * 31.0 + vec3f(fid * 40.0, -uniforms.time * 7.0, uniforms.time * 3.0));   // fine, fast flicker
    let hot = heat * heat * (1.0 - 0.75 * smoothstep(0.0, 0.85, inner));   // hotter toward the cut, cooler at the centre
    var fire = mix(vec3f(0.42, 0.03, 0.025), vec3f(1.0, 0.34, 0.06) * 1.6, smoothstep(0.0, 0.55, hot));
    fire = mix(fire, vec3f(1.0, 0.8, 0.45) * 1.9, smoothstep(0.55, 1.0, hot));
    col = mix(col, fire * fl, coreW);
  }
  col = mix(col, vec3f(1.0, 0.94, 0.8) * 2.2, rimHot);
  // Highlights roll off without a hue shift: clipping each channel on its own turned bright gold lime.
  var m = mx3(col);
  col /= 1.0 + m * 0.12;
  m = mx3(col);
  if (m > 1.0) { col = mix(col / m, vec3f(1.0, 0.86, 0.58), clamp((m - 1.0) * 0.45, 0.0, 0.55)); }
  col *= 1.0;
  var a = clamp(vColor.a + rim * 0.2 + sc * 0.15, 0.0, 1.0);
  a = max(a, coreW);
  fragmentOutputs.color = vec4f(col, a * cut);
}`,
});
