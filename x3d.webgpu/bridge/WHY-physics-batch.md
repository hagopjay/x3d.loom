# Why these five: the rigid body world (tracker batch 36)

Nodes: RigidBodyCollection, RigidBody, CollidableShape, CollidableOffset, CollisionCollection. Reader: 196 of 260 after this batch.
Rig for every number below: Chromium 153.0.8010.12 on SwiftShader, X_ITE 16.6.0 (its Bullet engine, Ammo), Babylon 9.32.0. No real-GPU timings exist.

## 1. Why physics, and why these five first

Ranked by the demos that exist today (count of files in the Loom repos that use the node): RigidBodyCollection 31, RigidBody 31, CollidableShape 27, then the joints (13 to 22 each). The platformer levels, the PhysX bridge scenes and the marble machine all use the same skeleton: one collection, bodies inside it, shapes inside the bodies, one collider with the rules. Picking, particles and the lights were already bridged by the Castle thread, so the next-most-used group was physics.

Five nodes are the smallest set that runs a scene: **the world** (RigidBodyCollection: gravity, iterations, which bodies), **the things** (RigidBody: mass, position, velocity), **the surfaces** (CollidableShape: what collides, and its size), **the placement** (CollidableOffset: a shape shifted inside its body), and **the rules** (CollisionCollection: bounce, friction). Joints, contacts and CollisionSensor need these first and come next.

## 2. What a "bridge" means for a node that does work

For most nodes the bridge only reads fields and draws. A physics node has to *compute*. X3D says what the fields mean and leaves the maths to the browser, so there is no reference to copy: X_ITE ships Bullet (compiled to WebAssembly), and our Babylon bodies had nothing. Three ways to get physics in Babylon were open:

- Babylon's Havok plugin: a binary the page must fetch, and the pages here run under tight network rules. Not self-contained.
- The PhysX 5 bridge in x3d.physics: excellent, but it is a worker with its own build. Right for a finished demo, heavy for a node-by-node reader.
- A small engine of our own (chosen): about 230 lines of plain JavaScript in `src/nodes/RigidBodyCollection.js`, no download, deterministic, and small enough that every behaviour can be explained and tested against X_ITE.

## 3. How the engine works (the part worth understanding)

**Time.** The collection steps itself in fixed slices of 1/240 s (`H`) up to the clock. A page that renders at 20 frames per second still gets 12 physics steps per frame. Fixed steps make the result repeatable, and small steps make resting contact stable. If a frame is very late the catch-up is capped at 0.5 s so a stalled tab does not spiral.

**Integration.** Semi-implicit (symplectic) Euler: update velocity from forces first, then position from the new velocity. It conserves energy far better than plain Euler for the same cost (the Ten Minute Physics integrator batch measured the same effect: order 1 in position, bounded energy error).

**Contacts.** Each pair of shapes close enough is tested exactly: sphere against sphere, sphere against box (closest point on the box), box against box with the separating axis test over 15 axes. For two boxes the contact points are the corners that poke through the face, so a box lying on a floor gets four points and does not rock. Cylinders and cones stand in as their bounding sphere (a logged gap).

**Solving.** Sequential impulses: for each contact, in turn, compute the speed the two bodies approach each other along the contact normal and apply an impulse to cancel it, never pulling (impulses are clamped to be pushes only). Repeat `iterations` times (default 10) per step, so contacts that fight each other settle. Friction is a second pair of impulses along the surface, limited to mu times the normal impulse (Coulomb). Overlap is eased out with a bias of `errorCorrection` times the depth beyond a 5 mm slop, per second.

**Mass.** Inertia comes from the shapes (box and sphere formulas, moved to the body origin with the parallel-axis rule). The inertia *field* is ignored, which is also what X_ITE's Bullet does (found in the PhysX bridge notes).

**Output.** After each tick the body raises `position`, `orientation`, `linearVelocity` and `angularVelocity` as events. A `ROUTE` from `RigidBody.position` to `Transform.translation` is all it takes to see the body move, in either engine.

## 4. What X_ITE's Bullet does that the spec does not say (all measured, 16.6.0)

These are the insights that cost the most time and are the reason the tests check each engine against its own value in four places.

1. **Friction is multiplied.** X_ITE gives every body friction 0.5 and Bullet combines two bodies by *multiplying*, so the default contact friction is 0.25, not 0.5. A box thrown at 4 m/s across ground stops after about 3.1 to 3.3 m in X_ITE; with mu = 0.5, v squared over 2 mu g gives 1.63 m, which is what the bridge does.
2. **The spec spelling is ignored.** `frictionCoefficients` is only used when `appliedParameters` contains FRICTION_COEFFICIENT_2 (underscore). The 4.0 XSD and the spec write FRICTION_COEFFICIENT-2 (hyphen), so a valid scene never gets its friction in X_ITE 16.6.0. The bridge accepts both.
3. **Nothing bounces off a fixed body unless minBounceSpeed is 0.** X_ITE sets a body's restitution only if that body's own speed is at least minBounceSpeed at the moment the bounce is configured. A fixed wall has speed 0, so its restitution is 0, and Bullet multiplies the two. With the default minBounceSpeed of 0.1 a ball hits the floor and stops. Our bridge bounces whenever the contact's closing speed reaches minBounceSpeed, which is what the field name says.
4. **A shape's translation is read late.** The offset of a CollidableOffset or CollidableShape reaches the physics only after the node first receives an event. A file that sets `translation` and never touches it rests at the body origin in X_ITE (0.5 m up in our test) where the bridge, applying it from the start, rests 1.5 m up.
5. **Bodies collide through their own geometry.** The collider's `collidables` list is not used for collision in X_ITE, and neither does the bridge use it; without a collider the bodies still collide (friction 0.5, no bounce).
6. **The step is variable.** Bullet in X_ITE steps by measured frame time, so the same scene differs run to run in the third digit (the friction slide above ranged 3.06 to 3.27 m). The bridge is exactly repeatable. Tests therefore use ranges, never exact trajectories.

## 5. How the tests stay honest

Each fixture fails if the engine is wrong: with collisions switched off the ball fell to y = -10.9 and the equal-mass pair passed through each other (velocities +2 and -2 instead of swapped), so the exact pair test, rest heights, and the force rate (2 N on 1 kg gives 2 m/s per second) are all real checks. Where X_ITE differs, the fixture says so and each engine is checked against its own documented value (friction distance, offset rest height).

## 6. Gaps (logged, not hidden)

centerOfMass, finiteRotationAxis, autoDamp, autoDisable and the disable speeds are kept and unused. surfaceSpeed, slipFactors and the soft-contact fields are kept and unused. Joints, Contact, CollisionSensor, CollisionSpace and CollisionCollection.collidables for sensing come in the next physics batch. Only boxes and spheres collide exactly. Bounce and friction are one value for the whole collection.

## 7. What this unlocks

Next in the physics group: SingleAxisHingeJoint, BallJoint, SliderJoint, MotorJoint, UniversalJoint, DoubleAxisHingeJoint (they need the world), then CollisionSensor and Contact (they need the contact list this engine already builds each step). That is the whole of X3D's rigid body component.
