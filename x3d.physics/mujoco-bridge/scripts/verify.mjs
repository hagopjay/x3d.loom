/**
 * Real MuJoCo WASM verification; no browser and no mock physics.
 * Node 24+: node --import ./scripts/register-loader.mjs ./scripts/verify.mjs
 * Optional original comparison: append --baseline /path/to/original-b
 * Challenge goal_unmet is an observed learning outcome, not a runtime failure.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { MuJoCoEngine } from "../src/mujoco/engine.ts";
import { PRESETS } from "../src/data/presets.ts";
import { CHALLENGES } from "../src/data/challenges.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "validation");
const engine = new MuJoCoEngine();
const report = {
  schema: "mujoco-observatory-verification/1",
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: `${process.platform}/${process.arch}`,
  engineVersion: null,
  physics: "actual @mujoco/mujoco WASM, no mocked dynamics",
  scope: "Headless engine, embedded MJCF, extracted MJCF and challenge predicates. Browser layout, WebGL and full lesson prose are outside this script.",
  checks: [],
  presets: [],
  extractedModels: [],
  challenges: [],
  summary: {},
};

async function check(name, operation) {
  const start = performance.now();
  try {
    const details = await operation();
    report.checks.push({ name, status: "pass", milliseconds: round(performance.now() - start), details: details ?? null });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, status: "fail", milliseconds: round(performance.now() - start), error: String(error?.stack ?? error) });
    console.error(`FAIL ${name}: ${error?.message ?? error}`);
  }
}

function round(value) { return Math.round(value * 1e6) / 1e6; }
function near(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}
function finiteState(e) {
  for (const field of ["qpos", "qvel", "qacc", "xpos", "sensordata"]) {
    assert.ok(Array.from(e.data[field]).every(Number.isFinite), `nonfinite ${field}`);
  }
}
function counts(e) {
  return Object.fromEntries(["nbody", "njnt", "ngeom", "nu", "nsensor", "nq", "nv", "nkey"].map(k => [k, Number(e.model[k])]));
}
function starter(c, presets) {
  const xml = c.xml ?? presets.find(p => p.id === c.presetId)?.xml;
  assert.ok(xml, `missing starter for ${c.id}`);
  return xml;
}
function cleanup(e) {
  if (typeof e.dispose === "function") e.dispose();
  else { e.data?.delete?.(); e.model?.delete?.(); }
}
const sliderXML = `<mujoco model="verification_slider"><option timestep="0.01" gravity="0 0 0"/><worldbody><body name="mass"><joint name="slide" type="slide" axis="1 0 0"/><geom type="sphere" size="0.1" mass="1"/></body></worldbody></mujoco>`;

await mkdir(outputDirectory, { recursive: true });
await check("initialization is idempotent and loads real WASM", async () => {
  const one = engine.init();
  const two = engine.init();
  assert.equal(one, two);
  await Promise.all([one, two]);
  assert.equal(engine.status, "ready", engine.errorMsg ?? "WASM initialization failed");
  assert.equal(typeof engine.mujoco.mj_step, "function");
  assert.equal(typeof engine.mujoco.mj_energyPos, "function");
  assert.equal(typeof engine.mujoco.mj_energyVel, "function");
  assert.equal(engine.logs.filter(x => x.kind === "ok" && x.text.includes("WASM bindings")).length, 1);
  report.engineVersion = engine.version;
  return { version: engine.version };
});

if (engine.status === "ready") {
  await check("live option selectors ignore Embind enum metadata", () => {
    const expected = { mjtIntegrator: 5, mjtSolver: 3, mjtCone: 2, mjtJacobian: 3 };
    for (const [name, count] of Object.entries(expected)) {
      const options = engine.enumOptions(name);
      assert.equal(options.length, count, name);
      assert.ok(options.every(option => Number.isInteger(option.value)));
    }
    return expected;
  });
  for (const preset of PRESETS) {
    await check(`preset compiles and steps: ${preset.id}`, () => {
      engine.loadXML(preset.xml);
      for (const [list, count] of [["listBodies", "nbody"], ["listJoints", "njnt"], ["listGeoms", "ngeom"], ["listActuators", "nu"], ["listSensors", "nsensor"], ["listKeyframes", "nkey"]]) {
        assert.equal(engine[list]().length, Number(engine.model[count]), list);
      }
      engine.simulate(0.1);
      engine.sampleTelemetry();
      finiteState(engine);
      const entry = { id: preset.id, status: "compiled_and_stepped", ...counts(engine), time: round(engine.data.time), energy: Array.from(engine.data.energy), warnings: engine.warnings() };
      report.presets.push(entry);
      return entry;
    });
  }

  const modelDirectory = resolve(root, "salvage/models");
  for (const filename of (await readdir(modelDirectory)).filter(x => x.endsWith(".xml")).sort()) {
    await check(`extracted MJCF compiles and steps: ${filename}`, async () => {
      engine.loadXML(await readFile(resolve(modelDirectory, filename), "utf8"));
      engine.simulate(0.1);
      finiteState(engine);
      const entry = { filename, status: "compiled_and_stepped", ...counts(engine), time: round(engine.data.time), warnings: engine.warnings() };
      report.extractedModels.push(entry);
      return entry;
    });
  }

  await check("one second of physics at 30, 60 and 144 display Hz", () => {
    const measurements = [];
    for (const hz of [30, 60, 144]) {
      engine.loadXML(sliderXML);
      engine.data.qvel[0] = 1;
      engine.mujoco.mj_forward(engine.model, engine.data);
      engine.running = true;
      engine.speed = 1;
      let steps = 0;
      for (let frame = 0; frame < hz; frame++) steps += engine.advance(1 / hz);
      near(engine.data.time, 1);
      near(engine.data.qpos[0], 1);
      measurements.push({ displayHz: hz, steps, simulatedSeconds: round(engine.data.time), position: round(engine.data.qpos[0]) });
    }
    return measurements;
  });

  await check("slow motion, pause and single stepping", () => {
    engine.loadXML(sliderXML);
    engine.speed = 0.1;
    engine.running = true;
    for (let i = 0; i < 600; i++) engine.advance(1 / 60);
    near(engine.data.time, 1);
    engine.running = false;
    engine.advance(0.05);
    near(engine.data.time, 1);
    engine.step();
    near(engine.data.time, 1.01);
    engine.speed = 1;
    return { secondsAfterTenSecondsAtOneTenthSpeed: 1, secondsAfterPausedSingleStep: round(engine.data.time) };
  });

  await check("known kinetic energy and telemetry deduplication", () => {
    engine.loadXML(sliderXML);
    engine.data.qvel[0] = 2;
    engine.mujoco.mj_forward(engine.model, engine.data);
    engine.sampleTelemetry();
    engine.sampleTelemetry();
    near(engine.data.energy[0], 0);
    near(engine.data.energy[1], 2); // 1/2 * 1 kg * (2 m/s)^2
    assert.equal(engine.telemetry.length, 1);
    const index = engine.series.findIndex(x => x.id === "energy");
    near(engine.telemetry[0].v[index], 2);
    engine.step();
    engine.sampleTelemetry();
    assert.equal(engine.telemetry.length, 2);
    return { massKg: 1, velocityMPerSecond: 2, kineticJoules: engine.data.energy[1], samples: engine.telemetry.length };
  });

  await check("failed MJCF compilation retains the last valid running model", () => {
    engine.loadXML(sliderXML);
    engine.step(7);
    const model = engine.model;
    const data = engine.data;
    const time = engine.data.time;
    assert.throws(() => engine.loadXML('<mujoco><worldbody><geom type="not_a_real_shape"/></worldbody></mujoco>'), /MJCF compile error/);
    assert.equal(engine.model, model);
    assert.equal(engine.data, data);
    assert.equal(engine.xml, sliderXML);
    near(engine.data.time, time);
    engine.step();
    near(engine.data.time, time + 0.01);
    return { retained: true, canStillStep: true };
  });

  await check("fork isolates model and state while copying live options", () => {
    engine.loadXML(PRESETS.find(x => x.id === "cartpole").xml);
    engine.setOptNum("timestep", 0.005);
    engine.setOptNum("iterations", 123);
    engine.setOptNum("enableflags", engine.mujoco.mjtEnableBit.mjENBL_OVERRIDE.value);
    engine.setOptVec("gravity", [0, 0, -4.5]);
    engine.data.ctrl[0] = 0.3;
    engine.step(10);
    const before = { time: engine.data.time, qpos: Array.from(engine.data.qpos), ctrl: Array.from(engine.data.ctrl) };
    const fork = engine.fork();
    try {
      assert.equal(fork.mujoco, engine.mujoco);
      assert.notEqual(fork.model, engine.model);
      assert.notEqual(fork.data, engine.data);
      near(fork.model.opt.timestep, 0.005);
      assert.equal(fork.model.opt.iterations, 123);
      assert.equal(fork.model.opt.enableflags, engine.model.opt.enableflags);
      assert.deepEqual(Array.from(fork.model.opt.gravity), [0, 0, -4.5]);
      fork.simulate(0.3);
      assert.deepEqual({ time: engine.data.time, qpos: Array.from(engine.data.qpos), ctrl: Array.from(engine.data.ctrl) }, before);
    } finally {
      fork.dispose();
    }
    assert.equal(fork.ready, false);
    return { liveStateUnchanged: true, liveTime: before.time, independentAllocations: true, copiedIterations: 123 };
  });

  await check("controller restored when a headless observer throws", () => {
    engine.loadXML(sliderXML);
    const previous = () => {};
    engine.controller = previous;
    assert.throws(() => engine.simulate(0.1, () => {}, () => { throw new Error("intentional observer failure"); }), /intentional observer failure/);
    assert.equal(engine.controller, previous);
    engine.controller = null;
    return { restored: true };
  });

  await check("invalid timestep is rejected", () => {
    engine.loadXML(sliderXML);
    engine.setOptNum("timestep", 0);
    near(engine.model.opt.timestep, 0.01);
    engine.setOptNum("timestep", -1);
    near(engine.model.opt.timestep, 0.01);
  });

  await check("named pendulum keyframes match their described poses", () => {
    engine.loadXML(PRESETS.find(x => x.id === "pendulum").xml);
    const keys = engine.listKeyframes();
    const down = keys.find(x => x.name === "down");
    const up = keys.find(x => x.name === "up");
    assert.ok(down && up);
    engine.reset(down.id);
    near(engine.data.qpos[0], 0);
    assert.ok(engine.logs.at(-1).text.includes('"down"'));
    engine.reset(up.id);
    near(engine.data.qpos[0], Math.PI);
    return { keyframeNames: keys.map(x => x.name), downRadians: 0, upRadians: engine.data.qpos[0] };
  });

  await check("unlimited hinge retains angles greater than one revolution", () => {
    engine.loadXML('<mujoco model="continuous_hinge"><option gravity="0 0 0"/><worldbody><body><joint name="hinge" type="hinge" limited="false"/><geom type="sphere" size="0.1" mass="1"/></body></worldbody></mujoco>');
    const angle = 4 * Math.PI + 0.25;
    engine.data.qpos[0] = angle;
    engine.mujoco.mj_forward(engine.model, engine.data);
    engine.step();
    near(engine.data.qpos[0], angle);
    return { inputAngleRadians: angle, retainedAngleRadians: engine.data.qpos[0] };
  });

  await check("contact and warning handles support documented cleanup", () => {
    engine.loadXML(PRESETS.find(x => x.id === "ball-drop").xml);
    engine.simulate(1);
    const contacts = engine.data.contact;
    const count = contacts.size();
    try {
      assert.equal(typeof contacts.delete, "function");
      for (let i = 0; i < count; i++) {
        const contact = contacts.get(i);
        try {
          assert.equal(typeof contact.delete, "function");
          assert.ok(Array.from(contact.pos).every(Number.isFinite));
        } finally { contact.delete(); }
      }
    } finally { contacts.delete(); }
    for (let i = 0; i < 5; i++) assert.ok(Array.isArray(engine.warnings()));
    return { contactsInspected: count, handleCleanupSupported: true };
  });

  for (const challenge of CHALLENGES) {
    await check(`challenge executes on its starter: ${challenge.id}`, () => {
      engine.loadXML(starter(challenge, PRESETS));
      const isolated = engine.fork();
      const start = performance.now();
      try {
        const result = challenge.verify(isolated);
        assert.equal(typeof result.pass, "boolean");
        assert.equal(typeof result.detail, "string");
        finiteState(isolated);
        const entry = { id: challenge.id, status: result.pass ? "goal_met" : "goal_unmet", pass: result.pass, detail: result.detail, simulatedSeconds: round(isolated.data.time), milliseconds: round(performance.now() - start), warnings: isolated.warnings() };
        report.challenges.push(entry);
        assert.equal(engine.data.time, 0, "challenge changed the live engine time");
        return entry;
      } catch (error) {
        report.challenges.push({ id: challenge.id, status: "runtime_error", pass: false, error: String(error?.message ?? error) });
        throw error;
      } finally { isolated.dispose(); }
    });
  }

  await check("challenges reject an unrelated model without stepping it", () => {
    engine.loadXML(sliderXML);
    for (const c of CHALLENGES) {
      const result = c.verify(engine);
      assert.equal(result.pass, false, c.id);
      assert.match(result.detail, /expects model=/, c.id);
      assert.equal(engine.data.time, 0, c.id);
    }
    return { rejected: CHALLENGES.map(c => c.id) };
  });

  await check("solver-tuning challenge passes a genuinely completed fixture", () => {
    const challenge = CHALLENGES.find(c => c.id === "tune-the-solver");
    const xml = challenge.xml.replace('solver="PGS" iterations="10"', 'solver="Newton" iterations="100"').replace("</mujoco>", '<keyframe><key name="start" qpos="0 0 1.5 1 0 0 0"/></keyframe></mujoco>');
    engine.loadXML(xml);
    const result = challenge.verify(engine);
    assert.equal(result.pass, true, result.detail);
    return result;
  });
}

const baselineIndex = process.argv.indexOf("--baseline");
if (baselineIndex >= 0) {
  const baselineRoot = resolve(process.argv[baselineIndex + 1]);
  const importAt = async (path) => import(pathToFileURL(resolve(baselineRoot, path)).href);
  const { MuJoCoEngine: OriginalEngine } = await importAt("src/mujoco/engine.ts");
  const { PRESETS: originalPresets } = await importAt("src/data/presets.ts");
  const { CHALLENGES: originalChallenges } = await importAt("src/data/challenges.ts");
  const original = new OriginalEngine();
  const baseline = { generatedAt: report.generatedAt, source: basename(baselineRoot), engineVersion: null, frameTiming: [], energy: null, challenges: [] };
  try {
    await original.init();
    assert.equal(original.status, "ready", original.errorMsg);
    baseline.engineVersion = original.version;
    for (const hz of [30, 60, 144]) {
      original.loadXML(sliderXML);
      original.running = true;
      let steps = 0;
      for (let i = 0; i < hz; i++) steps += original.advance(1 / hz);
      baseline.frameTiming.push({ displayHz: hz, wallSeconds: 1, physicsTimestep: 0.01, simulatedSeconds: round(original.data.time), steps });
    }
    original.loadXML(sliderXML);
    original.data.qvel[0] = 2;
    original.mujoco.mj_forward(original.model, original.data);
    original.sampleTelemetry();
    baseline.energy = { expectedJoules: 2, displayedJoules: original.telemetry[0].v[original.series.findIndex(s => s.id === "energy")] };
    for (const c of originalChallenges) {
      try {
        original.loadXML(starter(c, originalPresets));
        const result = c.verify(original);
        baseline.challenges.push({ id: c.id, status: result.pass ? "goal_met" : "goal_unmet", ...result });
      } catch (error) { baseline.challenges.push({ id: c.id, status: "runtime_error", error: String(error?.message ?? error) }); }
    }
  } catch (error) { baseline.error = String(error?.stack ?? error); }
  finally { cleanup(original); }
  await writeFile(resolve(outputDirectory, "original-b-baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
  report.baselineFile = "original-b-baseline.json";
  console.log("Recorded original-B comparison.");
}

cleanup(engine);
report.summary = {
  checksPassed: report.checks.filter(x => x.status === "pass").length,
  checksFailed: report.checks.filter(x => x.status === "fail").length,
  presetsCompiled: report.presets.length,
  extractedModelsCompiled: report.extractedModels.length,
  challengeGoalsMet: report.challenges.filter(x => x.status === "goal_met").length,
  challengeGoalsUnmet: report.challenges.filter(x => x.status === "goal_unmet").length,
  challengeRuntimeErrors: report.challenges.filter(x => x.status === "runtime_error").length,
};
await writeFile(resolve(outputDirectory, "runtime-results.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
console.log("Results: validation/runtime-results.json");
process.exitCode = report.summary.checksFailed ? 1 : 0;
