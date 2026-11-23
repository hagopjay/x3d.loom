# Learnings: moving the Blender bake leg to a rented GPU (23 Nov 2026)

Four Cycles light-bake jobs (Giza Crawl, Masonic Lodge, Giza Fall, the Semantic Twins context layer) moved from an 8 GB
laptop to a Colab GPU in one evening. Every number names its rig.

## What was measured

| claim | grade | rig and source |
|---|---|---|
| All four jobs run unchanged on Blender 5.3.0 with x3d-blender-io `8e56437` (they were written on 5.1) | Confirmed | bpy 5.3.0 wheel, CPU, `quick` profile: 76 surfaces, four X3D files valid (x3d_mcp fork `4d433af`) |
| OptiX baking works on a Colab NVIDIA L4 | Confirmed | `BAKE DEVICE OPTIX ['NVIDIA L4']` in three build logs |
| Lodge: 15 surfaces at 512 samples, up to 4096 px, bake 355 s | Confirmed | one L4, OptiX, `bake.json` |
| Fall: 11 surfaces at 384 samples, up to 4096 px, bake 188 s | Confirmed | one L4, OptiX, `bake.json` |
| Twins context: 5 surfaces at 512 samples, 2048 px, bake 38 s | Confirmed | one L4, OptiX, `bake.json` |
| The same lodge at 128 samples and 2048 px took 534 s on the laptop | Confirmed | Apple M3, Metal, Blender 5.1.0, the v3 `bake.json` |
| An A100 would bake with CUDA | Likely | not run |

Four times the samples and four times the texels in two thirds of the time is the whole case for the rented GPU. It is
not a speed-up figure: the two runs differ in samples, resolution and Blender version.

## What the loop taught

1. **A silent fallback is the expensive failure.** The bake code fell back to the CPU when the requested backend had no
   device, and kept going. On a paid runtime that is an hour of the wrong hardware. The notebook now stops when a GPU was
   asked for and the log says CPU. Rule: a requested device that is missing is an error, never a default.
2. **Probe the backend, do not name the card.** The first notebook checked for one GPU model by name. The second asks
   Blender which Cycles backends have a device and takes OptiX, then CUDA. That is why an L4 worked with no edit.
3. **Pin both ends and offer one fallback.** Blender version is a dropdown (new default, last-known-good fallback), and
   each version writes to its own output folder, so two runs can be compared instead of overwritten.
4. **Carry linear light, grade late, and grade next to the cache.** The bake writes linear caches; the display grade is a
   seconds-long numpy step. The caches are too large to move, so the grade runs where they are and only graded JPEGs
   travel. Moving a result is part of the pipeline: one zip per job, split under the transfer limit, with a checksum.
5. **Never delete an earlier result to make room for a new one.** The Drive copy step used to remove a folder of the same
   name. It now renames it with a date.
6. **A physics step is not reproducible across Blender versions.** Giza Fall's rigid-body run on 5.3.0 gave a different
   contact count and duration than on 5.1.0. A sim that must match should ship its baked motion, not be re-run.
7. **A new version folder with a receipt beats an edit.** Each demo got a new version whose README table sets the old
   bake beside the new one, with the rig, and a fresh validation receipt replacing the copied one.

## Not measured

Frame rate of the larger textures in a browser on real hardware; the `g4` profile on a G4; any CUDA path.
