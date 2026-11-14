# Why these six: joints (tracker batch 41)

Nodes: BallJoint, SingleAxisHingeJoint, SliderJoint, DoubleAxisHingeJoint, MotorJoint, UniversalJoint.
Rig for every number below: Chromium 153.0.8010.12 on SwiftShader, X_ITE 16.6.0 (Bullet through Ammo), Babylon 9.32.0, the bridge's own engine in `src/nodes/RigidBodyCollection.js`. No real-GPU timings exist.

## 1. What a joint is, in one sentence

A joint takes away some of the ways two bodies can move relative to each other. A free body has six (three slides, three turns). A ball joint removes the three slides at one point, a hinge removes five (leaving one turn), a slider removes five (leaving one slide), a universal joint removes four (two turns left), and a motor joint removes none and only pushes. Everything below follows from counting those degrees of freedom.

## 2. How the bridge solves them: rows, not special cases

The contact solver already works in scalar rows: each row says "this combination of the two bodies' velocities must equal a target, and the impulse that does it may only lie between lo and hi". A contact is a row with lo = 0 (pushes only). A joint is a handful of the same rows with no lower bound:

- **Point rows (3)**: the two anchor points must move together. This is the whole ball joint and the first half of every other joint.
- **Align rows (2)**: the hinge axis seen from body 1 and from body 2 must stay parallel, so the relative turn can only be about that axis.
- **Perpendicular row (1)**: for the universal joint and the second hinge, the two axes must stay at 90 degrees.
- **Lock rows (3)** for the slider: no relative turn at all, plus two rows keeping the bodies on the axis line.
- **Limit rows**: a one-sided row (lo = 0) that switches on only while the angle or separation is outside min and max, pushing back with a bounce term from `stopBounce`.
- **Motor row**: a two-sided row asking for a relative speed, with the impulse capped at maxTorque times the step. A motor that can push only as hard as its torque limit, not harder, is exactly what a real motor does.

All of it runs in the same iteration loop as contacts, so a ball joint holding a body against the floor and the floor holding it up solve together. Position drift is eased out by 20 percent per step (Baumgarte, `JERP`). It is a fixed constant, lower than the 0.8 the fields call `stopErrorCorrection`, because that field only governs the limits (the point and axis rows would overshoot at 0.8).

The one hard part is the **angle**. A hinge angle is measured from the pose at load, and it can pass through plus or minus pi, so the bridge keeps a running unwrapped angle (`twist()`), updated from the relative rotation each step, and the limit rows read that. That is why `angle` here is signed and continuous, while X_ITE's is the unsigned size of an axis-angle rotation (it reported 3.45 where the bridge reports -0.5 for the same swing past the limit).

## 3. What X_ITE 16.6.0 does (all measured on the rig above)

1. **BallJoint** is a Bullet point-to-point constraint, and agrees with the bridge. The anchor outputs are **local** to each body (body1AnchorPoint is [0,0,0] when the anchor sits at body 1's origin), not world positions as the first draft of the bridge assumed. Fixed.
2. **SingleAxisHingeJoint** makes a hinge with no limits: minAngle, maxAngle, stopBounce and stopErrorCorrection are read and never applied. With limits of plus and minus 0.5 rad the bridge held the ball against the stop (angle -0.50, ball at x = 1.755, y = 4.034, which is 2 cos 0.5 and 5 - 2 sin 0.5) while X_ITE swung past it.
3. **DoubleAxisHingeJoint** is treated as a plain hinge, and in this pose it turned the ball about the vertical: it ended at (0, 5, 2) from (2, 5, 0) with no fall, and hinge1Angle stayed 0 although forced. Suspected cause: the second axis is mixed into the frame. The motor fields (desiredAngularVelocity, maxTorque) do nothing. The bridge turned the ball 1.5 rad in 1.5 s at 1 rad/s.
4. **SliderJoint** builds a slider whose two frames both come from body 1's position (so the test puts body 1 at the origin), and reads sliderForce without applying it. With gravity off and sliderForce 2, the bridge pushed the ball to its 2.5 m stop and X_ITE left it at rest.
5. **MotorJoint** is a stub: the node exists and no torque is applied (angular velocity unchanged to 0.01 rad/s over a second). The bridge applies the user torques: a 1 N m torque on a 1 kg, 0.3 m sphere (inertia 0.036 kg m2) gives about 27.8 rad/s per second in theory and 25.1 measured (the wait is wall-clock and the software-rendered page's clock jitters, so the test allows 22 to 33).
6. **UniversalJoint** is marked "not supported": no constraint is made, and the ball falls freely (below y = 3 after 1.5 s). The bridge keeps the ball 2 m from the pivot and the two axes perpendicular (dot product under 0.05).
7. Output gating: all joint outputs are raised only for the names listed in `forceOutput`, and the default is none (the spec's default).

## 4. Why the tests look the way they do

Each joint has one cross-engine fact (a pendulum stays 2 m from its pivot in BOTH engines) and one fact where the engines differ and each is checked against its own measured value (hinge limits, hinge-2 axes, slider force, motor torque, universal). That keeps the tests honest in the way the physics batch established: a test passes only if the bridge is right, and the X_ITE side records exactly what 16.6.0 does so the next version shows up as a changed receipt, not a mystery.

Bugs the tests caught while writing this: the limit rows had their signs swapped (a hinge swung to angle -989 and x = -90: the constraint pushed the wrong way, energy grew without bound); anchors were world not local; the hinge's default minAngle is -pi, not +pi.

## 5. Gaps (logged)

stopBounce on the slider, the suspension fields of the double hinge and the stopN fields of the universal and motor joints are kept and not used. MotorJoint autoCalc is not implemented (the bridge always takes the user torque and axes). The joint error constant is fixed. A chain of more than a few joints needs more `iterations` than the default 10 to look rigid. Joint outputs are raised each tick for the listed names even when unchanged.

## 6. What this unlocks

Every joint-based demo in the Loom repos (doors, pendulums, ragdoll skeleton sketches, the marble machine's hinged flaps) can now run in the bridge. Next: CollisionSensor and Contact, which read the contact list the engine already builds each step.
