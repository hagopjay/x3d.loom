# Disagreement matrix (MAE on object pixels, 0-255; grade AGREE <=2, NEAR <=8, FAR >8)

| scene | babylon|blender | babylon|castle | babylon|three | babylon|wgpu | babylon|xite | blender|castle | blender|three | blender|wgpu | blender|xite | castle|three | castle|wgpu | castle|xite | three|wgpu | three|xite | wgpu|xite | centre px xite / babylon / blender / castle / three / wgpu |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| lit_dir_diffuse_colour | 14.665 FAR | 3.882 NEAR | 1.926 AGREE | 1.726 AGREE | 1.929 AGREE | 14.154 FAR | 13.942 FAR | 13.755 FAR | 13.791 FAR | 5.052 NEAR | 4.831 NEAR | 4.927 NEAR | 0.66 AGREE | 0.513 AGREE | 0.643 AGREE |  /  /  /  /  /  |
| lit_dir_specular | 11.398 FAR | 3.466 NEAR | 3.224 NEAR | 0.651 AGREE | 0.943 AGREE | 10.95 FAR | 13.016 FAR | 11.435 FAR | 11.55 FAR | 6.331 NEAR | 3.816 NEAR | 4.098 NEAR | 2.925 NEAR | 3.098 NEAR | 0.623 AGREE |  /  /  /  /  /  |
| lit_emissive_ambient | 25.342 FAR | 9.834 FAR | 16.717 FAR | 0.957 AGREE | 1.206 AGREE | 34.374 FAR | 10.008 FAR | 24.95 FAR | 24.733 FAR | 25.989 FAR | 10.248 FAR | 10.452 FAR | 16.15 FAR | 15.851 FAR | 0.501 AGREE |  /  /  /  /  /  |
| lit_fog_linear | 6.962 NEAR | 73.5 FAR | 71.685 FAR | 2.161 NEAR | 71.346 FAR | 68.847 FAR | 68.398 FAR | 5.826 NEAR | 68.079 FAR | 5.608 NEAR | 71.324 FAR | 5.433 NEAR | 70.86 FAR | 0.347 AGREE | 70.52 FAR |  /  /  /  /  /  |
| lit_headlight_coloured | 78.867 FAR | 4.456 NEAR | 0.9 AGREE | 0.876 AGREE | 1.208 AGREE | 83.495 FAR | 77.769 FAR | 77.528 FAR | 77.547 FAR | 4.832 NEAR | 4.776 NEAR | 5.249 NEAR | 0.473 AGREE | 0.706 AGREE | 0.837 AGREE |  /  /  /  /  /  |
| lit_ifs_smooth | 5.088 NEAR | 6.047 NEAR | 2.398 NEAR | 2.453 NEAR | 2.396 NEAR | 9.697 FAR | 4.076 NEAR | 4.096 NEAR | 4.074 NEAR | 8.012 FAR | 8.103 FAR | 8.011 FAR | 0.743 AGREE | 0.004 AGREE | 0.742 AGREE |  /  /  /  /  /  |
| lit_physical_direct | 57.957 FAR | 60.095 FAR | 55.106 FAR | 55.926 FAR | 59.484 FAR | 5.999 NEAR | 23.739 FAR | 4.007 NEAR | 5.602 NEAR | 25.161 FAR | 4.618 NEAR | 1.69 AGREE | 21.159 FAR | 24.941 FAR | 4.119 NEAR |  /  /  /  /  /  |
| lit_point_attenuation | 30.277 FAR | 29.548 FAR | 21.146 FAR | 31.051 FAR | 31.251 FAR | 11.897 FAR | 14.075 FAR | 10.548 FAR | 10.752 FAR | 9.354 FAR | 5.774 NEAR | 5.945 NEAR | 10.308 FAR | 10.413 FAR | 0.506 AGREE |  /  /  /  /  /  |
| lit_spot_cone | 42.638 FAR | 4.384 NEAR | 5.161 NEAR | 4.302 NEAR | 5.159 NEAR | 40.093 FAR | 41.33 FAR | 42.28 FAR | 41.333 FAR | 8.324 FAR | 8.105 FAR | 8.33 FAR | 1.41 AGREE | 0.011 AGREE | 1.404 AGREE |  /  /  /  /  /  |
| lit_texture_pixel | 59.517 FAR | 53.664 FAR | 52.743 FAR | 83.352 FAR | 52.742 FAR | 26.038 FAR | 40.649 FAR | 66.146 FAR | 40.648 FAR | 25.877 FAR | 74.735 FAR | 25.877 FAR | 82.788 FAR | 0.002 AGREE | 82.787 FAR |  /  /  /  /  /  |
| lit_transform_nest | 7.511 NEAR | 4.728 NEAR | 1.861 AGREE | 1.85 AGREE | 1.862 AGREE | 10.208 FAR | 6.743 NEAR | 6.756 NEAR | 6.746 NEAR | 6.164 NEAR | 6.141 NEAR | 6.166 NEAR | 0.262 AGREE | 0.003 AGREE | 0.26 AGREE |  /  /  /  /  /  |
| lit_transparency | 18.095 FAR | 2.898 NEAR | 0.619 AGREE | 0.581 AGREE | 0.799 AGREE | 16.918 FAR | 17.997 FAR | 18.046 FAR | 18.301 FAR | 3.116 NEAR | 3.131 NEAR | 3.381 NEAR | 0.318 AGREE | 0.566 AGREE | 0.53 AGREE |  /  /  /  /  /  |

| pair | AGREE | NEAR | FAR |
|---|--:|--:|--:|
| babylon|blender | 0 | 3 | 9 |
| babylon|castle | 0 | 7 | 5 |
| babylon|three | 4 | 3 | 5 |
| babylon|wgpu | 6 | 3 | 3 |
| babylon|xite | 6 | 2 | 4 |
| blender|castle | 0 | 1 | 11 |
| blender|three | 0 | 2 | 10 |
| blender|wgpu | 0 | 4 | 8 |
| blender|xite | 0 | 3 | 9 |
| castle|three | 0 | 6 | 6 |
| castle|wgpu | 0 | 7 | 5 |
| castle|xite | 1 | 7 | 4 |
| three|wgpu | 6 | 1 | 5 |
| three|xite | 8 | 1 | 3 |
| wgpu|xite | 9 | 1 | 2 |
