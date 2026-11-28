# Cesium leg: a geo-placed X3D held to CesiumJS

X3D says where a model sits on the Earth with `GeoLocation`. 3D Tiles says it with a root `transform`. This folder
writes the second from the first and then asks CesiumJS itself where it drew the roof.

| file | does |
|---|---|
| `geo_place.py IN OUT --at LAT LON H` | wraps a scene's content in `GeoLocation DEF="GEO_PLACE" geoSystem='"GD" "WE"'`, adds `component Geospatial 1` and a `geo:placement` meta |
| `x3d_to_glb.py` (run inside Blender 5.3 with x3d-blender-io) | X3D → glb, y-up, extras kept |
| `x3d_to_3dtiles.py PLACED.x3d MODEL.glb OUT [--plant lat-lon-swap\|z-up\|height+33]` | 3D Tiles 1.1 tileset: root transform = WGS84 east-north-up frame at the geoCoords (ellipsoidal height), box bounds from the glb; `--plant` writes a deliberately wrong twin |
| `cesium_check.py PLACED.x3d MODEL.glb TILES [--shot PNG] [--out JSON]` | 121 vertical rays at the roof in Python (X3D + glb only) vs CesiumJS `sampleHeightMostDetailed` at the same longitudes and latitudes |
| `cesium_page.html` | the witness page (offline: no ion, no imagery, ellipsoid, globe hidden while sampling) |

Install: `npm ci` here (cesium 1.147.0, 3d-tiles-validator 0.6.1). Python: numpy, playwright.

## Result, 28 Nov 2026

Confluence studio (HagopJay's IFC4 model, via `x3d.engineering/ifc-loop`) at a demonstration placement on the
Virginia Tech Drillfield, 37.2284, -80.4234, 592.4 m. Rig: Playwright Chromium 158 headless, ANGLE on SwiftShader.

| check | result |
|---|---|
| placed X3D, x3d_mcp `validate_xml` | 0 errors, 0 warnings (`results/confluence-geo-x3d-validate.json`) |
| tileset, 3d-tiles-validator 0.6.1 | 0 errors, 0 warnings, 1 info |
| roof hits, Python vs CesiumJS 1.147.0 | 45 of 45 agree, 0 extra, worst 0.34 mm (tolerance 5 cm) |
| our ENU frame vs `Transforms.eastNorthUpToFixedFrame` | 2.4e-7 largest element difference |
| planted `height+33` | caught: 33.00 m off; validator 0 errors |
| planted `z-up` | caught: 41 of 45 points wrong; validator 0 errors |
| planted `lat-lon-swap` | caught: 0 of 45 hit; validator 0 errors |

So the validator is necessary and not sufficient: all three wrong tilesets pass it. Only a runtime asked "where is
the roof?" separates them. Grade: Confirmed on this rig.

Two traps found on the way (LOOM-v1 failure modes 583 to 585):
- `sampleHeightMostDetailed` samples the globe too. With the ellipsoid shown, all 76 points off the roof came back as
  hits at the ellipsoid. The witness hides the globe while sampling.
- The geotiling v1 region tiles are a z11 terrain mesh near the site; at the Drillfield its surface sits 0.7 to 2.3 m
  above the building's floor, so it hides a correctly placed building from up close. The demo page hides that layer
  near the building.

Demo: x3d.demo `docs/demos/cesium-twin/v1/`.
