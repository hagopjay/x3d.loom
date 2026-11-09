# Bridge batch 17

Reader knows **160/260** X3D 4.0 node types after this batch (85 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha fb73883023bb", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| StreamAudioDestination | Sound | ok | pass 20/20 | pass 20/20 | PASS | no network stream is made: streamIdentifier and mediaDeviceID are held |
| StreamAudioSource | Sound | ok | pass 26/26 | pass 26/26 | PASS | no stream is read: streamIdentifier is held |
| WaveShaper | Sound | ok | pass 74/74 | pass 74/74 | PASS | the curve is read back by length and by values, the shaping itself is Web Audio's |
| Layer | Layering | ok | pass 17/17 | pass 17/17 | PASS | pickable, objectType, pointerEvents and viewport are held: picking does not respect layers; addChildren and removeChildren rebuild the layer; this is checked in the SAI test of LayerSet only if the engine exposes them (X_ITE does), here only the fields are compared |
| LayerSet | Layering | ok | pass 32/32 | pass 32/32 | PASS | activeLayer (which layer the user navigates) and the navigation of a layer's own Viewpoint are held, not acted on: the user always navigates the world's camera; a layer's Viewpoint is read once and per frame, not bound or animated; the layer has no NavigationInfo, Background or headlight of its own; picking does not respect layers: a ray hits the meshes of every layer, and pickable / objectType / viewport are held; lights of the world light the meshes of every layer; a layer has no lights of its own; order without any visible layer draws the world (Babylon needs a camera) |
