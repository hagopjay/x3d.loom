import { useEffect, useMemo, useState } from "react";
import type { MuJoCoEngine } from "../mujoco/engine";
import { enumLabel } from "../mujoco/engine";
import { Card } from "./ui";

type SubTab = "model" | "state" | "actuators" | "sensors" | "options";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "model", label: "Model" },
  { id: "state", label: "State" },
  { id: "actuators", label: "Actuators" },
  { id: "sensors", label: "Sensors" },
  { id: "options", label: "Options (live)" },
];

function fmt(v: number, d = 3): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="sticky top-0 z-10 bg-slate-900 px-2 py-1 text-left font-semibold text-slate-400">{children}</th>;
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-2 py-1 align-top text-slate-300 ${mono ? "font-mono text-[11px]" : "text-xs"}`}>{children}</td>;
}

export default function Inspector({
  engine,
  modelVersion,
  tick,
}: {
  engine: MuJoCoEngine;
  modelVersion: number;
  tick: number;
}) {
  const [sub, setSub] = useState<SubTab>("model");
  const ready = engine.ready;

  // keep memoized lists fresh-ish while running
  const lists = useMemo(() => {
    if (!ready) return null;
    return {
      bodies: engine.listBodies(),
      joints: engine.listJoints(),
      geoms: engine.listGeoms(),
      actuators: engine.listActuators(),
      sensors: engine.listSensors(),
      keys: engine.listKeyframes(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, modelVersion, tick]);

  return (
    <Card
      className="h-full"
      title="Inspector"
      actions={
        <div className="flex gap-1">
          {SUBTABS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSub(s.id)}
              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                sub === s.id ? "bg-sky-500/20 text-sky-300" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-full min-h-0 overflow-auto p-2">
        {!ready && <div className="p-2 text-xs text-slate-500">no model compiled yet</div>}
        {ready && lists && sub === "model" && <ModelView engine={engine} lists={lists} />}
        {ready && lists && sub === "state" && <StateView engine={engine} joints={lists.joints} tick={tick} />}
        {ready && lists && sub === "actuators" && <ActuatorView engine={engine} actuators={lists.actuators} tick={tick} />}
        {ready && lists && sub === "sensors" && <SensorView engine={engine} sensors={lists.sensors} tick={tick} />}
        {ready && sub === "options" && <OptionsView engine={engine} modelVersion={modelVersion} />}
      </div>
    </Card>
  );
}

function ModelView({ engine, lists }: { engine: MuJoCoEngine; lists: any }) {
  const m = engine.model;
  const counts: [string, number][] = [
    ["nbody", m.nbody], ["njnt", m.njnt], ["ngeom", m.ngeom], ["nu", m.nu],
    ["nsensor", m.nsensor], ["nsite", m.nsite ?? 0], ["nkey", m.nkey], ["nq", m.nq], ["nv", m.nv],
    ["timestep", m.opt.timestep],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1.5">
        {counts.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5">
            <div className="font-mono text-sm font-semibold text-sky-300">{typeof v === "number" && k === "timestep" ? v : String(v)}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
          </div>
        ))}
      </div>
      <Table title={`Bodies (${lists.bodies.length})`}>
        <table className="w-full border-collapse">
          <thead><tr><Th>name</Th><Th>parent</Th><Th>mass</Th><Th>local pos</Th></tr></thead>
          <tbody>
            {lists.bodies.map((b: any) => (
              <tr key={b.id} className="border-t border-slate-800/60">
                <Td mono>{b.name}</Td><Td mono>{b.parentName}</Td><Td mono>{fmt(b.mass)}</Td>
                <Td mono>[{b.pos.map((p: number) => fmt(p, 2)).join(", ")}]</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>
      <Table title={`Joints (${lists.joints.length})`}>
        <table className="w-full border-collapse">
          <thead><tr><Th>name</Th><Th>type</Th><Th>axis</Th><Th>range</Th><Th>qposadr</Th><Th>dofadr</Th></tr></thead>
          <tbody>
            {lists.joints.map((j: any) => (
              <tr key={j.id} className="border-t border-slate-800/60">
                <Td mono>{j.name}</Td><Td>{j.type}</Td>
                <Td mono>[{j.axis.map((a: number) => fmt(a, 2)).join(", ")}]</Td>
                <Td mono>{j.limited ? `[${j.range.map((r: number) => fmt(r, 2)).join(", ")}]` : "—"}</Td>
                <Td mono>{j.qposadr}</Td><Td mono>{j.dofadr}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>
      <Table title={`Geoms (${lists.geoms.length})`}>
        <table className="w-full border-collapse">
          <thead><tr><Th>name</Th><Th>type</Th><Th>body</Th><Th>size</Th><Th>ct/cf</Th><Th>rgba</Th></tr></thead>
          <tbody>
            {lists.geoms.map((g: any) => (
              <tr key={g.id} className="border-t border-slate-800/60">
                <Td mono>{g.name}</Td><Td>{g.type}</Td><Td mono>{g.body}</Td>
                <Td mono>[{g.size.map((s: number) => fmt(s, 3)).join(", ")}]</Td>
                <Td mono>{g.contype}/{g.conaffinity}</Td>
                <Td>
                  <span className="inline-block h-3 w-3 rounded-sm border border-slate-700 align-middle" style={{ background: `rgba(${g.rgba.slice(0, 3).map((c: number) => Math.round(c * 255)).join(",")},${Math.max(0, Math.min(1, g.rgba[3]))})` }} />
                  <span className="ml-1 font-mono text-[10px] text-slate-500">[{g.rgba.map((c: number) => fmt(c, 2)).join(",")}]</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>
      <Table title={`Actuators (${lists.actuators.length})`}>
        <table className="w-full border-collapse">
          <thead><tr><Th>name</Th><Th>transmits</Th><Th>gear</Th><Th>ctrlrange</Th><Th>forcerange</Th></tr></thead>
          <tbody>
            {lists.actuators.map((a: any) => (
              <tr key={a.id} className="border-t border-slate-800/60">
                <Td mono>{a.name}</Td><Td mono>{a.trnType}:{a.jointName}</Td>
                <Td mono>[{a.gear.map((g: number) => fmt(g, 2)).join(", ")}]</Td>
                <Td mono>{a.ctrllimited ? `[${a.ctrlrange.map((r: number) => fmt(r, 1)).join(", ")}]` : "auto"}</Td>
                <Td mono>{a.forcelimited ? `[${a.forcerange.map((r: number) => fmt(r, 1)).join(", ")}]` : "auto"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>
      {lists.keys.length > 0 && (
        <Table title={`Keyframes (${lists.keys.length})`}>
          <table className="w-full border-collapse">
            <thead><tr><Th>name</Th><Th>time</Th></tr></thead>
            <tbody>
              {lists.keys.map((k: any) => (
                <tr key={k.id} className="border-t border-slate-800/60"><Td mono>{k.name}</Td><Td mono>{fmt(k.time, 2)}</Td></tr>
              ))}
            </tbody>
          </table>
        </Table>
      )}
    </div>
  );
}

function Table({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="overflow-hidden rounded-lg border border-slate-800" open>
      <summary className="cursor-pointer bg-slate-900/90 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</summary>
      <div className="max-h-44 overflow-auto">{children}</div>
    </details>
  );
}

function StateView({ engine, joints, tick }: { engine: MuJoCoEngine; joints: any[]; tick: number }) {
  void tick;
  const d = engine.data;
  const qpos = d.qpos as ArrayLike<number>;
  const qvel = d.qvel as ArrayLike<number>;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-[11px] leading-relaxed text-slate-400">
        <span className="font-mono text-sky-300">nq = {engine.model.nq}</span> position values ·{" "}
        <span className="font-mono text-sky-300">nv = {engine.model.nv}</span> velocity values.
        Quaternion order is <span className="font-mono">w, x, y, z</span>; each four-value quaternion has three angular-velocity components.
      </div>
      <table className="w-full border-collapse" aria-label="Generalized joint state">
        <thead>
          <tr><Th>joint</Th><Th>qpos</Th><Th>qvel</Th></tr>
        </thead>
        <tbody>
          {joints.map((j: any) => {
            const type = String(j.type).toLowerCase();
            const free = type === "free";
            const ball = type === "ball";
            const slide = type === "slide";
            const qcount = free ? 7 : ball ? 4 : 1;
            const vcount = free ? 6 : ball ? 3 : 1;
            const q = qpos[j.qposadr] as number;
            const lo = j.range[0] as number;
            const hi = j.range[1] as number;
            const showLimit = !free && !ball && j.limited && Number.isFinite(q) && hi > lo;
            const fraction = showLimit ? Math.max(0, Math.min(1, (q - lo) / (hi - lo))) : 0;
            return (
              <tr key={j.id} className="border-t border-slate-800/60">
                <Td mono>
                  <div className="break-all text-slate-200">{j.name}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{type} · {qcount} / {vcount}</div>
                </Td>
                <Td mono>
                  {free ? (
                    <div className="space-y-2">
                      <StateVector values={qpos} offset={j.qposadr} labels={["x", "y", "z"]} arrayName="qpos" caption="position · world · m" />
                      <StateVector values={qpos} offset={j.qposadr + 3} labels={["w", "x", "y", "z"]} arrayName="qpos" caption="quaternion · world · unitless" />
                    </div>
                  ) : ball ? (
                    <StateVector values={qpos} offset={j.qposadr} labels={["w", "x", "y", "z"]} arrayName="qpos" caption="quaternion · joint rotation · unitless" />
                  ) : (
                    <div>
                      <span title={`qpos[${j.qposadr}]`}>{fmt(q)} <span className="text-slate-500">{slide ? "m" : "rad"}</span></span>
                      <div className="text-[9px] text-slate-600">qpos[{j.qposadr}]</div>
                      {showLimit && (
                        <div className="mt-1 h-1 w-24 rounded bg-slate-800" title={`Joint range: ${fmt(lo)} to ${fmt(hi)} ${slide ? "m" : "rad"}`}>
                          <div className="h-1 rounded bg-sky-500/80" style={{ width: `${fraction * 100}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                </Td>
                <Td mono>
                  {free ? (
                    <div className="space-y-2">
                      <StateVector values={qvel} offset={j.dofadr} labels={["vx", "vy", "vz"]} arrayName="qvel" caption="linear · world · m/s" />
                      <StateVector values={qvel} offset={j.dofadr + 3} labels={["ωx", "ωy", "ωz"]} arrayName="qvel" caption="angular · body · rad/s" />
                    </div>
                  ) : ball ? (
                    <StateVector values={qvel} offset={j.dofadr} labels={["ωx", "ωy", "ωz"]} arrayName="qvel" caption="angular · local · rad/s" />
                  ) : (
                    <div>
                      <span title={`qvel[${j.dofadr}]`}>{fmt(qvel[j.dofadr])} <span className="text-slate-500">{slide ? "m/s" : "rad/s"}</span></span>
                      <div className="text-[9px] text-slate-600">qvel[{j.dofadr}]</div>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
          {joints.length === 0 && <tr><td colSpan={3} className="p-2 text-xs text-slate-500">This model has no joint state.</td></tr>}
        </tbody>
      </table>
      <a href="https://mujoco.readthedocs.io/en/stable/overview.html#floating-objects" target="_blank" rel="noreferrer" className="inline-block text-[10px] text-sky-400 hover:text-sky-300">MuJoCo coordinate conventions ↗</a>
    </div>
  );
}

