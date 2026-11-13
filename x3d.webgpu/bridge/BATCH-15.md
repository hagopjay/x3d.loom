# Bridge batch 15

Reader knows **150/260** X3D 4.0 node types after this batch (75 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 169e2f5cd5e3", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| ChannelSplitter | Sound | ok | pass 41/41 | pass 41/41 | PASS | a node past the 32nd in outputs is not connected (as in X_ITE); the wiring of each output to its node is not read back, only the splitter's size |
| Convolver | Sound | ok | pass 65/65 | pass 65/65 | PASS | three channels, or more than four, are refused by Web Audio; the bridge keeps the previous response (X_ITE throws); the response is built at the audio context's own sample rate, as in X_ITE; the processed sound is not compared; numberOfChannels is a Convolver field in X_ITE 16.6.0 but is not in the X3D 4.0 UOM or XSD; the bridge has it as in X_ITE (set at run time only, since the XSD cannot write it) |
| Delay | Sound | ok | pass 60/60 | pass 60/60 | PASS | Web Audio takes a maximum above 0 and below 180 s; X_ITE throws outside that, the bridge holds maxDelayTime to 0.001..179.999 (not tested, since X_ITE cannot be asked) |
| DynamicsCompressor | Sound | ok | pass 108/108 | pass 108/108 | PASS | reduction is read from the audio node every tick while active; with real sound it follows the signal, here only silence is tested |
| Gain | Sound | ok | pass 47/47 | pass 47/47 | PASS | a Gain has no Web Audio node of its own beyond the input stage (as in X_ITE) |
