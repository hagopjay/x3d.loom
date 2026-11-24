# Disagreement matrix (MAE on object pixels, 0-255; grade AGREE <=2, NEAR <=8, FAR >8)

| scene | babylon|blender | babylon|castle | babylon|cycles | babylon|three | babylon|wgpu | babylon|xite | blender|castle | blender|cycles | blender|three | blender|wgpu | blender|xite | castle|cycles | castle|three | castle|wgpu | castle|xite | cycles|three | cycles|wgpu | cycles|xite | three|wgpu | three|xite | wgpu|xite | centre px xite / babylon / blender / castle / cycles / three / wgpu |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| lit_dir_diffuse_colour | 14.665 FAR | 3.882 NEAR | 13.293 FAR | 1.926 AGREE | 1.726 AGREE | 1.929 AGREE | 14.154 FAR | 2.607 NEAR | 13.942 FAR | 13.755 FAR | 13.791 FAR | 12.679 FAR | 5.052 NEAR | 4.831 NEAR | 4.927 NEAR | 12.448 FAR | 12.291 FAR | 12.296 FAR | 0.66 AGREE | 0.513 AGREE | 0.643 AGREE |  /  /  /  /  /  /  |
| lit_dir_specular | 11.398 FAR | 3.466 NEAR | 11.38 FAR | 3.224 NEAR | 0.651 AGREE | 0.943 AGREE | 10.95 FAR | 1.239 AGREE | 13.016 FAR | 11.435 FAR | 11.55 FAR | 10.747 FAR | 6.331 NEAR | 3.816 NEAR | 4.098 NEAR | 12.653 FAR | 11.046 FAR | 11.13 FAR | 2.925 NEAR | 3.098 NEAR | 0.623 AGREE |  /  /  /  /  /  /  |
| lit_emissive_ambient | 25.342 FAR | 9.834 FAR | 24.444 FAR | 16.717 FAR | 0.957 AGREE | 1.206 AGREE | 34.374 FAR | 1.888 AGREE | 10.008 FAR | 24.95 FAR | 24.733 FAR | 33.465 FAR | 25.989 FAR | 10.248 FAR | 10.452 FAR | 8.901 FAR | 23.797 FAR | 23.603 FAR | 16.15 FAR | 15.851 FAR | 0.501 AGREE |  /  /  /  /  /  /  |
| lit_fog_linear | 6.962 NEAR | 73.5 FAR | 5.597 NEAR | 71.685 FAR | 2.161 NEAR | 71.346 FAR | 68.847 FAR | 2.468 NEAR | 68.398 FAR | 5.826 NEAR | 68.079 FAR | 67.668 FAR | 5.608 NEAR | 71.324 FAR | 5.433 NEAR | 67.031 FAR | 4.247 NEAR | 66.714 FAR | 70.86 FAR | 0.347 AGREE | 70.52 FAR |  /  /  /  /  /  /  |
| lit_headlight_coloured | 78.867 FAR | 4.456 NEAR | 9.004 FAR | 0.9 AGREE | 0.876 AGREE | 1.208 AGREE | 83.495 FAR | 80.755 FAR | 77.769 FAR | 77.528 FAR | 77.547 FAR | 9.281 FAR | 4.832 NEAR | 4.776 NEAR | 5.249 NEAR | 8.7 FAR | 8.659 FAR | 9.073 FAR | 0.473 AGREE | 0.706 AGREE | 0.837 AGREE |  /  /  /  /  /  /  |
| lit_ifs_smooth | 5.088 NEAR | 6.047 NEAR | 4.297 NEAR | 2.398 NEAR | 2.453 NEAR | 2.396 NEAR | 9.697 FAR | 1.603 AGREE | 4.076 NEAR | 4.096 NEAR | 4.074 NEAR | 9.055 FAR | 8.012 FAR | 8.103 FAR | 8.011 FAR | 3.211 NEAR | 3.277 NEAR | 3.206 NEAR | 0.743 AGREE | 0.004 AGREE | 0.742 AGREE |  /  /  /  /  /  /  |
| lit_physical_direct | 6.108 NEAR | 1.278 AGREE | 5.613 NEAR | 5.255 NEAR | 5.172 NEAR | 1.454 AGREE | 5.999 NEAR | 1.387 AGREE | 9.839 FAR | 4.007 NEAR | 5.602 NEAR | 5.433 NEAR | 6.356 NEAR | 4.618 NEAR | 1.69 AGREE | 9.039 FAR | 3.29 NEAR | 4.797 NEAR | 8.799 FAR | 4.923 NEAR | 4.119 NEAR |  /  /  /  /  /  /  |
| lit_point_attenuation | 30.277 FAR | 29.548 FAR | 30.382 FAR | 21.146 FAR | 31.051 FAR | 31.251 FAR | 11.897 FAR | 1.292 AGREE | 14.075 FAR | 10.548 FAR | 10.752 FAR | 11.785 FAR | 9.354 FAR | 5.774 NEAR | 5.945 NEAR | 13.675 FAR | 10.205 FAR | 10.351 FAR | 10.308 FAR | 10.413 FAR | 0.506 AGREE |  /  /  /  /  /  /  |
| lit_spot_cone | 42.638 FAR | 4.384 NEAR | 43.005 FAR | 5.161 NEAR | 4.302 NEAR | 5.159 NEAR | 40.093 FAR | 0.882 AGREE | 41.33 FAR | 42.28 FAR | 41.333 FAR | 40.261 FAR | 8.324 FAR | 8.105 FAR | 8.33 FAR | 41.419 FAR | 42.368 FAR | 41.425 FAR | 1.41 AGREE | 0.011 AGREE | 1.404 AGREE |  /  /  /  /  /  /  |
| lit_texture_pixel | 59.517 FAR | 53.664 FAR | 59.956 FAR | 52.743 FAR | 83.352 FAR | 52.742 FAR | 26.038 FAR | 1.025 AGREE | 40.649 FAR | 66.146 FAR | 40.648 FAR | 26.035 FAR | 25.877 FAR | 74.735 FAR | 25.877 FAR | 40.854 FAR | 66.312 FAR | 40.853 FAR | 82.788 FAR | 0.002 AGREE | 82.787 FAR |  /  /  /  /  /  /  |
| lit_transform_nest | 7.511 NEAR | 4.728 NEAR | 6.475 NEAR | 1.861 AGREE | 1.85 AGREE | 1.862 AGREE | 10.208 FAR | 1.922 AGREE | 6.743 NEAR | 6.756 NEAR | 6.746 NEAR | 9.239 FAR | 6.164 NEAR | 6.141 NEAR | 6.166 NEAR | 5.568 NEAR | 5.575 NEAR | 5.568 NEAR | 0.262 AGREE | 0.003 AGREE | 0.26 AGREE |  /  /  /  /  /  /  |
| lit_transparency | 18.095 FAR | 2.898 NEAR | 16.476 FAR | 0.619 AGREE | 0.581 AGREE | 0.799 AGREE | 16.918 FAR | 3.089 NEAR | 17.997 FAR | 18.046 FAR | 18.301 FAR | 15.075 FAR | 3.116 NEAR | 3.131 NEAR | 3.381 NEAR | 16.245 FAR | 16.273 FAR | 16.492 FAR | 0.318 AGREE | 0.566 AGREE | 0.53 AGREE |  /  /  /  /  /  /  |

| pair | AGREE | NEAR | FAR |
|---|--:|--:|--:|
| babylon|blender | 0 | 4 | 8 |
| babylon|castle | 1 | 7 | 4 |
| babylon|cycles | 0 | 4 | 8 |
| babylon|three | 4 | 4 | 4 |
| babylon|wgpu | 6 | 4 | 2 |
| babylon|xite | 7 | 2 | 3 |
| blender|castle | 0 | 1 | 11 |
| blender|cycles | 8 | 3 | 1 |
| blender|three | 0 | 2 | 10 |
| blender|wgpu | 0 | 4 | 8 |
| blender|xite | 0 | 3 | 9 |
| castle|cycles | 0 | 1 | 11 |
| castle|three | 0 | 7 | 5 |
| castle|wgpu | 0 | 7 | 5 |
| castle|xite | 1 | 7 | 4 |
| cycles|three | 0 | 2 | 10 |
| cycles|wgpu | 0 | 4 | 8 |
| cycles|xite | 0 | 3 | 9 |
| three|wgpu | 6 | 1 | 5 |
| three|xite | 8 | 2 | 2 |
| wgpu|xite | 9 | 1 | 2 |
