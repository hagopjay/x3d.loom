import { controlSpecification } from '../mujoco/controllers';
import type { MuJoCoEngine } from "../mujoco/engine";

export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function modelName(xml: string) {
  return xml.match(/<mujoco\b[^>]*\bmodel\s*=\s*["']([^"']+)["']/)?.[1] ?? "experiment";
}

export function fileStem(xml: string) {
  return modelName(xml).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "experiment";
}

/** An observation packet: deliberately not advertised as a complete restart checkpoint. */
export function observationPacket(engine: MuJoCoEngine, note: string) {
  if (!engine.ready) throw new Error("Compile a model before exporting an observation.");
  engine.mujoco.mj_forward(engine.model, engine.data);
  engine.mujoco.mj_energyPos(engine.model, engine.data);
  engine.mujoco.mj_energyVel(engine.model, engine.data);
  const m = engine.model;
  const d = engine.data;
  const array = (value: ArrayLike<number>) => Array.from(value);
  return {
    schema: "mujoco-observatory/observation-v1",
    created_at: new Date().toISOString(),
    experiment_note: note,
    controller: engine.controlRecord ? structuredClone(engine.controlRecord) : { mode: "external-or-none", recorded: false },
    controller_implementation: controlSpecification(engine,engine.controlRecord),
    scheduler: { dropped_simulated_seconds: engine.droppedSeconds },
    engine: { name: "MuJoCo", version: engine.version, backend: "official single-threaded WebAssembly" },
    model: {
      name: modelName(engine.xml),
      compiled_source_xml: engine.xml,
      effective_editable_options: engine.optionsEditable(),
      counts: { bodies: m.nbody, joints: m.njnt, geoms: m.ngeom, nq: m.nq, nv: m.nv, nu: m.nu },
    },
    conventions: {
      world_up: "+Z", length: "metres", time: "seconds", angles: "radians",
      quaternion_order: "w,x,y,z", rotation_matrix_order: "row-major",
      telemetry_sampling: "display-frame samples, with duplicate simulation times suppressed",
    },
    state: {
      time: d.time, qpos: array(d.qpos), qvel: array(d.qvel),
      ctrl: array(d.ctrl), act: array(d.act), sensors: array(d.sensordata),
      energy: { potential_J: d.energy[0], kinetic_J: d.energy[1] },
    },
    bodies: engine.listBodies().map((body: { id: number; name: string; mass: number }) => ({
      id: body.id, name: body.name, parent_id: Number(m.body_parentid[body.id]), mass_kg: body.mass,
      world_position: array(d.xpos.slice(3 * body.id, 3 * body.id + 3)),
      world_quaternion_wxyz: array(d.xquat.slice(4 * body.id, 4 * body.id + 4)),
    })),
    joints: engine.listJoints(),
    sensors: engine.listSensors(),
    telemetry: {
      columns: engine.series.map(({ id, label, group }) => ({ id, label, group })),
      samples: engine.telemetry.map(row => ({ time: row.t, values: [...row.v] })),
    },
    limitations: [
      "Observation and analysis export, not a complete MuJoCo integration-state checkpoint.",
      "Live inspector settings are recorded separately; they do not rewrite the source XML.",
      "External mesh and texture assets are not embedded in this packet.",
      "The body-pose convention is explicit, but no X3D, X_ITE, Python, or game-engine adapter is implemented yet.",
    ],
  };
}

export function telemetryCsv(engine: MuJoCoEngine) {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["time_s", ...engine.series.map(s => s.id)].map(cell).join(",");
  const rows = engine.telemetry.map(row => [row.t, ...row.v].map(v => Number.isFinite(v) ? String(v) : "").join(","));
  return [header, ...rows].join("\r\n") + "\r\n";
}
