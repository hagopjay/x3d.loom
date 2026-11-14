/* HAnimSite (HAnim level 1): an end effector, attachment point or viewpoint site of the skeleton: a Transform whose children ride the joint it is under. */
BR.node('HAnimSite', {
  component: 'HAnim', level: 1,
  extend: { HAnimSite: Object.assign({}, BR.hanim.EXT) },
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { return BR.hanim.buildGroup(body, n, parent, chain, true); },
  changed(body, n, field) { BR.hanim.groupChanged(body, n, field, true); },
});
