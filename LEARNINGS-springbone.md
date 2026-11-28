# LEARNINGS: spring bones as native X3D (28 Nov 2026)

HagopJay asked for one of his favourite Unity assets, a spring-bone package he owns, to come over to X3D and Blender with everything it could become. His copy was read only to learn what its parameters mean. Nothing from it is in any repository: no code, no text, no assets. The zip was unpacked outside every git tree.

What came out:
- A behaviour spec in our own words: `x3d.springbone/SPEC.md`.
- Three solvers built from that spec: JS for X_ITE, Python for Blender and C# for Unity. All three give the same state hashes on one golden trace.
- Two PROTOs, `SpringBoneChain` and `SpringBoneCollider`.
- Blender import, export and bake.
- A Unity mapping from the asset's component.
- Demo 87, Spring Bone Lab.

Failure modes **586 to 594** in `LOOM-v1.md`.

## Results (each names what stands behind it)

| Claim | Number | Behind it | Grade |
|---|---|---|---|
| Physical tuning is exact | samples equal the continuous damped oscillator to 3e-16 m over 10 s | W2, Node 22.23.5 | Confirmed |
| The asset's spring rule has a damping floor | no setting goes below ζ 0.104 at 2 Hz, 60 Hz; its defaults behave like 3.2 Hz at ζ 0.31 | W2b; live in X_ITE 16.8.1: asked ζ 0.05, got 0.105 | Confirmed |
| Rigid bones lose energy by themselves | a 30° pendulum with damping 0 keeps 48 % of its swing after 6 s at 60 Hz, 83 % at 240 Hz; period error is order 0.96 | W3, W3b | Confirmed |
| FIXED time is display-rate free | bitwise identical state at 60, 120, 240 fps; VARIABLE disagrees by 71 mm (FIXED: 0.33 mm across rates with even root shares) | W4, W4b | Confirmed |
| Tapered capsule solved exactly | 2,000 points on the surface to 1.5e-9 m; the shortcut misses by 10.2 mm | W6 | Confirmed |
| X_ITE runs the PROTO the same as Node | 300 jittered frames through SAI `set_time`: 6 of 6 hashes equal | L2, X_ITE 16.8.1, Chromium 158 SwiftShader | Confirmed |
| Python twin equals JS | 16 of 16 hashes, positions within 1e-12 m | blender-io `tests/test_springbone_core.py` | Confirmed |
| Blender bake equals the solver | baked tip vs solver 1.38e-7 m over 72 frames, 288 keys, source action kept | bpy 5.3.0 wheel | Confirmed |
| C# twin equals JS | golden test written; compile and run wait on GitHub CI | x3d.unity_io `tests/X3D.Core.Tests` | Suspected until CI is green |
| Daz Genesis 8/9 bone names in `profiles/daz-genesis.json` | not checked against a real export | | Suspected |

## Lessons

1. **Tune in the units people think in.** Damping and elasticity per step mean nothing across frame rates. Frequency and damping ratio map onto them exactly (SPEC section 4). The map run the other way, `equivalentFrequency`, tells a rig author what an old rig actually does.
2. **A spring rule can quietly forbid a whole range.** When the pull scales the carried velocity (the POSITION rule), low damping ratios become unreachable. We kept that rule for faithful imports and added FORCE for everything else.
3. **"Rigid" is not free.** Projection-based length keeping removes energy at first order. A spring-bone chain that looks well damped may be the solver's damping, not the author's.
4. **A frame that takes no step must change nothing.** Carrying particles on idle frames made state depend on draw rate (6.5 cm). Carry for display only; move the roots in even shares across substeps.
5. **Test the browser the way a page will meet it.** A local server that sent `.wasm` and `.json` as `application/octet-stream` made X_ITE draw only the background, with no error at all.
6. **Importers must know which PROTO fields hold references.** A USE inside a `fieldValue` is a pointer, not more scene.
