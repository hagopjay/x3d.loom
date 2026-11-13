import {BINDINGS,DEFAULT_TARGET,LOSSES,PROFILE,PROTOCOL,parseRecipe,parseTarget,type Recipe,type Frame} from './contract';
import {forwardTarget,mjToX3d,rotationToX3d} from './math';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll("'",'&apos;');
const mf=(s:string)=>esc(JSON.stringify(s));
const numbers=(a:readonly number[])=>a.map(n=>Object.is(n,-0)?'0':String(n)).join(' ');
export function manifest(recipe:Recipe,target:[number,number]){return {protocol:PROTOCOL,profile:PROFILE,recipe:parseRecipe(recipe),target:parseTarget(target),authority:{dynamics:'MuJoCo',presentation:'X3D',modelEdits:'explicit recipe recompilation'},coordinates:{mujoco:'Z-up metres, wxyz quaternions',x3d:'Y-up metres, axis-angle rotations',basis:'(x,y,z)_M → (x,z,-y)_X'},bindings:BINDINGS,losses:LOSSES};}
export function createScene(recipe:Recipe,target:[number,number]=DEFAULT_TARGET,frame?:Frame):string{
 const r=parseRecipe(recipe),goal=forwardTarget([r.upperLength,r.lowerLength],target),p=r.obstacle.position;
 const pose=(id:string,fallback:number[])=>{const b=frame?.bodies.find(b=>b.id===id);return b?`translation="${numbers(mjToX3d(b.position))}" rotation="${numbers(rotationToX3d(b.quaternion))}"`:`translation="${numbers(fallback)}"`;};
 const color=frame&&frame.touchN>.1?'1 .48 .2':'.73 .94 .47';
 return `<?xml version="1.0" encoding="UTF-8"?>
<X3D profile="Interactive" version="4.0">
<head><unit category="length" name="metre" conversionFactor="1"/><unit category="angle" name="radian" conversionFactor="1"/><unit category="mass" name="kilogram" conversionFactor="1"/><meta name="title" content="X3D ↔ MuJoCo · Authorable contact arm"/><meta name="description" content="Experimental contact-arm/1 bridge. Standard X3D visual snapshot and drag interactions; external MuJoCo authority when attached."/></head>
<Scene>
 <WorldInfo title="Contact arm · portable experiment" info='"Drag cyan target to command. Drag orange obstacle to stage a physical edit. A bridge host is needed to simulate." "Physical metadata uses contact-arm/1, an application profile, not an ISO X3D profile."'>
 <MetadataSet DEF="BridgeContract" containerField="metadata" name="x3d-mujoco/0.1">
  <MetadataString DEF="BridgeManifest" containerField="value" name="manifest" value="${mf(JSON.stringify(manifest(r,target)))}"/>
  <MetadataDouble DEF="UpperLength" containerField="value" name="upperLength_m" value="${r.upperLength}"/>
  <MetadataDouble DEF="LowerLength" containerField="value" name="lowerLength_m" value="${r.lowerLength}"/>
  <MetadataDouble DEF="UpperMass" containerField="value" name="upperMass_kg" value="${r.upperMass}"/>
  <MetadataDouble DEF="LowerMass" containerField="value" name="lowerMass_kg" value="${r.lowerMass}"/>
  <MetadataDouble DEF="JointTargets" containerField="value" name="jointTargets_rad" value="${numbers(target)}"/>
  <MetadataDouble DEF="ContactForce" containerField="value" name="tip_touch_N" value="${frame?.touchN??0}"/>
  <MetadataDouble DEF="SimTime" containerField="value" name="simulation_time_s" value="${frame?.simTime??0}"/>
 </MetadataSet>
 </WorldInfo>
 <NavigationInfo type='"EXAMINE" "ANY"' headlight="true"/>
 <Background skyColor=".025 .045 .075"/>
 <Viewpoint DEF="HomeView" description="Workshop" position=".5 1.9 1.7" orientation="1 0 0 -.65" centerOfRotation=".4 .34 -.3"/>
 <Viewpoint DEF="TopView" description="Plan / joint targets" position=".5 2.8 -.3" orientation="1 0 0 -1.57079632679" centerOfRotation=".4 .34 -.3"/>
 <DirectionalLight direction="-.4 -1 -.3" intensity="1"/>
 <Transform translation=".4 -.015 -.25"><Shape><Appearance><Material diffuseColor=".09 .15 .2"/></Appearance><Box size="3 .02 3"/></Shape></Transform>
 <Transform translation="0 .16 0"><Shape><Appearance><Material diffuseColor=".28 .34 .42" specularColor=".4 .4 .4"/></Appearance><Cylinder radius=".13" height=".32"/></Shape></Transform>
 <Transform DEF="BodyUpper" ${pose('arm.upper',[0,.34,0])}>
  <MetadataString containerField="metadata" name="bridge.logicalId" value='"arm.upper"'/><TouchSensor DEF="UpperPick" description="Inspect upper link"/>
  <Transform translation="${r.upperLength/2} 0 0" rotation="0 0 1 -1.57079632679"><Shape><Appearance><Material DEF="UpperMaterial" diffuseColor=".15 .64 .87" specularColor=".5 .5 .5" shininess=".5"/></Appearance><Cylinder radius=".045" height="${r.upperLength}"/></Shape></Transform>
  <Shape><Appearance><Material diffuseColor=".67 .85 .94"/></Appearance><Cylinder radius=".08" height=".11"/></Shape>
 </Transform>
 <Transform DEF="BodyLower" ${pose('arm.lower',[r.upperLength,.34,0])}>
  <MetadataString containerField="metadata" name="bridge.logicalId" value='"arm.lower"'/><TouchSensor DEF="LowerPick" description="Inspect lower link"/>
  <Transform translation="${r.lowerLength/2} 0 0" rotation="0 0 1 -1.57079632679"><Shape><Appearance><Material DEF="LowerMaterial" diffuseColor=".56 .82 .31" specularColor=".4 .4 .4" shininess=".4"/></Appearance><Cylinder radius=".035" height="${r.lowerLength}"/></Shape></Transform>
  <Shape><Appearance><Material diffuseColor=".72 .92 .53"/></Appearance><Cylinder radius=".065" height=".1"/></Shape>
  <Transform translation="${r.lowerLength} 0 0"><Shape><Appearance><Material DEF="TipMaterial" diffuseColor="${color}" emissiveColor=".05 .08 .02"/></Appearance><Sphere radius=".06"/></Shape></Transform>
 </Transform>
 <Transform translation="0 .34 0" rotation="1 0 0 -1.57079632679">
  <PlaneSensor DEF="ObstacleDrag" description="Author obstacle position; commits to physics on release" offset="${p[0]} ${p[1]} 0" minPosition=".2 .15" maxPosition="1.1 .95"/>
  <Transform DEF="ObstacleHandle" translation="${p[0]} ${p[1]} 0"><MetadataString containerField="metadata" name="bridge.logicalId" value='"world.obstacle"'/><Shape><Appearance><Material diffuseColor=".97 .46 .19" specularColor=".5 .4 .2" shininess=".6"/></Appearance><Sphere DEF="ObstacleGeometry" radius="${r.obstacle.radius}"/></Shape></Transform>
 </Transform>
 <Transform translation="0 .34 0" rotation="1 0 0 -1.57079632679">
  <PlaneSensor DEF="TargetDrag" description="Command a reachable goal; elbow-positive IK branch" offset="${goal[0]} ${goal[1]} 0" minPosition="-.9 -.9" maxPosition="1.4 1.4"/>
  <Transform DEF="TargetHandle" translation="${goal[0]} ${goal[1]} 0"><MetadataString containerField="metadata" name="bridge.logicalId" value='"arm.goal"'/><Shape><Appearance><Material diffuseColor=".2 .9 1" emissiveColor=".05 .4 .5" transparency=".25"/></Appearance><Sphere radius=".034"/></Shape></Transform>
 </Transform>
 <Switch DEF="ContactSwitch" whichChoice="${frame?.contactPoint?0:-1}"><Transform DEF="ContactMarker" translation="${numbers(frame?.contactPoint?mjToX3d(frame.contactPoint):[0,0,0])}"><Shape><Appearance><Material diffuseColor="1 .2 .3" emissiveColor=".5 .02 .05"/></Appearance><Sphere radius=".022"/></Shape></Transform></Switch>
 <ROUTE fromNode="ObstacleDrag" fromField="translation_changed" toNode="ObstacleHandle" toField="set_translation"/>
 <ROUTE fromNode="TargetDrag" fromField="translation_changed" toNode="TargetHandle" toField="set_translation"/>
</Scene></X3D>`;
}
/** This reader accepts only an explicitly bounded, script-free contact-arm scene. It never executes imported code. */
export function readScene(xml:string):{recipe:Recipe;target:[number,number];warnings:string[]}{
 if(xml.length>200000)throw Error('X3D profile import limit is 200 KB');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DTD/entity declarations are outside this importer profile');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement.tagName!=='X3D')throw Error('Well-formed X3D XML required');
 const allowed=new Set(['X3D','head','meta','unit','Scene','WorldInfo','MetadataSet','MetadataString','MetadataDouble','NavigationInfo','Background','Viewpoint','DirectionalLight','Transform','Shape','Appearance','Material','Box','Cylinder','Sphere','TouchSensor','PlaneSensor','Switch','ROUTE']);
 const defs=new Set<string>();
 for(const el of doc.querySelectorAll('*')){
  if(!allowed.has(el.tagName))throw Error(`Unsupported node ${el.tagName}; only the declared script-free profile is accepted`);
  for(const a of el.attributes)if(/^on/i.test(a.name)||a.name==='url')throw Error('Executable or external-resource attributes are outside this profile');
  const def=el.getAttribute('DEF');if(def){if(defs.has(def))throw Error(`Duplicate DEF ${def}`);defs.add(def);}
 }
 const node=(name:string)=>{const n=doc.querySelector(`[DEF="${name}"]`);if(!n)throw Error(`Missing bridge node ${name}`);return n;};
 const data=node('BridgeManifest').getAttribute('value')??'';
 // MFString containing one JSON string, whose value is the manifest JSON.
 let m:ReturnType<typeof manifest>;
 try{m=JSON.parse(JSON.parse(data));}catch{throw Error('BridgeManifest must contain one quoted JSON manifest string');}
 if(m.protocol!==PROTOCOL||m.profile!==PROFILE)throw Error('Unsupported embedded bridge profile');
 const r=parseRecipe(m.recipe);
 const scalar=(def:string)=>{const a=(node(def).getAttribute('value')??'').trim().split(/\s+/).map(Number);if(a.length!==1||!Number.isFinite(a[0]))throw Error(`${def}: one finite number required`);return a[0];};
 r.upperLength=scalar('UpperLength');r.lowerLength=scalar('LowerLength');r.upperMass=scalar('UpperMass');r.lowerMass=scalar('LowerMass');
 const p=(node('ObstacleHandle').getAttribute('translation')??'').trim().split(/\s+/).map(Number);
 if(p.length!==3||!p.every(Number.isFinite)||p[2]!==0)throw Error('ObstacleHandle must remain in its local xy authoring plane');
 r.obstacle.position=[p[0],p[1],.34];r.obstacle.radius=Number(node('ObstacleGeometry').getAttribute('radius'));
 const target=parseTarget((node('JointTargets').getAttribute('value')??'').trim().split(/\s+/).map(Number));
 return {recipe:parseRecipe(r),target,warnings:[LOSSES[3],'Serialized body poses, sensor values and drag state are observations only; import resets physics to home.']};
}
