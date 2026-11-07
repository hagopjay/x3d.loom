/* Additive reader nodes for the Manifold scene (SCAFFOLD: untested). Concatenated after reader.js inside the same bundle scope, so DEFS, PARSE, FLAT and CONTAINER are visible.
   Nothing here changes how the brain scenes parse: only new entries are added. When the KANSEI port lands, merge with its drift-ext.js rather than forking the reader. */

PARSE.MFVec4f = (s) => chunk(numList(s), 4);                 // uSources, uShape, uPulse, uAnchors
FLAT['ElevationGrid.height'] = Float32Array;

Object.assign(DEFS, {
  // geomNodes already carries coord, normal, color, texCoord, attrib (FloatVertexAttribute)
  ElevationGrid: { ...geomNodes, height: ['MFFloat', INIT, []], xDimension: ['SFInt32', INIT, 0], zDimension: ['SFInt32', INIT, 0],
                   xSpacing: ['SFFloat', INIT, 1], zSpacing: ['SFFloat', INIT, 1], creaseAngle: ['SFFloat', INIT, 0] },
  TriangleSet: { ...geomNodes },                              // non-indexed: every three coordinates are a triangle
  PointSet: { coord: ['SFNode', IO, null], color: ['SFNode', IO, null], attrib: ['MFNode', IO, []] },
});
Object.assign(CONTAINER, { ElevationGrid: 'geometry', TriangleSet: 'geometry', PointSet: 'geometry' });
FLAT['ElevationGrid.height'] = Float32Array;
// TODO(port): FLAT is read per attribute at parse time; make sure 'ElevationGrid.height' (513 x 513 = 263,169 floats) stays a Float32Array, not a JS array.
// TODO(port): the SAI shim must accept MFVec4f (setValue with a Float32Array of 4 * N) on ComposedShader user fields: see SAI additions in MANIFOLD-PORT-PLAN.md section 2, row 4.
