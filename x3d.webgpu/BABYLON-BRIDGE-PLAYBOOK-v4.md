# Babylon bridge playbook v4 (delta on v3), 8 Nov 2026

New file; v1 to v3 stay as they are. Lessons from the Library hall port (the first all-standard-node page, no shader).

1. **16 vertex outputs.** Every shadow-mapped light costs two (light-space position, depth metric), a cascade each. Count shadow lights per mesh before choosing cascades; five lights at one map each fits.
2. **Alpha belongs to the texture.** An UnlitMaterial's PNG alpha is the coverage of sky glows, shafts, halos. Set `hasAlpha`, alpha-from-diffuse, sorted blend, depth write off; leave JPEGs opaque.
3. **Seeking a TimeSensor** is disable, wait two frames, set start, resume and pause times, enable. The bridge must clear pause state on disable or a paused film stays frozen.
4. **loadURL takes an MFString**, not a string.
5. **Fixed chrome over a canvas** must measure the bar (ResizeObserver) rather than assume one row.
6. **Convert at parse time** what Babylon has no node for (Extrusion, Disk2D, Rectangle2D to IndexedFaceSet); update vertex buffers in place for animated coordinates.
7. **Point size** does not exist in WebGPU: camera-facing quads with the X3D attenuation in the vertex shader.
8. **Measure the light unit before blaming it:** `lightScale` 0.75 moved luma 4 percent; the brightness gap was elsewhere.
