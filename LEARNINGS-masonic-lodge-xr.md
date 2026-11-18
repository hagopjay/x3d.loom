# What the Masonic Lodge XR overlay carries back (18 Nov 2026)

Demo: [x3d.demo `docs/demos/masonic-lodge/v1/`](https://github.com/hagopjay/x3d.demo/tree/main/docs/demos/masonic-lodge/v1) (PR #53). Location-based phone AR (AR.js 3.4.7 on A-Frame 1.4.2) over a cutaway Great Pyramid authored as X3D 4.0.

| Lesson | Boundary | Reusable rule |
|---|---|---|
| Keep the scene in X3D even when the AR runtime is not X3D | `giza-lodge.x3d` is the single source; a 70-line subset reader (`x3d2three.js`: Transform, Group, Shape, Material, Box, IndexedFaceSet) draws it in AR.js, X_ITE draws it on the desktop. | The XSD gate (x3d_mcp fa5dccf, 0 errors) certifies the file, not the AR drawing. Say which one a check covers. |
| GPS anchors a coordinate, not a facade | Phone GPS is typically 5 to 20 m outdoors (AR.js docs / platform behaviour, not measured here). | Anchor to the lodge coordinate, offer a scale slider, never promise alignment with the building. |
| Public data, live and local | Lodges load from OpenStreetMap (ODbL) via Overpass for the user's position only, cached 24 h per ~1 km cell; no national list ships. | Grand Lodges should be contacted before any aggregate is published. No lodge list or list-building script is kept in any repo. |
| Test with a fixture, then say what it did not test | Headless Chromium with a fake camera and mocked geolocation: 4 of 4 overlays, 0 console errors. | Live Overpass, a real phone, real compass behaviour and iOS Safari were not run. Overpass was unreachable from the build container, and Wikimedia answered 429 to the shared proxy. |
| Source every number | Great Pyramid 146.6 m high, 230.34 m base (Wikipedia). Chamber and gallery positions are schematic. | Mark schematic geometry as schematic in the file's own `meta`. |

Next: a real-phone test with the Android Chrome and iOS Safari matrix, a Giza v3 geometry swap, and a live Overpass check from an open-network machine.
