// Writes x3d/examples/*.x3d: small scenes that use the library through ExternProtoDeclare.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { externDecls } from './build.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const head = (title, comps = ['HAnim', 'Scripting']) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">
<X3D profile='Immersive' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>
<head>
${comps.map((c) => `  <component name='${c}' level='1'/>`).join('\n')}
  <meta name='title' content='${title}'/>
  <meta name='creator' content='x3d.loom x3d.springbone (own code and geometry, CC0)'/>
  <meta name='license' content='CC0-1.0'/>
</head>
<Scene>
`;
// a tail: n Transforms, each with a capsule drawn in a Group (Groups are not bones)
function tail(prefix, n, seg, radius0, color, rootRot) {
  let open = '', close = '';
  for (let i = 0; i < n; i++) {
    const r = (radius0 * (1 - 0.12 * i)).toFixed(4);
    open += `${'  '.repeat(i + 2)}<Transform DEF='${prefix}${i}'${i ? ` translation='0 ${-seg} 0'` : (rootRot ? ` rotation='${rootRot}'` : '')}>
${'  '.repeat(i + 3)}<Group><Transform translation='0 ${-seg / 2} 0'><Shape><Appearance><Material diffuseColor='${color}'/></Appearance><Cylinder radius='${r}' height='${seg}'/></Shape></Transform>
${'  '.repeat(i + 3)}<Shape><Appearance><Material diffuseColor='${color}'/></Appearance><Sphere radius='${r}'/></Shape></Group>
`;
    close = `${'  '.repeat(i + 2)}</Transform>\n` + close;
  }
  return open + close;
}

export function tailScene(opts = {}) {
  const url = opts.url || '../SpringBone.x3d';
  const n = 6, seg = 0.12;
  return head('tail.x3d') + externDecls(url) + `  <NavigationInfo type='"EXAMINE" "ANY"'/>
  <Viewpoint description='Tail' position='0 -0.3 2.2' centerOfRotation='0 -0.35 0'/>
  <Background skyColor='0.12 0.13 0.16'/>
  <DirectionalLight direction='-0.4 -1 -0.6'/>
  <Transform DEF='Base'>
    <Shape><Appearance><Material diffuseColor='0.8 0.8 0.85'/></Appearance><Box size='0.25 0.05 0.25'/></Shape>
${tail('Tail', n, seg, 0.035, '0.95 0.55 0.2', opts.rootRotation)}  </Transform>
  <Transform DEF='Ball' translation='0.12 -0.55 0'>
    <Shape><Appearance><Material diffuseColor='0.3 0.6 0.9' transparency='0.3'/></Appearance><Sphere radius='0.1'/></Shape>
  </Transform>
  <TimeSensor DEF='SwayClock' cycleInterval='2.5' loop='${opts.sway === false ? 'false' : 'true'}'/>
  <PositionInterpolator DEF='Sway' key='0 0.25 0.5 0.75 1' keyValue='0 0 0 0.25 0 0 0 0 0 -0.25 0 0 0 0 0'/>
  <ROUTE fromNode='SwayClock' fromField='fraction_changed' toNode='Sway' toField='set_fraction'/>
  <ROUTE fromNode='Sway' fromField='value_changed' toNode='Base' toField='set_translation'/>
  <ProtoInstance name='SpringBoneCollider' DEF='BallCollider'>
    <fieldValue name='shape' value='SPHERE'/>
    <fieldValue name='radius' value='0.1'/>
    <fieldValue name='ancestors'><Transform USE='Ball'/></fieldValue>
  </ProtoInstance>
  <ProtoInstance name='SpringBoneChain' DEF='TailSpring'>
    <fieldValue name='roots'><Transform USE='Tail0'/></fieldValue>
    <fieldValue name='ancestors'><Transform USE='Base'/></fieldValue>
    <fieldValue name='colliders'><ProtoInstance name='SpringBoneCollider' USE='BallCollider'/></fieldValue>
    <fieldValue name='damping' value='0.08'/>
    <fieldValue name='elasticity' value='0.04'/>
    <fieldValue name='stiffness' value='0.05'/>
    <fieldValue name='radius' value='0.03'/>
    <fieldValue name='endLength' value='1'/>
    <fieldValue name='gravity' value='0 -0.0006 0'/>
    <fieldValue name='gravityRestCompensation' value='false'/>
    <fieldValue name='clock' value='${opts.clock === false ? 'false' : 'true'}'/>
  </ProtoInstance>
</Scene>
</X3D>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(join(ROOT, 'x3d', 'examples', 'tail.x3d'), tailScene());
  writeFileSync(join(ROOT, 'x3d', 'examples', 'tail-replay.x3d'), tailScene({ clock: false, sway: false, rootRotation: '0 0 1 1.0471975512' }));
  console.log('wrote x3d/examples/tail.x3d, tail-replay.x3d');
}
