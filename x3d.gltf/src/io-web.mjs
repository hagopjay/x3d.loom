// The browser twin of io.mjs: WebIO with every glTF-Transform extension and the meshopt codec (the encoder is what makes the live demo possible).
// No Draco and no KTX2 here: those need native-size WASM and a Node image decoder; the page offers the meshopt-based profiles.
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

let cached = null;
export async function makeWebIO() {
  if (cached) return cached;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  cached = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  return cached;
}
export { MeshoptEncoder, MeshoptDecoder };
