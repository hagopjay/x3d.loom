// The footbridge workbench. Statics, influence lines, patterning and strengths come from solver.js (inlined above, the
// file Node checks against the bank). Joint displacements, the mode shape, the depth sweep and the frequency curve are
// DATA, which build_page.py copies out of results/bank.json.
(() => {
  'use strict';
  const F = globalThis.Footbridge, D = DATA, P = D.params, $ = (id) => document.getElementById(id);
  const num = (x, d) => x.toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const kN = (x, d) => (x >= 0 ? '+' : '−') + num(Math.abs(x) / 1e3, d === undefined ? 1 : d);
  const mdl = F.build(D.geom), ROWS = F.envelope(mdl, D.sections, P, D.lines), FULL = F.envelope(mdl, D.sections, P, D.lines, { patterned: false });
  const IDS = mdl.members.map((m) => m.id), SPAN = mdl.xs[mdl.xs.length - 1], HALF = P.deck_width / 2, W = D.lines.crowd;
  const ETA_MID = F.midspanInfluence(mdl, D.sections, P, IDS.map((i) => ROWS[i].eta));
  const S = { lesson: 'line', member: 'D5', mode: 'tension', front: 12, exag: 40, depth: 2, crowd: 0, view: 0, playing: false };
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let br = null, world = null, raf = 0;

  // ---------------------------------------------------------------- colours
  function ramp(u) {                                  // utilisation 0..1 on a fixed scale: blue, teal, amber, red
    u = Math.max(0, Math.min(1, u));
    const st = [[0, [0.25, 0.55, 0.95]], [0.5, [0.35, 0.85, 0.75]], [0.8, [0.98, 0.72, 0.20]], [1, [0.95, 0.20, 0.15]]];
    for (let i = 0; i < st.length - 1; i++) if (u <= st[i + 1][0]) { const w = (u - st[i][0]) / (st[i + 1][0] - st[i][0]); return st[i][1].map((c, k) => c + w * (st[i + 1][1][k] - c)); }
    return st[3][1];
  }
  const SIGN_FULL = 0.45;                             // unfactored force at 0.45 of design strength is drawn fully saturated
  function signed(s) {
    const t = Math.max(-1, Math.min(1, s / SIGN_FULL)), k = Math.pow(Math.abs(t), 0.7), base = [0.40, 0.42, 0.46], end = t > 0 ? [0.10, 0.42, 1.0] : [1.0, 0.22, 0.08];
    return base.map((c, i) => c + k * (end[i] - c));
  }

  // ---------------------------------------------------------------- the 3D world, built once and posed through the SAI
  function lookAt(pos, target) {
    const f = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]], fl = Math.hypot(...f); f.forEach((_, i) => { f[i] /= fl; });
    let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r) || 1; r = r.map((c) => c / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const R = [[r[0], u[0], -f[0]], [r[1], u[1], -f[1]], [r[2], u[2], -f[2]]];
    const ang = Math.acos(Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)));
    if (ang < 1e-9) return [0, 1, 0, 0];
    const s = 2 * Math.sin(ang); return [(R[2][1] - R[1][2]) / s, (R[0][2] - R[2][0]) / s, (R[1][0] - R[0][1]) / s, ang];
  }
  const VIEWS = [[[-7, 6.5, 17], [SPAN / 2 - 2.5, 0.6, 0]], [[SPAN / 2, 1.6, 37], [SPAN / 2, 0.4, 0]], [[-5.5, 1.9, 0.4], [SPAN / 2, 1.3, 0]]];
  function worldXML() {
    const f = (x) => (Math.abs(x) < 5e-7 ? '0' : x.toFixed(5)), v = (p) => p.map(f).join(' ');
    let s = '<X3D profile="Immersive" version="4.0"><Scene>' +
      '<Background skyColor="0.035 0.05 0.085, 0.07 0.10 0.16, 0.16 0.21 0.30" skyAngle="1.2, 1.5708"/>' +
      '<NavigationInfo type=\'"EXAMINE" "ANY"\' headlight="true" transitionTime="0.6"/>' +
      '<DirectionalLight direction="-0.35 -0.8 -0.5" intensity="0.55" ambientIntensity="0.3"/><DirectionalLight direction="0.5 -0.3 0.8" intensity="0.2"/>';
    VIEWS.forEach(([p, t], i) => { const o = lookAt(p, t); s += `<Viewpoint DEF="V${i}" position="${v(p)}" orientation="${v(o)}" centerOfRotation="${v(t)}" fieldOfView="0.6"/>`; });
    for (const x of [-0.9, SPAN + 0.9]) s += `<Transform translation="${f(x)} -0.95 0"><Shape><Appearance><Material diffuseColor="0.30 0.31 0.33" specularColor="0.05 0.05 0.05"/></Appearance><Box size="1.8 1.6 ${f(2 * HALF + 1.6)}"/></Shape></Transform>`;
    for (let i = 0; i < mdl.deck.length - 1; i++) s += `<Transform DEF="DP${i}"><Shape><Appearance><Material diffuseColor="0.33 0.28 0.23" specularColor="0.06 0.06 0.06"/></Appearance><Box size="1 0.10 ${f(2 * HALF - 0.25)}"/></Shape></Transform>`;
    mdl.names.filter((n) => n[0] === 'T').forEach((n) => { s += `<Transform DEF="X${n}"><Shape><Appearance><Material diffuseColor="0.30 0.32 0.36"/></Appearance><Box size="0.07 0.07 ${f(2 * HALF)}"/></Shape></Transform>`; });
    mdl.members.forEach((m, k) => {
      const b = D.sections[m.group].b;
      s += `<Transform DEF="N${k}"><Shape><Appearance><Material DEF="C${k}" diffuseColor="0.4 0.42 0.46" specularColor="0.12 0.12 0.12" shininess="0.2"/></Appearance><Box size="${f(b)} 1 ${f(b)}"/></Shape></Transform>` +
        `<Transform DEF="Q${k}"><Shape><Appearance><Material USE="C${k}"/></Appearance><Box size="${f(b)} 1 ${f(b)}"/></Shape></Transform>`;
    });
    for (let i = 0; i < 2; i++) s += `<Transform DEF="CR${i}" scale="0.0001 1 1"><Shape><Appearance><Material diffuseColor="0.98 0.80 0.30" emissiveColor="0.25 0.18 0.03" transparency="0.62"/></Appearance><Box size="1 1.5 ${f(2 * HALF - 0.3)}"/></Shape></Transform>`;
    return s + '</Scene></X3D>';
  }
  async function ensureWorld() {
    if (!br || world) return;
    const scene = await br.createX3DFromString(worldXML());
    await br.replaceWorld(scene);
    const get = (n) => scene.getNamedNode(n);
    world = { N: IDS.map((_, k) => get('N' + k)), Q: IDS.map((_, k) => get('Q' + k)), C: IDS.map((_, k) => get('C' + k)), DP: mdl.deck.slice(1).map((_, i) => get('DP' + i)),
      X: mdl.names.filter((n) => n[0] === 'T').map((n) => [n, get('X' + n)]), CR: [get('CR0'), get('CR1')], V: [0, 1, 2].map((i) => get('V' + i)) };
    dress(); setTimeout(() => { $('poster').hidden = true; }, 500);
    render();
  }
  function pose(J, cols, crowd) {                     // J: {joint: [x, y]}; cols: per member; crowd: [[x0, x1], ...] at most two
    if (!world) return;
    mdl.members.forEach((m, k) => {
      const a = J[m.a], b = J[m.b], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), th = Math.atan2(-dx, dy);
      for (const [node, z] of [[world.N[k], HALF], [world.Q[k], -HALF]]) {
        node.translation = new X3D.SFVec3f((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z); node.rotation = new X3D.SFRotation(0, 0, 1, th); node.scale = new X3D.SFVec3f(1, L, 1);
      }
      world.C[k].diffuseColor = new X3D.SFColor(cols[k][0], cols[k][1], cols[k][2]);
    });
    world.DP.forEach((node, i) => {
      const a = J[mdl.deck[i]], b = J[mdl.deck[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1];
      node.translation = new X3D.SFVec3f((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.16, 0); node.rotation = new X3D.SFRotation(0, 0, 1, Math.atan2(dy, dx)); node.scale = new X3D.SFVec3f(Math.hypot(dx, dy), 1, 1);
    });
    world.X.forEach(([n, node]) => { node.translation = new X3D.SFVec3f(J[n][0], J[n][1], 0); });
    world.CR.forEach((node, i) => {
      const seg = crowd && crowd[i];
      if (!seg || seg[1] - seg[0] < 1e-3) { node.scale = new X3D.SFVec3f(0.0001, 1, 1); node.translation = new X3D.SFVec3f(0, -50, 0); return; }
      node.translation = new X3D.SFVec3f((seg[0] + seg[1]) / 2, 0.96, 0); node.scale = new X3D.SFVec3f(seg[1] - seg[0], 1, 1);
    });
  }
  const REST = mdl.joints;

  // ---------------------------------------------------------------- small SVG kit
  function svgLine(id, w, h, pad, xr, yr, body) {
    const X = (x) => pad[3] + (x - xr[0]) / (xr[1] - xr[0]) * (w - pad[1] - pad[3]), Y = (y) => pad[0] + (yr[1] - y) / (yr[1] - yr[0]) * (h - pad[0] - pad[2]);
    $(id).setAttribute('viewBox', `0 0 ${w} ${h}`); $(id).innerHTML = body(X, Y);
  }
  const path = (pts, X, Y) => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');

  // ---------------------------------------------------------------- lesson 1: one member, one shape
  function arrangement(r) { return S.mode === 'tension' ? r.forTension : S.mode === 'compression' ? r.forCompression : [[0, SPAN]]; }
  const spanText = (segs) => (segs.length ? segs.map((s) => `${num(s[0], 1)} to ${num(s[1], 1)} m`).join(' and ') : 'nowhere');
  function showLine() {
    const r = ROWS[S.member], fo = FULL[S.member], segs = arrangement(r);
    const cols = IDS.map((i) => (i === S.member ? [1.0, 0.86, 0.30] : [0.27, 0.30, 0.35]));
    pose(REST, cols, segs);
    legend([['#ffdb4d', 'the member you picked'], ['rgba(250,204,77,0.55)', 'where the crowd stands']]);
    const ymax = Math.max(0.3, ...r.eta.map(Math.abs)) * 1.15, pts = mdl.xs.map((x, i) => [x, r.eta[i]]);
    svgLine('il', 520, 190, [14, 12, 24, 40], [0, SPAN], [-ymax, ymax], (X, Y) => {
      let s = '';
      const fill = (segl, cls) => segl.forEach(([a, b]) => {
        const inner = pts.filter((p) => p[0] > a + 1e-9 && p[0] < b - 1e-9), y = (x) => { for (let i = 0; i < mdl.xs.length - 1; i++) if (x <= mdl.xs[i + 1] + 1e-9) return r.eta[i] + (r.eta[i + 1] - r.eta[i]) * (x - mdl.xs[i]) / (mdl.xs[i + 1] - mdl.xs[i]); return 0; };
        const poly = [[a, 0], [a, y(a)], ...inner, [b, y(b)], [b, 0]]; s += `<path class="${cls}" d="${path(poly, X, Y)} Z"/>`;
      });
      fill(r.forTension, 'fillT' + (S.mode === 'compression' ? ' dim' : '')); fill(r.forCompression, 'fillC' + (S.mode === 'tension' ? ' dim' : ''));
      s += `<line class="ax" x1="${X(0)}" y1="${Y(0)}" x2="${X(SPAN)}" y2="${Y(0)}"/>`;
      mdl.xs.forEach((x) => { s += `<line class="ax" x1="${X(x)}" y1="${Y(0) - 3}" x2="${X(x)}" y2="${Y(0) + 3}"/>`; });
      s += `<path class="cv" d="${path(pts, X, Y)}"/>`;
      s += `<text x="${X(0)}" y="186" text-anchor="start">0 m</text><text x="${X(SPAN)}" y="186" text-anchor="end">${num(SPAN)} m</text><text x="${X(SPAN / 2)}" y="186" text-anchor="middle">where one newton stands</text>`;
      s += `<text x="34" y="${Y(ymax * 0.8) + 3}" text-anchor="end">+${num(ymax * 0.8, 2)}</text><text x="34" y="${Y(-ymax * 0.8) + 3}" text-anchor="end">−${num(ymax * 0.8, 2)}</text><text x="34" y="${Y(0) + 3}" text-anchor="end">0</text>`;
      return s;
    });
    $('m-sec').textContent = D.sections[mdl.members[r.k].group].name.replace('SHS ', '') + ' mm';
    $('m-max').innerHTML = kN(r.N_max) + ' <small>kN</small>'; $('m-min').innerHTML = kN(r.N_min) + ' <small>kN</small>';
    $('m-full').innerHTML = kN(fo.N_max) + ' <small>kN</small>'; $('m-u').textContent = num(r.utilisation, 2);
    $('m-cap').innerHTML = `+${num(r.cap_t / 1e3)} / −${num(r.cap_c / 1e3)} <small>kN</small>`;
    const say = $('m-say');
    if (Math.abs(r.area_plus) < 1e-9 && Math.abs(r.area_minus) < 1e-9) { say.className = 'say'; say.innerHTML = `<strong>${S.member} carries nothing from the crowd.</strong> Its influence line is flat zero. It is there to hold the top chord at mid-length, which halves the chord's buckling length.`; }
    else if (r.forTension.length && r.forCompression.length) {
      say.className = 'say ' + (r.reverses ? 'off' : 'on');
      say.innerHTML = `<strong>${S.member} has a line that changes sign.</strong> A crowd on ${spanText(r.forTension)} pulls it, a crowd on ${spanText(r.forCompression)} pushes it. ` +
        (r.reverses ? `With factors it swings from ${kN(r.N_max)} kN to ${kN(r.N_min)} kN. A full deck would only ever show ${kN(fo.N_max)} kN.` : `Dead load keeps it on one side: ${kN(r.N_min)} to ${kN(r.N_max)} kN.`);
    } else { say.className = 'say on'; say.innerHTML = `<strong>${S.member} has a one-signed line</strong>, so the worst crowd is the whole deck: ${kN(r.governs === 'tension' ? r.N_max : r.N_min)} kN with factors. That is true of every chord and of the end posts.`; }
    $('member').value = S.member;
    document.querySelectorAll('#mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === S.mode ? 'true' : 'false'));
  }

  // ---------------------------------------------------------------- lesson 2: the crowd walks on
  const forceAt = (id, front) => ROWS[id].N_dc + W * F.areaBetween(mdl.xs, ROWS[id].eta, 0, front);
  function sagged(front, ex) {
    const J = {};
    for (const n of mdl.names) { const d = D.disp[n]; J[n] = [REST[n][0] + ex * W * F.areaBetween(mdl.xs, d.x, 0, front), REST[n][1] + ex * W * F.areaBetween(mdl.xs, d.y, 0, front)]; }
    return J;
  }
  function showWalk() {
    const fr = S.front, cols = IDS.map((i) => { const n = forceAt(i, fr), r = ROWS[i]; return signed(n >= 0 ? n / r.cap_t : n / r.cap_c); });
    pose(sagged(fr, S.exag), cols, [[0, fr]]);
    legend([['#1a6bff', 'tension'], ['#ff3814', 'compression'], ['#666b75', 'near zero']]);
    $('front-out').textContent = num(fr, 1) + ' m';
    const sag = W * F.areaBetween(mdl.xs, ETA_MID, 0, fr), n = forceAt(S.member, fr), n0 = ROWS[S.member].N_dc;
    $('w-sag').innerHTML = num(sag * 1e3, 1) + ' <small>mm</small>'; $('w-force').innerHTML = kN(n) + ' <small>kN</small>'; $('w-name').textContent = 'Force in ' + S.member + ' now';
    const flipped = IDS.filter((i) => forceAt(i, fr) * forceAt(i, SPAN) < -1).length;
    $('w-flip').textContent = flipped; $('w-ratio').innerHTML = sag > 1e-6 ? 'span / ' + num(SPAN / sag) : '<small>no crowd yet</small>';
    const curve = []; for (let q = 0; q <= 60; q++) curve.push([SPAN * q / 60, forceAt(S.member, SPAN * q / 60) / 1e3]);
    const lo = Math.min(0, ...curve.map((p) => p[1])), hi = Math.max(0, ...curve.map((p) => p[1])), padY = (hi - lo) * 0.12 || 1;
    svgLine('wk', 520, 170, [12, 12, 24, 44], [0, SPAN], [lo - padY, hi + padY], (X, Y) =>
      `<line class="ax" x1="${X(0)}" y1="${Y(0)}" x2="${X(SPAN)}" y2="${Y(0)}"/><path class="cv" d="${path(curve, X, Y)}"/>` +
      `<line class="tg" x1="${X(fr)}" y1="12" x2="${X(fr)}" y2="146"/><circle class="dot" cx="${X(fr)}" cy="${Y(n / 1e3)}" r="4"/>` +
      `<text x="38" y="${Y(hi) + 3}" text-anchor="end">${num(hi, 0)}</text><text x="38" y="${Y(lo) + 3}" text-anchor="end">${num(lo, 0)}</text><text x="38" y="${Y(0) + 3}" text-anchor="end">0</text>` +
      `<text x="${X(SPAN / 2)}" y="166" text-anchor="middle">front of the crowd, 0 to ${num(SPAN)} m · force in ${S.member}, kN</text>`);
    const say = $('w-say'), crosses = curve.some((p) => p[1] < -0.05) && curve.some((p) => p[1] > 0.05);
    say.className = 'say ' + (crosses ? 'off' : 'on');
    say.innerHTML = crosses ? `<strong>${S.member} changes sign as the crowd arrives.</strong> It starts at ${kN(n0)} kN under dead load, and the half-loaded bridge takes it through zero. No full-deck analysis sees this.`
      : `<strong>${S.member} only grows</strong> as the crowd fills the deck, from ${kN(n0)} kN to ${kN(forceAt(S.member, SPAN))} kN (no factors). Try D5 or V4.`;
    $('member2').value = S.member; $('play').textContent = S.playing ? 'Pause' : 'Walk the crowd on';
    document.querySelectorAll('#exag button').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.x) === S.exag ? 'true' : 'false'));
  }
  function tick(t0) {
    const step = (now) => {
      if (!S.playing || S.lesson !== 'walk') { raf = 0; return; }
      S.front = Math.min(SPAN, S.front + (now - t0) / 1000 * 4); t0 = now; $('front').value = S.front;
      if (S.front >= SPAN) S.playing = false;
      showWalk(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------- lesson 3: depth, stiffness and footfall
  function f1At(c) { const xs = D.freq.crowd_fraction, ys = D.freq.f1_vs_crowd; for (let i = 0; i < xs.length - 1; i++) if (c <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (c - xs[i]) / (xs[i + 1] - xs[i]); return ys[ys.length - 1]; }
  function modeShape(amp) { const J = {}; for (const n of mdl.names) J[n] = [REST[n][0] + amp * D.freq.mode1_shape[n][0], REST[n][1] + amp * D.freq.mode1_shape[n][1]]; return J; }
  function showDepth() {
    const d = D.depth[S.depth], f = f1At(S.crowd), band = D.walk_band;
    $('d-sec').textContent = ['top', 'bottom', 'endpost', 'vertical', 'diagonal'].map((g) => d.sections[g].replace('SHS ', '')).join(' · ');
    $('d-steel').innerHTML = num(d.steel_kg) + ' <small>kg per truss</small>'; $('d-defl').innerHTML = num(d.deflection_pl * 1e3, 1) + ' <small>mm, span / ' + num(d.span_over_deflection) + '</small>';
    $('d-f').innerHTML = num(d.f1, 2) + ' <small>Hz empty</small>'; $('d-fc').innerHTML = num(d.f1_crowded, 2) + ' <small>Hz full crowd</small>';
    document.querySelectorAll('#depth button').forEach((b, i) => b.setAttribute('aria-pressed', i === S.depth ? 'true' : 'false'));
    $('crowd-out').textContent = num(S.crowd * 100) + ' % of the design crowd'; $('d-now').innerHTML = num(f, 2) + ' <small>Hz</small>';
    const inBand = f >= band[0] && f <= band[1], say = $('d-say'); say.className = 'say ' + (inBand ? 'off' : 'on');
    say.innerHTML = inBand ? `<strong>${num(f, 2)} Hz is inside the walking band</strong> (${band[0]} to ${band[1]} Hz). The people who lower the frequency are the ones keeping time with it.`
      : f >= P.frequency_min ? `<strong>${num(f, 2)} Hz clears the ${num(P.frequency_min, 1)} Hz line.</strong> That check is made on the empty bridge. Add people and watch.`
        : `<strong>${num(f, 2)} Hz is under the ${num(P.frequency_min, 1)} Hz line</strong> and heading for the walking band (${band[0]} to ${band[1]} Hz).`;
    const pts = []; for (let q = 0; q <= 40; q++) pts.push([q / 40, f1At(q / 40)]);
    svgLine('fq', 520, 180, [12, 12, 24, 40], [0, 1], [1.2, 4.4], (X, Y) =>
      `<rect class="band" x="${X(0)}" y="${Y(band[1])}" width="${X(1) - X(0)}" height="${Y(band[0]) - Y(band[1])}"/>` +
      `<line class="tg" x1="${X(0)}" y1="${Y(P.frequency_min)}" x2="${X(1)}" y2="${Y(P.frequency_min)}"/><path class="cv" d="${path(pts, X, Y)}"/>` +
      `<circle class="dot" cx="${X(S.crowd)}" cy="${Y(f)}" r="4"/><line class="ax" x1="${X(0)}" y1="${Y(1.2)}" x2="${X(1)}" y2="${Y(1.2)}"/>` +
      `<text x="34" y="${Y(4) + 3}" text-anchor="end">4 Hz</text><text x="34" y="${Y(3) + 3}" text-anchor="end">3</text><text x="34" y="${Y(2) + 3}" text-anchor="end">2</text>` +
      `<text x="${X(0.98)}" y="${Y((band[0] + band[1]) / 2) + 3}" text-anchor="end">walking pace</text><text x="${X(0.5)}" y="176" text-anchor="middle">share of the design crowd standing on the deck, 0 to 100 %</text>`);
    legend([['#59d9bf', 'first vertical mode, shape enlarged'], ['#666b75', 'slowed to about 1 Hz']]);
    const cols = IDS.map(() => [0.35, 0.85, 0.75]);
    if (still || !world) { pose(modeShape(0.5), cols, null); return; }
    if (!raf) {
      const loop = (now) => { if (S.lesson !== 'depth') { raf = 0; return; } pose(modeShape(0.55 * Math.sin(now / 1000 * 2 * Math.PI * 0.9)), cols, null); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }
  }

  // ---------------------------------------------------------------- shell
  function legend(items) { $('legend').innerHTML = items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join(''); }
  function markView() { [0, 1, 2].forEach((i) => $('view-' + i).setAttribute('aria-pressed', i === S.view ? 'true' : 'false')); }
  function render() { ({ line: showLine, walk: showWalk, depth: showDepth })[S.lesson](); }
  function dress() {                                  // give the player its stylesheet and unhide its surface
    const root = $('xc').shadowRoot; if (!root) return;
    if (!root.__dressed) {
      const css = $('xite-css').textContent;
      try { const sh = new CSSStyleSheet(); sh.replaceSync(css); root.adoptedStyleSheets = [...root.adoptedStyleSheets, sh]; }
      catch (e) { const st = document.createElement('style'); st.textContent = css; root.prepend(st); }
      root.__dressed = true;
    }
    const surf = root.querySelector('.x_ite-private-browser'); if (surf) surf.style.display = '';
  }
  const groups = { 'Top chord': 'top', 'Bottom chord': 'bottom', 'End posts': 'endpost', 'Verticals': 'vertical', 'Diagonals': 'diagonal' };
  for (const sel of ['member', 'member2']) {
    $(sel).innerHTML = Object.entries(groups).map(([lab, g]) => `<optgroup label="${lab}">` + mdl.members.filter((m) => m.group === g).map((m) => `<option value="${m.id}">${m.id}${ROWS[m.id].reverses ? ' (reverses)' : ''}</option>`).join('') + '</optgroup>').join('');
    $(sel).addEventListener('change', (e) => { S.member = e.target.value; render(); });
  }
  document.querySelectorAll('#quick button').forEach((b) => b.addEventListener('click', () => { S.member = b.dataset.id; if (ROWS[S.member].forTension.length === 0) S.mode = 'compression'; else if (ROWS[S.member].forCompression.length === 0) S.mode = 'tension'; render(); }));
  document.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.m; render(); }));
  document.querySelectorAll('#exag button').forEach((b) => b.addEventListener('click', () => { S.exag = Number(b.dataset.x); render(); }));
  document.querySelectorAll('#depth button').forEach((b, i) => b.addEventListener('click', () => { S.depth = i; render(); }));
  $('front').addEventListener('input', (e) => { S.front = Number(e.target.value); S.playing = false; render(); });
  $('crowd').addEventListener('input', (e) => { S.crowd = Number(e.target.value) / 100; render(); });
  $('play').addEventListener('click', () => {
    if (S.playing) { S.playing = false; render(); return; }
    if (S.front >= SPAN - 1e-6) S.front = 0;
    S.playing = true; render(); tick(performance.now());
  });
  for (const name of ['line', 'walk', 'depth']) $('tab-' + name).addEventListener('click', () => {
    S.lesson = name; S.playing = false;
    for (const n of ['line', 'walk', 'depth']) { $('tab-' + n).setAttribute('aria-selected', n === name ? 'true' : 'false'); $('lesson-' + n).hidden = n !== name; }
    render();
  });
  [0, 1, 2].forEach((i) => $('view-' + i).addEventListener('click', () => { if (world) { world.V[i].set_bind = true; S.view = i; markView(); } }));

  async function boot() {
    render();                                         // numbers first: they do not need the 3D player
    try {
      if (typeof X3D === 'undefined') throw new Error('player script missing');
      br = $('xc').browser; dress();
      let tries = 0; const keep = setInterval(() => { dress(); if (++tries > 20) clearInterval(keep); }, 250);
      await ensureWorld();
    } catch (e) {
      const m = $('msg'); m.hidden = false; m.textContent = 'The 3D player did not load here, so the picture is a still. Every control, chart and number still works.';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
