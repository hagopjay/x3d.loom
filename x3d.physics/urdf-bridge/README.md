# URDF → X3D, held to MuJoCo's forward kinematics (v0.1, 28 Nov 2026)

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

## Not claimed

Dynamics (masses and inertias are not carried), collision behaviour, visual meshes in DAE or OBJ, Gazebo and
transmission tags, SRDF, xacro (expand it first), ROS 2 topics. The ROS 2 leg (a CDR decoder so that `/joint_states`
from an MCAP recording can drive these Transforms) is the next step and is not here yet.

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
