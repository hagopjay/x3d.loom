// Regenerates fixtures/*.x3d deterministically. Run: node tools/make-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { makeVolume } from '../src/ref/volume.js';
import { cloud } from '../src/ref/splats.js';
const head = (t, d) => `<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd">\n  <head><meta name="title" content="${t}"/><meta name="description" content="${d}"/></head>\n  <Scene>\n`;
const foot = '  </Scene>\n</X3D>\n';
const w = (n, s) => writeFileSync(new URL('../fixtures/' + n, import.meta.url), s);
const r5 = (x) => (+x.toFixed(5)).toString();

w('particles-cone-wind.x3d', head('particles-cone-wind.x3d', 'x3d.compute fixture: ConeEmitter + ForcePhysicsModel + WindPhysicsModel + BoundedPhysicsModel floor') + `    <Shape><Appearance><Material emissiveColor="1 0.7 0.2"/></Appearance>
      <ParticleSystem DEF="PS" maxParticles="4096" particleLifetime="3" lifetimeVariation="0.1" geometryType="POINT">
        <ConeEmitter containerField="emitter" position="0 0.2 0" direction="0 1 0" angle="0.5236" speed="4" variation="0.25" mass="0.01" surfaceArea="0"/>
        <ForcePhysicsModel containerField="physics" force="0 -9.8 0"/>
        <WindPhysicsModel containerField="physics" direction="1 0 0.3" speed="1.5" gustiness="0" turbulence="0"/>
        <BoundedPhysicsModel containerField="physics"><Box size="40 6 40"/></BoundedPhysicsModel>
      </ParticleSystem>
    </Shape>\n` + foot);

// HAnim: 3 joints, 9 rings x 16 verts along Y (y = 0..8), joints at y = 0, 4, 8, triangular weights
const rings = 9, per = 16, pts = [], idx = [[], [], []], wt = [[], [], []];
for (let r = 0; r < rings; r++) for (let a = 0; a < per; a++) {
  const v = r * per + a, y = r, th = a / per * 2 * Math.PI; pts.push(`${r5(0.4 * Math.cos(th))} ${y} ${r5(0.4 * Math.sin(th))}`);
  const w0 = Math.max(0, 1 - y / 4), w2 = Math.max(0, (y - 4) / 4), w1 = 1 - w0 - w2;
  [[0, w0], [1, w1], [2, w2]].forEach(([j, x]) => { if (x > 0) { idx[j].push(v); wt[j].push(r5(x)); } });
}
w('hanim-chain.x3d', head('hanim-chain.x3d', 'x3d.compute fixture: HAnimHumanoid, 3-joint chain, 144 skin vertices; the harness poses joints') + `    <HAnimHumanoid DEF="H" name="chain" version="2.0">
      <HAnimJoint DEF="J0" name="humanoid_root" containerField="skeleton" skinCoordIndex="${idx[0].join(' ')}" skinCoordWeight="${wt[0].join(' ')}">
        <HAnimJoint DEF="J1" name="vl5" translation="0 4 0" skinCoordIndex="${idx[1].join(' ')}" skinCoordWeight="${wt[1].join(' ')}">
          <HAnimJoint DEF="J2" name="vc7" translation="0 4 0" skinCoordIndex="${idx[2].join(' ')}" skinCoordWeight="${wt[2].join(' ')}"/>
        </HAnimJoint>
      </HAnimJoint>
      <HAnimJoint USE="J0" containerField="joints"/><HAnimJoint USE="J1" containerField="joints"/><HAnimJoint USE="J2" containerField="joints"/>
      <Coordinate containerField="skinCoord" point="${pts.join(', ')}"/>
    </HAnimHumanoid>\n` + foot);

