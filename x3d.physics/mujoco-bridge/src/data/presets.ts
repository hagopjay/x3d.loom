import { ARM } from './arm';
export interface Preset {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  xml: string;
}

export const PRESETS: Preset[] = [
  ARM,
  {
    id: "cartpole",
    name: "Cartpole",
    blurb: "Classic control benchmark: slide joint + hinge pole. Balance it with the motor.",
    tags: ["control", "actuator", "sensor"],
    xml: `<mujoco model="cartpole">
  <compiler angle="radian"/>
  <option timestep="0.01" gravity="0 0 -9.81"/>
  <default>
    <joint damping="0.1" armature="0.3" limited="true"/>
    <geom condim="3" friction="0.6 0.02 0.01"/>
  </default>
  <worldbody>
    <light pos="0 -2 4" dir="0 0.4 -1" diffuse="0.9 0.9 0.95"/>
    <geom name="floor" type="plane" size="4 4 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="cart" pos="0 0 0.25">
      <joint name="slider" type="slide" axis="1 0 0" range="-2.5 2.5"/>
      <geom name="cart" type="box" size="0.16 0.11 0.09" mass="1.2" rgba="0.25 0.45 0.85 1"/>
      <body name="pole" pos="0 0 0.09">
        <joint name="hinge" type="hinge" axis="0 1 0" range="-3.14 3.14"/>
        <geom name="pole" type="capsule" fromto="0 0 0 0 0 0.55" size="0.032" mass="0.25" rgba="0.9 0.42 0.25 1"/>
        <geom name="tip" type="sphere" pos="0 0 0.55" size="0.055" rgba="1 0.8 0.2 1"/>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="slide_motor" joint="slider" gear="1" ctrllimited="true" ctrlrange="-60 60"/>
  </actuator>
  <sensor>
    <jointpos name="hinge_pos" joint="hinge"/>
    <jointvel name="hinge_vel" joint="hinge"/>
    <jointpos name="slider_pos" joint="slider"/>
  </sensor>
</mujoco>
`,
  },
  {
    id: "pendulum",
    name: "Pendulum (swing-up)",
    blurb: "A single driven hinge. Try energy-based swing-up, or just watch it swing and damp.",
    tags: ["joints", "keyframe", "motor"],
    xml: `<mujoco model="pendulum">
  <compiler angle="radian"/>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <default>
    <geom condim="3" friction="0.8 0.05 0.01"/>
  </default>
  <worldbody>
    <light pos="0 -2 4" dir="0 0.4 -1" diffuse="0.9 0.9 0.95"/>
    <geom name="floor" type="plane" size="3 3 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="base" pos="0 0 1.2">
      <geom name="base" type="box" pos="0 0 -0.06" size="0.22 0.22 0.06" mass="5" rgba="0.4 0.44 0.5 1"/>
      <body name="arm" pos="0 0 0">
        <joint name="hinge" type="hinge" axis="0 1 0" range="-3.141592653589793 3.141592653589793" damping="0.08" armature="0.01"/>
        <geom name="rod" type="capsule" fromto="0 0 0 0 0 -0.85" size="0.035" mass="0.6" rgba="0.2 0.65 0.9 1"/>
        <geom name="bob" type="sphere" pos="0 0 -0.85" size="0.09" rgba="0.95 0.35 0.4 1"/>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="hinge_motor" joint="hinge" gear="3" ctrllimited="true" ctrlrange="-6 6"/>
  </actuator>
  <sensor>
    <jointpos name="angle" joint="hinge"/>
    <jointvel name="angvel" joint="hinge"/>
  </sensor>
  <keyframe>
    <key name="down" qpos="0"/>
    <key name="up" qpos="3.141592653589793"/>
    <key name="side" qpos="1.2"/>
  </keyframe>
</mujoco>
`,
  },
  {
    id: "double-pendulum",
    name: "Double pendulum (chaos)",
    blurb: "Two hinges, no actuator: a chaotic system. Tiny changes in qpos0 → wildly different futures.",
    tags: ["chaos", "joints", "keyframe"],
    xml: `<mujoco model="double_pendulum">
  <compiler angle="radian"/>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <default>
    <joint damping="0.02" armature="0.005"/>
    <geom condim="3" friction="0.8 0.05 0.01"/>
  </default>
  <worldbody>
    <light pos="0 -2 4" dir="0 0.4 -1" diffuse="0.9 0.9 0.95"/>
    <geom name="floor" type="plane" size="3 3 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="base" pos="0 0 1.4">
      <geom type="box" pos="0 0 -0.05" size="0.18 0.18 0.05" mass="4" rgba="0.4 0.44 0.5 1"/>
      <body name="link1" pos="0 0 0">
        <joint name="shoulder" type="hinge" axis="0 1 0" range="-3.14 3.14"/>
        <geom name="rod1" type="capsule" fromto="0 0 0 0 0 -0.5" size="0.03" mass="0.4" rgba="0.55 0.35 0.9 1"/>
        <body name="link2" pos="0 0 -0.5">
          <joint name="elbow" type="hinge" axis="0 1 0" range="-3.14 3.14"/>
          <geom name="rod2" type="capsule" fromto="0 0 0 0 0 -0.5" size="0.025" mass="0.25" rgba="0.95 0.55 0.2 1"/>
          <geom name="tip" type="sphere" pos="0 0 -0.5" size="0.05" rgba="0.3 0.9 0.6 1"/>
        </body>
      </body>
    </body>
  </worldbody>
  <keyframe>
    <key name="folded" qpos="1.0 1.2"/>
    <key name="stretched" qpos="0.15 0.1"/>
  </keyframe>
</mujoco>
`,
  },
  {
    id: "ball-drop",
    name: "Bouncy ball drop",
    blurb: "Free-joint sphere dropped onto a plane with bouncy contact params (solref). Watch ncon and sensors.",
    tags: ["freejoint", "contact", "sensor"],
    xml: `<mujoco model="ball_drop">
  <compiler angle="radian"/>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <worldbody>
    <light pos="0 -2 5" dir="0 0.3 -1" diffuse="0.95 0.95 1"/>
    <geom name="floor" type="plane" size="5 5 0.1" rgba="0.82 0.85 0.9 1"
          solref="0.02 1" friction="0.9 0.02 0.01"/>
    <body name="ball" pos="0 0 2.2">
      <freejoint name="root"/>
      <geom name="ball" type="sphere" size="0.16" mass="0.5" rgba="0.95 0.3 0.35 1"
            solref="0.008 0.3" friction="0.8"/>
      <site name="ball_site" pos="0 0 0" size="0.012" rgba="1 1 0 1"/>
    </body>
    <body name="box" pos="0.8 0 0.25">
      <freejoint name="boxroot"/>
      <geom name="box" type="box" size="0.25 0.25 0.25" mass="1" rgba="0.35 0.75 0.55 1"/>
    </body>
  </worldbody>
  <sensor>
    <framepos name="ball_pos" objtype="body" objname="ball"/>
    <velocimeter name="ball_vel" site="ball_site"/>
    <gyro name="ball_gyro" site="ball_site"/>
    <force name="ball_force" site="ball_site"/>
  </sensor>
</mujoco>
`,
  },
  {
    id: "spider",
    name: "Spider quadruped",
    blurb: "8-DOF walking robot with a trot gait. Great for learning actuators, gear, and gait phase.",
    tags: ["locomotion", "actuator", "gait"],
    xml: `<mujoco model="spider">
  <compiler angle="radian"/>
  <option timestep="0.005" gravity="0 0 -9.81"/>
  <default>
    <joint damping="0.3" armature="0.02" limited="true"/>
    <geom condim="3" friction="1.1 0.05 0.01" rgba="0.3 0.6 0.85 1"/>
  </default>
  <worldbody>
    <light pos="0 -3 5" dir="0 0.5 -1" diffuse="0.9 0.9 0.95"/>
    <geom name="floor" type="plane" size="6 6 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="torso" pos="0 0 0.3">
      <freejoint name="root"/>
      <geom name="torso" type="box" size="0.16 0.11 0.05" mass="2.2" rgba="0.25 0.3 0.38 1"/>
      <site name="torso_site" pos="0 0 0" size="0.012" rgba="1 1 0 1"/>
      <body name="FL" pos="0.13 0.09 -0.03">
        <joint name="FL_hip" type="hinge" axis="0 1 0" range="-0.9 0.9"/>
        <geom type="capsule" fromto="0 0 0 0.11 0 -0.11" size="0.02" mass="0.08"/>
        <body name="FL_low" pos="0.11 0 -0.11">
          <joint name="FL_knee" type="hinge" axis="0 1 0" range="-1.4 1.4"/>
          <geom type="capsule" fromto="0 0 0 0.09 0 -0.13" size="0.014" mass="0.04"/>
        </body>
      </body>
      <body name="FR" pos="0.13 -0.09 -0.03">
        <joint name="FR_hip" type="hinge" axis="0 1 0" range="-0.9 0.9"/>
        <geom type="capsule" fromto="0 0 0 0.11 0 -0.11" size="0.02" mass="0.08"/>
        <body name="FR_low" pos="0.11 0 -0.11">
          <joint name="FR_knee" type="hinge" axis="0 1 0" range="-1.4 1.4"/>
          <geom type="capsule" fromto="0 0 0 0.09 0 -0.13" size="0.014" mass="0.04"/>
        </body>
      </body>
      <body name="BL" pos="-0.13 0.09 -0.03">
        <joint name="BL_hip" type="hinge" axis="0 1 0" range="-0.9 0.9"/>
        <geom type="capsule" fromto="0 0 0 -0.11 0 -0.11" size="0.02" mass="0.08"/>
        <body name="BL_low" pos="-0.11 0 -0.11">
          <joint name="BL_knee" type="hinge" axis="0 1 0" range="-1.4 1.4"/>
          <geom type="capsule" fromto="0 0 0 -0.09 0 -0.13" size="0.014" mass="0.04"/>
        </body>
      </body>
      <body name="BR" pos="-0.13 -0.09 -0.03">
        <joint name="BR_hip" type="hinge" axis="0 1 0" range="-0.9 0.9"/>
        <geom type="capsule" fromto="0 0 0 -0.11 0 -0.11" size="0.02" mass="0.08"/>
        <body name="BR_low" pos="-0.11 0 -0.11">
          <joint name="BR_knee" type="hinge" axis="0 1 0" range="-1.4 1.4"/>
          <geom type="capsule" fromto="0 0 0 -0.09 0 -0.13" size="0.014" mass="0.04"/>
        </body>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="FL_hip_m" joint="FL_hip" gear="0.6" ctrlrange="-1 1"/>
    <motor name="FL_knee_m" joint="FL_knee" gear="0.4" ctrlrange="-1 1"/>
    <motor name="FR_hip_m" joint="FR_hip" gear="0.6" ctrlrange="-1 1"/>
    <motor name="FR_knee_m" joint="FR_knee" gear="0.4" ctrlrange="-1 1"/>
    <motor name="BL_hip_m" joint="BL_hip" gear="0.6" ctrlrange="-1 1"/>
    <motor name="BL_knee_m" joint="BL_knee" gear="0.4" ctrlrange="-1 1"/>
    <motor name="BR_hip_m" joint="BR_hip" gear="0.6" ctrlrange="-1 1"/>
    <motor name="BR_knee_m" joint="BR_knee" gear="0.4" ctrlrange="-1 1"/>
  </actuator>
  <sensor>
    <framepos name="torso_pos" objtype="body" objname="torso"/>
    <velocimeter name="torso_vel" site="torso_site"/>
  </sensor>
</mujoco>
`,
  },
  {
    id: "hopper",
    name: "Hopper",
    blurb: "One-legged robot from the MuJoCo docs family: slide root + hip/knee/ankle. Position actuators hold a crouch.",
    tags: ["locomotion", "position actuator"],
    xml: `<mujoco model="hopper">
  <compiler angle="radian"/>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <default>
    <joint damping="1" armature="0.01" limited="true"/>
    <geom condim="3" friction="1 0.05 0.01"/>
  </default>
  <worldbody>
    <light pos="0 -3 5" dir="0 0.5 -1" diffuse="0.9 0.9 0.95"/>
    <geom name="floor" type="plane" size="6 6 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="torso" pos="0 0 1.05">
      <joint name="root" type="slide" axis="0 0 1" range="0.2 2.5"/>
      <geom name="torso" type="capsule" fromto="0 0 0.12 0 0 -0.12" size="0.07" mass="1.2" rgba="0.3 0.55 0.85 1"/>
      <body name="thigh" pos="0 0 -0.12">
        <joint name="hip" type="hinge" axis="0 1 0" range="-1.2 0.6"/>
        <geom name="thigh" type="capsule" fromto="0 0 0 0 0 -0.32" size="0.04" mass="0.35"/>
        <body name="leg" pos="0 0 -0.32">
          <joint name="knee" type="hinge" axis="0 1 0" range="-1.4 0.2"/>
          <geom name="shin" type="capsule" fromto="0 0 0 0 0 -0.32" size="0.03" mass="0.12"/>
          <body name="foot" pos="0 0 -0.32">
            <joint name="ankle" type="hinge" axis="0 1 0" range="-0.6 0.6"/>
            <geom name="foot" type="box" pos="0.06 0 -0.02" size="0.07 0.035 0.02" mass="0.06" rgba="0.9 0.5 0.2 1"/>
          </body>
        </body>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="root_motor" joint="root" gear="25" ctrllimited="true" ctrlrange="-25 25"/>
    <position name="hip_pos" joint="hip" kp="12" ctrlrange="-1.2 0.6"/>
    <position name="knee_pos" joint="knee" kp="12" ctrlrange="-1.4 0.2"/>
    <position name="ankle_pos" joint="ankle" kp="6" ctrlrange="-0.6 0.6"/>
  </actuator>
  <sensor>
    <jointpos name="root_z" joint="root"/>
    <jointvel name="root_vz" joint="root"/>
  </sensor>
  <keyframe>
    <key name="crouch" qpos="0.75 -0.5 -0.6 0.15"/>
  </keyframe>
</mujoco>
`,
  },
  {
    id: "humanoid",
    name: "Humanoid (capsule puppet)",
    blurb: "A 15-DOF biped built from capsules. It will wobble and fall — that's the point: learn balance, actuators, keyframes.",
    tags: ["biped", "freejoint", "position actuator"],
    xml: `<mujoco model="humanoid_lite">
  <compiler angle="radian"/>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <default>
    <joint damping="0.6" armature="0.02" limited="true"/>
    <geom condim="3" friction="0.9 0.05 0.01" rgba="0.72 0.55 0.38 1"/>
  </default>
  <worldbody>
    <light pos="0 -3 5" dir="0 0.5 -1" diffuse="0.9 0.9 0.95"/>
    <geom name="floor" type="plane" size="6 6 0.1" rgba="0.82 0.85 0.9 1"/>
    <body name="torso" pos="0 0 1.35">
      <freejoint name="root"/>
      <geom name="torso" type="capsule" fromto="0 0 -0.28 0 0 0.28" size="0.095" mass="6"/>
      <geom name="head" type="sphere" pos="0 0 0.42" size="0.075" mass="1" rgba="0.9 0.72 0.55 1"/>
      <body name="ua_r" pos="0.14 0 0.22">
        <joint name="shoulder_r" type="hinge" axis="0 1 0" range="-1.8 1.8"/>
        <geom type="capsule" fromto="0 0 0 0 0 -0.26" size="0.032" mass="0.3"/>
        <body name="fa_r" pos="0 0 -0.26">
          <joint name="elbow_r" type="hinge" axis="0 1 0" range="-2.2 0.2"/>
          <geom type="capsule" fromto="0 0 0 0 0 -0.24" size="0.026" mass="0.15"/>
        </body>
      </body>
      <body name="ua_l" pos="-0.14 0 0.22">
        <joint name="shoulder_l" type="hinge" axis="0 1 0" range="-1.8 1.8"/>
        <geom type="capsule" fromto="0 0 0 0 0 -0.26" size="0.032" mass="0.3"/>
        <body name="fa_l" pos="0 0 -0.26">
          <joint name="elbow_l" type="hinge" axis="0 1 0" range="-2.2 0.2"/>
          <geom type="capsule" fromto="0 0 0 0 0 -0.24" size="0.026" mass="0.15"/>
        </body>
      </body>
      <body name="thigh_r" pos="0.06 0 -0.28">
        <joint name="hip_r" type="hinge" axis="0 1 0" range="-1.6 0.8"/>
        <geom type="capsule" fromto="0 0 0 0 0 -0.4" size="0.05" mass="1.2"/>
        <body name="shin_r" pos="0 0 -0.4">
          <joint name="knee_r" type="hinge" axis="0 1 0" range="-1.8 0.1"/>
          <geom type="capsule" fromto="0 0 0 0 0 -0.38" size="0.04" mass="0.5"/>
          <geom name="foot_r" type="box" pos="0.045 0 -0.4" size="0.06 0.035 0.02" mass="0.2" rgba="0.3 0.32 0.38 1"/>
        </body>
      </body>
      <body name="thigh_l" pos="-0.06 0 -0.28">
        <joint name="hip_l" type="hinge" axis="0 1 0" range="-1.6 0.8"/>
        <geom type="capsule" fromto="0 0 0 0 0 -0.4" size="0.05" mass="1.2"/>
        <body name="shin_l" pos="0 0 -0.4">
          <joint name="knee_l" type="hinge" axis="0 1 0" range="-1.8 0.1"/>
          <geom type="capsule" fromto="0 0 0 0 0 -0.38" size="0.04" mass="0.5"/>
          <geom name="foot_l" type="box" pos="0.045 0 -0.4" size="0.06 0.035 0.02" mass="0.2" rgba="0.3 0.32 0.38 1"/>
        </body>
      </body>
    </body>
  </worldbody>
  <actuator>
    <position name="sh_r" joint="shoulder_r" kp="8" ctrlrange="-1.8 1.8"/>
    <position name="el_r" joint="elbow_r" kp="5" ctrlrange="-2.2 0.2"/>
    <position name="sh_l" joint="shoulder_l" kp="8" ctrlrange="-1.8 1.8"/>
    <position name="el_l" joint="elbow_l" kp="5" ctrlrange="-2.2 0.2"/>
    <position name="hip_r" joint="hip_r" kp="25" ctrlrange="-1.6 0.8"/>
    <position name="knee_r" joint="knee_r" kp="25" ctrlrange="-1.8 0.1"/>
    <position name="hip_l" joint="hip_l" kp="25" ctrlrange="-1.6 0.8"/>
    <position name="knee_l" joint="knee_l" kp="25" ctrlrange="-1.8 0.1"/>
  </actuator>
</mujoco>
`,
  },
];
