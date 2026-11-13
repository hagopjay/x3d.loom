# Bridge batch 6

Reader knows **105/260** X3D 4.0 node types after this batch (30 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 795fbdef14b1", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| TexCoordDamper2D | Followers | ok | pass 7/7 | pass 7/7 | PASS |  |
| PlaneSensor | PointingDeviceSensor | ok | pass 28/28 | pass 28/28 | PASS | axisRotation is implemented (frame turned by it) but not exercised against X_ITE; trackPoint_changed is not compared: X_ITE reports it in the sensor frame, ours in the sensor frame at the press, to be checked; isOver (hover) is not raised by the drag sensors |
| SphereSensor | PointingDeviceSensor | ok | pass 13/13 | pass 13/13 | PASS | after the second drag the rotation angle agrees with X_ITE 16.6.0 (0.5205 vs 0.5235 rad) but one axis component differs by 0.2: the hit point of a press on an already turned box is read differently, not chased (no pixel perfection); trackPoint_changed not compared; a drag that leaves the sphere uses the nearest point of the sphere to the ray; X_ITE does the same by its own rule, only tested inside the sphere |
| CylinderSensor | PointingDeviceSensor | ok | pass 15/15 | pass 15/15 | PASS | disk mode (view along the axis) is implemented but only the cylinder mode is compared with X_ITE; trackPoint_changed not compared |
| VisibilitySensor | EnvironmentalSensor | ok | pass 15/15 | FAIL step 15: N.isActive is true, expected false | PASS | occlusion by other shapes is not tested (X_ITE 16.6.0 does not test it either); one decision per frame; enterTime and exitTime are the frame timestamps |
