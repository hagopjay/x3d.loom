# Bridge batch 16

Reader knows **155/260** X3D 4.0 node types after this batch (80 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 79d1f27294c6", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| ListenerPointSource | Sound | ok | pass 29/29 | pass 29/29 | PASS | the listener follows the node once per frame; X_ITE does it while it draws the node; enabled = false leaves the listener where it was; interauralDistance and dopplerEnabled are held, Web Audio has no use for them; the 4.0 UOM gives ListenerPointSource gain, mediaDeviceID and a start/stop clock; X_ITE 16.6.0 has none of them, so they are held here and not compared |
| MicrophoneSource | Sound | ok | pass 15/15 | pass 15/15 | PASS | getUserMedia is not tested (no device, no permission prompt in the test browser); streamIdentifier is held; X_ITE lists it, the 4.0 UOM does not for this node |
| OscillatorSource | Sound | ok | pass 50/50 | pass 50/50 | PASS | pause stops the tone (30 ms fade) and resume starts a new one, as in X_ITE; the four extra OscillatorSources are only there to hold the waves for the test |
| PeriodicWave | Sound | ok | pass 33/33 | pass 33/33 | PASS | the waveform is only used through an OscillatorSource; the type to wave-type mapping is tested there |
| SpatialSound | Sound | ok | pass 91/91 | pass 91/91 | PASS | a SpatialSound plays only while it is drawn in X_ITE (its traversed flag, which a Switch or culling turns off); the bridge plays it whenever it is enabled; spatialize is an initializeOnly field: set at load, bypassing the panner; the routing is not read back; dopplerEnabled and priority are held; Web Audio has no doppler and there is one voice per node; a maxDistance of 0 or less is refused by Web Audio (RangeError): the old distance stays; X_ITE 16.6.0 raises the error inside its event handler, so the test does not try it |
