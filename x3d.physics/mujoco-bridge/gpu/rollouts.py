"""Batched GPU rollouts for contact-arm/1 experiment packages (MJX on JAX; MuJoCo Warp optional).

SKETCH, NOT YET RUN ON A GPU. Embedded into mujoco_bridge_gpu.ipynb by build_notebook.py,
together with x3d_mcp's mujoco_bridge package (contract, safety, scene_io), so the notebook
reads and writes exactly the experiment-package format the browser bridge and the MCP
simulate tool use.

Flow: read package -> base recipe and target -> a sweep of variants (joint targets, obstacle
position and radius, link masses) -> one compiled model per (upperLength, lowerLength) group ->
vmapped MJX rollouts with the browser's joint-space PD controller -> per-world metrics ->
records/gpu-batch.json in a results package, plus the top variants as their own packages
(X3D annotations edited, so the browser can import and replay each one).
"""

from __future__ import annotations

import copy
import itertools
import json
import math
import time
from dataclasses import dataclass

import numpy as np
from lxml import etree

from mujoco_bridge.contract import ARM_PD, compile_recipe, parse_recipe, parse_target
from mujoco_bridge.safety import parse_xml
from mujoco_bridge.scene_io import read_contact_arm_scene, read_package, write_package

# Profiles: sizes are Estimates until the doctor cell measures steps per second on the G4.
PROFILES = {
    "smoke": {"targets": 4, "obstacle_xy": 2, "radii": [0.11], "masses": [1.0], "steps": 500},
    "core": {"targets": 16, "obstacle_xy": 8, "radii": [0.06, 0.11, 0.16], "masses": [0.5, 1.0, 2.0], "steps": 2500},
    "full": {"targets": 32, "obstacle_xy": 16, "radii": [0.05, 0.08, 0.11, 0.14, 0.17], "masses": [0.5, 1.0, 1.5, 2.0], "steps": 2500},
}


@dataclass
class Variant:
    recipe: dict
    target: list[float]

    def key(self) -> tuple:
        return (self.recipe["upperLength"], self.recipe["lowerLength"])


