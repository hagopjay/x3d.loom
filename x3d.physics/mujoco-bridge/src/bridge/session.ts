import {MuJoCoEngine} from '../mujoco/engine';
import {attachControl} from '../mujoco/controllers';
import {PROTOCOL,DEFAULT_RECIPE,DEFAULT_TARGET,parseEnvelope,parseRecipe,parseTarget,type Recipe,type Frame,type Vec3,type Quat,type Ack,type Envelope} from './contract';
import {compileRecipe} from './model';
export class BridgeSession {
 readonly engine:MuJoCoEngine;
 recipe:Recipe=structuredClone(DEFAULT_RECIPE);target:[number,number]=[...DEFAULT_TARGET];
 modelRevision=0;sequence=0;private frame=0;
 history:{source:string;type:string;ack:Ack}[]=[];
 private seen=new Map<string,{signature:string;ack:Ack}>();
 constructor(engine=new MuJoCoEngine()){this.engine=engine;}
 async init(){await this.engine.init();if(this.engine.status!=='ready')throw Error(this.engine.errorMsg??'MuJoCo unavailable');if(!this.engine.ready)this.replace(this.recipe);}
 private control(){attachControl(this.engine,{mode:'feedback',manual:[],target:this.target});}
 private replace(input:Recipe){
  const candidate=parseRecipe(input),source=compileRecipe(candidate);
  this.engine.loadXML(source); // Existing engine builds a candidate model+data before releasing the old pair.
  this.recipe=candidate;this.modelRevision++;this.engine.running=false;
  this.engine.reset(this.engine.listKeyframes().find(k=>k.name==='home')?.id??-1);this.control();
 }
 command(type:Envelope['type'],payload:unknown,source:Envelope['source']='ui'):Ack{
  return this.dispatch({protocol:PROTOCOL,id:`${source}-${Date.now()}-${++this.nonce}`,source,expectedModelRevision:this.modelRevision,type,payload});
 }
 private nonce=0;
 dispatch(input:unknown):Ack{
  let id='invalid',source='unknown',type='unknown';
  try{
   const c=parseEnvelope(input);({id,source,type}=c);
   const signature=JSON.stringify(c),previous=this.seen.get(id);
   if(previous){if(previous.signature!==signature)throw Error('Command id reused with different content');return {...previous.ack};}
   if(c.expectedModelRevision!==this.modelRevision)throw Error('Stale model revision: refresh mappings before sending this command');
   switch(c.type){
    case 'target.set':{const target=parseTarget(c.payload);this.target=target;this.control();break;}
    case 'model.replace':this.replace(parseRecipe(c.payload));break;
    case 'transport.set':if(typeof c.payload!=='boolean')throw Error('transport payload must be boolean');this.engine.running=c.payload;break;
    case 'reset':if(c.payload!==null)throw Error('reset payload must be null');this.engine.reset(this.engine.listKeyframes().find(k=>k.name==='home')?.id??-1);this.control();break;
    case 'step':if(c.payload!==null)throw Error('step payload must be null');this.engine.running=false;this.engine.step();break;
   }
   const ack:Ack={id,accepted:true,modelRevision:this.modelRevision,sequence:++this.sequence,message:c.type==='model.replace'?'Compiled authored recipe; physical state reset to home.':'Accepted'};
   this.seen.set(id,{signature,ack});if(this.seen.size>128)this.seen.delete(this.seen.keys().next().value!);
   this.record(source,type,ack);return ack;
  }catch(e){const ack={id,accepted:false,modelRevision:this.modelRevision,sequence:this.sequence,message:e instanceof Error?e.message:String(e)};this.record(source,type,ack);return ack;}
 }
 private record(source:string,type:string,ack:Ack){this.history.push({source,type,ack});if(this.history.length>100)this.history.shift();}
 advance(wallSeconds:number){this.engine.advance(wallSeconds);this.engine.sampleTelemetry();}
 snapshot():Frame{
  const e=this.engine;if(!e.ready)throw Error('Session not initialized');
  const bodies=([['arm.upper','upper'],['arm.lower','lower']] as const).map(([id,name])=>{const i=e.objId(e.OBJ.mjOBJ_BODY.value,name);return {id,position:Array.from(e.data.xpos.slice(3*i,3*i+3)) as Vec3,quaternion:Array.from(e.data.xquat.slice(4*i,4*i+4)) as Quat};});
  const sensor=e.objId(e.OBJ.mjOBJ_SENSOR.value,'tip_touch');
  let contactPoint:Vec3|null=null;const contacts=e.data.contact;
  try{for(let i=0;i<e.data.ncon;i++){const c=contacts.get(i);try{const pair=Array.from(c.geom??[c.geom1,c.geom2]);const tip=e.objId(e.OBJ.mjOBJ_GEOM.value,'tip'),obstacle=e.objId(e.OBJ.mjOBJ_GEOM.value,'obstacle');if(pair.includes(tip)&&pair.includes(obstacle)){contactPoint=Array.from(c.pos) as Vec3;break;}}finally{c.delete();}}}finally{contacts.delete();}
  return {protocol:PROTOCOL,modelRevision:this.modelRevision,frame:++this.frame,simTime:Number(e.data.time),running:e.running,units:{length:'metre',mass:'kilogram',time:'second',angle:'radian'},bodies,qpos:Array.from(e.data.qpos),qvel:Array.from(e.data.qvel),ctrl:Array.from(e.data.ctrl),touchN:Number(e.data.sensordata[e.model.sensor_adr[sensor]]),contacts:Number(e.data.ncon),contactPoint,obstacle:structuredClone(this.recipe.obstacle),target:[...this.target]};
 }
 dispose(){this.engine.dispose();}
}
