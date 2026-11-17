# Shader and Vulkan books: receipt (17 Nov 2026)

Scope: two uploaded teaching packages were re-run and one new measurement was added. Grades: **C** = a tool ran here or the exact file was read, **L** = read or reasoned, **S** = suspected.

| item | what ran | result | instrument |
|---|---|---|---|
| Shader-Vulkan Fieldbook lab | `run_lab.py` (C17 reference vs Python models) | 745 of 745 cases agree, max absolute difference 1.6653345369377348e-16, property checks pass | CPython 3.13.18, GCC, Linux x86_64 **[C]** |
| Vulkan Light Lab | `tools/verify.py`, `integration_checks.py --validate`, `bench.py` | particle oracle 9.313e-10 (authors 9.313e-10); luminance oracle 1.660e-7 (authors 2.260e-7); 15 of 15 integration checks; `verify.py --validate` gives the same errors with 0 validation errors and 0 warnings and synchronization validation on; see `lightlab-rerun.json` | Mesa 25.2.8 lavapipe (LLVM 20.1.2), Vulkan 1.4.318, validation layer 1.3.275, software Vulkan **[C]** |
| Same render, other driver | 1440x900, 4 spp, default flags | 258 of 3,888,000 bytes differ from the shipped `beauty.png`, max 14 of 255 | LLVM 19.1.7 (shipped) vs 20.1.2 (here); assumes the shipped image used default scene flags; `imgdiff.py` redoes the comparison **[C]** |
| X_ITE output encode | read `x_ite.js` 16.7.1 line 67921 and rendered | `const float GAMMA=2.2; linearToSRGB = pow(color, vec3(1./GAMMA))`; emissive 0.5 PhysicalMaterial gives byte 186 (exact sRGB would be 188) | X_ITE 16.7.1 (npm), Chromium 153.0.8010.12, Playwright 1.63.0, ANGLE on SwiftShader **[C]** |
| X_ITE colour contract | `xite-furnace-colour.json`, `probe/` | default `ColorSpace`: Unlit and legacy Material 128 (raw), PhysicalMaterial 186; `LINEAR` all 186; `SRGB` all 128; `DisplayColorSpace=DISPLAY_P3` no change | same rig **[C]** |
| X_ITE white furnace | EnvironmentLight only, 1x1 white faces, no mips | metal baseColor 1 at intensity 0.5: byte 186 at roughness 0, 0.25, 0.5, 0.75, 1 (0.4995 with the 2.2 inverse); dielectric 0.5: 187 (rough) and 189 (smooth) | same rig **[C]** (uniform environment only) |

Reading rule: bytes from X_ITE must be decoded with the inverse of the encode that wrote them (power 2.2). The probe script prints an exact-sRGB decode (`linear`), which reads 0.491 where the right reading is 0.4995; `xite-furnace-colour.json` carries both columns.

Not run: native window, WSL, a physical GPU, Babylon / three.js / Blender / Unreal encode functions, X_ITE on hardware GL, X_ITE with a prefiltered specular mip chain.
