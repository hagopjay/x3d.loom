// Builds optimised copies of a glb with glTF-Transform, for the original-vs-optimised comparison.
//
//   await buildVariant(srcGlb, 'meshopt', outPath)  -> { path, bytes, extensionsUsed }
//
// Names: meshopt  EXT_meshopt_compression (+ KHR_mesh_quantization), glTF-Transform meshopt({level:'high'})
//        meshoptMedium  same, level 'medium' (QUANTIZE filter-less mode, quantizes everything)
//        draco    KHR_draco_mesh_compression, draco() with defaults
//        quantize KHR_mesh_quantization only (uncompressed)
//        dracoCoarse  draco with 5-bit positions, 4-bit normals, 6-bit UVs: a deliberately visible degradation (sensitivity check)
//        instance EXT_mesh_gpu_instancing, instance({min:2})
//        ktx2     KHR_texture_basisu, ktx2-encoder ETC1S (isUASTC false)
//        ktx2Uastc same with UASTC
//        nolights strips KHR_lights_punctual (exercises the fallback headlight path)
//        all      instance + meshopt + ktx2 (everything the pipeline can produce)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRLightsPunctual } from '@gltf-transform/extensions';
import { meshopt, draco, quantize, instance, dedup, prune } from '@gltf-transform/functions';
import sharp from 'sharp';

const require = createRequire(import.meta.url);

let depsPromise = null;
async function deps() {
  if (!depsPromise) {
    depsPromise = (async () => {
      const draco3d = require('draco3dgltf');
      const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
      await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
      const ktx2mod = await import('ktx2-encoder/gltf-transform');
      return {
        io: new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({
          'draco3d.decoder': await draco3d.createDecoderModule(),
          'draco3d.encoder': await draco3d.createEncoderModule(),
          'meshopt.decoder': MeshoptDecoder,
          'meshopt.encoder': MeshoptEncoder,
        }),
        MeshoptEncoder,
        ktx2: ktx2mod.ktx2,
      };
    })();
  }
  return depsPromise;
}

// the basis encoder wasm prints per-slice progress with console.log, even with enableDebug:false
async function quiet(fn) {
  const saved = [console.log, console.info];
  console.log = console.info = () => {};
  try {
    return await fn();
  } finally {
    [console.log, console.info] = saved;
  }
}

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

export const VARIANT_NAMES = ['meshopt', 'meshoptMedium', 'draco', 'quantize', 'dracoCoarse', 'instance', 'ktx2', 'ktx2Uastc', 'nolights', 'all'];

export async function buildVariant(srcGlb, name, outPath) {
  const { io, MeshoptEncoder, ktx2 } = await deps();
  const doc = await io.read(srcGlb);
  const ktxOpts = (uastc) => ({ isUASTC: uastc, generateMipmap: true, enableDebug: false, imageDecoder });
  switch (name) {
    case 'meshopt':
      await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
      break;
    case 'meshoptMedium':
      await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      break;
    case 'draco':
      await doc.transform(draco());
      break;
    case 'quantize':
      await doc.transform(quantize());
      break;
    case 'dracoCoarse': // deliberately damaging: 5-bit positions, 4-bit normals. The oracle must see this one.
      await doc.transform(draco({ quantizePosition: 5, quantizeNormal: 4, quantizeTexcoord: 6 }));
      break;
    case 'instance':
      await doc.transform(instance({ min: 2 }), dedup(), prune());
      break;
    case 'ktx2':
      await quiet(() => doc.transform(ktx2(ktxOpts(false))));
      break;
    case 'ktx2Uastc':
      await quiet(() => doc.transform(ktx2(ktxOpts(true))));
      break;
    case 'nolights': {
      for (const n of doc.getRoot().listNodes()) {
        const l = n.getExtension('KHR_lights_punctual');
        if (l) {
          n.setExtension('KHR_lights_punctual', null);
          l.dispose();
        }
      }
      doc.getRoot().listExtensionsUsed().filter((e) => e instanceof KHRLightsPunctual).forEach((e) => e.dispose());
      break;
    }
    case 'all':
      await doc.transform(instance({ min: 2 }), dedup(), prune());
      await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
      if (doc.getRoot().listTextures().length) await quiet(() => doc.transform(ktx2(ktxOpts(false))));
      break;
    default:
      throw new Error(`unknown variant ${name}`);
  }
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  await io.write(outPath, doc);
  const bytes = fs.statSync(outPath).size;
  const out = await io.read(outPath).then((d) => d.getRoot().listExtensionsUsed().map((e) => e.extensionName));
  return { path: outPath, bytes, extensionsUsed: out };
}

/**
 * Triangles a renderer should draw for this file: per node with a mesh, TRIANGLES primitives (indices or
 * vertices / 3), times the EXT_mesh_gpu_instancing instance count. Also returns the number of mesh-bearing
 * nodes and instance batches. Works on compressed files (decoders are registered on the NodeIO).
 */
export async function expectedGeometry(glbPath) {
  const { io } = await deps();
  const doc = await io.read(glbPath);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  let triangles = 0;
  let meshNodes = 0;
  let instanced = 0;
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const inst = node.getExtension('EXT_mesh_gpu_instancing');
    const n = inst ? (inst.listAttributes()[0]?.getCount() ?? 1) : 1;
    if (inst) instanced++;
    meshNodes++;
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      triangles += ((idx ? idx.getCount() : (pos?.getCount() ?? 0)) / 3) * n;
    }
  });
  return { triangles, meshNodes, instancedNodes: instanced };
}
