# Bridge batch 38

Reader knows **191/260** X3D 4.0 node types after this batch (119 bridged in this work so far, 72 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 4efd483ceb2a", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| Analyser | Sound | ok | pass 91/91 | pass 91/91 | PASS | the data outputs are filled once per frame while the node is active (the test rig draws about 3 frames per second in our reader); the window is the last fftSize samples at that moment, so single samples are not compared between the engines, only rms, frequency and the peak bin; smoothingTimeConstant is read back from the audio node, not measured as a time response; the noise floor of the spectrum (bins away from the peak) is not compared |
| Delay | Sound | ok | pass 92/92 | pass 92/92 | PASS | Web Audio takes a maximum above 0 and below 180 s; X_ITE throws outside that, the bridge holds maxDelayTime to 0.001..179.999 (not tested, since X_ITE cannot be asked) |
| Gain | Sound | ok | pass 70/70 | pass 70/70 | PASS | a Gain has no Web Audio node of its own beyond the input stage (as in X_ITE); channelCount, channelCountMode and channelInterpretation are compared as settings, not as a channel mix with a multichannel signal (the ChannelMerger test does that) |
| OscillatorSource | Sound | ok | pass 114/114 | pass 114/114 | PASS | pause stops the tone (30 ms fade) and resume starts a new one, as in X_ITE; the four extra OscillatorSources are only there to hold the waves for the test; the tone is measured by rms, frequency and harmonic amplitude (Hann window, exact frequency), not sample by sample, because the two engines run on separate real time audio clocks; the exact phase and the start instant (which follows the 3 frames per second of the rig in our reader) are not compared |
| PeriodicWave | Sound | ok | pass 69/69 | pass 69/69 | PASS | the wave only sounds through an OscillatorSource; disableNormalization is not a field of this node in X3D 4.0 (Web Audio normalises, as in X_ITE) |
