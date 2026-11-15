// One NodeIO for the whole lane: every extension glTF-Transform knows, plus the Draco and meshopt codecs, loaded once.
// A glb written with this IO and read back with it is the lane's definition of "round trip".
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

let cached = null;
export async function makeIO() {
  if (cached) return cached;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  cached = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
  return cached;
}
export { MeshoptEncoder, MeshoptDecoder };