const d = 8, vox = makeVolume(d);
for (const [name, style] of [['volume-opacity.x3d', '<OpacityMapVolumeStyle containerField="renderStyle"/>'], ['volume-mip.x3d', '<ProjectionVolumeStyle containerField="renderStyle" type="MAX"/>']]) {
  w(name, head(name, 'x3d.compute fixture: 8x8x8 VolumeData, procedural shell + lobe') + `    <VolumeData dimensions="1 1 1">
      ${style}
      <PixelTexture3D containerField="voxels" image="${d} ${d} ${d} 1 ${Array.from(vox).join(' ')}"/>
    </VolumeData>\n` + foot);
}

const P4 = (z) => { const p = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) p.push(`${i} ${j} ${z(i, j)}`); return p.join(', '); };
w('nurbs-patches.x3d', head('nurbs-patches.x3d', 'x3d.compute fixture: five open NurbsPatchSurface cases (default order 3 on a 4x4 net, rational quarter cylinder, custom knots, order 5x4, non-square default order)') + `    <Shape><NurbsPatchSurface DEF="P_order3_4x4" uDimension="4" vDimension="4" uTessellation="24" vTessellation="24"><Coordinate containerField="controlPoint" point="${P4((i, j) => (i === 1 || i === 2) && (j === 1 || j === 2) ? 1.5 : 0)}"/></NurbsPatchSurface></Shape>
    <Shape><NurbsPatchSurface DEF="P_quarter_cylinder" uDimension="3" vDimension="2" uOrder="3" vOrder="2" uKnot="0 0 0 1 1 1" vKnot="0 0 1 1" uTessellation="16" vTessellation="4" weight="1 0.7071067811865476 1 1 0.7071067811865476 1"><Coordinate containerField="controlPoint" point="1 0 0, 1 1 0, 0 1 0, 1 0 1, 1 1 1, 0 1 1"/></NurbsPatchSurface></Shape>
    <Shape><NurbsPatchSurface DEF="P_knots" uDimension="4" vDimension="4" uOrder="4" vOrder="2" uKnot="0 0 0 0 1 1 1 1" vKnot="0 0 0.5 1 1" uTessellation="14" vTessellation="-2"><Coordinate containerField="controlPoint" point="${P4((i, j) => (i + j) % 2)}"/></NurbsPatchSurface></Shape>
    <Shape><NurbsPatchSurface DEF="P_order5" uDimension="5" vDimension="4" uOrder="5" vOrder="4" uTessellation="20" vTessellation="20"><Coordinate containerField="controlPoint" point="${Array.from({ length: 20 }, (_, n) => { const i = n % 5, j = (n / 5) | 0; return `${i} ${j} ${((i * 3 + j * 5) % 4) * 0.5}`; }).join(', ')}"/></NurbsPatchSurface></Shape>
    <Shape><NurbsPatchSurface DEF="P_default_order" uDimension="4" vDimension="5" uTessellation="9" vTessellation="11"><Coordinate containerField="controlPoint" point="${Array.from({ length: 20 }, (_, n) => { const i = n % 4, j = (n / 4) | 0; return `${i} ${j} ${Math.sin(i + j)}`.replace(/(\.\d{4})\d+/g, '$1'); }).join(', ')}"/></NurbsPatchSurface></Shape>\n` + foot);

const c = cloud(2048, 11), f5 = (a, n, stride, off = 0, k = n) => Array.from({ length: n }, (_, i) => Array.from({ length: k }, (_, d) => r5(a[i * stride + off + d])).join(' ')).join(' ');
w('splats-disc.x3d', head('splats-disc.x3d', 'x3d.compute fixture: 2048 GaussianSplats on a disc, deterministic (seed 11)') + `    <GaussianSplats DEF="Disc" positions="${f5(c.pos, c.n, 4, 0, 3)}" scales="${f5(c.scl, c.n, 4, 0, 3)}" orientations="${f5(c.quat, c.n, 4, 0, 4)}" opacities="${Array.from({ length: c.n }, (_, i) => r5(c.pos[i * 4 + 3])).join(' ')}"/>\n` + foot);
console.log('fixtures written');
