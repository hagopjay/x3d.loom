// The cases the verifier and tests run. Each: { id, tool, make() -> {timeline, oracle, source}, scene } ; scene = base X3D file under fixtures/.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { fromTheatre } from '../src/theatre.js'; import { fromGsap } from '../src/gsap.js'; import * as ORRERY from '../src/orrery.js';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), fx = (f) => path.join(HERE, 'fixtures', f);
export const stage = () => fs.readFileSync(fx('stage.x3d'), 'utf8');

const BOX_DEFAULTS = { Box: { scale: { x: 1, y: 1, z: 1 } }, BoxMat: { diffuseColor: { r: 0.9, g: 0.3, b: 0.1 } } };
export const CASES = [
  { id: 'theatre-box', tool: 'Theatre.js', make: () => fromTheatre(JSON.parse(fs.readFileSync(fx('theatre-box.state.json'), 'utf8')), { name: 'theatre_box', defaults: BOX_DEFAULTS }) },
  { id: 'gsap-orbit', tool: 'GSAP', make: () => fromGsap((gsap, t) => {
      const tl = gsap.timeline();
      tl.to(t.Box.translation, { x: 3, duration: 2, ease: 'power2.inOut' }, 0)
        .to(t.Box.translation, { y: 1.5, duration: 1, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
        .to(t.Box.rotation, { y: 270, z: 45, duration: 2.5, ease: 'back.out(1.7)' }, 0.5)
        .to(t.BoxMat.diffuseColor, { r: 0.1, g: 0.9, b: 0.4, duration: 1.5, ease: 'none' }, 1)
        .to(t.BoxMat, { transparency: 0.6, duration: 1.2, ease: 'bounce.out' }, 2.2)
        .to(t.Ball.translation, { x: 2.5, y: 1, duration: 3, ease: 'elastic.out(1,0.5)' }, 0)
        .to(t.Ball.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 1, ease: 'expo.out' }, 2);
      return tl;
    }, { Box: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, BoxMat: { diffuseColor: { r: 0.9, g: 0.3, b: 0.1 }, transparency: 0 },
         Ball: { translation: { x: -3, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } }, { name: 'gsap_orbit' }) },
  { id: 'gsap-orrery', tool: 'GSAP', scene: () => ORRERY.sceneX3d(), make: () => fromGsap(ORRERY.build, ORRERY.rest(), { name: 'orrery', fps: 30 }) },
];
