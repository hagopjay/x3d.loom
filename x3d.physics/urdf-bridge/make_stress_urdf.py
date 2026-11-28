#!/usr/bin/env python3
"""A synthetic URDF that hits the corners the two showroom robots miss: rpy at the pitch = +-pi/2 singularity,
rpy angles beyond pi, axes that are not unit length or not along x/y/z, prismatic and continuous joints, chains of
fixed joints, a mimic joint with a multiplier and an offset, and branching. No meshes (kinematics only); every link gets a unit inertial so MuJoCo will compile it.

  python3 make_stress_urdf.py OUT.urdf [--seed 11]
"""
import math, random, sys

a = sys.argv
seed = int(a[a.index("--seed") + 1]) if "--seed" in a else 11
rng = random.Random(seed)
L = ['<?xml version="1.0"?>', '<robot name="stress">']
links = ["base"]
INERT = '<inertial><mass value="1"/><inertia ixx="0.01" iyy="0.01" izz="0.01" ixy="0" ixz="0" iyz="0"/></inertial>'
L.append(f'  <link name="base">{INERT}</link>')
specials = [(0.3, math.pi / 2, -0.7), (1.1, -math.pi / 2, 2.0), (4.0, 0.2, -3.9), (-math.pi, math.pi, math.pi), (0, 0, 0)]
kinds = ["revolute", "continuous", "prismatic", "fixed", "revolute", "fixed", "fixed", "revolute", "prismatic", "continuous",
         "revolute", "revolute"]
for i, kind in enumerate(kinds):
    parent = links[rng.randrange(len(links))] if i > 2 else links[-1]  # a chain first, then branching
    child = f"l{i}"
    links.append(child)
    rpy = specials[i] if i < len(specials) else tuple(rng.uniform(-4, 4) for _ in range(3))
    xyz = tuple(rng.uniform(-0.4, 0.4) for _ in range(3))
    ax = (0, 0, 1) if i == 0 else tuple(rng.uniform(-2, 2) for _ in range(3))  # not unit length on purpose
    L.append(f'  <link name="{child}">{INERT}</link>')  # MuJoCo refuses massless moving bodies
    j = [f'  <joint name="j{i}" type="{kind}">', f'    <parent link="{parent}"/>', f'    <child link="{child}"/>',
         f'    <origin xyz="{xyz[0]:.6f} {xyz[1]:.6f} {xyz[2]:.6f}" rpy="{rpy[0]!r} {rpy[1]!r} {rpy[2]!r}"/>']
    if kind != "fixed":
        j.append(f'    <axis xyz="{ax[0]:.6f} {ax[1]:.6f} {ax[2]:.6f}"/>')
        if kind in ("revolute", "prismatic"):
            lo, hi = (-0.3, 0.3) if kind == "prismatic" else (-2.5, 2.5)
            j.append(f'    <limit lower="{lo}" upper="{hi}" effort="10" velocity="1"/>')
        if i == 11:
            j.append('    <mimic joint="j7" multiplier="-0.5" offset="0.25"/>')
    j.append("  </joint>")
    L += j
L.append("</robot>")
open(a[1], "w").write("\n".join(L) + "\n")
