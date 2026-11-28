// Demo 87 scene: four spring-bone exhibits in one X3D 4.0 file, all geometry our own (CC0).
//   1 Ponytail on an HAnim 2.0 figure (custom hair joints under skullbase), head and shoulder colliders
//   2 Fox tail: a Transform chain on a draggable body (PlaneSensor)
//   3 Bead fringe: 7 roots in one chain on a bar, and a ball you drag through it (a collider)
//   4 Antenna tree: one root, two branches (branchMode MEAN), tip particles
// usage: node tools/make_demo.mjs <out.x3d> [library url, default x3d/SpringBone.x3d]
import { writeFileSync } from 'node:fs';
import { externDecls } from './build.mjs';

const out = process.argv[2] || 'spring-lab.x3d';
const lib = process.argv[3] || 'x3d/SpringBone.x3d';
const f = (x) => (Math.abs(x) < 1e-12 ? '0' : (+x.toFixed(5)).toString());
const v = (a) => a.map(f).join(' ');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(...a);
// axis-angle that turns +Y onto d
function yTo(d) {
  const l = len(d), u = d.map((x) => x / l), c = u[1];
  const ax = [u[2], 0, -u[0]], al = len(ax);
  if (al < 1e-9) return c > 0 ? '0 0 1 0' : '1 0 0 3.14159';
  return `${f(ax[0] / al)} 0 ${f(ax[2] / al)} ${f(Math.acos(Math.max(-1, Math.min(1, c))))}`;
}
const mat = (c, extra = '') => `<Appearance><PhysicalMaterial baseColor='${c}' roughness='0.55' metallic='0'${extra}/></Appearance>`;
// a capsule from a to b (in the current frame), drawn as cylinder + end sphere
const capsule = (a, b, r, c) => {
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return `<Transform translation='${v(m)}' rotation='${yTo(sub(b, a))}'><Shape>${mat(c)}<Cylinder radius='${f(r)}' height='${f(len(sub(b, a)))}' top='false' bottom='false'/></Shape></Transform>` +
         `<Transform translation='${v(b)}'><Shape>${mat(c)}<Sphere radius='${f(r)}'/></Shape></Transform>`;
};

let x = '';
// ---------------------------------------------------------------- 1 ponytail figure (HAnim 2.0)
const J = {
  humanoid_root: [0, 0.95, 0], sacroiliac: [0, 1.0, 0], vl5: [0, 1.12, 0], vc7: [0, 1.48, 0], skullbase: [0, 1.58, 0],
};
const hair = [];
for (let i = 0; i < 7; i++) hair.push([0, 1.74 - 0.075 * i, -0.13 - 0.03 * i]);
let jointsList = Object.keys(J).map((n) => `hanim_${n}`);
hair.forEach((_, i) => jointsList.push(`hanim_hair_${i + 1}`));
const seg = (name, body) => `<HAnimSegment DEF='hanim_${name}_seg' name='${name}'>${body}</HAnimSegment>`;
const skin = '0.86 0.68 0.56', cloth = '0.25 0.36 0.62', hairC = '0.42 0.22 0.1';
let hairXml = '';
for (let i = hair.length - 1; i >= 0; i--) {
  const a = hair[i], b = i < hair.length - 1 ? hair[i + 1] : [a[0], a[1] - 0.07, a[2] - 0.02];
  const r = 0.038 * (1 - i * 0.1);
  hairXml = `<HAnimJoint DEF='hanim_hair_${i + 1}' name='hair_${i + 1}' center='${v(a)}'>${seg(`hair_${i + 1}`, capsule(a, b, r, hairC))}${hairXml}</HAnimJoint>`;
}
const head = `<Transform translation='0 1.68 0'><Shape>${mat(skin)}<Sphere radius='0.11'/></Shape></Transform>` +
  `<Transform translation='0 1.705 -0.03' scale='1.04 0.9 1.05'><Shape>${mat(hairC)}<Sphere radius='0.112'/></Shape></Transform>` +
  `<Transform translation='0.04 1.69 0.1'><Shape>${mat('0.1 0.1 0.12')}<Sphere radius='0.014'/></Shape></Transform>` +
  `<Transform translation='-0.04 1.69 0.1'><Shape>${mat('0.1 0.1 0.12')}<Sphere radius='0.014'/></Shape></Transform>`;
