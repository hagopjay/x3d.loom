import {attachControl, jointState} from '../mujoco/controllers';
import type { MuJoCoEngine } from "../mujoco/engine";

export interface ChallengeResult {
  pass: boolean;
  detail: string;
}

export interface ModelRequirements {
  model: string;
  bodies?: string[];
  joints?: Record<string, "free" | "ball" | "slide" | "hinge">;
  geoms?: string[];
  actuators?: string[];
  keyframes?: string[];
}

export interface Challenge {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  brief: string;
  goal: string;
  hints: string[];
  presetId?: string;
  xml?: string;
  requires?: ModelRequirements;
  /** Optional built-in controller used by "run check" (and attached while verifying). */
  autopilot?: (e: MuJoCoEngine) => void;
  seconds?: number;
  verify: (e: MuJoCoEngine) => ChallengeResult;
}

/** Reject a different scene before a challenge interprets its state arrays. */
export function validateChallengeModel(c: Challenge, e: MuJoCoEngine): ChallengeResult | null {
  if (!e.ready || !e.model || !e.data) return { pass: false, detail: "Compile a model before checking it." };
  const r = c.requires;
  if (!r) return null;
  const source = e.xml.replace(/<!--[\s\S]*?-->/g, "");
  const rootTag = source.match(/<mujoco\b[^>]*>/)?.[0] ?? "";
  const name = rootTag.match(/\bmodel\s*=\s*(?:"([^"]*)"|'([^']*)')/);
  if ((name?.[1] ?? name?.[2]) !== r.model) {
    return { pass: false, detail: `This check expects model="${r.model}". Load its starter, make your edits, and Apply before checking.` };
  }
  const groups: [string, string[] | undefined][] = [
    ["BODY", r.bodies], ["GEOM", r.geoms], ["ACTUATOR", r.actuators], ["KEY", r.keyframes],
  ];
  for (const [kind, names] of groups) {
    for (const name of names ?? []) {
      if (e.objId(e.OBJ[`mjOBJ_${kind}`].value, name) < 0) {
        return { pass: false, detail: `Missing required ${kind.toLowerCase()} "${name}". Preserve the starter's named objects.` };
      }
    }
  }
  for (const [name, type] of Object.entries(r.joints ?? {})) {
    const id = e.objId(e.OBJ.mjOBJ_JOINT.value, name);
    const expected = e.mujoco.mjtJoint[`mjJNT_${type.toUpperCase()}`].value;
    if (id < 0 || Number(e.model.jnt_type[id]) !== expected) {
      return { pass: false, detail: `This check requires a ${type} joint named "${name}".` };
    }
  }
  return null;
}

function bodyId(e: MuJoCoEngine, name: string): number {
  return e.objId(e.OBJ.mjOBJ_BODY.value, name);
}

function hasContactPair(e: MuJoCoEngine, geom1: number, geom2: number): boolean {
  const contacts = e.data.contact;
  try {
    for (let i = 0; i < Number(e.data.ncon); i++) {
      const c = typeof contacts.get === "function" ? contacts.get(i) : contacts[i];
      try {
        const a = c.geom?.[0] ?? c.geom1;
        const b = c.geom?.[1] ?? c.geom2;
        if ((a === geom1 && b === geom2) || (a === geom2 && b === geom1)) return true;
      } finally {
        c?.delete?.();
      }
    }
    return false;
  } finally {
    contacts?.delete?.();
  }
}

function jntQpos(e: MuJoCoEngine, name: string): number {
  const jid = e.objId(e.OBJ.mjOBJ_JOINT.value, name);
  if (jid < 0) return NaN;
  return (e.data.qpos as any)[e.model.jnt_qposadr[jid]];
}

function jntQvel(e: MuJoCoEngine, name: string): number {
  const jid = e.objId(e.OBJ.mjOBJ_JOINT.value, name);
  if (jid < 0) return NaN;
  return (e.data.qvel as any)[e.model.jnt_dofadr[jid]];
}

