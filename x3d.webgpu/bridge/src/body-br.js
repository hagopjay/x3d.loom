/* Bridge kit, Babylon side. Concatenated after brain/body.js and body-cam.js (Body is a class in the bundle scope). A node the kit owns is built by its own spec.build;
   a node with no build is an event or data node the reader runs, and the body stays silent about it instead of noting "skipped". Types the kit does not own go to the stock build. */
{
  const _build = Body.prototype.build;
  Body.prototype.build = function (n, parent, chain) {
    const s = R.bridge.specs.get(n && n.type);
    if (s) return s.build ? s.build(this, n, parent, chain) : null;
    return _build.call(this, n, parent, chain);
  };
  const _changed = Body.prototype.changed;
  Body.prototype.changed = function (node, field) {
    const s = R.bridge.specs.get(node.type);
    if (s && s.changed) s.changed(this, node, field);
    return _changed.call(this, node, field);
  };
}
