// Write the standard X3D scenes the Marble Machine generates: one fragment per piece (scenes/pieces/*.x3d) and the default machine
// (scenes/marble-machine.x3d, marbles starting above the hopper so it runs by itself). usage: node tools/export-scenes.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PIECES, buildIR, sanitizeMachine, toX3D } from '../src/machine/index.ts';
import type { Machine } from '../src/machine/index.ts';

mkdirSync('scenes/pieces', { recursive: true });
for (const info of PIECES) {
  const m: Machine = { format: 'x3d-physx-machine/1', name: `Piece: ${info.label}`, marbles: 0, pieces: [{ id: 1, type: info.type, gx: 0, gy: 12, rot: info.rot, params: {} }] };
  writeFileSync(`scenes/pieces/${info.type}.x3d`, toX3D(buildIR(m, { board: false }), { mode: 'run', machine: m }));
}
const m = sanitizeMachine(JSON.parse(readFileSync('scenes/machines/grand-cascade.json', 'utf8'))) as Machine;
writeFileSync('scenes/marble-machine.x3d', toX3D(buildIR(m, { marbleStart: 'hopper' }), { mode: 'run', machine: m }));
writeFileSync('scenes/marble-machine-build.x3d', toX3D(buildIR(m), { mode: 'build', machine: m }));
console.log(`wrote ${PIECES.length} piece fragments, scenes/marble-machine.x3d and scenes/marble-machine-build.x3d`);

// the demos' exports (what each page's Export writes, with its description in a MetadataString)
import { PRESETS as BOX } from '../src/demos/musicbox-scene.ts';
import { buildMusicBox } from '../src/demos/musicbox-scene.ts';
import { PRESETS as DOM, buildDominoes } from '../src/demos/dominoes-scene.ts';
import { buildGalton, defaultGalton } from '../src/demos/galton-scene.ts';
import { buildTrebuchet, defaultTrebuchet } from '../src/demos/trebuchet-scene.ts';
import type { MachineIR, SceneMeta } from '../src/machine/index.ts';
mkdirSync('scenes/demos', { recursive: true });
const demo = (file: string, id: string, state: unknown, b: { ir: MachineIR; meta: SceneMeta }) =>
  writeFileSync(`scenes/demos/${file}.x3d`, toX3D(b.ir, { mode: 'run', meta: { ...b.meta, metaName: 'X3dPhysxDemo', metaValue: { demo: id, state } } }));
const box = BOX.twinkle(); demo('musicbox-twinkle', 'musicbox', box, buildMusicBox(box));
const spiral = DOM.spiral(0.45); spiral.friction = 0.2; demo('dominoes-spiral', 'dominoes', spiral, buildDominoes(spiral));
const g = defaultGalton(); demo('galton-board', 'galton', g, buildGalton(g));
const t = defaultTrebuchet(); demo('trebuchet-keep', 'trebuchet', t, buildTrebuchet(t));
console.log('wrote 4 demo scenes in scenes/demos');