x += `
  <Transform DEF='FigureDrag'>
    <PlaneSensor DEF='FigureSensor' axisRotation='1 0 0 -1.5708' description='drag the figure'/>
    <Transform DEF='FigureBob'>
    <HAnimHumanoid DEF='hanim_Ada' name='Ada' version='2.0' skeletalConfiguration='BASIC' info='"authorName=x3d.loom (own mannequin, CC0)"'>
      <HAnimJoint DEF='hanim_humanoid_root' name='humanoid_root' center='${v(J.humanoid_root)}' containerField='skeleton'>
        <HAnimJoint DEF='hanim_sacroiliac' name='sacroiliac' center='${v(J.sacroiliac)}'>
          ${seg('pelvis', capsule([-0.1, 0.98, 0], [0.1, 0.98, 0], 0.1, cloth) + capsule([-0.09, 0.95, 0], [-0.09, 0.1, 0], 0.07, cloth) + capsule([0.09, 0.95, 0], [0.09, 0.1, 0], 0.07, cloth))}
          <HAnimJoint DEF='hanim_vl5' name='vl5' center='${v(J.vl5)}'>
            ${seg('l5', capsule([0, 1.05, 0], [0, 1.38, 0], 0.15, cloth) + capsule([-0.17, 1.42, 0], [0.17, 1.42, 0], 0.075, cloth) +
                  capsule([-0.2, 1.42, 0], [-0.24, 0.95, 0.05], 0.05, skin) + capsule([0.2, 1.42, 0], [0.24, 0.95, 0.05], 0.05, skin))}
            <HAnimJoint DEF='hanim_vc7' name='vc7' center='${v(J.vc7)}'>
              ${seg('c7', capsule([0, 1.46, 0], [0, 1.6, 0], 0.05, skin))}
              <HAnimJoint DEF='hanim_skullbase' name='skullbase' center='${v(J.skullbase)}'>
                ${seg('skull', head)}
                ${hairXml}
              </HAnimJoint>
            </HAnimJoint>
          </HAnimJoint>
        </HAnimJoint>
      </HAnimJoint>
${jointsList.map((d) => `      <HAnimJoint USE='${d}' containerField='joints'/>`).join('\n')}
    </HAnimHumanoid>
    </Transform>
  </Transform>
  <TimeSensor DEF='HeadClock' cycleInterval='4' loop='true'/>
  <OrientationInterpolator DEF='HeadTurn' key='0 0.15 0.3 0.5 0.6 0.75 0.9 1' keyValue='0 1 0 0  0 1 0 0  0 1 0 0.8  0 1 0 0.8  0 1 0 0.8  0 1 0 -0.7  0 1 0 -0.7  0 1 0 0'/>
  <PositionInterpolator DEF='Bob' key='0 0.25 0.5 0.75 1' keyValue='0 0 0  0 0.04 0  0 0 0  0 0.04 0  0 0 0'/>
  <ROUTE fromNode='HeadClock' fromField='fraction_changed' toNode='HeadTurn' toField='set_fraction'/>
  <ROUTE fromNode='HeadTurn' fromField='value_changed' toNode='hanim_skullbase' toField='set_rotation'/>
  <ROUTE fromNode='HeadClock' fromField='fraction_changed' toNode='Bob' toField='set_fraction'/>
  <ROUTE fromNode='Bob' fromField='value_changed' toNode='FigureBob' toField='set_translation'/>
  <ROUTE fromNode='FigureSensor' fromField='translation_changed' toNode='FigureDrag' toField='set_translation'/>
  <ProtoInstance name='SpringBoneCollider' DEF='HeadCollider'>
    <fieldValue name='center' value='0 1.69 -0.01'/>
    <fieldValue name='radius' value='0.11'/>
    <fieldValue name='ancestors'><Transform USE='FigureDrag'/><Transform USE='FigureBob'/><HAnimHumanoid USE='hanim_Ada'/><HAnimJoint USE='hanim_humanoid_root'/><HAnimJoint USE='hanim_sacroiliac'/><HAnimJoint USE='hanim_vl5'/><HAnimJoint USE='hanim_vc7'/><HAnimJoint USE='hanim_skullbase'/></fieldValue>
  </ProtoInstance>
  <ProtoInstance name='SpringBoneCollider' DEF='ShoulderCollider'>
    <fieldValue name='shape' value='CAPSULE'/>
    <fieldValue name='direction' value='X'/>
    <fieldValue name='center' value='0 1.40 -0.02'/>
    <fieldValue name='radius' value='0.13'/>
    <fieldValue name='height' value='0.6'/>
    <fieldValue name='ancestors'><Transform USE='FigureDrag'/><Transform USE='FigureBob'/><HAnimHumanoid USE='hanim_Ada'/><HAnimJoint USE='hanim_humanoid_root'/><HAnimJoint USE='hanim_sacroiliac'/><HAnimJoint USE='hanim_vl5'/></fieldValue>
  </ProtoInstance>
  <ProtoInstance name='SpringBoneChain' DEF='Ponytail'>
    <fieldValue name='roots'><HAnimJoint USE='hanim_hair_1'/></fieldValue>
    <fieldValue name='ancestors'><Transform USE='FigureDrag'/><Transform USE='FigureBob'/><HAnimHumanoid USE='hanim_Ada'/><HAnimJoint USE='hanim_humanoid_root'/><HAnimJoint USE='hanim_sacroiliac'/><HAnimJoint USE='hanim_vl5'/><HAnimJoint USE='hanim_vc7'/><HAnimJoint USE='hanim_skullbase'/></fieldValue>
    <fieldValue name='reference'><Transform USE='FigureDrag'/></fieldValue>
    <fieldValue name='colliders'><ProtoInstance name='SpringBoneCollider' USE='HeadCollider'/><ProtoInstance name='SpringBoneCollider' USE='ShoulderCollider'/></fieldValue>
    <fieldValue name='springModel' value='FORCE'/>
    <fieldValue name='frequency' value='1.6'/>
    <fieldValue name='dampingRatio' value='0.3'/>
    <fieldValue name='stiffness' value='0.02'/>
    <fieldValue name='radius' value='0.025'/>
    <fieldValue name='radiusCurve' value='0 1 1 0.6'/>
    <fieldValue name='gravity' value='0 -9.81 0'/>
    <fieldValue name='forceUnits' value='M_PER_S2'/>
    <fieldValue name='angleLimit' value='60'/>
    <fieldValue name='endLength' value='0.8'/>
    <fieldValue name='inert' value='0.2'/>
  </ProtoInstance>`;

