/* HAnimSegment (HAnim level 1): the body part attached to a joint, a group of shapes with mass data. Its coord and displacers move the vertices of the shapes inside it that use that coord
   (HAnimHumanoid.js bindSegment: morph targets in the segment's own frame). */
BR.node('HAnimSegment', {
  component: 'HAnim', level: 1,
  extend: { HAnimSegment: Object.assign({}, BR.hanim.EXT, { momentsOfInertia: ['MFFloat', IO, [0, 0, 0, 0, 0, 0, 0, 0, 0]] }) },
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { const r = BR.hanim.buildGroup(body, n, parent, chain, false); BR.hanim.bindSegment(body, n); return r; },
  changed(body, n, field) {
    BR.hanim.groupChanged(body, n, field, false);
    if (field === 'coord' || field === 'displacers') BR.hanim.bindSegment(body, n);
  },
});
