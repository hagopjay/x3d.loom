# Bridge batch 14

Reader knows **145/260** X3D 4.0 node types after this batch (70 bridged in this work so far, 75 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 5c57e213f129", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| AudioDestination | Sound | ok | pass 45/45 | pass 45/45 | PASS | mediaDeviceID would pick the output device with setSinkId; the bridge's graph ends at the page's default output with no Audio element, so it is held but not applied; the audio only plays once the page's audio context is allowed to run (a click or key on the page); this is the browser's rule, not the bridge's |
| BiquadFilter | Sound | ok | pass 108/108 | pass 108/108 | PASS | the filter response is Web Audio's, the same engine under both; only the settings are compared; a time dependent node here only keeps the clock (isActive, isPaused, elapsedTime); the signal passes whether or not it is active, as in X_ITE |
| BufferAudioSource | Sound | ok | pass 47/47 | pass 47/47 | PASS | the field is bufferLength in X_ITE 16.6.0 and bufferlength (lowercase l, output only) in the X3D 4.0 XSD and UOM; both names exist here and the test uses the X_ITE one at run time, because the XSD one cannot be written; loading from url is written (fetch and decodeAudioData, then numberOfChannels, sampleRate, bufferLength, buffer and bufferDuration are filled in) but not tested here: it needs a sound file; a pause stops the source and resume starts it again at the paused position, since a Web Audio buffer source cannot pause; autoRefresh and autoRefreshTimeLimit are held, not acted on; X_ITE 16.6.0 reports bufferDuration -1 (not the UOM's 0) from the start while load is TRUE and nothing has loaded; the bridge does the same |
| ChannelMerger | Sound | ok | pass 42/42 | pass 42/42 | PASS | a child past the 32nd is not connected (as in X_ITE); adding or removing children at run time rebuilds the merger on the next tick |
| ChannelSelector | Sound | ok | pass 55/55 | pass 55/55 | PASS | a disabled selector passes all channels (as in X_ITE); only the splitter size is checked, the routing of the chosen output is not read back |
