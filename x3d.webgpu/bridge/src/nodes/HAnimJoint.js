/* HAnimJoint (HAnim level 1): a joint of the skeleton, a Transform (translation, rotation, scale, center ...) with the skin binding lists skinCoordIndex / skinCoordWeight and the displacers.
   The reader knew it before the bridge; the skin it moves is bound in HAnimHumanoid.js (one Babylon Bone per entry of the humanoid's joints list). */
BR.node('HAnimJoint', {
  component: 'HAnim', level: 1,
  extend: { HAnimJoint: Object.assign({}, BR.hanim.EXT, { displacers: ['MFNode', IO, []], stiffness: ['MFFloat', IO, [0, 0, 0]], llimit: ['MFFloat', IO, [0, 0, 0]], ulimit: ['MFFloat', IO, [0, 0, 0]] }) },
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { return BR.hanim.buildGroup(body, n, parent, chain, true); },
  changed(body, n, field) {
    BR.hanim.groupChanged(body, n, field, true);
    if (field === 'skinCoordIndex' || field === 'skinCoordWeight' || field === 'displacers') BR.hanim.rebindAll(body);
  },
});
