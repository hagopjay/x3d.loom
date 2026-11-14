/* ViewpointGroup (Navigation level 3): ViewpointGroup can contain Viewpoint, OrthoViewpoint, GeoViewpoint and other ViewpointGroup nodes for better user-navigation support with a shared description o
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ViewpointGroup', {
  component: 'Navigation', level: 3,
  container: 'children',
  defs: {
    center: ['SFVec3f', IO, [0, 0, 0]],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    displayed: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    retainUserOffsets: ['SFBool', IO, false],
    size: ['SFVec3f', IO, [0, 0, 0]],
  },
  // A ViewpointGroup shapes the page's list of viewpoints; nothing is drawn. BR.viewpoints(world, viewerPosition) is that list: every Viewpoint and OrthoViewpoint that has a description,
  // each with the descriptions of the groups around it ("Rooms » Hall"); a viewpoint is left out when any group around it is not displayed. A group is displayed when its displayed field is
  // true and, if its size is not 0 0 0, the viewer is inside the box of that size around center, in the frame of the group's parent (a Transform above it moves the box). The same rule as X_ITE's ViewpointGroup (traversal order, nesting). The body hands the list to
  // the page through Body.viewpointList(). retainUserOffsets is held for the page to apply when it binds a viewpoint of the group.
  build(body, n, parent) { n._ptn = parent; return null; },   // the parent's Babylon node: the proximity box is in the frame of what the group sits under (as X_ITE's ProximitySensor inside the group)
});
BR.viewpoints = (world, viewer) => {
  const out = [], inside = (g) => {
    const z = g.f.size.every((v) => v === 0); if (z) return true;
    let v = viewer; if (v && g._ptn && typeof BABYLON !== 'undefined' && g._ptn.computeWorldMatrix) v = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(v[0], v[1], v[2]), g._ptn.computeWorldMatrix(true).clone().invert()).asArray();
    return v && [0, 1, 2].every((i) => Math.abs(v[i] - g.f.center[i]) <= g.f.size[i] / 2);
  }, seen = new Set();
  const walk = (list, path) => {
    for (const c of list || []) {
      if (!c || seen.has(c)) continue; seen.add(c);
      if (c.type === 'Viewpoint' || c.type === 'OrthoViewpoint') { if (c.f.description) out.push({ node: c, path: [...path, c.f.description], text: [...path, c.f.description].join(' \u00bb ') }); }
      else if (c.type === 'ViewpointGroup') { if (c.f.displayed !== false && inside(c)) walk(c.f.children, c.f.description ? [...path, c.f.description] : path); }
      else if (c.f && c.f.children) walk(c.f.children, path);
    }
  };
  walk(world.children, []);
  return out;
};