// ---------------------------------------------------------------- 2 fox tail on a draggable body
let tail = '', tailClose = '';
const tn = 8;
for (let i = 0; i < tn; i++) {
  const r = 0.055 * (1 - i * 0.07) + (i > tn - 3 ? 0.01 : 0);
  const c = i >= tn - 2 ? '0.97 0.96 0.93' : '0.86 0.42 0.12';
  tail += `<Transform DEF='Tail${i}' translation='${i ? '0 0 -0.11' : '0 0.05 -0.28'}'${i ? '' : " rotation='1 0 0 0.5'"}><Group>${capsule([0, 0, 0], [0, 0, -0.11], r, c)}</Group>`;
  tailClose += '</Transform>';
}
x += `
  <Transform DEF='FoxDrag' translation='1.3 0 0'>
    <PlaneSensor DEF='FoxSensor' axisRotation='1 0 0 -1.5708' offset='1.3 0 0' description='drag the fox'/>
    <Transform DEF='FoxTurn' rotation='0 1 0 -1.5708'>
    <Transform DEF='FoxBody' translation='0 0.42 0'>
      <Group>${capsule([0, 0, -0.25], [0, 0.02, 0.22], 0.13, '0.86 0.42 0.12')}
        <Transform translation='0 0.13 0.3'><Shape>${mat('0.86 0.42 0.12')}<Sphere radius='0.1'/></Shape></Transform>
        <Transform translation='0.05 0.24 0.3' rotation='0 0 1 -0.3'><Shape>${mat('0.3 0.15 0.08')}<Cone bottomRadius='0.035' height='0.1'/></Shape></Transform>
        <Transform translation='-0.05 0.24 0.3' rotation='0 0 1 0.3'><Shape>${mat('0.3 0.15 0.08')}<Cone bottomRadius='0.035' height='0.1'/></Shape></Transform>
        <Transform translation='0 0.11 0.42'><Shape>${mat('0.1 0.08 0.08')}<Sphere radius='0.025'/></Shape></Transform>
        ${[[-0.08, 0.15], [0.08, 0.15], [-0.08, -0.17], [0.08, -0.17]].map(([lx, lz]) => capsule([lx, -0.02, lz], [lx, -0.4, lz], 0.03, '0.3 0.15 0.08')).join('')}
      </Group>
      ${tail}${tailClose}
    </Transform>
    </Transform>
  </Transform>
  <ROUTE fromNode='FoxSensor' fromField='translation_changed' toNode='FoxDrag' toField='set_translation'/>
  <TimeSensor DEF='TrotClock' cycleInterval='0.6' loop='true'/>
  <OrientationInterpolator DEF='Trot' key='0 0.25 0.5 0.75 1' keyValue='0 0 1 0  0 0 1 0.06  0 0 1 0  0 0 1 -0.06  0 0 1 0'/>
  <ROUTE fromNode='TrotClock' fromField='fraction_changed' toNode='Trot' toField='set_fraction'/>
  <ROUTE fromNode='Trot' fromField='value_changed' toNode='FoxBody' toField='set_rotation'/>
  <ProtoInstance name='SpringBoneCollider' DEF='FoxGround'>
    <fieldValue name='shape' value='PLANE'/>
    <fieldValue name='center' value='0 0.01 0'/>
    <fieldValue name='ancestors'></fieldValue>
  </ProtoInstance>
  <ProtoInstance name='SpringBoneChain' DEF='FoxTail'>
    <fieldValue name='roots'><Transform USE='Tail0'/></fieldValue>
    <fieldValue name='ancestors'><Transform USE='FoxDrag'/><Transform USE='FoxTurn'/><Transform USE='FoxBody'/></fieldValue>
    <fieldValue name='reference'><Transform USE='FoxDrag'/></fieldValue>
    <fieldValue name='colliders'><ProtoInstance name='SpringBoneCollider' USE='FoxGround'/></fieldValue>
    <fieldValue name='springModel' value='FORCE'/>
    <fieldValue name='frequency' value='2.2'/>
    <fieldValue name='dampingRatio' value='0.25'/>
    <fieldValue name='stiffness' value='0.08'/>
    <fieldValue name='stiffnessCurve' value='0 1 1 0.2'/>
    <fieldValue name='radius' value='0.05'/>
    <fieldValue name='gravity' value='0 -4 0'/>
    <fieldValue name='forceUnits' value='M_PER_S2'/>
    <fieldValue name='endLength' value='1'/>
  </ProtoInstance>`;

