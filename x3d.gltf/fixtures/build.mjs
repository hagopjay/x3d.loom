// Deterministic test glbs, built with the glTF-Transform document API. They carry the same x3d_* extras the x3d-blender-io add-on writes
// (x3d_def, x3d_def_path, x3d_use, x3d_viewpoint_description, scene x3d_head_meta), so the identity gate can be tested without Blender.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document } from '@gltf-transform/core';
import { KHRLightsPunctual } from '@gltf-transform/extensions';
import { makeIO } from '../src/io.mjs';

function box(doc, buf, name) {
  const P = [], N = [], I = [], UV = [];
  const faces = [[[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]];
  for (const [n, ...v] of faces) { const b = P.length / 3; for (const q of v) { P.push(q[0] * 0.5, q[1] * 0.5, q[2] * 0.5); N.push(...n); } UV.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  return mk(doc, buf, name, P, N, UV, I);
}
function mk(doc, buf, name, P, N, UV, I) {
  const pos = doc.createAccessor(name + '_pos').setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf);
  const nor = doc.createAccessor(name + '_nrm').setType('VEC3').setArray(new Float32Array(N)).setBuffer(buf);
  const uv = doc.createAccessor(name + '_uv').setType('VEC2').setArray(new Float32Array(UV)).setBuffer(buf);
  const idx = doc.createAccessor(name + '_idx').setType('SCALAR').setArray(new Uint16Array(I)).setBuffer(buf);
  return { pos, nor, uv, idx };
}
function sphere(doc, buf, name, seg, rings) {
  const P = [], N = [], UV = [], I = [];
  for (let r = 0; r <= rings; r++) for (let s = 0; s <= seg; s++) {
    const th = (r / rings) * Math.PI, ph = (s / seg) * 2 * Math.PI, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
    P.push(x * 0.5, y * 0.5, z * 0.5); N.push(x, y, z); UV.push(s / seg, r / rings);
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  return mk(doc, buf, name, P, N, UV, I);
}
const prim = (doc, g, mat) => doc.createPrimitive().setAttribute('POSITION', g.pos).setAttribute('NORMAL', g.nor).setAttribute('TEXCOORD_0', g.uv).setIndices(g.idx).setMaterial(mat);
const std = (doc, name, rgb, extras) => doc.createMaterial(name).setBaseColorFactor([...rgb, 1]).setRoughnessFactor(0.5).setMetallicFactor(0).setExtras(extras || {});
function rig(doc, scene, buf) {
  const cam = doc.createCamera('Viewpoint1').setType('perspective').setYFov(0.8).setZNear(0.1).setZFar(100);
  const cn = doc.createNode('Viewpoint1').setCamera(cam).setTranslation([0, 1.5, 8]).setExtras({ x3d_def: 'Viewpoint1', x3d_viewpoint_description: 'Front' });
  const light = doc.createExtension(KHRLightsPunctual).createLight('Sun').setType('directional').setIntensity(2).setColor([1, 0.95, 0.9]);
  const ln = doc.createNode('Sun').setExtension('KHR_lights_punctual', light).setRotation([-0.4, 0.2, 0, 0.89]);
  scene.addChild(cn).addChild(ln);
}
function base(name) { const doc = new Document(); doc.createBuffer(); const scene = doc.createScene(name).setExtras({ x3d_head_meta: [{ name: 'title', content: name }] }); return { doc, buf: doc.getRoot().listBuffers()[0], scene }; }

export const FIXTURES = ['identity-dup', 'repeated', 'animated', 'textured', 'dense'];

export async function buildFixtures(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const io = await makeIO(), out = {};
  const save = async (name, doc) => { const p = path.join(dir, name + '.glb'); fs.writeFileSync(p, await io.writeBinary(doc)); out[name] = p; };

  { // two materials with identical look and two meshes with identical geometry, told apart only by name and extras: the trap for dedup()
    const { doc, buf, scene } = base('identity-dup'); rig(doc, scene, buf);
    const A = std(doc, 'MA', [0.8, 0.2, 0.2], { x3d_def: 'MatA' }), B = std(doc, 'MB', [0.8, 0.2, 0.2], { x3d_def: 'MatB' });
    const g1 = box(doc, buf, 'g1'), g2 = box(doc, buf, 'g2');
    const mA = doc.createMesh('ShapeA').setExtras({ x3d_def: 'ShapeA' }).addPrimitive(prim(doc, g1, A)), mB = doc.createMesh('ShapeB').setExtras({ x3d_def: 'ShapeB' }).addPrimitive(prim(doc, g2, B));
    const rigN = doc.createNode('Rig').setExtras({ x3d_def: 'Rig', x3d_def_path: ['Rig'] });
    const l = doc.createNode('LeftBox').setMesh(mA).setTranslation([-2, 0, 0]).setExtras({ x3d_def: 'LeftBox', x3d_def_path: ['Rig', 'LeftBox'] });
    const r = doc.createNode('RightBox').setMesh(mB).setTranslation([2, 0, 0]).setExtras({ x3d_def: 'RightBox', x3d_def_path: ['Rig', 'RightBox'] });
    const u = doc.createNode('RightBoxUse').setMesh(mB).setTranslation([2, 0, -3]).setExtras({ x3d_use: 'RightBox', x3d_def_path: ['Rig'] });
    rigN.addChild(l).addChild(r).addChild(u); scene.addChild(rigN);
    // the same trap with names only (no extras): stock dedup folds MD into MC and MeshD into MeshC, and the name MD / MeshD is gone
    const C = std(doc, 'MC', [0.2, 0.8, 0.2]), D = std(doc, 'MD', [0.2, 0.8, 0.2]);
    const g3 = box(doc, buf, 'g3'), g4 = box(doc, buf, 'g4');
    const mC = doc.createMesh('MeshC').addPrimitive(prim(doc, g3, C)), mD = doc.createMesh('MeshD').addPrimitive(prim(doc, g4, D));
    scene.addChild(doc.createNode('PlainC').setMesh(mC).setTranslation([0, 2, 0])).addChild(doc.createNode('PlainD').setMesh(mD).setTranslation([0, -2, 0]));
    await save('identity-dup', doc);
  }
  { // 40 nodes, one mesh, each its own DEF: what Prismatica looks like at small scale
    const { doc, buf, scene } = base('repeated'); rig(doc, scene, buf);
    const M = std(doc, 'Bolt', [0.2, 0.4, 0.9], { x3d_def: 'BoltMat' }); const g = sphere(doc, buf, 'bolt', 12, 8);
    const mesh = doc.createMesh('BoltMesh').setExtras({ x3d_def: 'BoltMesh' }).addPrimitive(prim(doc, g, M));
    for (let i = 0; i < 40; i++) scene.addChild(doc.createNode('Bolt_' + i).setMesh(mesh).setTranslation([(i % 8) - 3.5, Math.floor(i / 8) - 2, 0]).setScale([0.4, 0.4, 0.4]).setExtras({ x3d_def: 'Bolt_' + i }));
    await save('repeated', doc);
  }
  { // translation + rotation channels and morph weights, the three kinds of motion an X3D interpolator becomes
    const { doc, buf, scene } = base('animated'); rig(doc, scene, buf);
    const M = std(doc, 'Mover', [0.1, 0.7, 0.3], { x3d_def: 'MoverMat' }); const g = box(doc, buf, 'mover');
    const tp = [], tn = [];
    for (const v of g.pos.getArray()) tp.push(v * 1.3); for (const v of g.nor.getArray()) tn.push(v);
    const t1 = doc.createAccessor('t1').setType('VEC3').setArray(new Float32Array(g.pos.getArray().map((v, i) => (i % 3 === 1 ? v * 1.5 : 0)))).setBuffer(buf);
    const prm = prim(doc, g, M).addTarget(doc.createPrimitiveTarget('Stretch').setAttribute('POSITION', t1));
    const mesh = doc.createMesh('MoverMesh').addPrimitive(prm).setWeights([0]).setExtras({ x3d_def: 'MoverMesh', targetNames: ['Stretch'] });
    const node = doc.createNode('Mover').setMesh(mesh).setExtras({ x3d_def: 'Mover' }); scene.addChild(node);
    const times = [0, 0.5, 1, 1.5, 2], mkAcc = (n, type, arr) => doc.createAccessor(n).setType(type).setArray(new Float32Array(arr)).setBuffer(buf);
    const anim = doc.createAnimation('Motion');
    for (const [pth, ty, arr] of [['translation', 'VEC3', [0, 0, 0, 1, 0.3, 0, 2, 0, 0, 1, -0.3, 0, 0, 0, 0]], ['rotation', 'VEC4', [0, 0, 0, 1, 0, 0.3827, 0, 0.9239, 0, 0.7071, 0, 0.7071, 0, 0.9239, 0, 0.3827, 0, 0, 0, 1]], ['weights', 'SCALAR', [0, 1, 0, 1, 0]]]) {
      const sampler = doc.createAnimationSampler().setInput(mkAcc('in_' + pth, 'SCALAR', times)).setOutput(mkAcc('out_' + pth, ty, arr)).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(pth).setSampler(sampler));
    }
    await save('animated', doc);
  }
  { // one PNG texture: the KTX2 test subject (64x64 keeps the Basis encoder fast)
    const { doc, buf, scene } = base('textured'); rig(doc, scene, buf);
    const W = 64, px = Buffer.alloc(W * W * 3); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const o = 3 * (y * W + x); px[o] = Math.round(255 * x / (W - 1)); px[o + 1] = Math.round(255 * y / (W - 1)); px[o + 2] = ((x >> 3) + (y >> 3)) & 1 ? 200 : 40; }
    const png = await sharp(px, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer();
    const tex = doc.createTexture('Gradient').setImage(new Uint8Array(png)).setMimeType('image/png');
    const M = std(doc, 'TexMat', [1, 1, 1], { x3d_def: 'TexMat' }).setBaseColorTexture(tex);
    const g = box(doc, buf, 'tex'); const mesh = doc.createMesh('TexBox').addPrimitive(prim(doc, g, M));
    scene.addChild(doc.createNode('TexBox').setMesh(mesh).setExtras({ x3d_def: 'TexBox' }));
    await save('textured', doc);
  }
  { // 96 x 64 UV sphere, about 12k triangles: the compression ratio test
    const { doc, buf, scene } = base('dense'); rig(doc, scene, buf);
    const M = std(doc, 'Ball', [0.9, 0.7, 0.2], { x3d_def: 'BallMat' }); const g = sphere(doc, buf, 'ball', 96, 64);
    g.idx.setArray(new Uint32Array(g.idx.getArray()));
    const mesh = doc.createMesh('BallMesh').setExtras({ x3d_def: 'BallMesh' }).addPrimitive(prim(doc, g, M));
    scene.addChild(doc.createNode('Ball').setMesh(mesh).setScale([3, 3, 3]).setExtras({ x3d_def: 'Ball' }));
    await save('dense', doc);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) { const dir = process.argv[2] || 'fixtures/out'; console.log(JSON.stringify(await buildFixtures(dir), null, 1)); }
