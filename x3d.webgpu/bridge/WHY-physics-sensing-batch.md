# Why these three: CollisionSensor, CollisionSpace and Contact (tracker batch 47)

Rig for every number: Chromium 153.0.8010.12 on SwiftShader (no real GPU), X_ITE 16.6.0 (Bullet compiled to WebAssembly), Babylon 9.32.0. Pictures are not involved: the fixtures read values.

## 1. Why these

The physics world (RigidBodyCollection, RigidBody, the collidable nodes and the six joints) was already bridged. These three are how a scene hears about it. They were paused on purpose in batch 43 and are in scope again by the owner's word of 15 Nov ("continue with integration until fully completed").

## 2. What X_ITE does

**CollisionSensor does not detect anything.** Once per frame it reads the contacts the physics world left after its last sub-step, keeps those that touch or penetrate (distance <= 0), and keeps a contact when at least one of its two bodies owns a collidable that the SENSOR's own collider lists (its `collider` is a separate CollisionCollection from the world's). Only the top-level geometry of a body counts (list the CollidableOffset, not what it holds), and a body with several listed collidables is named by the last one. `isActive` is sent when it changes; `intersections` and `contacts` are sent on every frame while a contact exists, as the same node objects, and are never cleared: after the touch ends, `isActive` is false and the lists keep their last length. `enabled` is read only at load and when `collider` is written, so a file with `enabled="false"` stays dead until the collider is written again.

**CollisionSpace is a list.** `collidables` is flattened through nested spaces, live (emptying a nested list ends the contact within a frame). `enabled` and `useGeometry` are never read.

**Contact is a data node.** The sensor fills a pool of them and copies appliedParameters, bounce, minBounceSpeed, frictionCoefficients, surfaceSpeed and the softness fields from its own collider, and slipFactors into slipCoefficients; position, contactNormal (unit) and depth (>= 0) come from the world. `body1`, `body2`, `geometry1` and `geometry2` stay null in X_ITE 16.6.0 because the code writes a property with a trailing underscore. A Contact written in a scene or routed to `set_contacts` does nothing.

## 3. What the bridge does

The world keeps the contacts of its last 1/240 s sub-step (`st.last`), each tagged with the pair of top-level collidables and bodies. The sensor ticks once per timestamp, flattens its collider, builds the body -> last listed collidable map, keeps the contacts that touch a listed body and sends the three events in X_ITE's order. Everything above is copied, including the `enabled` quirk. One departure, on purpose: `body1`, `body2`, `geometry1` and `geometry2` are filled with the two bodies and collidables of the pair, as the specification says; the fixture asserts X_ITE's null on the X_ITE side and the pair on ours.

## 4. What the fixtures assert, and what they leave alone

Only resting contacts: a ball exactly touching a fixed ground, and a unit cube on it. An impact lasts one sub-step in both engines and is a lottery (X_ITE gave true, false, true within 150 ms, and no event at all with bounce on). The count for a cube is a range: Bullet kept 2 of the 4 lower corners here, the bridge 4. The sign of `contactNormal` depends on the order of the pair and flips with nested shapes, so only its length and axis are asserted.

## 5. Gaps (logged)

Cylinders and cones are bounding spheres in the bridge world, so their contact points and normals are wrong for flat faces. Bullet's margin and the bridge's 5 mm slop differ at rest (X_ITE 3e-8, the bridge up to 5 mm). `intersections` order is not asserted. The CollisionSpace bounding box fields are kept and unused.