// ---------------------------------------------------------------- 3 bead fringe + a draggable ball
let fringe = '';
const roots = [];
for (let k = 0; k < 7; k++) {
  const fx = -0.36 + k * 0.12;
  let open = '', close = '';
  for (let i = 0; i < 6; i++) {
    const hue = ['0.9 0.3 0.35', '0.95 0.75 0.2', '0.3 0.75 0.55', '0.3 0.5 0.95', '0.7 0.4 0.9', '0.95 0.5 0.2', '0.4 0.85 0.9'][k];
    open += `<Transform DEF='Fringe${k}_${i}' translation='${i ? '0 -0.1 0' : `${f(fx)} -0.03 0`}'><Group><Transform translation='0 -0.05 0'><Shape>${mat('0.8 0.8 0.8')}<Cylinder radius='0.004' height='0.1'/></Shape></Transform><Transform translation='0 -0.1 0'><Shape>${mat(hue)}<Sphere radius='0.026'/></Shape></Transform></Group>`;
    close += '</Transform>';
  }
  fringe += open + close;
  roots.push(`<Transform USE='Fringe${k}_0'/>`);
}
x += `
  <Transform DEF='FringeBar' translation='-1.3 1.5 0'>
    <Transform rotation='0 0 1 1.5708'><Shape>${mat('0.55 0.4 0.25')}<Cylinder radius='0.025' height='0.9'/></Shape></Transform>
    ${fringe}
  </Transform>
  <TimeSensor DEF='SwingClock' cycleInterval='4' loop='true'/>
  <OrientationInterpolator DEF='Swing' key='0 0.15 0.3 0.6 1' keyValue='0 1 0 0  0 1 0 0.3  0 1 0 0  0 1 0 0  0 1 0 0'/>
  <ROUTE fromNode='SwingClock' fromField='fraction_changed' toNode='Swing' toField='set_fraction'/>
  <ROUTE fromNode='Swing' fromField='value_changed' toNode='FringeBar' toField='set_rotation'/>
  <Transform DEF='BallDrag' translation='-1.3 0.95 0.35'>
    <PlaneSensor DEF='BallSensor' offset='-1.3 0.95 0.35' description='drag the ball through the fringe'/>
    <Shape>${mat('0.85 0.88 0.95', " transparency='0.25'")}<Sphere radius='0.12'/></Shape>
  </Transform>
  <ROUTE fromNode='BallSensor' fromField='translation_changed' toNode='BallDrag' toField='set_translation'/>
  <ProtoInstance name='SpringBoneCollider' DEF='BallCollider'>
    <fieldValue name='radius' value='0.12'/>
    <fieldValue name='ancestors'><Transform USE='BallDrag'/></fieldValue>
  </ProtoInstance>
  <ProtoInstance name='SpringBoneChain' DEF='Fringe'>
    <fieldValue name='roots'>${roots.join('')}</fieldValue>
    <fieldValue name='ancestors'><Transform USE='FringeBar'/></fieldValue>
    <fieldValue name='colliders'><ProtoInstance name='SpringBoneCollider' USE='BallCollider'/></fieldValue>
    <fieldValue name='springModel' value='FORCE'/>
    <fieldValue name='frequency' value='1.2'/>
    <fieldValue name='dampingRatio' value='0.2'/>
    <fieldValue name='angleLimit' value='80'/>
    <fieldValue name='stiffness' value='0'/>
    <fieldValue name='radius' value='0.028'/>
    <fieldValue name='gravity' value='0 -9.81 0'/>
    <fieldValue name='forceUnits' value='M_PER_S2'/>
    <fieldValue name='gravityRestCompensation' value='false'/>
    <fieldValue name='endOffset' value='0 -0.1 0'/>
    <fieldValue name='wind' value='0 0 0.8'/>
    <fieldValue name='windTurbulence' value='1'/>
    <fieldValue name='windFrequency' value='0.4'/>
  </ProtoInstance>`;

