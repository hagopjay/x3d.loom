# Chirp on Babylon: parity gaps, logged for a later receipts pass

Owner rule (7 Nov 22:12Z): no pixel perfection; log the gaps. Nothing below was tuned away. Reference X_ITE 16.5.1 (the version vendored in the study), Babylon 9.32.0, headless Chromium 153.0.8010.12 on SwiftShader, 1100 x 700, "As authored" look (`?look=0`), equal-mass inspiral, Close viewpoint. Correctness only, no timings.

| id | gap | measured | grade |
|---|---|---|---|
| G1 | As authored vs X_ITE, whole frame | PSNR 25.36 dB at t=0, 25.12 at 0.5, 24.87 at 0.9, 24.96 at 0.99 | C |
| G2 | Babylon is brighter | mean RGB 146 152 170 vs 136 141 159 at t=0 (about 8 percent); light intensity mapping and PBR response differ | C |
| G3 | The inner hole of the sheet | X_ITE shows black, Babylon shows the Background's ground colour sRGB-encoded (25 29 40) | C |
| G4 | Orbit trails | X_ITE draws two thin lines; As authored draws the brain port's one-pixel ribbons; cinematic draws tubes. Width and antialiasing differ | C |
| G5 | Hear (audio) | the study's own audio element, unchanged; not played in the headless run; Babylon audio engine not used | S |
| G6 | Timing | no Timing button on this page yet; no real-GPU numbers (the owner runs his own); G0 consent was given for ports in his typed words, so the button can be added from `drift-timing.js` | L |
| G7 | Lens strength | a readable, capped thin-lens look, not a physical ray trace; the second image of each hole it draws is a look, not data | C |
| G8 | Safari, Firefox, mobile | not tested | S |
| G9 | Shared-file edits | brain/sai.js, brain/reader.js, drift/drift-ext.js changed (additive), plus brain/body.js and drift/drift-ext.js for the geometry cache key fix found on the Electron Cloud port (RECEIPT of `runs/webgpu-cloud-20261107/`, F5). After all of them: Chirp play pass (browser witness pass, Watch advances), KANSEI smoke pass, Neural Canvas 9 states 0 errors. KANSEI, brain and Chirp PSNR receipts were not re-run | C |
