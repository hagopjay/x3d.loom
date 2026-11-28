# URDF → X3D, held to MuJoCo's forward kinematics; ROS 2 recordings replayed (v0.2, 28 Nov 2026)

Gap 3 of the bridge gap map (URDF and ROS 2). `urdf2x3d.py` turns a URDF robot into one X3D 4.0 file: the kinematic
tree as nested Transforms, each joint's type, axis and limits as typed Metadata, and the collision STL meshes as
IndexedTriangleSet. `fk_check.py` then poses the X3D file, reading only the X3D, and compares every link frame with
MuJoCo's own compile of the same URDF. Planted controls must fail.

```
URDF ─ urdf2x3d.py ─▶ robot.x3d ─ pose from its own Metadata, multiply Transforms ─▶ link frames
  └──── MuJoCo 4.0.1 compiles the URDF, mj_kinematics ───────────────────────────▶ link frames   compare
```

## How a joint maps

```xml
<Transform DEF="J__origin" translation="xyz" rotation="rpy as axis-angle">   <!-- the fixed origin -->
  <Transform DEF="J" rotation="axis q">                                     <!-- the motion; prismatic: translation axis*q -->
    <MetadataSet containerField="metadata" name="urdf:joint" reference="URDF">
      type, parent, child, axis, lower, upper, effort, velocity, position  (mimic, multiplier, offset)
    </MetadataSet>
    <Transform DEF="C"> link C's meshes, then C's child joints </Transform>
```

Everything sits under `Transform DEF="URDF_ZUP_TO_YUP"` (rotation `1 0 0 -π/2`), because URDF is z up and X3D is y
up. An agent or a ROUTE poses the robot by writing `rotation` on the Transform named after the joint. URDF `rpy`
is fixed-axis roll, pitch, yaw (R = Rz(y)·Ry(p)·Rx(r)); it is written as one axis-angle.

