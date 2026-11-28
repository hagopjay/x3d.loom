// The workbench. Geometry and statics come from solver.js (inlined above, the file Node checks against the bank);
// the two singular-value curves and every limit come from DATA, which build_page.py copies out of results/bank.json.
(() => {
  'use strict';
  const T = globalThis.Tensegrity, D = DATA, P = D.params, $ = (id) => document.getElementById(id);
  const num = (x, d) => x.toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const S = { lesson: 'twist', twist: 150, pre: 600, load: 800, lcase: 'press', exag: 1, gap: 0.5, pre6: 200, sq: 0, view: 0 };
  let br = null, world = null, worldKind = null, busy = false, again = false;

  // ---------------------------------------------------------------- small vector kit
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  function yTo(d) {                                   // axis-angle turning +y onto d
    const l = len(d), x = d[0] / l, y = d[1] / l, z = d[2] / l, s = Math.hypot(z, x);
    return s < 1e-12 ? [1, 0, 0, y > 0 ? 0 : Math.PI] : [z / s, 0, -x / s, Math.atan2(s, y)];
  }
  function lookAt(pos, target) {                      // Viewpoint orientation, +y up
    let f = sub(target, pos); const fl = len(f); f = f.map((c) => c / fl);
    let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; const rl = len(r);
    if (rl < 1e-9) return [1, 0, 0, f[1] < 0 ? -Math.PI / 2 : Math.PI / 2];
    r = r.map((c) => c / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const R = [[r[0], u[0], -f[0]], [r[1], u[1], -f[1]], [r[2], u[2], -f[2]]];
    const ang = Math.acos(Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)));
    if (ang < 1e-9) return [0, 1, 0, 0];
    const k = 2 * Math.sin(ang);
    return [(R[2][1] - R[1][2]) / k, (R[0][2] - R[2][0]) / k, (R[1][0] - R[0][1]) / k, ang];
  }
  function ramp(u) {                                  // utilisation 0..1: blue, teal, amber, red
    u = Math.max(0, Math.min(1, u));
    const st = [[0, [0.25, 0.55, 0.95]], [0.5, [0.35, 0.85, 0.75]], [0.8, [0.98, 0.72, 0.2]], [1, [0.95, 0.2, 0.15]]];
    for (let i = 1; i < st.length; i++) if (u <= st[i][0]) { const w = (u - st[i - 1][0]) / (st[i][0] - st[i - 1][0]); return st[i - 1][1].map((c, a) => c + w * (st[i][1][a] - c)); }
    return st[3][1];
  }
  const lerpTable = (tab, x) => {                     // tab: [[x, y], ...] evenly spaced
    const dx = tab[1][0] - tab[0][0], f = Math.max(0, Math.min(tab.length - 1, (x - tab[0][0]) / dx)), i = Math.min(tab.length - 2, Math.floor(f));
    return tab[i][1] + (f - i) * (tab[i + 1][1] - tab[i][1]);
  };

  // ---------------------------------------------------------------- models
  const EAof = (M) => M.map((m) => (m.kind === 'strut' ? D.EA_strut : D.EA_cable));
  function prismAt(twistDeg) { return T.prism(P.n, P.R, P.H, twistDeg * Math.PI / 180); }
  function sixAt(gap) {                               // stood on one of its cable triangles
    const g = T.sixStrut(P.six_L, gap * P.six_L), q = Math.SQRT1_2, n = 1 / Math.sqrt(3);
    const e1 = [q, -q, 0], nn = [n, n, n], e3 = [e1[1] * nn[2] - e1[2] * nn[1], e1[2] * nn[0] - e1[0] * nn[2], e1[0] * nn[1] - e1[1] * nn[0]];
    let X = g.X.map((p) => [p[0] * e1[0] + p[1] * e1[1] + p[2] * e1[2], p[0] * nn[0] + p[1] * nn[1] + p[2] * nn[2], p[0] * e3[0] + p[1] * e3[1] + p[2] * e3[2]]);
    const lo = Math.min(...X.map((p) => p[1])); X = X.map((p) => [p[0], p[1] - lo + 0.02, p[2]]);
    const order = X.map((p, i) => [p[1], i]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    return { X, M: g.M, base: order.slice(0, 3), top: order.slice(-3) };
  }
  function loadOn(X, lcase, Pn) {
    const n = P.n, F = X.map(() => [0, 0, 0]);
    const rad = (i) => { const h = Math.hypot(X[i][0], X[i][2]); return [X[i][0] / h, 0, X[i][2] / h]; };
    const tan = (i) => { const r = rad(i); return [r[2], 0, -r[0]]; };
    if (lcase === 'press') for (let i = n; i < 2 * n; i++) F[i][1] = -Pn / n;
    if (lcase === 'one') F[n][1] = -Pn;
    if (lcase === 'push') F[n] = rad(n).map((c) => c * Pn);
    if (lcase === 'lift') for (let i = n; i < 2 * n; i++) F[i][1] = Pn / n;
    if (lcase === 'twist') for (let i = n; i < 2 * n; i++) F[i] = tan(i).map((c) => c * Pn / n);
    return F;
  }
  function solvePrism(pre, lcase, Pn, start) {
    const g = T.prism(P.n, P.R, P.H), tu = T.prismUnitStress(P.n, g.X, g.M), EA = EAof(g.M), tpre = tu.map((v) => v * pre);
    const L0 = T.restLengths(g.X, g.M, EA, tpre), F = loadOn(g.X, lcase, Pn);
    const r = T.relax(start || g.X, g.M, EA, L0, F, T.support321(g.X, 0, 1, 2), 1e-6, 80000);
    const n = P.n; let drop = 0, turn = 0, move = 0;
    for (let i = n; i < 2 * n; i++) { drop -= (r.X[i][1] - g.X[i][1]) / n; turn += (Math.atan2(-r.X[i][2], r.X[i][0]) - Math.atan2(-g.X[i][2], g.X[i][0])) / n; }
    for (let i = 0; i < g.X.length; i++) move = Math.max(move, len(sub(r.X[i], g.X[i])));
    return { X0: g.X, M: g.M, X: r.X, t: r.t, tpre, F, found: r.found, drop, turn: turn * 180 / Math.PI, move };
  }

  // ---------------------------------------------------------------- the X3D world
  const R_STRUT = 0.0125, R_CABLE = 0.004, R_JOINT = 0.021;
  function worldXML(X, M, center, floorR, views) {
    const f = (x) => (Math.abs(x) < 5e-7 ? '0' : x.toFixed(5));
    const v = (p) => p.map(f).join(' ');
    let s = '<X3D profile="Immersive" version="4.0"><Scene>' +
      '<Background skyColor="0.035 0.05 0.085, 0.07 0.10 0.16, 0.16 0.20 0.28, 0.09 0.11 0.15, 0.05 0.06 0.08" skyAngle="1.2, 1.5708, 1.75, 3.14159265"/>' +
      '<NavigationInfo type=\'"EXAMINE" "ANY"\' headlight="true" transitionTime="0.6"/>';
    views.forEach((p, i) => { const o = lookAt(p, center); s += `<Viewpoint DEF="V${i}" position="${v(p)}" orientation="${v(o)}" centerOfRotation="${v(center)}"/>`; });
    s += '<DirectionalLight direction="-0.45 -0.8 -0.4" intensity="0.9" color="1 0.97 0.92"/><DirectionalLight direction="0.6 -0.3 0.7" intensity="0.35" color="0.75 0.85 1"/>';
    const seg = 96, pts = [], idx = [];
    for (let k = 0; k < seg; k++) { pts.push(`${f(center[0] + floorR * Math.cos(2 * Math.PI * k / seg))} -0.024 ${f(center[2] - floorR * Math.sin(2 * Math.PI * k / seg))}`); idx.push(k); }
    s += `<Shape><Appearance><Material diffuseColor="0.13 0.15 0.19" specularColor="0.08 0.08 0.08" shininess="0.1"/></Appearance><IndexedFaceSet solid="true" convex="true" coordIndex="${idx.join(' ')} -1"><Coordinate point="${pts.join(', ')}"/></IndexedFaceSet></Shape>`;
    s += `<Shape><Appearance><Material DEF="GhostMat" emissiveColor="0.75 0.8 0.9" transparency="1"/></Appearance><IndexedLineSet coordIndex="${M.map((m) => m.i + ' ' + m.j + ' -1').join(' ')}"><Coordinate DEF="Ghost" point="${X.map(v).join(', ')}"/></IndexedLineSet></Shape>`;
    const arrowMat = '<Appearance><Material diffuseColor="1 0.85 0.3" emissiveColor="0.5 0.4 0.1"/></Appearance>';
    X.forEach((p, i) => {
      s += `<Transform DEF="J${i}" translation="${v(p)}"><Shape><Appearance><Material diffuseColor="0.92 0.93 0.95" specularColor="0.6 0.6 0.6" shininess="0.6"/></Appearance><Sphere radius="${R_JOINT}"/></Shape></Transform>`;
      s += `<Transform DEF="A${i}" translation="${v(p)}" scale="0.001 0.001 0.001"><Transform DEF="AL${i}"><Transform translation="0 0.165 0"><Shape>${arrowMat}<Cylinder radius="0.006" height="0.18"/></Shape></Transform></Transform>` +
        `<Transform translation="0 0.052 0" rotation="1 0 0 3.14159265"><Shape>${arrowMat}<Cone bottomRadius="0.017" height="0.046"/></Shape></Transform></Transform>`;
    });
    M.forEach((m, k) => {
      const strut = m.kind === 'strut';
      s += `<Transform DEF="M${k}"><Transform DEF="L${k}"><Shape><Appearance><Material DEF="C${k}" diffuseColor="${strut ? '0.86 0.42 0.30' : '0.30 0.62 0.98'}" specularColor="0.45 0.45 0.45" shininess="0.4"/></Appearance>` +
        `<Cylinder radius="${strut ? R_STRUT : R_CABLE}" height="1"/></Shape></Transform></Transform>`;
    });
    return s + '</Scene></X3D>';
  }
  async function ensureWorld(kind, X, M) {
    if (!br || worldKind === kind) return;
    const prism = kind === 'prism', center = prism ? [0, 0.5, 0] : [0, 0.47, 0];
    const views = prism ? [[1.75, 1.2, 1.95], [0.001, 2.9, 0], [0, 0.5, 2.8]] : [[1.5, 1.25, 1.75], [0.001, 2.8, 0], [0, 0.47, 2.6]];
    const scene = await br.createX3DFromString(worldXML(X, M, center, 0.8, views));
    await br.replaceWorld(scene);
    const get = (n) => scene.getNamedNode(n);
    world = { J: X.map((_, i) => get('J' + i)), A: X.map((_, i) => get('A' + i)), AL: X.map((_, i) => get('AL' + i)), M: M.map((_, k) => get('M' + k)), L: M.map((_, k) => get('L' + k)),
      C: M.map((_, k) => get('C' + k)), ghost: get('Ghost'), ghostMat: get('GhostMat'), V: [0, 1, 2].map((i) => get('V' + i)) };
    worldKind = kind; S.view = 0; markView();
    dress(); setTimeout(() => { $('poster').hidden = true; }, 400);
  }
  // draw: X shown, per-member colour [r,g,b] and transparency, optional ghost X0 and per-joint load vectors F with a reference magnitude
  function draw(X, M, col, tr, X0, F, Fref) {
    if (!world) return;
    X.forEach((p, i) => { world.J[i].translation = new X3D.SFVec3f(p[0], p[1], p[2]); });
    M.forEach((m, k) => {
      const a = X[m.i], b = X[m.j], d = sub(b, a), r = yTo(d);
      world.M[k].translation = new X3D.SFVec3f((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      world.M[k].rotation = new X3D.SFRotation(r[0], r[1], r[2], r[3]);
      world.L[k].scale = new X3D.SFVec3f(1, len(d), 1);
      world.C[k].diffuseColor = new X3D.SFColor(col[k][0], col[k][1], col[k][2]);
      world.C[k].transparency = tr[k];
    });
    world.ghostMat.transparency = X0 ? 0.7 : 1;
    if (X0) world.ghost.point = new X3D.MFVec3f(...X0.map((p) => new X3D.SFVec3f(p[0], p[1], p[2])));
    X.forEach((p, i) => {
      const fm = F ? len(F[i]) : 0;
      if (fm < 1e-9) { world.A[i].scale = new X3D.SFVec3f(0.001, 0.001, 0.001); return; }
      const r = yTo(F[i].map((c) => -c));
      world.A[i].translation = new X3D.SFVec3f(p[0], p[1], p[2]);
      world.A[i].rotation = new X3D.SFRotation(r[0], r[1], r[2], r[3]);
      world.A[i].scale = new X3D.SFVec3f(1, 1, 1);
      world.AL[i].scale = new X3D.SFVec3f(1, Math.max(0.25, Math.min(1.6, fm / Fref)), 1);
    });
  }
  const GREY = [0.45, 0.48, 0.54], RED = [0.86, 0.42, 0.30], BLUE = [0.30, 0.62, 0.98];

  // ---------------------------------------------------------------- lesson 1
  function showTwist() {
    const g = prismAt(S.twist), sig = lerpTable(D.twist_sweep, S.twist), on = Math.abs(S.twist - 150) < 0.01;
    $('twist-out').textContent = S.twist.toFixed(1) + '°';
    $('twist-sig').textContent = (on ? 0 : sig).toFixed(4);
    $('twist-bar').style.width = Math.min(100, (on ? 0 : sig) / 0.55 * 100) + '%';
    $('twist-s').textContent = on ? '1' : '0'; $('twist-m').textContent = on ? '1' : '0';
    const say = $('twist-say'); say.className = 'say ' + (on ? 'on' : 'off');
    say.textContent = on
      ? `Locked. One set of forces now balances itself at every joint with no load: tension 1 in each side cable, ${D.unit.poly.toFixed(3)} in each triangle cable, compression ${(-D.unit.strut).toFixed(3)} in each strut. Scale it up and you have prestress.`
      : 'No self-stress here. Each member force is fixed by the loads alone, so with no load every force is zero. Tighten a cable and nothing balances it: the frame just moves to a new shape.';
    legend(on ? [['#db6b4c', 'strut, compression'], ['#4c9efa', 'cable, tension']] : [['#db6b4c', 'strut'], ['#737a8a', 'cable, cannot be pretensioned']]);
    ensureWorld('prism', g.X, g.M).then(() => draw(g.X, g.M, g.M.map((m) => (m.kind === 'strut' ? RED : on ? BLUE : GREY)), g.M.map(() => 0), null, null, 1));
  }

  // ---------------------------------------------------------------- lesson 2
  const CASES = { press: { ref: 800 / 3, lim: 'press' }, one: { ref: 800, lim: null }, push: { ref: 200, lim: 'push' }, lift: { ref: 100, lim: null }, twist: { ref: 100, lim: null } };
  let curveKey = '', curve = null;
  function showLoad() {
    const r = solvePrism(S.pre, S.lcase, S.load), cab = r.M.map((m) => m.kind === 'cable');
    $('pre-out').textContent = num(S.pre) + ' N'; $('load-out').textContent = num(S.load) + ' N';
    let strut = 0, cable = 0, least = Infinity, leastFrac = Infinity, slack = 0;
    r.M.forEach((m, k) => {
      if (m.kind === 'strut') strut = Math.max(strut, -r.t[k]);
      else { cable = Math.max(cable, r.t[k]); least = Math.min(least, r.t[k]); if (r.tpre[k] > 0) leastFrac = Math.min(leastFrac, r.t[k] / r.tpre[k]); if (r.t[k] <= 0) slack++; }
    });
    const uS = strut / D.cap.buckling_N, uC = cable / D.cap.cable_allow_N;
    $('r-drop').innerHTML = `${num(r.drop * 1e3, 2)} <small>mm</small>`; $('r-turn').innerHTML = `${num(Math.abs(r.turn), 2)} <small>°</small>`;
    $('r-strut').innerHTML = `${num(strut)} <small>N of ${num(D.cap.buckling_N)}</small>`; $('r-cable').innerHTML = `${num(cable)} <small>N of ${num(D.cap.cable_allow_N)}</small>`;
    $('r-slack').innerHTML = slack ? `${slack} <small>slack</small>` : `${num(least)} <small>N</small>`;
    $('r-soft').innerHTML = `${num(D.k_per_N * S.pre)} <small>N/m</small>`;
    const chips = [];
    const taut = S.pre > 0 && leastFrac >= D.lim.floor && !slack;
    chips.push([taut, 'Every cable stays taut', S.pre > 0 ? `slackest at ${num(Math.max(0, leastFrac) * 100)} % of its prestress, floor 10 %` : 'no prestress']);
    chips.push([uS <= 1, 'Struts inside the buckling allowance', `${uS.toFixed(2)} of 1`]);
    chips.push([uC <= 1, 'Cables inside the strength allowance', `${uC.toFixed(2)} of 1`]);
    const lim = CASES[S.lcase].lim;
    if (lim === 'press') chips.push([r.drop * 1e3 <= D.lim.drop_mm && Math.abs(r.turn) <= D.lim.turn_deg, 'Sag and turn inside the limit', `${num(D.lim.drop_mm)} mm and ${num(D.lim.turn_deg)}°`]);
    else if (lim === 'push') chips.push([r.move * 1e3 <= D.lim.push_mm, 'Movement inside the limit', `${num(r.move * 1e3, 2)} of ${num(D.lim.push_mm)} mm`]);
    else chips.push([null, 'Movement', `${num(r.move * 1e3, 1)} mm at the worst joint, no limit set for this case`]);
    if (!r.found) chips.unshift([false, 'No resting shape found', 'the structure folds under this load']);
    $('chips').innerHTML = chips.map(([ok, what, v]) => `<div class="chip ${ok === null ? '' : ok ? 'ok' : 'bad'}"><b>${ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL'}</b><span>${what}</span><span class="v">${v}</span></div>`).join('');
    $('win-pin').style.left = (S.pre / 1400 * 100) + '%';
    legend([['#4089f2', 'lightly used'], ['#59d9bf', 'half'], ['#fab833', '80 %'], ['#f23326', 'at the limit'], ['#737a8a', 'slack']]);
    const key = S.pre + '|' + S.lcase;
    if (key !== curveKey) {
      curve = []; let start = null;
      for (let Pn = 0; Pn <= 1600; Pn += 100) { const q = solvePrism(S.pre, S.lcase, Pn, start); start = q.found ? q.X : null; curve.push([Pn, q.found ? (lim === 'press' || S.lcase === 'one' || S.lcase === 'lift' ? Math.abs(q.drop) : q.move) * 1e3 : NaN]); }
      curveKey = key;
    }
    drawChart(lim === 'press' || S.lcase === 'one' || S.lcase === 'lift' ? 'top drop, mm' : 'worst joint movement, mm');
    const Xs = r.X.map((p, i) => p.map((c, a) => r.X0[i][a] + S.exag * (c - r.X0[i][a])));
    const col = r.M.map((m, k) => (m.kind === 'strut' ? ramp(-r.t[k] / D.cap.buckling_N) : r.t[k] <= 0 ? GREY : ramp(r.t[k] / D.cap.cable_allow_N)));
    ensureWorld('prism', r.X0, r.M).then(() => draw(Xs, r.M, col, r.M.map((m, k) => (cab[k] && r.t[k] <= 0 ? 0.6 : 0)), r.X0, S.load > 0 ? r.F : null, CASES[S.lcase].ref));
  }
  function drawChart(ylab) {
    const W = 360, H = 170, l = 38, rgt = 8, top = 10, bot = 26, pts = curve.filter((p) => isFinite(p[1]));
    const ymax = Math.max(1, ...pts.map((p) => p[1])) * 1.08, x = (Pn) => l + Pn / 1600 * (W - l - rgt), y = (v) => H - bot - v / ymax * (H - top - bot);
    let s = `<path class="ax" d="M${l} ${top}V${H - bot}H${W - rgt}"/>`;
    for (let Pn = 0; Pn <= 1600; Pn += 400) s += `<text x="${x(Pn)}" y="${H - bot + 12}" text-anchor="middle">${Pn}</text>`;
    const step = ymax > 40 ? 20 : ymax > 16 ? 5 : ymax > 6 ? 2 : 1;
    for (let v = 0; v <= ymax; v += step) s += `<text x="${l - 5}" y="${y(v) + 3}" text-anchor="end">${v}</text><path class="ax" d="M${l - 2} ${y(v)}H${l}"/>`;
    s += `<text x="${W - rgt}" y="${H - 3}" text-anchor="end">load, N</text><text x="${l + 4}" y="${top + 8}">${ylab}</text>`;
    if (pts.length > 1) {
      const slope = pts[1][1] / 100, pend = Math.min(1600, ymax / Math.max(slope, 1e-9));
      if (slope > 0) s += `<path class="tg" d="M${x(0)} ${y(0)}L${x(pend)} ${y(slope * pend)}"/>`;
      s += `<path class="cv" d="M${pts.map((p) => x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('L')}"/>`;
      const i = Math.min(curve.length - 2, Math.floor(S.load / 100)), w = S.load / 100 - i, a = curve[i][1], b = curve[i + 1][1];
      if (isFinite(a) && isFinite(b)) s += `<circle class="dot" cx="${x(S.load)}" cy="${y(a + w * (b - a))}" r="4"/>`;
    }
    $('chart').innerHTML = s;
  }

  // ---------------------------------------------------------------- lesson 3
  function showSix() {
    const g = sixAt(S.gap), sig = lerpTable(D.gap_sweep, S.gap), on = Math.abs(S.gap - 0.5) < 1e-6;
    $('gap-out').textContent = S.gap.toFixed(3) + ' L'; $('gap-sig').textContent = (on ? 0 : sig).toFixed(4);
    $('gap-bar').style.width = Math.min(100, (on ? 0 : sig) / 0.16 * 100) + '%';
    $('pre6-out').textContent = num(S.pre6) + ' N'; $('sq-out').textContent = num(S.sq) + ' N';
    $('pre6').disabled = $('sq').disabled = !on;
    const say = $('gap-say'); say.className = 'say ' + (on ? 'on' : 'off');
    say.textContent = on
      ? 'Locked at half a strut. Every cable is 0.612 L long, and each strut carries √6 = 2.449 times the tension of a cable.'
      : 'No self-stress at this gap, so there is nothing to tighten. The prestress and squeeze controls wake up at exactly half a strut.';
    let X = g.X, col = g.M.map((m) => (m.kind === 'strut' ? RED : on ? BLUE : GREY)), tr = g.M.map(() => 0), F = null, X0 = null;
    if (on) {
      const EA = EAof(g.M), tpre = T.sixUnitStress(g.M).map((v) => v * S.pre6), L0 = T.restLengths(g.X, g.M, EA, tpre);
      F = g.X.map(() => [0, 0, 0]); g.top.forEach((i) => { F[i][1] = -S.sq / 3; });
      const r = T.relax(g.X, g.M, EA, L0, F, T.support321(g.X, g.base[0], g.base[1], g.base[2]), 1e-6, 80000);
      let strut = 0, cmin = Infinity, cmax = 0, slack = 0, drop = 0;
      g.M.forEach((m, k) => { if (m.kind === 'strut') strut = Math.max(strut, -r.t[k]); else { cmin = Math.min(cmin, r.t[k]); cmax = Math.max(cmax, r.t[k]); if (r.t[k] <= 0) slack++; } });
      g.top.forEach((i) => { drop -= (r.X[i][1] - g.X[i][1]) / 3; });
      $('s-strut').innerHTML = `${num(strut)} <small>N</small>`; $('s-cable').innerHTML = `${num(cmin)} to ${num(cmax)} <small>N</small>`;
      $('s-drop').innerHTML = `${num(drop * 1e3, 2)} <small>mm</small>`; $('s-slack').textContent = slack + ' of 24';
      X = r.X; X0 = S.sq > 0 ? g.X : null; if (S.sq === 0) F = null;
      col = g.M.map((m, k) => (m.kind === 'strut' ? RED : r.t[k] <= 0 ? GREY : S.sq === 0 ? BLUE : ramp(r.t[k] / (2 * Math.max(S.pre6, 1)))));
      tr = g.M.map((m, k) => (m.kind === 'cable' && r.t[k] <= 0 ? 0.6 : 0));
      legend(S.sq === 0 ? [['#db6b4c', 'strut, compression'], ['#4c9efa', 'cable, tension']] : [['#db6b4c', 'strut'], ['#4089f2', 'cable losing tension'], ['#59d9bf', 'at its prestress'], ['#f23326', 'at twice its prestress'], ['#737a8a', 'slack']]);
    } else {
      ['s-strut', 's-cable', 's-drop'].forEach((id) => { $(id).textContent = 'none'; }); $('s-slack').textContent = 'all 24';
      legend([['#db6b4c', 'strut'], ['#737a8a', 'cable, cannot be pretensioned']]);
    }
    ensureWorld('six', g.X, g.M).then(() => draw(X, g.M, col, tr, X0, F, 100));
  }

  // ---------------------------------------------------------------- shell
  function legend(items) { $('legend').innerHTML = items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join(''); }
  function markView() { [0, 1, 2].forEach((i) => $('view-' + i).setAttribute('aria-pressed', i === S.view ? 'true' : 'false')); }
  function render() {
    if (busy) { again = true; return; }
    busy = true;
    try { ({ twist: showTwist, load: showLoad, six: showSix })[S.lesson](); } finally { busy = false; }
    if (again) { again = false; render(); }
  }
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
  function bind(id, key, parse) { $(id).addEventListener('input', (e) => { S[key] = parse(e.target.value); render(); }); }
  bind('twist', 'twist', Number); bind('pre', 'pre', Number); bind('load', 'load', Number); bind('gap', 'gap', Number); bind('pre6', 'pre6', Number); bind('sq', 'sq', Number);
  $('twist-snap').addEventListener('click', () => { S.twist = 150; $('twist').value = 150; render(); });
  $('gap-snap').addEventListener('click', () => { S.gap = 0.5; $('gap').value = 0.5; render(); });
  for (const b of $('case').querySelectorAll('button')) b.addEventListener('click', () => {
    S.lcase = b.dataset.c; $('case').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    const d = { press: 800, one: 800, push: 200, lift: 300, twist: 300 }[S.lcase]; S.load = d; $('load').value = d; render();
  });
  for (const b of $('exag').querySelectorAll('button')) b.addEventListener('click', () => {
    S.exag = Number(b.dataset.x); $('exag').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); render();
  });
  for (const name of ['twist', 'load', 'six']) $('tab-' + name).addEventListener('click', () => {
    S.lesson = name;
    for (const n of ['twist', 'load', 'six']) { $('tab-' + n).setAttribute('aria-selected', n === name ? 'true' : 'false'); $('lesson-' + n).hidden = n !== name; }
    render();
  });
  [0, 1, 2].forEach((i) => $('view-' + i).addEventListener('click', () => { if (world) { world.V[i].set_bind = true; S.view = i; markView(); } }));
  $('win-band').style.left = (D.window.floor / 1400 * 100) + '%'; $('win-band').style.width = ((D.window.ceil - D.window.floor) / 1400 * 100) + '%';
  $('win-lab').style.left = 'calc(' + (D.window.floor / 1400 * 100) + '% + 6px)'; $('win-lab').textContent = 'all 14 cases pass';

  async function boot() {
    render();                                         // numbers first: they do not need the 3D player
    try {
      if (typeof X3D === 'undefined') throw new Error('player script missing');
      br = $('xc').browser; dress();
      let tries = 0; const keep = setInterval(() => { dress(); if (++tries > 20) clearInterval(keep); }, 250);
      render();
    } catch (e) {
      const m = $('msg'); m.hidden = false; m.textContent = 'The 3D player did not load here, so the picture is a still. Every control and number on the right still works.';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
