R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
/* Text and FontStyle (19775-1 15.4) for the three.js bridge. X_ITE draws a Text as filled glyph outlines from fonts it ships (Droid Serif for SERIF, PT Sans for SANS, Ubuntu Mono for TYPEWRITER); the stock Babylon body
   draws a centred canvas label. Here the glyphs are rasterised once into a canvas atlas (one row per line, 128 pixels to the em) and every line is a quad with its own uv window, laid out by the X3D rules:
   size is the em, lines are `spacing * size` apart, `justify` places each line (major) and the block (minor), `length` stretches one line to a given length and `maxExtent` squeezes the longest line to fit. The Material
   lights the glyph quads (normal +Z) like any shape, so diffuseColor is the colour; with no Material the text is white and unlit. Fonts: the rig passes opts.fontBase (a folder with X_ITE's three font families), a page
   without it gets the browser's serif, sans-serif and monospace. Not drawn: vertical text (horizontal FALSE), leftToRight FALSE, topToBottom FALSE (the lines are laid out as for left-to-right, top-to-bottom). */
Object.assign(R.DEFS.FontStyle, { leftToRight: ['SFBool', IO, true], topToBottom: ['SFBool', IO, true], language: ['SFString', IO, ''] });
R.bridge.three.text = {
  EM: 128, PAD: 6,
  FILES: { SERIF: ['Droid/DroidSerif-', 'Regular', 'Bold', 'Italic', 'BoldItalic'], SANS: ['PT_Sans/PTSans-', 'Regular', 'Bold', 'Italic', 'BoldItalic'], TYPEWRITER: ['Ubuntu/UbuntuMono-', 'R', 'B', 'RI', 'BI'] },
  GENERIC: { SERIF: 'serif', SANS: 'sans-serif', TYPEWRITER: 'monospace' },
  family(fs) { for (const f of fs.f.family || []) { const k = String(f).toUpperCase(); if (R.bridge.three.text.FILES[k]) return k; } return 'SERIF'; },
  /* the CSS font of a FontStyle; starts loading the shipped file when the body has a fontBase, and asks for the Text nodes to be laid out again once it is there */
  font(body, fs) {
    const X = R.bridge.three.text, fam = X.family(fs), style = String(fs.f.style || 'PLAIN').toUpperCase(), k = style === 'BOLD' ? 2 : style === 'ITALIC' ? 3 : style === 'BOLDITALIC' ? 4 : 1;
    const weight = k === 2 || k === 4 ? 'bold ' : '', slant = k === 3 || k === 4 ? 'italic ' : '', gen = X.GENERIC[fam];
    if (!body.opts.fontBase) return slant + weight + X.EM + 'px ' + gen;
    const file = X.FILES[fam], name = 'x3d-' + fam + '-' + k; body.fontFaces = body.fontFaces || new Map();
    if (!body.fontFaces.has(name)) {
      const ff = new FontFace(name, 'url(' + body.opts.fontBase + file[0] + file[k] + '.woff2)'); body.fontFaces.set(name, { ready: false });
      ff.load().then((f) => { document.fonts.add(f); body.fontFaces.get(name).ready = true; for (const n of body.allNodes()) if (n.type === 'Text') body.regeo(n); }, () => body.note('Text: font ' + name + ' not loaded, the browser font is used'));
    }
    return slant + weight + X.EM + 'px ' + (body.fontFaces.get(name).ready ? name + ', ' : '') + gen;
  },
  /* geometry of a Text node: one quad per line, positions in X3D units; the atlas texture is kept in body.textCache for the material */
  build(body, g) {
    const X = R.bridge.three.text, T = THREE, f = g.f, fs = f.fontStyle || { f: { family: ['SERIF'], style: 'PLAIN', size: 1, spacing: 1, justify: ['BEGIN'], horizontal: true } };
    const LINES = Math.max(1, Math.floor(4096 / (Math.ceil(1.6 * X.EM) + 2 * X.PAD))), all = (f.string || []).map(String), lines = all.slice(0, LINES), n = lines.length; if (!n) return body.emptyGeometry();
    if (all.length > n) body.note('Text: ' + all.length + ' lines do not fit one 4096 px atlas, the first ' + n + ' are drawn');   // a cell is about 1.6 em high at the atlas scale
    const size = fs.f.size > 0 ? fs.f.size : 1, spacing = fs.f.spacing, J = (fs.f.justify || ['BEGIN']).map((j) => String(j).toUpperCase()), major = J[0] || 'BEGIN', minor = J[1] || 'FIRST';
    if (fs.f.horizontal === false || fs.f.leftToRight === false || fs.f.topToBottom === false) body.note('Text: vertical, right-to-left or bottom-to-top text is laid out left to right, top to bottom');
    const cv = document.createElement('canvas'), cx = cv.getContext('2d'), font = X.font(body, fs); cx.font = font;
    const m = cx.measureText('Hg'), asc = (m.fontBoundingBoxAscent || X.EM * 0.9) / X.EM, desc = (m.fontBoundingBoxDescent || X.EM * 0.25) / X.EM;   // in em
    const w = lines.map((l) => cx.measureText(l).width / X.EM);   // advance of each line, in em
    // length (per line) and maxExtent (all lines), as factors on the horizontal scale of a line
    const sx = lines.map((l, i) => (f.length && f.length[i] > 0 && w[i] > 0 ? f.length[i] / (w[i] * size) : 1));
    const maxW = Math.max(...w.map((x, i) => x * size * sx[i])); if (f.maxExtent > 0 && maxW > f.maxExtent) for (let i = 0; i < n; i++) sx[i] *= f.maxExtent / maxW;
    // minor alignment works on the ink box of the text (X_ITE 16.6.0: BEGIN puts the top of the glyphs of the first line at the origin, END the bottom of the last line, MIDDLE the middle of the two), not on the font's ascender
    const inkTop = (cx.measureText(lines[0]).actualBoundingBoxAscent || asc * X.EM) / X.EM, inkBot = Math.max(0, (cx.measureText(lines[n - 1]).actualBoundingBoxDescent || 0) / X.EM);
    const lineH = size * spacing, b0 = minor === 'BEGIN' ? -inkTop * size : minor === 'MIDDLE' ? ((n - 1) * lineH + (inkBot - inkTop) * size) / 2 : minor === 'END' ? (n - 1) * lineH + inkBot * size : 0;   // baseline of line 0
    const padU = X.PAD / X.EM, cellH = Math.ceil((asc + desc + 2 * padU) * X.EM), cellW = lines.map((l, i) => Math.ceil(w[i] * X.EM) + 2 * X.PAD), W = Math.min(4096, Math.max(8, ...cellW)), H = cellH * n;
    cv.width = W; cv.height = H; const c2 = cv.getContext('2d'); c2.font = font; c2.fillStyle = '#fff'; c2.textBaseline = 'alphabetic';
    const pos = [], uv = [], idx = [];
    lines.forEach((l, i) => {
      const k = Math.min(1, (W - 2 * X.PAD) / Math.max(1, w[i] * X.EM)); c2.save(); c2.translate(X.PAD, i * cellH + X.PAD + asc * X.EM); c2.scale(k, 1); c2.fillText(l, 0, 0); c2.restore();   // a line wider than the atlas is squeezed (4096 px)
      const lw = w[i] * size * sx[i], x0 = major === 'MIDDLE' ? -lw / 2 : major === 'END' ? -lw : 0, base = b0 - i * lineH, s = size / X.EM;
      const xa = x0 - X.PAD * s * sx[i], xb = x0 + lw + X.PAD * s * sx[i], ya = base - (desc + padU) * size, yb = base + (asc + padU) * size;
      const u1 = (w[i] * X.EM + 2 * X.PAD) * k / W, v1 = 1 - i * cellH / H, v0 = 1 - (i + 1) * cellH / H, o = pos.length / 3;
      pos.push(xa, ya, 0, xb, ya, 0, xb, yb, 0, xa, yb, 0); uv.push(0, v0, u1, v0, u1, v1, 0, v1); idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const tx = new T.CanvasTexture(cv); tx.anisotropy = 8; tx.generateMipmaps = true; tx.minFilter = T.LinearMipmapLinearFilter; tx.colorSpace = T.NoColorSpace;
    const old = body.textCache.get(g.id); if (old) old.map.dispose(); body.textCache.set(g.id, { map: tx });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(Float32Array.from(pos), 3)); geo.setAttribute('uv', new T.BufferAttribute(Float32Array.from(uv), 2));
    geo.setAttribute('normal', new T.BufferAttribute(Float32Array.from(pos, (_, i) => (i % 3 === 2 ? 1 : 0)), 3)); geo.setIndex(idx); return geo;
  },
};
R.bridge.three.geometry.Text = (g, body) => R.bridge.three.text.build(body, g);
R.bridge.three.changed.Text = (body, n, field) => { if (['string', 'length', 'maxExtent', 'fontStyle'].includes(field)) body.regeo(n); };
R.bridge.three.changed.FontStyle = (body, n) => { for (const t of body.allNodes()) if (t.type === 'Text' && t.f.fontStyle === n) body.regeo(t); };
