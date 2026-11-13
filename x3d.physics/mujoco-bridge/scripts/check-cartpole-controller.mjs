/** Real WASM comparison of inherited and recovered cartpole feedback. */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { MuJoCoEngine } from "../src/mujoco/engine.ts";
import { PRESETS } from "../src/data/presets.ts";
import { CHALLENGES } from "../src/data/challenges.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const e = new MuJoCoEngine();
await e.init();
assert.equal(e.status, "ready", e.errorMsg);
e.loadXML(PRESETS.find(p => p.id === "cartpole").xml);
const position = name => e.model.jnt_qposadr[e.objId(e.OBJ.mjOBJ_JOINT.value, name)];
const velocity = name => e.model.jnt_dofadr[e.objId(e.OBJ.mjOBJ_JOINT.value, name)];
const xAddress = position("slider");
const angleAddress = position("hinge");
const velocityAddress = velocity("slider");
const angularVelocityAddress = velocity("hinge");
const actuator = e.objId(e.OBJ.mjOBJ_ACTUATOR.value, "slide_motor");
const inherited = eng => {
  const u = 30 * eng.data.qpos[angleAddress] + 6 * eng.data.qvel[angularVelocityAddress]
    - 4 * eng.data.qpos[xAddress] - 2 * eng.data.qvel[velocityAddress];
  eng.data.ctrl[actuator] = Math.max(-60, Math.min(60, u));
};
const tuned = CHALLENGES.find(c => c.id === "cartpole-balance").autopilot;
const cases = [
  { id: "inherited_zero_start", initialAngle: 0, control: inherited },
  { id: "uncontrolled_perturbed", initialAngle: 0.08, control: eng => { eng.data.ctrl[actuator] = 0; } },
  { id: "inherited_perturbed", initialAngle: 0.08, control: inherited },
  { id: "tuned_perturbed", initialAngle: 0.08, control: tuned },
  { id: "tuned_mirrored_perturbation", initialAngle: -0.08, control: tuned },
];
const result = {
  generatedAt: new Date().toISOString(),
  engineVersion: e.version,
  model: "bundled cartpole, unchanged MJCF",
  timestepSeconds: e.model.opt.timestep,
  durationSeconds: 5,
  tuningMethod: "Empirical screening of simple four-state linear feedback gains using the actual WASM model; no learned policy or global stability claim.",
  inheritedEquation: "u = 30*theta + 6*theta_dot - 4*x - 2*x_dot",
  tunedEquation: "u = 120*theta + 40*theta_dot + 10*x + 15*x_dot",
  controlLimits: [-60, 60],
  unchangedPassCriteria: { peakAbsAngleLessThanRadians: 0.5, peakAbsCartLessThanMeters: 1.8, finalAbsAngleLessThanRadians: 0.1 },
  scope: "Five-second near-upright recovery on the bundled parameters and tested initial states. This does not establish robust stability under arbitrary disturbances, modified dynamics or timestep changes, and does not implement swing-up.",
  cases: [],
};
try {
  for (const test of cases) {
    e.reset();
    e.data.qpos[angleAddress] = test.initialAngle;
    e.mujoco.mj_forward(e.model, e.data);
    let peakAngle = Math.abs(test.initialAngle);
    let peakCart = 0;
    let peakControl = 0;
    e.simulate(5, eng => {
      test.control(eng);
      peakControl = Math.max(peakControl, Math.abs(eng.data.ctrl[actuator]));
    }, eng => {
      peakAngle = Math.max(peakAngle, Math.abs(eng.data.qpos[angleAddress]));
      peakCart = Math.max(peakCart, Math.abs(eng.data.qpos[xAddress]));
    });
    const finalAngle = Math.abs(e.data.qpos[angleAddress]);
    const row = {
      id: test.id, initialAngleRadians: test.initialAngle,
      peakAbsAngleRadians: peakAngle, peakAbsCartMeters: peakCart,
      finalAbsAngleRadians: finalAngle, finalCartMeters: e.data.qpos[xAddress],
      peakAbsControl: peakControl,
      pass: peakAngle < 0.5 && peakCart < 1.8 && finalAngle < 0.1,
      warnings: e.warnings(),
    };
    result.cases.push(row);
    console.log(`${row.id}: ${row.pass ? "goal met" : "goal unmet"}; peak angle=${peakAngle.toFixed(6)}, peak cart=${peakCart.toFixed(6)}, final angle=${finalAngle.toFixed(8)}`);
  }
  assert.equal(result.cases.find(x => x.id === "inherited_zero_start").pass, true);
  assert.equal(result.cases.find(x => x.id === "inherited_perturbed").pass, false);
  assert.equal(result.cases.find(x => x.id === "uncontrolled_perturbed").pass, false);
  assert.equal(result.cases.find(x => x.id === "tuned_perturbed").pass, true);
  assert.equal(result.cases.find(x => x.id === "tuned_mirrored_perturbation").pass, true);
} finally {
  e.dispose();
  await mkdir(resolve(root, "validation"), { recursive: true });
  await writeFile(resolve(root, "validation/cartpole-controller-comparison.json"), JSON.stringify(result, null, 2) + "\n");
}
