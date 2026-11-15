# Bridge batch 47

Reader knows **249/260** X3D 4.0 node types after this batch (181 bridged in this work so far, 68 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 5e21f3655bd6", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| CollisionSensor | RigidBodyPhysics | ok | pass 36/36 | pass 36/36 | PASS | isActive, intersections and contacts of an impact are not asserted: X_ITE sees an impact for one sub-step, the bridge for one of its 1/240 s steps; both are noisy; the events of one frame come in the order isActive, intersections, contacts (X_ITE: the same timestamp); the fixture reads values, not order; enabled is read only at load and when collider is written, as X_ITE 16.6.0 does; the specification says enabled switches the node |
| CollisionSpace | RigidBodyPhysics | ok | pass 34/34 | pass 34/34 | PASS | enabled and useGeometry are not read (X_ITE 16.6.0 does the same); the specification says they switch the space and select the geometry; the bounding box fields are kept and never used |
| Contact | RigidBodyPhysics | ok | pass 30/30 | pass 30/30 | PASS | body1, body2, geometry1, geometry2: the bridge fills them, X_ITE leaves them null (checked on each side); the sign of contactNormal depends on the order of the pair and flips with nested shapes: only its length and axis are asserted; a Contact routed to set_contacts is held and does nothing, as in X_ITE |
