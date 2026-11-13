// Curated for MuJoCo 3.17.0. Primary references:
// https://mujoco.readthedocs.io/en/3.17.0/modeling.html
// https://mujoco.readthedocs.io/en/3.17.0/XMLreference.html
// https://mujoco.readthedocs.io/en/3.17.0/computation/index.html
// https://mujoco.readthedocs.io/en/3.17.0/changelog.html
export type Block =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "code"; lang: string; code: string }
  | { t: "callout"; kind: "tip" | "warn" | "note"; text: string };

export interface Lesson {
  id: string;
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  minutes: number;
  summary: string;
  blocks: Block[];
  tryPreset?: string;
  tryXml?: string;
  tryLabel?: string;
}

export const LESSONS: Lesson[] = [
  {
    id: "what-is-mujoco",
    title: "What is MuJoCo, and what is running here?",
    level: "Beginner",
    minutes: 5,
    summary: "The engine, mjModel/mjData, and the mj_step loop — the 30-second mental model.",
    blocks: [
      { t: "p", text: "**MuJoCo** (Multi-Joint Dynamics with Contact) is a physics engine by Emo Todorov, now maintained by Google DeepMind. It simulates articulated rigid bodies with fast, accurate **contacts** — the reason it dominates robotics and reinforcement-learning research." },
      { t: "p", text: "This page runs the **official MuJoCo WebAssembly bindings** (`@mujoco/mujoco`, DeepMind's own build) in your browser. No server, no Python — the same C++ engine compiled to WASM, stepped from JavaScript. Check the badge in the top bar for the exact engine version." },
      { t: "p", text: "Three objects matter: `mjModel` (the **compiled model**), `mjData` (the **mutable** simulation state), and the loop `mj_step(model, data)` which advances time by `model.opt.timestep`." },
      { t: "code", lang: "js", code: `const mujoco = await loadMujoco();                 // WASM module
const model = mujoco.MjModel.from_xml_string(xml);  // compile MJCF -> mjModel
const data  = new mujoco.MjData(model);             // allocate mjData
mujoco.mj_resetData(model, data);                   // qpos = qpos0
while (data.time < 5) {
  if (model.nu > 0) data.ctrl[0] = 1.0;             // only if an actuator exists
  mujoco.mj_step(model, data);                      // advance one timestep
  console.log(data.qpos, data.xpos);                // generalized + Cartesian state
}` },
      { t: "ul", items: [
        "`qpos` / `qvel` — generalized positions/velocities (the state of all joints).",
        "`xpos` / `xquat` / `xmat` — world pose of every body.",
        "`ctrl` — actuator commands; `sensordata` — sensor readings; `ncon` + `contact` — detected contacts (which may include inactive contacts).",
      ] },
      { t: "callout", kind: "tip", text: "In this playground the render loop already does advance(dt) -> mj_step xN -> read geom_xpos/geom_xmat. Every time you press Apply, the XML is compiled with MjModel.from_xml_string — exactly like mujoco.MjModel.from_xml_string in Python." },
    ],
    tryPreset: "ball-drop",
    tryLabel: "Try: load the bouncy ball drop",
  },
  {
    id: "mjcf-anatomy",
    title: "MJCF anatomy: the XML tree IS the robot",
    level: "Beginner",
    minutes: 8,
    summary: "<mujoco> -> <worldbody> -> nested <body> elements form the kinematic tree.",
    blocks: [
      { t: "p", text: "Models are written in **MJCF** — XML whose root is `<mujoco>`. The compiler turns it into the flat, cross-indexed `mjModel` you can inspect in the Model tab." },
      { t: "p", text: "The core trick: **nesting `<body>` elements inside each other builds the kinematic tree**. A child body's `pos`/`quat` are relative to its parent. Joints connect a body to its parent." },
      { t: "code", lang: "xml", code: `<mujoco model="my_robot">
  <compiler angle="radian"/>
  <worldbody>
    <geom name="floor" type="plane" size="5 5 0.1"/>
    <body name="torso" pos="0 0 1">          <!-- child of the world -->
      <freejoint name="root"/>                 <!-- 7 qpos (pos+quat), 6 qvel -->
      <geom type="capsule" fromto="0 0 -0.3 0 0 0.3" size="0.1"/>
      <body name="arm" pos="0.2 0 0.2">       <!-- child of torso: local frame! -->
        <joint name="shoulder" type="hinge" axis="0 1 0"/>
        <geom type="capsule" fromto="0 0 0 0 0 -0.3" size="0.03"/>
      </body>
    </body>
  </worldbody>
</mujoco>` },
      { t: "ul", items: [
        "`<compiler angle='radian'/>` — angles in radians (the default is degrees!). Set it once, forget the pain.",
        "`<option>`, `<default>`, `<asset>`, `<actuator>`, `<sensor>`, `<keyframe>` are the other top-level sections.",
        "`<default>` classes let you set joint/geom attributes once and override per element — like CSS for your robot.",
        "Body 0 is always the **world** body; static geoms (e.g. the floor plane) usually live directly in `<worldbody>`.",
      ] },
      { t: "callout", kind: "warn", text: "A body without any joint is **welded to its parent**. To make it move, give it a joint (or <freejoint/>)." },
    ],
    tryPreset: "humanoid",
    tryLabel: "Try: load the capsule humanoid and read the body tree in the Model tab",
  },
  {
    id: "joints-qpos",
    title: "Joints, qpos and qvel",
    level: "Beginner",
    minutes: 8,
    summary: "free / ball / slide / hinge; how joint state maps into the flat qpos/qvel arrays.",
    blocks: [
      { t: "p", text: "MuJoCo has exactly **four joint types**: `free` (3 translations + quaternion: 7 qpos / 6 qvel), `ball` (4/3), `slide` (1/1), `hinge` (1/1). Every joint's state lives in the flat arrays `data.qpos` / `data.qvel`; `model.jnt_qposadr[j]` and `model.jnt_dofadr[j]` tell you where joint `j` sits." },
      { t: "code", lang: "xml", code: `<joint name="slider" type="slide" axis="1 0 0" range="-2 2" limited="true"
       damping="0.1" armature="0.3" frictionloss="0.01"/>
<joint name="hinge" type="hinge" axis="0 1 0" range="-3.14 3.14"/>
<joint name="free" type="free"/>   <!-- or simply <freejoint/> -->` },
      { t: "ul", items: [
        "`axis` is expressed in the **child body's local frame** — the #1 source of 'why is my robot rotating the wrong way' bugs.",
        "`range` + `limited='true'` enforce joint limits via constraints. `damping` and `frictionloss` affect passive forces; `armature` adds inertia to the joint degrees of freedom.",
        "An unlimited hinge can rotate continuously; its scalar qpos angle is not automatically wrapped to ±pi. A slide joint represents translation. For an angular tracking error, choose explicitly whether to use a wrapped error or a multi-turn target.",
        "The **State** tab of the inspector shows live qpos/qvel per joint — scrub the actuator sliders and watch them move.",
      ] },
      { t: "callout", kind: "tip", text: "Use the reset dropdown under the viewport to pick a keyframe — that calls mj_resetDataKeyframe, the standard way to start episodes from a stored pose." },
    ],
    tryPreset: "double-pendulum",
    tryLabel: "Try: the double pendulum — two hinges, qpos = [shoulder, elbow]",
  },
  {
    id: "geoms-collision",
    title: "Geoms: shape, color, and who collides with whom",
    level: "Beginner",
    minutes: 8,
    summary: "Geom types, size semantics, contype/conaffinity bitmasks, condim, friction, margin/gap.",
    blocks: [
      { t: "p", text: "A **geom** is a shape attached to a body — it defines visual and collision geometry and contact parameters. The compiler can infer the body's mass and inertia from its geoms, unless explicit inertial data or compiler settings specify otherwise." },
      { t: "code", lang: "xml", code: `<geom name="wheel" type="cylinder" size="0.1 0.05" pos="0 0.12 0"
      rgba="0.2 0.2 0.25 1" contype="1" conaffinity="1" condim="3"
      friction="1.2 0.05 0.01" solref="0.02 1" solimp="0.9 0.95 0.001" margin="0" gap="0"/>` },
      { t: "ul", items: [
        "Types: `plane`, `sphere` (size = radius), `capsule`/`cylinder` (size = radius + half-length, axis = local Z), `ellipsoid` (3 radii), `box` (3 half-sizes), `mesh`, `hfield`.",
        "`contype` and `conaffinity` are **bitmasks**. Automatically generated contact candidates must pass `(contype1 & conaffinity2) || (contype2 & conaffinity1)`, alongside other collision filters. Set both to 0 to omit a visual geom from automatic collision pairs; explicit `<pair>` definitions need separate consideration.",
        "Automatic collision filtering normally removes parent–child pairs, with an exception for the world body. Use `<contact><exclude>` to exclude body pairs, and explicit `<pair>` elements when a particular geom pair needs a defined contact.",
        "`condim`: 1 = frictionless, 3 = sliding friction, 4 = + torsional, 6 = + rolling. `friction` = [sliding, torsional, rolling].",
        "Positive `solref` uses (timeconst, dampratio); nonpositive values use the direct stiffness/damping format. `solimp` has five parameters (d0, dwidth, width, midpoint, power). In MuJoCo 3.17, contacts are detected within `margin + gap`; force generation starts within `margin`.",
      ] },
      { t: "callout", kind: "note", text: "Toggle the red dots in the viewport toolbar to see live `data.contact` positions. Recorded contacts can be inactive or carry zero force; a dot is not a force measurement." },
    ],
    tryPreset: "ball-drop",
    tryLabel: "Try: ball drop — watch contacts (red dots) and the floor's solref bounce",
  },
  {
    id: "actuators-ctrl",
    title: "Actuators and ctrl",
    level: "Intermediate",
    minutes: 10,
    summary: "motor / position / velocity / general; gear, ctrlrange, forcerange; writing data.ctrl.",
    blocks: [
      { t: "p", text: "Actuators turn `data.ctrl[i]` into generalized force. The shortcuts cover 99% of use cases: **`motor`** (scalar actuator force = ctrl, before force clamping; the transmission maps it to joint force/torque), **`position`** (servo: force = kp x (ctrl - length) - kv x velocity), **`velocity`** (force = kv x (ctrl - velocity)), plus `general`, `muscle`, `damper`, `cylinder`…" },
      { t: "code", lang: "xml", code: `<actuator>
  <motor    name="hip_motor"  joint="hip"  gear="40" ctrllimited="true" ctrlrange="-100 100" forcerange="-100 100"/>
  <position name="knee_servo" joint="knee" kp="80" kv="5" ctrlrange="-1.5 0"/>
  <velocity name="wheel"      joint="axle" kv="2" ctrlrange="-10 10"/>
</actuator>` },
      { t: "ul", items: [
        "For a scalar hinge or slide transmission, `gear[0]` scales both actuator length and transmitted joint force/torque. Ball and free-joint transmissions use multiple gear components. Distinguish `actuator_force` from the resulting generalized force in `qfrc_actuator`.",
        "`ctrllimited`/`ctrlrange` clamp the input (the UI sliders respect this); `forcelimited`/`forcerange` clamp the output force.",
        "`position`/`velocity` are `general` actuators with preset gain/bias — read `model.actuator_gainprm`/`biasprm` to see the math.",
        "In the playground, the **Actuators** tab writes `data.ctrl` live — drive the cartpole by hand and watch qpos in the State tab.",
        "Actuator force for actuator i is readable in `data.actuator_force[i]` (plotted in Telemetry).",
      ] },
      { t: "callout", kind: "tip", text: "ctrl defaults to 0. For a simple unit-gear hinge position actuator, ctrl=0 requests actuator length zero. This supplies a joint target; it does not guarantee whole-body balance or standing." },
    ],
    tryPreset: "cartpole",
    tryLabel: "Try: cartpole — drag the slide_motor slider in the Actuators tab",
  },
  {
    id: "sensors",
    title: "Sensors and sensordata",
    level: "Intermediate",
    minutes: 7,
    summary: "framepos, velocimeter, gyro, force, touch, jointpos… all land in one flat data.sensordata.",
    blocks: [
      { t: "p", text: "Sensors are **read-only** views into mjData, packed into the flat array `data.sensordata`. `model.sensor_adr[s]` is the offset and `model.sensor_dim[s]` the length of sensor `s` — the same layout RL environments expose as observations." },
      { t: "code", lang: "xml", code: `<sensor>
  <framepos     name="ball_pos"  objtype="body" objname="ball"/>
  <velocimeter   name="ball_vel"  site="ball_site"/>
  <gyro         name="imu_gyro"  site="imu_site"/>
  <force        name="foot_f"    site="foot_site"/>
  <touch        name="foot_touch" site="foot_site"/>
  <jointpos     name="hinge_q"   joint="hinge"/>
  <jointvel     name="hinge_dq"  joint="hinge"/>
  <accelerometer name="imu_acc"  site="imu_site"/>
</sensor>` },
      { t: "ul", items: [
        "`site` elements are tiny markers (toggle the amber dots in the viewport) that give sensors a frame.",
        "`framepos`/`framequat` can track bodies, geoms, sites, cameras… via objtype/objname.",
        "For ordinary sensors, positive `cutoff` clips the output magnitude; it is not a low-pass filter. `noise` stores a standard-deviation setting but does not itself add noise to simulated readings. Implement filtering and seeded observation noise explicitly; collision sensors have specialized cutoff semantics.",
        "Telemetry plots a selected subset of sensor components. A policy observation is a deliberate choice of signals, units, filtering and normalization; it is not automatically identical to this display.",
      ] },
    ],
    tryPreset: "ball-drop",
    tryLabel: "Try: ball drop sensors (framepos / velocimeter / gyro / force) in Telemetry",
  },
  {
    id: "options-solver",
    title: "Options, timestep, and the constraint solver",
    level: "Intermediate",
    minutes: 12,
    summary: "model.opt is live-editable: timestep, gravity, integrator, solver, iterations, cone, solref/solimp.",
    blocks: [
      { t: "p", text: "`<option>` (which becomes `model.opt`) controls the numerics. In this playground the **Options** tab edits `model.opt` **live** — no recompile needed, because mjModel fields are just memory." },
      { t: "code", lang: "xml", code: `<option timestep="0.002" gravity="0 0 -9.81"
        integrator="implicitfast" cone="elliptic" solver="Newton"
        iterations="100" tolerance="1e-8" ls_iterations="50"
        noslip_iterations="0" impratio="1"
        o_solref="0.02 1" o_solimp="0.9 0.95 0.001 0.5 2"
        wind="0 0 0" density="1.2" viscosity="0"/>` },
      { t: "ul", items: [
        "`timestep` — the heartbeat. Smaller = stabler contacts, slower. 0.001–0.005 is typical for contact-rich robots.",
        "`integrator`: Euler (semi-implicit), RK4 (fourth-order Runge–Kutta with repeated dynamics evaluations), and implicit / implicitfast (implicit treatment of velocity-dependent forces). Choose and compare them on the actual model; RK4 does not simply ignore constraints between stages.",
        "`solver`: Newton, CG (conjugate gradient), or PGS (projected Gauss–Seidel). Cost and convergence depend on the model and contacts. `iterations` and `tolerance` bound the solve; `ls_iterations` bounds the line search.",
        "`cone`: pyramidal (friction as many linear constraints — fast, approximate) vs elliptic (true friction cone — smoother). `impratio` scales friction vs normal stiffness.",
        "`o_solref` / `o_solimp` replace contact parameters only when `<flag override='enable'/>` is enabled inside `<option>`. They are an experimental global contact override, not inherited geom defaults.",
        "`gravity`, `wind`, `density`, `viscosity` model environmental effects. Try gravity `0 0 0` or a low-gravity setting in Options. Lunar surface gravity is approximately `0 0 -1.62` m/s².",
      ] },
      { t: "callout", kind: "warn", text: "If your sim explodes (NaNs, bodies flying off), the usual culprits are: timestep too large, huge gear on a stiff position servo, or too-soft solref on contacts. The status bar surfaces `data.warning` counts." },
    ],
    tryXml: `<mujoco model="solver_lab">
  <compiler angle="radian"/>
  <!-- TODO: raise iterations, switch solver to Newton, try the elliptic cone -->
  <option timestep="0.002" solver="PGS" iterations="20" cone="pyramidal" gravity="0 0 -9.81"/>
  <worldbody>
    <geom name="floor" type="plane" size="4 4 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="box" pos="0 0 1.5">
      <freejoint name="root"/>
      <geom name="box" type="box" size="0.2 0.2 0.2" mass="1" rgba="0.9 0.5 0.3 1"/>
    </body>
  </worldbody>
</mujoco>
`,
    tryLabel: "Try: solver lab — edit <option> live in the Options tab while the box falls",
  },
  {
    id: "contacts-tuning",
    title: "Contacts: bounces, friction, and stability",
    level: "Intermediate",
    minutes: 10,
    summary: "How MuJoCo pushes geoms apart: solref/solimp, pyramidal vs elliptic cones, noslip, condim.",
    blocks: [
      { t: "p", text: "Contacts are **soft constraints**: MuJoCo detects penetrating geom pairs (`data.contact`, drawn as red dots here), then the solver computes forces that resolve them. You shape that force with `solref` and `solimp`." },
      { t: "ul", items: [
        "For positive `solref='timeconst dampratio'`, smaller timeconst means a stiffer reference response. A damping ratio of 1 specifies critical damping in that reference response; actual rebound also depends on impedance, timestep, geometry and how the two geoms' parameters combine. Measure it instead of assuming a restitution coefficient.",
        "`solimp='d0 dwidth width midpoint power'` shapes position-dependent impedance. The last two parameters shape the interpolation; omitted components use defaults.",
        "Friction uses a cone (elliptic) or pyramid (pyramidal) of tangential forces scaled by mu x normal force. `impratio` > 1 makes friction relatively stiffer.",
        "`noslip_iterations` runs extra passes that specifically kill contact slip — useful for walking robots, costs time.",
        "In MuJoCo 3.17, `margin` sets geometric inflation for force generation, while `gap` adds a detection buffer. Contacts with distance < margin + gap are recorded; those inside margin can generate constraint forces. A contact dot alone does not prove a nonzero force.",
      ] },
      { t: "code", lang: "xml", code: `<geom name="bouncy" type="sphere" size="0.1" solref="0.005 0.7" friction="0.5"/>
<geom name="sticky" type="plane" solref="0.02 1" friction="2.0 0.1 0.05" condim="6"/>` },
      { t: "callout", kind: "tip", text: "Experiment: vary the ball/floor contact parameters one at a time and measure rebound height. For the spider, compare forward displacement, torso height and orientation while varying friction; extra friction alone does not guarantee walking." },
    ],
    tryPreset: "spider",
    tryLabel: "Try: the spider — tune floor friction in the editor and watch the gait change",
  },
  {
    id: "keyframes-reset",
    title: "Keyframes, reset, and reproducible episodes",
    level: "Intermediate",
    minutes: 6,
    summary: "<keyframe> stores named state fields; mj_resetDataKeyframe gives repeatable starting poses.",
    blocks: [
      { t: "p", text: "A **keyframe** stores named state fields (qpos, qvel, act, ctrl, time, mocap poses…), often to define an initial pose. It does not snapshot every internal mjData field. RL loops can reset with `mj_resetDataKeyframe(model, data, k)` instead of a plain reset so every episode starts identically (plus noise you add yourself)." },
      { t: "code", lang: "xml", code: `<keyframe>
  <!-- Pendulum preset: nq=1, nv=1, nu=1. Sizes follow the compiled model. -->
  <key name="down" qpos="0" qvel="0" ctrl="0"/>
  <key name="side" qpos="1.2" qvel="0" ctrl="0" time="0"/>
</keyframe>` },
      { t: "ul", items: [
        "In this playground: the reset dropdown next to the play button lists keyframes; choosing one calls `mj_resetDataKeyframe`.",
        "qpos0 (plain reset) comes from body pos / joint defaults — the compiler bakes it into `model.qpos0`.",
        "For stochastic starts: reset to a keyframe, then perturb selected positions and velocities with a recorded seed. Do not add arbitrary component-wise noise to quaternion coordinates; apply a valid rotation perturbation and normalize quaternions before recomputing derived state.",
      ] },
    ],
    tryPreset: "pendulum",
    tryLabel: "Try: pendulum keyframes 'down' and 'side' from the reset dropdown",
  },
  {
    id: "beyond-playground",
    title: "Beyond the playground: real MuJoCo workflows",
    level: "Advanced",
    minutes: 10,
    summary: "Python bindings, Menagerie models, the simulate app, Gymnasium-Robotics, and what to learn next.",
    blocks: [
      { t: "p", text: "The MJCF models and core simulation concepts transfer to desktop MuJoCo; JavaScript binding details and this custom renderer are not identical to the Python API or native viewer. In Python: `pip install mujoco`, then `mujoco.MjModel.from_xml_string(xml, assets)`, `mujoco.MjData(model)`, `mujoco.mj_step(model, data)` — and `python -m mujoco.viewer` for the native GUI (or `mujoco.viewer.launch_passive` for a live handle)." },
      { t: "ul", items: [
        "**MuJoCo Menagerie** (github.com/google-deepmind/mujoco_menagerie) — production-grade MJCF for Unitree Go2, Franka Panda, Shadow Hand, humanoids… each with scene.xml + meshes.",
        "**Gymnasium / Gymnasium-Robotics** — environment libraries with MuJoCo tasks. Ant and HalfCheetah belong to Gymnasium; Gymnasium-Robotics includes manipulation tasks such as Fetch and Adroit. Each environment defines its own observations and reward, often using selected or transformed engine state.",
        "**MJX** — MuJoCo on GPU via JAX (thousands of parallel envs for RL). The WASM you just used is the same engine, single-threaded.",
        "**mjSpec / model editing API** — build models programmatically instead of XML strings.",
        "Rendering: `mjvScene` + `mjr_*` (what the native viewer uses), or feed `geom_xpos`/`geom_xmat` into three.js like this page does.",
        "Next skills: system identification (mass/inertia), `dyntype`/`gainprm` actuators, tendons & equality constraints, mocap, contact-rich manipulation.",
      ] },
      { t: "code", lang: "python", code: `import mujoco
import mujoco.viewer

model = mujoco.MjModel.from_xml_path("scene.xml")
data = mujoco.MjData(model)
with mujoco.viewer.launch_passive(model, data) as v:
    while v.is_running():
        mujoco.mj_step(model, data)
        v.sync()` },
      { t: "callout", kind: "note", text: "Docs: mujoco.readthedocs.io — the 'Modeling' chapter (MJCF reference) and 'Programming' chapter (mjModel/mjData field reference) are the two pages you will live in." },
    ],
  },
];
