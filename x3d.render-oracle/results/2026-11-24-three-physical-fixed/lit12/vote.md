# Median distance to the other engines (object-pixel MAE, 0-255); **bold** = the outlier (largest median, and above 8)

| scene | babylon | blender | castle | three | wgpu | xite |
|---|--:|--:|--:|--:|--:|--:|
| lit_dir_diffuse_colour | 1.93 | **13.94** | 4.93 | 1.93 | 1.73 | 1.93 |
| lit_dir_specular | 3.22 | **11.44** | 4.1 | 3.22 | 2.92 | 3.1 |
| lit_emissive_ambient | 9.83 | **24.95** | 10.45 | 16.15 | 10.25 | 10.45 |
| lit_fog_linear | **71.35** | 68.08 | 68.85 | 68.4 | 70.52 | 68.08 |
| lit_headlight_coloured | 1.21 | **77.77** | 4.83 | 0.9 | 0.88 | 1.21 |
| lit_ifs_smooth | 2.45 | 4.1 | **8.01** | 2.4 | 2.45 | 2.4 |
| lit_physical_direct | **59.48** | 6.0 | 6.0 | 8.8 | 4.62 | 4.92 |
| lit_point_attenuation | **30.28** | 11.9 | 9.35 | 10.41 | 10.31 | 10.41 |
| lit_spot_cone | 5.16 | **41.33** | 8.32 | 5.16 | 4.3 | 5.16 |
| lit_texture_pixel | 53.66 | 40.65 | 26.04 | 40.65 | **82.79** | 40.65 |
| lit_transform_nest | 1.86 | 6.76 | 6.16 | 1.86 | 1.85 | 1.86 |
| lit_transparency | 0.8 | **18.05** | 3.13 | 0.62 | 0.58 | 0.8 |

| outlier count (scenes) | babylon: 3 | blender: 6 | castle: 1 | three: 0 | wgpu: 1 | xite: 0 |