// ---------------------------------------------------------------- 4 antenna tree (branches)
const branch = (name, dir, n) => {
  let o = '', c = '';
  for (let i = 0; i < n; i++) { o += `<Transform DEF='${name}${i}' translation='${i ? v(dir) : '0 0.18 0'}'><Group>${capsule([0, 0, 0], dir, 0.012, '0.25 0.9 0.6')}</Group>`; c += '</Transform>'; }
  return o + c;
};
x += `
  <Transform DEF='AntennaBase' translation='2.4 0.6 0'>
    <Shape>${mat('0.3 0.3 0.35')}<Cylinder radius='0.12' height='0.06'/></Shape>
    <Transform DEF='Stalk0'><Group>${capsule([0, 0, 0], [0, 0.18, 0], 0.02, '0.25 0.9 0.6')}</Group>
      <Transform DEF='Stalk1' translation='0 0.18 0'><Group>${capsule([0, 0, 0], [0, 0.18, 0], 0.018, '0.25 0.9 0.6')}</Group>
        ${branch('BranchL', [-0.07, 0.12, 0], 4)}
        ${branch('BranchR', [0.07, 0.12, 0], 4)}
      </Transform>
    </Transform>
  </Transform>
  <TimeSensor DEF='ShakeClock' cycleInterval='2' loop='true'/>
  <PositionInterpolator DEF='Shake' key='0 0.05 0.1 0.15 0.2 1' keyValue='2.4 0.6 0  2.48 0.6 0  2.32 0.6 0  2.45 0.6 0  2.4 0.6 0  2.4 0.6 0'/>
  <ROUTE fromNode='ShakeClock' fromField='fraction_changed' toNode='Shake' toField='set_fraction'/>
  <ROUTE fromNode='Shake' fromField='value_changed' toNode='AntennaBase' toField='set_translation'/>
  <ProtoInstance name='SpringBoneChain' DEF='Antenna'>
    <fieldValue name='roots'><Transform USE='Stalk0'/></fieldValue>
    <fieldValue name='ancestors'><Transform USE='AntennaBase'/></fieldValue>
    <fieldValue name='springModel' value='FORCE'/>
    <fieldValue name='frequency' value='3'/>
    <fieldValue name='dampingRatio' value='0.08'/>
    <fieldValue name='stiffness' value='0'/>
    <fieldValue name='branchMode' value='MEAN'/>
    <fieldValue name='endLength' value='1'/>
  </ProtoInstance>`;

