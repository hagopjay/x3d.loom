# x3d-glyphs: text as geometry

For a scene that must show labels where no font can be fetched (a hosted page with `connect-src 'self'`, a no-eval policy that breaks X_ITE's WOFF2 decoder, a reader with no font machinery). TrueType outlines are flattened (5 segments per quadratic), triangulated with earcut (holes assigned by containment), defined once in a `Switch whichChoice='-1'` library and reused by `USE`.

- `glyphs.py`: `GlyphLib(path, key)`: outline to mesh, advances, string width.
- `x3d_glyphs.py`: `GlyphText`: `label()` returns Transforms of `<Shape USE>`; `library_xml()` returns the library. Write the library once, ahead of the first label.
- `test_glyphs.py`: every USE resolves; the traps witness stays silent on this scene and fires (`text-needs-font-fetch`) on the same words as `Text`.

Measured on the Landscape world (the delivering thread, 25 Nov): 118 glyph meshes, 21 inks, 532 Shapes, 2,363 USEs, a 361 KB library; file 3.73 to 4.25 MB (+14 %). Needs fontTools, mapbox_earcut, numpy.