const DEFINITIONS: Challenge[] = [
  {
    id:'arm-contact', title:'Reach, then press', difficulty:'Medium', presetId:'contact-arm', seconds:5,
    brief:'Move the two-link arm from home into controlled contact with the fixed orange obstacle.',
    goal:'Within 5 s: tip–obstacle contact occurs, final joint target error is below 0.25 rad per joint, and the named tip touch sensor is positive at the end.',
    hints:['The target is shoulder=0.35 rad, elbow=0.6 rad. The obstacle prevents exact tracking; steady error is expected.', 'The shoulder motor saturates initially. A saturated control command is not evidence of an unlimited actuator.', 'Change one contact or controller assumption at a time, then measure again.'],
    requires:{model:'contact_arm',joints:{shoulder:'hinge',elbow:'hinge'},geoms:['tip','obstacle'],actuators:['shoulder_motor','elbow_motor'],keyframes:['home']},
    verify:(e)=>{
      e.reset(e.listKeyframes().find(k=>k.name==='home')!.id);
      attachControl(e,{mode:'feedback',manual:[],target:[0.35,0.6]});
      let touched=false;
      const tip=e.objId(e.OBJ.mjOBJ_GEOM.value,'tip'), obstacle=e.objId(e.OBJ.mjOBJ_GEOM.value,'obstacle');
      e.simulate(5,e.controller!,sim=>{touched ||= hasContactPair(sim,tip,obstacle);});
      const errors=[Math.abs(jointState(e,'shoulder')[0]-0.35),Math.abs(jointState(e,'elbow')[0]-0.6)];
      const sensor=e.objId(e.OBJ.mjOBJ_SENSOR.value,'tip_touch');
      const force=sensor>=0?Number(e.data.sensordata[e.model.sensor_adr[sensor]]):0;
      return {pass:touched&&errors.every(v=>v<0.25)&&force>0,detail:`tip–obstacle contact=${touched}; final errors=[${errors.map(v=>v.toFixed(3)).join(', ')}] rad; final touch=${force.toFixed(3)} N. This is a local contact test, not a general manipulation policy.`};
    }
  },

  {
    id: "first-contact",
    title: "First contact",
    difficulty: "Easy",
    brief: "Load the bouncy ball drop and prove the engine is alive: the ball must fall and touch the floor.",
    goal: "Within 2.0 s, the named ball must fall below z=0.4 m and a contact between geoms 'ball' and 'floor' must be recorded.",
    hints: [
      "Contacts appear as red dots in the viewport — enable them in the toolbar.",
      "The ball starts at z = 2.2 m with a free joint; gravity does the rest.",
      "Check the 'contacts' series in Telemetry — it plots data.ncon over time.",
    ],
    presetId: "ball-drop",
    requires: { model: "ball_drop", bodies: ["ball"], geoms: ["ball", "floor"], joints: { root: "free" } },
    seconds: 2,
    verify: (e) => {
      e.reset();
      const ball = bodyId(e, "ball");
      const ballGeom = e.objId(e.OBJ.mjOBJ_GEOM.value, "ball");
      const floorGeom = e.objId(e.OBJ.mjOBJ_GEOM.value, "floor");
      let minZ = Infinity;
      let touched = false;
      e.simulate(2.0, () => {}, (eng) => {
        minZ = Math.min(minZ, Number(eng.data.xpos[3 * ball + 2]));
        touched ||= hasContactPair(eng, ballGeom, floorGeom);
      });
      const pass = Number.isFinite(minZ) && touched && minZ < 0.4;
      return {
        pass,
        detail: `ball min z=${minZ.toFixed(3)} m; ball–floor contact=${touched ? "yes" : "no"}. Contacts from the neighboring box do not count.`,
      };
    },
  },
  {
    id: "bounce-detector",
    title: "Detect the rebound",
    difficulty: "Easy",
    brief: "The ball is dropped from 2.2 m onto a soft contact. Prove it does NOT stick: it must fall faster than 2 m/s, then rebound (vz > +0.2).",
    goal: "Within 3 s: ball falls below z=0.4 m with |vz| > 2 m/s at some point, and at least one rebound (vz > +0.2 m/s afterwards) is detected.",
    hints: [
      "Track min vz while falling; when vz turns positive after minVz < -2, that is one rebound (contacts resolve over a few steps, so don't require consecutive-step sign flips).",
      "Resolve joint 'root' and use jnt_dofadr[root] + 2 for its world z velocity; do not assume every model has the same array layout.",
      "Compare contact parameters on both the ball and floor; parameter combination and the integration timestep affect the observed rebound.",
      "A positive solref damping ratio of 1 specifies critical damping in the reference response, not a universal guarantee of zero rebound.",
    ],
    presetId: "ball-drop",
    requires: { model: "ball_drop", bodies: ["ball"], geoms: ["ball", "floor"], joints: { root: "free" } },
    seconds: 3,
    verify: (e) => {
      e.reset();
      let rebounds = 0;
      let minVz = 0;
      let fellFast = false;
      let minZ = Infinity;
      let touched = false;
      const ball = bodyId(e, "ball");
      const root = e.objId(e.OBJ.mjOBJ_JOINT.value, "root");
      const vzAddress = Number(e.model.jnt_dofadr[root]) + 2;
      const ballGeom = e.objId(e.OBJ.mjOBJ_GEOM.value, "ball");
      const floorGeom = e.objId(e.OBJ.mjOBJ_GEOM.value, "floor");
      e.simulate(3.0, () => {}, (eng) => {
        const vz = Number(eng.data.qvel[vzAddress]);
        const z = Number(eng.data.xpos[3 * ball + 2]);
        touched ||= hasContactPair(eng, ballGeom, floorGeom);
        if (vz < minVz) minVz = vz;
        if (minVz < -2) fellFast = true;
        if (touched && vz > 0.2 && minVz < -2) {
          rebounds++;
          minVz = 0;
        }
        if (z < minZ) minZ = z;
      });
      const finalZ = Number(e.data.xpos[3 * ball + 2]);
      const pass = touched && rebounds >= 1 && fellFast && minZ < 0.4 && minZ > 0 && finalZ > 0.1;
      return {
        pass,
        detail: `rebounds=${rebounds}, fall faster than 2 m/s=${fellFast ? "yes" : "no"}, ball–floor contact=${touched ? "yes" : "no"}, minZ=${minZ.toFixed(3)} m, final z=${finalZ.toFixed(3)} m`,
      };
    },
  },
  {
    id: "cartpole-balance",
    title: "Balance the cartpole",
    difficulty: "Hard",
    brief: "Recover from a reproducible 0.08 rad pole tilt with feedback tuned and tested for this bundled cartpole. The full trajectory must stay within the limits.",
    goal: "Over 5 s: peak |hinge angle| < 0.5 rad and peak |cart x| < 1.8 m; final |hinge angle| < 0.1 rad.",
    hints: [
      "Tuned feedback: u = 120*theta + 40*theta_dot + 10*x + 15*x_dot, clamped to the named actuator's ctrlrange. These empirical gains were verified on this bundled model near upright; changes to mass, armature, gear or timestep require retesting.",
      "Pole-up is theta = 0 because the pole geom points along +z.",
      "Try changing gear in the XML — it scales ctrl into force.",
      "This is local balancing feedback, not swing-up or a trained policy. The positive cart-state gains help the coupled pole-and-cart system recover. Different coordinate conventions require re-deriving the feedback signs.",
    ],
    presetId: "cartpole",
    requires: { model: "cartpole", bodies: ["cart", "pole"], joints: { slider: "slide", hinge: "hinge" }, actuators: ["slide_motor"] },
    seconds: 5,
    autopilot: (e) => {
      const x = jntQpos(e, "slider");
      const xd = jntQvel(e, "slider");
      const th = jntQpos(e, "hinge");
      const thd = jntQvel(e, "hinge");
      if ([x, xd, th, thd].some((v) => !Number.isFinite(v))) return;
      // Empirically verified for the bundled cartpole at +/-0.08 rad, dt=0.01 s.
      // This local stabilizer is not a swing-up controller or a general tuning rule.
      const u = 120 * th + 40 * thd + 10 * x + 15 * xd;
      const aid = e.objId(e.OBJ.mjOBJ_ACTUATOR.value, "slide_motor");
      if (aid < 0) return;
      const limited = !!e.model.actuator_ctrllimited[aid];
      const lo = limited ? Number(e.model.actuator_ctrlrange[2 * aid]) : -Infinity;
      const hi = limited ? Number(e.model.actuator_ctrlrange[2 * aid + 1]) : Infinity;
      e.data.ctrl[aid] = Math.max(lo, Math.min(hi, u));
    },
    verify: (e) => {
      const ap = CHALLENGES.find((c) => c.id === "cartpole-balance")!.autopilot!;
      e.reset();
      const hinge = e.objId(e.OBJ.mjOBJ_JOINT.value, "hinge");
      e.data.qpos[e.model.jnt_qposadr[hinge]] = 0.08;
      e.mujoco.mj_forward(e.model, e.data);
      let maxAngle = 0.08;
      let maxCart = 0;
      let finite = true;
      e.simulate(5.0, ap, (eng) => {
        const angle = Math.abs(jntQpos(eng, "hinge"));
        const cart = Math.abs(jntQpos(eng, "slider"));
        finite &&= Number.isFinite(angle) && Number.isFinite(cart);
        maxAngle = Math.max(maxAngle, angle);
        maxCart = Math.max(maxCart, cart);
      });
      const th = Math.abs(jntQpos(e, "hinge"));
      const x = Math.abs(jntQpos(e, "slider"));
      const pass = finite && maxAngle < 0.5 && maxCart < 1.8 && th < 0.1;
      return {
        pass,
        detail: `start theta=0.080 rad; peak |theta|=${maxAngle.toFixed(3)} (<0.5), peak |x|=${maxCart.toFixed(3)} m (<1.8); final |theta|=${th.toFixed(3)} (<0.1), |x|=${x.toFixed(3)} m`,
      };
    },
  },
  {
    id: "spider-crawl",
    title: "Make the spider crawl",
    difficulty: "Medium",
    brief: "Evaluate the supplied open-loop gait. Forward travel only counts while the torso remains clear of the floor and reasonably upright.",
    goal: "Over 5 s: torso dx > 0.03 m, minimum torso z > 0.08 m, and torso local-up dot world-up > 0.5 throughout.",
    hints: [
      "Trot gait: diagonal leg pairs (FL+BR, FR+BL) swing in anti-phase: ctrl = A*sin(2*pi*f*t + phase).",
      "Actuator order follows the XML: FL_hip, FL_knee, FR_hip, FR_knee, BL_hip, BL_knee, BR_hip, BR_knee.",
      "Increase floor friction (friction='2 0.05 0.01') to get grip; try f = 1.5–2.5 Hz.",
      "Watch torso_pos[0] in Telemetry — the sensor literally plots this.",
    ],
    presetId: "spider",
    requires: {
      model: "spider", bodies: ["torso"], joints: { root: "free" },
      actuators: ["FL_hip_m", "FL_knee_m", "FR_hip_m", "FR_knee_m", "BL_hip_m", "BL_knee_m", "BR_hip_m", "BR_knee_m"],
    },
    seconds: 5,
    autopilot: (e) => {
      const t = e.data.time as number;
      const w = 2 * Math.PI * 2.0;
      const c = e.data.ctrl as any;
      // [FL, FR, BL, BR] hip phases: diagonal pairs in phase
      const phases = [0, Math.PI, Math.PI, 0];
      const names = ["FL", "FR", "BL", "BR"];
      for (let k = 0; k < 4; k++) {
        const hipId = e.objId(e.OBJ.mjOBJ_ACTUATOR.value, `${names[k]}_hip_m`);
        const kneeId = e.objId(e.OBJ.mjOBJ_ACTUATOR.value, `${names[k]}_knee_m`);
        if (hipId >= 0) c[hipId] = 0.55 * Math.sin(w * t + phases[k]);
        if (kneeId >= 0) c[kneeId] = 0.25 + 0.15 * Math.sin(w * t + phases[k]);
      }
    },
    verify: (e) => {
      e.reset();
      const torso = bodyId(e, "torso");
      const x0 = Number(e.data.xpos[3 * torso]);
      let minHeight = Number(e.data.xpos[3 * torso + 2]);
      let minUp = Number(e.data.xmat[9 * torso + 8]);
      const ap = CHALLENGES.find((c) => c.id === "spider-crawl")!.autopilot!;
      e.simulate(5.0, ap, (eng) => {
        minHeight = Math.min(minHeight, Number(eng.data.xpos[3 * torso + 2]));
        minUp = Math.min(minUp, Number(eng.data.xmat[9 * torso + 8]));
      });
      const x1 = Number(e.data.xpos[3 * torso]);
      const dx = x1 - x0;
      const pass = Number.isFinite(dx) && dx > 0.03 && minHeight > 0.08 && minUp > 0.5;
      return { pass, detail: `dx=${(dx * 100).toFixed(1)} cm (>3), min torso z=${minHeight.toFixed(3)} m (>0.08), min up dot=${minUp.toFixed(3)} (>0.5). Sliding on the torso or tumbling does not pass.` };
    },
  },
  {
    id: "chaos",
    title: "Release the double pendulum",
    difficulty: "Medium",
    brief: "Measure angular motion from the 'folded' keyframe. Passing a speed threshold demonstrates motion, not mathematical chaos.",
    goal: "Peak |qvel| > 2.5 rad/s within 3 s starting from keyframe 'folded'.",
    hints: [
      "The check explicitly resets its isolated run to keyframe 'folded' (qpos = 1.0, 1.2).",
      "To study sensitivity, compare two traces from keyframe qpos=1.0 1.2 and qpos=1.0 1.2001 with identical numerical settings. A speed test alone cannot establish chaos.",
      "No actuators here — pure gravity dynamics.",
    ],
    presetId: "double-pendulum",
    requires: { model: "double_pendulum", joints: { shoulder: "hinge", elbow: "hinge" }, keyframes: ["folded"] },
    seconds: 3,
    verify: (e) => {
      const keys = e.listKeyframes();
      const folded = keys.find((k) => k.name === "folded");
      e.reset(folded ? folded.id : -1);
      const s = e.simulate(3.0, () => {});
      const pass = s.maxSpeed > 2.5;
      return {
        pass,
        detail: `peak |qvel| = ${s.maxSpeed.toFixed(2)} rad/s (need > 2.5); qmax = [${s.qmax.map((v) => v.toFixed(2)).join(", ")}]`,
      };
    },
  },
  {
    id: "tune-the-solver",
    title: "Tune the solver (config challenge)",
    difficulty: "Easy",
    brief: "Edit the XML: switch the solver to Newton with >= 100 iterations, and add a keyframe. No physics genius needed — just MJCF literacy.",
    goal: "model.opt.solver == Newton AND model.opt.iterations >= 100 AND nkey >= 1.",
    hints: [
      "Solver enum values: PGS=0, CG=1, Newton=2 — in XML you write the name: solver='Newton'.",
      "A keyframe for a freejoint needs nq = 7 numbers: pos xyz + quat wxyz, e.g. qpos='0 0 2 1 0 0 0'.",
      "Then use the reset dropdown to jump back to your keyframe — mj_resetDataKeyframe.",
    ],
    xml: `<mujoco model="solver_tuning">
  <compiler angle="radian"/>
  <!-- CHALLENGE: change solver to Newton, iterations to >= 100, and add a <keyframe> -->
  <option timestep="0.002" solver="PGS" iterations="10" gravity="0 0 -9.81"/>
  <worldbody>
    <geom name="floor" type="plane" size="4 4 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="box" pos="0 0 1.5">
      <freejoint name="root"/>
      <geom name="box" type="box" size="0.2 0.2 0.2" mass="1" rgba="0.9 0.5 0.3 1"/>
    </body>
  </worldbody>
</mujoco>
`,
    requires: { model: "solver_tuning", bodies: ["box"], geoms: ["box", "floor"], joints: { root: "free" } },
    verify: (e) => {
      const newton = e.mujoco.mjtSolver.mjSOL_NEWTON.value as number;
      const solver = e.model.opt.solver as number;
      const iters = e.model.opt.iterations as number;
      const nkey = e.model.nkey as number;
      const pass = solver === newton && iters >= 100 && nkey >= 1;
      return {
        pass,
        detail: `solver=${solver} (Newton=${newton}), iterations=${iters}, nkey=${nkey} — need Newton + >=100 iters + >=1 keyframe`,
      };
    },
  },
];

/** Public predicates always validate the loaded scene, including headless callers. */
export const CHALLENGES: Challenge[] = DEFINITIONS.map((challenge) => ({
  ...challenge,
  verify: (engine) => validateChallengeModel(challenge, engine) ?? challenge.verify(engine),
}));