const scene = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">
<X3D profile='Immersive' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>
<head>
  <component name='HAnim' level='1'/>
  <component name='Scripting' level='1'/>
  <component name='PointingDeviceSensor' level='1'/>
  <component name='Shape' level='2'/>
  <meta name='title' content='spring-lab.x3d'/>
  <meta name='description' content='Demo 87, Spring Bone Lab: SpringBoneChain PROTOs on a ponytail (HAnim 2.0), a fox tail, a bead fringe and an antenna tree.'/>
  <meta name='creator' content='x3d.loom x3d.springbone/tools/make_demo.mjs'/>
  <meta name='license' content='CC0-1.0 (scene and geometry); MIT (SpringBone PROTO library)'/>
</head>
<Scene>
  <WorldInfo title='Spring Bone Lab'/>
${externDecls(lib)}  <NavigationInfo type='"EXAMINE" "ANY"' headlight='false'/>
  <Viewpoint DEF='Overview' description='All four' position='0.45 1.3 5.6' orientation='1 0 0 -0.08' centerOfRotation='0.45 0.9 0'/>
  <Viewpoint DEF='PonyView' description='Ponytail' position='0.9 1.65 1.2' orientation='0 1 0 0.75' centerOfRotation='0 1.5 0'/>
  <Background skyColor='0.09 0.1 0.13 0.16 0.18 0.24' skyAngle='1.4' groundColor='0.09 0.1 0.13 0.12 0.12 0.15' groundAngle='1.4'/>
  <DirectionalLight direction='-0.4 -1 -0.5' intensity='2.2' color='1 0.97 0.92'/>
  <DirectionalLight direction='0.6 -0.3 0.7' intensity='0.8' color='0.7 0.8 1'/>
  <Transform translation='0.55 -0.005 0'><Shape>${mat('0.18 0.19 0.22')}<Box size='5.6 0.01 2.4'/></Shape></Transform>
${x}
</Scene>
</X3D>
`;
writeFileSync(out, scene);
console.log('wrote', out, scene.length, 'bytes');
