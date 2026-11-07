/* Additive reader nodes for the Manifold scene. Concatenated after reader.js inside the same bundle scope, so DEFS, PARSE, FLAT, CONTAINER, geomNodes, INIT and IO are visible.
   Nothing here changes how the brain scenes parse: only new entries are added. */

PARSE.MFVec4f = (s) => Float32Array.from(numList(s));        // uSources, uShape, uPulse, uAnchors: flat, four floats a vector
FLAT['ElevationGrid.height'] = Float32Array;                  // 513 x 513 = 263,169 numbers stay a typed array

Object.assign(DEFS, {
  ElevationGrid: { ...geomNodes, height: ['MFFloat', INIT, []], xDimension: ['SFInt32', INIT, 0], zDimension: ['SFInt32', INIT, 0],
                   xSpacing: ['SFFloat', INIT, 1], zSpacing: ['SFFloat', INIT, 1], creaseAngle: ['SFFloat', INIT, 0] },
  TriangleSet: { ...geomNodes },                              // every three coordinates are a triangle
  PointSet: { coord: ['SFNode', IO, null], color: ['SFNode', IO, null], attrib: ['MFNode', IO, []] },
});
Object.assign(CONTAINER, { ElevationGrid: 'geometry', TriangleSet: 'geometry', PointSet: 'geometry' });
// vertex data the page rewrites every few hundred ms: the SAI hands out a view that does not copy
R.saiLazy = new Set(['FloatVertexAttribute.value', 'IndexedTriangleSet.index', 'Coordinate.point', 'Color.color']);

// X3D addFieldCallback on a reader-raised output event (the page listens to Clock.elapsedTime): emit() only queued ROUTEs, so it now also runs the node's callbacks, once per timestamp.
{
  const emit0 = events.emit;
  events.emit = function (node, field, value) {
    if (node.cbs && node.cbs[field] && !this.firedOut.has(node.id + '.' + field) && R.hooks.cb) R.hooks.cb(node, field, value);
    return emit0.call(this, node, field, value);
  };
}