**Mimic joints** (Panda's second finger) ride as Metadata: `mimic` (the leader), `multiplier`, `offset`. X3D has no
ROUTE that scales a value, so whoever poses the scene applies `q = multiplier·q(leader) + offset`; `fk_check.py` does.
**Refused, not guessed:** planar and floating joints, meshes other than STL, more than one root link.

## Result (MuJoCo 4.0.1, numpy 2.5.5; 100 poses, seed 7; tolerance 1e-9 m and 1e-9 rad)

| robot | links compared | joints | triangles | worst position | worst rotation | pass | controls caught |
|---|---|---|---|---|---|---|---|
| UR5 (`ur5_robot.urdf`) | 11 / 11 | 10 | 5,328 | 4.7e-16 m | 2.1e-13 rad | yes | 3 / 3 |
| Franka Panda (`panda.urdf`, one mimic joint) | 13 / 13 | 12 | 2,300 | 5.6e-16 m | 9.9e-16 rad | yes | 3 / 3 |

Poses are uniform inside each joint's limits (continuous joints in ±π); pose 0 is all zeros. Rotation is the angle
of the relative rotation by atan2 (acos turns 1e-16 of rounding into 1e-8 rad, which first read as a fault).

**Controls**, each a single edit to the X3D file, run on 20 poses:

| control | UR5 worst position | Panda worst position |
|---|---|---|
| one joint axis reversed in its Metadata | 1.59 m | 1.26 m |
| one origin rotation axis permuted (y↔z, a classic rpy slip) | caught on rotation | 0.079 m |
| one fixed joint's offset dropped | 0.082 m | 0.107 m |

The permuted-axis control skips origins whose axis has y = z (for example `1 0 0`), where the swap would change
nothing; the first Panda run picked one of those and "missed", which was the control's fault, not the scene's.

**Validator:** both scenes are XSD-valid with 0 errors and 0 semantic errors (x3d_mcp 0d60c12, lxml 6.1.3, libxml2
2.14.6, `results/receipt-validate.json`). The 3 and 7 warnings are all `empty-group`: links with no mesh (tool and
flange frames such as `ee_link`, `panda_hand_tcp`). They are kept on purpose, because an agent targets them by name.

## Run

```bash
python3 urdf2x3d.py ROBOT.urdf scenes/NAME.x3d --mesh-root ROOT [--pose joint=value ...] [--meshes collision|visual|none]
python3 fk_check.py ROBOT.urdf scenes/NAME.x3d --out results/NAME-fk-receipt.json   # needs mujoco, numpy
```

`urdf2x3d.py` is standard library only. `package://pkg/path` resolves against `--mesh-root`, with and without the
package name.

## ROS 2 recordings drive the joints (28 Nov 2026)

`ros2_replay.py` reads a ROS 2 MCAP recording with x3d_mcp's standard-library reader (ROS 2 CDR, hagopjay/x3d_mcp#43)
and adds to a bridge scene one `TimeSensor DEF="REPLAY"` plus, per moving joint, an `OrientationInterpolator`
(prismatic: `PositionInterpolator`) keyed at the message stamps, ROUTEd to the joint Transform. No script, no
runtime: any X3D 4.0 browser plays the recording.

```
/joint_states (MCAP, CDR, zstd) ─ x3d_mcp mcap_reader ─ ros2_replay.py ─▶ TimeSensor ─▶ Interpolators ─ROUTE─▶ joint Transforms
```

**The SLERP trap.** `OrientationInterpolator` takes the shortest arc between neighbouring keys (X3D 4.0, 19.4.7).
For one fixed axis that equals the joint moving linearly only while the step between keys is under π. A wrist that
turns more than π between two messages plays **backwards**. `ros2_replay.py` splits every step of π/2 or more into
equal sub-steps with extra keys; `--no-split` turns that off, and is the control.

**Recordings** (`recordings/`, written by `make_recordings.py` with mcap-ros2-support 0.6.0, zstd chunks, its
default; synthetic, not from a robot): `ur5-sweep.mcap` 30 Hz for 12 s (smooth sweeps, wrist 3 turns 4π one way) and
`ur5-jerk-2hz.mcap` 2 Hz for 6 s (wrist 3 jumps 4 rad each message, more than π).

| witness | recording | samples (messages + midpoints) | worst position | worst rotation | pass |
|---|---|---|---|---|---|
| `replay_check.py`: X3D interpolators as the spec defines them, MuJoCo 4.0.1 from the recording | sweep | 721 | 4.1e-12 m | 1.2e-11 rad | yes (1e-9) |
| same | jerk | 25 | 3.2e-16 m | 1.6e-11 rad | yes (1e-9) |
| `browser/xite_replay.py`: **X_ITE 16.7.1's own interpolators and ROUTEs**, Playwright Chromium headless, SwiftShader | sweep | 721 | 2.7e-7 m | 9.0e-7 rad | yes (1e-5) |
| same | jerk | 25 | 1.5e-15 m | 9.5e-7 rad | yes (1e-5) |

The 1e-11 in the Python witness is the 12 significant digits the keys are written with. The 1e-6 rad in X_ITE is
the format, not the browser: SFRotation and MFRotation are single precision in X3D 4.0, and X_ITE keeps them in
Float32Arrays (float32 at 2 rad is 2.4e-7). That is why the browser leg is judged at 1e-5.

**Controls** (each must fail):

| control | Python witness | X_ITE 16.7.1 |
|---|---|---|
| keys not split (`--no-split`), jerk recording | midpoints off by **3.14159 rad**: the wrist plays backwards | midpoints off by **3.14159 rad**: X_ITE plays it backwards too |
| keys not split, sweep recording | not applicable: no step reaches π at 30 Hz, so the split adds 0 keys | |
| one ROUTE sent to the wrong joint | 0.66 m (sweep), 1.0 rad (jerk) | |
| keys shifted by one message | 0.031 m (sweep), 1.33 rad (jerk) | |

Animated scenes `scenes/ur5-sweep.x3d` and `scenes/ur5-jerk-2hz.x3d` are XSD-valid with 0 errors and 0 semantic
errors (x3d_mcp 64a91d1). Recordings are zstd like real ROS 2 bags, so reading them on Python before 3.14 needs the
`zstandard` (or `backports.zstd`) module; without it the reader refuses rather than skipping silently.

```bash
python3 make_recordings.py recordings                                  # needs mcap, mcap-ros2-support
python3 ros2_replay.py recordings/ur5-sweep.mcap scenes/ur5_robot.x3d scenes/ur5-sweep.x3d
python3 replay_check.py ur5_robot.urdf recordings/ur5-sweep.mcap scenes/ur5-sweep.x3d --base scenes/ur5_robot.x3d --out results/ur5-sweep-replay-receipt.json
python3 browser/xite_replay.py ur5_robot.urdf recordings/ur5-sweep.mcap scenes/ur5-sweep.x3d --xite DIR_WITH_x_ite --out results/ur5-sweep-xite-receipt.json
```

## Other URDF loaders, held to the same MuJoCo (28 Nov 2026)

The same 100 seed-7 poses inside the joint limits, every link frame against MuJoCo 4.0.1's own URDF compile, plus a
third robot built to hit corners the two showroom robots miss: `robots/stress.urdf` (`make_stress_urdf.py`, seed 11;
13 links, 12 joints; rpy at the pitch = ±π/2 singularity and beyond π, axes that are neither unit length nor along
x/y/z, prismatic and continuous joints, a fixed-joint chain, branching, a mimic joint with multiplier −0.5 and offset
0.25).

| loader | how it ran | UR5 | Panda (mimic finger) | stress | grade |
|---|---|---|---|---|---|
| **this bridge** (`urdf2x3d.py`, X3D read back by `fk_check.py`) | Python | 4.7e-16 m | 5.6e-16 m | **0.64 m before the fix**, 1.8e-15 m after | Confirmed |
| **urdf-loader 0.13.1** (gkjohnson, three.js 0.187.0) | in Chromium 158.0.8127.36 headless; it parses the URDF itself; `compare/urdf_loader_check.py` | 6.0e-16 m | 5.8e-16 m, mimic applied by the loader | 1.1e-15 m | Confirmed |
| **Unity URDF-Importer 0.5.2-preview** (Unity Technologies, Apache-2.0) | its import arithmetic ported line by line to numpy at Unity's float32 (`compare/unity_importer_port.py`); **Unity itself not run** | 4.2e-7 m | 2.2e-7 m, **but the importer has no mimic**: a finger left undriven is 0.040 m off | 3.5e-7 m (rotation 1.5 rad off on the undriven mimic joint) | Likely |

Rotations follow the positions in every row (worst 1.1e-15 rad for urdf-loader, 6.2e-7 rad for the Unity port).

**What this says.**
- **urdf-loader is exact.** On all three robots it matches MuJoCo to rounding, including the mimic joint, a
  non-unit prismatic axis and the rpy singularity. For a browser viewer of a URDF it is the right tool, and the
  answer to "how accurate" is: as accurate as MuJoCo, on these three. It uses the meshes as they are (DAE, STL, OBJ)
  and keeps no X3D, so it is a viewer, not a carrier.
- **The stress robot caught a bug in this bridge.** A prismatic joint's slide was written as `axis * q`. URDF and
  MuJoCo normalise the axis, so with axis length 2.2 the link landed 0.64 m off. UR5 and Panda never showed it
  because their axes are unit length. Fixed in `urdf2x3d.py`, `fk_check.py` and `ros2_replay.py`; the two committed
  robot scenes are byte for byte unchanged.
- **Unity's importer is right up to float32**, read from its source: `Ros2Unity(v) = (-v.y, v.z, v.x)`, origins as
  `Euler(+pitch, -yaw, -roll)` (Unity turns z, then x, then y, which is URDF's roll, pitch, yaw), revolute joints
  about `FromToRotation(x, -axis)` (the minus undoes the mirror), prismatic about `+axis`. A planted swap of roll and
  pitch in the port is caught (π rad off). Three things it does not do: **`<mimic>` is not read at all** (no match in
  the joint sources); joint values are float32 degrees; and `UrdfJoint.IsRevoluteOrContinuous` is written as
  `Revolute || Revolute`, so it never says true for a continuous joint (a latent bug: nothing in that repository
  calls it; Confirmed by reading).
- **Frames differ by a quarter turn.** The same robot taken URDF → this bridge → X3D → x3d.lab's io.x3d.unity faces
  **90 degrees about Unity's up axis** from one imported by Unity's URDF-Importer: −90° with io.x3d.unity's native
  mirror Z, +90° with its glTFast mirror X (`yaw_from_x3d_route_to_importer_deg` in each receipt). Both are
  correct for their own convention (ROS x forward becomes Unity +z in the importer, Unity +x through X3D). A
  digital twin mixing the two routes must turn one of them; it is the same kind of trap as failure mode 304.

Receipts: `results/*-urdf-loader-receipt.json`, `results/*-unity-importer-port.json`, `results/stress-fk-receipt.json`.
`compare/package.json` pins three 0.187.0 and urdf-loader 0.13.1 (`npm install` there; node_modules is not committed).
urdf2gltf: the npm package was unpublished in 2021, so there is nothing to measure.

## Not claimed

Dynamics (masses and inertias are not carried), collision behaviour, visual meshes in DAE or OBJ, Gazebo and
transmission tags, SRDF, xacro (expand it first). ROS 2: only `sensor_msgs/JointState` from a recording; no live
topic (no DDS, no rosbridge), no `/tf`, recordings synthetic rather than from a robot, X_ITE only (no other browser),
and no frame-time or visual check of the playback.

## Data attribution and takedown

Both robots come from **example-robot-data** by Gepetto (LAAS-CNRS, University of Edinburgh, INRIA),
<https://github.com/Gepetto/example-robot-data>, commit `d9fd825`, BSD 2-Clause. The scenes embed the collision
meshes as X3D geometry, so those packages' own licences apply to that geometry:

- **UR5**, `robots/ur_description`: upstream <https://github.com/ros-industrial/universal_robot/tree/kinetic-devel/ur_description>,
  licence BSD (as its README states). URDF sha256 `cede880f…` (full value in the receipt).
- **Franka Panda**, `robots/panda_description`: licence Apache-2.0 (its LICENSE file). URDF sha256 `63792d26…`.

Universal Robots and Franka Emika are named only to say where the models come from; nothing here is endorsed by
them. If you hold rights in any of this geometry and want it removed, open an issue on this repository and it will
be taken down promptly.