function StateVector({ values, offset, labels, arrayName, caption }: {
  values: ArrayLike<number>;
  offset: number;
  labels: string[];
  arrayName: "qpos" | "qvel";
  caption: string;
}) {
  return (
    <div>
      <div className="mb-0.5 text-[9px] text-slate-500">{caption}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {labels.map((label, i) => (
          <span key={label} title={`${arrayName}[${offset + i}]`} className="whitespace-nowrap">
            <span className="mr-1 text-slate-500">{label}</span>{fmt(values[offset + i])}
          </span>
        ))}
      </div>
      <div className="mt-0.5 text-[9px] text-slate-600">{arrayName}[{offset}…{offset + labels.length - 1}]</div>
    </div>
  );
}

function ActuatorView({ engine, actuators, tick }: { engine: MuJoCoEngine; actuators: any[]; tick: number }) {
  void tick;
  const d = engine.data;
  const ctrl = d.ctrl as any;
  const force = d.actuator_force as ArrayLike<number>;
  const [, setLocal] = useState(0);
  return (
    <div className="space-y-2 p-1">
      {actuators.length === 0 && <div className="text-xs text-slate-500">no actuators in this model</div>}
      {actuators.map((a: any) => {
        const lo = a.ctrllimited ? a.ctrlrange[0] : -10;
        const hi = a.ctrllimited ? a.ctrlrange[1] : 10;
        const val = (ctrl[a.id] as number) ?? 0;
        return (
          <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-200">{a.name}</span>
              <span className="font-mono text-[11px] text-slate-500">
                ctrl <span className="text-sky-300">{fmt(val, 2)}</span> · force <span className="text-amber-300">{fmt(force[a.id] as number, 2)}</span>
              </span>
            </div>
            <input
              type="range"
              min={lo}
              max={hi}
              step={(hi - lo) / 200 || 0.01}
              value={val}
              onChange={(e) => {
                ctrl[a.id] = Number(e.target.value);
                setLocal((x) => x + 1);
              }}
              className="w-full"
            />
            <div className="flex justify-between font-mono text-[10px] text-slate-600">
              <span>{fmt(lo, 1)}</span>
              <span className="text-slate-500">{a.jointName}</span>
              <span>{fmt(hi, 1)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SensorView({ engine, sensors, tick }: { engine: MuJoCoEngine; sensors: any[]; tick: number }) {
  void tick;
  const sd = engine.data.sensordata as ArrayLike<number>;
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr><Th>sensor</Th><Th>type</Th><Th>dim</Th><Th>sensordata[adr…]</Th></tr>
      </thead>
      <tbody>
        {sensors.map((s: any) => {
          const vals: string[] = [];
          for (let k = 0; k < s.dim; k++) vals.push(fmt(sd[s.adr + k] as number, 3));
          return (
            <tr key={s.id} className="border-t border-slate-800/60">
              <Td mono>{s.name}</Td>
              <Td>{s.type}</Td>
              <Td mono>{s.dim}</Td>
              <Td mono>[{vals.join(", ")}]</Td>
            </tr>
          );
        })}
        {sensors.length === 0 && (
          <tr><td colSpan={4} className="px-2 py-2 text-xs text-slate-500">no sensors — add a &lt;sensor&gt; block to the XML</td></tr>
        )}
      </tbody>
    </table>
  );
}

function OptionsView({ engine, modelVersion }: { engine: MuJoCoEngine; modelVersion: number }) {
  const mj = engine.mujoco;
  const [vals, setVals] = useState<Record<string, any>>({});
  const readOptions = () => ({ ...engine.optionsEditable(), enableflags: Number(engine.model.opt.enableflags) });
  useEffect(() => {
    if (engine.ready) setVals(readOptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, modelVersion]);

  const setNum = (key: string, v: number) => {
    engine.setOptNum(key, v);
    setVals(readOptions());
  };
  const setVec = (key: string, values: number[]) => {
    engine.setOptVec(key, values);
    setVals(readOptions());
  };
  const overrideBit = mj.mjtEnableBit?.mjENBL_OVERRIDE?.value as number | undefined;
  const overrideEnabled = overrideBit !== undefined && ((vals.enableflags ?? Number(engine.model.opt.enableflags)) & overrideBit) !== 0;
  const numFields: [string, string][] = [
    ["timestep", "timestep (s)"],
    ["iterations", "solver iterations"],
    ["ls_iterations", "line-search iters"],
    ["tolerance", "solver tolerance"],
    ["noslip_iterations", "noslip iters"],
    ["impratio", "impratio"],
    ["density", "air density"],
    ["viscosity", "viscosity"],
    ["o_margin", "override margin (m)"],
  ];
  const enumFields: [string, string, string][] = [
    ["integrator", "integrator", "mjtIntegrator"],
    ["solver", "solver", "mjtSolver"],
    ["cone", "friction cone", "mjtCone"],
    ["jacobian", "jacobian", "mjtJacobian"],
  ];

  return (
    <div className="space-y-3 p-1">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200/90">
        These settings change the live model and take effect on subsequent simulation steps. They do not edit the XML source.
        Recompiling restores the settings in that source; record your live settings when comparing experiments.
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {numFields.map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
            <input
              type="number"
              step="any"
              className="w-full font-mono !text-xs disabled:opacity-40"
              disabled={key === "o_margin" && !overrideEnabled}
              value={vals[key] ?? 0}
              onChange={(e) => setNum(key, Number(e.target.value))}
            />
          </label>
        ))}
        {enumFields.map(([key, label, enumName]) => (
          <label key={key} className="block">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
            <select
              className="w-full !py-1 font-mono !text-xs"
              value={(vals[key] as number) ?? 0}
              onChange={(e) => setNum(key, Number(e.target.value))}
            >
              {engine.enumOptions(enumName).map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label.replace(/^mj[A-Z]+_/, "")} ({o.value})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">gravity (m/s²)</div>
        <div className="grid grid-cols-3 gap-2">
          {["x", "y", "z"].map((ax, i) => (
            <input
              key={ax}
              aria-label={`Gravity ${ax} in metres per second squared`}
              type="number"
              step="any"
              className="w-full font-mono !text-xs"
              value={(vals.gravity as number[] | undefined)?.[i] ?? 0}
              onChange={(e) => {
                const g = [...((vals.gravity as number[]) ?? [0, 0, -9.81])];
                g[i] = Number(e.target.value);
                setVec("gravity", g);
              }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={overrideEnabled}
            disabled={overrideBit === undefined}
            onChange={(event) => {
              if (overrideBit === undefined) return;
              const flags = Number(engine.model.opt.enableflags);
              setNum("enableflags", event.target.checked ? flags | overrideBit : flags & ~overrideBit);
            }}
          />
          Enable contact override
          <span className={`ml-auto text-[10px] ${overrideEnabled ? "text-amber-300" : "text-slate-500"}`}>{overrideEnabled ? "active" : "inactive"}</span>
        </label>
        <p className="text-[10px] leading-relaxed text-slate-500">
          The <span className="font-mono">o_*</span> contact settings require the override flag. Enabling it uses the model's override values for all contacts, including its stored friction and impedance settings.
        </p>
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">o_solref · contact response</div>
        <div className="grid grid-cols-2 gap-2">
          {(vals.o_solref as number[] | undefined ?? [0.02, 1]).map((v, i) => (
            <input
              key={i}
              type="number"
              aria-label={`Contact solref value ${i + 1}`}
              step="any"
              className="w-full font-mono !text-xs disabled:opacity-40"
              disabled={!overrideEnabled}
              value={v}
              onChange={(e) => {
                const arr = [...((vals.o_solref as number[]) ?? [0.02, 1])];
                arr[i] = Number(e.target.value);
                setVec("o_solref", arr);
              }}
            />
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">Positive format: time constant (s), damping ratio. Direct format: −stiffness, −damping.</p>
        <a href="https://mujoco.readthedocs.io/en/stable/modeling.html#contact-override" target="_blank" rel="noreferrer" className="inline-block text-[10px] text-sky-400 hover:text-sky-300">Contact override reference ↗</a>
      </div>
      <div className="font-mono text-[10px] text-slate-600">
        enums: integrator={enumLabel(mj.mjtIntegrator, vals.integrator ?? 0)}, solver={enumLabel(mj.mjtSolver, vals.solver ?? 0)}, cone={enumLabel(mj.mjtCone, vals.cone ?? 0)}
      </div>
    </div>
  );
}
