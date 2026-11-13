// Curated against the versioned MuJoCo 3.17.0 modeling and XML reference:
// https://mujoco.readthedocs.io/en/3.17.0/modeling.html
// https://mujoco.readthedocs.io/en/3.17.0/XMLreference.html
export interface RefSection {
  title: string;
  blurb?: string;
  cols: string[];
  rows: string[][];
}

export const REF_SECTIONS: RefSection[] = [
  {
    title: "MJCF top-level elements",
    blurb: "Sections of a <mujoco> model file.",
    cols: ["Element", "Purpose"],
    rows: [
      ["<compiler>", "Global compile settings: angle='degree|radian', meshdir, assetdir and autolimits. Body poses use local coordinates."],
      ["<option>", "Physics options -> model.opt: timestep, gravity, integrator, solver, iterations, cone, wind, density, viscosity; contact overrides use o_* attributes plus an enable flag."],
      ["<size>", "Arena memory allocation (memory); older explicit limits may be deprecated or ignored depending on engine version."],
      ["<visual> / <statistic>", "Viewer cosmetics and model statistics (mean mass/extent used for scaling)."],
      ["<default>", "Default classes: set joint/geom/site attributes once, override per element. class='name' to select."],
      ["<asset>", "Textures, materials, meshes (STL/OBJ), height fields — referenced by name."],
      ["<worldbody>", "The scene: body 0 is the world. Lights, static geoms, and the kinematic tree live here."],
      ["<contact>", "<pair> explicit geom pairs and contact parameters; <exclude> names body pairs to exclude from automatic collision detection."],
      ["<equality> / <tendon>", "Equality constraints (connect, weld, joint, tendon…) and spatial/fixed tendons, which can have limits and actuators."],
      ["<actuator>", "Actuators: motor, position, velocity, general, muscle, damper, cylinder, adhesion…"],
      ["<sensor>", "Sensors writing into data.sensordata: jointpos, velocimeter, gyro, force, framepos, touch…"],
      ["<keyframe>", "Named state fields (qpos/qvel/act/ctrl/time and mocap poses) for mj_resetDataKeyframe; not every internal mjData field is stored."],
    ],
  },
  {
    title: "Bodies, joints, geoms, sites",
    cols: ["Element", "Key attributes"],
    rows: [
      ["<body>", "name, pos, quat, mocap, gravcomp; nesting defines the parent frame. Collision masks belong to geoms."],
      ["<joint> / <freejoint>", "type (free|ball|slide|hinge), axis (local frame!), pos (anchor), range+limited, damping, armature, frictionloss, springref/stiffness."],
      ["<geom>", "type, size, pos, quat, rgba, contype, conaffinity, condim, friction, solref, solimp, margin, gap, mass/density, group, contype…"],
      ["<site>", "name, type (sphere…), pos, quat, size, rgba — non-colliding markers and sensor/actuator reference frames; visible with the sites toggle."],
      ["<camera> / <light>", "pos, quat, fovy, mode (fixed|track|targetbody), diffuse/specular/ambient; lights: directional/point/spot, castshadow."],
    ],
  },
  {
    title: "Geom types and size semantics",
    cols: ["type", "size[0..2]", "Notes"],
    rows: [
      ["plane", "x-half, y-half, grid spacing", "Physically infinite for collision regardless of visual half-sizes; normal is local +Z. Rendered as a finite patch here."],
      ["sphere", "radius", "—"],
      ["capsule", "radius, half-length", "Axis is local +Z (cylinder part between ±half-length)."],
      ["cylinder", "radius, half-length", "Axis is local +Z."],
      ["ellipsoid", "3 radii", "Scaled unit sphere."],
      ["box", "3 half-sizes", "Full size = 2 x size."],
      ["mesh", "Defined by <mesh> asset", "Scale belongs to the mesh asset. Standard mesh collision uses a convex hull; this renderer implements a subset of native rendering."],
      ["hfield", "Asset size: x-half, y-half, elevation, base depth", "Dimensions and data belong to the <hfield> asset; not the geom size attribute."],
    ],
  },
  {
    title: "Joint types",
    cols: ["type", "qpos", "qvel", "Notes"],
    rows: [
      ["free", "7 (xyz + quat wxyz)", "6 (v + omega)", "Use <freejoint/>; cannot have range/limited."],
      ["ball", "4 (quat wxyz)", "3 (omega)", "Three rotational degrees of freedom; the limit bounds rotation angle, not a hinge axis."],
      ["slide", "1", "1", "Translation along axis (local frame)."],
      ["hinge", "1 (rad, unwrapped)", "1", "Rotation about axis through anchor pos; an unlimited hinge can make multiple turns."],
    ],
  },
  {
    title: "Actuators",
    cols: ["Shortcut", "Transmission", "Force law"],
    rows: [
      ["<motor>", "joint/tendon/site…", "actuator_force = ctrl before force clamping; for a scalar joint, joint torque/force = gear[0] * actuator_force."],
      ["<position>", "joint/tendon", "force = kp*(ctrl - length) - kv*velocity; gains via gainprm/biasprm."],
      ["<velocity>", "joint/tendon", "force = kv*(ctrl - velocity)."],
      ["<general>", "any", "Full control: gaintype/biastype/gainprm/biasprm, dyntype for filters/delays."],
      ["<muscle>", "tendon/site", "Hill-type muscle with activation dynamics."],
      ["<damper>", "joint", "Active damping: force = -kv * actuator_velocity * ctrl; nonnegative ctrlrange is required."],
      ["Common attrs", "—", "gear, ctrllimited/ctrlrange, forcelimited/forcerange, group; aggregate actuatorfrcrange is a joint attribute."],
    ],
  },
  {
    title: "Sensors (selection)",
    cols: ["Sensor", "dim", "Measures"],
    rows: [
      ["jointpos / jointvel", "1", "qpos / qvel of a joint (adr via jnt_qposadr)."],
      ["ballquat / ballangvel", "4 / 3", "Orientation quaternion and angular velocity of a ball joint; free-body pose can use framepos/framequat."],
      ["framepos / framequat / framelinvel / frameangvel", "3 / 4", "Pose/velocity of any object (body/geom/site/camera) in a frame."],
      ["velocimeter / gyro / accelerometer", "3", "Site linear velocity, angular velocity, linear acceleration."],
      ["force / torque", "3", "Interaction force/torque between the site's body and its parent, expressed in the site frame."],
      ["touch", "1", "Sum of normal contact forces at a site."],
      ["actuatorpos / actuatorvel / actuatorfrc", "1", "Actuator length / velocity / force."],
      ["All sensors", "—", "For ordinary sensors cutoff clips magnitude; noise stores metadata, not injected noise. Object/site/joint references depend on sensor type."],
    ],
  },
  {
    title: "option attributes (model.opt) — live-editable here",
    cols: ["Attribute", "Meaning"],
    rows: [
      ["timestep", "Integration step (s). The single most important stability knob."],
      ["gravity / wind / magnetic", "Gravity acceleration, wind velocity for fluid forces, and magnetic field for magnetometer sensors."],
      ["integrator", "Euler (default) | RK4 | implicit | implicitfast | discrete."],
      ["solver", "PGS | CG | Newton — constraint solver. Newton is default in 3.x."],
      ["iterations / tolerance / ls_iterations / ls_tolerance", "Solver iteration cap, convergence tolerance, line-search caps."],
      ["cone", "pyramidal | elliptic — friction cone approximation."],
      ["jacobian", "dense | sparse | auto — constraint Jacobian format."],
      ["impratio", "Ratio of friction-to-normal impedance (>=1 for grippy friction)."],
      ["o_margin / o_solref / o_solimp", "Global contact replacements applied only with <option><flag override='enable'/></option>."],
      ["noslip_iterations / noslip_tolerance", "Extra passes that reduce contact slip."],
      ["density / viscosity", "Fluid density/viscosity used by the fluid-force model; these do not automatically model buoyancy."],
      ["ccd_iterations / ccd_tolerance", "Iteration cap and tolerance for convex collision detection (CCD); not swept, continuous-time collision detection."],
      ["enableflags / disableflags", "Separate enable and disable masks; use mjtEnableBit and mjtDisableBit, respectively."],
    ],
  },
  {
    title: "mjData fields you will use constantly",
    cols: ["Field", "Meaning"],
    rows: [
      ["time", "Simulated seconds so far."],
      ["qpos / qvel / qacc", "Generalized position / velocity / acceleration (nq / nv)."],
      ["ctrl", "Actuator commands (nu). Write this to control the robot."],
      ["qfrc_applied / xfrc_applied", "External generalized / Cartesian forces you inject."],
      ["xpos / xquat / xmat", "World pose of each body (nbody)."],
      ["geom_xpos / geom_xmat", "World pose of each geom — what this page renders."],
      ["xanchor / xaxis", "World anchor and axis of each joint — drawn as green lines here."],
      ["actuator_force / actuator_length / actuator_velocity", "Per-actuator outputs."],
      ["sensordata", "Flat sensor array (nsensordata); sensor_adr/sensor_dim locate entries."],
      ["ncon / contact", "Detected contacts and their pos/frame/friction/dist; inactive gap contacts may be included."],
      ["nefc / efc_*", "Constraint rows (contacts, limits, equality…) the solver works on."],
      ["solver_niter / solver.*", "Per-island iteration counts and solver convergence statistics; timers are separate."],
      ["energy", "Kinetic + potential energy (when energy flag enabled)."],
      ["warning", "Per-type warning counters (instability, constraint overflow…)."],
    ],
  },
  {
    title: "API naming conventions & the loop",
    cols: ["Prefix / fn", "Meaning"],
    rows: [
      ["mj_*", "Core: mj_step, mj_forward, mj_resetData, mj_resetDataKeyframe, mj_name2id, mj_id2name, mj_loadXML…"],
      ["mju_*", "Utilities: mju_mulMatVec, mju_quat2Mat, mju_error… (no model/data args)."],
      ["mjv_*", "Abstract visualization: mjv_updateScene fills an mjvScene (native viewer path)."],
      ["mjr_*", "OpenGL rendering of an mjvScene (mjr_render) — needs a GL context; this page uses three.js instead."],
      ["WASM module", "loadMujoco({wasmBinary}) -> module; MjModel.from_xml_string(xml) compiles; new MjData(model); typed-array views: data.qpos etc."],
      ["The loop", "reset -> while running: set ctrl -> mj_step (x substeps) -> read state -> render at 60 fps."],
    ],
  },
];
