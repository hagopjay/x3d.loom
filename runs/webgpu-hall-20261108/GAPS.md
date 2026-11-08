# Library hall on Babylon: gap log (8 Nov 2026)

Standing rule: not pixel perfect; log the gaps. Grades: C Confirmed, L Likely, S Suspected. Rig: Babylon 9.32.0 WebGPU on SwiftShader, X_ITE 16.5.1 WebGL 2 on SwiftShader, 640x360.

| # | Gap | Grade | Note |
|---|---|---|---|
| H1 | No Text nodes. The scene's two TTF FontStyles and the plaques are not drawn | C | Fonts are not in the published tree; X_ITE also fails to load them and falls back to its own, then 404s. Needs a font file plus an MSDF or canvas-texture Text path. |
| H2 | One shadow map per shadow light, no cascades | C | WebGPU allows 16 vertex outputs and each shadow map spends two; the hall has five shadow lights, so a cascaded sun (`?cascades=2`) drives a mesh lit by all five to 16 and the pipeline is refused. A real fix is a custom shadow sampler in one texture array. |
| H3 | Lamp-lit interiors 1.2 to 1.4 times brighter than X_ITE | C | `lightScale` 0.75 changes it by 4 percent, so not the light unit. Suspects: emissive-times-texture path, ambient and environment term, X_ITE's own PBR (S). |
| H4 | Sky gradient and twilight differ | C | Same dome, same animated tint; Babylon is bluer at dusk (Exterior) and more orange at the horizon (Threshold). Likely alpha and blend order of the stacked sky and glow domes (L). |
| H5 | PointSet size is computed in a WGSL vertex shader | C | WebGPU has no point size. Quads are camera-facing; attenuation follows X3D 19.4.x. |
| H6 | BlendMode is mapped, not emulated | C | (SRC_ALPHA, ONE) is ADD, (ONE, ONE) is ONEONE, anything else draws as default and says so. |
| H7 | Collision is a Group, ProximitySensor is a box test | C | The viewer has no collision. |
| H8 | Extrusion crease normals use the drift crease-angle path | L | Not compared numerically against X_ITE's. |
| H9 | Reverse depth buffer on, `?rz=0` turns it off | C | The galaxy is 2.4 km out and the lamps 0.3 m across. |
| H10 | No real-GPU pass, no Timing block | C | Software adapter only; speed figures from it mean nothing. |
| H11 | Engine switch inside one page not driven in the Babylon rig | C | X_ITE overwrites `window.X3D`; the Babylon side uses `HallBabylon.ns`. |
| H12 | Only five of 23 viewpoints compared, no audio | C | Wider capture on a real GPU is the next receipt. |
