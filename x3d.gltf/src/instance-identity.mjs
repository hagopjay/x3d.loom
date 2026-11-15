// EXT_mesh_gpu_instancing without losing the X3D identity of each instance.
// glTF-Transform's instance() turns N nodes that share a mesh into one batch node (world-space TRS per instance) and deletes the N nodes, DEF and all.
// This wrapper records each source node's name and extras in traversal order (the order instance() fills the batch in), runs instance(),
// then writes them to `extras.x3d_instances` of the new batch node: instance i of the batch IS the i-th recorded node. identity.snapshot() reads them back,
// so the multiset of identity tokens is unchanged although the node count is not.
import { instance } from '@gltf-transform/functions';

export function instanceWithIdentity(options = {}) {
  const inner = instance(options);
  const fn = async (doc) => {
    const R = doc.getRoot(), scene = R.getDefaultScene() || R.listScenes()[0];
    const records = new Map(), before = new Set(R.listNodes());
    if (scene) scene.traverse((node) => {
      const mesh = node.getMesh(); if (!mesh || node.getExtension('EXT_mesh_gpu_instancing')) return;
      const list = records.get(mesh) || records.set(mesh, []).get(mesh);
      const name = node.getName(), extras = node.getExtras() || {};
      list.push(name || Object.keys(extras).length ? { n: name, e: JSON.parse(JSON.stringify(extras)) } : null);
    });
    await doc.transform(inner);
    let stamped = 0;
    for (const node of R.listNodes()) {
      if (before.has(node)) continue;
      const batch = node.getExtension('EXT_mesh_gpu_instancing'), mesh = node.getMesh();
      if (!batch || !mesh) continue;
      const rec = records.get(mesh), count = (batch.listAttributes()[0])?.getCount();
      if (!rec || rec.length !== count) { doc.getLogger().warn(`instance-identity: ${count} instances but ${rec?.length} recorded nodes; batch left unstamped`); continue; }
      if (rec.some(Boolean)) node.setExtras({ ...(node.getExtras() || {}), x3d_instances: rec });
      stamped++;
    }
    doc.getLogger().info(`instance-identity: stamped ${stamped} batch node(s)`);
  };
  Object.defineProperty(fn, 'name', { value: 'instanceWithIdentity' });
  return fn;
}
