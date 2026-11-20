// The LIGHTING + CAMERA CONTRACT. glTF 2.0 core defines a BRDF (spec Appendix B) but no lights and no "default view":
// every viewer adds its own IBL, headlight or tone map, so two viewers disagree before any BRDF code runs.
// The Loom therefore renders a HARNESSED copy of each asset: the original bytes plus exactly two new root nodes,
//   1. a perspective camera (yfov 0.7854, aspect 1) framed by the x3d.gltf framing rule from the ORIGINAL's bounds,
//   2. one KHR_lights_punctual directional light, white, intensity KEY_LUX, coming from above and behind the camera,
// and every renderer is told: no IBL, no generated lights, no ambient, tone map none, exposure 1, clear #20242c.
// The harnessed file is validated by the same gate as the original (it must add 0 errors).
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRLightsPunctual } from '@gltf-transform/extensions';
import { frameFromGlb, normaliseCamera } from '../../../x3d.gltf/render/frame.mjs';

export const KEY_LUX = 2.5;
export const TOWARD_LIGHT_FROM_CAMERA_OFFSET = [-0.6, 0.9, 0]; // added to the camera's offset direction (0.55, 0.35, 1)

const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/** Quaternion [x,y,z,w] that turns -Z (glTF camera and light forward) into `forward`, keeping `up` up. */
export function lookRotation(forward, up = [0, 1, 0]) {
  const f = norm(forward);
  let r = cross(f, up);
  if (Math.hypot(...r) < 1e-6) r = cross(f, [0, 0, 1]);
  r = norm(r);
  const u = cross(r, f);
  const m = [[r[0], u[0], -f[0]], [r[1], u[1], -f[1]], [r[2], u[2], -f[2]]]; // columns: right, up, back
  const tr = m[0][0] + m[1][1] + m[2][2];
  let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = s / 4; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = s / 4; z = (m[1][2] + m[2][1]) / s; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = s / 4; }
  return [x, y, z, w];
}

export async function harness(srcPath, outPath) {
  const camera = normaliseCamera(await frameFromGlb(srcPath));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(srcPath);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const before = { nodes: root.listNodes().length, cameras: root.listCameras().length, lights: 0 };

  const cam = doc.createCamera('loom-camera').setType('perspective').setYFov(camera.fov).setAspectRatio(1).setZNear(camera.near).setZFar(camera.far);
  const camNode = doc.createNode('loom-camera').setCamera(cam).setTranslation(camera.position).setRotation(lookRotation(sub(camera.target, camera.position), camera.up));
  scene.addChild(camNode);

  const towardLight = norm(add(norm(sub(camera.position, camera.target)), TOWARD_LIGHT_FROM_CAMERA_OFFSET));
  const ext = doc.createExtension(KHRLightsPunctual);
  const light = ext.createLight('loom-key').setType('directional').setColor([1, 1, 1]).setIntensity(KEY_LUX);
  const lightNode = doc.createNode('loom-key').setExtension('KHR_lights_punctual', light).setRotation(lookRotation(towardLight.map((x) => -x)));
  scene.addChild(lightNode);

  await io.write(outPath, doc);
  const cameraIndex = doc.getRoot().listCameras().indexOf(cam);
  return {
    camera, cameraIndex,
    light: { type: 'directional', color: [1, 1, 1], intensity_lux: KEY_LUX, travels_along: towardLight.map((x) => +(-x).toFixed(6)) },
    added: { nodes: 2, cameras: 1, lights: 1 }, before,
    bytes: fs.statSync(outPath).size,
  };
}
