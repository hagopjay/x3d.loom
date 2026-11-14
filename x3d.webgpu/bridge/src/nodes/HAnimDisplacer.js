/* HAnimDisplacer (HAnim level 1): displaces the coordinates of a joint's skin (or a segment's shapes) by `displacements` on the coordinates in `coordIndex`, scaled by `weight`.
   Babylon: one MorphTarget per displacer and skin mesh (HAnimHumanoid.js morphFor), influence = weight, so the weight can be routed and animated. X_ITE 16.6.0 adds the displacement after the skin
   matrices as joint rotation * (displacement * weight); Babylon morphs before skinning, which is the same for a vertex that follows the displacer's joint alone. */
BR.node('HAnimDisplacer', {
  component: 'HAnim', level: 1,
  container: 'displacers',
  defs: {
    coordIndex: ['MFInt32', IO, []],
    description: ['SFString', IO, ''],
    displacements: ['MFVec3f', IO, []],
    metadata: ['SFNode', IO, null],
    name: ['SFString', IO, ''],
    weight: ['SFFloat', IO, 0.0],
  },
  changed(body, n, field) {
    if (field === 'weight') { for (const x of body.world.nodes) { const st = x._hs; if (st && st.disp) for (const t of st.disp.get(n) || []) t.influence = n.f.weight; } }
    else if (field === 'coordIndex' || field === 'displacements') {
      for (const x of body.world.nodes) { if (x.type === 'HAnimHumanoid' && x._hs) BR.hanim.bindSkin(body, x); else if (x.type === 'HAnimSegment' && x._hs) BR.hanim.bindSegment(body, x); }
    }
  },
});
