// Builds the two shipped files from one field table:
//   x3d/springbone-script.js  springbone-core.js + a generated readParams() + x3d-script-glue.js
//   x3d/SpringBone.x3d        ProtoDeclare SpringBoneChain and SpringBoneCollider (X3D 4.0, XML encoding)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// name, X3D type, default (X3D XML attribute text), one-line meaning
export const CHAIN_FIELDS = [
  ['enabled', 'SFBool', 'true', 'off: the bones keep their animated pose'],
  ['clock', 'SFBool', 'true', 'step on the PROTO\'s own TimeSensor; false: step only on set_time (replays, tests, a shared clock)'],
  ['roots', 'MFNode', null, 'first bone of each chain (HAnimJoint or Transform, by USE); the tree below it is walked'],
  ['ancestors', 'MFNode', null, 'the nodes from the scene root down to the roots\' parent, outermost first (their fields give the world frame)'],
  ['reference', 'MFNode', null, 'optional: the frame whose motion `inert` cancels (default: ancestors)'],
  ['colliders', 'MFNode', null, 'SpringBoneCollider instances'],
  ['exclusions', 'MFNode', null, 'bones (and the trees below them) that are not simulated'],
  ['boneTypes', 'MFString', '"HAnimJoint" "Transform"', 'node types followed as bones when walking children'],
  ['updateRate', 'SFFloat', '60', 'solver steps per second'],
  ['timeMode', 'SFString', 'FIXED', 'FIXED: steps of 1/updateRate (display-rate free); VARIABLE: one step per frame scaled by dt (the Unity asset default)'],
  ['maxSubsteps', 'SFInt32', '3', 'FIXED: most steps in one frame; the rest is dropped and reported in droppedTime'],
  ['interpolate', 'SFBool', 'false', 'FIXED: draw between the last two solver states'],
  ['springModel', 'SFString', 'POSITION', 'POSITION: pull toward the rest place after the move (the asset\'s); FORCE: pull as a force (any damping ratio)'],
  ['damping', 'SFFloat', '0.1', 'share of velocity lost per step, 0..1'],
  ['elasticity', 'SFFloat', '0.1', 'pull toward the animated pose per step, 0..1'],
  ['stiffness', 'SFFloat', '0.1', 'how far a bone may leave its animated place: allowance = 2 (1 - stiffness) bone length'],
  ['inert', 'SFFloat', '0', 'share of the reference\'s motion carried rigidly, 0..1'],
  ['friction', 'SFFloat', '0', 'extra damping on the step after a collision, 0..1'],
  ['radius', 'SFFloat', '0', 'particle radius for colliders, metres (scaled with the reference)'],
  ['angleLimit', 'SFFloat', '0', 'degrees a bone may swing from its animated direction (0: no limit)'],
  ['stretch', 'SFFloat', '0', '0: rigid bones; 1: free length (jiggle); writes translation when above 0'],
  ['dampingCurve', 'MFVec2f', '', 'multiplier over depth: (depth 0..1, factor) keys, linear'],
  ['elasticityCurve', 'MFVec2f', '', ''], ['stiffnessCurve', 'MFVec2f', '', ''], ['inertCurve', 'MFVec2f', '', ''],
  ['frictionCurve', 'MFVec2f', '', ''], ['radiusCurve', 'MFVec2f', '', ''], ['angleLimitCurve', 'MFVec2f', '', ''], ['stretchCurve', 'MFVec2f', '', ''],
  ['frequency', 'SFFloat', '0', 'physical tuning, Hz: above 0 it sets damping and elasticity exactly (see SPEC section 4)'],
  ['dampingRatio', 'SFFloat', '0.2', 'physical tuning: 0 never settles, 1 critically damped'],
  ['endLength', 'SFFloat', '0', 'adds a tip particle on each leaf: the last bone continued by this share of its length'],
  ['endOffset', 'SFVec3f', '0 0 0', 'adds a tip particle at this offset in the leaf bone\'s frame (when endLength is 0)'],
  ['gravity', 'SFVec3f', '0 0 0', 'world gravity; per step (PER_STEP) or m/s^2 (M_PER_S2)'],
  ['force', 'SFVec3f', '0 0 0', 'extra world force, same units as gravity'],
  ['forceUnits', 'SFString', 'PER_STEP', 'PER_STEP (the asset\'s units: metres per step at updateRate) or M_PER_S2'],
  ['gravityRestCompensation', 'SFBool', 'true', 'remove the part of gravity the rest pose already holds (the asset does this)'],
  ['wind', 'SFVec3f', '0 0 0', 'world wind force, same units as gravity'],
  ['windTurbulence', 'SFFloat', '0', 'gust strength, share of wind'],
  ['windFrequency', 'SFFloat', '1', 'gust rate, Hz'],
  ['seed', 'SFInt32', '1', 'gust phase seed'],
  ['freezeAxis', 'SFString', 'NONE', 'NONE, X, Y or Z: keep each bone in the plane normal to its parent\'s axis'],
  ['branchMode', 'SFString', 'SKIP', 'a bone with several child bones: SKIP leaves it (the asset\'s rule), MEAN turns it to the mean child direction'],
  ['weight', 'SFFloat', '1', 'blend: 0 animated pose, 1 simulated'],
  ['resetDistance', 'SFFloat', '0', 'snap to the animated pose when the reference jumps further than this in one frame (0: never)'],
  ['substepRoots', 'SFBool', 'true', 'move the roots in even shares across the steps of one frame'],
];
const OUTPUTS = [
  ['stateHash', 'SFString', 'FNV-1a of the particle positions to 1 nm, for replay checks'],
  ['steps', 'SFInt32', 'solver steps so far'],
  ['droppedTime', 'SFTime', 'seconds dropped by maxSubsteps so far'],
  ['collided', 'SFBool', 'a particle touched a collider in this frame'],
  ['positions', 'MFVec3f', 'particle positions, world'],
  ['equivalentFrequency', 'SFFloat', 'what oscillator damping + elasticity at updateRate behave like (small motion), Hz'],
  ['equivalentDampingRatio', 'SFFloat', 'its damping ratio'],
];
export const COLLIDER_FIELDS = [
  ['enabled', 'SFBool', 'true', ''],
  ['shape', 'SFString', 'SPHERE', 'SPHERE, CAPSULE or PLANE'],
  ['bound', 'SFString', 'OUTSIDE', 'OUTSIDE keeps particles out; INSIDE keeps them in'],
  ['center', 'SFVec3f', '0 0 0', 'in the frame of the last ancestor'],
  ['radius', 'SFFloat', '0.5', 'sphere radius; capsule radius at the -direction end'],
  ['radius2', 'SFFloat', '0', 'capsule radius at the +direction end (0: same as radius): a tapered capsule, solved exactly'],
  ['height', 'SFFloat', '0', 'capsule length, caps included'],
  ['direction', 'SFString', 'Y', 'capsule axis, or plane normal: X, Y or Z of the frame'],
  ['axis', 'SFVec3f', '0 0 0', 'capsule axis or plane normal as a vector in the frame; overrides direction when not zero'],
  ['ancestors', 'MFNode', null, 'the nodes from the scene root down to the node the collider rides on, outermost first'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
function fieldDecl(name, type, dflt, appinfo, access) {
  const v = dflt === null || dflt === undefined || (dflt === '' && type.startsWith('MF')) ? '' : ` value='${type === 'MFString' ? dflt.replace(/'/g, '&apos;') : dflt}'`;
  const a = appinfo ? ` appinfo='${esc(appinfo)}'` : '';
  return `<field name='${name}' type='${type}' accessType='${access}'${type === 'MFNode' || type === 'SFNode' ? '' : v}${a}/>`;
}

export function buildScript() {
  const core = readFileSync(join(ROOT, 'src', 'springbone-core.js'), 'utf8');
  const glue = readFileSync(join(ROOT, 'src', 'x3d-script-glue.js'), 'utf8');
  const params = CHAIN_FIELDS.filter(([n, t]) => t !== 'MFNode' && t !== 'MFString' && n !== 'clock').map(([n]) => `  p.${n} = plain(${n});`).join('\n');
  return `// springbone-script.js (built by tools/build.mjs; edit src/ instead). SpringBoneChain's Script, X3D ECMAScript.\n` +
    `// Own code (x3d.loom, MIT). springbone-core ${'0.1.0'}.\n` + core + '\n' + glue +
    `\nfunction readParams() {\n  var p = {};\n${params}\n  return p;\n}\n`;
}

export function buildProto() {
  const I = '      ';
  const chainIface = CHAIN_FIELDS.map(([n, t, d, i]) => I + fieldDecl(n, t, d, i, t === 'MFNode' ? 'inputOutput' : 'inputOutput')).join('\n') + '\n' +
    I + fieldDecl('set_reset', 'SFBool', null, 'TRUE rebuilds the chain from the scene (after the bones change)', 'inputOnly') + '\n' +
    I + fieldDecl('set_time', 'SFTime', null, 'step to this time (used when clock is false)', 'inputOnly') + '\n' +
    OUTPUTS.map(([n, t, i]) => I + fieldDecl(n, t, null, i, 'outputOnly')).join('\n');
  const S = '          ';
  const scriptFields = [...CHAIN_FIELDS.map(([n, t, d]) => S + fieldDecl(n, t, d, null, 'inputOutput')),
    S + `<field name='tick' type='SFTime' accessType='inputOnly'/>`,
    S + `<field name='set_time' type='SFTime' accessType='inputOnly'/>`,
    S + fieldDecl('set_reset', 'SFBool', null, null, 'inputOnly'),
    ...OUTPUTS.map(([n, t]) => S + fieldDecl(n, t, null, null, 'outputOnly'))].join('\n');
  const connects = [...CHAIN_FIELDS.map(([n]) => n), 'set_reset', 'set_time', ...OUTPUTS.map(([n]) => n)].map((n) => `${S}  <connect nodeField='${n}' protoField='${n}'/>`).join('\n');
  const collIface = COLLIDER_FIELDS.map(([n, t, d, i]) => I + fieldDecl(n, t, d, i, 'inputOutput')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">
<X3D profile='Immersive' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>
  <head>
    <component name='HAnim' level='1'/>
    <component name='Scripting' level='1'/>
    <meta name='title' content='SpringBone.x3d'/>
    <meta name='description' content='SpringBoneChain and SpringBoneCollider: spring bones (secondary motion for hair, tails, cloth strips, jiggle) over HAnimJoint or Transform chains, as standard X3D PROTOs with an ECMAScript solver.'/>
    <meta name='creator' content='x3d.loom (own code, written from SPEC.md)'/>
    <meta name='created' content='28 November 2026'/>
    <meta name='license' content='MIT'/>
    <meta name='reference' content='https://github.com/hagopjay/x3d.loom/tree/main/x3d.springbone'/>
    <meta name='generator' content='x3d.springbone/tools/build.mjs'/>
  </head>
  <Scene>
    <WorldInfo title='SpringBone PROTO library'/>
    <ProtoDeclare name='SpringBoneCollider' appinfo='A sphere, (tapered) capsule or plane that SpringBoneChain particles stay outside (or inside). It rides on the frame its ancestors list ends with.'>
      <ProtoInterface>
${collIface}
      </ProtoInterface>
      <ProtoBody>
        <Group/>
      </ProtoBody>
    </ProtoDeclare>
    <ProtoDeclare name='SpringBoneChain' appinfo='Spring bones over HAnimJoint or Transform chains. Parameters carry over by name from the common Unity spring-bone component; see x3d.springbone/SPEC.md.'>
      <ProtoInterface>
${chainIface}
      </ProtoInterface>
      <ProtoBody>
        <Group>
          <TimeSensor DEF='SpringClock' loop='true'/>
          <Script DEF='SpringSolver' directOutput='true' mustEvaluate='true' url='"springbone-script.js" "https://hagopjay.github.io/x3d.demo/demos/spring-bone/v1/x3d/springbone-script.js"'>
${scriptFields}
            <IS>
${connects.replace(new RegExp(S + '  ', 'g'), S + '    ')}
            </IS>
          </Script>
          <ROUTE fromNode='SpringClock' fromField='time' toNode='SpringSolver' toField='tick'/>
        </Group>
      </ProtoBody>
    </ProtoDeclare>
  </Scene>
</X3D>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(join(ROOT, 'x3d', 'springbone-script.js'), buildScript());
  writeFileSync(join(ROOT, 'x3d', 'SpringBone.x3d'), buildProto());
  console.log('wrote x3d/springbone-script.js and x3d/SpringBone.x3d');
}

// ExternProtoDeclare text for scenes that use the library (fields must be listed in the XML encoding)
export function externDecls(url) {
  const f = (n, t, a) => `    <field name='${n}' type='${t}' accessType='${a}'/>`;
  const chain = [...CHAIN_FIELDS.map(([n, t]) => f(n, t, 'inputOutput')), f('set_reset', 'SFBool', 'inputOnly'), f('set_time', 'SFTime', 'inputOnly'),
    ...OUTPUTS.map(([n, t]) => f(n, t, 'outputOnly'))].join('\n');
  const coll = COLLIDER_FIELDS.map(([n, t]) => f(n, t, 'inputOutput')).join('\n');
  return `  <ExternProtoDeclare name='SpringBoneCollider' url='"${url}#SpringBoneCollider"'>\n${coll}\n  </ExternProtoDeclare>\n` +
         `  <ExternProtoDeclare name='SpringBoneChain' url='"${url}#SpringBoneChain"'>\n${chain}\n  </ExternProtoDeclare>\n`;
}
