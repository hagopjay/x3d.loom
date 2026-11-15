/* CADGeometry for the three.js bridge: CADAssembly and CADLayer are Groups with a name, CADPart is a Group with Transform fields, CADFace holds one `shape`. `visible` hides the subtree.
   Children changes of the three grouping nodes go through body.rebuildGroup (body-three.js 'children' branch); only visible, the Transform fields and CADFace.shape are handled here. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
{
  const T3 = R.bridge.three, TF = ['translation', 'rotation', 'scale', 'scaleOrientation', 'center'];
  const group = (body, n, parent, chain) => { const r = body.buildGroup(n, parent, chain); if (n.type === 'CADPart') body.applyTransform(n, r.tn); return r; };
  for (const t of ['CADAssembly', 'CADLayer', 'CADPart']) T3.build[t] = group;
  T3.build.CADFace = (body, n, parent, chain) => {
    const o = new THREE.Group(); o.name = n.def || 'CADFace'; parent.add(o);
    const r = { node: n, tn: o, kids: [], chain: [n, ...chain] }; body.rec.set(n.id, r);
    if (n.f.shape) r.kids.push(body.build(n.f.shape, o, r.chain));
    if (n.f.visible === false) o.visible = false;
    return r;
  };
  const ch = (body, n, field) => {
    const r = body.rec.get(n.id); if (!r || !r.tn) return;
    if (field === 'visible') r.tn.visible = n.f.visible !== false;
    else if (n.type === 'CADPart' && TF.includes(field)) body.applyTransform(n, r.tn);
    else if (n.type === 'CADFace' && field === 'shape') { for (const k of r.kids) body.disposeRec(k); r.kids = []; if (n.f.shape) r.kids.push(body.build(n.f.shape, r.tn, r.chain)); }
  };
  for (const t of ['CADAssembly', 'CADLayer', 'CADPart', 'CADFace']) T3.changed[t] = ch;
}
