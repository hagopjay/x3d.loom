/** Experimental application contract, not an X3D or MuJoCo standard. */
export const PROTOCOL = 'x3d-mujoco/0.1' as const;
export const PROFILE = 'contact-arm/1' as const;
export type Vec3 = [number,number,number];
export type Quat = [number,number,number,number];
export interface Recipe {
  profile:typeof PROFILE;
  upperLength:number; lowerLength:number; upperMass:number; lowerMass:number;
  obstacle:{ position:Vec3; radius:number };
}
export const DEFAULT_RECIPE:Recipe={profile:PROFILE,upperLength:.55,lowerLength:.45,upperMass:.65,lowerMass:.4,obstacle:{position:[.88,.56,.34],radius:.11}};
export const DEFAULT_TARGET:[number,number]=[.35,.6];
export const BINDINGS=[
 {id:'arm.upper',def:'BodyUpper',mj:'upper',authority:'MuJoCo',role:'body'},
 {id:'arm.lower',def:'BodyLower',mj:'lower',authority:'MuJoCo',role:'body'},
 {id:'world.obstacle',def:'ObstacleHandle',mj:'obstacle',authority:'X3D authoring → compile',role:'static geom'},
 {id:'arm.goal',def:'TargetHandle',mj:'shoulder/elbow targets',authority:'X3D command → controller',role:'controller target'},
 {id:'sensor.tip_touch',def:'ContactForce',mj:'tip_touch',authority:'MuJoCo',role:'physical sensor'},
] as const;
export const LOSSES=[
 'Experimental contact-arm/1 subset, not a general X3D↔MJCF converter.',
 'X3D cylinders/spheres illustrate MuJoCo capsule links; link collision is disabled, with contact at the spherical tip only.',
 'No native X3D RigidBodyPhysics conformance is claimed: MuJoCo is the external dynamics authority.',
 'Imported X3D is normalized to this profile. Only declared physical annotations, obstacle position/radius and joint targets are read; other presentation edits are reported as outside the importer contract.',
 'Snapshots and experiment records are not full integration-state replay checkpoints.',
];
export interface Frame {
 protocol:typeof PROTOCOL; modelRevision:number; frame:number; simTime:number; running:boolean;
 units:{length:'metre';mass:'kilogram';time:'second';angle:'radian'};
 bodies:{id:'arm.upper'|'arm.lower';position:Vec3;quaternion:Quat}[];
 qpos:number[]; qvel:number[]; ctrl:number[]; touchN:number; contacts:number;
 contactPoint:Vec3|null; obstacle:Recipe['obstacle']; target:[number,number];
}
export interface Envelope {protocol:typeof PROTOCOL;id:string;source:'ui'|'x3d'|'file'|'test';expectedModelRevision:number;type:'target.set'|'model.replace'|'transport.set'|'reset'|'step';payload:unknown}
export interface Ack {id:string;accepted:boolean;modelRevision:number;sequence:number;message:string}
function object(v:unknown,label:string):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error(`${label}: object required`);return v as Record<string,unknown>;}
export function finite(v:unknown,min:number,max:number,label:string):number{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label}: finite value in [${min}, ${max}] required`);return v;}
export function parseTarget(v:unknown):[number,number]{if(!Array.isArray(v)||v.length!==2)throw Error('target: two angles required');return [finite(v[0],-1.8,1.8,'shoulder target'),finite(v[1],-1.8,1.8,'elbow target')];}
export function parseRecipe(v:unknown):Recipe{
 const r=object(v,'recipe'),o=object(r.obstacle,'obstacle');
 if(r.profile!==PROFILE)throw Error(`Expected physical profile ${PROFILE}`);
 if(!Array.isArray(o.position)||o.position.length!==3)throw Error('obstacle.position: xyz required');
 return {profile:PROFILE,upperLength:finite(r.upperLength,.25,.85,'upper length'),lowerLength:finite(r.lowerLength,.2,.75,'lower length'),upperMass:finite(r.upperMass,.1,2,'upper mass'),lowerMass:finite(r.lowerMass,.1,2,'lower mass'),obstacle:{position:[finite(o.position[0],.2,1.1,'obstacle x'),finite(o.position[1],.15,.95,'obstacle y'),finite(o.position[2],.34,.34,'obstacle z (fixed plane)')],radius:finite(o.radius,.04,.18,'obstacle radius')}};
}
export function parseEnvelope(v:unknown):Envelope{
 const r=object(v,'command');if(r.protocol!==PROTOCOL)throw Error('Unsupported bridge protocol');
 if(typeof r.id!=='string'||!r.id.length||r.id.length>100)throw Error('command id: 1–100 characters required');
 if(!['ui','x3d','file','test'].includes(String(r.source)))throw Error('Unknown command source');
 if(!Number.isInteger(r.expectedModelRevision)||Number(r.expectedModelRevision)<1)throw Error('Expected a positive model revision');
 if(!['target.set','model.replace','transport.set','reset','step'].includes(String(r.type)))throw Error('Unsupported command type');
 return r as unknown as Envelope;
}
