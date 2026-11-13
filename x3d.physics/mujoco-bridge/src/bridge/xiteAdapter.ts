import {forwardTarget,inverseTarget,mjToX3d,rotationToX3d} from './math';
import type {Ack,Envelope,Frame,Recipe,Vec3} from './contract';
/** Narrow documented external-browser surface. Keeps vendor objects out of the bridge contract. */
export interface XNode { [field:string]:unknown; addFieldCallback(key:unknown,name:string,cb:(value:unknown)=>void):void; removeFieldCallback(key:unknown,name:string):void }
export interface XScene {getNamedNode(name:string):XNode;dispose?():void}
export interface XBrowser {version:string;createX3DFromString(xml:string):Promise<XScene>;replaceWorld(scene:XScene):Promise<void>;beginUpdate?():void;endUpdate?():void}
export interface XApi {SFVec3f:new(x:number,y:number,z:number)=>unknown;SFRotation:new(x:number,y:number,z:number,a:number)=>unknown;SFColor:new(r:number,g:number,b:number)=>unknown;MFDouble:new(...n:number[])=>unknown}
export type BridgeCanvas=HTMLElement&{browser?:XBrowser};
export type Send=(type:Envelope['type'],payload:unknown,source:'x3d')=>Ack;
let loadPromise:Promise<XApi>|null=null;
export function loadXite():Promise<XApi>{
 const api=(window as unknown as {X3D?:XApi}).X3D;if(api)return Promise.resolve(api);
 loadPromise??=new Promise<XApi>((resolve,reject)=>{
  const script=document.createElement('script');script.src='./vendor/x_ite/x_ite.min.js';script.async=true;
  script.onload=()=>{const api=(window as unknown as {X3D?:XApi}).X3D;if(api)resolve(api);else reject(Error('X_ITE did not expose its external browser API'));};
  script.onerror=()=>reject(Error('Local X_ITE runtime could not load. Start the included HTTP launcher.'));
  document.head.append(script);
 });return loadPromise;
}
function vec(v:unknown):Vec3{const p=v as {x?:number;y?:number;z?:number};if(![p?.x,p?.y,p?.z].every(n=>typeof n==='number'&&Number.isFinite(n)))throw Error('Invalid X3D vector event');return [p.x!,p.y!,p.z!];}
export class XiteAdapter {
 private scene:XScene|null=null;private callbacks:{node:XNode;name:string;key:string}[]=[];
 private obstacleDragging=false;private targetDragging=false;private dragPosition:Vec3|null=null;
 private generation=0;private dead=false;
 readonly api:XApi; readonly browser:XBrowser;
 private getRecipe:()=>Recipe; private send:Send; private select:(id:string)=>void; private status:(s:string)=>void;
 constructor(api:XApi,browser:XBrowser,getRecipe:()=>Recipe,send:Send,select:(id:string)=>void,status:(s:string)=>void){this.api=api;this.browser=browser;this.getRecipe=getRecipe;this.send=send;this.select=select;this.status=status;}
 async load(xml:string){
  const generation=++this.generation,candidate=await this.browser.createX3DFromString(xml);
  if(this.dead||generation!==this.generation){candidate.dispose?.();return;}
  this.unbind();await this.browser.replaceWorld(candidate);
  if(this.dead||generation!==this.generation)return;
  this.scene=candidate;this.obstacleDragging=false;this.targetDragging=false;this.dragPosition=null;
  const listen=(def:string,name:string,cb:(v:unknown)=>void)=>{const node=candidate.getNamedNode(def),key=`bridge-${def}-${name}`;node.addFieldCallback(key,name,cb);this.callbacks.push({node,name,key});};
  const safely=(fn:()=>void)=>{try{fn();}catch(e){this.status(e instanceof Error?e.message:String(e));}};
  listen('UpperPick','isActive',v=>{if(v)this.select('arm.upper');});
  listen('LowerPick','isActive',v=>{if(v)this.select('arm.lower');});
  listen('TargetDrag','isActive',v=>{this.targetDragging=Boolean(v);if(v)this.select('arm.goal');});
  listen('TargetDrag','translation_changed',v=>safely(()=>{if(!this.targetDragging)return;const p=vec(v),r=this.getRecipe();const target=inverseTarget([r.upperLength,r.lowerLength],p[0],p[1]);const ack=this.send('target.set',target,'x3d');this.status(ack.accepted?'X3D target → MuJoCo controller':ack.message);}));
  listen('ObstacleDrag','isActive',v=>safely(()=>{
   this.obstacleDragging=Boolean(v);
   if(v){this.select('world.obstacle');this.send('transport.set',false,'x3d');this.dragPosition=null;this.status('Obstacle edit staged in X3D; release to compile and reset.');}
   else if(this.dragPosition){const r=structuredClone(this.getRecipe());r.obstacle.position=[this.dragPosition[0],this.dragPosition[1],.34];const ack=this.send('model.replace',r,'x3d');this.status(ack.message);this.dragPosition=null;}
  }));
  listen('ObstacleDrag','translation_changed',v=>safely(()=>{if(this.obstacleDragging)this.dragPosition=vec(v);}));
  this.status(`X_ITE ${this.browser.version} attached: poses in, targets and authored obstacle edits out.`);
 }
 sync(frame:Frame){
  const scene=this.scene;if(!scene||this.dead)return;
  const set=(def:string,field:string,value:unknown)=>{scene.getNamedNode(def)[field]=value;};
  for(const body of frame.bodies){const def=body.id==='arm.upper'?'BodyUpper':'BodyLower';set(def,'translation',new this.api.SFVec3f(...mjToX3d(body.position)));set(def,'rotation',new this.api.SFRotation(...rotationToX3d(body.quaternion)));}
  if(!this.obstacleDragging){const p=frame.obstacle.position;set('ObstacleHandle','translation',new this.api.SFVec3f(p[0],p[1],0));set('ObstacleDrag','offset',new this.api.SFVec3f(p[0],p[1],0));}
  if(!this.targetDragging){const r=this.getRecipe(),p=forwardTarget([r.upperLength,r.lowerLength],frame.target);set('TargetHandle','translation',new this.api.SFVec3f(p[0],p[1],0));set('TargetDrag','offset',new this.api.SFVec3f(p[0],p[1],0));}
  set('ContactForce','value',new this.api.MFDouble(frame.touchN));set('SimTime','value',new this.api.MFDouble(frame.simTime));set('JointTargets','value',new this.api.MFDouble(...frame.target));
  const heat=Math.min(1,Math.max(0,frame.touchN/8));set('TipMaterial','diffuseColor',new this.api.SFColor(.73+.27*heat,.94-.5*heat,.47-.3*heat));
  set('ContactSwitch','whichChoice',frame.contactPoint?0:-1);if(frame.contactPoint)set('ContactMarker','translation',new this.api.SFVec3f(...mjToX3d(frame.contactPoint)));
 }
 view(top:boolean){if(this.scene)this.scene.getNamedNode(top?'TopView':'HomeView').set_bind=true;}
 private unbind(){for(const c of this.callbacks)c.node.removeFieldCallback(c.key,c.name);this.callbacks=[];this.scene=null;}
 dispose(){this.dead=true;this.generation++;this.unbind();this.browser.endUpdate?.();}
}
