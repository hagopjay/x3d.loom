# LEARNINGS: Open3D-ML bridge (x3d.demo `open3d-ml-bridge/v1`, Demo 81, 26 Nov 2026)

Open3D-ML RandLA-Net (S3DIS) on CPU over a Redwood RGB-D fragment, carried into X3D 4.0 and back. Code: x3d.ml `o3d_bridge/`.
Instruments: Open3D 0.20.0, torch 2.13.0, x3d_mcp fork `4d433af` (XSD 4.0), X_ITE 16.7.1 in Chromium + SwiftShader, x3d.ml pytest.
Grades: C confirmed here, L likely, S suspected.

1. **The model's frame is part of its input (C).** The S3DIS checkpoint expects Z up and the floor near z = 0. Camera-frame scans sit at z ≈ -2.4…-0.8. Without the shift only 25.8% of labels agree with the shifted run and the floor class jumps 706 → 101,310 points. Rotate to Z up, shift the floor to 0, record the offset.
2. **`predict_scores` is a damped running average, not a softmax (C).** Largest per-point entry averaged 0.07 (< 1/13). Use max/sum and call it uncalibrated confidence.
3. **The pipeline is stochastic (C).** Random centre-point sampling: repeat on identical points agrees on 87.3 ± 0.6%. Class membership changed between rebuilds (a column class appeared and vanished).
4. **One run per arm manufactured a bridge loss (C).** A single round-trip run gave 80-83% and looked like a 14-point bridge loss. Five runs per arm: bridged 84.1 ± 1.3, direct 50k subset 82.8 ± 3.2, full repeat 87.3 ± 0.6. Add the no-bridge control and replicates before blaming a converter. Cross-scene rate: S.
5. **XSD 4.0 passes metadata that X_ITE rejects (C).** A MetadataSet under a Group needs `containerField="metadata"` (X_ITE reads a bare one as "value"); MetadataString `value` is an MFString and must be quoted. Both were XSD-valid on `4d433af`, flagged by X_ITE 16.7.1 only when the scene was parsed in a browser. FontStyle `justify` unquoted *is* caught by XSD. Render every generated scene and read the console, not just the validator.
6. **Open3D's torch ops need a CUDA-12 runtime even on CPU (C).** Open3D 0.20.0's ops link the CUDA build of torch 2.13.*; the CPU wheel fails ("Version mismatch", then "Could not load this library"). PyPI torch 2.13.0 + `nvidia-cuda-runtime-cu12` on `LD_LIBRARY_PATH` works.
7. **Third-party scan data (C):** the Redwood page states no licence ("please cite"); ship a derived subset only, cite, add the takedown route. KITTI/SemanticKITTI/S3DIS were not used (registration or non-commercial terms).
8. **Hole (C):** no real LiDAR frame was run, so 3D-box output is unit-tested on synthetic boxes only; no detection-accuracy claim.
