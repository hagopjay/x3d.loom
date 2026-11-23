# Disagreement matrix (MAE on object pixels, 0-255; grade AGREE <=2, NEAR <=8, FAR >8)

| scene | babylon|blender | babylon|three | babylon|wgpu | babylon|xite | blender|three | blender|wgpu | blender|xite | three|wgpu | three|xite | wgpu|xite | centre px xite / babylon / blender / three / wgpu |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| ctrl_intensity05_m0_r1_c0.5 | 133.726 FAR | 4.675 NEAR | 5.51 NEAR | 4.951 NEAR | 139.18 FAR | 140.09 FAR | 139.442 FAR | 1.524 AGREE | 1.079 AGREE | 1.921 AGREE | 137 / 133 / 0 / 137 / 138 |
| ctrl_intensity05_m1_r0.5_c1 | 68.211 FAR | 116.173 FAR | 118.037 FAR | 117.036 FAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 1 / 0 / 186 / 188 |
| ctrl_intensity05_m1_r0_c1 | 68.211 FAR | 116.173 FAR | 118.037 FAR | 117.036 FAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 1 / 0 / 186 / 188 |
| ctrl_intensity0_m0_r1_c0.5 | 0.08 AGREE | 2.99 NEAR | 3.042 NEAR | 3.58 NEAR | 4.485 NEAR | 4.785 NEAR | 5.135 NEAR | 1.476 AGREE | 2.339 NEAR | 2.313 NEAR | 0 / 0 / 0 / 0 / 0 |
| ctrl_intensity0_m1_r0.5_c1 | 0.08 AGREE | 2.99 NEAR | 3.042 NEAR | 3.58 NEAR | 4.485 NEAR | 4.785 NEAR | 5.135 NEAR | 1.476 AGREE | 2.339 NEAR | 2.313 NEAR | 0 / 0 / 0 / 0 / 0 |
| ctrl_intensity0_m1_r0_c1 | 0.08 AGREE | 2.99 NEAR | 3.042 NEAR | 3.58 NEAR | 4.485 NEAR | 4.785 NEAR | 5.135 NEAR | 1.476 AGREE | 2.339 NEAR | 2.313 NEAR | 0 / 0 / 0 / 0 / 0 |
| ctrl_noenv_m0_r1_c0.5 | 0.08 AGREE | 2.99 NEAR | 3.042 NEAR | 3.58 NEAR | 4.485 NEAR | 4.785 NEAR | 5.135 NEAR | 1.476 AGREE | 2.339 NEAR | 2.313 NEAR | 0 / 0 / 0 / 0 / 0 |
| ctrl_noenv_m1_r0.5_c1 | 0.08 AGREE | 2.99 NEAR | 3.042 NEAR | 3.58 NEAR | 4.485 NEAR | 4.785 NEAR | 5.135 NEAR | 1.476 AGREE | 2.339 NEAR | 2.313 NEAR | 0 / 0 / 0 / 0 / 0 |
| ctrl_noenv_m1_r0_c1 | 0.08 AGREE | 2.99 NEAR | 3.042 NEAR | 3.58 NEAR | 4.485 NEAR | 4.785 NEAR | 5.135 NEAR | 1.476 AGREE | 2.339 NEAR | 2.313 NEAR | 0 / 0 / 0 / 0 / 0 |
| exp2_a_unlit_default | 124.931 FAR | 125.969 FAR | 125.915 FAR | 127.014 FAR | 1.963 AGREE | 1.969 AGREE | 2.201 NEAR | 0.74 AGREE | 1.174 AGREE | 1.16 AGREE | 128 / 255 / 127 / 128 / 128 |
| exp2_b_legacy_default | 3.058 NEAR | 1.505 AGREE | 1.531 AGREE | 1.797 AGREE | 1.963 AGREE | 1.969 AGREE | 2.201 NEAR | 0.74 AGREE | 1.174 AGREE | 1.16 AGREE | 128 / 128 / 127 / 128 / 128 |
| exp2_c_physical_default | 5.196 NEAR | 58.347 FAR | 4.151 NEAR | 2.611 NEAR | 57.693 FAR | 2.771 NEAR | 4.033 NEAR | 59.011 FAR | 56.537 FAR | 3.635 NEAR | 186 / 186 / 187 / 128 / 188 |
| furnace_m0_r0.5_c0.5 | 185.103 FAR | 5.795 NEAR | 7.031 NEAR | 7.293 NEAR | 191.178 FAR | 192.805 FAR | 192.39 FAR | 1.835 AGREE | 2.357 NEAR | 2.157 NEAR | 189 / 183 / 0 / 189 / 190 |
| furnace_m0_r0_c0.5 | 187.096 FAR | 6.396 NEAR | 8.156 FAR | 8.094 FAR | 193.53 FAR | 194.788 FAR | 194.613 FAR | 2.422 NEAR | 3.189 NEAR | 3.869 NEAR | 189 / 183 / 0 / 189 / 191 |
| furnace_m0_r1_c0.5 | 183.56 FAR | 4.857 NEAR | 6.039 NEAR | 4.848 NEAR | 188.954 FAR | 190.146 FAR | 188.904 FAR | 1.616 AGREE | 0.805 AGREE | 2.062 NEAR | 187 / 183 / 0 / 187 / 189 |
| furnace_m0_r1_c1 | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 255 / 250 / 0 / 255 / 255 |
| furnace_m1_r0.25_c1 | 93.364 FAR | 161.558 FAR | 161.558 FAR | 161.558 FAR | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 255 / 1 / 0 / 255 / 255 |
| furnace_m1_r0.5_c1 | 93.364 FAR | 161.558 FAR | 161.558 FAR | 161.558 FAR | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 255 / 1 / 0 / 255 / 255 |
| furnace_m1_r0.75_c1 | 93.364 FAR | 161.558 FAR | 161.558 FAR | 161.558 FAR | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 255 / 1 / 0 / 255 / 255 |
| furnace_m1_r0_c1 | 93.364 FAR | 161.558 FAR | 161.558 FAR | 161.558 FAR | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 255 / 1 / 0 / 255 / 255 |
| furnace_m1_r1_c1 | 93.364 FAR | 161.558 FAR | 161.558 FAR | 161.558 FAR | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 0.0 AGREE | 255 / 1 / 0 / 255 / 255 |
| half_m0_r0_c0.5 | 136.91 FAR | 5.187 NEAR | 6.739 NEAR | 6.823 NEAR | 142.526 FAR | 144.705 FAR | 144.813 FAR | 2.434 NEAR | 3.006 NEAR | 3.461 NEAR | 138 / 133 / 0 / 138 / 140 |
| half_m0_r1_c0.5 | 133.726 FAR | 4.675 NEAR | 5.51 NEAR | 4.951 NEAR | 139.18 FAR | 140.09 FAR | 139.442 FAR | 1.524 AGREE | 1.079 AGREE | 1.921 AGREE | 137 / 133 / 0 / 137 / 138 |
| half_m0_r1_c1 | 183.161 FAR | 3.518 NEAR | 5.454 NEAR | 3.699 NEAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 183 / 0 / 186 / 188 |
| half_m1_r0.25_c1 | 68.211 FAR | 116.173 FAR | 118.037 FAR | 117.036 FAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 1 / 0 / 186 / 188 |
| half_m1_r0.5_c1 | 68.211 FAR | 116.173 FAR | 118.037 FAR | 117.036 FAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 1 / 0 / 186 / 188 |
| half_m1_r0.75_c1 | 68.211 FAR | 116.173 FAR | 118.037 FAR | 117.036 FAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 1 / 0 / 186 / 188 |
| half_m1_r0_c1 | 68.211 FAR | 116.173 FAR | 118.037 FAR | 117.036 FAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 1 / 0 / 186 / 188 |
| half_m1_r1_c1 | 68.211 FAR | 116.173 FAR | 118.037 FAR | 117.036 FAR | 187.126 FAR | 189.172 FAR | 187.303 FAR | 2.334 NEAR | 0.633 AGREE | 2.507 NEAR | 186 / 1 / 0 / 186 / 188 |

| pair | AGREE | NEAR | FAR |
|---|--:|--:|--:|
| babylon|blender | 7 | 2 | 20 |
| babylon|three | 2 | 13 | 14 |
| babylon|wgpu | 2 | 13 | 14 |
| babylon|xite | 2 | 13 | 14 |
| blender|three | 8 | 6 | 15 |
| blender|wgpu | 8 | 7 | 14 |
| blender|xite | 6 | 9 | 14 |
| three|wgpu | 18 | 10 | 1 |
| three|xite | 19 | 9 | 1 |
| wgpu|xite | 10 | 19 | 0 |
