# Median distance to the other engines (object-pixel MAE, 0-255); **bold** = the outlier (largest median, and above 8)

| scene | babylon | blender | castle | cycles | three | wgpu | xite |
|---|--:|--:|--:|--:|--:|--:|--:|
| lit_dir_diffuse_colour | 2.91 | **13.87** | 4.99 | 12.37 | 3.49 | 3.28 | 3.43 |
| lit_dir_specular | 3.35 | **11.42** | 5.21 | 11.09 | 4.78 | 3.37 | 3.6 |
| lit_emissive_ambient | 13.28 | **24.84** | 18.22 | 23.7 | 16.0 | 13.2 | 13.15 |
| lit_fog_linear | 39.15 | 37.52 | **68.26** | 36.16 | 67.71 | 38.17 | 67.4 |
| lit_headlight_coloured | 2.83 | **78.32** | 5.04 | 9.04 | 2.87 | 2.83 | 3.23 |
| lit_ifs_smooth | 3.38 | 4.09 | **8.06** | 3.24 | 2.8 | 2.87 | 2.8 |
| lit_physical_direct | 5.21 | 5.8 | 5.03 | 5.12 | 7.58 | 4.37 | 4.46 |
| lit_point_attenuation | **30.33** | 11.32 | 10.57 | 11.07 | 12.04 | 10.26 | 10.38 |
| lit_spot_cone | 5.16 | 41.33 | 8.33 | **41.42** | 6.74 | 6.2 | 6.74 |
| lit_texture_pixel | 56.59 | 40.65 | 26.04 | 40.85 | 40.75 | **78.76** | 40.75 |
| lit_transform_nest | 3.29 | 6.75 | 6.17 | 5.57 | 3.71 | 3.71 | 3.71 |
| lit_transparency | 1.85 | **18.02** | 3.26 | 16.26 | 1.87 | 1.86 | 2.09 |

| outlier count (scenes) | babylon: 1 | blender: 5 | castle: 2 | cycles: 1 | three: 0 | wgpu: 1 | xite: 0 |
