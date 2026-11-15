// glTF-Transform's quantize() puts the dequantization matrix on the node that holds the mesh. When that node is animated (translation / rotation / scale
// channels) or has children, it cannot, so it creates an ANONYMOUS child node, moves the mesh onto it and retargets the morph-weights channel to it
// (functions@4.5.1 index.js transformMeshParents, read 2026-11-15; measured on fixtures/animated: the weights channel of DEF "Mover" ends up on a node
// with no name and no extras). For an X3D scene that cuts the tie between the DEF and its shape.
// This wrapper runs quantize(), finds the nodes it created, and marks each `x3d_wrapper_of: <parent name>`. nodeKey() in geometry.mjs resolves such a
// node to its parent, so identity, animation and per-node box checks look through the wrapper instead of failing on it or hiding it.
import { quantize } from '@gltf-transform/functions';

export function quantizeKeepingIdentity(options = {}) {
  const inner = quantize(options);
  const fn = async (doc) => {
    const before = new Set(doc.getRoot().listNodes());
    await doc.transform(inner);
    let n = 0;
    for (const node of doc.getRoot().listNodes()) {
      if (before.has(node) || node.getName() || Object.keys(node.getExtras() || {}).length) continue;
      const parent = node.getParentNode(); if (!parent) continue;
      node.setExtras({ x3d_wrapper_of: parent.getName() || (parent.getExtras() || {}).x3d_def || '(unnamed)', x3d_wrapper_by: 'quantize' }); n++;
    }
    if (n) doc.getLogger().info(`quantize-identity: marked ${n} wrapper node(s)`);
  };
  Object.defineProperty(fn, 'name', { value: 'quantizeKeepingIdentity' });
  return fn;
}
