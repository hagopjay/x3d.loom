# Bridge batch 40

Reader knows **193/260** X3D 4.0 node types after this batch (125 bridged in this work so far, 68 baseline). Rig: {"chromium": "153.0.8010.12", "ours": "x3d.webgpu reader + SAI shim, headless, bundle sha 7d6c875f1498", "xite": "X_ITE 16.6.0 (WebGL2, SwiftShader)", "babylon": "9.32.0"}.

Regression gate (all bridged event nodes in one ROUTE chain, ours + X_ITE): PASS; inside the real Babylon 9.32.0 WebGPU body on swiftshader: 13 frames, page errors 0, Switch ended on [1].

| node | component | xsd | ours | X_ITE | verdict | note |
|---|---|---|---|---|---|---|
| ChannelMerger | Sound | ok | pass 58/58 | pass 58/58 | PASS | a child past the 32nd is not connected (as in X_ITE); adding or removing children at run time rebuilds the merger on the next tick; the merge of children that have more than one channel each (they are mixed down to one before the merger, a Web Audio rule) is not compared |
| ChannelSelector | Sound | ok | pass 72/72 | pass 72/72 | PASS | only two channels are exercised; a selection past the channels of the input gives silence in Web Audio (not tested) |
| ChannelSplitter | Sound | ok | pass 58/58 | pass 58/58 | PASS | a node past the 32nd in outputs is not connected (as in X_ITE); the splitter's own channel count (the number of nodes in outputs) is compared as a setting, the signal only for two outputs |
| ListenerPointSource | Sound | ok | pass 105/105 | pass 105/105 | PASS | the listener follows the node once per frame; X_ITE does it while it draws the node; enabled = false leaves the listener where it was; interauralDistance and dopplerEnabled are held, Web Audio has no use for them; the 4.0 UOM gives ListenerPointSource gain, mediaDeviceID and a start/stop clock; X_ITE 16.6.0 has none of them, so they are held here and not compared |
| SpatialSound | Sound | ok | pass 189/189 | pass 189/189 | PASS | a SpatialSound plays only while it is drawn in X_ITE (its traversed flag, which a Switch or culling turns off); the bridge plays it whenever it is enabled; spatialize is an initializeOnly field: set at load, bypassing the panner; the routing is not read back; dopplerEnabled and priority are held; Web Audio has no doppler and there is one voice per node; a maxDistance of 0 or less is refused by Web Audio (RangeError): the old distance stays; X_ITE 16.6.0 raises the error inside its event handler, so the test does not try it; the HRTF response itself (inter-aural delay and spectrum) is compared only as the level of the two ears |
