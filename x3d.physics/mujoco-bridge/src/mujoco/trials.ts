import type { MuJoCoEngine } from './engine';
import { attachControl, controlSpecification, disturbCartpole, isArm, isCartpole, supportsFeedback, type ControlSettings } from './controllers';

export interface Trial {
  schema: 'mujoco-observatory/trial-v1'; createdAt: string; engineVersion: string;
  xml: string; options: ReturnType<MuJoCoEngine['optionsEditable']>; controller: ControlSettings;
  controllerImplementation: ReturnType<typeof controlSpecification>;
  start: { keyframe: string; disturbance_rad: number; qpos: number[]; qvel: number[] };
  timestep: number; duration: number; columns: { id: string; label: string }[];
  samples: { t: number; v: number[] }[];
  metrics: { steps: number; peakContacts: number; peakControlFraction: number; finalQpos: number[]; finite: boolean };
}
/** Start from a documented reset, measure every physics tick, and yield regularly to the UI. */
export async function measureTrial(live: MuJoCoEngine, settings: ControlSettings, signal?: AbortSignal, progress?: (fraction: number) => void): Promise<Trial> {
  const e = live.fork();
  try {
    const dt = Number(e.model.opt.timestep);
    const steps = Math.ceil(5 / dt - 1e-9);
    if (steps > 25000) throw new Error('A 5 s trial is limited to 25,000 steps. Use timestep ≥ 0.0002 s.');
    const home = isArm(e) ? e.listKeyframes().find(k => k.name === 'home') : undefined;
    e.reset(home?.id ?? -1);
    const disturbance = isCartpole(e) && supportsFeedback(e) ? 0.08 : 0;
    if (disturbance) disturbCartpole(e, disturbance);
    attachControl(e, settings);
    const result: Trial = {
      schema: 'mujoco-observatory/trial-v1', createdAt: new Date().toISOString(), engineVersion: e.version,
      xml: e.xml, options: e.optionsEditable(), controller: structuredClone(settings), controllerImplementation:controlSpecification(e,settings),
      start: { keyframe: home?.name ?? 'qpos0', disturbance_rad: disturbance, qpos: Array.from(e.data.qpos), qvel: Array.from(e.data.qvel) },
      timestep: dt, duration: steps*dt, columns: e.series.map(s => ({ id:s.id, label:s.label })), samples: [],
      metrics: { steps, peakContacts:0, peakControlFraction:0, finalQpos:[], finite:true },
    };
    const sample = () => {
      e.sampleTelemetry();
      result.samples.push({ t:Number(e.data.time), v:e.series.map(s=>s.read(e)) });
      result.metrics.peakContacts = Math.max(result.metrics.peakContacts,Number(e.data.ncon));
      for (let i=0;i<e.model.nu;i++) if(e.model.actuator_ctrllimited[i]) {
        const limit=Math.max(Math.abs(e.model.actuator_ctrlrange[2*i]),Math.abs(e.model.actuator_ctrlrange[2*i+1]));
        if(limit>0) result.metrics.peakControlFraction=Math.max(result.metrics.peakControlFraction,Math.abs(e.data.ctrl[i])/limit);
      }
      if(![...e.data.qpos,...e.data.qvel].every(Number.isFinite)) throw new Error('Trial stopped: non-finite physical state.');
    };
    sample();
    for(let i=0;i<steps;i++) {
      if(signal?.aborted) throw new Error('Trial cancelled; the live state was preserved.');
      e.step(); sample();
      if(i%100===99) { progress?.((i+1)/steps); await new Promise(resolve=>setTimeout(resolve,0)); }
    }
    result.metrics.finalQpos=Array.from(e.data.qpos);
    progress?.(1);
    return result;
  } finally { e.dispose(); }
}
export function compatibleTrials(a: Trial, b: Trial) {
  return a.engineVersion===b.engineVersion && Math.abs(a.timestep-b.timestep)<1e-12 && a.samples.length===b.samples.length && JSON.stringify(a.columns)===JSON.stringify(b.columns);
}
export function trialCsv(run: Trial) {
  return [['time_s',...run.columns.map(c=>c.id)].map(s=>`"${s.replace(/"/g,'""')}"`).join(','),...run.samples.map(s=>[s.t,...s.v].join(','))].join('\r\n');
}
