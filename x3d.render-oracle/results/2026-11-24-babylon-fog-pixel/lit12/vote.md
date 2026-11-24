# Median distance to the other engines (object-pixel MAE, 0-255); **bold** = the outlier (largest median, and above 8)

| scene | babylon | blender | castle | cycles | three | wgpu | xite |
|---|--:|--:|--:|--:|--:|--:|--:|
| lit_dir_diffuse_colour | 2.91 | **13.87** | 4.99 | 12.37 | 3.49 | 3.28 | 3.43 |
| lit_dir_specular | 3.35 | **11.42** | 5.21 | 11.09 | 4.78 | 3.37 | 3.6 |
| lit_emissive_ambient | 5.52 | **24.9** | 10.43 | 23.74 | 5.79 | 5.6 | 5.83 |
| lit_fog_linear | 3.95 | **68.28** | 5.62 | 66.91 | 4.81 | 4.76 | 4.56 |
| lit_headlight_coloured | 2.83 | **78.32** | 5.04 | 9.04 | 2.87 | 2.83 | 3.23 |
| lit_ifs_smooth | 3.38 | 4.09 | **8.06** | 3.24 | 2.8 | 2.87 | 2.8 |
| lit_physical_direct | 5.21 | 5.8 | 5.03 | 5.12 | 7.58 | 4.37 | 4.46 |
| lit_point_attenuation | 3.23 | **10.65** | 5.86 | 10.28 | 3.45 | 3.48 | 3.64 |
| lit_spot_cone | 5.14 | 41.33 | 8.33 | **41.42** | 6.73 | 6.2 | 6.74 |
| lit_texture_pixel | 18.01 | 40.65 | 25.96 | **40.85** | 16.64 | 16.55 | 16.64 |
| lit_transform_nest | 3.29 | 6.75 | 6.17 | 5.57 | 3.71 | 3.71 | 3.71 |
| lit_transparency | 1.85 | **18.02** | 3.26 | 16.26 | 1.87 | 1.86 | 2.09 |

| outlier count (scenes) | babylon: 0 | blender: 7 | castle: 1 | cycles: 2 | three: 0 | wgpu: 0 | xite: 0 |
