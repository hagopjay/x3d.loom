#!/usr/bin/env python3
"""Two synthetic ROS 2 recordings of the UR5's /joint_states, written by mcap-ros2-support (Foxglove's ROS 2 MCAP
writer, zstd chunks, its default), so the reader under test did not write its own input. Not from a robot.

  python3 make_recordings.py OUT_DIR      # needs: pip install mcap mcap-ros2-support

ur5-sweep.mcap   30 Hz, 12 s: smooth sweeps inside the limits; wrist_3 turns 4 pi one way (a continuous-style spin)
ur5-jerk-2hz.mcap 2 Hz, 6 s: wrist_3 jumps between -2 and +2 rad each message (a 4 rad step, more than pi): the
                  recording that makes SLERP play backwards unless the keys are split
"""
import math, sys
from pathlib import Path
from mcap_ros2.writer import Writer

JS = """std_msgs/Header header
string[] name
float64[] position
float64[] velocity
float64[] effort
================================================================================
MSG: std_msgs/Header
builtin_interfaces/Time stamp
string frame_id
================================================================================
MSG: builtin_interfaces/Time
int32 sec
uint32 nanosec
"""
J = ["shoulder_pan_joint", "shoulder_lift_joint", "elbow_joint", "wrist_1_joint", "wrist_2_joint", "wrist_3_joint"]
T0 = 1_764_288_000  # 28 Nov 2026 00:00 UTC, the stamps' epoch


def write(path, hz, seconds, q_of_t):
    with open(path, "wb") as fh:
        w = Writer(fh)
        s = w.register_msgdef("sensor_msgs/msg/JointState", JS)
        for k in range(int(hz * seconds) + 1):
            t = k / hz
            ns = T0 * 10**9 + round(t * 1e9)
            w.write_message("/joint_states", s, {"header": {"stamp": {"sec": ns // 10**9, "nanosec": ns % 10**9}, "frame_id": ""},
                                                 "name": J, "position": q_of_t(t, k), "velocity": [], "effort": []},
                            log_time=ns, publish_time=ns)
        w.finish()


def sweep(t, k):
    return [1.2 * math.sin(0.5 * t), -1.0 + 0.6 * math.sin(0.7 * t), 1.4 * math.sin(0.9 * t + 0.3),
            -1.2 + 0.8 * math.cos(0.6 * t), 1.5 * math.sin(1.1 * t), -2 * math.pi + 4 * math.pi * t / 12]


def jerk(t, k):
    return [0.3, -1.2, 1.0, -1.4, 0.8, 2.0 if k % 2 else -2.0]


if __name__ == "__main__":
    out = Path(sys.argv[1])
    write(out / "ur5-sweep.mcap", 30, 12, sweep)
    write(out / "ur5-jerk-2hz.mcap", 2, 6, jerk)