def sweep(base_recipe: dict, base_target, profile: str) -> list[Variant]:
    """Grid around the package's own recipe. Every variant is validated by parse_recipe/parse_target."""
    p = PROFILES[profile]
    n = p["targets"]
    side = int(math.isqrt(n))
    sh = np.linspace(-0.6, 1.2, side)
    el = np.linspace(0.2, 1.6, max(1, n // side))
    m = p["obstacle_xy"]
    ox = np.linspace(0.55, 1.05, int(math.isqrt(m)) or 1)
    oy = np.linspace(0.3, 0.9, max(1, m // (int(math.isqrt(m)) or 1)))
    out = []
    for (a, b), (x, y), r, k in itertools.product(itertools.product(sh, el), itertools.product(ox, oy), p["radii"], p["masses"]):
        rec = copy.deepcopy(base_recipe)
        rec["obstacle"]["position"] = [float(x), float(y), 0.34]
        rec["obstacle"]["radius"] = float(r)
        rec["upperMass"] = float(np.clip(base_recipe["upperMass"] * k, 0.1, 2))
        rec["lowerMass"] = float(np.clip(base_recipe["lowerMass"] * k, 0.1, 2))
        out.append(Variant(parse_recipe(rec), parse_target([float(a), float(b)])))
    return out


# ------------------------------------------------------------------ MJX backend

def mjx_rollout(variants: list[Variant], steps: int, chunk: int = 4096):
    """Run one compiled model per (upper, lower) length group; vary obstacle and masses per world.

    Per-world fields changed on the mjx.Model: geom_pos/geom_size of 'obstacle', body_mass and
    body_inertia of 'upper'/'lower' (inertia scaled with mass, which is exact for a fixed shape).
    Returns a dict of numpy arrays aligned with `variants`.
    """
    import jax
    import jax.numpy as jnp
    import mujoco
    from mujoco import mjx

    n = len(variants)
    final_q = np.zeros((n, 2)); peak_touch = np.zeros(n); peak_con = np.zeros(n, int)
    first_contact = np.full(n, np.nan); finite = np.ones(n, bool)
    groups: dict[tuple, list[int]] = {}
    for i, v in enumerate(variants):
        groups.setdefault(v.key(), []).append(i)
    for key, idx in groups.items():
        base = variants[idx[0]].recipe
        m = mujoco.MjModel.from_xml_string(compile_recipe(base))
        home = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_KEY, "home")
        g_obs = m.geom("obstacle").id
        b_up, b_lo = m.body("upper").id, m.body("lower").id
        touch_adr = m.sensor_adr[m.sensor("tip_touch").id]
        q_adr = [m.jnt_qposadr[m.joint(j).id] for j in ARM_PD["joints"]]
        v_adr = [m.jnt_dofadr[m.joint(j).id] for j in ARM_PD["joints"]]
        a_id = [m.actuator(f"{j}_motor").id for j in ARM_PD["joints"]]
        lo, hi = m.actuator_ctrlrange[a_id, 0], m.actuator_ctrlrange[a_id, 1]
        mx = mjx.put_model(m)
        d0 = mujoco.MjData(m)
        mujoco.mj_resetDataKeyframe(m, d0, home)
        mujoco.mj_forward(m, d0)
        dx0 = mjx.put_data(m, d0)
        base_mass = m.body_mass.copy()
        base_inertia = m.body_inertia.copy()

        def world_model(obs_pos, obs_r, mass_scale_up, mass_scale_lo):
            gp = mx.geom_pos.at[g_obs].set(obs_pos)
            gs = mx.geom_size.at[g_obs, 0].set(obs_r)
            bm = mx.body_mass.at[b_up].set(base_mass[b_up] * mass_scale_up).at[b_lo].set(base_mass[b_lo] * mass_scale_lo)
            bi = mx.body_inertia.at[b_up].set(base_inertia[b_up] * mass_scale_up).at[b_lo].set(base_inertia[b_lo] * mass_scale_lo)
            return mx.replace(geom_pos=gp, geom_size=gs, body_mass=bm, body_inertia=bi)

        def rollout(obs_pos, obs_r, su, sl, target):
            model = world_model(obs_pos, obs_r, su, sl)

            def ctrl(d):
                q = d.qpos[jnp.array(q_adr)]; qd = d.qvel[jnp.array(v_adr)]
                u = jnp.clip(ARM_PD["kp"] * (target - q) - ARM_PD["kd"] * qd, lo, hi)
                return d.replace(ctrl=d.ctrl.at[jnp.array(a_id)].set(u))

            def body(carry, t):
                d, pk_touch, pk_con, first = carry
                d = mjx.step(model, ctrl(d))
                d = mjx.forward(model, d)  # same order as the browser: controller, step, forward, sample
                touch = d.sensordata[touch_adr]
                ncon = jnp.sum(d._impl.contact.dist <= 0) if hasattr(d, "_impl") else jnp.sum(d.contact.dist <= 0)
                first = jnp.where(jnp.isnan(first) & (touch > 1e-6), t * model.opt.timestep, first)
                return (d, jnp.maximum(pk_touch, touch), jnp.maximum(pk_con, ncon), first), None

            init = (ctrl(dx0), 0.0, 0, jnp.nan)
            (d, pt, pc, fc), _ = jax.lax.scan(body, init, jnp.arange(1, steps + 1))
            return d.qpos[jnp.array(q_adr)], pt, pc, fc

        batched = jax.jit(jax.vmap(rollout))
        for s in range(0, len(idx), chunk):
            sel = idx[s:s + chunk]
            obs = jnp.array([variants[i].recipe["obstacle"]["position"] for i in sel])
            rad = jnp.array([variants[i].recipe["obstacle"]["radius"] for i in sel])
            su = jnp.array([variants[i].recipe["upperMass"] / base["upperMass"] for i in sel])
            sl = jnp.array([variants[i].recipe["lowerMass"] / base["lowerMass"] for i in sel])
            tg = jnp.array([variants[i].target for i in sel])
            q, pt, pc, fc = jax.device_get(batched(obs, rad, su, sl, tg))
            final_q[sel], peak_touch[sel], peak_con[sel], first_contact[sel] = q, pt, pc, fc
            finite[sel] = np.isfinite(q).all(axis=1)
    return {"finalQpos": final_q, "peakTouchN": peak_touch, "peakContacts": peak_con,
            "firstContact_s": first_contact, "finite": finite}


def warp_rollout(variants, steps):  # pragma: no cover - placeholder until the Warp API is checked on the G4
    """MuJoCo Warp backend (mujoco_warp). Conjecture: same structure as mjx_rollout with
    mjw.put_model / mjw.step over nworld; fill in after the doctor cell confirms the installed API."""
    raise NotImplementedError("BACKEND='warp' is not written yet; use 'mjx'")


# ------------------------------------------------------------------ CPU reference (doctor and replay check)

def cpu_reference(v: Variant, steps: int) -> dict:
    """The MCP simulate tool's exact trial (native MuJoCo, float64) for one variant."""
    from mujoco_bridge.sim import simulate
    t = simulate(compile_recipe(v.recipe), steps=steps, keyframe="home",
                 controller={"type": "arm-pd", "target": v.target}, record_every=steps)
    i_touch = [c["id"] for c in t["columns"]].index("sens:tip_touch[0]")
    return {"finalQpos": t["metrics"]["finalQpos"], "lastTouch": t["samples"][-1]["v"][i_touch],
            "peakContacts": t["metrics"]["peakContacts"]}


# ------------------------------------------------------------------ packages out

def edit_scene(scene: str, recipe: dict, target) -> str:
    """Rewrite the declared annotations of a contact-arm/1 scene (the browser's 'edit X3D source' path)."""
    root = parse_xml(scene, "X3D")
    defs = {e.get("DEF"): e for e in root.iter() if isinstance(e.tag, str) and e.get("DEF")}
    num = lambda x: repr(float(x))  # noqa: E731
    defs["UpperLength"].set("value", num(recipe["upperLength"]))
    defs["LowerLength"].set("value", num(recipe["lowerLength"]))
    defs["UpperMass"].set("value", num(recipe["upperMass"]))
    defs["LowerMass"].set("value", num(recipe["lowerMass"]))
    defs["JointTargets"].set("value", " ".join(num(t) for t in target))
    defs["ObstacleHandle"].set("translation", f"{num(recipe['obstacle']['position'][0])} {num(recipe['obstacle']['position'][1])} 0")
    defs["ObstacleGeometry"].set("radius", num(recipe["obstacle"]["radius"]))
    out = etree.tostring(root, encoding="unicode")
    out = '<?xml version="1.0" encoding="UTF-8"?>\n' + out
    back = read_contact_arm_scene(out)
    assert back["recipe"] == parse_recipe(recipe) and back["target"] == parse_target(target), "annotation round-trip"
    return out


def results_package(pkg: dict, variants: list[Variant], res: dict, meta: dict) -> bytes:
    """Input package's core members + records/gpu-batch.json (one row per world)."""
    rows = [{"recipe": v.recipe, "target": v.target, "finalQpos": res["finalQpos"][i].tolist(),
             "peakTouchN": float(res["peakTouchN"][i]), "peakContacts": int(res["peakContacts"][i]),
             "firstContact_s": None if np.isnan(res["firstContact_s"][i]) else float(res["firstContact_s"][i]),
             "finite": bool(res["finite"][i])} for i, v in enumerate(variants)]
    batch = {"schema": "x3d-mujoco/gpu-batch-v0", **meta, "worlds": len(rows), "rows": rows}
    return write_package(pkg["recipe"], pkg["target"], pkg["scene"], {"gpu-batch.json": batch},
                         readme_note="records/gpu-batch.json: batched MJX rollouts over a sweep of this recipe (see meta).")


def variant_package(pkg: dict, v: Variant, row: dict) -> bytes:
    scene = edit_scene(pkg["scene"], v.recipe, v.target)
    return write_package(v.recipe, v.target, scene, {"gpu-row.json": row},
                         readme_note="A variant from a GPU sweep. Import into the browser bridge and press Measure 5 s to replay it.")


def load_package(data: bytes) -> dict:
    return read_package(data)


def timed(fn, *a, **k):
    t = time.time()
    out = fn(*a, **k)
    return out, time.time() - t


def jsonable(x):
    return json.loads(json.dumps(x, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o)))
