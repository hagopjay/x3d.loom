import type { MuJoCoEngine } from './engine';

export interface ControlSettings { mode: 'off' | 'manual' | 'feedback'; manual: number[]; target: [number, number] }
export const DEFAULT_CONTROL: ControlSettings = { mode: 'off', manual: [], target: [0.35, 0.6] };
export function isCartpole(e: MuJoCoEngine) { return /<mujoco\b[^>]*model=["']cartpole["']/.test(e.xml); }
export function isArm(e: MuJoCoEngine) { return /<mujoco\b[^>]*model=["']contact_arm["']/.test(e.xml); }
export function supportsFeedback(e: MuJoCoEngine): boolean {
  if(!e.ready) return false;
  const joints=isCartpole(e)?[['slider','SLIDE'],['hinge','HINGE']]:isArm(e)?[['shoulder','HINGE'],['elbow','HINGE']]:[];
  const motors=isCartpole(e)?['slide_motor']:isArm(e)?['shoulder_motor','elbow_motor']:[];
  return joints.length>0 && joints.every(([name,type])=>{const id=e.objId(e.OBJ.mjOBJ_JOINT.value,name);return id>=0 && e.model.jnt_type[id]===e.mujoco.mjtJoint[`mjJNT_${type}`].value;}) && motors.every(name=>e.objId(e.OBJ.mjOBJ_ACTUATOR.value,name)>=0);
}
export function jointState(e: MuJoCoEngine, name: string): [number, number] {
  const j = e.objId(e.OBJ.mjOBJ_JOINT.value, name);
  if (j < 0) throw new Error(`Missing joint: ${name}`);
  return [Number(e.data.qpos[e.model.jnt_qposadr[j]]), Number(e.data.qvel[e.model.jnt_dofadr[j]])];
}
function motor(e: MuJoCoEngine, name: string, value: number) {
  const id = e.objId(e.OBJ.mjOBJ_ACTUATOR.value, name);
  if (id < 0) throw new Error(`Missing actuator: ${name}`);
  e.data.ctrl[id] = e.model.actuator_ctrllimited[id] ? Math.max(e.model.actuator_ctrlrange[2*id], Math.min(e.model.actuator_ctrlrange[2*id+1], value)) : value;
}
export function controllerFor(e: MuJoCoEngine, config: ControlSettings): (e: MuJoCoEngine) => void {
  const c = structuredClone(config);
  if (c.mode === 'feedback' && !supportsFeedback(e)) throw new Error('Feedback requires the bundled cartpole/arm model name, named joints of the expected type, and named actuators.');
  return (sim) => {
    sim.data.ctrl.fill(0);
    if (c.mode === 'manual') for (let i=0; i<sim.model.nu; i++) {
      const u = c.manual[i] ?? 0;
      sim.data.ctrl[i] = sim.model.actuator_ctrllimited[i] ? Math.max(sim.model.actuator_ctrlrange[2*i], Math.min(sim.model.actuator_ctrlrange[2*i+1], u)) : u;
    }
    if (c.mode !== 'feedback') return;
    if (isCartpole(sim)) {
      const [x, xd] = jointState(sim, 'slider'); const [th, thd] = jointState(sim, 'hinge');
      motor(sim, 'slide_motor', 120*th + 40*thd + 10*x + 15*xd);
    } else {
      for (const [i, name] of ['shoulder','elbow'].entries()) {
        const [q,v] = jointState(sim,name);
        motor(sim, `${name}_motor`, 12*(c.target[i]-q)-2.4*v);
      }
    }
  };
}
export function attachControl(e: MuJoCoEngine, c: ControlSettings) {
  const controller = controllerFor(e,c);
  e.controlRecord = structuredClone(c);
  e.controller = controller;
  controller(e);
  e.mujoco.mj_forward(e.model,e.data);
}
export function disturbCartpole(e: MuJoCoEngine, radians = 0.08) {
  if (!isCartpole(e) || !supportsFeedback(e)) throw new Error('Load the cartpole before applying its disturbance.');
  const j = e.objId(e.OBJ.mjOBJ_JOINT.value,'hinge');
  e.data.qpos[e.model.jnt_qposadr[j]] += radians;
  e.mujoco.mj_forward(e.model,e.data);
}

export function controlSpecification(e: MuJoCoEngine, c: ControlSettings | null) {
  if (!c) return { recipe:'external-or-none', recorded:false };
  if (c.mode!=='feedback') return { recipe:`${c.mode}-v1`, settings:structuredClone(c), clamp:'compiled actuator ctrlrange' };
  return isCartpole(e)
    ? { recipe:'cartpole-local-feedback-v1', formula:'u = 120*theta + 40*theta_dot + 10*x + 15*x_dot', joints:['hinge','slider'], settings:structuredClone(c), clamp:'compiled actuator ctrlrange' }
    : { recipe:'arm-joint-pd-v1', formula:'u_i = 12*(target_i-q_i) - 2.4*qvel_i', joints:['shoulder','elbow'], settings:structuredClone(c), clamp:'compiled actuator ctrlrange' };
}
