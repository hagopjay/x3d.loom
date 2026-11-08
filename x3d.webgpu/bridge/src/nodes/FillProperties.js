/* FillProperties (Shape level 3): FillProperties indicates whether appearance is filled or hatched for associated geometry nodes inside the same Shape.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('FillProperties', {
  component: 'Shape', level: 3,
  container: 'fillProperties',
  defs: {
    filled: ['SFBool', IO, true],
    hatchColor: ['SFColor', IO, [1, 1, 1]],
    hatched: ['SFBool', IO, true],
    hatchStyle: ['SFInt32', IO, 1],
    metadata: ['SFNode', IO, null],
  },
  // X3DAppearanceChildNode: filled=false hides the fill, hatched=true draws a line pattern (hatchStyle 1 horizontal, 2 vertical, 3 slope up, 4 slope down, 5 cross, 6 diagonal cross;
  // 7 to 19 are drawn as 6, gap) in hatchColor over the surface using the geometry's texture coordinates. Applied when a Shape is built (body-br applyFill).
  extend: { Appearance: { fillProperties: ['SFNode', IO, null] } },
  changed(body, n) { for (const r of body.rec.values()) if (r.node && r.node.type === 'Shape' && r.node.f.appearance && r.node.f.appearance.f.fillProperties === n && r.tn) body.rebuildShapeIn(r); },
});
